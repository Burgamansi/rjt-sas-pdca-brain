/**
 * PHASE 0 — Runtime Validators
 *
 * Pure TypeScript. No Zod, no external runtime deps.
 * Called at system boundaries: API route ingestion, parser output, evidence upload.
 *
 * DESIGN:
 *   - Every validator returns ValidationResult (never throws).
 *   - Errors are field-level, structured for UI display.
 *   - "soft" violations become warnings (import proceeds with flag).
 *   - "hard" violations block the import entirely.
 */

import type {
  ParsedSubactionRow,
  ParsedActionRow,
  ParsedPdcaRow,
  PdcaPhaseCode,
  TaskStatus,
  Criticidade,
  EvidenceFileType,
} from "./types";

// ─────────────────────────────────────────────
// RESULT TYPE
// ─────────────────────────────────────────────

export type ValidationError = {
  field: string;
  message: string;
  severity: "error" | "warning";
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
};

function ok(): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

function fail(errors: ValidationError[], warnings: ValidationError[] = []): ValidationResult {
  return { valid: errors.length === 0, errors, warnings };
}

// ─────────────────────────────────────────────
// CANONICAL VALUE SETS
// ─────────────────────────────────────────────

const VALID_PHASES: ReadonlySet<string> = new Set<PdcaPhaseCode>([
  "PLAN",
  "DO",
  "CHECK",
  "ACT",
]);

const VALID_TASK_STATUSES: ReadonlySet<string> = new Set<TaskStatus>([
  "Pendente",
  "Em Execucao",
  "Concluido",
  "Atrasado",
  "Aguardando",
  "Cancelado",
]);

const VALID_CRITICIDADE: ReadonlySet<string> = new Set<Criticidade>([
  "ALTA",
  "MEDIA",
  "BAIXA",
]);

const VALID_EVIDENCE_TYPES: ReadonlySet<string> = new Set<EvidenceFileType>([
  "pdf",
  "xlsx",
  "docx",
  "jpg",
  "png",
  "mp4",
  "other",
]);

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function hasValue(v: unknown): boolean {
  return v !== null && v !== undefined && String(v).trim() !== "";
}

function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v);
}

function isValidUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
}

// ─────────────────────────────────────────────
// PDCA MASTER VALIDATOR
// ─────────────────────────────────────────────

export function validateParsedPdca(row: Partial<ParsedPdcaRow>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!hasValue(row.pdca_id)) {
    errors.push({ field: "pdca_id", message: "pdca_id is required", severity: "error" });
  } else if (!/^[A-Za-z0-9_\-\.]{1,30}$/.test(String(row.pdca_id))) {
    errors.push({
      field: "pdca_id",
      message: `pdca_id '${row.pdca_id}' contains invalid characters. Use alphanumeric, dash, underscore, dot only (max 30 chars).`,
      severity: "error",
    });
  }

  if (!hasValue(row.titulo)) {
    errors.push({ field: "titulo", message: "titulo is required", severity: "error" });
  }

  if (!hasValue(row.area)) {
    warnings.push({ field: "area", message: "area not provided — will default to 'A definir'", severity: "warning" });
  }

  for (const field of ["gut_g", "gut_u", "gut_t"] as const) {
    const v = row[field];
    if (v !== null && v !== undefined) {
      if (!Number.isInteger(v) || v < 1 || v > 10) {
        warnings.push({
          field,
          message: `${field} = ${v} is outside expected range 1–10`,
          severity: "warning",
        });
      }
    }
  }

  return fail(errors, warnings);
}

// ─────────────────────────────────────────────
// ACTION VALIDATOR
// ─────────────────────────────────────────────

export function validateParsedAction(row: Partial<ParsedActionRow>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!hasValue(row.pdca_id)) {
    errors.push({ field: "pdca_id", message: "pdca_id is required", severity: "error" });
  }

  if (!hasValue(row.phase) || !VALID_PHASES.has(String(row.phase))) {
    errors.push({
      field: "phase",
      message: `Invalid phase '${row.phase}'. Must be one of: PLAN, DO, CHECK, ACT`,
      severity: "error",
    });
  }

  if (!hasValue(row.action_id)) {
    errors.push({ field: "action_id", message: "action_id is required", severity: "error" });
  }

  if (!hasValue(row.acao)) {
    warnings.push({ field: "acao", message: "acao (action name) is empty", severity: "warning" });
  }

  return fail(errors, warnings);
}

// ─────────────────────────────────────────────
// SUBACTION VALIDATOR
// ─────────────────────────────────────────────

