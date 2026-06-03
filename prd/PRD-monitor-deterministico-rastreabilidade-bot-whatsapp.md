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

## Alinhamento De Homologacao - 2026-06-02

Este PRD deve ser interpretado em conjunto com o pacote homologado na branch `codex/homologacao-segura`, documentado em `docs/compliance/evidencias/HOMOLOGACAO_FREE_STARTER_CORTESIA_STRIPE_2026-06-02.md`.

Regras vigentes de produto/ambiente apos a homologacao:

- Toda implementacao e teste deve ocorrer primeiro em homologacao: `https://farollimoveis-staging.vercel.app`.
- Producao nao pode receber deploy automatico; exige aprovacao humana separada.
- Plano Free vigente: 30 dias, 1 anuncio ativo, sem cobranca automatica.
- Plano Starter vigente em homologacao: R$ 150,00/mes, anuncios ilimitados, QR Codes, leads, bot WhatsApp e demais beneficios do sistema.
- Checkout Stripe foi validado somente em modo teste, com chave `sk_test_`, preco `STRIPE_PRICE_STARTER` e webhook exclusivo de staging.
- Webhooks Stripe antigos de Preview foram desativados para impedir sobrescrita por codigo antigo.
- Assinatura de teste validada: `plan_code=starter`, `status=starter_active`, via Stripe Checkout e Billing Portal.
- Antes do checkout, o usuario precisa aceitar Termos de Uso, Politica de Privacidade e Cancelamento/Reembolso; o aceite e registrado em trilha append-only.
- Admin pode gerar convite cortesia e editar limite de imoveis/data de validade mesmo apos ativacao; reducao de limite arquiva anuncios antigos e expiracao retroativa arquiva ativos e invalida QR Codes.
- Qualquer PRD de bot/WhatsApp continua bloqueado para E2E real ate existir numero exclusivo de teste e allowlist de homologacao.

Impacto neste PRD:

- Se este PRD mencionar PRO, Solo, Premium ou checkout desativado, considere essas referencias historicas/substituidas para o escopo comercial atual por Free + Starter, salvo quando o texto tratar explicitamente de legado.
- Se este PRD tocar cadastro, anuncios, QR, leads, planos, billing, aceite legal, admin ou bot, os testes devem incluir os guardrails de homologacao e a verificacao de que producao nao foi alterada.
