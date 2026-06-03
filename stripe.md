# Integracao Stripe - Checklist De Ativacao E Homologacao

## Estado Atual Homologado Em 2026-06-02

O fluxo Stripe foi homologado somente em ambiente de teste:

- Site: `https://farollimoveis-staging.vercel.app`
- Branch: `codex/homologacao-segura`
- Produto Stripe teste: `ImobQR Starter (teste)`
- Preco Starter teste: `price_1TdzMMDLux2wr4a970gsPdll`
- Valor: R$ 150,00/mes
- Webhook ativo de staging: `we_1Te27HDLux2wr4a9agbWKKe7`
- Plano final no banco: `plan_code=starter`, `status=starter_active`
- Portal do Cliente validado em `billing.stripe.com` com opcao de cancelamento.

Nenhuma chave `sk_live_` foi usada. Nenhum deploy de producao foi executado.

## Variaveis De Ambiente

| Variavel                | Ambiente homologado | Onde obter                                                        |
| ----------------------- | ------------------- | ----------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | Preview/staging     | Stripe Dashboard -> Developers -> API keys -> chave `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Preview/staging     | Stripe Dashboard -> Developers -> Webhooks -> Signing secret      |
| `STRIPE_PRICE_STARTER`  | Preview/staging     | Produto `ImobQR Starter (teste)` -> Price ID                      |

Variaveis antigas como `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_PRO` e `STRIPE_PRICE_PREMIUM` devem ser tratadas como legado enquanto o produto vigente for Free + Starter.

## Eventos Do Webhook

O endpoint de webhook de staging deve apontar para:

```text
https://farollimoveis-staging.vercel.app/api/webhooks/stripe
```

Eventos obrigatorios:

- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.deleted`
- `customer.subscription.updated`

Webhooks antigos de Preview devem ser desativados para impedir que codigo antigo sobrescreva a assinatura. Na homologacao de 2026-06-02, um webhook antigo causou `status=pro_active` apos o pagamento; a causa foi removida desativando endpoints antigos e mantendo apenas o webhook de staging correto.

## Arquivos Implementados

| Arquivo                                                | Funcao                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| `apps/web/src/lib/stripe.ts`                           | Cliente Stripe servidor com guardrail de modo teste           |
| `apps/web/src/lib/stripe-guard.ts`                     | Bloqueia chaves live fora do fluxo permitido                  |
| `apps/web/src/lib/plans.ts`                            | Constantes do plano Starter homologado                        |
| `apps/web/src/app/api/stripe/create-checkout/route.ts` | Cria Checkout Session de assinatura                           |
| `apps/web/src/app/api/stripe/customer-portal/route.ts` | Cria sessao do Stripe Billing Portal                          |
| `apps/web/src/app/api/webhooks/stripe/route.ts`        | Recebe eventos, deduplica e atualiza assinaturas              |
| `apps/web/src/app/plans/checkout-button.tsx`           | Exige aceite legal antes do checkout                          |
| `apps/web/src/app/plans/page.tsx`                      | Exibe Free + Starter e links legais                           |
| `apps/web/src/app/dashboard/page.tsx`                  | Exibe plano ativo e botao de gerenciamento de assinatura       |
| `apps/web/scripts/stripe-setup-starter-test.mjs`       | Cria produto/preco Starter em modo teste                      |

## Comportamento Por Plano

| Plano    | Preco           | Limite                         | Status esperado                  |
| -------- | --------------- | ------------------------------ | -------------------------------- |
| Free     | R$ 0 por 30 dias | 1 anuncio ativo                | `free` / trial conforme contexto |
| Starter  | R$ 150,00/mes    | Anuncios ilimitados            | `starter_active` apos webhook    |
| Cortesia | Customizado      | Definido pelo Admin por convite | Expira/arquiva conforme validade |

## Fluxo E2E Homologado

1. Usuario acessa `/plans`.
2. Usuario abre resumo do Starter.
3. Usuario aceita Termos, Privacidade e Cancelamento/Reembolso.
4. Sistema registra aceite em `checkout_legal_acceptance_events`.
5. Sistema cria Checkout Session Stripe em modo `subscription`.
6. Usuario paga com cartao teste `4242 4242 4242 4242`.
7. Stripe retorna para `/dashboard?checkout=success&plan=starter`.
8. Webhook processa pagamento e atualiza `subscriptions`.
9. Dashboard mostra `STARTER (starter_active)`.
10. Botao `Gerenciar assinatura (cancelar)` abre Stripe Billing Portal.

## Regras De Seguranca

- Nunca usar chave `sk_live_` em homologacao.
- Nunca imprimir chaves Stripe ou `whsec_` em logs, chat ou Git.
- Nunca fazer `vercel deploy --prod` automaticamente.
- Sempre validar que o endpoint de webhook ativo e o do staging correto.
- Antes de producao, repetir checklist humano, juridico, tecnico e financeiro.

## Referencias De Evidencia

- `docs/compliance/evidencias/HOMOLOGACAO_FREE_STARTER_CORTESIA_STRIPE_2026-06-02.md`
- Obsidian: `D:\cofre obsidian\obsidian-vault\ImoveisQR Farollimoveis\Compliance\HOMOLOGACAO_FREE_STARTER_CORTESIA_STRIPE_2026-06-02.md`
