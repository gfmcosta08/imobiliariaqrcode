# Implementation Report - Produto Investivel 10/10

Status: COMPLETE
Production modified: no
Branch: codex/produto-investivel-10-10-staging
Base commit: a75cbc60b166ca80f0fe09435abe90de55273911
Final implementation commit: PR branch head after final staging-maintenance push
Official staging deployment: dpl_8rE2pMur13n3cpERuZs87um7GXhk

## Commands

| Command                                                                                                                                         | Result | Notes                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| pnpm --filter web run test                                                                                                                      | PASS   | 138 testes em 2026-06-06                                                                     |
| pnpm --filter @imobiliariaqrcode/property-importer run test                                                                                     | PASS   | 47 testes                                                                                    |
| pnpm --filter web run typecheck                                                                                                                 | PASS   |                                                                                              |
| pnpm --filter web run lint                                                                                                                      | PASS   |                                                                                              |
| pnpm --filter web run build                                                                                                                     | PASS   | Next.js 15.2.8; inclui rota QA Stripe nao-producao                                           |
| pnpm format:check                                                                                                                               | PASS   | Revalidado em 2026-06-06 apos E2E Stripe payment_failed                                      |
| vercel deploy --yes                                                                                                                             | PASS   | Deployment preview `farollimoveis-db14xtgcs.vercel.app` READY                                |
| vercel alias set farollimoveis-db14xtgcs.vercel.app farollimoveis-staging.vercel.app                                                            | PASS   | Alias fixo oficial de staging atualizado                                                     |
| Invoke-WebRequest https://farollimoveis-staging.vercel.app                                                                                      | PASS   | HTTP 200; home contem promessa central                                                       |
| pnpm --filter web exec playwright test tests/e2e/staging-security-smoke.spec.ts tests/e2e/homepage-mobile.spec.ts --config=playwright.config.ts | PASS   | 6/6 contra URL fixa oficial; uma tentativa anterior teve flake de pagina de erro, rerun PASS |
| curl.exe -X POST https://farollimoveis-staging.vercel.app/api/stripe/create-checkout                                                            | PASS   | HTTP 401 `unauthenticated` antes de validar configuracao Stripe                              |
| Playwright CTA/legal smoke contra https://farollimoveis-staging.vercel.app                                                                      | PASS   | `STAGING_CTA_AND_LEGAL_SMOKE_PASS`                                                           |
| pnpm --filter web exec playwright test tests/e2e/staging-full-flow.spec.ts --config=playwright.config.ts                                        | PASS   | 6/6 com admin QA gerado no Supabase staging e `E2E_STAGING_WRITE=1`                          |
| pnpm --filter web exec playwright test tests/e2e/staging-self-service-flow.spec.ts --config=playwright.config.ts                                | PASS   | 1/1 com `E2E_STAGING_WRITE=1` contra staging fixo oficial                                    |
| pnpm --filter web exec playwright test tests/e2e/staging-stripe-self-service.spec.ts --config=playwright.config.ts                              | PASS   | 1/1; checkout session `cs_test_a1MKjZeMa2Oc8jyIC9ar5PkgOVpOzSd8rlH1fxQoWmD8a4zf0oeCFpO0vg`   |
| pnpm --filter web exec playwright test tests/e2e/staging-stripe-payment-failed.spec.ts --config=playwright.config.ts                            | PASS   | 1/1; `evt_1TfNDIDLux2wr4a9uKoNEzJe` processado e assinatura `past_due`                       |
| pnpm dlx supabase@latest db query --linked ... activation_events                                                                                | PASS   | Migration `20260604090000` aplicada; `activation_events_count=14`                            |
| Validacao cron staging sem bearer e com bearer errado                                                                                           | PASS   | `whatsapp-dispatch` e `bot-health-monitor` retornam 401 `unauthorized`                       |

## Changed Files

Ver `git diff --name-only main` apos commit (lista extensa: seguranca, Stripe Starter, home, onboarding, dashboard, import paste, analytics, guardrails, docs).

## Migrations

- `supabase/migrations/20260604090000_activation_events.sql` (nova, aplicar apenas em Supabase staging)
- Revisada `supabase/migrations/20260602120000_starter_free_legal.sql` (existente no repo)

