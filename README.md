# Imobiliária QR Code

SaaS imobiliário (SDD): Next.js, Supabase (Auth, Postgres, RLS, Storage, Edge Functions), WhatsApp (Uazapi — pendente), billing (Stripe + Mercado Pago — stubs).

**Raiz do projeto:** `D:\opencode\imobiliariaopencode`

## O que está pronto

- **Banco (migrations):** tabelas do SDD (`accounts`, `profiles`, `brokers`, `subscriptions`, `properties`, mídia, QR, parceiros, leads, conversas, webhooks, auditoria), índices, `plans` (FREE/PRO), trigger `handle_new_user`, geração de `public_id` e `qr_token`, `register_print_event`, `expire_free_properties`, `recommend_similar_properties`, `create_lead_from_visit_interest`, **RLS** por `account_id`, políticas de **Storage** no bucket `property-media`, **limite de imagens por plano** (trigger em `property_media`), RPC **`partner_lookup_property`** para parceiros.
- **Web (`apps/web`):** cadastro com nome/WhatsApp (metadata), login, painel, **CRUD de imóveis** (rascunho + status), **upload de imagens** (Storage + `property_media` + URLs assinadas), **QR de teste**, página pública **`/q/[token]`** (resumo do anúncio, **imóveis similares** via RPC `recommend_similar_properties` + **`GET /api/public/similar`**, **registro de lead** via **`POST /api/public/lead`**, link **wa.me** do corretor — sem API de WhatsApp), **ficha do imóvel** com bloco “similares”, **`/partner`** (busca por `public_id` + registro de impressão via Edge), **`/leads`** (lista), **Planos**, **`GET /api/health`**, **`GET /api/cron/expire`** (expira imóveis FREE — requer `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` no servidor; `vercel.json` agenda a cada 5 min se deploy na Vercel).
- **Edge Functions:** `qr-resolve` (inclui link WhatsApp do corretor quando ativo), `partner-print-register`, **`whatsapp-webhook-inbound`** (persiste payload em `webhook_events` com deduplicação), **`billing-stripe-webhook`** e **`billing-mercadopago-webhook`** (persistem evento bruto); **`whatsapp-dispatch`** consome fila `whatsapp_messages` (status `queued` → `sent`, sem API externa ainda — preparar Uazapi); `media-process`, `conversation-handle`, `lead-notify-broker` ainda **stub**.

## Pré-requisitos

- Node.js 20+, pnpm 10
- Docker Desktop (para `supabase start` / `db reset`)

## Configuração

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

Configure `SUPABASE_SERVICE_ROLE_KEY` e demais secrets no ambiente das functions (não commitar).

### Web

```bash
pnpm dev
```

Fluxo sugerido: **Cadastrar** em `/login` → **Painel** → **Imóveis** → criar imóvel → abrir detalhe e conferir **QR**. Página pública: `/q/<qr_token>` — o visitante vê o anúncio e pode registrar interesse; o app precisa de **`SUPABASE_SERVICE_ROLE_KEY`** no servidor para gravar o lead (não exponha no cliente).

## Integrações deixadas por último (fora do escopo atual)

- **WhatsApp (Uazapi):** inbound, dispatch real, `conversation-handle`, fila completa.
- **Cobrança:** validação de assinatura Stripe/Mercado Pago, checkout e atualização de `subscriptions`.

O restante do MVP (schema, app, QR, leads via web, parceiros, cron FREE) está implementado em torno desses pontos.

## Jobs e filas

- **Expiração FREE:** `expire_free_properties()` pode ser chamada por **`GET /api/cron/expire`** (Next) com `Authorization: Bearer CRON_SECRET` ou `?secret=` (testes). Na Vercel, defina `CRON_SECRET` e `SUPABASE_SERVICE_ROLE_KEY`; o cron em `apps/web/vercel.json` chama esse path. Alternativa: **pg_cron** / **Supabase Cron** chamando a mesma RPC.
- **WhatsApp outbound:** trigger em `leads` enfileira linhas em `whatsapp_messages`; a Edge **`whatsapp-dispatch`** (Bearer `CRON_SECRET`) marca lote como enviado (stub até Uazapi).
- **pgmq / filas:** previstas no SDD; não habilitadas neste pacote para evitar dependência extra no primeiro `db reset`. Integrar depois com a fila oficial do projeto.

## Scripts (raiz)

| Comando          | Descrição                     |
| ---------------- | ----------------------------- |
| `pnpm dev`       | Next.js em desenvolvimento    |
| `pnpm build`     | Build de produção             |
| `pnpm lint`      | ESLint                        |
| `pnpm typecheck` | TypeScript (`apps/web`)       |
| `pnpm format`    | Prettier                      |
| `pnpm test`      | Vitest (unitário, `apps/web`) |

## Health

- `GET /api/health` — processo OK.
- `GET /api/health?deep=1` — também testa leitura anônima na tabela `plans` (útil com `NEXT_PUBLIC_*` configurado).

## CI

GitHub Actions: lint, typecheck, **testes unitários**, `prettier --check`.

## Encerramento deste pacote (MVP)

Funcionalidades previstas **sem** depender de Uazapi ou gateway de pagamento estão cobertas: schema, painel, QR público, leads, similares, parceiro, cron de expiração FREE, testes de utilitário, loading states e hardening leve de headers. O que permanece como fase seguinte está em **Integrações deixadas por último**.

## Licença

Privado — repositório do titular.
