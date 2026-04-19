-- Camada comercial isolada (Fase 1): pacote, contrato e ordem de entrega.
-- Mudanca aditiva para nao impactar fluxos atuais.

create table if not exists public.commercial_packages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  package_type text not null check (package_type in ('active_90_120', 'monthly', 'sticker_addon')),
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'BRL' check (char_length(currency) = 3),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_commercial_contracts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  package_id uuid not null references public.commercial_packages (id),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'canceled', 'expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  renewal_mode text not null default 'manual' check (renewal_mode in ('manual', 'auto')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  contract_id uuid not null references public.account_commercial_contracts (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  delivery_model text not null check (delivery_model in ('A', 'B', 'C')),
  layout_mode text not null check (layout_mode in ('standard', 'client_custom')),
  status text not null default 'open' check (status in ('open', 'in_production', 'delivered', 'installed', 'canceled')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commercial_packages_active
  on public.commercial_packages (active, created_at desc);

create index if not exists idx_account_commercial_contracts_account
  on public.account_commercial_contracts (account_id, status, created_at desc);

create index if not exists idx_delivery_orders_account
  on public.delivery_orders (account_id, status, created_at desc);

create index if not exists idx_delivery_orders_contract
  on public.delivery_orders (contract_id, created_at desc);

drop trigger if exists trg_commercial_packages_updated_at on public.commercial_packages;
create trigger trg_commercial_packages_updated_at
before update on public.commercial_packages
for each row execute function public.set_updated_at();

drop trigger if exists trg_account_commercial_contracts_updated_at on public.account_commercial_contracts;
create trigger trg_account_commercial_contracts_updated_at
before update on public.account_commercial_contracts
for each row execute function public.set_updated_at();

drop trigger if exists trg_delivery_orders_updated_at on public.delivery_orders;
create trigger trg_delivery_orders_updated_at
before update on public.delivery_orders
for each row execute function public.set_updated_at();

alter table public.commercial_packages enable row level security;
alter table public.account_commercial_contracts enable row level security;
alter table public.delivery_orders enable row level security;

drop policy if exists "commercial_packages_select_authenticated" on public.commercial_packages;
create policy "commercial_packages_select_authenticated"
on public.commercial_packages
for select
to authenticated
using (true);

drop policy if exists "account_commercial_contracts_select_own" on public.account_commercial_contracts;
create policy "account_commercial_contracts_select_own"
on public.account_commercial_contracts
for select
to authenticated
using (account_id = public.current_account_id());

drop policy if exists "account_commercial_contracts_insert_own" on public.account_commercial_contracts;
create policy "account_commercial_contracts_insert_own"
on public.account_commercial_contracts
for insert
to authenticated
with check (account_id = public.current_account_id());

drop policy if exists "account_commercial_contracts_update_own" on public.account_commercial_contracts;
create policy "account_commercial_contracts_update_own"
on public.account_commercial_contracts
for update
to authenticated
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

drop policy if exists "delivery_orders_select_own" on public.delivery_orders;
create policy "delivery_orders_select_own"
on public.delivery_orders
for select
to authenticated
using (account_id = public.current_account_id());

drop policy if exists "delivery_orders_insert_own" on public.delivery_orders;
create policy "delivery_orders_insert_own"
on public.delivery_orders
for insert
to authenticated
with check (
  account_id = public.current_account_id()
  and exists (
    select 1
    from public.account_commercial_contracts c
    where c.id = contract_id
      and c.account_id = public.current_account_id()
  )
  and (
    property_id is null
    or exists (
      select 1
      from public.properties p
      where p.id = property_id
        and p.account_id = public.current_account_id()
    )
  )
);

drop policy if exists "delivery_orders_update_own" on public.delivery_orders;
create policy "delivery_orders_update_own"
on public.delivery_orders
for update
to authenticated
using (account_id = public.current_account_id())
with check (
  account_id = public.current_account_id()
  and exists (
    select 1
    from public.account_commercial_contracts c
    where c.id = contract_id
      and c.account_id = public.current_account_id()
  )
  and (
    property_id is null
    or exists (
      select 1
      from public.properties p
      where p.id = property_id
        and p.account_id = public.current_account_id()
    )
  )
);
