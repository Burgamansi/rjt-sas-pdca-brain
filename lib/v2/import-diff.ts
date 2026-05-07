/**
 * PHASE 0 — Import Diff Engine
 *
 * Server-side only. Stateless, pure function.
 *
 * RESPONSIBILITY:
 *   Given a set of incoming parsed rows (from Excel parser) and the current
 *   state of the database (fetched before calling), compute the full diff:
 *     new       — row exists in incoming, not in DB
 *     updated   — row exists in both, but hash has changed
 *     unchanged — row exists in both, hash is identical
 *     removed   — row exists in DB, not in incoming
 *     duplicate — row appears more than once in the same incoming batch
 *
 * MATCHING STRATEGY:
 *   Rows are matched by stable_key (UUID v5), which is derived deterministically
 *   from (pdca_id + phase + action_id + subaction_id).
 *   Row INDEX is NEVER used for matching.
 *
 * PDF KNOWLEDGE FIELDS:
 *   como_fazer, observacao, insumos, evidencia_sgq are NEVER included in the
 *   diff comparison for Excel imports. They live in a separate lifecycle.
 *   Excel re-import CANNOT overwrite them.
 *
 * USAGE:
 *   const diff = computeImportDiff(incoming, existing, "PDCA-01", "planilha.xlsx");
 *   // Show diff.totals to user for confirmation before committing to DB.
 */

import { hashSubactionRow, hashActionRow, hashPdcaRow } from "./hash";
import {
  pdcaMasterUuid,
  pdcaActionUuid,
  pdcaSubactionUuid,
} from "./uuid-deterministic";
import type {
  ParsedSubactionRow,
  ParsedActionRow,
  ParsedPdcaRow,
  PdcaSubactionRow,
  PdcaActionRow,
  PdcaMasterRow,
  ImportDiffEntry,
  ImportDiffReport,
  DiffStatus,
} from "./types";

// ─────────────────────────────────────────────
// CHANGE SUMMARY HELPERS
// ─────────────────────────────────────────────

type ChangedField = {
  field: string;
  from: string;
  to: string;
};

function diffSubactionFields(
  incoming: ParsedSubactionRow,
  existing: PdcaSubactionRow
): ChangedField[] {
  const comparisons: Array<[keyof ParsedSubactionRow, keyof PdcaSubactionRow]> = [
    ["nome", "nome"],
    ["responsavel", "responsavel"],
    ["prazo", "prazo"],
    ["status", "status"],
    ["criticidade", "criticidade"],
    ["gut_score", "gut_score"],
    ["indicador", "indicador"],
    ["meta", "meta"],
    ["resultado", "resultado"],
  ];

  const changed: ChangedField[] = [];
  for (const [inKey, exKey] of comparisons) {
    const inVal = String(incoming[inKey] ?? "").trim();
    const exVal = String(existing[exKey] ?? "").trim();
    if (inVal.toLowerCase() !== exVal.toLowerCase()) {
      changed.push({ field: inKey, from: exVal, to: inVal });
    }
  }
  return changed;
}

function diffActionFields(
  incoming: ParsedActionRow,
  existing: PdcaActionRow
): ChangedField[] {
  const changed: ChangedField[] = [];
  const inAcao = String(incoming.acao ?? "").trim();
  const exAcao = String(existing.acao ?? "").trim();
  if (inAcao.toLowerCase() !== exAcao.toLowerCase()) {
    changed.push({ field: "acao", from: exAcao, to: inAcao });
  }
  return changed;
}

// ─────────────────────────────────────────────
// SUBACTION DIFF
// ─────────────────────────────────────────────

export function diffSubactions(
  incoming: ParsedSubactionRow[],
  existing: PdcaSubactionRow[]
): ImportDiffEntry<ParsedSubactionRow | PdcaSubactionRow>[] {
  const existingByKey = new Map(existing.map((r) => [r.uuid, r]));
  const seenKeys = new Set<string>();
  const keyCount = new Map<string, number>();

  const diffs: ImportDiffEntry<ParsedSubactionRow | PdcaSubactionRow>[] = [];

  for (const row of incoming) {
    const stableKey = pdcaSubactionUuid(
      row.pdca_id,
      row.phase,
      row.action_id,
      row.subaction_id
    );
    const rowHash = hashSubactionRow(row);

    // Duplicate detection within the same import batch
    const count = (keyCount.get(stableKey) ?? 0) + 1;
    keyCount.set(stableKey, count);

    if (count > 1) {
      diffs.push({
        diff_status: "duplicate",
        stable_key: stableKey,
        row_hash: rowHash,
        incoming: row,
        existing: existingByKey.get(stableKey) ?? null,
        change_summary: [`Duplicate subaction_id '${row.subaction_id}' in phase ${row.phase}`],
      });
      continue;
    }

    seenKeys.add(stableKey);
    const existingRow = existingByKey.get(stableKey);

    if (!existingRow) {
      diffs.push({
        diff_status: "new",
        stable_key: stableKey,
        row_hash: rowHash,
        incoming: row,
        existing: null,
      });
    } else if (existingRow.row_hash === rowHash) {
      diffs.push({
        diff_status: "unchanged",
        stable_key: stableKey,
        row_hash: rowHash,
        incoming: row,
        existing: existingRow,
      });
    } else {
      const changed = diffSubactionFields(row, existingRow);
      diffs.push({
        diff_status: "updated",
        stable_key: stableKey,
        row_hash: rowHash,
        incoming: row,
        existing: existingRow,
        change_summary: changed.map((c) => `${c.field}: "${c.from}" → "${c.to}"`),
      });
    }
  }

  // Detect removed rows: in DB but not in this incoming batch
  for (const existingRow of existing) {
    if (!seenKeys.has(existingRow.uuid)) {
      diffs.push({
        diff_status: "removed",
        stable_key: existingRow.uuid,
        row_hash: existingRow.row_hash,
        incoming: null,
        existing: existingRow,
        change_summary: [`Row '${existingRow.subaction_id}' is present in DB but not in imported file`],
      });
    }
  }

  return diffs;
}

