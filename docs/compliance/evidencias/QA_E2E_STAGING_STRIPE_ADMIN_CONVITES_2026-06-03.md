# QA E2E — Staging Stripe, Admin, Convites e Compliance

**Data/hora (BRT):** 2026-06-03 ~13:40–14:00
**Executor:** Agente QA (Playwright + validações técnicas)
**Ambiente testado:** homologação / preview (não produção)

---

## 1. Confirmações de ambiente (regra absoluta)

| Verificação        | Resultado           | Evidência                                                                                                                                      |
| ------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| URL de teste       | **OK**              | `https://farollimoveis-staging.vercel.app` — hostname contém `staging`; testes abortam se URL contiver `production`, `prod` ou `imoveisqr.com` |
| Produção intocável | **OK**              | Nenhum `vercel deploy --prod`, nenhuma alteração de env de produção, nenhum push forçado                                                       |
| Supabase staging   | **OK (referência)** | Projeto documentado: `coeuoyeydqoslhvbbojx` — consultas diretas ao banco não executadas nesta rodada (MCP Supabase não autenticado)            |
| Stripe modo teste  | **OK**              | Checkout abriu em **Stripe Sandbox** (`Subscribe to ImobQR Starter (teste)`, R$150/mês)                                                        |
| Sem `sk_live_`     | **OK**              | Guard em `stripe-guard.ts` na branch `codex/homologacao-segura` exige `sk_test_` fora de produção; páginas públicas sem chaves na UI           |
| Deploy produção    | **Não executado**   | Apenas testes contra alias staging existente                                                                                                   |

---

## 2. Código / branch

| Item                                     | Valor                                                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Deploy exercitado                        | Alias Vercel staging (build alinhado à branch `codex/homologacao-segura`)                                      |
| Commit homologação (worktree)            | `2499880` — `feat(stripe): prepara billing live com guardrails`                                                |
| Workspace local no momento do QA         | `main` @ `a75cbc6` (atrás da homologação em Stripe/webhooks/legais)                                            |
| Correção aplicada (worktree homologação) | `complete-profile`: trata erro de `signInWithPassword` após salvar perfil (ainda **não redeployada** no alias) |

---

## 3. Usuários de teste criados (dados fictícios)

Última execução completa da suíte `staging-qa-compliance-e2e` (runId `20260603165246`):

| Papel                         | E-mail                                | Senha (padrão QA)                                           |
| ----------------------------- | ------------------------------------- | ----------------------------------------------------------- |
| Free (cadastro comum)         | `free.qa.20260603165246@teste.com`    | `TesteQA123!5246`                                           |
| Convidado cortesia            | `convite.qa.20260603165246@teste.com` | `TesteQA123!5246`                                           |
| Admin (pré-existente staging) | `farollapi@gmail.com`                 | _(credencial de staging — não reproduzida neste relatório)_ |

Execução `staging-full-flow` (runId distinto) criou adicionalmente corretor `corretor.qa.<runId>@teste.com` e imóveis `QA Convite` / `QA Manual`.

---

## 4. Fluxos testados e resultado

### 4.1 Aprovados (evidência Playwright + screenshots)

| #   | Fluxo                                                                       | Spec / nota                              |
| --- | --------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | Home, planos, termos, privacidade, cancelamento, remoção de conteúdo, login | `staging-qa-compliance-e2e` teste 00     |
| 2   | Responsividade básica mobile (home)                                         | teste 00 + `homepage-mobile.spec.ts`     |
| 3   | Cadastro Free com aceite legal obrigatório                                  | teste 01                                 |
| 4   | Dashboard pós-cadastro (plano Free)                                         | teste 01                                 |
| 5   | Admin: painel, convite cortesia, edição limite/validade                     | teste 02 (+ `reload` após gerar convite) |
| 6   | Convite → onboarding perfil (termos) → listing                              | teste 03                                 |
| 7   | Checkout Starter bloqueado sem aceite legal                                 | teste 04                                 |
| 8   | Homepage busca/filtros                                                      | `staging-full-flow` 01                   |
| 9   | Admin convite + validação localização obrigatória                           | `staging-full-flow` 02–03                |
| 10  | Convidado publica imóvel, 2º imóvel com imagem, QR                          | `staging-full-flow` 04–05                |
| 11  | `/q/[token]`, página pública, busca home, admin encontra anúncio            | `staging-full-flow` 06                   |
| 12  | Rotas protegidas → login; API import 401; health sem stack                  | `staging-security-smoke` (4/4)           |

