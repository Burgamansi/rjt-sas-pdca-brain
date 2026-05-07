-- ============================================================
-- PHASE 0 — Migration 013: Import History + Versioned Evidence
-- STATUS: PREPARED — NOT YET APPLIED TO PRODUCTION
-- Apply after migration 010.
--
-- CREATES:
--   import_sessions      — one row per import event
--   import_session_rows  — per-row diff result of each import
--   task_evidences       — versioned, FK-linked evidence files
--
-- REPLACES (in Phase 1):
--   The existing pdca_evidences table (no FK, no version, no hash).
--   pdca_evidences will be migrated → task_evidences in Phase 1.
--   pdca_evidences is NOT dropped here.
-- ============================================================

-- ─────────────────────────────────────────────
-- TABLE: import_sessions
-- One row per file processed by the import engine.
-- Records the full outcome of each import operation.
-- ─────────────────────────────────────────────

create table if not exists public.import_sessions (
  id              uuid        primary key default gen_random_uuid(),

  -- Source
  source_file     text        not null,
  file_hash       text        not null,
  import_type     text        not null default 'EXCEL'
                  check (import_type in ('EXCEL', 'PDF_INJECT', 'PDF_LEGACY')),

  -- Attribution
  triggered_by    text        not null default 'system',

  -- Status
  status          text        not null default 'PENDING'
                  check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')),

  -- Diff summary (denormalized counts for quick display)
  rows_new        integer     not null default 0,
  rows_updated    integer     not null default 0,
  rows_unchanged  integer     not null default 0,
  rows_removed    integer     not null default 0,
  rows_duplicate  integer     not null default 0,
  rows_error      integer     not null default 0,

  -- Error context (if status=FAILED)
  error_message   text,
  error_detail    jsonb,

  -- Timing
  started_at      timestamptz not null default now(),
  completed_at    timestamptz
);

comment on table public.import_sessions is
  'Server-side import log. Replaces in-memory import log on frontend.';
comment on column public.import_sessions.file_hash is
  'SHA-256 of the source file bytes. Enables duplicate-upload detection.';
comment on column public.import_sessions.triggered_by is
  'User email or "system". Required for attribution.';

create index if not exists idx_import_sessions_status
  on public.import_sessions (status, started_at desc);
create index if not exists idx_import_sessions_file_hash
  on public.import_sessions (file_hash);
create index if not exists idx_import_sessions_started
  on public.import_sessions (started_at desc);

-- ─────────────────────────────────────────────
-- TABLE: import_session_rows
-- One row per subaction diff entry per import session.
-- Full diff record for audit and undo capability.
-- ─────────────────────────────────────────────

create table if not exists public.import_session_rows (
  id              uuid        primary key default gen_random_uuid(),
  session_id      uuid        not null references public.import_sessions (id) on delete cascade,

  -- Which entity this row refers to
  entity_type     text        not null check (entity_type in ('PDCA', 'ACTION', 'SUBACTION')),
  stable_key      uuid        not null,
  visual_id       text,
  pdca_id         text,

  -- Diff outcome
  diff_status     text        not null
                  check (diff_status in ('new', 'updated', 'unchanged', 'removed', 'duplicate')),
  row_hash_before text,
  row_hash_after  text,

  -- Changed fields (for "updated" entries)
  changed_fields  text[],

  -- Snapshots (before/after)
  data_before     jsonb,
  data_after      jsonb,

  -- Error context (if this row failed during commit)
  error_message   text,

  created_at      timestamptz not null default now()
);

comment on table public.import_session_rows is
  'Row-level diff record for each import. Enables rollback analysis and full traceability.';

create index if not exists idx_import_rows_session_id
  on public.import_session_rows (session_id, entity_type);
create index if not exists idx_import_rows_stable_key
  on public.import_session_rows (stable_key, diff_status);
create index if not exists idx_import_rows_pdca_id
  on public.import_session_rows (pdca_id, diff_status);

-- ─────────────────────────────────────────────
-- TABLE: task_evidences
-- Versioned evidence files linked to a specific subaction UUID.
--
-- IMMUTABILITY CONTRACT:
--   RULE 1: Never overwrite an evidence record (no UPDATE on content fields).
--   RULE 2: Never hard-delete. Use deleted_at (soft delete).
--   RULE 3: On new upload for same task: set previous is_latest=FALSE, insert new.
--   RULE 4: version is monotonically increasing per task_uuid.
--   RULE 5: sha256_hash must be computed from file content before upload.
--   RULE 6: uploaded_by is REQUIRED (non-nullable) for ISO 9001 attribution.
-- ─────────────────────────────────────────────

create table if not exists public.task_evidences (
  -- Identity
  id              uuid        primary key default gen_random_uuid(),
  evidence_ref    text        not null,

  -- Chain of custody (all 3 levels required for full ISO 9001 traceability)
  task_uuid       uuid        not null references public.pdca_subactions (uuid),
  action_uuid     uuid        not null references public.pdca_actions (uuid),
  pdca_uuid       uuid        not null references public.pdca_master (uuid),
  pdca_id         text        not null,

  -- Organization
  company_id      text        not null default 'UBG',

  -- File metadata
  file_name       text        not null,
  file_type       text        not null
                  check (file_type in ('pdf', 'xlsx', 'docx', 'jpg', 'png', 'mp4', 'other')),
  file_url        text,
  file_size       integer     check (file_size is null or file_size >= 0),

  -- Integrity
  sha256_hash     text        not null check (length(sha256_hash) = 64),

  -- Versioning
  version         integer     not null default 1 check (version >= 1),
  is_latest       boolean     not null default true,

  -- Soft delete
  deleted_at      timestamptz,

  -- Attribution (REQUIRED — no nullable)
  uploaded_by     text        not null,
  uploaded_at     timestamptz not null default now(),

  -- Optional operator notes
  notes           text,

  -- At most one row per (task_uuid, version)
  unique (task_uuid, version)
);

