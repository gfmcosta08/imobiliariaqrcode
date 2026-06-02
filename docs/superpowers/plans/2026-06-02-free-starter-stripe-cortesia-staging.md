# Free, Starter, Stripe e Cortesia Staging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar Free + Starter, Stripe test mode e edicao transacional de cortesias exclusivamente no ambiente de homologacao.

**Architecture:** O banco centraliza regras criticas em migrations e RPCs transacionais. As rotas Next.js autenticadas chamam essas operacoes e a interface admin apenas coleta os dados e exibe os efeitos. Stripe usa Billing APIs, Checkout Sessions e Customer Portal somente com chaves de teste; scripts de guardrail interrompem qualquer operacao que nao aponte para staging.

**Tech Stack:** Next.js 15, TypeScript, Supabase/Postgres, Vitest, Playwright, Stripe Billing, Vercel Preview.

---

## Escopo e Arquivos

- Criar `scripts/lib/staging-commercial-safety.mjs`: valida staging antes de migration, Stripe ou deploy.
- Criar `scripts/lib/staging-commercial-safety.test.mjs`: contrato dos guardrails comerciais.
- Criar `supabase/migrations/20260602*_free_starter_courtesy.sql`: catalogo, auditoria e RPC transacional.
- Criar `supabase/rollback/20260602*_free_starter_courtesy.rollback.sql`: rollback documentado para staging.
- Criar `scripts/qa/courtesy-admin-transaction.sql`: QA transacional com rollback.
- Modificar `apps/web/src/app/api/admin/invitations/route.ts`: gravar override na criacao e expor `PATCH`.
- Modificar `apps/web/src/app/admin/pending-invitations-list.tsx`: editar limite e validade apos geracao.
- Modificar `apps/web/src/app/admin/page.tsx`: carregar identificadores necessarios.
- Criar `apps/web/src/lib/plans.ts`: constantes Free + Starter.
- Criar `apps/web/src/lib/stripe-guard.ts`: rejeitar chaves live fora de producao.
- Modificar `apps/web/src/lib/stripe.ts`: usar somente Price Starter.
- Modificar `apps/web/src/app/api/stripe/create-checkout/route.ts`: Checkout Session recorrente.
- Criar `apps/web/src/app/api/stripe/customer-portal/route.ts`: portal de cancelamento.
- Modificar `apps/web/src/app/api/webhooks/stripe/route.ts`: idempotencia e sincronizacao Starter.
- Modificar `apps/web/src/app/plans/page.tsx` e `checkout-button.tsx`: cards e aceite pre-checkout.
- Modificar `apps/web/src/app/api/auth/signup/route.ts`: falhar se o aceite juridico nao persistir.
- Criar testes Vitest e Playwright focados nos requisitos.
- Atualizar `docs/HOMOLOGACAO_SEGURA.md` e registrar evidencias no Obsidian.

## Task 1: Guardrail Comercial de Staging

**Files:**
- Create: `scripts/lib/staging-commercial-safety.mjs`
- Create: `scripts/lib/staging-commercial-safety.test.mjs`
- Create: `scripts/check-staging-commercial-safety.mjs`
- Modify: `package.json`

- [ ] **Step 1: Escrever testes que falham**

Cobrir: Supabase permitido `coeuoyeydqoslhvbbojx`, host permitido `farollimoveis-staging.vercel.app`, rejeicao do ref de producao, rejeicao de `sk_live_`, exigencia de `sk_test_` para Stripe e bloqueio de deploy production.

- [ ] **Step 2: Confirmar RED**

Run: `node --test scripts/lib/staging-commercial-safety.test.mjs`

Expected: FAIL porque o modulo ainda nao existe.

- [ ] **Step 3: Implementar validacao minima**

Exportar `assertCommercialStagingSafety(env, options)` que valide:

```js
const STAGING_REF = "coeuoyeydqoslhvbbojx";
const STAGING_HOST = "farollimoveis-staging.vercel.app";
if (options.operation === "deploy" && options.target !== "preview") throw new Error("production deploy forbidden");
if (options.operation === "stripe" && !env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Stripe test key required");
```

- [ ] **Step 4: Confirmar GREEN e integrar comando**

Run: `node --test scripts/lib/staging-commercial-safety.test.mjs`

Expected: PASS.

Adicionar `test:staging-commercial-safety` ao `package.json`.

- [ ] **Step 5: Commit**

