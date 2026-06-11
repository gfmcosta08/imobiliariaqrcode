-- ============================================================
-- Migration: unificacao do monitoramento anti-silencio do bot
-- Data: 2026-05-02
-- Objetivo: manter bot_interactions como tabela unica de monitoramento
-- ============================================================

alter table public.bot_interactions
  add column if not exists steps_history jsonb not null default '[]'::jsonb,
  add column if not exists incident_status text check (
    incident_status is null or incident_status in ('open', 'auto_recovered', 'resolved', 'ignored')
  ),
  add column if not exists incident_type text,
  add column if not exists incident_severity text check (
    incident_severity is null or incident_severity in ('info', 'warning', 'critical')
  ),
  add column if not exists incident_details jsonb not null default '{}'::jsonb,
  add column if not exists incident_detected_at timestamptz,
  add column if not exists incident_resolved_at timestamptz,
  add column if not exists incident_source_message_id uuid references public.whatsapp_messages(id) on delete set null,
  add column if not exists incident_source_webhook_event_id uuid references public.webhook_events(id) on delete set null,
  add column if not exists incident_property_id uuid references public.properties(id) on delete set null,
  add column if not exists incident_broker_id uuid references public.brokers(id) on delete set null,
  add column if not exists admin_notified_at timestamptz,
  add column if not exists broker_notified_at timestamptz,
  add column if not exists auto_recovery_attempted_at timestamptz,
  add column if not exists auto_recovery_result jsonb,
  add column if not exists last_failed_step text;
create index if not exists idx_bot_interactions_incident_open
  on public.bot_interactions (incident_detected_at desc)
  where incident_status = 'open';
create index if not exists idx_bot_interactions_incident_type
  on public.bot_interactions (incident_type, incident_status, updated_at desc);
create index if not exists idx_bot_interactions_source_message
  on public.bot_interactions (incident_source_message_id)
  where incident_source_message_id is not null;
do $$
begin
  if to_regclass('public.bot_interaction_steps') is not null then
    update public.bot_interactions bi
    set steps_history = s.steps,
        updated_at = now()
    from (
      select
        interaction_id,
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'step_name', step_name,
            'status', status,
            'started_at', started_at,
            'completed_at', completed_at,
            'error_detail', error_detail
          )
          order by started_at asc
        ) as steps
      from public.bot_interaction_steps
      group by interaction_id
    ) s
    where bi.id = s.interaction_id
      and jsonb_array_length(coalesce(bi.steps_history, '[]'::jsonb)) = 0;
  end if;

  if to_regclass('public.bot_incidents') is not null then
    update public.bot_interactions bi
    set incident_source_message_id = inc.source_message_id,
        incident_source_webhook_event_id = inc.source_webhook_event_id,
        incident_property_id = inc.property_id,
        incident_broker_id = inc.broker_id,
        incident_type = inc.incident_type,
        incident_severity = inc.severity,
        incident_status = inc.status,
        incident_detected_at = inc.detected_at,
        incident_resolved_at = inc.resolved_at,
        incident_details = coalesce(inc.details, '{}'::jsonb) || jsonb_build_object(
          'source_step_id', inc.source_step_id,
          'migrated_from', 'bot_incidents'
        ),
        admin_notified_at = inc.admin_notified_at,
        broker_notified_at = inc.broker_notified_at,
        auto_recovery_attempted_at = inc.auto_recovery_attempted_at,
        auto_recovery_result = inc.auto_recovery_result,
        updated_at = now()
    from (
      select distinct on (interaction_id) *
      from public.bot_incidents
      where interaction_id is not null
      order by interaction_id, case when status = 'open' then 0 else 1 end, detected_at desc
    ) inc
    where bi.id = inc.interaction_id;

    update public.bot_interactions bi
    set incident_source_message_id = inc.source_message_id,
        incident_source_webhook_event_id = inc.source_webhook_event_id,
        incident_property_id = inc.property_id,
        incident_broker_id = inc.broker_id,
        incident_type = inc.incident_type,
        incident_severity = inc.severity,
        incident_status = inc.status,
        incident_detected_at = inc.detected_at,
        incident_resolved_at = inc.resolved_at,
        incident_details = coalesce(inc.details, '{}'::jsonb) || jsonb_build_object(
          'source_step_id', inc.source_step_id,
          'migrated_from', 'bot_incidents'
        ),
        admin_notified_at = inc.admin_notified_at,
        broker_notified_at = inc.broker_notified_at,
        auto_recovery_attempted_at = inc.auto_recovery_attempted_at,
        auto_recovery_result = inc.auto_recovery_result,
        updated_at = now()
    from (
      select distinct on (lead_phone) *
      from public.bot_incidents
      where interaction_id is null
        and lead_phone is not null
      order by lead_phone, case when status = 'open' then 0 else 1 end, detected_at desc
    ) inc
    where bi.id = (
      select latest.id
      from public.bot_interactions latest
      where latest.lead_phone = inc.lead_phone
      order by latest.created_at desc
      limit 1
    );

    insert into public.bot_interactions (
      lead_phone,
      inbound_text,
      current_step,
      is_resolved,
      incident_source_message_id,
      incident_source_webhook_event_id,
      incident_property_id,
      incident_broker_id,
      incident_type,
      incident_severity,
      incident_status,
      incident_detected_at,
      incident_resolved_at,
      incident_details,
      admin_notified_at,
      broker_notified_at,
      auto_recovery_attempted_at,
      auto_recovery_result
    )
    select
      'system',
      incident_type,
      'incident_' || incident_type,
      false,
      source_message_id,
      source_webhook_event_id,
      property_id,
      broker_id,
      incident_type,
      severity,
      status,
      detected_at,
      resolved_at,
      coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'source_step_id', source_step_id,
        'migrated_from', 'bot_incidents'
      ),
      admin_notified_at,
      broker_notified_at,
      auto_recovery_attempted_at,
      auto_recovery_result
    from public.bot_incidents inc
    where interaction_id is null
      and lead_phone is null
      and not exists (
        select 1
        from public.bot_interactions bi
        where bi.lead_phone = 'system'
          and bi.incident_type = inc.incident_type
          and bi.incident_detected_at = inc.detected_at
      );
  end if;
