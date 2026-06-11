# SECURITY P0 STAGING - 2026-06-04

Production modified: no

## Public/Service Role Endpoints Reviewed

- `apps/web/src/app/api/cron/whatsapp-dispatch/route.ts` — fail-closed com `CRON_SECRET`.
- `apps/web/src/app/api/cron/bot-health-monitor/route.ts` — fail-closed com `CRON_SECRET`.
- `apps/web/src/app/api/public/lead/route.ts` — JSON limitado e whitelist de campos.
- `supabase/functions/lead-notify-broker/index.ts` — exige `Authorization: Bearer ${CRON_SECRET}`.
- `supabase/functions/billing-stripe-webhook/index.ts` — stub, nao autoritativo para billing SaaS.
- `supabase/functions/billing-mercadopago-webhook/index.ts` — stub, nao autoritativo para billing SaaS.

## Changes

- Cron routes Next.js rejeitam chamadas sem segredo configurado (500) ou bearer invalido (401).
- Lead publico usa parser com limite de 8 KB.
- `lead-notify-broker` nao processa `lead_id` antes da autenticacao.
- Billing SaaS autoritativo permanece em `apps/web/src/app/api/webhooks/stripe/route.ts`.

## Validation Commands

```powershell
pnpm --filter web exec vitest run src/lib/security/cron-auth.test.ts
pnpm --filter web exec vitest run src/app/api/public/lead/route.test.ts
```

## Remaining Production Decision

Promover hardening de Edge Functions e cron apenas apos validacao em staging e rotacao de segredos compartilhados (`CRON_SECRET`).
