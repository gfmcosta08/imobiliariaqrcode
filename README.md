# Imobiliária QR Code

SaaS imobiliário (SDD): Next.js, Supabase (Auth, Postgres, RLS, Storage, Edge Functions), WhatsApp (Uazapi — pendente), billing (Stripe + Mercado Pago — stubs).

**Raiz do projeto:** `D:\opencode\imobiliariaopencode`

## O que está pronto

- **Banco (migrations):** tabelas do SDD (`accounts`, `profiles`, `brokers`, `subscriptions`, `properties`, mídia, QR, parceiros, leads, conversas, webhooks, auditoria), índices, `plans` (FREE/PRO), trigger `handle_new_user`, geração de `public_id` e `qr_token`, `register_print_event`, `expire_free_properties`, `recommend_similar_properties`, `create_lead_from_visit_interest`, **RLS** por `account_id`, políticas de **Storage** no bucket `property-media`, **limite de imagens por plano** (trigger em `property_media`), RPC **`partner_lookup_property`** para parceiros.
- **Web (`apps/web`):** cadastro com nome/WhatsApp (metadata), login, painel, **CRUD de imóveis** (rascunho + status), **upload de imagens** (Storage + `property_media` + URLs assinadas), **QR de teste**, página **`/q/[token]`**, **`/partner`** (busca por `public_id` + registro de impressão via Edge), **`/leads`** (lista), **Planos**, **`GET /api/health`**.
- **Edge Functions:** `qr-resolve` (inclui link WhatsApp do corretor quando ativo), `partner-print-register`, **`whatsapp-webhook-inbound`** (persiste payload em `webhook_events` com deduplicação), **`billing-stripe-webhook`** e **`billing-mercadopago-webhook`** (persistem evento bruto); `media-process`, `whatsapp-dispatch`, `conversation-handle`, `lead-notify-broker` ainda **stub**.

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

### Web

```bash
pnpm dev
```

Fluxo sugerido: **Cadastrar** em `/login` → **Painel** → **Imóveis** → criar imóvel → abrir detalhe e conferir **QR** (link para `.../functions/v1/qr-resolve?token=...`). Página pública: `/q/<qr_token>` (o mesmo token salvo em `property_qrcodes`).

### Edge Functions locais

```bash
pnpm exec supabase functions serve
```

Configure `SUPABASE_SERVICE_ROLE_KEY` e demais secrets no ambiente das functions (não commitar).

## Jobs e filas

- **Expiração FREE:** função SQL `expire_free_properties()` — agendar com **pg_cron** ou **Supabase Cron** apontando para uma Edge ou RPC (não incluso como job agendado neste repositório; rode manualmente em dev se precisar).
- **pgmq / filas:** previstas no SDD; não habilitadas neste pacote para evitar dependência extra no primeiro `db reset`. Integrar depois com a fila oficial do projeto.

## Scripts (raiz)

| Comando          | Descrição                  |
| ---------------- | -------------------------- |
| `pnpm dev`       | Next.js em desenvolvimento |
| `pnpm build`     | Build de produção          |
| `pnpm lint`      | ESLint                     |
| `pnpm typecheck` | TypeScript (`apps/web`)    |
| `pnpm format`    | Prettier                   |

## CI

GitHub Actions: lint, typecheck e `prettier --check`.

## Licença

Privado — repositório do titular.