```powershell
git add package.json scripts/lib/staging-commercial-safety.mjs scripts/lib/staging-commercial-safety.test.mjs scripts/check-staging-commercial-safety.mjs
git commit -m "feat(staging): bloqueia operacoes comerciais fora da homologacao"
```

## Task 2: Migration Segura Free + Starter

**Files:**
- Create: `supabase/migrations/<timestamp>_free_starter_courtesy.sql`
- Create: `supabase/rollback/<timestamp>_free_starter_courtesy.rollback.sql`
- Create: `scripts/qa/free-starter-catalog-rollback.sql`

- [ ] **Step 1: Escrever QA SQL transacional**

O script deve iniciar com `begin;`, validar Free com 30 dias e 1 anuncio, validar Starter com limite ilimitado, validar existencia das colunas novas e terminar com `rollback;`.

- [ ] **Step 2: Confirmar RED no staging**

Executar somente apos `pnpm test:staging-commercial-safety` com URL staging.

Expected: FAIL porque `starter` e `property_limit_override` ainda nao existem.

- [ ] **Step 3: Criar migration sem exclusao destrutiva**

Adicionar `starter`, manter planos legados durante homologacao, atualizar exibicao publica para Free + Starter e adicionar:

```sql
alter table public.subscriptions add column if not exists property_limit_override integer;
alter table public.broker_invitations add column if not exists courtesy_expires_at timestamptz;
```

Criar constraints positivas e rollback que remova apenas artefatos novos depois de verificar dependencias.

- [ ] **Step 4: Aplicar somente no Supabase staging**

Antes da aplicacao: gerar snapshot verificavel do schema e dados afetados no Obsidian.

Run: aplicar a migration com conexao confirmada para `coeuoyeydqoslhvbbojx`.

Expected: migration aplicada somente em staging.

- [ ] **Step 5: Confirmar GREEN**

Run: executar `scripts/qa/free-starter-catalog-rollback.sql`.

Expected: PASS com rollback.

- [ ] **Step 6: Commit**

```powershell
git add supabase/migrations supabase/rollback scripts/qa/free-starter-catalog-rollback.sql
git commit -m "feat(db): adiciona catalogo free starter em staging"
```

## Task 3: RPC Transacional de Edicao da Cortesia

**Files:**
- Modify: `supabase/migrations/<timestamp>_free_starter_courtesy.sql`
- Create: `scripts/qa/courtesy-admin-transaction.sql`

- [ ] **Step 1: Escrever QA SQL que falha**

Criar dados ficticios em transacao e provar:

- aumento de limite;
- reducao preservando imoveis mais recentes;
- arquivamento de antigos excedentes;
- desativacao de QR Codes;
- validade vencida arquiva todos;
- auditoria identifica admin e imoveis afetados;
- rollback remove os dados ficticios.

- [ ] **Step 2: Confirmar RED**

Run: executar o QA no staging.

Expected: FAIL porque `admin_update_courtesy` ainda nao existe.

- [ ] **Step 3: Implementar tabela e RPC**

Criar `public.courtesy_admin_audit_events` com RLS habilitada, revogar acesso de `anon` e `authenticated` e nao criar policies publicas. Criar `public.admin_update_courtesy(...)` como `security definer`, validar admin via `auth.uid()`, bloquear limite menor que 1, atualizar convite e assinatura, arquivar antigos excedentes ordenando por `created_at desc`, desativar QR Codes e gravar auditoria. Revogar execute de `public` e `anon`; conceder execute somente a `authenticated` e `service_role`.

- [ ] **Step 4: Confirmar GREEN**

Run: executar `scripts/qa/courtesy-admin-transaction.sql`.

Expected: PASS com rollback.

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations scripts/qa/courtesy-admin-transaction.sql
git commit -m "feat(db): edita cortesias de forma atomica"
```

## Task 4: API e Tela Admin Para Editar Cortesia

**Files:**
- Modify: `apps/web/src/app/api/admin/invitations/route.ts`
- Modify: `apps/web/src/app/admin/pending-invitations-list.tsx`
- Modify: `apps/web/src/app/admin/page.tsx`
- Create: `apps/web/src/guardrails/courtesy-admin.contract.test.ts`

- [ ] **Step 1: Escrever teste de contrato que falha**

Validar que a rota exporta `PATCH`, chama `admin_update_courtesy`, aceita `property_count` e `expires_at`, e que a UI possui controles `admin-invitation-edit`, `admin-invitation-property-count`, `admin-invitation-expires-at`.

- [ ] **Step 2: Confirmar RED**

Run: `pnpm --filter web exec vitest run src/guardrails/courtesy-admin.contract.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implementar API**

