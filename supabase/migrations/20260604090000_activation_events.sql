create table if not exists public.activation_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activation_events_account_created
  on public.activation_events (account_id, created_at desc);

create index if not exists idx_activation_events_name_created
  on public.activation_events (event_name, created_at desc);

alter table public.activation_events enable row level security;

create policy activation_events_service_role_all
  on public.activation_events
  for all
  to service_role
  using (true)
  with check (true);

create policy activation_events_select_own_account
  on public.activation_events
  for select
  to authenticated
  using (
    account_id in (
      select p.account_id from public.profiles p where p.id = auth.uid()
    )
  );
