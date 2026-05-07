/**
 * PHASE 0 — SHA-256 Row Hashing
 *
 * Server-side only (uses Node.js `crypto` module).
 * Never import this in client components.
 *
 * DESIGN CONTRACT:
 *   - Hash is computed from CONTENT fields only.
 *   - Identity fields (uuid, pdca_id, action_id, subaction_id) are NOT hashed —
 *     they are used for matching, not change detection.
 *   - Metadata fields (created_at, updated_at, pdf_match_status) are NOT hashed.
 *   - PDF-injected fields (como_fazer, observacao, insumos, evidencia_sgq) are
 *     NOT included in the Excel row hash. They have their own lifecycle.
 *   - Serialization is deterministic: sorted, lowercased, trimmed.
 *
 * USAGE:
 *   const hash = hashSubactionRow(row);
 *   // Re-import of same row → same hash → diff status = "unchanged"
 *   // Any data field change → different hash → diff status = "updated"
 */

import { createHash } from "crypto";
import type {
  ParsedSubactionRow,
  ParsedActionRow,
  ParsedPdcaRow,
} from "./types";

// ─────────────────────────────────────────────
// FIELD LISTS (what gets hashed per entity type)
// ─────────────────────────────────────────────

/** Excel-sourced content fields for a subaction. Order matters — do not change. */
const SUBACTION_HASH_FIELDS: ReadonlyArray<keyof ParsedSubactionRow> = [
  "nome",
  "responsavel",
  "prazo",
  "status",
  "criticidade",
  "gut_score",
  "indicador",
  "meta",
  "resultado",
];

const ACTION_HASH_FIELDS: ReadonlyArray<keyof ParsedActionRow> = ["acao"];

const PDCA_HASH_FIELDS: ReadonlyArray<keyof ParsedPdcaRow> = [
  "titulo",
  "area",
  "situacao",
  "causas",
  "gut_g",
  "gut_u",
  "gut_t",
  "status",
];

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function buildHashInput(
  row: Record<string, unknown>,
  fields: ReadonlyArray<string>
): string {
  return fields.map((f) => normalize(row[f])).join("\x00");
}

// ─────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────

/**
 * Hash a parsed subaction row.
 * Covers Excel-sourced content fields only.
 * Same input → same hash, always.
 */
export function hashSubactionRow(row: ParsedSubactionRow): string {
  const input = buildHashInput(
    row as unknown as Record<string, unknown>,
    SUBACTION_HASH_FIELDS
  );
  return sha256(input);
}

/**
 * Hash a parsed action row.
 */
export function hashActionRow(row: ParsedActionRow): string {
  const input = buildHashInput(
    row as unknown as Record<string, unknown>,
    ACTION_HASH_FIELDS
  );
  return sha256(input);
}

/**
 * Hash a parsed PDCA master row.
 */
export function hashPdcaRow(row: ParsedPdcaRow): string {
  const input = buildHashInput(
    row as unknown as Record<string, unknown>,
    PDCA_HASH_FIELDS
  );
  return sha256(input);
}

/**
 * Hash an arbitrary object with explicit field list.
 * Useful for one-off hashing outside the main entity types.
 */
export function hashFields(
  row: Record<string, unknown>,
  fields: string[]
): string {
  const input = buildHashInput(row, fields);
  return sha256(input);
}

/**
 * Hash a file Buffer or Uint8Array (for evidence integrity).
 * Returns hex SHA-256 of the raw bytes.
 */
export function hashFileBuffer(buffer: Buffer | Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Hash a source import file represented as an ArrayBuffer (client → server).
 * Used to detect duplicate re-uploads of the same file.
 */
export function hashArrayBuffer(buffer: ArrayBuffer): string {
  return createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}