comment on table public.task_evidences is
  'Versioned evidence files. Append-only per task. Full ISO 9001 chain of custody.';
comment on column public.task_evidences.sha256_hash is
  'SHA-256 of file content bytes. Computed client-side before upload.';
comment on column public.task_evidences.version is
  'Monotonically increasing per task_uuid. Version 1 = first upload.';
comment on column public.task_evidences.is_latest is
  'TRUE for the most recent non-deleted version of this task evidence.';
comment on column public.task_evidences.deleted_at is
  'Soft delete timestamp. NULL = active. Set when superseded or removed.';
comment on column public.task_evidences.uploaded_by is
  'Required. User email. Enforces accountability per ISO 9001.';

-- Indexes
create index if not exists idx_task_evidences_task_uuid
  on public.task_evidences (task_uuid);
create index if not exists idx_task_evidences_latest
  on public.task_evidences (task_uuid)
  where is_latest = true and deleted_at is null;
create index if not exists idx_task_evidences_pdca_uuid
  on public.task_evidences (pdca_uuid);
create index if not exists idx_task_evidences_hash
  on public.task_evidences (sha256_hash);

-- ─────────────────────────────────────────────
-- FUNCTION: fn_evidence_version_on_insert
-- Automatically:
--   1. Assigns next version number for this task
--   2. Sets previous is_latest = FALSE
-- Called BEFORE INSERT on task_evidences.
-- ─────────────────────────────────────────────

create or replace function public.fn_evidence_version_on_insert()
returns trigger
language plpgsql
as $$
declare
  v_next_version integer;
begin
  -- Get next version for this task
  select coalesce(max(version), 0) + 1
  into v_next_version
  from public.task_evidences
  where task_uuid = new.task_uuid;

  -- Set version and ensure is_latest = true for the new row
  new.version   := v_next_version;
  new.is_latest := true;

  -- Demote previous latest versions
  update public.task_evidences
  set is_latest = false
  where task_uuid = new.task_uuid
    and is_latest = true;

  return new;
end;
$$;

drop trigger if exists trg_evidence_version on public.task_evidences;
create trigger trg_evidence_version
  before insert on public.task_evidences
  for each row execute function public.fn_evidence_version_on_insert();

-- ─────────────────────────────────────────────
-- FUNCTION: fn_duplicate_evidence_guard
-- Prevents uploading a file that is identical (same hash) for same task.
-- Returns exception — duplicate upload must be confirmed by user.
-- ─────────────────────────────────────────────

create or replace function public.fn_duplicate_evidence_guard()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.task_evidences
    where task_uuid   = new.task_uuid
      and sha256_hash = new.sha256_hash
      and deleted_at  is null
  ) then
    raise exception
      'Duplicate evidence: a file with hash % already exists for task %. Upload cancelled.',
      new.sha256_hash, new.task_uuid
      using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_evidence_duplicate_guard on public.task_evidences;
create trigger trg_evidence_duplicate_guard
  before insert on public.task_evidences
  for each row execute function public.fn_duplicate_evidence_guard();

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────

alter table public.import_sessions      enable row level security;
alter table public.import_session_rows  enable row level security;
alter table public.task_evidences       enable row level security;

create policy import_sessions_service_all
  on public.import_sessions for all to service_role using (true) with check (true);

create policy import_rows_service_all
  on public.import_session_rows for all to service_role using (true) with check (true);

create policy task_evidences_service_all
  on public.task_evidences for all to service_role using (true) with check (true);

-- ─────────────────────────────────────────────
-- VIEW: ISO 9001 Full Traceability Chain
-- Links PDCA → Action → Subaction → Evidence
-- ─────────────────────────────────────────────

create or replace view public.v_iso9001_traceability as
select
  pm.pdca_id,
  pm.titulo           as pdca_titulo,
  pa.phase,
  pa.action_id,
  pa.acao,
  ps.subaction_id,
  ps.nome             as task_nome,
  ps.responsavel,
  ps.prazo,
  ps.status           as task_status,
  ps.criticidade,
  ps.pdf_match_status,
  te.id               as evidence_id,
  te.evidence_ref,
  te.file_name,
  te.file_type,
  te.version          as evidence_version,
  te.sha256_hash,
  te.uploaded_by,
  te.uploaded_at,
  te.is_latest        as evidence_is_latest,
  te.deleted_at       as evidence_deleted_at,
  -- Completeness flags
  (te.id is not null)                                 as has_evidence,
  (ps.status = 'Concluido' and te.id is null)         as missing_evidence_alert,
  (ps.como_fazer is not null)                         as has_pdf_knowledge
from public.pdca_master pm
join public.pdca_actions pa       on pa.pdca_uuid     = pm.uuid
join public.pdca_subactions ps    on ps.action_uuid   = pa.uuid
left join public.task_evidences te on te.task_uuid    = ps.uuid
                                  and te.is_latest    = true
                                  and te.deleted_at   is null
where ps.is_archived = false
order by
  pm.pdca_id,
  pa.phase,
  pa.import_seq,
  ps.subaction_id;

comment on view public.v_iso9001_traceability is
  'Full PDCA→Action→Subaction→Evidence chain. Used by Tab 4 (Audit & Evidence).';

notify pgrst, 'reload schema';
