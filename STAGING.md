# ImoveisQR - Staging Operacional

Data de revisao: 2026-06-09

## URL Canonica

- Staging fixo: `https://farollimoveis-staging.vercel.app`
- Production fixo: `https://imoveisqr.com`
- Projeto Vercel canonico para este workspace: `farollimoveis`
- Root Directory no Vercel: `apps/web`
- Supabase staging: `coeuoyeydqoslhvbbojx`
- Supabase staging URL: `https://coeuoyeydqoslhvbbojx.supabase.co`

## Regra Absoluta

O alias `farollimoveis-staging.vercel.app` deve apontar para um deployment Preview do projeto Vercel `farollimoveis`.

Nao apontar este alias para:

- projeto `imobiliariaqrcode`;
- projeto `web`;
- deployment Production;
- deployment sem build Next.js de `apps/web`;
- qualquer ambiente Supabase diferente de `coeuoyeydqoslhvbbojx`.

## Incidente Corrigido em 2026-06-09

Foi detectado que o alias `farollimoveis-staging.vercel.app` apontava para:

- deployment: `imobiliariaqrcode-8mpq3zkcx.vercel.app`
- project: `imobiliariaqrcode`
- resultado: `/plans` e `/api/health?deep=1` retornavam `NOT_FOUND` via `vercel curl`.

Correcao aplicada:

```powershell
vercel alias set farollimoveis-hmby88qw2.vercel.app farollimoveis-staging.vercel.app
```

Fechamento canonico em 2026-06-09:

- Projeto Vercel duplicado `imobiliariaqrcode` removido.
- Verificacao pos-remocao: `vercel project inspect imobiliariaqrcode` retorna `There is no project for "imobiliariaqrcode"`.
- Aliases restantes relevantes: `farollimoveis-staging.vercel.app` e `imoveisqr.com`, ambos apontando para deployments do projeto canonico `farollimoveis`.

Estado validado:

- alias: `farollimoveis-staging.vercel.app`
- deployment: `farollimoveis-2uai1rmlv.vercel.app`
- deployment id: `dpl_69zKoEoYZwKcpVVJpXXQm9cwQphh`
- `/plans`: contem Starter, contem limite de 10 anuncios, nao contem promessa de ilimitado.
- `/api/health?deep=1`: `{"ok":true,"service":"web","supabase":"ok"}`.

## Atualizacao de Extrator Staging em 2026-06-09

Escopo: apenas Vercel Preview/staging do projeto canonico `farollimoveis`.
Production (`https://imoveisqr.com`) nao foi alterado.

- Env alterada: `PROPERTY_EXTRACTOR_URL`.
- Alvo Vercel: `Preview (codex/produto-investivel-10-10-staging)`.
- Valor configurado: `https://extrator.gfmcosta.net`.
- Deploy Preview gerado: `https://farollimoveis-2uai1rmlv.vercel.app`.
- Deployment id: `dpl_69zKoEoYZwKcpVVJpXXQm9cwQphh`.
- Alias canonico atualizado: `https://farollimoveis-staging.vercel.app` -> `https://farollimoveis-2uai1rmlv.vercel.app`.
- `/api/health?deep=1`: HTTP 200, `supabase:"ok"`.
- `/api/health?deep=2`: HTTP 200, `extrator:"ok"`, `httpStatus:200`, latencia ~433ms.
- `https://extrator.gfmcosta.net/health`: HTTP 200, `service:"extrator-bridge"`.

Regra: Production continua intocado. Qualquer troca de `PROPERTY_EXTRACTOR_URL` em `https://imoveisqr.com` exige decisao propria e nova validacao.

## Deploy Preview Seguro

Nunca usar `vercel --prod` para staging.

```powershell
vercel deploy --yes
vercel alias set <deployment-url>.vercel.app farollimoveis-staging.vercel.app
vercel inspect farollimoveis-staging.vercel.app
```

Depois do alias, validar:

```powershell
vercel curl https://farollimoveis-staging.vercel.app/api/health?deep=1
vercel curl https://farollimoveis-staging.vercel.app/plans
```

## Variaveis Obrigatorias do Staging

No Vercel, target Preview do projeto `farollimoveis`:

| Variavel                                            | Valor esperado                               |
| --------------------------------------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                          | `https://coeuoyeydqoslhvbbojx.supabase.co`   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                     | anon key do projeto Supabase staging         |
| `SUPABASE_SERVICE_ROLE_KEY`                         | service role key do projeto Supabase staging |
| `STAGING_BASE_URL`                                  | `https://farollimoveis-staging.vercel.app`   |
| `CRON_SECRET`                                       | segredo de cron de staging                   |
| `STRIPE_SECRET_KEY`                                 | chave Stripe test mode (`sk_test_...`)       |
| `STRIPE_WEBHOOK_SECRET`                             | webhook secret Stripe test mode              |
| `STRIPE_PRICE_STARTER` ou `STRIPE_STARTER_PRICE_ID` | price id Starter test mode                   |
| `PROPERTY_EXTRACTOR_URL`                            | `https://extrator.gfmcosta.net`              |
| `VERCEL_AUTOMATION_BYPASS_SECRET`                   | secret de Protection Bypass for Automation   |

No GitHub Actions, environment `staging`, os nomes usados pelo workflow sao:

- `STAGING_BASE_URL`
- `STAGING_SUPABASE_PROJECT_REF`
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_ANON_KEY`
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `VERCEL_AUTOMATION_BYPASS_SECRET`
- `E2E_STAGING_WRITE`

O gate de drift de migrations usa a Supabase Management API em modo read-only com
`SUPABASE_ACCESS_TOKEN`; nao exige senha direta do banco.

## GitHub Environments

Obrigatorio antes de producao:

- environment `staging` para o job `Staging readiness gate`;
- environment `production` para o workflow `Production Promotion Gate`;
- `production` deve exigir aprovacao manual;
- branch protection deve exigir os checks:
  - `CI gate`;
  - `Staging readiness gate`;
  - `Production promotion gate` antes de qualquer deploy de producao.

## Deployment Protection

Staging esta protegido por Vercel Authentication. Testes automatizados devem usar Protection Bypass for Automation via header:

```text
x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET
x-vercel-set-bypass-cookie: true
```

O `apps/web/playwright.config.ts` injeta esses headers quando `VERCEL_AUTOMATION_BYPASS_SECRET` existe.

## Bot WhatsApp

O ambiente de teste nao possui bot WhatsApp live ativo. Nao bloquear staging por falta de envio/recebimento real do bot.

Ainda assim, manter:

- functions protegidas por bearer;
- `CRON_SECRET` configurado;
- monitor sem `continue-on-error`;
- runbook indicando que fila parada em staging e informativa quando o bot esta inativo.

## Proibido

- Rodar `vercel --prod` durante QA de staging.
- Usar `sk_live_` em staging.
- Apontar staging para Supabase production.
- Copiar dados de staging para production.
- Salvar `vercel env pull` ou dumps com secrets no repositorio.
- Manter arquivos `.env.vercel-check*` ou `.vercel-deploy-inspect.json` no workspace.
