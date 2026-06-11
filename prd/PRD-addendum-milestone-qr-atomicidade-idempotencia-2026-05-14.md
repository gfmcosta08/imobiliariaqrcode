# PRD Addendum - Milestone QR com Atomicidade e Idempotencia (14/05/2026)

## Resumo

Este addendum registra a correcao definitiva para o incidente de milestone de visualizacoes por QR, com foco em:

- eliminar duplicidade de mensagem do mesmo marco (ex.: `130 pessoas...` repetido);
- reforcar rastreabilidade para o anuncio correto;
- manter operacao do bot sem regressao.

Data de referencia: 14/05/2026.

## Problema Observado

Sintoma reportado em producao:

- envio duplicado da mensagem de milestone de visualizacoes;
- percepcao de associacao incorreta de `public_id` em alguns casos operacionais.

Regra de negocio preservada:

- milestone continua sendo enviado em multiplos de 10 visualizacoes.

## Causa Tecnica

Causa principal identificada:

- concorrencia na funcao SQL `register_qr_access` permitindo que transacoes paralelas avaliassem o mesmo marco e enfileirassem mensagens duplicadas antes da deduplicacao logica antiga surtir efeito.

Fator adicional:

- existencia de mensagens legadas duplicadas em `queued` para `qr_views_milestone`.

## Correcao Aplicada

Migration aplicada:

- `supabase/migrations/20260514113000_qr_milestone_atomic_dedupe.sql`

Mudancas implementadas:

1. Atomicidade por QR token

- adicionado `pg_advisory_xact_lock` por `qr_token` na `register_qr_access`.

2. Idempotencia forte no banco

- indice unico parcial para mensagens ativas de milestone (`queued`/`processing`) com chave logica:
  - `broker_phone`
  - `payload.qr_token`
  - `payload.milestone`
  - `payload.kind`
- insert com `ON CONFLICT DO NOTHING`.

3. Vínculo explicito no payload

- enriquecimento de `payload` com:
  - `property_id`
  - `public_id`
  - `qr_token`
  - `milestone`
  - `event_timestamp`
- texto do milestone permanece derivado do `public_id` resolvido no mesmo contexto transacional.

4. Saneamento de fila legada

- duplicatas antigas `queued` de `qr_views_milestone` marcadas como `abandoned`.
- sem delete fisico de historico.

## Nao Regressao do Bot

Mantido o principio de seguranca dos PRDs de protecao:

- sem alteracao em `conversation-handle`;
- sem alteracao em `whatsapp-webhook-inbound`;
- sem alteracao de contratos sensiveis de monitoramento.

## Evidencias de Validacao e Aplicacao

1. Aplicacao remota da migration

- Comando: `npx supabase db push`.
- Confirmacao: `npx supabase migration list` com `20260514113000` em Local e Remote.

2. Validacao tecnica

- `corepack pnpm --filter web exec vitest run src/guardrails` -> `39/39`.
- `corepack pnpm --filter web run test` -> `59/59`.
- `corepack pnpm --filter web run typecheck` -> sucesso.
- `corepack pnpm --filter web run build` -> sucesso.
- `git diff --check` -> sem erro estrutural.

## Criterios de Aceite

- [x] Mesmo milestone nao duplica por corrida concorrente.
- [x] Payload de milestone possui rastreabilidade de anuncio/QR.
- [x] Duplicatas legadas em fila foram saneadas sem exclusao destrutiva.
- [x] Bot segue funcional e protegido pelos guardrails.

## Pendencias Operacionais

1. Monitorar 24h em producao para confirmar ausencia de duplicatas novas de milestone.
2. Validar em caso real que mensagem de milestone corresponde ao anuncio esperado no fluxo de negocio.

## Assumptions

1. Este addendum documenta o estado aplicado em 14/05/2026.
2. Nenhum segredo, token ou senha foi registrado em texto claro.
