# Staging CI/CD Gate Audit

Data: 2026-06-09
Produto: ImoveisQR
Ambiente: `https://farollimoveis-staging.vercel.app`
Production modified: no

## Parecer

Etapa 4 avancou de "gates existem, mas sao opcionais" para um modelo mais duro:

- `Staging readiness gate` roda em `pull_request` e `workflow_dispatch`;
- o job usa GitHub environment `staging`;
- o job falha se a URL, Supabase ref ou Supabase URL nao forem exatamente de staging;
- o job exige `VERCEL_AUTOMATION_BYPASS_SECRET`, necessario porque staging esta protegido por Vercel Authentication;
- o workflow de promocao para producao agora existe como `Production Promotion Gate` e usa environment `production`.

A branch foi publicada em PR draft:

- PR: `https://github.com/gfmcosta08/imobiliariaqrcode/pull/2`
- branch: `codex/produto-investivel-10-10-staging`
- ultimo commit local publicado: `0e7d8b8 chore(staging): close readiness gates`

A parte que ainda precisa de evidencia externa e a configuracao real de branch protection/GitHub environments no painel do GitHub. O `gh` local nao esta autenticado nesta maquina. A credencial local do Git conseguiu consultar o repo privado e criar o PR, mas a tentativa de aplicar os gates via API ficou bloqueada:

- `main` branch protection: `403 Forbidden`
- `master` branch protection: `403 Forbidden`
- `staging`/`production` environments: `422 Unprocessable Entity`

## Achado P0 Corrigido

Antes da correcao, o alias canonico de staging apontava para o projeto errado:

```text
farollimoveis-staging.vercel.app -> imobiliariaqrcode-8mpq3zkcx.vercel.app
deployment id: dpl_4crZwSVmic6CqUE5koktre3DSX1h
project: imobiliariaqrcode
```

Evidencia de falha:

- `vercel curl https://farollimoveis-staging.vercel.app/plans`: `NOT_FOUND`.
- `vercel curl https://farollimoveis-staging.vercel.app/api/health?deep=1`: `NOT_FOUND`.

Correcao aplicada:

```powershell
vercel alias set farollimoveis-hmby88qw2.vercel.app farollimoveis-staging.vercel.app
```

Estado depois da correcao:

```text
farollimoveis-staging.vercel.app -> farollimoveis-hmby88qw2.vercel.app
deployment id: dpl_B48QaLCgPEGXuwZVXGLjMunEKf2F
project: farollimoveis
target: preview
status: Ready
```

Validacao pos-correcao:

- `/plans`: contem `Starter`;
- `/plans`: contem limite `Ate 10 anuncios ativos`;
- `/plans`: nao contem radical `ilimitad`;
- `/api/health?deep=1`: retorna `{"ok":true,"service":"web","supabase":"ok"}`.

## Mudancas no Repositorio

### `.github/workflows/ci.yml`

- Job `lint-and-typecheck` recebeu nome estavel `CI gate`.
- Job `staging-readiness` recebeu nome estavel `Staging readiness gate`.
- `Staging readiness gate` roda em `pull_request` e `workflow_dispatch`.
- `Staging readiness gate` usa `environment: staging`.
- Foi removido fallback perigoso de `STAGING_SUPABASE_PROJECT_REF` para `SUPABASE_PROJECT_ID`.
- Foi adicionado passo `Assert staging environment guardrails`.
- Playwright recebe `VERCEL_AUTOMATION_BYPASS_SECRET`.
- Artefatos de falha incluem `playwright-report` e `test-results`.

### `.github/workflows/production-promotion.yml`

- Novo workflow manual `Production Promotion Gate`.
- Usa `environment: production`.
- Exige input `staging_readiness_run_url`.
- Exige input `staging_deployment_url=https://farollimoveis-staging.vercel.app`.
- Exige confirmacao textual `STAGING_READINESS_GREEN`.
- Roda typecheck, unit tests, build e prettier check.
- Declara explicitamente que nao executa `vercel --prod` e nao altera Supabase production.

### `.github/workflows/deploy-functions.yml`

- Workflow renomeado para `Deploy Edge Functions Staging`.
- Deploy automatico em `push` para `main/master` foi removido.
- Deploy agora e manual por `workflow_dispatch`.
- Usa `environment: staging`.
- Exige confirmacao textual `DEPLOY_STAGING_FUNCTIONS`.
- Falha se `STAGING_SUPABASE_PROJECT_REF` nao for `coeuoyeydqoslhvbbojx`.
- Deploy usa `supabase functions deploy --project-ref "$SUPABASE_PROJECT_REF" --use-api --jobs 2`.
- Nao usa `SUPABASE_PROJECT_ID` generico.

### `apps/web/playwright.config.ts`

- Injeta `x-vercel-protection-bypass` quando `VERCEL_AUTOMATION_BYPASS_SECRET` existe.
- Injeta `x-vercel-set-bypass-cookie: true` para navegacao de browser em deployments protegidos.

### `.gitignore`

- Ignora `.env.vercel-*`.
- Ignora `.vercel-deploy-inspect.json`.

### `STAGING.md`

- Reescrito em ASCII.
- Define projeto Vercel canonico `farollimoveis`.
- Documenta o incidente do alias apontando para `imobiliariaqrcode`.
- Lista secrets esperados para Vercel Preview e GitHub environment `staging`.
- Define que o bot WhatsApp live nao e requisito no ambiente de teste.

## Evidencia de Higiene Local

Arquivos temporarios removidos do workspace:

- `.env.vercel-check-preview.tmp`
- `.env.vercel-check-prod.tmp`
- `.env.vercel-check-staging-branch.tmp`
- `.env.vercel-check.tmp`
- `.vercel-deploy-inspect.json`

## Checks Ainda Externos

Para fechar Etapa 4 sem ressalva, aplicar no GitHub:

1. Criar/validar environment `staging` com secrets:
   - `STAGING_BASE_URL`
   - `STAGING_SUPABASE_PROJECT_REF`
   - `STAGING_SUPABASE_URL`
   - `STAGING_SUPABASE_ANON_KEY`
   - `STAGING_SUPABASE_SERVICE_ROLE_KEY`
   - `STAGING_SUPABASE_DB_PASSWORD`
   - `SUPABASE_ACCESS_TOKEN`
   - `VERCEL_AUTOMATION_BYPASS_SECRET`
   - `E2E_STAGING_WRITE`
2. Criar/validar environment `production` com aprovacao manual obrigatoria.
3. Ativar branch protection no branch principal exigindo:
   - `CI gate`;
   - `Staging readiness gate`;
   - revisao humana antes do merge.
4. Definir que deploy de production so pode ocorrer depois de `Production Promotion Gate` verde.

Tentativa automatizada registrada:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\github\apply-production-gates.ps1
```

Resultado: script executou com a credencial local, mas GitHub negou branch protection por falta de permissao admin (`403`). A etapa permanece como bloqueio externo ate haver token/login com administracao do repositorio.
