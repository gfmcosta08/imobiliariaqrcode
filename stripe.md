# Integracao Stripe - Checklist de Ativacao

## Conta Stripe

- Conta usada: `Area restrita de imoveisqr`
- Account ID: `acct_1TTpQqDF917sGAMh`

## Variaveis de ambiente

Configure no Vercel em Production e, para teste local, em `apps/web/.env.local`.

| Variavel | Valor / origem |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe Dashboard -> Developers -> API keys (`sk_test_...` ou `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard -> Developers -> Webhooks -> Signing secret (`whsec_...`) |
| `STRIPE_PRICE_SOLO` | Price unico do Solo. Teste criado: `price_1TTrnlDF917sGAMhDmPD7jWF` |
| `STRIPE_PRICE_PRO` | `price_1TTqJADF917sGAMhCbMl43h2` |
| `STRIPE_PRICE_PREMIUM` | `price_1TTqM1DF917sGAMhiEAuF9m1` |
| `NEXT_PUBLIC_APP_URL` | URL publica do sistema |

Importante: o Price do Solo acima foi criado em modo teste (`livemode: false`). Para cobranca real, crie o equivalente em modo live e use o Price ID live junto com `sk_live_...`.

## Produtos e precos

| Plano | Produto Stripe | Price | Tipo |
| --- | --- | --- | --- |
| Solo | `prod_USl9wY641ZCe4J` | `price_1TTrnlDF917sGAMhDmPD7jWF` | Pagamento unico R$ 150 por 3 meses |
| Pro | `prod_USlqtZc2Nx5X5d` | `price_1TTqJADF917sGAMhCbMl43h2` | Assinatura mensal R$ 500 |
| Premium | `prod_USltU1gxorMHvb` | `price_1TTqM1DF917sGAMhiEAuF9m1` | Assinatura mensal R$ 2.000 |

Nao use `price_1TTpdZDF917sGAMhZKeF1qdm` no sistema: ele e recorrente trimestral e nao corresponde ao Solo definido.

## Webhook

URL:

```text
https://seu-dominio.com.br/api/webhooks/stripe
```

Eventos:

- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.deleted`
- `customer.subscription.updated`

## Arquivos da integracao

| Arquivo | Funcao |
| --- | --- |
| `apps/web/src/lib/stripe.ts` | Cliente Stripe e Price IDs por env |
| `apps/web/src/app/api/stripe/create-checkout/route.ts` | Cria sessao de checkout |
| `apps/web/src/app/api/stripe/customer-portal/route.ts` | Cria sessao do Customer Portal |
| `apps/web/src/app/api/webhooks/stripe/route.ts` | Recebe eventos Stripe e atualiza assinaturas |
| `apps/web/src/app/plans/checkout-button.tsx` | Botao client-side de checkout |
| `apps/web/src/app/plans/page.tsx` | Pagina de planos |

## Comportamento por plano

| Plano | Modo Stripe | Ao pagar |
| --- | --- | --- |
| Solo | `payment` | `solo_active` por 90 dias |
| Pro | `subscription` | `pro_active`, com `plan_code = pro` |
| Premium | `subscription` | `pro_active`, com `plan_code = premium` |

O status ativo de Pro e Premium e compartilhado para preservar compatibilidade. A diferenca entre planos deve ser lida por `plan_code`.

## Teste local com Stripe CLI

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copie o `whsec_...` mostrado pelo Stripe CLI para `STRIPE_WEBHOOK_SECRET` no ambiente local.
