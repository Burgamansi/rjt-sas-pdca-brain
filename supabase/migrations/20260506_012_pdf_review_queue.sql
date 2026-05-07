-- ============================================================
-- PHASE 0 — Migration 012: PDF Review Queue
-- STATUS: PREPARED — NOT YET APPLIED TO PRODUCTION
-- Apply after migration 010.
--
-- PURPOSE:
--   When the PDF Knowledge Engine encounters a block that cannot be
--   deterministically matched to an existing subaction UUID, the block
--   is NEVER auto-inserted as a new task.
--   Instead, it is queued here for manual operator review.
--
-- PDF PARSER CONTRACT:
--   RULE 1: PDF NEVER creates tasks (no INSERT to pdca_subactions from PDF).
--   RULE 2: ID matching is deterministic (ACTION: XX.XX block header).
--   RULE 3: Unmatched blocks → INSERT to pdf_review_queue with status=PENDING.
--   RULE 4: Fuzzy matching is NOT used as primary logic.
--   RULE 5: Operator must APPROVE → trigger injection to pdca_subactions.
--
-- LIFECYCLE:
--   PDF upload → parse blocks → attempt ID match
--     MATCHED     → inject fields directly → AUTO_MATCHED status
--     NO_ID_FOUND → INSERT with attempted_id=null, status=PENDING
--     ID_NO_MATCH → INSERT with attempted_id=XX.XX, status=PENDING
--   Operator reviews → APPROVED → trigger fn_apply_pdf_injection()
--   Operator reviews → REJECTED → status=REJECTED, no injection
-- ============================================================

-- ─────────────────────────────────────────────
-- TABLE: pdf_review_queue
-- ─────────────────────────────────────────────

create table if not exists public.pdf_review_queue (
  id                      uuid        primary key default gen_random_uuid(),

  -- Source
  source_file             text        not null,
  import_session_id       text,
  block_index             integer     not null default 0,

  -- Raw extracted block text from PDF
  block_text              text        not null,

  -- The ID the parser found in the block (ACTION: XX.XX), if any
  attempted_id            text,

  -- Current review state
  status                  text        not null default 'PENDING'
                          check (status in ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_MATCHED')),

  -- Set by operator on APPROVAL: which subaction to inject into
  matched_subaction_uuid  uuid
    references public.pdca_subactions (uuid) on delete set null,

  -- Fields to inject (operator selects which fields from block_text to use)
  inject_como_fazer       text,
  inject_observacao       text,
  inject_insumos          text,
  inject_evidencia_sgq    text,

  -- Operator review metadata
  reviewed_by             text,
  reviewed_at             timestamptz,
  review_notes            text,

  -- Timestamps
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.pdf_review_queue is
  'PDF blocks that could not be auto-matched. Require manual operator approval before injection.';
comment on column public.pdf_review_queue.attempted_id is
  'The ACTION: ID found in the PDF block header (e.g., "01.01"). Null if no ID header found.';
comment on column public.pdf_review_queue.matched_subaction_uuid is
  'Set by operator on approval. References the subaction that will receive injected fields.';
comment on column public.pdf_review_queue.inject_como_fazer is
  'Operator-curated como_fazer text to inject. May differ from raw block_text.';

-- Indexes
create index if not exists idx_pdf_queue_status
  on public.pdf_review_queue (status, created_at desc);

create index if not exists idx_pdf_queue_session
  on public.pdf_review_queue (import_session_id);

create index if not exists idx_pdf_queue_subaction
  on public.pdf_review_queue (matched_subaction_uuid)
  where matched_subaction_uuid is not null;

-- Auto-update timestamp
drop trigger if exists trg_pdf_queue_updated_at on public.pdf_review_queue;
create trigger trg_pdf_queue_updated_at
  before update on public.pdf_review_queue
  for each row execute function public.fn_set_updated_at();

-- ─────────────────────────────────────────────
-- FUNCTION: fn_apply_pdf_injection
-- Called when operator approves a review queue entry.
-- Injects PDF knowledge fields into the matched subaction.
-- Only overwrites fields that have a non-null inject value.
-- ─────────────────────────────────────────────

create or replace function public.fn_apply_pdf_injection(p_queue_id uuid, p_reviewed_by text)
returns void
language plpgsql
security definer
as $$
declare
  v_queue public.pdf_review_queue%rowtype;
begin
  -- Fetch the queue entry
  select * into v_queue
  from public.pdf_review_queue
  where id = p_queue_id and status = 'PENDING';

  if not found then
    raise exception 'Queue entry % not found or not in PENDING status', p_queue_id;
  end if;

  if v_queue.matched_subaction_uuid is null then
    raise exception 'matched_subaction_uuid must be set before approval of queue entry %', p_queue_id;
  end if;

  -- Inject fields into subaction (only non-null inject values)
  update public.pdca_subactions
  set
    como_fazer        = coalesce(v_queue.inject_como_fazer,   como_fazer),
    observacao        = coalesce(v_queue.inject_observacao,   observacao),
    insumos           = coalesce(v_queue.inject_insumos,      insumos),
    evidencia_sgq     = coalesce(v_queue.inject_evidencia_sgq, evidencia_sgq),
    pdf_match_status  = 'MATCHED'
  where uuid = v_queue.matched_subaction_uuid;

  -- Mark queue entry as approved
  update public.pdf_review_queue
  set
    status          = 'APPROVED',
    reviewed_by     = p_reviewed_by,
    reviewed_at     = now()
  where id = p_queue_id;
end;
$$;

comment on function public.fn_apply_pdf_injection is
  'Apply approved PDF knowledge injection to a subaction. Called by Tab 2 operator action.';

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────

alter table public.pdf_review_queue enable row level security;

create policy pdf_queue_service_all
  on public.pdf_review_queue for all to service_role using (true) with check (true);

-- ─────────────────────────────────────────────
-- VIEW: pending review items with subaction context
-- ─────────────────────────────────────────────

create or replace view public.v_pdf_review_pending as
select
  q.id,
  q.source_file,
  q.attempted_id,
  q.block_text,
  q.block_index,
  q.created_at,
  q.import_session_id,
  -- Possible match candidates (subactions whose subaction_id ~ attempted_id)
  s.uuid          as candidate_subaction_uuid,
  s.pdca_id       as candidate_pdca_id,
  s.subaction_id  as candidate_subaction_id,
  s.nome          as candidate_nome,
  s.phase         as candidate_phase
from public.pdf_review_queue q
left join public.pdca_subactions s
  on s.subaction_id like '%' || coalesce(q.attempted_id, '') || '%'
  and q.attempted_id is not null
where q.status = 'PENDING'
order by q.created_at asc;

comment on view public.v_pdf_review_pending is
  'Tab 2: shows pending PDF blocks with auto-suggested subaction matches for operator review.';

notify pgrst, 'reload schema';