// ─────────────────────────────────────────────
// ACTION DIFF
// ─────────────────────────────────────────────

export function diffActions(
  incoming: ParsedActionRow[],
  existing: PdcaActionRow[]
): ImportDiffEntry<ParsedActionRow | PdcaActionRow>[] {
  const existingByKey = new Map(existing.map((r) => [r.uuid, r]));
  const seenKeys = new Set<string>();
  const keyCount = new Map<string, number>();

  const diffs: ImportDiffEntry<ParsedActionRow | PdcaActionRow>[] = [];

  for (const row of incoming) {
    const stableKey = pdcaActionUuid(row.pdca_id, row.phase, row.action_id);
    const rowHash = hashActionRow(row);

    const count = (keyCount.get(stableKey) ?? 0) + 1;
    keyCount.set(stableKey, count);

    if (count > 1) {
      diffs.push({
        diff_status: "duplicate",
        stable_key: stableKey,
        row_hash: rowHash,
        incoming: row,
        existing: existingByKey.get(stableKey) ?? null,
        change_summary: [`Duplicate action_id '${row.action_id}' in phase ${row.phase}`],
      });
      continue;
    }

    seenKeys.add(stableKey);
    const existingRow = existingByKey.get(stableKey);

    if (!existingRow) {
      diffs.push({ diff_status: "new", stable_key: stableKey, row_hash: rowHash, incoming: row, existing: null });
    } else if (existingRow.row_hash === rowHash) {
      diffs.push({ diff_status: "unchanged", stable_key: stableKey, row_hash: rowHash, incoming: row, existing: existingRow });
    } else {
      const changed = diffActionFields(row, existingRow);
      diffs.push({
        diff_status: "updated",
        stable_key: stableKey,
        row_hash: rowHash,
        incoming: row,
        existing: existingRow,
        change_summary: changed.map((c) => `${c.field}: "${c.from}" → "${c.to}"`),
      });
    }
  }

  for (const existingRow of existing) {
    if (!seenKeys.has(existingRow.uuid)) {
      diffs.push({
        diff_status: "removed",
        stable_key: existingRow.uuid,
        row_hash: existingRow.row_hash,
        incoming: null,
        existing: existingRow,
      });
    }
  }

  return diffs;
}

// ─────────────────────────────────────────────
// FULL IMPORT DIFF REPORT
// ─────────────────────────────────────────────

export type ExistingDbState = {
  subactions: PdcaSubactionRow[];
  actions: PdcaActionRow[];
  master: PdcaMasterRow | null;
};

export type IncomingParsed = {
  subactions: ParsedSubactionRow[];
  actions: ParsedActionRow[];
  master: ParsedPdcaRow;
};

/**
 * Compute the full import diff report for one PDCA.
 * Call this before committing any data to the DB.
 * Show the report to the user for confirmation.
 */
export function computeImportDiff(
  incoming: IncomingParsed,
  existing: ExistingDbState,
  importSessionId: string
): ImportDiffReport {
  const subactionDiffs = diffSubactions(incoming.subactions, existing.subactions);
  const actionDiffs = diffActions(incoming.actions, existing.actions);

  function countStatus(
    diffs: ImportDiffEntry<unknown>[],
    status: DiffStatus
  ): number {
    return diffs.filter((d) => d.diff_status === status).length;
  }

  const subTotals = {
    new: countStatus(subactionDiffs, "new"),
    updated: countStatus(subactionDiffs, "updated"),
    unchanged: countStatus(subactionDiffs, "unchanged"),
    removed: countStatus(subactionDiffs, "removed"),
    duplicate: countStatus(subactionDiffs, "duplicate"),
  };

  return {
    pdca_id: incoming.master.pdca_id,
    source_file: incoming.master.fonte_arquivo,
    import_session_id: importSessionId,
    generated_at: new Date().toISOString(),
    totals: subTotals,
    subaction_diffs: subactionDiffs as ImportDiffEntry<PdcaSubactionRow>[],
    action_diffs: actionDiffs as ImportDiffEntry<PdcaActionRow>[],
  };
}

// ─────────────────────────────────────────────
// STABLE KEY ASSIGNMENT
// Enrich parsed rows with their stable UUIDs + hashes.
// Called after validation, before DB write.
// ─────────────────────────────────────────────

export type EnrichedSubactionRow = ParsedSubactionRow & {
  uuid: string;
  row_hash: string;
};

export type EnrichedActionRow = ParsedActionRow & {
  uuid: string;
  row_hash: string;
};

export type EnrichedPdcaRow = ParsedPdcaRow & {
  uuid: string;
  row_hash: string;
};

export function enrichSubaction(row: ParsedSubactionRow): EnrichedSubactionRow {
  return {
    ...row,
    uuid: pdcaSubactionUuid(row.pdca_id, row.phase, row.action_id, row.subaction_id),
    row_hash: hashSubactionRow(row),
  };
}

export function enrichAction(row: ParsedActionRow): EnrichedActionRow {
  return {
    ...row,
    uuid: pdcaActionUuid(row.pdca_id, row.phase, row.action_id),
    row_hash: hashActionRow(row),
  };
}

export function enrichPdca(row: ParsedPdcaRow): EnrichedPdcaRow {
  return {
    ...row,
    uuid: pdcaMasterUuid(row.pdca_id),
    row_hash: hashPdcaRow(row),
  };
}