## Environment

- Branch local: `codex/produto-investivel-10-10-staging`
- Alvo oficial de teste: `https://farollimoveis-staging.vercel.app`
- Deployment preview apontado pelo alias fixo: `https://farollimoveis-2w3m0b5td.vercel.app` (`dpl_8rE2pMur13n3cpERuZs87um7GXhk`)
- Supabase staging: projeto `imobiliariaqrcode-staging` (`coeuoyeydqoslhvbbojx`)
- Sem `vercel --prod`, sem `supabase db push` em producao

## Phase Evidence

### Phase 0

- Branch isolada criada.
- `.gitignore` atualizado para artefatos QA/Playwright.
- Baseline registrado (testes web passando apos correcoes Stripe).

### Phase 1 — Security P0

- `validateCronAuthorization` fail-closed em crons Next.js.
- Lead publico com `parseJsonObjectWithLimit` + whitelist.
- `lead-notify-broker` exige bearer `CRON_SECRET`.
- Evidencia: `docs/compliance/evidencias/SECURITY_P0_STAGING_2026-06-04.md`, `SECRET_HYGIENE_2026-06-04.md`.

### Phase 2 — Stripe Starter

- Checkout `/api/stripe/create-checkout` (modo teste).
- Webhook idempotente em `webhook_events`, ativacao `starter_active` em `invoice.payment_succeeded`.
- Customer portal staging em `/api/stripe/customer-portal`.
- Planos UI: Free + Starter + Pro (checkout apenas Starter).

### Phase 3 — Bot / QR

- `apps/web/src/guardrails/bot-no-regression.test.ts` PASS.
- E2E staging full-flow: PASS 6/6 no alias fixo oficial com admin QA temporario, convite cortesia, onboarding, 2 anuncios, QR publico, homepage e busca admin.
- E2E staging smoke: PASS 6/6 no alias fixo oficial `https://farollimoveis-staging.vercel.app`.
- E2E local homepage: `BLOCKED_EXTERNAL` (servidor `127.0.0.1:3000` nao estava em execucao).

### Phase 4–8 — Produto

- Home reposicionada (QR -> pagina publica -> lead).
- Marca `ImoveisQR` em header/login/QR publico.
- Onboarding `/onboarding/primeiro-qr` + quick-create JSON.
- Dashboard com metricas de oportunidade (`apps/web/src/lib/dashboard/metrics.ts`).
- Leads priorizam status `new`.
- Import: parser `pasted-listing` + `POST /api/properties/import/paste`.
- Activation events (migration + helper + instrumentacao basica).
  - Migration aplicada no Supabase staging e historico remoto reparado como `applied`.

## Stripe Evidence

- Modo: teste (`assertStripeTestModeAllowed`, `sk_test_` obrigatorio fora de producao).
- Checkout Starter sandbox revalidado: `cs_test_a1MKjZeMa2Oc8jyIC9ar5PkgOVpOzSd8rlH1fxQoWmD8a4zf0oeCFpO0vg`.
- Webhooks Stripe sucesso processados em staging:
  - `evt_1TfNCZDLux2wr4a9Y559oi0i` (`checkout.session.completed`, processed).
  - `evt_1TfNCZDLux2wr4a9c27cO6jY` (`invoice.payment_succeeded`, processed).
- Webhook Stripe falha processado em staging:
  - `evt_1TfNDIDLux2wr4a9uKoNEzJe` (`invoice.payment_failed`, processed).
  - Test Clock: `clock_1TfNCzDLux2wr4a9WKWU5GIB`.
  - Subscription: `sub_1TfND0DLux2wr4a9V2OPc5J8`, status local `past_due`.
- Rota QA `/api/qa/stripe/payment-failed` e bloqueada em producao, exige usuario QA e Stripe test mode.

## Bot Evidence

- Guardrails de contrato: inbound → `conversation-handle`, dispatch → `whatsapp_messages`, monitor de silencio, lead RPC preservado.
- Teste: `pnpm --filter web exec vitest run src/guardrails/bot-no-regression.test.ts` PASS.

