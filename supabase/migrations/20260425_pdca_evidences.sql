-- Tabela de evidências
create table if not exists public.pdca_evidences (
  id uuid primary key default gen_random_uuid(),
  company_id text not null default 'UBG',
  pdca_id text not null,
  sub_action_id text not null,
  file_name text not null,
  file_type text not null,
  file_url text,
  file_size integer,
  uploaded_by text,
  created_at timestamptz default now()
);

-- Relacionamento com sub_actions (não é FK real para避免 problemas de chave)
alter table public.pdca_evidences enable row level security;

-- Policies
create policy pdca_evidences_select on public.pdca_evidences for select to anon using (true);
create policy pdca_evidences_insert on public.pdca_evidences for insert to anon with check (true);

-- Index para busca rápida por sub_action
create index pdca_evidences_sub_action_idx on public.pdca_evidences (sub_action_id);
create index pdca_evidences_pdca_idx on public.pdca_evidences (pdca_id);

-- Refresh schema
NOTIFY pgrst, 'reload schema';