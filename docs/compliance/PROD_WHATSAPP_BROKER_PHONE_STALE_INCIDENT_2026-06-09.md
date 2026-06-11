# Incident Report - WhatsApp Broker Phone Stale Snapshot

Data: 2026-06-09
Severidade: P0 - integridade de destinatario
Ambiente afetado: production Supabase `egeteyzfpkbtkwraizwz`
Conta investigada: `percilianafmcosta@gmail.com`

## Resumo

Uma mensagem do bot destinada ao corretor usou um telefone antigo depois de alteracoes sucessivas de WhatsApp na conta. Isso e inadmissivel para o produto: mensagem de corretor precisa usar o telefone canonico atual no momento do envio, nao um snapshot antigo da fila.

## Causa Raiz

O sistema persistia `broker_phone` como snapshot em `public.whatsapp_messages` e o dispatcher `whatsapp-dispatch` enviava mensagens `payload.to_broker=true` usando diretamente esse valor.

Falhas tecnicas encontradas:

- `whatsapp-dispatch` nao carregava `account_id`/`property_id` na fila e nao reconsultava telefone atual antes do envio.
- `conversation-handle` preferia `brokers.whatsapp_number` antes de `profiles.whatsapp_number`.
- `lead-notify-broker` tambem enfileirava `brokers.whatsapp_number`.
- Mensagens `to_broker` historicas nao carregavam `broker_id` no payload, dificultando resolucao inequivoca do destinatario.

## Evidencia Sanitizada

Sem expor telefone completo:

- Telefone canonico atual em `profiles`/`brokers`: sufixo `6446`.
- Historico de mensagens `to_broker` ja enviadas para a conta continha sufixo antigo `2022`.
- As mensagens antigas com sufixo `2022` tinham `payload_broker_id=null`.
- Apos a correcao, nao havia mensagem `to_broker` pendente/processando para a conta.

## Correcao Aplicada

Arquivos alterados:

- `supabase/functions/whatsapp-dispatch/index.ts`
- `supabase/functions/conversation-handle/index.ts`
- `supabase/functions/lead-notify-broker/index.ts`
- `supabase/functions/bot-health-monitor/index.ts`
- `apps/web/src/guardrails/broker-phone-freshness.contract.test.ts`

Mudancas:

- `whatsapp-dispatch` agora carrega `account_id` e `property_id` da fila.
- Antes de enviar mensagem `to_broker`, o dispatcher chama `refreshBrokerPhoneBeforeSend`.
- A resolucao prioriza `payload.broker_id` e usa `profiles.whatsapp_number` como fonte canonica, com fallback conservador.
- Se o telefone fresco divergir do snapshot, a linha da fila e atualizada com `broker_phone_refreshed_at` antes do envio.
- Novas mensagens `to_broker` passam a carregar `broker_id` quando o alvo e conhecido.
- Criado guardrail automatizado para impedir regressao.

## Deploy

Staging:

- Projeto: `coeuoyeydqoslhvbbojx`
- Funcoes publicadas: `whatsapp-dispatch`, `conversation-handle`, `lead-notify-broker`, `bot-health-monitor`
- Smoke sem bearer: `401` para `whatsapp-dispatch`, `lead-notify-broker` e `bot-health-monitor`

Production:

- Projeto: `egeteyzfpkbtkwraizwz`
- Funcoes publicadas: `whatsapp-dispatch`, `conversation-handle`, `lead-notify-broker`, `bot-health-monitor`
- Smoke sem bearer: `401` para `whatsapp-dispatch`, `lead-notify-broker` e `bot-health-monitor`

## Verificacao

- RED inicial: `broker-phone-freshness.contract.test.ts` falhou no estado antigo.
- GREEN final: `broker-phone-freshness.contract.test.ts` passou.
- Guardrails bot/Supabase: 18 testes passaram.
- `pnpm --filter web run typecheck`: PASS.
- `prettier --check` nos arquivos tocados: PASS.

## Requisito Permanente

Toda mensagem destinada ao corretor deve obedecer a esta regra:

> `broker_phone` em fila e apenas snapshot operacional. Antes de enviar `to_broker=true`, o dispatcher precisa revalidar o telefone canonico atual do corretor e nunca depender exclusivamente do snapshot.
