# PRD Tecnico: Correcao Segura Da Deduplicacao Do QR Code No Bot WhatsApp

## Resumo

Corrigir o fluxo inicial do QR Code para impedir que mensagens internas, como `lead_created`, sejam tratadas como resposta ja enviada ao cliente.

O objetivo e garantir que todo numero novo que leia um QR receba o pacote correto do imovel: descricao, fotos e menu, sem quebrar opcao 1, opcao 2, opcao 3, atendimento ao corretor, monitor anti-silencio ou dispatcher.

## Diagnostico Do Impacto

- A area sensivel e `supabase/functions/conversation-handle/index.ts`.
- A deduplicacao do QR usava contagem de qualquer mensagem outbound recente do lead/imovel.
- Mensagens internas `message_type = "system"`, como `lead_created`, podiam entrar nessa contagem e bloquear o envio do pacote completo.
- No caso analisado de 30/04/2026 as 16:45, o sistema criou lead e mensagem interna, mas o cliente nao recebeu descricao, fotos e menu no fluxo inicial.

## Arquivos Afetados

- Codigo: `supabase/functions/conversation-handle/index.ts`.
- Testes: `apps/web/src/guardrails/whatsapp-flow.contract.test.ts`.
- Documentacao: `prd/PRD-correcao-deduplicacao-qr-bot-whatsapp.md`.

Nao ha alteracao de banco, migration, dependencias, dispatcher, home, cadastro de imoveis ou QR publico.

## Alteracao Proposta

- Criar uma contagem especifica para pacote visivel do QR.
- Considerar como pacote visivel apenas mensagens outbound do cliente, do mesmo imovel, recentes e com `kind` esperado do pacote:
  - `lead_intro`;
  - `property_summary`;
  - `property_image`;
  - `main_menu`;
  - `menu_option_*`.
- Ignorar explicitamente:
  - `message_type = "system"`;
  - `payload.to_broker = true`;
  - `payload.kind = "lead_created"`;
  - alertas internos e notificacoes tecnicas.
- Se existir apenas `lead_created`, o bot deve continuar e enviar o pacote completo.
- Se ja existir pacote real recente, o bot deve manter a deduplicacao e evitar duplicidade.

## Testes Obrigatorios

- Garantir que `lead_created` nao conta como pacote ja enviado.
- Garantir que mensagem `system` nao bloqueia `sendPropertyPack`.
- Garantir que `payload.to_broker = true` nao bloqueia `sendPropertyPack`.
- Garantir que pacote real recente continua protegendo contra duplicidade.
- Garantir que QR inicial segue com descricao, fotos e menu.
- Garantir que opcao 2, opcao 1 pos-semelhantes, ID invalido, notificacao ao corretor e trava anti-silencio continuam protegidos.

## Validacao

Executar:

- `pnpm test`
- `pnpm --filter web run typecheck`
- `git diff --check`

Quando possivel, executar tambem:

- `pnpm --filter web run build`

## Criterios De Aceitacao

- Numero novo que le QR nao fica sem pacote por causa de `lead_created`.
- Mensagem `system` nunca conta como atendimento visivel ao cliente.
- Notificacao ao corretor nunca conta como atendimento ao cliente.
- Retry real do webhook nao gera pacote duplicado.
- Bot segue funcionando nos fluxos principais.
- Nenhuma migration ou mudanca de dependencia.

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