## QR Flow Evidence

- Codigo: pagina `/q/[token]` com `public_id`; lead publico `upsert_lead_from_qr_event`.
- Quando nao houver link de WhatsApp/bot, `/q/[token]` exibe formulario de interesse e grava via `/api/public/lead`.
- E2E automatizado full-flow em staging: PASS 6/6 com `E2E_STAGING_WRITE=1`; cobre convite admin, corretor convidado, QR, pagina publica, homepage e painel admin.
- Smoke Playwright no staging fixo oficial: PASS 6/6.

## Screenshots / Playwright artifacts

- Home (local): nao gerado — conexao recusada sem dev server.
- Staging suite existente: `apps/web/tests/e2e/staging-full-flow.spec.ts` (atualizado hero QR).
- Staging Stripe payment failed: `apps/web/tests/e2e/staging-stripe-payment-failed.spec.ts`.
- Ultima falha local: `apps/web/test-results/homepage-mobile-*/` (connection refused).

## Rodada Pos-QA 2026-06-04

- BUG-001 corrigido: cadastro Free exige aceite legal na UI (`#signup-terms`) e na API `/api/auth/signup`; metadata registra `legal_terms_accepted`, `legal_privacy_accepted`, `legal_version` e `legal_accepted_at`.
- BUG-002 corrigido: `/api/stripe/create-checkout` autentica antes de validar `STRIPE_SECRET_KEY` / `STRIPE_STARTER_PRICE_ID`; usuario anonimo recebe `401 unauthenticated`.
- BUG-003 mitigado: `/q/[token]` preserva CTA de WhatsApp e exibe formulario de fallback para registrar interesse quando WhatsApp nao abrir.
- BUG-004 corrigido no E2E: onboarding por convite aceita ausencia do antigo `#onboarding-terms` sem quebrar a suite.
- BUG-005 corrigido: admin agora edita convite pendente (`property_count`, `expires_at`) via UI e `PATCH /api/admin/invitations`; aumento de quantidade cria rascunhos adicionais para manter consistencia.
- Home mantem listagens publicas como secao secundaria e envia `Criar meu primeiro QR` para `/teste-gratis`; `Ver como funciona` abre `/como-funciona`.
- Novas paginas publicas: `/teste-gratis` explica conta teste gratuita antes do cadastro; `/como-funciona` explica o fluxo QR -> interessado -> WhatsApp/formulario -> lead no painel com imagens.
- Smoke local Playwright: `CTA_AND_LEGAL_SMOKE_PASS` em `http://127.0.0.1:3000`.
- Smoke staging Playwright: `STAGING_CTA_AND_LEGAL_SMOKE_PASS` em
  `https://farollimoveis-staging.vercel.app`.
- Screenshots locais gerados em `output/playwright/home.png`, `output/playwright/teste-gratis.png`, `output/playwright/como-funciona.png`, `output/playwright/login-signup.png`.
- Verificacao local: `pnpm test` PASS (web 117 + importer 47), `pnpm --filter web run typecheck` PASS, `pnpm --filter web run lint` PASS, `pnpm --filter web run build` PASS, Prettier dos arquivos tocados PASS.

## Rodada QA navegador 2026-06-04

- Deploy staging oficial: `https://farollimoveis-staging.vercel.app` -> `https://farollimoveis-1ign7dh2m.vercel.app` (`dpl_GPCzPNNkkza6EqjX7a8ZWbzba1gZ`, target preview, Ready).
- Rotas legadas corrigidas: `/imovel/:public_id` e `/anuncio/:public_id` agora respondem HTTP `308` para `/imoveis/:public_id`; a rota canonica `/imoveis/:public_id` responde HTTP `200`.
- Checkout Starter endurecido: `/api/stripe/create-checkout` continua retornando `401 unauthenticated` sem sessao e agora aceita `STRIPE_PRICE_STARTER` como alias temporario de `STRIPE_STARTER_PRICE_ID`.
- Bloqueio Stripe restante e externo: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `STRIPE_PRICE_STARTER` ainda aparecem no Vercel apenas como Preview escopado para a branch `codex/homologacao-segura`; para validar checkout real no staging fixo, configurar esses envs no Preview geral ou na branch atual de staging.
- Metricas de ativacao admin corrigidas para fallback operacional: quando `activation_events` estiver vazio/indisponivel, o painel mostra contadores agregados de `profiles`, `properties`, `property_qrcodes`, `leads` e `subscriptions`, sinalizando fonte `metricas_operacionais`.
- Evidencia agregada staging: `activation_events=0`, `broker_profiles=222`, `properties=1060`, `active_qrcodes=1409`, `leads=24`, `paid_subscriptions=28`.
- Verificacao local atualizada: `pnpm --filter web run typecheck` PASS, `pnpm --filter web run lint` PASS, `pnpm --filter web run test` PASS (123), `pnpm --filter web run build` PASS.
- Smoke staging Playwright no alias fixo oficial: `staging-security-smoke.spec.ts` + `homepage-mobile.spec.ts` PASS (6/6).

