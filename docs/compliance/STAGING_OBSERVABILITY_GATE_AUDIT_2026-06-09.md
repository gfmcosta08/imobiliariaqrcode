# Staging Observability Gate Audit

Data: 2026-06-09
Escopo: Etapa 7 do PRD de production readiness
Ambiente-alvo: Supabase staging `coeuoyeydqoslhvbbojx`

## Objetivo

Transformar o monitoramento do bot em gate operacional: se houver incidente critico aberto, a esteira precisa falhar ou alertar de forma visivel.

## Mudancas Implementadas

- `bot-health-monitor` agora cria incidentes operacionais para:
  - `stripe_webhook_failed`;
  - `webhook_pending_timeout`;
  - `cron_heartbeat_stale`;
  - `outbound_message_stuck`.
- `bot-health-monitor` registra `correlation_id` recebido por header `x-correlation-id` ou gera um UUID.
- `bot-health-monitor` grava heartbeat proprio em `webhook_events` como `ops/cron_heartbeat`.
- `whatsapp-dispatch` grava heartbeat em `webhook_events` como `ops/cron_heartbeat`.
- `monitor-whatsapp-bot.yml` salva o JSON do monitor em `monitor-response.json` e falha quando `critical_open_incidents > 0`.
- `dispatch-whatsapp.yml` envia `x-correlation-id` para rastrear execucoes no Supabase/logs.

## Criterio de Gate

O workflow `Monitor WhatsApp Bot` deve falhar quando o payload do monitor retornar:

```json
{
  "critical_open_incidents": 1
}
```

O monitor continua retornando HTTP 200 quando executa corretamente; a decisao de quebrar a esteira fica no GitHub Actions, com base no payload.

## Evidencia Local

- Guardrail `apps/web/src/guardrails/bot-monitor.contract.test.ts`: PASS, 14/14.
- O teste cobre Stripe failed, heartbeat de cron, `critical_open_incidents`, `correlation_id`, workflow com `monitor-response.json` e header `x-correlation-id`.
- Simulacao local do gate com `critical_open_incidents=1`: PASS; o parser sairia com erro e derrubaria o workflow.

## Deploy e Smoke Staging

- Deploy Supabase staging `coeuoyeydqoslhvbbojx`: `bot-health-monitor` e `whatsapp-dispatch`.
- Smoke sem bearer em `bot-health-monitor`: `401`.
- Smoke sem bearer em `whatsapp-dispatch`: `401`.
- Consulta read-only de incidentes abertos em staging: sem linhas retornadas no momento da verificacao.
- Consulta read-only de heartbeats `ops/cron_heartbeat`: sem linhas retornadas antes de execucao autenticada dos crons.

## Queries Operacionais

```sql
select provider, event_name, external_event_id, received_at, processed_at
from public.webhook_events
where provider = 'ops'
  and event_name = 'cron_heartbeat'
order by received_at desc;
```

```sql
select incident_type, incident_severity, count(*) as open_total
from public.bot_interactions
where incident_status = 'open'
group by incident_type, incident_severity
order by incident_severity, incident_type;
```

## Observacao

Staging pode continuar com fila WhatsApp `queued` quando o bot live nao estiver ativo. Isso gera incidente `warning`; `processing` travado, Stripe failed e cron heartbeat stale sao criticos.
