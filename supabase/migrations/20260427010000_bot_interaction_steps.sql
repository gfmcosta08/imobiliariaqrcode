-- ============================================================
-- Migration: bot_interaction_steps
-- Data: 2026-04-27
-- Objetivo: log granular por etapa (pending → complete | failed)
--           Monitor detecta etapas presas e cura com precisão
-- ============================================================

-- 1. Tabela de log por etapa
create table if not exists public.bot_interaction_steps (
  id              uuid        primary key default gen_random_uuid(),
  interaction_id  uuid        not null references public.bot_interactions(id) on delete cascade,
  step_name       text        not null,
  -- pending  = etapa iniciada, ainda nao concluida (monitor detecta timeout aqui)
  -- complete = etapa concluida com sucesso -> pode avancar para proxima
  -- failed   = etapa falhou -> sistema registra para cura automatica
  status          text        not null default 'pending',
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  error_detail    text
);

-- Indice para o monitor detectar etapas pending antigas
create index if not exists idx_bot_steps_pending
  on public.bot_interaction_steps (started_at asc)
  where status = 'pending';

-- Indice para busca por interaction_id (historico da conversa)
create index if not exists idx_bot_steps_interaction
  on public.bot_interaction_steps (interaction_id, started_at asc);

-- 2. Funcoes SQL chamadas pelas Edge Functions via .rpc()

-- Inicia uma etapa como pending, retorna o step_id
create or replace function public.fn_start_interaction_step(
  p_interaction_id uuid,
  p_step           text
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.bot_interaction_steps (interaction_id, step_name, status)
  values (p_interaction_id, p_step, 'pending')
  returning id into v_id;
  return v_id;
end;
$$;

-- Marca etapa como complete ou failed
create or replace function public.fn_complete_interaction_step(
  p_step_id    uuid,
  p_status     text,
  p_error      text default null
) returns void language sql as $$
  update public.bot_interaction_steps
  set status       = p_status,
      completed_at = now(),
      error_detail = p_error
  where id = p_step_id;
$$;

-- Registra dispatch_sent diretamente pelo phone
-- (whatsapp-dispatch nao tem interaction_id disponivel)
create or replace function public.fn_log_dispatch_step_for_phone(
  p_phone text
) returns void language plpgsql as $$
declare v_interaction_id uuid;
begin
  select id into v_interaction_id
  from public.bot_interactions
  where lead_phone = p_phone
    and is_resolved = false
    and current_step in ('response_queued', 'dispatch_sent')
  order by created_at desc
  limit 1;

  if v_interaction_id is null then return; end if;

  insert into public.bot_interaction_steps
    (interaction_id, step_name, status, completed_at)
  values
    (v_interaction_id, 'dispatch_sent', 'complete', now());
end;
$$;

-- 3. Views de observabilidade

-- 3.1 Linha do tempo completa de cada interacao (ultimas 24h)
create or replace view public.v_bot_interaction_timeline as
select
  bi.id                                                                        as interaction_id,
  bi.lead_phone,
  bi.current_step,
  bi.is_resolved,
  s.step_name,
  s.status                                                                     as step_status,
  s.started_at,
  s.completed_at,
  round(extract(epoch from (coalesce(s.completed_at, now()) - s.started_at))) as duration_seconds,
  s.error_detail
from public.bot_interactions bi
join public.bot_interaction_steps s on s.interaction_id = bi.id
where bi.created_at > now() - interval '24 hours'
order by bi.created_at desc, s.started_at asc;

-- 3.2 Etapas pending por mais de 5 minutos (alerta imediato)
create or replace view public.v_bot_pending_steps as
select
  s.id            as step_id,
  s.interaction_id,
  bi.lead_phone,
  s.step_name,
  s.started_at,
  round(extract(epoch from (now() - s.started_at)) / 60, 1) as minutos_pendente
from public.bot_interaction_steps s
join public.bot_interactions bi on bi.id = s.interaction_id
where s.status = 'pending'
  and s.started_at < now() - interval '5 minutes'
order by s.started_at asc;

-- 4. Grants
grant all    on public.bot_interaction_steps      to service_role;
grant select on public.v_bot_interaction_timeline to service_role;
grant select on public.v_bot_pending_steps        to service_role;

-- ============================================================
-- ROLLBACK (se necessario):
-- drop view if exists public.v_bot_pending_steps;
-- drop view if exists public.v_bot_interaction_timeline;
-- drop function if exists public.fn_log_dispatch_step_for_phone(text);
-- drop function if exists public.fn_complete_interaction_step(uuid, text, text);
-- drop function if exists public.fn_start_interaction_step(uuid, text);
-- drop index if exists idx_bot_steps_interaction;
-- drop index if exists idx_bot_steps_pending;
-- drop table if exists public.bot_interaction_steps;
-- ============================================================
