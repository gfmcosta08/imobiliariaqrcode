-- ============================================================
-- Migration: bot_interactions + retry_count + views de saude
-- Data: 2026-04-27
-- Objetivo: rastreamento por etapa + auto-cura + painel Supabase
-- ============================================================

-- 1. Tabela principal de rastreamento por interacao
create table if not exists public.bot_interactions (
  id               uuid        primary key default gen_random_uuid(),
  lead_phone       text        not null,
  inbound_text     text,
  webhook_event_id uuid        references public.webhook_events(id) on delete set null,

  -- Etapa atual do fluxo
  -- Progresso: webhook_received → session_loaded → property_resolved
  --            → response_queued → completed
  -- Recuperacao: recovering
  -- Erros: error_no_property | error_conversation_failed
  --        | error_dispatch_failed | error_max_retries
  current_step     text        not null default 'webhook_received',
  error_detail     text,

  -- Contador de tentativas de auto-cura pelo monitor
  retry_count      int         not null default 0,
  is_resolved      boolean     not null default false,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- Indice para queries do monitor (interacoes ativas ordenadas por tempo)
create index if not exists idx_bot_interactions_active
  on public.bot_interactions (updated_at desc)
  where is_resolved = false;
-- Indice para busca por lead
create index if not exists idx_bot_interactions_lead_phone
  on public.bot_interactions (lead_phone, created_at desc);
-- Indice para queries por etapa (monitor detecta etapas presas)
create index if not exists idx_bot_interactions_step
  on public.bot_interactions (current_step)
  where is_resolved = false;
-- 2. Trigger: atualiza updated_at e auto-resolve etapas finais
create or replace function public.fn_bot_interactions_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  -- Auto-marcar como resolvido em etapas finais
  if new.current_step in ('completed', 'error_max_retries', 'error_no_property')
     and old.is_resolved = false
  then
    new.is_resolved = true;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_bot_interactions_touch on public.bot_interactions;
create trigger trg_bot_interactions_touch
before update on public.bot_interactions
for each row execute function public.fn_bot_interactions_touch();
-- 3. Coluna retry_count em whatsapp_messages (limite de tentativas no dispatch)
alter table public.whatsapp_messages
  add column if not exists retry_count int not null default 0;
create index if not exists idx_whatsapp_messages_retriable
  on public.whatsapp_messages (created_at asc)
  where status = 'queued'
    and direction = 'outbound'
    and retry_count < 5;
-- 4. Views de observabilidade (acessiveis no Supabase Studio > Table Editor > Views)

-- 4.1 Visao geral de saude (ultimas 24h)
create or replace view public.v_bot_health_summary as
select
  current_step,
  count(*)                                          as total,
  count(*) filter (where is_resolved = false)       as pendentes,
  min(created_at)                                   as mais_antiga,
  max(created_at)                                   as mais_recente
from public.bot_interactions
where created_at > now() - interval '24 hours'
group by current_step
order by total desc;
-- 4.2 Interacoes com problema ativo (presas > 5 min, nao resolvidas)
create or replace view public.v_bot_stuck_interactions as
select
  id,
  lead_phone,
  current_step,
  retry_count,
  error_detail,
  created_at,
  round(extract(epoch from (now() - updated_at)) / 60, 1) as minutos_parado
from public.bot_interactions
where is_resolved = false
  and updated_at < now() - interval '5 minutes'
order by updated_at asc;
-- 4.3 Taxa de sucesso por hora (ultimas 12h)
create or replace view public.v_bot_hourly_success as
select
  date_trunc('hour', created_at)                                  as hora,
  count(*)                                                        as total,
  count(*) filter (where current_step = 'completed')             as sucesso,
  count(*) filter (where current_step like 'error_%')            as erros,
  round(
    100.0 * count(*) filter (where current_step = 'completed')
    / nullif(count(*), 0),
    1
  )                                                               as taxa_sucesso_pct
from public.bot_interactions
where created_at > now() - interval '12 hours'
group by 1
order by 1 desc;
-- 5. Grant de acesso para service_role (Edge Functions)
grant all on public.bot_interactions to service_role;
grant select on public.v_bot_health_summary to service_role;
grant select on public.v_bot_stuck_interactions to service_role;
grant select on public.v_bot_hourly_success to service_role;
-- ============================================================
-- ROLLBACK (se necessario):
-- drop view if exists public.v_bot_hourly_success;
-- drop view if exists public.v_bot_stuck_interactions;
-- drop view if exists public.v_bot_health_summary;
-- drop trigger if exists trg_bot_interactions_touch on public.bot_interactions;
-- drop function if exists public.fn_bot_interactions_touch();
-- drop index if exists idx_whatsapp_messages_retriable;
-- alter table public.whatsapp_messages drop column if exists retry_count;
-- drop index if exists idx_bot_interactions_step;
-- drop index if exists idx_bot_interactions_lead_phone;
-- drop index if exists idx_bot_interactions_active;
-- drop table if exists public.bot_interactions;
-- ============================================================;
