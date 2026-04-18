# Relatorio de Metricas - Atendimento de Leads

## Objetivo
Monitorar a eficiencia do atendimento inteligente com foco em tempo real, qualidade de cadastro e continuidade de conversa.

## KPIs Principais
- Volume total de conversas iniciadas por dia.
- Taxa de captura de nome completo no fluxo de agendamento.
- Taxa de fallback de nome via Uazapi.
- Taxa de recusa com fechamento assistido (nome solicitado antes de encerrar).
- Tempo medio de processamento de eventos inbound.

## Consultas SQL de Monitoramento

```sql
-- 1) Conversas iniciadas por dia
select date_trunc('day', created_at) as dia, count(*) as conversas
from public.conversation_sessions
group by 1
order by 1 desc;
```

```sql
-- 2) Leads com nome cadastrado (cobertura de cadastro)
select
  count(*) as total_leads,
  count(*) filter (where client_name is not null and btrim(client_name) <> '') as leads_com_nome,
  round(
    100.0 * count(*) filter (where client_name is not null and btrim(client_name) <> '')
    / nullif(count(*), 0),
    2
  ) as pct_com_nome
from public.leads;
```

```sql
-- 3) Uso de fallback Uazapi para nome
select
  date_trunc('day', created_at) as dia,
  count(*) filter (where payload ->> 'name_source' = 'uazapi') as via_uazapi,
  count(*) filter (where payload ->> 'name_source' = 'text') as via_texto
from public.whatsapp_messages
where direction = 'outbound'
  and payload ? 'name_source'
group by 1
order by 1 desc;
```

```sql
-- 4) Recusa com solicitação de nome antes do fechamento
select
  date_trunc('day', created_at) as dia,
  count(*) filter (where payload ->> 'kind' = 'ask_name_before_close') as pedidos_nome_antes_fechamento
from public.whatsapp_messages
where direction = 'outbound'
group by 1
order by 1 desc;
```

```sql
-- 5) Tempo de processamento inbound (estimativa por webhook_events)
select
  date_trunc('day', received_at) as dia,
  round(avg(extract(epoch from (processed_at - received_at))), 3) as tempo_medio_segundos,
  max(extract(epoch from (processed_at - received_at))) as pico_segundos
from public.webhook_events
where provider = 'uazapi'
  and event_name = 'inbound'
  and processed_at is not null
group by 1
order by 1 desc;
```

## Observacoes Operacionais
- Revisar os KPIs diariamente no inicio da operacao.
- Se a taxa de fallback Uazapi subir abruptamente, revisar mensagens de solicitacao de nome.
- Se o tempo medio de processamento crescer, validar gargalos em `conversation-handle` e `whatsapp-dispatch`.