## Rodada Stripe staging 2026-06-04

- Escopo: somente ambiente de teste/staging (`Preview` da branch `codex/produto-investivel-10-10-staging`), sem deploy de producao.
- Stripe em modo teste confirmado no Dashboard antes de usar chaves (`sk_test_` / `price_` / `whsec_`).
- Vercel Preview configurado para a branch staging com `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER` e `STRIPE_STARTER_PRICE_ID`.
- Price Starter configurado: `price_1TdzMMDLux2wr4a970gsPdll` (`ImobQR Starter (teste)`, BRL 150, recorrencia mensal).
- Webhook Stripe staging recriado para `https://farollimoveis-staging.vercel.app/api/webhooks/stripe`; endpoint anterior do mesmo URL foi desativado para evitar assinatura antiga em paralelo.
- Endpoint ativo: `we_1TegqODLux2wr4a9e8Hickl3`.
- Billing Portal test ajustado para cancelamento imediato (`subscription_cancel.mode=immediately`) para homologar fluxo completo de cancelamento no staging.
- Deploy com envs aplicado e alias fixo atualizado: `https://farollimoveis-staging.vercel.app` -> `https://farollimoveis-9ceztbwsk.vercel.app` (`dpl_6jreq64e9wuoFUmktXXqeUV71sCb`, target preview, Ready).
- Checkout sandbox validado no navegador com cartao `4242`: conta `stripe.qa.20260604192540@maildrop.cc` retornou para `/dashboard?checkout=success` e ficou `starter_active`.
- Webhook de ativacao validado no banco: `checkout.session.completed` e `invoice.payment_succeeded` processados.
- Portal do Cliente validado no navegador: abre `billing.stripe.com` em modo teste, mostra assinatura, invoice paga e cartao `4242`.
- Cancelamento imediato validado com conta `stripe.cancel.qa.20260604193100@maildrop.cc`: evento `customer.subscription.deleted` processado e assinatura marcada como `canceled` com `canceled_at`.
- Arquivos temporarios locais usados para transportar segredos foram removidos ao final da configuracao.

## Rodada normalizacao 2026-06-06

- `pnpm format:check` normalizado e PASS repo-wide.
- `.prettierignore`, `.gitignore` e `.vercelignore` atualizados para excluir `.claude/`, `output/` e artefatos locais de QA/Playwright.
- Preview staging redeployado sem producao:
  - `https://farollimoveis-staging.vercel.app` -> `https://farollimoveis-q2bgpm7pt.vercel.app` (`dpl_GA1DKJJftWWTmi533z4AWJNgyDxc`, Ready) para aplicar `CRON_SECRET`.
  - `https://farollimoveis-staging.vercel.app` -> `https://farollimoveis-dbv23n8dz.vercel.app` (`dpl_J3H2qZSWh1JttLKs2eRhMJFVtb2H`, Ready) para telemetry Stripe sem segredo.
  - `https://farollimoveis-staging.vercel.app` -> `https://farollimoveis-2w3m0b5td.vercel.app` (`dpl_8rE2pMur13n3cpERuZs87um7GXhk`, Ready) para rota QA Stripe `payment_failed`.