end $$;
create or replace function public.fn_start_interaction_step(
  p_interaction_id uuid,
  p_step           text
) returns uuid language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
  v_started_at text := now()::text;
begin
  update public.bot_interactions
  set steps_history = coalesce(steps_history, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'id', v_id,
          'step_name', p_step,
          'status', 'pending',
          'started_at', v_started_at,
          'completed_at', null,
          'error_detail', null
        )
      ),
      current_step = p_step,
      updated_at = now()
  where id = p_interaction_id;

  return v_id;
end;
$$;
create or replace function public.fn_complete_interaction_step(
  p_step_id    uuid,
  p_status     text,
  p_error      text default null
) returns void language plpgsql as $$
begin
  update public.bot_interactions bi
  set steps_history = (
        select jsonb_agg(
          case
            when step->>'id' = p_step_id::text then
              step || jsonb_build_object(
                'status', p_status,
                'completed_at', now()::text,
                'error_detail', p_error
              )
            else step
          end
          order by ordinality
        )
        from jsonb_array_elements(coalesce(bi.steps_history, '[]'::jsonb))
          with ordinality as item(step, ordinality)
      ),
      current_step = case
        when p_status = 'failed' then 'error_' || coalesce(
          nullif(regexp_replace(
            (select item.value->>'step_name'
             from jsonb_array_elements(coalesce(bi.steps_history, '[]'::jsonb)) as item(value)
             where item.value->>'id' = p_step_id::text
             limit 1),
            '[^a-zA-Z0-9_]+',
            '_',
            'g'
          ), ''),
          'step_failed'
        )
        else current_step
      end,
      error_detail = case when p_status = 'failed' then p_error else error_detail end,
      last_failed_step = case
        when p_status = 'failed' then (
          select item.value->>'step_name'
          from jsonb_array_elements(coalesce(bi.steps_history, '[]'::jsonb)) as item(value)
          where item.value->>'id' = p_step_id::text
          limit 1
        )
        else last_failed_step
      end,
      updated_at = now()
  where exists (
    select 1
    from jsonb_array_elements(coalesce(bi.steps_history, '[]'::jsonb)) as item(value)
    where item.value->>'id' = p_step_id::text
  );
