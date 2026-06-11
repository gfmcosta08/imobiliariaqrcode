# Staging Operational Health Runbook

Data: 2026-06-06
Ambiente: Supabase staging `coeuoyeydqoslhvbbojx`
Produto: ImoveisQR
Production modified: no

Este runbook define checks minimos para operar o staging antes de promocao para producao. O ambiente de teste nao possui bot WhatsApp ativo; portanto, fila WhatsApp parada em staging e sinal de ambiente sem bot, nao evidencia de falha live do bot. Em producao, a mesma condicao vira incidente P0.

## Gates Operacionais

| Area               | Sinal vermelho                               | Severidade staging         | Severidade producao | Acao                                                                    |
| ------------------ | -------------------------------------------- | -------------------------- | ------------------- | ----------------------------------------------------------------------- |
| Stripe webhook     | `processing_status='failed'` nas ultimas 24h | P0                         | P0                  | Verificar assinatura, payload, idempotencia e subscription update.      |
| Webhooks pendentes | `pending` ha mais de 15 min                  | P1                         | P0                  | Reprocessar ou classificar como `ignored` com justificativa.            |
| WhatsApp queue     | `queued/processing` ha mais de 10 min        | Informativo se bot inativo | P0                  | Verificar `CRON_SECRET`, workflow `dispatch-whatsapp`, provider e logs. |
| WhatsApp failed    | `failed` nas ultimas 24h                     | P1                         | P0                  | Verificar provider, payload e retry.                                    |
| Bot interaction    | `is_resolved=false` em 24h                   | Informativo se bot inativo | P0                  | Rodar `bot-health-monitor` e revisar fallback visivel.                  |
| Cron heartbeat     | heartbeat `ops/cron_heartbeat` atrasado      | P0                         | P0                  | Verificar GitHub Actions, secrets, Supabase Functions e ultimo deploy.  |
| Critical incidents | `critical_open_incidents > 0` no monitor     | P0                         | P0                  | Workflow deve falhar ate incidente ser resolvido ou classificado.       |
| Importador         | jobs `failed` em 24h                         | P1                         | P1                  | Revisar URL, parser, limites e fallback manual.                         |

## Snapshot Staging 2026-06-06

Resultado consultado via Supabase Management API:

| Check                             | Valor |
| --------------------------------- | ----: |
| `stripe_webhook_failed_24h`       |     0 |
| `webhook_pending_gt_15m`          |     0 |
| `whatsapp_queue_stuck_gt_10m`     |    37 |
| `whatsapp_failed_24h`             |     0 |
| `property_import_failed_24h`      |     0 |
| `bot_interactions_unresolved_24h` |     0 |

Interpretacao: staging esta saudavel para Stripe/webhooks/import/bot monitor, com ressalva esperada de fila WhatsApp por ausencia de bot live no ambiente de teste.

## Query - Health Snapshot

```sql
select 'stripe_webhook_failed_24h' as check_name, count(*)::text as value
from public.webhook_events
where provider = 'stripe'
  and processing_status = 'failed'
  and received_at >= now() - interval '24 hours'
union all
select 'webhook_pending_gt_15m', count(*)::text
from public.webhook_events
where processing_status = 'pending'
  and received_at < now() - interval '15 minutes'
union all
select 'whatsapp_queue_stuck_gt_10m', count(*)::text
from public.whatsapp_messages
where status in ('queued', 'processing')
  and created_at < now() - interval '10 minutes'
union all
select 'whatsapp_failed_24h', count(*)::text
from public.whatsapp_messages
where status = 'failed'
  and created_at >= now() - interval '24 hours'
union all
select 'property_import_failed_24h', count(*)::text
from public.property_import_jobs
where status = 'failed'
  and created_at >= now() - interval '24 hours'
union all
select 'bot_interactions_unresolved_24h', count(*)::text
from public.bot_interactions
where is_resolved = false
  and created_at >= now() - interval '24 hours'
union all
select 'critical_open_incidents', count(*)::text
from public.bot_interactions
where incident_status = 'open'
  and incident_severity = 'critical'
union all
select 'cron_heartbeat_stale', count(*)::text
from (
  values ('bot-health-monitor'), ('whatsapp-dispatch')
) as expected(cron_name)
left join public.webhook_events w
  on w.provider = 'ops'
 and w.event_name = 'cron_heartbeat'
 and w.external_event_id = expected.cron_name
where w.received_at is null
   or w.received_at < now() - interval '15 minutes';
```

