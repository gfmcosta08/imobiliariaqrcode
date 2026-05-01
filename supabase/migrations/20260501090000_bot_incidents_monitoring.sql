-- ============================================================
-- Migration: bot_incidents
-- Data: 2026-05-01
-- Objetivo: incidentes detalhados do monitor deterministico do bot
-- ============================================================

create table if not exists public.bot_incidents (
  id                              uuid        primary key default gen_random_uuid(),
  interaction_id                  uuid        references public.bot_interactions(id) on delete set null,
  source_step_id                  uuid        references public.bot_interaction_steps(id) on delete set null,
  source_message_id               uuid        references public.whatsapp_messages(id) on delete set null,
  source_webhook_event_id          uuid        references public.webhook_events(id) on delete set null,
  lead_phone                      text,
  property_id                     uuid        references public.properties(id) on delete set null,
  broker_id                       uuid        references public.brokers(id) on delete set null,
  incident_type                   text        not null,
  severity                        text        not null default 'warning'
                                            check (severity in ('info', 'warning', 'critical')),
  status                          text        not null default 'open'
                                            check (status in ('open', 'auto_recovered', 'resolved', 'ignored')),
  detected_at                     timestamptz not null default now(),
  resolved_at                     timestamptz,
  details                         jsonb       not null default '{}'::jsonb,
  admin_notified_at               timestamptz,
  broker_notified_at              timestamptz,
  auto_recovery_attempted_at      timestamptz,
  auto_recovery_result            jsonb,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

drop trigger if exists trg_bot_incidents_updated_at on public.bot_incidents;
create trigger trg_bot_incidents_updated_at
before update on public.bot_incidents
for each row execute function public.set_updated_at();

create unique index if not exists idx_bot_incidents_open_interaction_type
  on public.bot_incidents (interaction_id, incident_type)
  where status = 'open' and interaction_id is not null;

create unique index if not exists idx_bot_incidents_open_step_type
  on public.bot_incidents (source_step_id, incident_type)
  where status = 'open' and source_step_id is not null;

create unique index if not exists idx_bot_incidents_open_message_type
  on public.bot_incidents (source_message_id, incident_type)
  where status = 'open' and source_message_id is not null;

create index if not exists idx_bot_incidents_open_detected
  on public.bot_incidents (detected_at desc)
  where status = 'open';

create index if not exists idx_bot_incidents_lead_phone
  on public.bot_incidents (lead_phone, detected_at desc);

create unique index if not exists idx_bot_incidents_open_global_type
  on public.bot_incidents (incident_type)
  where status = 'open'
    and interaction_id is null
    and source_step_id is null
    and source_message_id is null
    and source_webhook_event_id is null
    and lead_phone is null;

create or replace view public.v_bot_open_incidents as
select
  bi.id,
  bi.interaction_id,
  bi.lead_phone,
  bi.property_id,
  p.public_id as property_public_id,
  bi.broker_id,
  b.display_name as broker_name,
  bi.incident_type,
  bi.severity,
  bi.status,
  bi.detected_at,
  round(extract(epoch from (now() - bi.detected_at)) / 60, 1) as minutos_aberto,
  bi.details,
  bi.admin_notified_at,
  bi.broker_notified_at,
  bi.auto_recovery_attempted_at,
  bi.auto_recovery_result
from public.bot_incidents bi
left join public.properties p on p.id = bi.property_id
left join public.brokers b on b.id = bi.broker_id
where bi.status = 'open'
order by bi.detected_at desc;

grant all on public.bot_incidents to service_role;
grant select on public.v_bot_open_incidents to service_role;

-- ============================================================
-- ROLLBACK (se necessario):
-- drop view if exists public.v_bot_open_incidents;
-- drop index if exists idx_bot_incidents_lead_phone;
-- drop index if exists idx_bot_incidents_open_global_type;
-- drop index if exists idx_bot_incidents_open_detected;
-- drop index if exists idx_bot_incidents_open_message_type;
-- drop index if exists idx_bot_incidents_open_step_type;
-- drop index if exists idx_bot_incidents_open_interaction_type;
-- drop trigger if exists trg_bot_incidents_updated_at on public.bot_incidents;
-- drop table if exists public.bot_incidents;
-- ============================================================
