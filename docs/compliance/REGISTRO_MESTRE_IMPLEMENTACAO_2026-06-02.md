# Registro mestre da implementacao de homologacao segura e compliance

Atualizado em: 2026-06-02

## Objetivo

Este documento registra o pacote completo aplicado na branch `codex/homologacao-segura`, desde a
separacao obrigatoria do staging ate a validacao final das paginas publicas de compliance.

Nenhuma alteracao deste pacote foi aplicada automaticamente em producao.

## Ambientes

| Recurso         | Homologacao                                | Producao               | Estado                                             |
| --------------- | ------------------------------------------ | ---------------------- | -------------------------------------------------- |
| Supabase        | `coeuoyeydqoslhvbbojx`                     | `egeteyzfpkbtkwraizwz` | Bancos separados                                   |
| Vercel          | `https://farollimoveis-staging.vercel.app` | Nao promovido          | Preview validado                                   |
| Bot WhatsApp    | Adiado                                     | Nao alterado           | Bloqueado ate existir numero exclusivo e allowlist |
| Stripe checkout | Desativado                                 | Nao alterado           | Interface mostra `Checkout indisponivel`           |

## Linha do tempo versionada

| Commit    | Data                    | Finalidade                                          |
| --------- | ----------------------- | --------------------------------------------------- |
| `24ea884` | 2026-06-01 17:02 -03:00 | Adiciona homologacao segura e guardrails de staging |
| `209b16a` | 2026-06-01 23:55 -03:00 | Registra credenciais de staging configuradas        |
| `d14a2f9` | 2026-06-02 10:38 -03:00 | Versiona migrations existentes no staging           |
| `6820626` | 2026-06-02 10:38 -03:00 | Registra aceite legal versionado                    |
| `e8e8eda` | 2026-06-02 10:48 -03:00 | Registra evidencias do aceite legal                 |
| `88169e5` | 2026-06-02 11:42 -03:00 | Formaliza protecoes legais em homologacao           |
| `9665133` | 2026-06-02 11:51 -03:00 | Deixa checkout indisponivel explicito               |
| `01c1c7f` | 2026-06-02 15:35 -03:00 | Registra validacao final de staging                 |

## Entregas funcionais

### Homologacao segura

- Guardrails que falham fechado quando o bot de teste nao esta configurado corretamente.
- Banco, alias web e secrets separados para staging.
- Workflow manual para Edge Functions com confirmacao adicional de producao.
- Nenhum deploy automatico de producao.

### Aceite legal

- Checkbox obrigatorio no cadastro comum.
- Checkbox obrigatorio no onboarding por convite.
- Validacao equivalente no backend.
- Registro de versao, data e origem do aceite em `public.profiles`.
- Historico append-only em `public.legal_acceptance_events`.
- RLS habilitado e gatilho que rejeita alteracao ou exclusao do historico.

### Paginas publicas

- `/termos`
- `/privacidade`
- `/remocao-de-conteudo`
- `/cancelamento-e-reembolso`

### Camada comercial

- Checkout online permanece desativado.
- Cartoes Free, Solo e Pro exibem `Checkout indisponivel`.
- Pagina de planos informa preco, periodicidade, renovacao, canal eletronico e links legais.

### Dossie juridico e operacional

- Identificacao empresarial.
- Inventario LGPD.
- Triagem preliminar de marcas no INPI.
- Procedimento de remocao de conteudo e denuncias autorais.
- Revisao de checkout, cancelamento, reembolso e atendimento.
- Plano de resposta a incidentes.
- Roadmap recomendado e ideal para escalar.

## Validacoes registradas

- `pnpm test`: aprovado com `85` testes web, `47` testes do importador e `6` testes de seguranca de
  staging.
- `pnpm run typecheck`: aprovado quando executado isoladamente.
- `pnpm --filter web run build`: aprovado.
- `git diff --check`: aprovado.
- QA transacional do historico append-only: `passed_with_rollback`.
- Rotas `/`, `/plans`, `/termos`, `/privacidade`, `/remocao-de-conteudo`,
  `/cancelamento-e-reembolso` e `/api/health`: HTTP `200` no Preview final.
- Cadastro sem aceite: HTTP `400`.
- Producao: nao utilizada.

## Manifesto completo de arquivos alterados

Intervalo auditado: `a75cbc60b166ca80f0fe09435abe90de55273911..01c1c7f`.

### Configuracao e workflow

- `.github/workflows/deploy-functions.yml`
- `STAGING.md`
- `package.json`
- `scripts/check-staging-safety.mjs`
- `scripts/lib/staging-safety.mjs`
- `scripts/lib/staging-safety.test.mjs`
- `scripts/test-bot-flow.sh`

### Aplicacao web

