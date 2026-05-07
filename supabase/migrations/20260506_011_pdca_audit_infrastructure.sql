-- ============================================================
-- PHASE 0 — Migration 011: Audit Infrastructure
-- STATUS: PREPARED — NOT YET APPLIED TO PRODUCTION
-- Apply after migration 010.
--
-- CREATES:
--   pdca_audit_log       — immutable change record per row
--   Trigger function     — fn_audit_log_record (attached to all normalized tables)
--   Triggers             — on pdca_master, pdca_actions, pdca_subactions
--
-- DESIGN:
--   Every INSERT, UPDATE, and DELETE on normalized tables is automatically
--   recorded as an immutable row in pdca_audit_log.
--   The audit_log table has no UPDATE or DELETE policies (append-only).
--
-- ISO 9001 RELEVANCE:
--   Clause 7.5.3 — Control of documented information (version, change history)
--   Clause 9.1   — Monitoring, measurement, analysis, and evaluation
--   Clause 10.2  — Nonconformity and corrective action (traceability)
-- ============================================================

-- ─────────────────────────────────────────────
-- TABLE: pdca_audit_log
-- Append-only. One row per change on any normalized table.
-- ─────────────────────────────────────────────

create table if not exists public.pdca_audit_log (
  id            uuid        primary key default gen_random_uuid(),

  -- Source
  table_name    text        not null,
  record_uuid   uuid        not null,
  pdca_id       text,

  -- Change
  operation     text        not null check (operation in ('INSERT', 'UPDATE', 'DELETE', 'ARCHIVE')),
  old_data      jsonb,
  new_data      jsonb,

  -- Changed fields summary (for UPDATE only)
  changed_fields text[],

  -- Attribution
  changed_by    text,
  session_id    text,

  -- Immutable timestamp
  changed_at    timestamptz not null default now()
);

comment on table public.pdca_audit_log is
  'Immutable audit trail. No UPDATE or DELETE allowed. ISO 9001 compliant.';
comment on column public.pdca_audit_log.record_uuid is
  'UUID of the affected row (uuid column from any normalized table).';
comment on column public.pdca_audit_log.operation is
  'INSERT=first created, UPDATE=fields changed, DELETE=hard delete (should not occur), ARCHIVE=soft delete (is_archived=true).';
comment on column public.pdca_audit_log.changed_fields is
  'Array of field names that changed (UPDATE only). Null for INSERT/DELETE.';

-- Query index: find all changes to a specific record over time
create index if not exists idx_audit_log_record_uuid
  on public.pdca_audit_log (record_uuid, changed_at desc);

-- Query index: find all recent changes across all records
create index if not exists idx_audit_log_changed_at
  on public.pdca_audit_log (changed_at desc);

-- Query index: find all changes to a specific PDCA
create index if not exists idx_audit_log_pdca_id
  on public.pdca_audit_log (pdca_id, changed_at desc);

-- Query index: find all operations of a given type
create index if not exists idx_audit_log_operation
  on public.pdca_audit_log (operation, changed_at desc);

-- ─────────────────────────────────────────────
-- TRIGGER FUNCTION: fn_audit_log_record
-- Attached to INSERT/UPDATE/DELETE on all normalized tables.
-- ─────────────────────────────────────────────

create or replace function public.fn_audit_log_record()
returns trigger
language plpgsql
security definer
as $$
declare
  v_operation     text;
  v_old_data      jsonb;
  v_new_data      jsonb;
  v_record_uuid   uuid;
  v_pdca_id       text;
  v_changed_fields text[];
begin
  -- Determine operation type
  if tg_op = 'INSERT' then
    v_operation   := 'INSERT';
    v_old_data    := null;
    v_new_data    := to_jsonb(new);
    v_record_uuid := new.uuid;
    v_pdca_id     := new.pdca_id;

  elsif tg_op = 'UPDATE' then
    -- Detect soft-archive operation
    if tg_relname = 'pdca_subactions'
       and old.is_archived = false
       and new.is_archived = true
    then
      v_operation := 'ARCHIVE';
    else
      v_operation := 'UPDATE';
    end if;

    v_old_data    := to_jsonb(old);
    v_new_data    := to_jsonb(new);
    v_record_uuid := new.uuid;
    v_pdca_id     := new.pdca_id;

    -- Compute changed fields array
    select array_agg(key)
    into v_changed_fields
    from (
      select key
      from jsonb_each_text(to_jsonb(new))
      where key not in ('updated_at', 'row_hash')
        and jsonb_each_text(to_jsonb(new)).value is distinct from
            (to_jsonb(old) ->> key)
    ) changed;

  elsif tg_op = 'DELETE' then
    v_operation   := 'DELETE';
    v_old_data    := to_jsonb(old);
    v_new_data    := null;
    v_record_uuid := old.uuid;
    v_pdca_id     := old.pdca_id;
  end if;

  -- Insert audit record (always succeeds — no FK constraints)
  insert into public.pdca_audit_log (
    table_name,
    record_uuid,
    pdca_id,
    operation,
    old_data,
    new_data,
    changed_fields,
    changed_by,
    session_id
  ) values (
    tg_relname,
    v_record_uuid,
    v_pdca_id,
    v_operation,
    v_old_data,
    v_new_data,
    v_changed_fields,
    current_setting('app.current_user', true),
    current_setting('app.import_session_id', true)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- ATTACH TRIGGERS
-- ─────────────────────────────────────────────

drop trigger if exists trg_audit_pdca_master on public.pdca_master;
create trigger trg_audit_pdca_master
  after insert or update or delete on public.pdca_master
  for each row execute function public.fn_audit_log_record();

drop trigger if exists trg_audit_pdca_actions on public.pdca_actions;
create trigger trg_audit_pdca_actions
  after insert or update or delete on public.pdca_actions
  for each row execute function public.fn_audit_log_record();

drop trigger if exists trg_audit_pdca_subactions on public.pdca_subactions;
create trigger trg_audit_pdca_subactions
  after insert or update or delete on public.pdca_subactions
  for each row execute function public.fn_audit_log_record();

-- ─────────────────────────────────────────────
-- RLS: AUDIT LOG IS READ-ONLY, APPEND-ONLY
-- Service role can insert (via trigger). No one can update or delete.
-- ─────────────────────────────────────────────

alter table public.pdca_audit_log enable row level security;

-- Service role: select + insert only (trigger fires as service role)
create policy audit_log_service_select
  on public.pdca_audit_log for select to service_role using (true);

create policy audit_log_service_insert
  on public.pdca_audit_log for insert to service_role with check (true);

-- Explicitly no UPDATE or DELETE policies = hard block at DB level

-- ─────────────────────────────────────────────
-- TRACEABILITY VIEW
-- Useful for ISO 9001 audit reports.
-- ─────────────────────────────────────────────

create or replace view public.v_pdca_traceability as
select
  al.changed_at,
  al.operation,
  al.table_name,
  al.pdca_id,
  al.record_uuid,
  al.changed_fields,
  al.changed_by,
  al.session_id,
  al.old_data -> 'status'     as old_status,
  al.new_data -> 'status'     as new_status,
  al.old_data -> 'row_hash'   as old_hash,
  al.new_data -> 'row_hash'   as new_hash
from public.pdca_audit_log al
order by al.changed_at desc;

comment on view public.v_pdca_traceability is
  'Flattened audit trail for ISO 9001 Tab 4 (Audit & Evidence) view.';

notify pgrst, 'reload schema';
