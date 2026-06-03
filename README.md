# ImobiliÃ¡ria QR Code

SaaS imobiliÃ¡rio (SDD): Next.js, Supabase (Auth, Postgres, RLS, Storage, Edge Functions), WhatsApp (Uazapi â€” pendente), billing (Stripe Starter homologado em teste; Mercado Pago stub).

**Raiz do projeto:** `D:\opencode\imobiliariaopencode`


## Atualizacao De Homologacao Comercial - 2026-06-02

O pacote Free + Starter foi homologado somente em staging:

- Free: 30 dias e 1 anuncio ativo.
- Starter: R$ 150,00/mes, anuncios ilimitados, QR Codes, leads, bot WhatsApp e demais beneficios.
- Stripe Checkout, webhook e Billing Portal foram validados em modo teste.
- Status final esperado: `plan_code=starter`, `status=starter_active`.
- Producao nao foi alterada; qualquer promocao exige aprovacao humana.
- Evidencias: `docs/compliance/evidencias/HOMOLOGACAO_FREE_STARTER_CORTESIA_STRIPE_2026-06-02.md`.
## O que estÃ¡ pronto

- **Banco (migrations):** tabelas do SDD (`accounts`, `profiles`, `brokers`, `subscriptions`, `properties`, mÃ­dia, QR, parceiros, leads, conversas, webhooks, auditoria), Ã­ndices, `plans` (Free/Starter homologado em staging; PRO legado), trigger `handle_new_user`, geraÃ§Ã£o de `public_id` e `qr_token`, `register_print_event`, `expire_free_properties`, `recommend_similar_properties`, `create_lead_from_visit_interest`, **RLS** por `account_id`, polÃ­ticas de **Storage** no bucket `property-media`, **limite de imagens por plano** (trigger em `property_media`), RPC **`partner_lookup_property`** para parceiros.
- **Web (`apps/web`):** cadastro com nome/WhatsApp (metadata), login, painel, **CRUD de imÃ³veis** (rascunho + status), **upload de imagens** (Storage + `property_media` + URLs assinadas), **QR de teste**, pÃ¡gina pÃºblica **`/q/[token]`** (resumo do anÃºncio, **imÃ³veis similares** via RPC `recommend_similar_properties` + **`GET /api/public/similar`**, **registro de lead** via **`POST /api/public/lead`**, link **wa.me** do corretor â€” sem API de WhatsApp), **ficha do imÃ³vel** com bloco â€œsimilaresâ€, **`/partner`** (busca por `public_id` + registro de impressÃ£o via Edge), **`/leads`** (lista), **Planos**, **`GET /api/health`**, **`GET /api/cron/expire`** (expira imÃ³veis FREE â€” requer `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` no servidor; `vercel.json` agenda a cada 5 min se deploy na Vercel).
- **Edge Functions:** `qr-resolve` (inclui link WhatsApp do corretor quando ativo), `partner-print-register`, **`whatsapp-webhook-inbound`** (persiste payload em `webhook_events` com deduplicaÃ§Ã£o), **`billing-stripe-webhook`** e **`billing-mercadopago-webhook`** (persistem evento bruto); **`whatsapp-dispatch`** consome fila `whatsapp_messages` (status `queued` â†’ `sent`, sem API externa ainda â€” preparar Uazapi); `media-process`, `conversation-handle`, `lead-notify-broker` ainda **stub**.

## PrÃ©-requisitos

- Node.js 20+, pnpm 10
- Docker Desktop (para `supabase start` / `db reset`)

## ConfiguraÃ§Ã£o

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
```

Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (projeto Supabase local ou remoto).

### Supabase local

```bash
pnpm exec supabase start
pnpm exec supabase status
```

Copie URL e **anon key** para `apps/web/.env.local`. Aplique o schema:

```bash
pnpm exec supabase db reset
```

### Edge Functions (local)

```bash
pnpm exec supabase functions serve
```

Configure `SUPABASE_SERVICE_ROLE_KEY` e demais secrets no ambiente das functions (nÃ£o commitar).

### Web

```bash
pnpm dev
```

Fluxo sugerido: **Cadastrar** em `/login` â†’ **Painel** â†’ **ImÃ³veis** â†’ criar imÃ³vel â†’ abrir detalhe e conferir **QR**. PÃ¡gina pÃºblica: `/q/<qr_token>` â€” o visitante vÃª o anÃºncio e pode registrar interesse; o app precisa de **`SUPABASE_SERVICE_ROLE_KEY`** no servidor para gravar o lead (nÃ£o exponha no cliente).

## IntegraÃ§Ãµes pendentes ou nao promovidas para producao

- **WhatsApp (Uazapi):** inbound, dispatch real, `conversation-handle`, fila completa.
- **Cobranca:** Stripe Starter validado em homologacao/teste; Mercado Pago permanece stub; producao pendente de aprovacao.

O restante do MVP (schema, app, QR, leads via web, parceiros, cron FREE) estÃ¡ implementado em torno desses pontos.

## Jobs e filas

- **ExpiraÃ§Ã£o FREE:** `expire_free_properties()` pode ser chamada por **`GET /api/cron/expire`** (Next) com `Authorization: Bearer CRON_SECRET` ou `?secret=` (testes). Na Vercel, defina `CRON_SECRET` e `SUPABASE_SERVICE_ROLE_KEY`; o cron em `apps/web/vercel.json` chama esse path. Alternativa: **pg_cron** / **Supabase Cron** chamando a mesma RPC.
- **WhatsApp outbound:** trigger em `leads` enfileira linhas em `whatsapp_messages`; a Edge **`whatsapp-dispatch`** (Bearer `CRON_SECRET`) marca lote como enviado (stub atÃ© Uazapi).
- **pgmq / filas:** previstas no SDD; nÃ£o habilitadas neste pacote para evitar dependÃªncia extra no primeiro `db reset`. Integrar depois com a fila oficial do projeto.

## Scripts (raiz)

| Comando          | DescriÃ§Ã£o                     |
| ---------------- | ----------------------------- |
| `pnpm dev`       | Next.js em desenvolvimento    |
| `pnpm build`     | Build de produÃ§Ã£o             |
| `pnpm lint`      | ESLint                        |
| `pnpm typecheck` | TypeScript (`apps/web`)       |
| `pnpm format`    | Prettier                      |
| `pnpm test`      | Vitest (unitÃ¡rio, `apps/web`) |

## Health

- `GET /api/health` â€” processo OK.
- `GET /api/health?deep=1` â€” tambÃ©m testa leitura anÃ´nima na tabela `plans` (Ãºtil com `NEXT_PUBLIC_*` configurado).

## CI

GitHub Actions: lint, typecheck, **testes unitÃ¡rios**, `prettier --check`.

## Encerramento deste pacote (MVP)

Funcionalidades previstas **sem** depender de Uazapi ou gateway de pagamento estÃ£o cobertas: schema, painel, QR pÃºblico, leads, similares, parceiro, cron de expiraÃ§Ã£o FREE, testes de utilitÃ¡rio, loading states e hardening leve de headers. O que permanece como fase seguinte estÃ¡ em **IntegraÃ§Ãµes deixadas por Ãºltimo**.

## LicenÃ§a

Privado â€” repositÃ³rio do titular.
