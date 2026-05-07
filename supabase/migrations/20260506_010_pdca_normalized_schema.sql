-- ============================================================
-- PHASE 0 — Migration 010: Normalized PDCA Schema
-- STATUS: PREPARED — NOT YET APPLIED TO PRODUCTION
-- Apply manually in Phase 1 after full review.
--
-- STRATEGY:
--   Creates new normalized tables alongside existing pdca_brain.
--   Does NOT drop or alter any existing tables.
--   pdca_brain remains intact as read-only archive during migration.
--
-- HIERARCHY:
--   pdca_master
--     └─ pdca_actions  (one per phase+action within a PDCA)
--          └─ pdca_subactions  (one per task/subaction within an action)
--
-- UUID SCHEME:
--   uuid = UUID v5 deterministic stable key (set at import time from lib/v2/uuid-deterministic.ts)
--   This UUID is immutable after first INSERT.
--   row_hash = SHA-256 of content fields (from lib/v2/hash.ts)
--   Used to detect changes on re-import without comparing every field.
--
-- VISUAL IDs:
--   pdca_id, action_id, subaction_id are human-readable display identifiers.
--   They are NOT primary keys. uuid IS the primary key.
--   Uniqueness is enforced by UNIQUE constraints on (parent_uuid + visual_id).
-- ============================================================

-- ─────────────────────────────────────────────
-- SHARED: auto-update trigger function
-- ─────────────────────────────────────────────

create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- TABLE: pdca_master
-- Top-level PDCA record.
-- ─────────────────────────────────────────────