### 4.2 Parcial / não automatizado nesta rodada

| Fluxo                                               | Status                        | Motivo                                                                                                 |
| --------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| Limite 1 anúncio ativo (Free) — bloqueio ao exceder | **Não verificado E2E**        | Falta cenário dedicado na suíte compliance                                                             |
| Lead em `/q/[token]` → painel                       | **Não verificado E2E**        | Não há passo de submissão de lead na suíte atual                                                       |
| Reduzir limite convite e comportamento excedentes   | **Não verificado**            | Edição de convite OK; cenário de imóveis excedentes não exercitado                                     |
| Validade expirada / cancelar convite                | **Não verificado**            | Botão cancelar existe no código; não executado                                                         |
| Stripe checkout completo → `starter_active`         | **Falhou automação**          | Chegou ao Stripe Sandbox; preenchimento do iframe / retorno `/dashboard` excedeu timeout (90s)         |
| Customer Portal + cancelamento assinatura           | **Não executado**             | Depende de assinatura ativa                                                                            |
| Webhooks: `webhook_events`, idempotência, reenvio   | **Não verificado em runtime** | Validado por contrato na branch homologação (`vitest`); não reenviado no Stripe Dashboard nesta sessão |
| `past_due` / cartão recusado                        | **Não executado**             | Requer evento Stripe manual                                                                            |
| Logout / reset senha / perfil                       | **Não executado**             | Regressão parcial                                                                                      |

### 4.3 Falha de automação (não conclusiva de bug de produto)

- **Teste 05** (`E2E_STRIPE_CHECKOUT=1`): navegação até `checkout.stripe.com` OK; pagamento com cartão `4242…` não concluído dentro do timeout — snapshot mostra formulário Stripe Sandbox ainda aberto.

---

## 5. Bugs encontrados

| ID  | Severidade | Descrição                                                                                                          | Status                                                         |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| B1  | Média      | Teste E2E convite: lista de convites não atualiza sem `page.reload()` após gerar                                   | **Corrigido no spec** (`staging-qa-compliance-e2e.spec.ts`)    |
| B2  | Baixa      | Teste cadastro: `getByRole('alert')` colidia com route announcer                                                   | **Corrigido no spec** (`p[role="alert"]`)                      |
| B3  | Baixa      | Onboarding E2E: checkbox genérico em vez de `#onboarding-terms`                                                    | **Corrigido no spec**                                          |
| B4  | Média      | `main` local: webhook Stripe sem `webhook_events` / `starter_active` — testes `webhook-idempotency.test.ts` falham | **Pendente merge** de `codex/homologacao-segura` → `main`      |
| B5  | Média      | Automação Stripe Checkout: iframe do cartão não preenchido de forma confiável                                      | **Pendente** (melhorar spec ou teste manual)                   |
| B6  | Baixa      | `complete-profile`: não exibia erro se `signInWithPassword` falhasse após API OK                                   | **Corrigido no worktree** homologação (aguarda deploy staging) |

---

## 6. Evidências / screenshots

Diretório principal (última rodada completa compliance):

`apps/web/qa-output/e2e-screenshots/20260603165246/`

Arquivos relevantes:

- `public-_.png`, `public-_plans.png`, `public-_termos.png`, `public-_privacidade.png`
- `public-_cancelamento-reembolso.png`, `public-_remocao-de-conteudo.png`, `public-home-mobile.png`
- `signup-sem-aceite.png`, `dashboard-free-pos-cadastro.png`
- `admin-convite-editado.png`, `onboarding-listing.png`, `checkout-sem-aceite.png`

Falhas Playwright (vídeo/trace):

- `apps/web/test-results/staging-qa-compliance-e2e--04786-pe-checkout-teste-opcional--desktop/`

---

## 7. Resultado dos comandos técnicos

