# Integração Stripe — Checklist de Ativação

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Onde obter |
|---|---|
| `STRIPE_SECRET_KEY` | dashboard.stripe.com → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | dashboard.stripe.com → Developers → Webhooks → Signing secret |
| `STRIPE_PRICE_SOLO` | Criar produto "Solo" — pagamento único R$ 150 → copiar o Price ID |
| `STRIPE_PRICE_PRO` | Criar produto "Pro" — recorrente mensal R$ 500 → copiar o Price ID |
| `STRIPE_PRICE_PREMIUM` | Criar produto "Premium" — recorrente mensal R$ 1.000 → copiar o Price ID |

## Passos no Stripe Dashboard

1. Criar conta em https://stripe.com (ou usar conta existente)
2. **Produtos → Criar produto** para cada plano:
   - Solo: preço único R$ 150,00
   - Pro: preço recorrente R$ 500,00 / mês
   - Premium: preço recorrente R$ 1.000,00 / mês
3. Copiar o `price_...` de cada produto → preencher as env vars acima
4. **Developers → Webhooks → Add endpoint**:
   - URL: `https://seu-dominio.com.br/api/webhooks/stripe`
   - Eventos a escutar:
     - `checkout.session.completed`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `customer.subscription.deleted`
     - `customer.subscription.updated`
5. Copiar o **Signing secret** → preencher `STRIPE_WEBHOOK_SECRET`

## Arquivos já implementados

| Arquivo | Função |
|---|---|
| `apps/web/src/lib/stripe.ts` | Cliente Stripe servidor |
| `apps/web/src/app/api/stripe/create-checkout/route.ts` | Cria sessão de pagamento |
| `apps/web/src/app/api/webhooks/stripe/route.ts` | Recebe eventos e atualiza assinaturas |
| `apps/web/src/app/plans/checkout-button.tsx` | Botão de checkout (client component) |
| `apps/web/src/app/plans/page.tsx` | Página de planos com botões reais |
| `supabase/migrations/20260423140000_stripe_price_ids.sql` | Campos stripe_price_id, stripe_customer_id, status solo_active |

## Comportamento por plano após pagamento

| Plano | Modo Stripe | Ao pagar | Ao cancelar |
|---|---|---|---|
| Solo | Pagamento único | `solo_active` por 120 dias | Não se aplica |
| Pro | Assinatura recorrente | `pro_active`, renova todo mês | `canceled` ao fim do período |
| Premium | Assinatura recorrente | `pro_active`, renova todo mês | `canceled` ao fim do período |

## Teste local com Stripe CLI

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