Adicionar `PATCH` autenticado por `getAdminContext()`, validar UUID, inteiro positivo e data ISO, então chamar:

```ts
supabase.rpc("admin_update_courtesy", {
  p_invitation_id: invitationId,
  p_property_limit: propertyCount,
  p_expires_at: expiresAt,
  p_reason: reason,
});
```

- [ ] **Step 4: Implementar UI**

Adicionar formulario por convite, confirmacao antes de salvar e mensagem clara de quantos imoveis foram arquivados.

- [ ] **Step 5: Confirmar GREEN**

Run: `pnpm --filter web exec vitest run src/guardrails/courtesy-admin.contract.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/app/api/admin/invitations/route.ts apps/web/src/app/admin/pending-invitations-list.tsx apps/web/src/app/admin/page.tsx apps/web/src/guardrails/courtesy-admin.contract.test.ts
git commit -m "feat(admin): permite editar cortesias apos ativacao"
```

## Task 5: Persistencia Obrigatoria Dos Aceites Legais

**Files:**
- Modify: `apps/web/src/app/api/auth/signup/route.ts`
- Modify: `apps/web/src/app/api/stripe/create-checkout/route.ts`
- Create: `apps/web/src/guardrails/legal-persistence.contract.test.ts`

- [ ] **Step 1: Escrever teste que falha**

Validar que signup e checkout verificam explicitamente o erro da persistencia juridica e retornam falha quando a evidencia nao puder ser salva.

- [ ] **Step 2: Confirmar RED**

Run: `pnpm --filter web exec vitest run src/guardrails/legal-persistence.contract.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implementar falha fechada**

No signup, atualizar as colunas versionadas de `profiles` e verificar `error`. No checkout, inserir evidencia versionada e verificar `error`. Retornar `legal_acceptance_persist_failed` sem criar Checkout Session quando houver falha.

- [ ] **Step 4: Confirmar GREEN e regressao juridica**

Run: `pnpm --filter web exec vitest run src/guardrails/legal-persistence.contract.test.ts src/guardrails/legal-acceptance.contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/app/api/auth/signup/route.ts apps/web/src/app/api/stripe/create-checkout/route.ts apps/web/src/guardrails/legal-persistence.contract.test.ts
git commit -m "fix(compliance): interrompe fluxo se aceite legal nao persistir"
```

## Task 6: Stripe Starter Somente Em Test Mode

**Files:**
- Create: `apps/web/src/lib/plans.ts`
- Create: `apps/web/src/lib/stripe-guard.ts`
- Modify: `apps/web/src/lib/stripe.ts`
- Modify: `apps/web/src/app/api/stripe/create-checkout/route.ts`
- Create: `apps/web/src/app/api/stripe/customer-portal/route.ts`
- Modify: `apps/web/src/app/api/webhooks/stripe/route.ts`
- Create: `apps/web/src/lib/plans-stripe.guard.test.ts`
- Create: `apps/web/src/app/api/webhooks/stripe/webhook-idempotency.test.ts`
- Create: `apps/web/scripts/stripe-setup-starter-test.mjs`

- [ ] **Step 1: Escrever testes que falham**

Cobrir rejeicao de `sk_live_`, aceite de `sk_test_`, catalogo apenas `free` e `starter`, assinatura do webhook, deduplicacao em `webhook_events`, ativacao somente apos `invoice.payment_succeeded`, `past_due`, cancelamento e portal.

- [ ] **Step 2: Confirmar RED**

Run: `pnpm --filter web exec vitest run src/lib/plans-stripe.guard.test.ts src/app/api/webhooks/stripe/webhook-idempotency.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implementar Stripe Billing**

Usar Checkout Session `mode: "subscription"`, Price Starter, metadata `account_id` e `plan_code`, Customer Portal e webhook idempotente. Rejeitar Stripe live no Preview.

- [ ] **Step 4: Confirmar GREEN**

Run: `pnpm --filter web exec vitest run src/lib/plans-stripe.guard.test.ts src/app/api/webhooks/stripe/webhook-idempotency.test.ts`

Expected: PASS.

- [ ] **Step 5: Configurar Stripe de teste**

