# PRD Revisado: Unificacao Do Monitoramento Anti-Silencio Do Bot

## Resumo

Resolver o silencio do bot no WhatsApp e corrigir a modelagem do monitoramento. O sistema deve usar uma unica tabela para rastrear execucao, etapas, falhas, validacoes, incidentes, notificacoes e autocura do bot.

Apos analise das tabelas do projeto, a unificacao deve ficar restrita as tabelas especificas de monitoramento do bot. As tabelas de dominio do produto, mensagens, leads, imoveis, QR, billing, parceiros e auditoria nao devem ser unificadas neste PRD.

## Analise Das Tabelas

Podem ser unificadas em `bot_interactions`:

- `bot_interactions`: deve ser mantida como tabela unica oficial do monitoramento.
- `bot_interaction_steps`: deve ser incorporada em `bot_interactions`, pois registra etapas da mesma execucao.
- `bot_incidents`: deve ser incorporada em `bot_interactions`, pois registra falhas/incidentes da mesma execucao.

Views ligadas a essas tabelas devem ser recriadas ou removidas:

- `v_bot_health_summary`
- `v_bot_stuck_interactions`
- `v_bot_hourly_success`
- `v_bot_interaction_timeline`
- `v_bot_pending_steps`
- `v_bot_open_incidents`

Nao devem ser unificadas neste PRD:

- `whatsapp_messages`: fila e historico real de mensagens inbound/outbound.
- `webhook_events`: registro bruto/idempotencia dos webhooks recebidos.
- `conversation_sessions`: estado conversacional atual do cliente.
- `leads` e `lead_interactions`: dados comerciais do lead.
- `properties`, `property_media`, `property_features`, `property_qrcodes`: dominio de imoveis.
- `qr_access_events`, `recommendation_events`, `print_events`, `audit_logs`: eventos proprios de produto/auditoria.
- `accounts`, `profiles`, `brokers`, `partners`, `subscriptions`, `plans` e tabelas comerciais/billing: dominio administrativo, comercial ou financeiro.

## Mudancas Tecnicas

- Expandir `bot_interactions` para concentrar:
  - mensagem de entrada;
  - etapa atual;
  - historico das etapas;
  - validacoes de ok por etapa;
  - erro e etapa travada;
  - incidente detectado;
  - notificacao ao dono do anuncio/corretor;
  - tentativa e resultado da autocura;
  - status final da execucao.
- Substituir o uso de `bot_interaction_steps` por um historico estruturado dentro de `bot_interactions`.
- Substituir o uso de `bot_incidents` por campos estruturados dentro de `bot_interactions`.
- Ajustar `conversation-handle`, `whatsapp-webhook-inbound`, `whatsapp-dispatch` e `bot-health-monitor` para registrar e consultar somente `bot_interactions` no fluxo de monitoramento.
- Remover ou recriar as views `v_bot_*` para dependerem somente de `bot_interactions`.
- Apos consolidacao, remover `bot_interaction_steps` e `bot_incidents` por migration.

## Criterios De Aceite

- Cada nova execucao do bot gera uma nova linha em `bot_interactions`.
- Nao ha escrita nova em `bot_interaction_steps` nem em `bot_incidents`.
- O bot nao fica apenas digitando sem resposta, erro rastreavel ou autocura.
- O sistema identifica exatamente em qual etapa travou.
- O sistema notifica o dono do anuncio/corretor responsavel quando houver silencio.
- A autocura tenta continuar a interacao a partir da etapa interrompida.
- As demais tabelas do sistema permanecem separadas e preservadas.

## Testes

- Testar novo cliente via QR/WhatsApp recebendo descricao, fotos e menu.
- Testar falha antes da resposta e validar registro em `bot_interactions`.
- Testar etapa travada e validar identificacao da etapa.
- Considerar etapa `pending` ou resposta enfileirada/processando como travada em no maximo 5 minutos.
- Testar autocura e continuidade do fluxo.
- Testar notificacao ao dono do anuncio/corretor.
- Testar que mensagens internas e notificacoes ao corretor nao contam como resposta ao cliente.
- Testar que `bot_interaction_steps` e `bot_incidents` nao recebem novas escritas.
- Executar `pnpm test`, `pnpm --filter web run typecheck` e `git diff --check`.

## Assumptions

- A tabela unica sera `bot_interactions`.
- A unificacao deste PRD e apenas do monitoramento anti-silencio do bot.
- Tabelas de dominio, mensagens e eventos operacionais continuam separadas.
- A confirmacao remota direta via Supabase CLI depende de autenticacao do projeto.

## Status De Execucao

Implementado em 2026-05-02.

- Migration criada e aplicada: `supabase/migrations/20260502090000_unify_bot_monitoring.sql`.
- Edge Function publicada: `bot-health-monitor`.
- Guardrails atualizados: `apps/web/src/guardrails/bot-monitor.contract.test.ts`.
- Validacoes executadas com sucesso:
  - `pnpm test`
  - `pnpm --filter web run typecheck`
  - `git diff --check`

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
