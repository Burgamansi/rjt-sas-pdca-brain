create table if not exists public.pdca_brain (
  pdca_id text primary key,
  titulo text not null,
  area text not null default 'A definir',
  status text not null default 'Em Planejamento',
  gut_total integer not null default 0,
  fonte_arquivo text,
  atualizado_em timestamptz not null default now(),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pdca_brain_status_idx on public.pdca_brain (status);
create index if not exists pdca_brain_updated_idx on public.pdca_brain (atualizado_em desc);

create or replace function public.set_updated_at_pdca_brain()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_pdca_brain on public.pdca_brain;
create trigger trg_set_updated_at_pdca_brain
before update on public.pdca_brain
for each row execute function public.set_updated_at_pdca_brain();