Executar `apps/web/scripts/stripe-setup-starter-test.mjs` somente com `sk_test_`. Registrar produto e Price sem expor segredos. Configurar no Vercel Preview: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src apps/web/scripts apps/web/package.json apps/web/.env.example
git commit -m "feat(stripe): adiciona assinatura starter em modo teste"
```

## Task 7: Pagina Publica Free + Starter e Cancelamento

**Files:**
- Modify: `apps/web/src/app/plans/page.tsx`
- Modify: `apps/web/src/app/plans/checkout-button.tsx`
- Create: `apps/web/src/app/cancelamento-e-reembolso/page.tsx`
- Modify: `apps/web/src/app/dashboard/page.tsx`
- Create: `apps/web/src/app/dashboard/manage-subscription-button.tsx`
- Create: `apps/web/src/guardrails/plans-public.contract.test.ts`

- [ ] **Step 1: Escrever teste de contrato que falha**

Validar cards Free + Starter, preco `R$ 150`, renovacao automatica, links legais e botao de portal no dashboard Starter.

- [ ] **Step 2: Confirmar RED**

Run: `pnpm --filter web exec vitest run src/guardrails/plans-public.contract.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implementar interface**

Exibir somente Free e Starter. Manter aviso de Stripe test mode indisponivel quando as variaveis Preview ainda nao estiverem prontas. Exigir resumo e checkboxes antes do checkout.

- [ ] **Step 4: Confirmar GREEN**

Run: `pnpm --filter web exec vitest run src/guardrails/plans-public.contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/app/plans apps/web/src/app/cancelamento-e-reembolso apps/web/src/app/dashboard
git commit -m "feat(plans): publica free e starter com cancelamento simples"
```

## Task 8: Verificacao Local Completa

- [ ] **Step 1: Executar suites**

```powershell
pnpm test
pnpm run typecheck
pnpm --filter web run build
git diff --check
```

Expected: todos exit code `0`.

- [ ] **Step 2: Revisar segredos**

Run: `rg -n "sk_live_|sk_test_|whsec_|service_role" -S apps scripts docs supabase`

Expected: nenhum segredo real versionado.

- [ ] **Step 3: Commit de ajustes finais**

Criar commit somente se a verificacao exigir correcao.

## Task 9: Deploy Exclusivo Em Staging e E2E

- [ ] **Step 1: Executar guardrail**

Run: `pnpm test:staging-commercial-safety`

Expected: PASS apontando para Supabase `coeuoyeydqoslhvbbojx` e host staging.

- [ ] **Step 2: Criar deploy Preview**

Executar deploy Vercel Preview. Nunca usar `--prod`.

- [ ] **Step 3: Promover somente alias staging**

Apontar `farollimoveis-staging.vercel.app` para a nova Preview depois do smoke HTTP.

- [ ] **Step 4: Executar E2E remoto**

Cobrir cadastro, login, Free 30 dias, limite 1, admin gera cortesia, edita antes/depois da ativacao, reduz limite, expira cortesia, uploads, QR Codes, leads, Stripe Checkout test card, webhook, portal e cancelamento.

- [ ] **Step 5: Registrar limitacao do bot**

Confirmar por evidencia que nenhum disparo real ocorreu. Bot permanece pendente por falta de numero dedicado.

## Task 10: Evidencias e Gate Humano

**Files:**
- Modify: `docs/HOMOLOGACAO_SEGURA.md`
- Create: `docs/compliance/RELATORIO_HOMOLOGACAO_FREE_STARTER_STRIPE_CORTESIA_2026-06-02.md`
- Copy: Obsidian `D:\cofre obsidian\obsidian-vault\ImoveisQR Farollimoveis\Compliance`

- [ ] **Step 1: Registrar evidencias**

Documentar migrations aplicadas, rollback, hashes, URLs Preview, comandos, resultados esperados versus obtidos e limitacoes.

- [ ] **Step 2: Criar checklist humano**

Listar verificacoes manuais restantes. Marcar explicitamente: `PRODUCAO NAO AUTORIZADA`.

- [ ] **Step 3: Copiar para Obsidian e validar hashes**

Comparar SHA-256 entre repositorio e Obsidian.

- [ ] **Step 4: Commit**

```powershell
git add docs
git commit -m "docs(staging): registra homologacao free starter stripe e cortesia"
```

- [ ] **Step 5: Interromper antes de producao**

Apresentar relatorio ao usuario e aguardar aprovacao humana separada. Nao fazer deploy em producao automaticamente.
