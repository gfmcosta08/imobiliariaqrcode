# Prontidao Para Producao - Stripe, Free, Starter E Cortesia - 2026-06-03

## Escopo

Auditoria e preparacao tecnica para permitir futura promocao do pacote Free + Starter + Cortesia para producao.

Nenhum deploy de producao foi executado. Nenhuma variavel de producao foi criada, alterada ou removida. Nenhum recurso live da Stripe foi criado nesta etapa.

## Referencias Oficiais Consultadas

- Stripe Go-live checklist: https://docs.stripe.com/get-started/checklist/go-live
- Stripe Billing/subscriptions: https://docs.stripe.com/billing/subscriptions/designing-integration
- Stripe Customer Portal: https://docs.stripe.com/customer-management/integrate-customer-portal
- Supabase Production Checklist: https://supabase.com/docs/guides/platform/going-into-prod/
- Supabase deployment/branching: https://supabase.com/docs/guides/deployment

## Estado Do Codigo Preparado

O codigo foi ajustado na branch `codex/homologacao-segura` para ficar apto a producao sem liberar cobranca por acidente:

- Preview/staging exige `STRIPE_SECRET_KEY` com prefixo `sk_test_`.
- Production exige `STRIPE_SECRET_KEY` com prefixo `sk_live_`.
- `STRIPE_PRICE_STARTER` passa a ser obrigatorio para o Starter; fallback legado `STRIPE_PRICE_SOLO` foi removido do codigo ativo.
- Checkout, Customer Portal e webhook Stripe deixaram de ter bloqueio fixo por `VERCEL_ENV=production`.
- Em producao, `NEXT_PUBLIC_APP_URL` passa a ser obrigatorio para evitar redirects para staging.
- O admin de assinaturas passou a reconhecer `free`, `starter`, `starter_active`, `past_due`, `canceled` e `expired`.
- Fluxos de criacao de imovel e importacao reconhecem `starter_active` como plano ativo.
- Trial/free nao sobrescreve conta `starter_active`.
- Convites/cortesias continuam preservados via plano `free`, override de limite e validade configuravel.

## Arquivos Principais Alterados

- `apps/web/src/lib/stripe-guard.ts`
- `apps/web/src/lib/stripe.ts`
- `apps/web/src/app/api/stripe/create-checkout/route.ts`
- `apps/web/src/app/api/stripe/customer-portal/route.ts`
- `apps/web/src/app/api/webhooks/stripe/route.ts`
- `apps/web/src/app/plans/page.tsx`
- `apps/web/src/app/plans/checkout-button.tsx`
- `apps/web/src/app/admin/subscriptions-manager.tsx`
- `apps/web/src/app/api/admin/subscriptions/[accountId]/route.ts`
- `apps/web/src/app/properties/actions.ts`
- `apps/web/src/app/api/properties/quick-create/route.ts`
- `apps/web/src/lib/property-import/resolve-broker.ts`
- `apps/web/src/app/api/trial/start/route.ts`
- `apps/web/src/lib/plans.ts`
- `apps/web/src/lib/plans-stripe.guard.test.ts`
- `apps/web/src/guardrails/plans-public.contract.test.ts`

## Verificacoes Executadas

### Testes e build

- `pnpm --filter web exec vitest run src/lib/plans-stripe.guard.test.ts src/guardrails/plans-public.contract.test.ts`
  - Resultado: 2 arquivos, 10 testes aprovados.
- `pnpm --filter web run typecheck`
  - Resultado: aprovado.
- `pnpm test`
  - Resultado: aprovado.
  - Web: 17 arquivos, 101 testes aprovados.
  - Property importer: 7 arquivos, 47 testes aprovados.
  - Staging safety: 6 testes aprovados.
  - Staging commercial safety: 5 testes aprovados.
- `pnpm build`
  - Resultado: aprovado, Next.js compilou e gerou 47 rotas.
- `git diff --check`
  - Resultado: aprovado; apenas avisos normais de CRLF do Windows.

### Varredura de codigo ativo

Comando buscou strings legadas em codigo ativo, excluindo testes/guardrails:

- `checkout_not_enabled_in_production`
- `portal_not_enabled_in_production`
- `webhook_disabled_in_production`
- `STRIPE_PRICE_SOLO`
- `Checkout Stripe de teste`

Resultado: nenhuma string bloqueante legada encontrada no codigo ativo.

### Migrations

- Total encontrado: 52 migrations.
- Sem nomes duplicados.
- Ultimas migrations relevantes:
  - `20260602131511_add_legal_acceptance_to_profiles.sql`
  - `20260602150000_immutable_legal_acceptance_history.sql`
  - `20260602203204_free_starter_courtesy.sql`
  - `20260602203511_admin_update_courtesy_atomic.sql`
  - `20260602204050_checkout_legal_acceptance_events.sql`

