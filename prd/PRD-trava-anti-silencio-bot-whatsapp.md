# PRD Tecnico: Trava Anti-Silencio Do Bot WhatsApp

## Resumo

Implementar uma protecao obrigatoria para garantir que toda mensagem recebida pelo bot termine com uma resposta visivel ao cliente, um fallback tecnico imediato ou um erro rastreavel.

A falha analisada em 30/04/2026 as 16:45 ocorreu porque o fluxo criou lead e sessao, mas nao comprovou que uma mensagem real ao cliente foi enfileirada. A partir desta melhoria, o webhook nao deve ser considerado processado quando nao houver resposta visivel ao cliente.

## Diagnostico Do Impacto

- Area sensivel: `whatsapp-webhook-inbound`, `conversation-handle`, `whatsapp_messages`, `bot_interactions` e `bot_interaction_steps`.
- O rastreio existente registrava etapas, mas nao validava a pos-condicao principal: houve resposta visivel ao cliente.
- Mensagens internas `message_type = system` e notificacoes ao corretor com `payload.to_broker = true` nao podem contar como atendimento ao cliente.
- A protecao deve preservar QR inicial, opcoes do menu, imoveis semelhantes, coleta/confirmacao de nome e notificacao ao corretor.

## Regras De Produto

- Toda mensagem inbound precisa terminar com resposta visivel ao cliente, fallback tecnico ou erro rastreavel.
- Lead criado sozinho nao e atendimento ao cliente.
- Notificacao ao corretor nao e atendimento ao cliente.
- Mensagem interna do sistema nao e atendimento ao cliente.
- O cliente nao pode ficar sem retorno quando uma etapa falhar ou quando o handler retornar sucesso falso.

## Estrategia Tecnica

- Criar validacao de resposta visivel no `conversation-handle`.
- Contar somente mensagens outbound para o cliente com status `queued`, `processing` ou `sent`.
- Ignorar mensagens `system`.
- Ignorar mensagens com `payload.to_broker = true`.
- Em sucesso silencioso, enfileirar fallback tecnico, marcar erro rastreavel e retornar falha controlada.
- No inbound, fazer checagem defensiva antes de marcar `webhook_events` como `processed`.

## Criterios De Aceitacao

- QR inicial continua enviando descricao, fotos e menu.
- Opcao 2 continua exibindo imoveis semelhantes.
- Opcao 1 apos semelhantes continua perguntando ID e registrando visita.
- ID invalido continua pedindo nova tentativa.
- Falha antes de responder ao cliente gera fallback imediato.
- `bot_interactions.error_detail` registra `silent_response_blocked` quando houver sucesso falso.
- Webhook nao e marcado como `processed` sem resposta visivel ou deduplicacao valida.

## Validacao

- `pnpm test`
- `pnpm --filter web run typecheck`
- `git diff --check`

## Escopo Fora Desta Versao

- Nao altera banco.
- Nao altera schema de imoveis.
- Nao altera home, cadastro, QR publico ou busca.
- Nao altera contratos externos do bot.
- Nao reescreve historico nem refatora fluxo comercial.

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
