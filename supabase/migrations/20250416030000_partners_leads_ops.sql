-- Parceiros, impressão, leads, conversas, filas (tabelas), auditoria.

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive', 'blocked')),
  created_at timestamptz not null default now()
);

create table if not exists public.partner_users (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.print_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  partner_id uuid references public.partners (id),
  partner_user_profile_id uuid references public.profiles (id),
  event_type text not null default 'print_registered' check (event_type in ('print_registered', 'reprint_registered')),
  created_at timestamptz not null default now()
);

create index if not exists idx_print_events_property_id on public.print_events (property_id);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  broker_id uuid not null references public.brokers (id) on delete cascade,
  client_phone text not null,
  source text not null default 'qr_whatsapp' check (source in ('qr_whatsapp')),
  intent text not null check (intent in ('visit_interest', 'similar_property_interest')),
  status text not null default 'new' check (status in ('new', 'contacted', 'scheduled', 'closed', 'invalid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create index if not exists idx_leads_property_id on public.leads (property_id);
create index if not exists idx_leads_broker_id on public.leads (broker_id);

create table if not exists public.lead_interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  interaction_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  lead_phone text not null,
  origin_property_id uuid references public.properties (id) on delete set null,
  current_property_id uuid references public.properties (id) on delete set null,
  state text not null check (state in (
    'started',
    'property_sent',
    'awaiting_main_choice',
    'recommendations_sent',
    'awaiting_recommendation_choice',
    'visit_interest_registered',
    'closed',
    'error'
  )),
  last_menu text,
  last_recommended_properties jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_conversation_sessions_updated_at
before update on public.conversation_sessions
for each row execute function public.set_updated_at();

create index if not exists idx_conversation_sessions_phone on public.conversation_sessions (lead_phone);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('inbound', 'outbound')),
  provider text not null check (provider in ('uazapi', 'official_whatsapp')),
  account_id uuid references public.accounts (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,
  lead_phone text,
  broker_phone text,
  message_type text not null check (message_type in ('text', 'image', 'menu', 'system')),
  provider_message_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'delivered', 'failed', 'abandoned')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_whatsapp_messages_updated_at
before update on public.whatsapp_messages
for each row execute function public.set_updated_at();

create index if not exists idx_whatsapp_messages_status on public.whatsapp_messages (status);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_name text not null,
  external_event_id text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'pending' check (processing_status in ('pending', 'processed', 'failed', 'ignored')),
  unique (provider, external_event_id)
);

create index if not exists idx_webhook_events_provider_status on public.webhook_events (provider, processing_status);

create table if not exists public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  origin_property_id uuid not null references public.properties (id) on delete cascade,
  returned_property_ids jsonb not null,
  lead_phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid,
  actor_profile_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_account_id on public.profiles (account_id);
create index if not exists idx_brokers_account_id on public.brokers (account_id);
create index if not exists idx_subscriptions_account_id on public.subscriptions (account_id);

-- Impressão (FREE: primeira impressão inicia prazo; reimpressão não renova).

create or replace function public.register_print_event(
  p_property_id uuid,
  p_partner_id uuid,
  p_partner_user_profile_id uuid,
  p_event_type text default 'print_registered'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  prop record;
  v_printed_at timestamptz;
  v_expires_at timestamptz;
begin
  select * into prop from public.properties where id = p_property_id;
  if not found then
    raise exception 'Imóvel não encontrado';
  end if;

  insert into public.print_events (property_id, partner_id, partner_user_profile_id, event_type)
  values (p_property_id, p_partner_id, p_partner_user_profile_id, coalesce(p_event_type, 'print_registered'));

  if prop.origin_plan_code = 'free' and prop.printed_at is null then
    v_printed_at := now();
    v_expires_at := v_printed_at + interval '30 days';
    update public.properties
    set
      printed_at = v_printed_at,
      expires_at = v_expires_at,
      listing_status = case
        when listing_status = 'draft' then 'printed'
        else listing_status
      end,
      updated_at = now()
    where id = p_property_id;
  elsif prop.origin_plan_code = 'free' then
    v_printed_at := prop.printed_at;
    v_expires_at := prop.expires_at;
  else
    v_printed_at := prop.printed_at;
    v_expires_at := prop.expires_at;
  end if;

  return jsonb_build_object(
    'ok', true,
    'property_id', p_property_id,
    'printed_at', v_printed_at,
    'expires_at', v_expires_at
  );
end;
$$;

create or replace function public.expire_free_properties()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.properties p
  set listing_status = 'expired', updated_at = now()
  where p.origin_plan_code = 'free'
    and p.expires_at is not null
    and p.expires_at < now()
    and p.listing_status in ('published', 'printed');

  get diagnostics affected = row_count;
  return coalesce(affected, 0);
end;
$$;

-- Recomendação determinística (MVP): origem FREE → só candidatos PRO; origem PRO → acervo PRO do mesmo corretor.

create or replace function public.recommend_similar_properties(
  origin_property_id uuid,
  limit_count integer default 5
)
returns table (
  id uuid,
  score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with origin as (
    select p.*
    from public.properties p
    where p.id = origin_property_id
  ),
  candidates as (
    select p.*
    from public.properties p, origin o
    where p.id <> o.id
      and p.broker_id = o.broker_id
      and p.listing_status in ('published', 'printed')
      and (
        (o.origin_plan_code = 'free' and p.origin_plan_code = 'pro')
        or (o.origin_plan_code = 'pro' and p.origin_plan_code = 'pro')
      )
  )
  select ranked.id, ranked.score
  from (
    select
      c.id,
      (
        (case when c.property_type = o.property_type then 4 else 0 end) +
        (case when c.property_subtype = o.property_subtype then 3 else 0 end) +
        (case when c.purpose = o.purpose then 2 else 0 end) +
        (case when c.city = o.city then 2 else 0 end) +
        (case when coalesce(c.neighborhood, '') <> '' and c.neighborhood = o.neighborhood then 2 else 0 end) +
        (case
          when c.price is not null and o.price is not null and o.price > 0
          then greatest(0::numeric, 3::numeric - abs(c.price - o.price) / greatest(o.price, 1) * 3)
          else 0::numeric
        end) +
        (case
          when c.area_m2 is not null and o.area_m2 is not null and o.area_m2 > 0
          then greatest(0::numeric, 2::numeric - abs(c.area_m2 - o.area_m2) / greatest(o.area_m2, 1) * 2)
          else 0::numeric
        end) +
        (case when c.bedrooms = o.bedrooms then 1 else 0 end) +
        (case when c.parking_spaces = o.parking_spaces then 1 else 0 end)
      )::numeric as score,
      c.updated_at
    from candidates c
    cross join origin o
  ) ranked
  order by ranked.score desc, ranked.updated_at desc
  limit greatest(1, least(limit_count, 20));
$$;

create or replace function public.create_lead_from_visit_interest(
  p_property_id uuid,
  p_broker_id uuid,
  p_client_phone text,
  p_intent text default 'visit_interest'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing uuid;
  new_id uuid;
begin
  select l.id into existing
  from public.leads l
  where l.property_id = p_property_id
    and l.client_phone = p_client_phone
    and l.intent = p_intent
    and l.created_at > now() - interval '24 hours'
  limit 1;

  if existing is not null then
    return existing;
  end if;

  insert into public.leads (property_id, broker_id, client_phone, intent)
  values (p_property_id, p_broker_id, p_client_phone, p_intent)
  returning id into new_id;

  return new_id;
end;
$$;
