-- QR lifecycle inteligente, rastreamento de leituras e enriquecimento contínuo de leads.

alter table public.property_qrcodes
  add column if not exists expired_at timestamptz,
  add column if not exists invalidation_reason text;

create table if not exists public.qr_access_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  qr_code_id uuid references public.property_qrcodes (id) on delete set null,
  qr_token text not null,
  lead_phone text,
  user_agent text,
  ip_hash text,
  source text not null default 'qr_scan',
  created_at timestamptz not null default now()
);

create index if not exists idx_qr_access_events_property_created
  on public.qr_access_events (property_id, created_at desc);
create index if not exists idx_qr_access_events_token_created
  on public.qr_access_events (qr_token, created_at desc);

alter table public.qr_access_events enable row level security;

-- Permite que o corretor veja leituras apenas dos próprios imóveis.
create policy "qr_access_events_select_own_property"
on public.qr_access_events
for select
to authenticated
using (
  exists (
    select 1
    from public.properties p
    where p.id = qr_access_events.property_id
      and p.account_id = public.current_account_id()
  )
);

alter table public.leads
  add column if not exists nome_completo text,
  add column if not exists primeiro_nome text,
  add column if not exists telefone text,
  add column if not exists observacoes text not null default '',
  add column if not exists interesses text[] not null default '{}'::text[],
  add column if not exists origem text not null default 'qr_code_anuncio',
  add column if not exists nome_validado boolean not null default false;

-- Backfill inicial para não deixar registros legados sem identificação mínima.
update public.leads
set
  telefone = coalesce(nullif(telefone, ''), client_phone),
  nome_completo = coalesce(nullif(nome_completo, ''), 'Cliente ' || right(regexp_replace(coalesce(client_phone, ''), '\\D', '', 'g'), 4)),
  primeiro_nome = coalesce(
    nullif(primeiro_nome, ''),
    split_part(coalesce(nullif(nome_completo, ''), 'Cliente'), ' ', 1)
  ),
  origem = coalesce(nullif(origem, ''), 'qr_code_anuncio')
where true;

update public.leads
set nome_completo = 'Cliente'
where nome_completo is null or btrim(nome_completo) = '';

update public.leads
set primeiro_nome = split_part(nome_completo, ' ', 1)
where primeiro_nome is null or btrim(primeiro_nome) = '';

update public.leads
set telefone = client_phone
where (telefone is null or btrim(telefone) = '')
  and client_phone is not null
  and btrim(client_phone) <> '';

update public.leads
set telefone = '000' || right(replace(id::text, '-', ''), 10)
where telefone is null or btrim(telefone) = '';

update public.leads
set client_phone = telefone
where client_phone is null or btrim(client_phone) = '';

alter table public.leads
  alter column nome_completo set not null,
  alter column primeiro_nome set not null,
  alter column telefone set not null,
  alter column observacoes set not null,
  alter column interesses set not null,
  alter column origem set not null,
  alter column nome_validado set not null;

-- Dedupe hard por (property_id, telefone) para impedir recriação de leads.
with ranked as (
  select
    id,
    row_number() over (
      partition by property_id, coalesce(nullif(telefone, ''), client_phone)
      order by created_at asc, id asc
    ) as rn
  from public.leads
)
delete from public.leads l
using ranked r
where l.id = r.id
  and r.rn > 1;

create unique index if not exists idx_leads_property_phone_unique
  on public.leads (property_id, telefone);

create index if not exists idx_leads_phone
  on public.leads (telefone);

create index if not exists idx_lead_interactions_lead_created
  on public.lead_interactions (lead_id, created_at desc);

create policy "leads_update_own_broker"
on public.leads
for update
to authenticated
using (
  broker_id in (
    select b.id from public.brokers b
    where b.account_id = public.current_account_id()
  )
)
with check (
  broker_id in (
    select b.id from public.brokers b
    where b.account_id = public.current_account_id()
  )
);

