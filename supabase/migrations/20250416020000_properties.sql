-- Imóveis, mídia, QR e features.

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  account_id uuid not null references public.accounts (id) on delete cascade,
  broker_id uuid not null references public.brokers (id) on delete cascade,
  origin_plan_code text not null references public.plans (code),
  listing_status text not null default 'draft' check (listing_status in (
    'draft', 'published', 'printed', 'expired', 'removed', 'blocked'
  )),
  property_type text not null,
  property_subtype text not null,
  purpose text not null check (purpose in ('sale', 'rent')),
  title text,
  description text not null default '',
  city text not null,
  state text not null,
  neighborhood text,
  address_line text,
  postal_code text,
  bedrooms integer not null default 0,
  suites integer not null default 0,
  bathrooms integer not null default 0,
  parking_spaces integer not null default 0,
  area_m2 numeric(12, 2),
  price numeric(14, 2),
  condo_fee numeric(14, 2),
  iptu_amount numeric(14, 2),
  printed_at timestamptz,
  expires_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.property_features (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  feature_key text not null,
  feature_value text,
  created_at timestamptz not null default now()
);

create table if not exists public.property_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  bucket_id text not null default 'property-media',
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  width integer,
  height integer,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'failed', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.property_qrcodes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  qr_token text not null unique,
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create trigger trg_properties_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

create trigger trg_property_media_updated_at
before update on public.property_media
for each row execute function public.set_updated_at();

create or replace function public.generate_public_property_id()
returns text
language plpgsql
as $$
declare
  yr text := to_char(timezone('utc', now()), 'YYYY');
  suffix text;
  attempt int := 0;
  candidate text;
begin
  loop
    suffix := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    candidate := 'IMV-' || yr || '-' || suffix;
    exit when not exists (select 1 from public.properties p where p.public_id = candidate);
    attempt := attempt + 1;
    exit when attempt > 12;
  end loop;
  return candidate;
end;
$$;

create or replace function public.generate_qr_token()
returns text
language sql
as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

create or replace function public.get_active_plan_code(p_account_id uuid)
returns text
language sql
stable
as $$
  select case
    when s.status = 'pro_active' and s.plan_code = 'pro' then 'pro'
    else 'free'
  end
  from public.subscriptions s
  where s.account_id = p_account_id;
$$;

create or replace function public.properties_active_count(p_account_id uuid)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.properties p
  where p.account_id = p_account_id
    and p.listing_status in ('draft', 'published', 'printed');
$$;

create or replace function public.can_create_property(p_account_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  plan_code text;
  max_props integer;
  current_count integer;
begin
  plan_code := public.get_active_plan_code(p_account_id);
  select pl.max_active_properties into max_props
  from public.plans pl
  where pl.code = plan_code;

  current_count := public.properties_active_count(p_account_id);
  return current_count < max_props;
end;
$$;

create or replace function public.before_property_insert()
returns trigger
language plpgsql
as $$
declare
  plan_code text;
  bid uuid;
  aid uuid;
  max_props integer;
begin
  if auth.uid() is not null then
    select b.id, b.account_id into bid, aid
    from public.brokers b
    join public.profiles p on p.account_id = b.account_id
    where p.id = auth.uid();

    if bid is null then
      raise exception 'Corretor não encontrado para o usuário atual';
    end if;

    new.broker_id := bid;
    new.account_id := aid;
  else
    if new.account_id is null or new.broker_id is null then
      raise exception 'account_id e broker_id são obrigatórios para insert sem sessão';
    end if;
    select b.account_id into aid from public.brokers b where b.id = new.broker_id;
    if aid is null or aid <> new.account_id then
      raise exception 'broker_id e account_id inconsistentes';
    end if;
  end if;

  plan_code := public.get_active_plan_code(new.account_id);
  if not public.can_create_property(new.account_id) then
    select pl.max_active_properties into max_props from public.plans pl where pl.code = plan_code;
    raise exception 'Seu plano atual permite apenas % imóvel(is) ativo(s).', max_props;
  end if;

  new.origin_plan_code := plan_code;

  if new.public_id is null or new.public_id = '' then
    new.public_id := public.generate_public_property_id();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_properties_before_insert on public.properties;
create trigger trg_properties_before_insert
before insert on public.properties
for each row execute function public.before_property_insert();

create or replace function public.after_property_insert_qr()
returns trigger
language plpgsql
as $$
begin
  insert into public.property_qrcodes (property_id, qr_token)
  values (new.id, public.generate_qr_token());
  return new;
end;
$$;

drop trigger if exists trg_properties_after_insert_qr on public.properties;
create trigger trg_properties_after_insert_qr
after insert on public.properties
for each row execute function public.after_property_insert_qr();

create index if not exists idx_properties_account_id on public.properties (account_id);
create index if not exists idx_properties_broker_id on public.properties (broker_id);
create index if not exists idx_properties_listing_status on public.properties (listing_status);
create index if not exists idx_properties_origin_plan_code on public.properties (origin_plan_code);
create index if not exists idx_properties_city_state on public.properties (city, state);
create index if not exists idx_properties_type_subtype on public.properties (property_type, property_subtype);
create index if not exists idx_property_media_property_id on public.property_media (property_id);
create index if not exists idx_property_qrcodes_token on public.property_qrcodes (qr_token);