- `apps/web/src/app/api/auth/signup/route.ts`
- `apps/web/src/app/api/onboarding/complete-profile/route.ts`
- `apps/web/src/app/cancelamento-e-reembolso/page.tsx`
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/onboarding/complete-profile/page.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/plans/checkout-button.tsx`
- `apps/web/src/app/plans/page.tsx`
- `apps/web/src/app/privacidade/page.tsx`
- `apps/web/src/app/remocao-de-conteudo/page.tsx`
- `apps/web/src/app/termos/page.tsx`
- `apps/web/src/guardrails/compliance-public-pages.contract.test.ts`
- `apps/web/src/guardrails/legal-acceptance.contract.test.ts`
- `apps/web/src/guardrails/staging-safety.contract.test.ts`
- `apps/web/src/lib/legal-entity.ts`
- `apps/web/src/lib/legal.ts`

### Edge Functions

- `supabase/functions/conversation-handle/index.ts`
- `supabase/functions/whatsapp-dispatch/index.ts`

### Migrations

- `supabase/migrations/20260505090000_stripe_plans_solo_90_premium.sql`
- `supabase/migrations/20260505100000_trial_30_days_replace_free.sql`
- `supabase/migrations/20260505110000_trial_expiration_safety.sql`
- `supabase/migrations/20260508120000_premium_lead_round_robin.sql`
- `supabase/migrations/20260527000000_courtesy_override_and_active_count.sql`
- `supabase/migrations/20260527010000_subscriptions_plan_code_and_expiration_semantics.sql`
- `supabase/migrations/20260527203000_align_free_plan_expiration_staging.sql`
- `supabase/migrations/20260527215532_ensure_premium_plan.sql`
- `supabase/migrations/20260527230241_pro_premium_properties_no_expiration.sql`
- `supabase/migrations/20260602131511_add_legal_acceptance_to_profiles.sql`
- `supabase/migrations/20260602150000_immutable_legal_acceptance_history.sql`

### QA

- `scripts/qa/legal-acceptance-history-rollback.sql`

### Documentacao

- `docs/HOMOLOGACAO_SEGURA.md`
- `docs/CHECKLIST_COMPLIANCE_LGPD.md`
- `docs/compliance/README.md`
- `docs/compliance/IDENTIFICACAO_EMPRESARIAL.md`
- `docs/compliance/INVENTARIO_LGPD.md`
- `docs/compliance/PESQUISA_PRELIMINAR_INPI_2026-06-02.md`
- `docs/compliance/PLANO_RESPOSTA_INCIDENTES_SEGURANCA.md`
- `docs/compliance/POLITICA_REMOCAO_CONTEUDO_DIREITOS_AUTORAIS.md`
- `docs/compliance/REGISTRO_EXECUCAO_COMPLIANCE_2026-06-02.md`
- `docs/compliance/REGISTRO_MESTRE_IMPLEMENTACAO_2026-06-02.md`
- `docs/compliance/REVISAO_CHECKOUT_CANCELAMENTO_REEMBOLSO.md`
- `docs/compliance/ROADMAP_COMPLIANCE_RECOMENDADO_ESCALA.md`

## Espelho no Obsidian

O cofre deve conter:

- Documentos operacionais na raiz.
- Dossie em `Compliance`.
- Snapshot dos arquivos alterados em `Compliance/Artefatos tecnicos/branch-codex-homologacao-segura`.
- Manifesto SHA-256 do snapshot em
  `Compliance/Artefatos tecnicos/MANIFESTO_SHA256_BRANCH_CODEX_HOMOLOGACAO_SEGURA.csv`.

## Pendencias que nao podem ser resolvidas apenas por codigo

- Revisao juridica dos documentos antes de producao.
- Revisao da natureza `Empresario Individual` e dos CNAEs com contador e advogado empresarial.
- Criacao de e-mails dedicados para suporte, privacidade e juridico.
- Busca profissional de anterioridade e eventual pedido de marca no INPI.
- Numero exclusivo, instancia Uazapi separada e allowlist para homologar o bot.
- Definicao final de prazos de retencao, DPAs e rotina de descarte.

## Atualizacao Posterior - Stripe Starter E2E

A informacao anterior de `Checkout indisponivel` era verdadeira para o pacote inicial de compliance, antes da configuracao Stripe de teste. Em 2026-06-02, o fluxo Starter foi concluido e validado em homologacao:

- Site: `https://farollimoveis-staging.vercel.app`.
- Produto Stripe teste: `ImobQR Starter (teste)`.
- Preco: `price_1TdzMMDLux2wr4a970gsPdll`.
- Webhook ativo correto: `we_1Te27HDLux2wr4a9agbWKKe7`.
- Webhooks antigos de Preview desativados.
- Checkout pago com cartao teste e retorno ao dashboard.
- Banco validado com `plan_code=starter` e `status=starter_active`.
- Stripe Billing Portal validado com link de cancelamento.
- Producao continua nao alterada e bloqueada ate aprovacao humana.

Evidencia principal: `docs/compliance/evidencias/HOMOLOGACAO_FREE_STARTER_CORTESIA_STRIPE_2026-06-02.md`.