create or replace function public.extract_first_name(p_full_name text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text := btrim(coalesce(p_full_name, ''));
begin
  if cleaned = '' then
    return 'Cliente';
  end if;

  return split_part(cleaned, ' ', 1);
end;
$$;

create or replace function public.append_unique_text(base_arr text[], incoming_arr text[])
returns text[]
language plpgsql
immutable
as $$
declare
  result_arr text[] := coalesce(base_arr, '{}'::text[]);
  item text;
begin
  foreach item in array coalesce(incoming_arr, '{}'::text[])
  loop
    if item is null or btrim(item) = '' then
      continue;
    end if;

    if not (lower(item) = any (
      select lower(v) from unnest(result_arr) as v
    )) then
      result_arr := array_append(result_arr, btrim(item));
    end if;
  end loop;

  return result_arr;
end;
$$;

create or replace function public.infer_lead_interests(p_text text, p_existing text[] default '{}'::text[])
returns text[]
language plpgsql
immutable
as $$
declare
  t text := lower(coalesce(p_text, ''));
  inferred text[] := coalesce(p_existing, '{}'::text[]);
begin
  if t like '%compr%' or t like '%quero comprar%' then
    inferred := public.append_unique_text(inferred, array['compra']);
  end if;

  if t like '%vender%' or t like '%anunciar%' or t like '%colocar meu imovel%' then
    inferred := public.append_unique_text(inferred, array['venda']);
  end if;

  if t like '%similar%' or t like '%parecid%' or t like '%outros imoveis%' then
    inferred := public.append_unique_text(inferred, array['imoveis_semelhantes']);
  end if;

  if t like '%visita%' or t like '%agendar%' then
    inferred := public.append_unique_text(inferred, array['visita']);
  end if;

  return inferred;
end;
$$;

create or replace function public.upsert_lead_from_qr_event(
  p_property_id uuid,
  p_broker_id uuid,
  p_client_phone text,
  p_nome_informado text default null,
  p_nome_perfil text default null,
  p_observacao text default null,
  p_origem text default 'qr_code_anuncio',
  p_interaction_type text default 'qr_interaction',
  p_intent text default 'visit_interest',
  p_force_name_update boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(p_client_phone, ''), '\\D', '', 'g');
  v_existing public.leads%rowtype;
  v_lead_id uuid;
  v_nome_informado text := nullif(btrim(coalesce(p_nome_informado, '')), '');
  v_nome_perfil text := nullif(btrim(coalesce(p_nome_perfil, '')), '');
  v_nome_full text;
  v_nome_validado boolean;
  v_obs text;
  v_interesses text[];
begin
  if p_property_id is null or p_broker_id is null then
    raise exception 'property_id e broker_id são obrigatórios';
  end if;

  if v_phone = '' then
    raise exception 'telefone inválido';
  end if;

  select *
  into v_existing
  from public.leads l
  where l.property_id = p_property_id
    and coalesce(nullif(l.telefone, ''), l.client_phone) = v_phone
  order by l.created_at asc
  limit 1;

  if not found then
    v_nome_full := coalesce(v_nome_informado, v_nome_perfil, 'Cliente ' || right(v_phone, 4));
    v_nome_validado := v_nome_informado is not null;
    v_interesses := public.infer_lead_interests(coalesce(p_observacao, '') || ' ' || coalesce(p_intent, ''));

    insert into public.leads (
      property_id,
      broker_id,
      client_phone,
      telefone,
      source,
      intent,
      status,
      nome_completo,
      primeiro_nome,
      observacoes,
      interesses,
      origem,
      nome_validado
    )
    values (
      p_property_id,
      p_broker_id,
      v_phone,
      v_phone,
      'qr_whatsapp',
      coalesce(nullif(p_intent, ''), 'visit_interest'),
      'new',
      v_nome_full,
      public.extract_first_name(v_nome_full),
      coalesce(p_observacao, ''),
      coalesce(v_interesses, '{}'::text[]),
      coalesce(nullif(p_origem, ''), 'qr_code_anuncio'),
      v_nome_validado
    )
    returning id into v_lead_id;
  else
    v_lead_id := v_existing.id;
    v_nome_full := coalesce(nullif(v_existing.nome_completo, ''), nullif(v_existing.primeiro_nome, ''), 'Cliente');
    v_nome_validado := coalesce(v_existing.nome_validado, false);

    if p_force_name_update and v_nome_informado is not null then
      v_nome_full := v_nome_informado;
      v_nome_validado := true;
    elsif (v_existing.nome_completo is null or btrim(v_existing.nome_completo) = '')
      and coalesce(v_nome_informado, v_nome_perfil) is not null then
      v_nome_full := coalesce(v_nome_informado, v_nome_perfil);
      v_nome_validado := v_nome_informado is not null;
    elsif v_nome_informado is not null and (v_existing.nome_completo is null or btrim(v_existing.nome_completo) = '') then
      v_nome_full := v_nome_informado;
      v_nome_validado := true;
    end if;

    v_obs := coalesce(v_existing.observacoes, '');
    if p_observacao is not null and btrim(p_observacao) <> '' then
      if v_obs <> '' then
        v_obs := v_obs || E'\\n';
      end if;
      v_obs := v_obs || to_char(timezone('utc', now()), 'YYYY-MM-DD HH24:MI') || ' - ' || btrim(p_observacao);
    end if;

    v_interesses := public.infer_lead_interests(
      coalesce(p_observacao, '') || ' ' || coalesce(p_intent, ''),
      coalesce(v_existing.interesses, '{}'::text[])
    );

    update public.leads
    set
      client_phone = v_phone,
      telefone = v_phone,
      nome_completo = v_nome_full,
      primeiro_nome = public.extract_first_name(v_nome_full),
      nome_validado = v_nome_validado,
      observacoes = v_obs,
      interesses = coalesce(v_interesses, '{}'::text[]),
      origem = coalesce(nullif(v_existing.origem, ''), coalesce(nullif(p_origem, ''), 'qr_code_anuncio')),
      intent = coalesce(nullif(p_intent, ''), v_existing.intent),
      updated_at = now()
    where id = v_lead_id;
  end if;

  insert into public.lead_interactions (lead_id, interaction_type, payload)
  values (
    v_lead_id,
    coalesce(nullif(p_interaction_type, ''), 'qr_interaction'),
    jsonb_build_object(
      'phone', v_phone,
      'name_informed', v_nome_informado,
      'name_profile', v_nome_perfil,
      'observation', p_observacao,
      'intent', p_intent,
      'force_name_update', p_force_name_update
    )
  );

  return v_lead_id;
end;
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
  v_lead_id uuid;
begin
  v_lead_id := public.upsert_lead_from_qr_event(
    p_property_id := p_property_id,
    p_broker_id := p_broker_id,
    p_client_phone := p_client_phone,
    p_nome_informado := null,
    p_nome_perfil := null,
    p_observacao := null,
    p_origem := 'qr_code_anuncio',
    p_interaction_type := 'visit_interest',
    p_intent := coalesce(nullif(p_intent, ''), 'visit_interest'),
    p_force_name_update := false
  );

  return v_lead_id;
end;
$$;

create or replace function public.register_qr_access(
  p_qr_token text,
  p_user_agent text default null,
  p_ip_hash text default null,
  p_lead_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qr record;
  v_total integer;
  v_phone text := nullif(regexp_replace(coalesce(p_lead_phone, ''), '\\D', '', 'g'), '');
  v_already_notified boolean := false;
begin
  select
    q.id,
    q.property_id,
    q.qr_token,
    q.is_active,
    p.public_id,
    p.account_id,
    p.broker_id,
    p.listing_status,
    p.expires_at,
    b.whatsapp_number as broker_phone
  into v_qr
  from public.property_qrcodes q
  join public.properties p on p.id = q.property_id
  left join public.brokers b on b.id = p.broker_id
  where q.qr_token = p_qr_token
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'state', 'not_found');
  end if;

  if not v_qr.is_active then
    return jsonb_build_object('ok', false, 'state', 'inactive');
  end if;

  if v_qr.listing_status in ('removed', 'blocked', 'expired') then
    return jsonb_build_object('ok', false, 'state', v_qr.listing_status);
  end if;

  if v_qr.expires_at is not null and v_qr.expires_at < now() then
    return jsonb_build_object('ok', false, 'state', 'expired');
  end if;

  insert into public.qr_access_events (
    property_id,
    qr_code_id,
    qr_token,
    lead_phone,
    user_agent,
    ip_hash,
    source
  )
  values (
    v_qr.property_id,
    v_qr.id,
    v_qr.qr_token,
    v_phone,
    p_user_agent,
    p_ip_hash,
    'qr_scan'
  );

  select count(*)::integer
  into v_total
  from public.qr_access_events e
  where e.qr_token = v_qr.qr_token;

  if v_total > 0 and mod(v_total, 10) = 0 and v_qr.broker_phone is not null then
    select exists (
      select 1
      from public.whatsapp_messages w
      where w.direction = 'outbound'
        and w.provider = 'uazapi'
        and w.property_id = v_qr.property_id
        and w.broker_phone = v_qr.broker_phone
        and w.payload ->> 'kind' = 'qr_views_milestone'
        and w.payload ->> 'qr_token' = v_qr.qr_token
        and w.payload ->> 'milestone' = v_total::text
    )
    into v_already_notified;

    if not v_already_notified then
      insert into public.whatsapp_messages (
        direction,
        provider,
        account_id,
        property_id,
        lead_phone,
        broker_phone,
        message_type,
        status,
        payload
      )
      values (
        'outbound',
        'uazapi',
        v_qr.account_id,
        v_qr.property_id,
        null,
        v_qr.broker_phone,
        'text',
        'queued',
        jsonb_build_object(
          'kind', 'qr_views_milestone',
          'qr_token', v_qr.qr_token,
          'milestone', v_total,
          'text', v_total::text || ' pessoas visualizaram seu anúncio (' || coalesce(v_qr.public_id, 'sem_ref') || ').',
          'to_broker', true
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'state', 'active',
    'property_id', v_qr.property_id,
    'count', v_total
  );
end;
$$;

create or replace function public.before_property_lifecycle_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_version integer;
begin
  if new.listing_status in ('published', 'printed')
    and (
      new.expires_at is null
      or (
        tg_op = 'UPDATE'
        and old.listing_status not in ('published', 'printed')
        and new.expires_at <= now()
      )
    ) then
    new.expires_at := now() + interval '30 days';
  end if;

  -- Quando salvar um anúncio já expirado: reinicia ciclo + invalida QR antigo + gera novo QR.
  if tg_op = 'UPDATE'
    and old.listing_status = 'expired'
    and old.expires_at is not null
    and old.expires_at <= now() then

    update public.property_qrcodes
    set
      is_active = false,
      expired_at = now(),
      invalidation_reason = 'listing_cycle_restart'
    where property_id = old.id
      and is_active = true;

    select coalesce(max(version), 0) + 1
    into v_next_version
    from public.property_qrcodes
    where property_id = old.id;

    insert into public.property_qrcodes (
      property_id,
      qr_token,
      version,
      is_active,
      created_at
    )
    values (
      old.id,
      public.generate_qr_token(),
      v_next_version,
      true,
      now()
    );

    new.expires_at := now() + interval '30 days';

    if new.listing_status = 'expired' then
      new.listing_status := 'published';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_properties_lifecycle_cycle on public.properties;
create trigger trg_properties_lifecycle_cycle
before insert or update on public.properties
for each row execute function public.before_property_lifecycle_cycle();

create or replace function public.expire_free_properties()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  with expired as (
    update public.properties p
    set
      listing_status = 'expired',
      updated_at = now()
    where p.expires_at is not null
      and p.expires_at < now()
      and p.listing_status in ('published', 'printed')
    returning p.id, p.account_id, p.broker_id, p.public_id
  ),
  deactivate_qr as (
    update public.property_qrcodes q
    set
      is_active = false,
      expired_at = now(),
      invalidation_reason = 'listing_expired'
    from expired e
    where q.property_id = e.id
      and q.is_active = true
    returning q.property_id
  ),
  notify as (
    insert into public.whatsapp_messages (
      direction,
      provider,
      account_id,
      property_id,
      lead_phone,
      broker_phone,
      message_type,
      status,
      payload
    )
    select
      'outbound',
      'uazapi',
      e.account_id,
      e.id,
      null,
      b.whatsapp_number,
      'text',
      'queued',
      jsonb_build_object(
        'kind', 'qr_expired',
        'property_id', e.id,
        'public_id', e.public_id,
        'text', 'O anúncio ' || coalesce(e.public_id, 'sem referência') || ' expirou. Atualize e salve para reativar com novo QR Code.',
        'to_broker', true
      )
    from expired e
    join public.brokers b on b.id = e.broker_id
    where b.whatsapp_number is not null
    returning id
  )
  select count(*)::integer into affected
  from expired;

  return coalesce(affected, 0);
end;
$$;

grant execute on function public.upsert_lead_from_qr_event(uuid, uuid, text, text, text, text, text, text, text, boolean) to service_role;
grant execute on function public.register_qr_access(text, text, text, text) to service_role;
grant execute on function public.create_lead_from_visit_interest(uuid, uuid, text, text) to service_role;