end;
$$;
create or replace function public.fn_log_dispatch_step_for_phone(
  p_phone text
) returns void language plpgsql as $$
declare
  v_interaction_id uuid;
  v_step_id uuid;
begin
  select id into v_interaction_id
  from public.bot_interactions
  where lead_phone = p_phone
    and is_resolved = false
    and current_step in ('response_queued', 'dispatch_sent')
  order by created_at desc
  limit 1;

  if v_interaction_id is null then return; end if;

  select public.fn_start_interaction_step(v_interaction_id, 'dispatch_sent') into v_step_id;
  perform public.fn_complete_interaction_step(v_step_id, 'complete', null);
end;
$$;
drop view if exists public.v_bot_open_incidents;
drop view if exists public.v_bot_pending_steps;
drop view if exists public.v_bot_interaction_timeline;
drop view if exists public.v_bot_interaction_log;
create or replace view public.v_bot_interaction_timeline as
select
  bi.id as interaction_id,
  bi.lead_phone,
  bi.current_step,
  bi.is_resolved,
  step.value->>'step_name' as step_name,
  step.value->>'status' as step_status,
  nullif(step.value->>'started_at', '')::timestamptz as started_at,
  nullif(step.value->>'completed_at', '')::timestamptz as completed_at,
  round(extract(epoch from (
    coalesce(nullif(step.value->>'completed_at', '')::timestamptz, now()) -
    nullif(step.value->>'started_at', '')::timestamptz
  ))) as duration_seconds,
  step.value->>'error_detail' as error_detail
from public.bot_interactions bi
cross join lateral jsonb_array_elements(coalesce(bi.steps_history, '[]'::jsonb)) step(value)
where bi.created_at > now() - interval '24 hours'
order by bi.created_at desc, nullif(step.value->>'started_at', '')::timestamptz asc;
create or replace view public.v_bot_pending_steps as
select
  step.value->>'id' as step_id,
  bi.id as interaction_id,
  bi.lead_phone,
  step.value->>'step_name' as step_name,
  nullif(step.value->>'started_at', '')::timestamptz as started_at,
  round(extract(epoch from (now() - nullif(step.value->>'started_at', '')::timestamptz)) / 60, 1)
    as minutos_pendente
from public.bot_interactions bi
cross join lateral jsonb_array_elements(coalesce(bi.steps_history, '[]'::jsonb)) step(value)
where step.value->>'status' = 'pending'
  and nullif(step.value->>'started_at', '')::timestamptz < now() - interval '5 minutes'
order by nullif(step.value->>'started_at', '')::timestamptz asc;
create or replace view public.v_bot_open_incidents as
select
  bi.id,
  bi.id as interaction_id,
  bi.lead_phone,
  bi.incident_property_id as property_id,
  p.public_id as property_public_id,
  bi.incident_broker_id as broker_id,
  b.display_name as broker_name,
  bi.incident_type,
  bi.incident_severity as severity,
  bi.incident_status as status,
  bi.incident_detected_at as detected_at,
  round(extract(epoch from (now() - bi.incident_detected_at)) / 60, 1) as minutos_aberto,
  bi.incident_details as details,
  bi.admin_notified_at,
  bi.broker_notified_at,
  bi.auto_recovery_attempted_at,
  bi.auto_recovery_result
from public.bot_interactions bi
left join public.properties p on p.id = bi.incident_property_id
left join public.brokers b on b.id = bi.incident_broker_id
where bi.incident_status = 'open'
order by bi.incident_detected_at desc;
grant select on public.v_bot_interaction_timeline to service_role;
grant select on public.v_bot_pending_steps to service_role;
grant select on public.v_bot_open_incidents to service_role;
drop table if exists public.bot_incidents;
drop table if exists public.bot_interaction_steps;
-- ============================================================
-- ROLLBACK (se necessario): recriar tabelas antigas pelas migrations
-- 20260427010000_bot_interaction_steps.sql e
-- 20260501090000_bot_incidents_monitoring.sql.
-- ============================================================;
