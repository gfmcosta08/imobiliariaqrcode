# PRD Tecnico: Monitor Deterministico De Rastreabilidade Do Bot WhatsApp

## Resumo

Adaptar a rastreabilidade atual do bot para sair de observabilidade passiva e virar monitor ativo. O sistema revisa automaticamente `bot_interactions`, `bot_interaction_steps`, `whatsapp_messages` e `webhook_events`, detecta falhas reais no atendimento, registra incidentes detalhados, alerta o admin por WhatsApp e avisa o corretor responsavel pelo anuncio quando houver interesse de cliente sem atendimento completo.

## Decisao Tecnica

- `bot_interactions` e `bot_interaction_steps` continuam sendo a trilha oficial do funcionamento do bot.
- `bot_incidents` registra os incidentes detectados pelo monitor sem sobrecarregar a tabela principal.
- A deteccao principal e deterministica, executada por Edge Function protegida por `CRON_SECRET` ou service role.
- IA/agente especialista pode ser adicionado depois para resumir incidentes, mas nao sera responsavel pela deteccao inicial.

## Regras Do Monitor

- Detectar interacao sem resposta visivel ao cliente.
- Detectar etapa `pending` antiga.
- Detectar webhook processado sem outbound real.
- Detectar `response_queued` sem envio pelo dispatch.
- Detectar mensagem outbound travada em `queued` ou `processing`.
- Detectar `error_silent_response_blocked`, `error_max_retries` e fallback tecnico enviado ao cliente.
- Resposta visivel ao cliente ignora mensagens `system` e mensagens com `payload.to_broker = true`.

## Auto-Cura E Alertas

- Enfileirar fallback tecnico ao cliente quando ainda nao existir fallback recente.
- Acionar `whatsapp-dispatch` quando houver mensagem travada ou fallback/alerta a enviar.
- Alertar admin usando `BOT_ADMIN_WHATSAPP_NUMBERS`.
- Alertar o corretor responsavel pelo anuncio usando `properties.broker_id` e `brokers.whatsapp_number`.
- Evitar duplicidade por incidente aberto.

## Validacao

- Testes de contrato garantem tabela de incidentes, deduplicacao, autenticacao, resposta visivel, alertas e auto-cura.
- Comandos obrigatorios:
  - `pnpm test`
  - `pnpm --filter web run typecheck`
  - `git diff --check`

## Fora De Escopo

- Nao altera fluxo comercial do bot.
- Nao altera cadastro, home ou schema de imoveis.
- Nao substitui o dispatcher.
- Nao envia alerta sem configuracao explicita de admin.
