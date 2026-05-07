/**
 * PHASE 0 — Normalized Type Definitions
 *
 * These types mirror the target normalized database schema.
 * They are ISOLATED from the existing lib/types.ts (legacy).
 * No imports from existing production code.
 *
 * Hierarchy:
 *   PdcaMasterRow
 *     └─ PdcaActionRow       (phase + action within PDCA)
 *          └─ PdcaSubactionRow  (task/subaction within action)
 *               └─ TaskEvidenceRow  (versioned evidence per task)
 */

// ─────────────────────────────────────────────
// ENUMERATIONS (canonical, exhaustive)
// ─────────────────────────────────────────────

export type PdcaPhaseCode = "PLAN" | "DO" | "CHECK" | "ACT";

export type PdcaMasterStatus =
  | "Em Planejamento"
  | "Em Execucao"
  | "Concluido"
  | "Atrasado"
  | "Suspenso";

export type TaskStatus =
  | "Pendente"
  | "Em Execucao"
  | "Concluido"
  | "Atrasado"
  | "Aguardando"
  | "Cancelado";

export type Criticidade = "ALTA" | "MEDIA" | "BAIXA";

/** Tracks whether PDF knowledge engine has injected fields into this subaction. */
export type PdfMatchStatus =
  | "NOT_ATTEMPTED"
  | "MATCHED"
  | "UNMATCHED"
  | "REVIEW_PENDING";

export type EvidenceFileType =
  | "pdf"
  | "xlsx"
  | "docx"
  | "jpg"
  | "png"
  | "mp4"
  | "other";

export type ImportType = "EXCEL" | "PDF_INJECT" | "PDF_LEGACY";

export type ImportSessionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED";

export type DiffStatus =
  | "new"
  | "updated"
  | "unchanged"
  | "removed"
  | "duplicate";

export type PdfReviewStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "AUTO_MATCHED";

// ─────────────────────────────────────────────
// NORMALIZED DB ROW TYPES
// One type per table. Fields match SQL column names exactly.
// ─────────────────────────────────────────────

/**
 * pdca_master — top-level PDCA record.
 * uuid: UUID v5 stable key (deterministic from pdca_id).
 * row_hash: SHA-256 of content fields (change detection).
 */
export type PdcaMasterRow = {
  uuid: string;
  pdca_id: string;
  titulo: string;
  area: string;
  situacao: string | null;
  causas: string | null;
  gut_g: number | null;
  gut_u: number | null;
  gut_t: number | null;
  gut_total: number | null;
  status: PdcaMasterStatus;
  fonte_arquivo: string | null;
  raw_payload: unknown | null;
  row_hash: string;
  created_at: string;
  updated_at: string;
};

/**
 * pdca_actions — one action within a PDCA phase.
 * uuid: UUID v5 stable key (deterministic from pdca_id + phase + action_id).
 * action_id: visual ID ("P1", "D2") — display only, NOT a primary key.
 * import_seq: position within phase (for ordering only).
 */
export type PdcaActionRow = {
  uuid: string;
  action_id: string;
  pdca_uuid: string;
  pdca_id: string;
  phase: PdcaPhaseCode;
  acao: string;
  import_seq: number;
  row_hash: string;
  created_at: string;
  updated_at: string;
};

/**
 * pdca_subactions — one task/subaction within an action.
 * uuid: UUID v5 stable key (deterministic from pdca_id + phase + action_id + subaction_id).
 * subaction_id: visual ID ("SP.1", "SD.5") — display only, NOT a primary key.
 *
 * PDF-injected fields (como_fazer, observacao, insumos, evidencia_sgq) are
 * managed exclusively by the PDF Knowledge Engine (Tab 2).
 * Excel re-import NEVER overwrites these fields.
 *
 * row_hash covers ONLY Excel-sourced fields (not PDF-injected).
 */
export type PdcaSubactionRow = {
  uuid: string;
  subaction_id: string;
  action_uuid: string;
  pdca_uuid: string;
  pdca_id: string;
  phase: PdcaPhaseCode;
  nome: string;
  responsavel: string | null;
  prazo: string | null;
  status: TaskStatus;
  criticidade: Criticidade;
  gut_score: number | null;
  indicador: string | null;
  meta: string | null;
  resultado: string | null;
  // PDF Knowledge Engine fields — read-only from Excel import perspective
  como_fazer: string | null;
  observacao: string | null;
  insumos: string | null;
  evidencia_sgq: string | null;
  pdf_match_status: PdfMatchStatus;
  // Hash covers Excel fields only
  row_hash: string;
  created_at: string;
  updated_at: string;
};

