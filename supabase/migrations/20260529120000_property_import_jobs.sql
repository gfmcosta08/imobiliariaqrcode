-- Jobs de importação de anúncios (homologação / staging — ver PRD SM-2026-05-29-02)

create table if not exists public.property_import_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  broker_id uuid not null references public.brokers (id) on delete cascade,
  origin_plan_code text not null default 'free',
  created_by uuid references auth.users (id) on delete set null,
  source_url text not null,
  mode text not null check (mode in ('single', 'listing', 'homepage')),
  status text not null default 'pending' check (
    status in ('pending', 'running', 'completed', 'failed')
  ),
  total_count int not null default 0,
  processed_count int not null default 0,
  results jsonb not null default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists property_import_jobs_account_id_idx
  on public.property_import_jobs (account_id, created_at desc);
alter table public.property_import_jobs enable row level security;
create policy "property_import_jobs_select_own"
  on public.property_import_jobs
  for select
  to authenticated
  using (account_id = public.current_account_id());
create policy "property_import_jobs_insert_own"
  on public.property_import_jobs
  for insert
  to authenticated
  with check (account_id = public.current_account_id());
