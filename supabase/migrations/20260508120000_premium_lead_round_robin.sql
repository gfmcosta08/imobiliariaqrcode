-- Plano Premium: roteamento round-robin de captadores por conta.
-- Mantem `origin_property_id` como imovel de origem e fixa o captador sorteado na sessao.

create table if not exists public.lead_routing_recipients (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  display_name text not null,
  whatsapp_number text not null,
  position integer not null check (position between 1 and 5),
  is_primary boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, position)
);
create trigger trg_lead_routing_recipients_updated_at
before update on public.lead_routing_recipients
for each row execute function public.set_updated_at();
create unique index if not exists idx_lead_routing_recipients_active_phone
  on public.lead_routing_recipients (account_id, regexp_replace(whatsapp_number, '\D', '', 'g'))
  where status = 'active';
create table if not exists public.lead_routing_state (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  next_index bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.lead_routing_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,
  qr_code_id uuid references public.property_qrcodes (id) on delete set null,
  origin_broker_id uuid references public.brokers (id) on delete set null,
  routed_recipient_id uuid references public.lead_routing_recipients (id) on delete set null,
  routed_display_name text,
  routed_whatsapp_number text,
  rr_index_before bigint,
  rr_index_after bigint,
  status text not null default 'assigned' check (status in ('assigned', 'fallback', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);
alter table public.conversation_sessions
  add column if not exists assigned_routing_recipient_id uuid references public.lead_routing_recipients (id) on delete set null,
  add column if not exists assigned_broker_name text,
  add column if not exists assigned_broker_phone text;
create index if not exists idx_conversation_sessions_assigned_recipient
  on public.conversation_sessions (assigned_routing_recipient_id);
alter table public.lead_routing_recipients enable row level security;
alter table public.lead_routing_state enable row level security;
alter table public.lead_routing_logs enable row level security;
drop policy if exists "lead_routing_recipients_select_own_account" on public.lead_routing_recipients;
create policy "lead_routing_recipients_select_own_account"
on public.lead_routing_recipients
for select
to authenticated
using (account_id = public.current_account_id());
drop policy if exists "lead_routing_recipients_manage_own_account" on public.lead_routing_recipients;
create policy "lead_routing_recipients_manage_own_account"
on public.lead_routing_recipients
for all
to authenticated
using (account_id = public.current_account_id())
with check (
  account_id = public.current_account_id()
  and public.get_active_plan_code(account_id) = 'premium'
  and (
    select count(*)::integer
    from public.lead_routing_recipients r
    where r.account_id = lead_routing_recipients.account_id
      and r.status = 'active'
      and r.id <> coalesce(lead_routing_recipients.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) < greatest(0, coalesce((select max_brokers from public.plans where code = 'premium'), 5) - 1)
);
drop policy if exists "lead_routing_logs_select_own_account" on public.lead_routing_logs;
create policy "lead_routing_logs_select_own_account"
on public.lead_routing_logs
for select
to authenticated
using (account_id = public.current_account_id());
create or replace function public.assign_premium_lead_recipient(
  p_account_id uuid,
  p_origin_broker_id uuid,
  p_property_id uuid default null,
  p_lead_id uuid default null,
  p_qr_code_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_code text;
  v_primary record;
  v_recipients jsonb;
  v_count integer;
  v_state public.lead_routing_state%rowtype;
  v_index bigint;
  v_next bigint;
  v_selected jsonb;
  v_status text := 'assigned';
begin
  if p_account_id is null or p_origin_broker_id is null then
    return jsonb_build_object('ok', false, 'status', 'failed', 'error', 'missing_account_or_broker');
  end if;

  select b.id, b.display_name, b.whatsapp_number
  into v_primary
  from public.brokers b
  where b.id = p_origin_broker_id
    and b.account_id = p_account_id
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'status', 'failed', 'error', 'origin_broker_not_found');
  end if;

  v_plan_code := public.get_active_plan_code(p_account_id);

  if v_plan_code is distinct from 'premium' then
    v_status := 'fallback';
    insert into public.lead_routing_logs (
      account_id, lead_id, property_id, qr_code_id, origin_broker_id,
      routed_display_name, routed_whatsapp_number, status
    )
    values (
      p_account_id, p_lead_id, p_property_id, p_qr_code_id, p_origin_broker_id,
      v_primary.display_name, v_primary.whatsapp_number, v_status
    );

    return jsonb_build_object(
      'ok', true,
      'status', v_status,
      'recipient_id', null,
      'display_name', v_primary.display_name,
      'whatsapp_number', v_primary.whatsapp_number,
      'rr_index_before', null,
      'rr_index_after', null
    );
  end if;

  with candidates as (
    select
      null::uuid as recipient_id,
      coalesce(v_primary.display_name, 'Corretor') as display_name,
      v_primary.whatsapp_number as whatsapp_number,
      1 as position
    where nullif(regexp_replace(coalesce(v_primary.whatsapp_number, ''), '\D', '', 'g'), '') is not null
    union all
    select
      r.id,
      r.display_name,
      r.whatsapp_number,
      r.position
    from public.lead_routing_recipients r
    where r.account_id = p_account_id
      and r.status = 'active'
      and nullif(regexp_replace(coalesce(r.whatsapp_number, ''), '\D', '', 'g'), '') is not null
  ),
  deduped as (
    select distinct on (regexp_replace(whatsapp_number, '\D', '', 'g'))
      recipient_id,
      display_name,
      whatsapp_number,
      position
    from candidates
    order by regexp_replace(whatsapp_number, '\D', '', 'g'), position asc
  ),
  ordered as (
    select
      row_number() over (order by position asc, display_name asc) - 1 as slot,
      recipient_id,
      display_name,
      whatsapp_number
    from deduped
    order by position asc, display_name asc
    limit 5
  )
  select coalesce(jsonb_agg(to_jsonb(ordered) order by slot), '[]'::jsonb), count(*)::integer
  into v_recipients, v_count
  from ordered;

  if coalesce(v_count, 0) = 0 then
    return jsonb_build_object('ok', false, 'status', 'failed', 'error', 'no_active_recipient');
  end if;

  insert into public.lead_routing_state (account_id, next_index)
  values (p_account_id, 0)
  on conflict (account_id) do nothing;

  select *
  into v_state
  from public.lead_routing_state
  where account_id = p_account_id
  for update;

  v_index := coalesce(v_state.next_index, 0);
  v_selected := v_recipients -> (v_index % v_count);
  v_next := v_index + 1;

  update public.lead_routing_state
  set next_index = v_next,
      updated_at = now()
  where account_id = p_account_id;

  insert into public.lead_routing_logs (
    account_id, lead_id, property_id, qr_code_id, origin_broker_id,
    routed_recipient_id, routed_display_name, routed_whatsapp_number,
    rr_index_before, rr_index_after, status
  )
  values (
    p_account_id, p_lead_id, p_property_id, p_qr_code_id, p_origin_broker_id,
    nullif(v_selected ->> 'recipient_id', '')::uuid,
    v_selected ->> 'display_name',
    v_selected ->> 'whatsapp_number',
    v_index,
    v_next,
    v_status
  );

  return jsonb_build_object(
    'ok', true,
    'status', v_status,
    'recipient_id', nullif(v_selected ->> 'recipient_id', ''),
    'display_name', v_selected ->> 'display_name',
    'whatsapp_number', v_selected ->> 'whatsapp_number',
    'rr_index_before', v_index,
    'rr_index_after', v_next
  );
exception
  when others then
    insert into public.lead_routing_logs (
      account_id, lead_id, property_id, qr_code_id, origin_broker_id,
      routed_display_name, routed_whatsapp_number, status, error_message
    )
    values (
      p_account_id, p_lead_id, p_property_id, p_qr_code_id, p_origin_broker_id,
      v_primary.display_name, v_primary.whatsapp_number, 'failed', sqlerrm
    );

    return jsonb_build_object(
      'ok', true,
      'status', 'fallback',
      'recipient_id', null,
      'display_name', v_primary.display_name,
      'whatsapp_number', v_primary.whatsapp_number,
      'error', sqlerrm
    );
end;
$$;
grant execute on function public.assign_premium_lead_recipient(uuid, uuid, uuid, uuid, uuid) to service_role;
create or replace function public.enqueue_lead_broker_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
  p record;
  s record;
  assignment jsonb;
  target_name text;
  target_phone text;
  msg_text text;
begin
  select * into b from public.brokers where id = new.broker_id;
  if not found then
    return new;
  end if;

  select * into p from public.properties where id = new.property_id;

  select
    cs.assigned_broker_name,
    cs.assigned_broker_phone,
    cs.assigned_routing_recipient_id
  into s
  from public.conversation_sessions cs
  where cs.lead_phone = new.client_phone
    and cs.origin_property_id = new.property_id
    and cs.state <> 'closed'
  order by cs.updated_at desc
  limit 1;

  target_name := coalesce(nullif(s.assigned_broker_name, ''), b.display_name, 'Corretor');
  target_phone := nullif(s.assigned_broker_phone, '');

  if target_phone is null then
    assignment := public.assign_premium_lead_recipient(
      b.account_id,
      b.id,
      new.property_id,
      new.id,
      null
    );
    target_name := coalesce(nullif(assignment ->> 'display_name', ''), target_name);
    target_phone := nullif(assignment ->> 'whatsapp_number', '');
  end if;

  target_phone := coalesce(target_phone, b.whatsapp_number);

  if target_phone is null then
    return new;
  end if;

  msg_text := 'Novo lead recebido.' || chr(10) || chr(10) ||
              'Cliente: ' || new.client_phone || chr(10);

  if p.public_id is not null then
    msg_text := msg_text || 'Imovel: ' || p.public_id || chr(10);
  end if;

  if new.intent = 'visit_interest' then
    msg_text := msg_text || 'Acao: Quer agendar uma visita.' || chr(10);
  else
    msg_text := msg_text || 'Acao: Visualizou detalhes do imovel.' || chr(10);
  end if;

  msg_text := msg_text || chr(10) || 'Atenda-o agora para nao perder a venda.';

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
    b.account_id,
    new.property_id,
    new.client_phone,
    target_phone,
    'text',
    'queued',
    jsonb_build_object(
      'kind', 'lead_created',
      'lead_id', new.id,
      'intent', new.intent,
      'assigned_routing_recipient_id', s.assigned_routing_recipient_id,
      'assigned_broker_name', target_name,
      'text', msg_text,
      'to_broker', true
    )
  );

  return new;
end;
$$;