export function validateParsedSubaction(
  row: Partial<ParsedSubactionRow>
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!hasValue(row.pdca_id)) {
    errors.push({ field: "pdca_id", message: "pdca_id is required", severity: "error" });
  }

  if (!hasValue(row.phase) || !VALID_PHASES.has(String(row.phase))) {
    errors.push({
      field: "phase",
      message: `Invalid phase '${row.phase}'. Must be one of: PLAN, DO, CHECK, ACT`,
      severity: "error",
    });
  }

  if (!hasValue(row.action_id)) {
    errors.push({ field: "action_id", message: "action_id is required", severity: "error" });
  }

  if (!hasValue(row.subaction_id)) {
    errors.push({ field: "subaction_id", message: "subaction_id is required", severity: "error" });
  }

  if (!hasValue(row.nome)) {
    errors.push({ field: "nome", message: "nome (task description) is required", severity: "error" });
  } else if (String(row.nome).length < 5) {
    warnings.push({
      field: "nome",
      message: `nome '${row.nome}' is too short (min 5 chars). Possible parser artefact.`,
      severity: "warning",
    });
  }

  if (hasValue(row.status) && !VALID_TASK_STATUSES.has(String(row.status))) {
    warnings.push({
      field: "status",
      message: `Unknown status '${row.status}'. Will be stored as-is — verify mapping.`,
      severity: "warning",
    });
  }

  if (hasValue(row.criticidade) && !VALID_CRITICIDADE.has(String(row.criticidade))) {
    warnings.push({
      field: "criticidade",
      message: `Unknown criticidade '${row.criticidade}'. Defaulting to MEDIA.`,
      severity: "warning",
    });
  }

  if (hasValue(row.prazo)) {
    const prazoStr = String(row.prazo);
    if (!isIsoDate(prazoStr)) {
      warnings.push({
        field: "prazo",
        message: `prazo '${prazoStr}' is not in ISO date format (YYYY-MM-DD). Stored as text.`,
        severity: "warning",
      });
    }
  }

  if (hasValue(row.gut_score)) {
    const g = Number(row.gut_score);
    if (!Number.isFinite(g) || g < 0 || g > 1000) {
      warnings.push({
        field: "gut_score",
        message: `gut_score ${row.gut_score} is outside expected range 0–1000`,
        severity: "warning",
      });
    }
  }

  return fail(errors, warnings);
}

// ─────────────────────────────────────────────
// EVIDENCE UPLOAD VALIDATOR
// ─────────────────────────────────────────────

export type EvidenceUploadInput = {
  task_uuid?: string;
  pdca_id?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  sha256_hash?: string;
  uploaded_by?: string;
};

export function validateEvidenceUpload(input: EvidenceUploadInput): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!hasValue(input.task_uuid) || !isValidUuid(String(input.task_uuid))) {
    errors.push({
      field: "task_uuid",
      message: "task_uuid is required and must be a valid UUID",
      severity: "error",
    });
  }

  if (!hasValue(input.pdca_id)) {
    errors.push({ field: "pdca_id", message: "pdca_id is required", severity: "error" });
  }

  if (!hasValue(input.file_name)) {
    errors.push({ field: "file_name", message: "file_name is required", severity: "error" });
  }

  if (!hasValue(input.file_type)) {
    errors.push({ field: "file_type", message: "file_type is required", severity: "error" });
  } else if (!VALID_EVIDENCE_TYPES.has(String(input.file_type).toLowerCase())) {
    errors.push({
      field: "file_type",
      message: `Unsupported file type '${input.file_type}'. Allowed: pdf, xlsx, docx, jpg, png, mp4, other`,
      severity: "error",
    });
  }

  if (!hasValue(input.uploaded_by)) {
    errors.push({
      field: "uploaded_by",
      message: "uploaded_by is required. Evidence must have user attribution.",
      severity: "error",
    });
  }

  if (!hasValue(input.sha256_hash) || !/^[0-9a-f]{64}$/.test(String(input.sha256_hash))) {
    errors.push({
      field: "sha256_hash",
      message: "sha256_hash is required and must be a valid 64-character hex string",
      severity: "error",
    });
  }

  if (input.file_size !== undefined && input.file_size > MAX_FILE_SIZE_BYTES) {
    errors.push({
      field: "file_size",
      message: `File size ${input.file_size} bytes exceeds limit of ${MAX_FILE_SIZE_BYTES} bytes (50 MB)`,
      severity: "error",
    });
  }

  return fail(errors, warnings);
}

// ─────────────────────────────────────────────
// BATCH VALIDATION HELPER
// ─────────────────────────────────────────────

/**
 * Validate an entire batch of subaction rows.
 * Returns aggregate result with per-row error context.
 */
export type BatchValidationResult = {
  valid: boolean;
  totalRows: number;
  errorCount: number;
  warningCount: number;
  rowResults: Array<{
    rowIndex: number;
    subaction_id?: string;
    result: ValidationResult;
  }>;
};

export function validateSubactionBatch(
  rows: Array<Partial<ParsedSubactionRow>>
): BatchValidationResult {
  let errorCount = 0;
  let warningCount = 0;

  const rowResults = rows.map((row, idx) => {
    const result = validateParsedSubaction(row);
    errorCount += result.errors.length;
    warningCount += result.warnings.length;
    return {
      rowIndex: idx,
      subaction_id: row.subaction_id,
      result,
    };
  });

  return {
    valid: errorCount === 0,
    totalRows: rows.length,
    errorCount,
    warningCount,
    rowResults,
  };
}

// ─────────────────────────────────────────────
// PDF BLOCK VALIDATOR
// ─────────────────────────────────────────────

export type PdfBlockInput = {
  block_text?: string;
  attempted_id?: string;
  source_file?: string;
};

export function validatePdfBlock(input: PdfBlockInput): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!hasValue(input.source_file)) {
    errors.push({ field: "source_file", message: "source_file is required", severity: "error" });
  }

  if (!hasValue(input.block_text)) {
    errors.push({ field: "block_text", message: "block_text cannot be empty", severity: "error" });
  } else if (String(input.block_text).length < 10) {
    warnings.push({
      field: "block_text",
      message: "block_text is very short — may be a parser artefact",
      severity: "warning",
    });
  }

  // ID format check: must be like "01.01", "02.03", etc.
  if (hasValue(input.attempted_id)) {
    if (!/^\d{2}\.\d{2}$/.test(String(input.attempted_id))) {
      warnings.push({
        field: "attempted_id",
        message: `attempted_id '${input.attempted_id}' does not match expected pattern XX.XX (e.g., 01.01)`,
        severity: "warning",
      });
    }
  } else {
    warnings.push({
      field: "attempted_id",
      message: "No ACTION: ID found in block. Will be queued for manual review.",
      severity: "warning",
    });
  }

  return fail(errors, warnings);
}
