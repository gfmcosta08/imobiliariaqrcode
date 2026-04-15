# Web — Imobiliária QR Code

App Next.js (App Router) do monorepo: painel do corretor, página pública do QR e APIs de servidor.

## Comandos

Na raiz do monorepo: `pnpm dev` (equivale a `pnpm --filter web dev`). Nesta pasta: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`.

## Variáveis

Copie `.env.example` para `.env.local`. Obrigatório: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Para **registrar leads** na rota `POST /api/public/lead` e para **`GET /api/cron/expire`**, configure no ambiente de servidor (nunca no bundle do browser): `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.

## Rotas relevantes

| Rota                                  | Descrição                                                            |
| ------------------------------------- | -------------------------------------------------------------------- |
| `/login`, `/dashboard`, `/properties` | Fluxo autenticado                                                    |
| `/q/[token]`                          | Página pública do QR (Edge `qr-resolve` + formulário de lead)        |
| `POST /api/public/lead`               | Cria lead (`create_lead_from_visit_interest`) com validação do token |
| `GET /api/public/similar?token=`      | Lista similares (RPC) após validar o mesmo token de QR               |
| `GET /api/cron/expire`                | Chama `expire_free_properties()` (cron)                              |
| `GET /api/health`                     | Health check (`?deep=1` opcional)                                    |
| `pnpm test`                           | Vitest (`src/lib/*.test.ts`)                                         |

## Pacotes

- `@imobiliariaqrcode/shared-types` — tipos compartilhados (ex.: contrato `qr-resolve` ativo).