## Query - Cron Heartbeats

```sql
select
  external_event_id as cron_name,
  received_at,
  processed_at,
  payload->>'correlation_id' as correlation_id
from public.webhook_events
where provider = 'ops'
  and event_name = 'cron_heartbeat'
order by received_at desc;
```

## Query - Open Incidents

```sql
select
  incident_type,
  incident_severity,
  incident_status,
  count(*) as total,
  min(incident_detected_at) as oldest_detected_at,
  max(incident_detected_at) as newest_detected_at
from public.bot_interactions
where incident_status = 'open'
group by incident_type, incident_severity, incident_status
order by oldest_detected_at asc;
```

## Query - Stuck WhatsApp Queue Detail

Use somente para diagnostico; nao exponha telefone completo em relatorios publicos.

```sql
select
  status,
  direction,
  message_type,
  count(*) as total,
  min(created_at) as oldest_created_at,
  max(updated_at) as newest_updated_at
from public.whatsapp_messages
where status in ('queued', 'processing')
group by status, direction, message_type
order by oldest_created_at asc;
```

## Query - Stripe Failures

```sql
select
  id,
  event_name,
  external_event_id,
  received_at,
  processed_at,
  processing_status
from public.webhook_events
where provider = 'stripe'
  and processing_status = 'failed'
order by received_at desc
limit 50;
```

## Recovery - Stripe

1. Confirmar que `STRIPE_WEBHOOK_SECRET` do staging corresponde ao endpoint Stripe test mode.
2. Buscar `external_event_id` em `webhook_events`.
3. Confirmar se o evento e duplicado; duplicados devem retornar `received=true, duplicate=true`.
4. Se o handler falhou, corrigir codigo ou dados, registrar a causa e reprocessar via Stripe test event quando seguro.
5. Nao usar `sk_live_` em staging.

## Recovery - Cron e Functions

1. Confirmar GitHub Actions `dispatch-whatsapp.yml` e `monitor-whatsapp-bot.yml`.
2. Confirmar secret `CRON_SECRET` no ambiente que chama a function.
3. Smoke sem bearer deve retornar 401.
4. Smoke com bearer deve retornar 200 ou payload operacional esperado.
5. Se `Access-Control-Allow-Origin` voltar para `*`, reconfigurar `CORS_ALLOW_ORIGIN`.
6. Confirmar heartbeat `ops/cron_heartbeat` para `bot-health-monitor` e `whatsapp-dispatch`.
7. Se o workflow `Monitor WhatsApp Bot` falhar por `critical_open_incidents`, abrir os incidentes em `bot_interactions` antes de reexecutar.

## Recovery - Bot WhatsApp

No staging atual, bot live nao e requisito. Se o bot for habilitado em staging, promover estes checks para bloqueadores:

- `whatsapp_queue_stuck_gt_10m = 0`;
- `bot_interactions_unresolved_24h = 0`;
- monitor sem `continue-on-error`;
- `critical_open_incidents = 0`;
- heartbeats de cron com menos de 15 minutos;
- fallback visivel registrado quando conversa falhar.

## Recovery - Importador

1. Verificar `property_import_jobs.status`.
2. Se `failed`, classificar erro: site bloqueado, parser, limite de plano, imagem ou dados obrigatorios.
3. Usar fallback manual quando o portal bloquear crawling.
4. Nao deixar importacao ser requisito para gerar QR.