## Auditoria Vercel

Projeto Vercel vinculado:

- Project: `farollimoveis`
- Project ID: `prj_0B0SlXaOYwuXAvLiMASCBsdPevaI`

### Preview / Staging

Variaveis Stripe de teste existem no Preview da branch `codex/homologacao-segura`:

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_STARTER`
- `STRIPE_WEBHOOK_SECRET`

Tambem existem variaveis Supabase/URL de Preview apontando para o ambiente de homologacao.

### Production

`vercel env ls production` lista variaveis Supabase e URLs de producao:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`
- `CRON_SECRET`

Porem, `vercel env pull --environment=production` nao retornou Supabase/APP_URL no arquivo temporario, somente `NEXT_PUBLIC_SITE_URL` e `CRON_SECRET`. Por seguranca, tratar como pendencia de validacao manual antes do deploy.

Variaveis Stripe live NAO estao configuradas em Production:

- `STRIPE_SECRET_KEY` ausente.
- `STRIPE_PRICE_STARTER` ausente.
- `STRIPE_WEBHOOK_SECRET` ausente.

## Auditoria GitHub Actions

- Deploy de Edge Functions e manual via `workflow_dispatch`.
- Workflow exige `target_environment`.
- Para production, exige texto `DEPLOY_PRODUCTION`.
- Usa GitHub Environment selecionado.
- Executa typecheck e `pnpm test` antes de deploy das Edge Functions.
- Nao foi possivel auditar secrets/vars do GitHub Environment por ausencia de `gh` CLI e de ferramenta MCP especifica para environments.

## Bloqueadores Antes De Producao

### P0 - Obrigatorio

1. Configurar Stripe live em producao na Vercel:
   - `STRIPE_SECRET_KEY=sk_live_...`
   - `STRIPE_PRICE_STARTER=price_...` live do plano Starter R$ 150/mes
   - `STRIPE_WEBHOOK_SECRET=whsec_...` live do webhook de producao
2. Criar/verificar produto e preco live na Stripe:
   - Produto: Starter
   - Valor: R$ 150,00
   - Recorrencia: mensal
   - Price ID live distinto do price de teste
3. Criar webhook live Stripe apontando para:
   - `https://<dominio-producao>/api/webhooks/stripe`
   - Eventos minimos: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Validar que `NEXT_PUBLIC_APP_URL` em producao aponta para o dominio real de producao, nao staging.
5. Validar que Supabase Production realmente aponta para o projeto de producao esperado antes de qualquer migration/deploy.
6. Fazer backup/checkpoint do banco de producao antes de aplicar migrations.
7. Aplicar migrations primeiro com checklist e rollback aprovado, nunca automaticamente.
8. Confirmar preservacao de usuarios/cortesias existentes antes da ativacao de cobranca.
9. Registrar aprovacao humana explicita antes do deploy.

### P1 - Recomendado Antes Do Deploy

1. Rodar Supabase Security Advisor e Performance Advisor no projeto de producao.
2. Confirmar RLS em tabelas publicas e policies de Storage.
3. Confirmar SSL Enforcement, backups/PITR conforme criticidade, MFA da conta e SMTP proprio.
4. Verificar GitHub Environment `production`:
   - `SUPABASE_ENVIRONMENT_NAME=production`
   - `SUPABASE_PROJECT_ID=<ref-producao>`
   - `SUPABASE_ACCESS_TOKEN` presente
5. Resolver `pnpm format:check`, que falha atualmente em muitos arquivos preexistentes. `pnpm test`, `typecheck` e `build` passam, mas CI com Prettier pode bloquear merge.
6. Criar e-mails dedicados de suporte, privacidade e juridico em vez de usar Gmail pessoal.

### P2 - Pode Ficar Para Depois, Desde Que Documentado

1. Bot WhatsApp em producao com instancia separada e plano de teste E2E. Hoje segue pendente por falta de numero de teste.
2. Monitoramento pos-deploy detalhado com alertas de Stripe/webhook/assinaturas.
3. Teste de carga leve em staging.

## Conclusao

O codigo esta mais proximo de producao: passou a permitir cobranca somente quando Production estiver configurado com Stripe live e continua bloqueando uso de chave live em staging.

Ainda nao esta liberado para deploy porque faltam configuracoes live de Stripe, validacao forte das variaveis de producao da Vercel/Supabase, backup/migration checklist e aprovacao humana.

Status final: preparado em branch, nao promovido para producao.