// ─────────────────────────────────────────────
// EVIDENCE (VERSIONED)
// ─────────────────────────────────────────────

/**
 * task_evidences — versioned evidence file linked to a specific task UUID.
 *
 * IMMUTABILITY RULES:
 *   - NEVER overwrite an evidence record.
 *   - NEVER hard-delete from DB.
 *   - On new upload: set previous is_latest=FALSE, INSERT new with version+1.
 *   - On "delete": set is_latest=FALSE, deleted_at=now() (soft delete).
 *   - sha256_hash must be computed from file content before upload.
 *   - uploaded_by is REQUIRED (no nullable).
 */
export type TaskEvidenceRow = {
  id: string;
  evidence_ref: string;
  task_uuid: string;
  action_uuid: string;
  pdca_uuid: string;
  pdca_id: string;
  company_id: string;
  file_name: string;
  file_type: EvidenceFileType;
  file_url: string | null;
  file_size: number | null;
  sha256_hash: string;
  version: number;
  is_latest: boolean;
  deleted_at: string | null;
  uploaded_by: string;
  uploaded_at: string;
  notes: string | null;
};

// ─────────────────────────────────────────────
// IMPORT SESSION + DIFF
// ─────────────────────────────────────────────

/**
 * ImportSessionRow — one import event (one file processed).
 * Persisted in import_sessions table.
 */
export type ImportSessionRow = {
  id: string;
  source_file: string;
  file_hash: string;
  import_type: ImportType;
  triggered_by: string;
  status: ImportSessionStatus;
  rows_new: number;
  rows_updated: number;
  rows_unchanged: number;
  rows_removed: number;
  rows_duplicate: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

/**
 * ImportDiffEntry<T> — result of comparing one incoming row against DB state.
 * change_summary lists which fields changed (only for "updated" entries).
 */
export type ImportDiffEntry<T = PdcaSubactionRow> = {
  diff_status: DiffStatus;
  stable_key: string;
  row_hash: string;
  incoming: T | null;
  existing: T | null;
  change_summary?: string[];
};

/**
 * ImportDiffReport — full diff for one import session.
 * Returned to UI for user review before commit.
 */
export type ImportDiffReport = {
  pdca_id: string;
  source_file: string;
  import_session_id: string;
  generated_at: string;
  totals: {
    new: number;
    updated: number;
    unchanged: number;
    removed: number;
    duplicate: number;
  };
  subaction_diffs: ImportDiffEntry<PdcaSubactionRow>[];
  action_diffs: ImportDiffEntry<PdcaActionRow>[];
};

// ─────────────────────────────────────────────
// PDF REVIEW QUEUE
// ─────────────────────────────────────────────

/**
 * PdfReviewQueueRow — PDF block that could not be auto-matched to a subaction.
 * Operator must manually approve/reject each entry.
 */
export type PdfReviewQueueRow = {
  id: string;
  source_file: string;
  block_text: string;
  attempted_id: string | null;
  block_index: number;
  status: PdfReviewStatus;
  matched_subaction_uuid: string | null;
  matched_fields: Partial<
    Pick<
      PdcaSubactionRow,
      "como_fazer" | "observacao" | "insumos" | "evidencia_sgq"
    >
  > | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

// ─────────────────────────────────────────────
// INCOMING PARSED ROW (from Excel parser output)
// Used as input to the diff engine before DB write.
// ─────────────────────────────────────────────

/**
 * ParsedSubactionRow — normalized output from Excel parser (pre-DB).
 * Contains only Excel-sourced fields. No UUIDs yet (assigned by diff engine).
 */
export type ParsedSubactionRow = {
  pdca_id: string;
  phase: PdcaPhaseCode;
  action_id: string;
  action_name: string;
  subaction_id: string;
  nome: string;
  responsavel: string;
  prazo: string;
  status: TaskStatus;
  criticidade: Criticidade;
  gut_score: number;
  indicador: string;
  meta: string;
  resultado: string;
};

export type ParsedActionRow = {
  pdca_id: string;
  phase: PdcaPhaseCode;
  action_id: string;
  acao: string;
  import_seq: number;
};

export type ParsedPdcaRow = {
  pdca_id: string;
  titulo: string;
  area: string;
  situacao: string;
  causas: string;
  gut_g: number;
  gut_u: number;
  gut_t: number;
  status: PdcaMasterStatus;
  fonte_arquivo: string;
};