create table if not exists public.pdca_master (
  -- Identity
  uuid          uuid        primary key,
  pdca_id       text        not null unique,

  -- Content
  titulo        text        not null,
  area          text        not null default 'A definir',
  situacao      text,
  causas        text,

  -- GUT Analysis (stored separately for querying)
  gut_g         smallint    check (gut_g is null or (gut_g >= 1 and gut_g <= 10)),
  gut_u         smallint    check (gut_u is null or (gut_u >= 1 and gut_u <= 10)),
  gut_t         smallint    check (gut_t is null or (gut_t >= 1 and gut_t <= 10)),
  gut_total     smallint    generated always as (
    case
      when gut_g is not null and gut_u is not null and gut_t is not null
      then gut_g * gut_u * gut_t
      else null
    end
  ) stored,

  -- Status (canonical values enforced by application, not DB constraint for flexibility)
  status        text        not null default 'Em Planejamento',
  fonte_arquivo text,

  -- Archive: raw parsed payload kept for traceability
  raw_payload   jsonb,

  -- Integrity
  row_hash      text        not null,

  -- Timestamps
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.pdca_master is
  'Normalized PDCA master records. uuid is immutable UUID v5 stable key.';
comment on column public.pdca_master.uuid is
  'UUID v5 derived from pdca_id. Immutable. Set once at first import.';
comment on column public.pdca_master.pdca_id is
  'Human-readable identifier (e.g. PDCA-01). Display only, not a sequence.';
comment on column public.pdca_master.row_hash is
  'SHA-256 of content fields. Used for change detection on re-import.';
comment on column public.pdca_master.raw_payload is
  'Full parsed PdcaRecord stored as archive. Not operational — do not query.';

create index if not exists idx_pdca_master_status
  on public.pdca_master (status);
create index if not exists idx_pdca_master_updated
  on public.pdca_master (updated_at desc);

drop trigger if exists trg_pdca_master_updated_at on public.pdca_master;
create trigger trg_pdca_master_updated_at
  before update on public.pdca_master
  for each row execute function public.fn_set_updated_at();

-- ─────────────────────────────────────────────
-- TABLE: pdca_actions
-- One action per PDCA phase (e.g., P1, D2).
-- ─────────────────────────────────────────────

create table if not exists public.pdca_actions (
  -- Identity
  uuid          uuid        primary key,
  action_id     text        not null,

  -- Relations
  pdca_uuid     uuid        not null references public.pdca_master (uuid) on delete cascade,
  pdca_id       text        not null,

  -- Content
  phase         text        not null check (phase in ('PLAN', 'DO', 'CHECK', 'ACT')),
  acao          text        not null,
  import_seq    integer     not null default 0,

  -- Integrity
  row_hash      text        not null,

  -- Timestamps
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Visual ID must be unique within same PDCA + phase
  unique (pdca_uuid, phase, action_id)
);

comment on table public.pdca_actions is
  'Actions within a PDCA phase. action_id is visual ("P1") not a sequence.';
comment on column public.pdca_actions.action_id is
  'Visual display ID (e.g., "P1", "D2"). NOT a primary key.';
comment on column public.pdca_actions.import_seq is
  'Position within phase for ordering. Not a primary key.';

create index if not exists idx_pdca_actions_pdca_uuid
  on public.pdca_actions (pdca_uuid);
create index if not exists idx_pdca_actions_phase
  on public.pdca_actions (phase);
create index if not exists idx_pdca_actions_pdca_phase
  on public.pdca_actions (pdca_uuid, phase);

drop trigger if exists trg_pdca_actions_updated_at on public.pdca_actions;
create trigger trg_pdca_actions_updated_at
  before update on public.pdca_actions
  for each row execute function public.fn_set_updated_at();

-- ─────────────────────────────────────────────
-- TABLE: pdca_subactions
-- One task/subaction per action (e.g., SP.1, SD.3).
-- ─────────────────────────────────────────────

create table if not exists public.pdca_subactions (
  -- Identity
  uuid            uuid        primary key,
  subaction_id    text        not null,

  -- Relations
  action_uuid     uuid        not null references public.pdca_actions (uuid) on delete cascade,
  pdca_uuid       uuid        not null references public.pdca_master (uuid) on delete cascade,
  pdca_id         text        not null,
  phase           text        not null check (phase in ('PLAN', 'DO', 'CHECK', 'ACT')),

  -- Excel-sourced content fields
  nome            text        not null,
  responsavel     text,
  prazo           text,
  status          text        not null default 'Pendente',
  criticidade     text        not null default 'MEDIA'
                              check (criticidade in ('ALTA', 'MEDIA', 'BAIXA')),
  gut_score       smallint,
  indicador       text,
  meta            text,
  resultado       text,

  -- PDF Knowledge Engine fields (managed separately, not overwritten by Excel import)
  como_fazer      text,
  observacao      text,
  insumos         text,
  evidencia_sgq   text,
  pdf_match_status text not null default 'NOT_ATTEMPTED'
                        check (pdf_match_status in (
                          'NOT_ATTEMPTED', 'MATCHED', 'UNMATCHED', 'REVIEW_PENDING'
                        )),

  -- Soft delete (rows are never hard-deleted; marked archived on removal)
  is_archived     boolean     not null default false,
  archived_at     timestamptz,

  -- Integrity (covers Excel fields only, NOT pdf-injected fields)
  row_hash        text        not null,

  -- Timestamps
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Visual ID must be unique within same action
  unique (action_uuid, subaction_id)
);

comment on table public.pdca_subactions is
  'Tasks/subactions. Soft-deleted on removal (is_archived). PDF fields are write-once from PDF engine.';
comment on column public.pdca_subactions.subaction_id is
  'Visual display ID (e.g., "SP.1"). NOT a primary key.';
comment on column public.pdca_subactions.row_hash is
  'SHA-256 of Excel-sourced fields ONLY. PDF fields do not affect this hash.';
comment on column public.pdca_subactions.pdf_match_status is
  'Tracks PDF Knowledge Engine matching state. Set by /api/pdcas/pdf-inject only.';
comment on column public.pdca_subactions.is_archived is
  'TRUE when row was present in DB but absent in a re-import. Never hard-deleted.';

create index if not exists idx_pdca_subactions_action_uuid
  on public.pdca_subactions (action_uuid);
create index if not exists idx_pdca_subactions_pdca_uuid
  on public.pdca_subactions (pdca_uuid);
create index if not exists idx_pdca_subactions_status
  on public.pdca_subactions (status) where not is_archived;
create index if not exists idx_pdca_subactions_responsavel
  on public.pdca_subactions (responsavel) where not is_archived;
create index if not exists idx_pdca_subactions_criticidade
  on public.pdca_subactions (criticidade) where not is_archived;
create index if not exists idx_pdca_subactions_pdf_unmatched
  on public.pdca_subactions (pdca_uuid)
  where pdf_match_status in ('NOT_ATTEMPTED', 'UNMATCHED');

drop trigger if exists trg_pdca_subactions_updated_at on public.pdca_subactions;
create trigger trg_pdca_subactions_updated_at
  before update on public.pdca_subactions
  for each row execute function public.fn_set_updated_at();

-- ─────────────────────────────────────────────
-- RLS (Row Level Security)
-- Locked down by company_id at application layer.
-- anon access removed — service role only.
-- ─────────────────────────────────────────────

alter table public.pdca_master      enable row level security;
alter table public.pdca_actions     enable row level security;
alter table public.pdca_subactions  enable row level security;

-- Service role (server-side API) has full access
create policy pdca_master_service_all
  on public.pdca_master for all to service_role using (true) with check (true);

create policy pdca_actions_service_all
  on public.pdca_actions for all to service_role using (true) with check (true);

create policy pdca_subactions_service_all
  on public.pdca_subactions for all to service_role using (true) with check (true);

notify pgrst, 'reload schema';
