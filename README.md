# Imobiliária QR Code

SaaS imobiliário (SDD): Next.js, Supabase (Auth, Postgres, RLS, Storage, Edge Functions, filas, Cron), WhatsApp (Uazapi), billing (Stripe + Mercado Pago).

Este repositório segue o monorepo descrito no SDD: `apps/web`, `packages/*`, `supabase/`.

## Pré-requisitos

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10 (`corepack enable` opcional)
- Supabase CLI: `npx supabase@latest` (ou instalação global)

## Configuração

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
```

Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### Supabase local

Na raiz do repositório:

```bash
pnpm exec supabase start
pnpm exec supabase status
```

Copie **API URL** e **anon key** para `apps/web/.env.local`.

Aplicar migrations:

```bash
pnpm exec supabase db reset
```

Isso aplica `supabase/migrations` e executa `supabase/seed.sql`.

### Web

```bash
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000). Use **Cadastrar** na tela de login para criar usuário no Auth local; o painel `/dashboard` exige sessão.

## Scripts (raiz)

| Comando          | Descrição                  |
| ---------------- | -------------------------- |
| `pnpm dev`       | Next.js em desenvolvimento |
| `pnpm build`     | Build de produção          |
| `pnpm lint`      | ESLint em todos os pacotes |
| `pnpm typecheck` | `tsc` no app web           |
| `pnpm format`    | Prettier                   |

## Edge Functions e secrets

Configure secrets no projeto Supabase (Dashboard ou CLI). Liste as funções planejadas em `supabase/functions/README.md`. Não commite `.env` com `service_role`.

## CI

GitHub Actions executa lint, typecheck e verificação Prettier em pushes e PRs para `main`/`master`.

## Licença

Privado — [gfmcosta08/imobiliariaqrcode](https://github.com/gfmcosta08/imobiliariaqrcode).