- `CRON_SECRET` configurado no Vercel Preview da branch `codex/produto-investivel-10-10-staging` com valor novo de staging. O primeiro valor gerado foi rotacionado imediatamente antes de uso por falha da API RNG do PowerShell local.
- Validacao segura de cron reexecutada em 2026-06-06, sem acionar execucao autorizada:
  - `GET /api/cron/whatsapp-dispatch` sem bearer: `401 {"error":"unauthorized"}`.
  - `GET /api/cron/whatsapp-dispatch` bearer errado: `401 {"error":"unauthorized"}`.
  - `GET /api/cron/bot-health-monitor` sem bearer: `401 {"error":"unauthorized"}`.
  - `GET /api/cron/bot-health-monitor` bearer errado: `401 {"error":"unauthorized"}`.
- Novo E2E write-gated autossuficiente: `apps/web/tests/e2e/staging-self-service-flow.spec.ts`.
  - Cobre signup, primeiro QR, QR publico, lead publico, lista de leads e dashboard.
  - Resultado: PASS 1/1 em `https://farollimoveis-staging.vercel.app`.
- Novo E2E Stripe self-service: `apps/web/tests/e2e/staging-stripe-self-service.spec.ts`.
  - Cobre signup, login explicito, checkout Starter sandbox Stripe e retorno ao dashboard.
  - Resultado: PASS 1/1 em `https://farollimoveis-staging.vercel.app`; revalidado com checkout session `cs_test_a1MKjZeMa2Oc8jyIC9ar5PkgOVpOzSd8rlH1fxQoWmD8a4zf0oeCFpO0vg`.
  - Stripe event IDs reais registrados:
    - `evt_1TfNCZDLux2wr4a9Y559oi0i` (`checkout.session.completed`, processed).
    - `evt_1TfNCZDLux2wr4a9c27cO6jY` (`invoice.payment_succeeded`, processed).
  - Historico anterior tambem registrado:
    - `evt_1TfLKBDLux2wr4a9nn3AjWsk` (`checkout.session.completed`, processed).
    - `evt_1TfLKCDLux2wr4a9lgqJ4IJw` (`invoice.payment_succeeded`, processed).
- Novo E2E Stripe payment_failed: `apps/web/tests/e2e/staging-stripe-payment-failed.spec.ts`.
  - Usa Stripe Test Clock e payment method de falha em Billing para gerar `invoice.payment_failed`.
  - Resultado: PASS 1/1 em `https://farollimoveis-staging.vercel.app`.
  - `STRIPE_TEST_CLOCK_ID=clock_1TfNCzDLux2wr4a9WKWU5GIB`.
  - `STRIPE_FAILED_SUBSCRIPTION_ID=sub_1TfND0DLux2wr4a9V2OPc5J8`.
  - `STRIPE_PAYMENT_FAILED_EVENT_ID=evt_1TfNDIDLux2wr4a9uKoNEzJe`.
  - Supabase staging confirmou `processing_status=processed` e assinatura local `past_due`.
- Full-flow admin/convite revalidado:
  - Resultado: PASS 6/6 em `https://farollimoveis-staging.vercel.app`.
  - Admin QA usado: `admin.fullflow.qa.20260606163252@teste.com` (usuario de teste no Supabase staging).

## Supabase staging

- Project ID: `imobiliariaqrcode-staging` (`coeuoyeydqoslhvbbojx`, sem expor secrets neste relatorio).
- Migration `20260604090000_activation_events.sql` aplicada no Supabase staging via `pnpm dlx supabase@latest db query --linked --file`.
- Historico remoto reparado com `supabase migration repair --linked --status applied 20260604090000`.
- Confirmacao em `supabase_migrations.schema_migrations`: `20260604090000`, nome `activation_events`.
- `activation_events_count=14` em 2026-06-06.
- RLS/policies confirmadas: `activation_events_select_own_account` e `activation_events_service_role_all`.

## Known Limitations

- Sem bloqueios pendentes para o ambiente de teste/staging do plano.
- Observacao de compatibilidade: admin legado ainda aceita `solo` / `solo_active` para operacao manual antiga.

## Assertions

Production was not modified.
No production deploy was executed.
No production secrets were used.
