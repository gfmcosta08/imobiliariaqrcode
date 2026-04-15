-- Domínio base: planos, contas, perfis, corretores, assinaturas + bootstrap de novo usuário.

create table if not exists public.plans (
  code text primary key,
  name text not null,
  max_active_properties integer not null,
  max_images_per_property integer not null,
  has_auto_expiration boolean not null,
  expiration_days integer,
  recommendation_source text not null check (recommendation_source in ('self', 'pro_only')),
  created_at timestamptz not null default now()
);

insert into public.plans (
  code, name, max_active_properties, max_images_per_property,
  has_auto_expiration, expiration_days, recommendation_source
)
values
  ('free', 'FREE', 1, 10, true, 30, 'pro_only'),
  ('pro', 'PRO', 999999, 15, false, null, 'self')
on conflict (code) do nothing;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  whatsapp_number text not null unique,
  role text not null default 'broker' check (role in ('broker', 'partner', 'admin', 'support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brokers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts (id) on delete cascade,
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  display_name text not null,
  whatsapp_number text not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  plan_code text not null references public.plans (code),
  status text not null check (status in (
    'free', 'pro_pending_activation', 'pro_active', 'past_due', 'canceled', 'expired'
  )),
  billing_provider text check (billing_provider in ('stripe', 'mercado_pago')),
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_accounts_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger trg_brokers_updated_at
before update on public.brokers
for each row execute function public.set_updated_at();

create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_account_id uuid;
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full_name text := nullif(trim(meta ->> 'full_name'), '');
  v_whatsapp text := nullif(trim(meta ->> 'whatsapp_number'), '');
begin
  if v_full_name is null then
    v_full_name := split_part(coalesce(new.email, 'usuario'), '@', 1);
  end if;
  if v_whatsapp is null then
    v_whatsapp := 'pending-' || replace(new.id::text, '-', '');
  end if;

  insert into public.accounts default values
  returning id into new_account_id;

  insert into public.profiles (id, account_id, email, full_name, whatsapp_number, role)
  values (new.id, new_account_id, new.email, v_full_name, v_whatsapp, 'broker');

  insert into public.brokers (account_id, profile_id, display_name, whatsapp_number)
  values (new_account_id, new.id, v_full_name, v_whatsapp);

  insert into public.subscriptions (account_id, plan_code, status)
  values (new_account_id, 'free', 'free');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