| Comando                           | Branch/contexto                     | Resultado                                                                                         |
| --------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm --filter web run typecheck` | `main` workspace                    | **PASS**                                                                                          |
| `pnpm test`                       | `main`                              | **FAIL** — 2 testes em `webhook-idempotency.test.ts` (código webhook legado solo/pro)             |
| `pnpm --filter web run test`      | `codex/homologacao-segura` worktree | **PASS** — 101 testes                                                                             |
| `pnpm --filter web run build`     | `main`                              | **PASS**                                                                                          |
| `git diff --check`                | `main`                              | **PASS**                                                                                          |
| `pnpm format:check`               | raiz                                | **FAIL** — 304 arquivos (incl. worktrees `.claude/`); **risco separado**, sem formatação em massa |

### Playwright (staging)

| Suíte                                                           | Resultado                    |
| --------------------------------------------------------------- | ---------------------------- |
| `staging-security-smoke.spec.ts`                                | 4/4                          |
| `staging-qa-compliance-e2e.spec.ts` (sem Stripe)                | 5/5                          |
| `staging-qa-compliance-e2e.spec.ts` (+ `E2E_STRIPE_CHECKOUT=1`) | 5/6 (Stripe opcional falhou) |
| `staging-full-flow.spec.ts`                                     | 6/6                          |
| `homepage-mobile.spec.ts`                                       | 1/1                          |

**Total automatizado nesta sessão:** 16 pass / 1 fail (Stripe opcional).

---

## 8. Segurança e compliance (observado)

- Páginas legais acessíveis antes da compra; links no `/plans`.
- Aceite legal obrigatório no cadastro Free e no onboarding de convite (staging).
- Checkout exige aceite antes de redirecionar ao Stripe (mensagem visível).
- Preço Starter R$ 150/mês e renovação descritos na página de planos.
- API `/api/health?deep=1` sem vazamento de stack/senha (smoke).
- Nenhuma chave Stripe na interface pública observada.

---

## 9. Confirmação: produção não foi tocada

- Nenhum deploy `--prod`.
- Nenhuma variável de ambiente de produção alterada.
- Todos os testes direcionados a `farollimoveis-staging.vercel.app`.
- Stripe observado apenas em modo Sandbox.

---

## 10. Veredito final

### **Aprovado com ressalvas**

Homologação está **utilizável** para fluxos core (público, cadastro legal, convite, imóveis, QR, admin convites, gate legal do Starter). **Não** está pronta para promoção a produção sem:

1. Concluir **checkout Stripe E2E** (manual ou automação iframe) e validar `starter_active` + webhooks em `webhook_events` no Supabase staging.
2. Testar **Customer Portal**, cancelamento e estados `canceled` / `past_due`.
3. Cobrir **limite Free**, **leads** e **convite expirado/cancelado**.
4. Alinhar **`main`** com `codex/homologacao-segura` (webhooks Starter + idempotência).
5. Redeploy staging com fix de onboarding (`signIn` error) se reproduzir falha intermitente pós-perfil.
6. Resolver ou aceitar **format:check** como débito separado.

### Bloqueadores explícitos para produção

- [ ] Prova de assinatura Starter ponta a ponta (checkout teste → dashboard → status DB).
- [ ] Prova de webhook idempotente (`invoice.payment_succeeded`, `payment_failed`, `subscription.deleted`).
- [ ] Portal do cliente e cancelamento em staging.
- [ ] Matriz E2E de leads + limite de anúncios Free/cortesia.
- [ ] Merge homologação → main + CI verde (`pnpm test` na branch de release).
- [ ] Migration/legal DB em produção **somente** após homologação completa (sem copiar dados de staging).

---

## 11. URLs visitadas (amostra)

- https://farollimoveis-staging.vercel.app/
- https://farollimoveis-staging.vercel.app/plans
- https://farollimoveis-staging.vercel.app/termos
- https://farollimoveis-staging.vercel.app/privacidade
- https://farollimoveis-staging.vercel.app/cancelamento-reembolso
- https://farollimoveis-staging.vercel.app/remocao-de-conteudo
- https://farollimoveis-staging.vercel.app/login
- https://farollimoveis-staging.vercel.app/admin
- https://farollimoveis-staging.vercel.app/convite
- https://farollimoveis-staging.vercel.app/onboarding/complete-profile
- https://farollimoveis-staging.vercel.app/onboarding/complete-listing
- https://checkout.stripe.com/ (Sandbox — teste 05)

---

_Relatório gerado com base em execução real de Playwright e comandos locais; itens não executados estão marcados explicitamente._
