# PRD: Aplicar Stripe Com Seguranca

**Status:** Draft (v1)
**Data:** 2026-05-05
**Produto/Modulo:** Stripe, Planos, Checkout, Webhook, Vercel, Supabase

## Resumo

Aplicar os PRDs de Stripe preservando o funcionamento atual do sistema, especialmente bot WhatsApp, QR Code, captura de leads, cadastro de imoveis e dashboard.

Este documento consolida o plano seguro de aplicacao da integracao Stripe usando a conta ja criada pelo cliente na Stripe, sem recriar a empresa, sem trocar a conta bancaria cadastrada e sem salvar chaves secretas no repositorio.

## Objetivo

1. Vincular o sistema a conta Stripe ja criada.
2. Atualizar a pagina de planos com os valores finais.
3. Garantir checkout Stripe para Solo, Pro e Premium.
4. Garantir webhook para ativar assinaturas e pagamentos.
5. Adicionar Customer Portal para gestao de cobranca.
6. Preservar bot, QR Code, leads e fluxos antigos.

## PRDs Relacionados

- `prd/PRD-stripe-planos-checkout-assinaturas.md`
- `prd/PRD-operacional-configuracao-stripe-vercel.md`

Este PRD nao substitui os dois documentos acima. Ele consolida a aplicacao segura dos dois.

## Conta Stripe Vinculada

Conta identificada:

- Nome: `Area restrita de imoveisqr`
- Account ID: `acct_1TTpQqDF917sGAMh`

Regra principal:

- O sistema fica vinculado a essa empresa Stripe quando `STRIPE_SECRET_KEY` no Vercel for a chave `sk_live_...` dessa mesma conta.
- Os `STRIPE_PRICE_*` tambem precisam ser Prices live dessa mesma conta para producao.
- Nenhuma chave `sk_...` ou `whsec_...` deve ser salva no Git.

## Precos Stripe Conhecidos

### Teste

| Plano | Price | Tipo |
| --- | --- | --- |
| Solo | `price_1TTrnlDF917sGAMhDmPD7jWF` | Pagamento unico R$ 150 por 3 meses |
| Pro | `price_1TTqJADF917sGAMhCbMl43h2` | Assinatura mensal R$ 500 |
| Premium | `price_1TTqM1DF917sGAMhiEAuF9m1` | Assinatura mensal R$ 2.000 |

Observacao:

- O Price `price_1TTrnlDF917sGAMhDmPD7jWF` foi criado em modo teste (`livemode: false`).
- O Price antigo `price_1TTpdZDF917sGAMhZKeF1qdm` nao deve ser usado, pois e recorrente trimestral e faria o Solo renovar automaticamente.

### Producao

Para producao, configurar:

```env
STRIPE_SECRET_KEY=sk_live_da_conta_imoveisqr
STRIPE_PRICE_SOLO=price_live_solo_unico
STRIPE_PRICE_PRO=price_live_pro_mensal
STRIPE_PRICE_PREMIUM=price_live_premium_mensal
STRIPE_WEBHOOK_SECRET=whsec_live_do_webhook
```

Todos os valores devem pertencer a conta `acct_1TTpQqDF917sGAMh`.

## Alteracoes Planejadas No Sistema

### Pagina De Planos

Atualizar `/plans` para exibir:

- Solo: R$ 150 trimestral, validade de 3 meses.
- Pro: R$ 500/mes, renovacao mensal automatica.
- Premium: R$ 2.000/mes, renovacao mensal automatica.

Remover textos antigos:

- Solo 120 dias.
- Premium R$ 1.000/mes.
- Placas adicionais cobradas a parte.
- Beneficios nao definidos no pacote final.

### Checkout

Regras:

- Solo usa `mode: payment`.
- Pro e Premium usam `mode: subscription`.
- Checkout deve buscar conta local via `profiles.account_id`.
- Checkout deve gravar/reutilizar `accounts.stripe_customer_id`.
- Metadata deve conter `account_id` e `plan_code`.

### Webhook

Eventos obrigatorios:

- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.deleted`
- `customer.subscription.updated`

Regras:

- Validar assinatura com `STRIPE_WEBHOOK_SECRET`.
- Solo aprovado ativa `solo_active` por 90 dias.
- Pro aprovado ativa `pro_active` com `plan_code = pro`.
- Premium aprovado ativa `pro_active` com `plan_code = premium`.
- Falha de pagamento marca `past_due`.
- Cancelamento marca `canceled`.

### Customer Portal

Adicionar endpoint:

```http
POST /api/stripe/customer-portal
```

Regras:

- Exigir usuario autenticado.
- Exigir `stripe_customer_id`.
- Retornar URL do Stripe Customer Portal.
- Usar retorno para `/profile`.

### Banco

Criar migration nova, sem editar migrations antigas, para:

- garantir `solo` com `expiration_days = 90`;
- garantir `premium`;
- adicionar `plans.max_brokers` se ainda nao existir;
- definir Premium com `max_brokers = 5`;
- preservar statuses atuais, usando `plan_code` para diferenciar Pro/Premium.

## O Que Falta Para Producao

1. Aplicar a migration no Supabase.
2. Criar Price live unico do Solo na conta Stripe live.
3. Confirmar Price live de Pro e Premium.
4. Configurar env vars no Vercel:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_SOLO`
   - `STRIPE_PRICE_PRO`
   - `STRIPE_PRICE_PREMIUM`
   - `NEXT_PUBLIC_APP_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Criar webhook live na Stripe apontando para:

```text
https://seu-dominio.com.br/api/webhooks/stripe
```

6. Fazer redeploy no Vercel.
7. Rodar validacoes finais.

## Checklist De Nao Regressao Do Bot

Nao alterar:

- `supabase/functions/conversation-handle/index.ts`
- `supabase/functions/whatsapp-dispatch/index.ts`
- `supabase/functions/whatsapp-webhook-inbound/index.ts`
- `supabase/functions/qr-resolve/index.ts`
- `supabase/functions/lead-notify-broker/index.ts`
- guardrails do fluxo WhatsApp

Validar:

- QR Code publico continua resolvendo.
- Bot continua enviando descricao, fotos e menu.
- Leads continuam sendo capturados.
- Notificacao ao corretor continua funcionando.
- Fluxos antigos de imoveis continuam operando.

## Validacoes Obrigatorias

Executar antes de deploy:

```bash
pnpm --filter web run typecheck
pnpm --filter web run test
pnpm test:bot-guardrails
pnpm --filter web run build
git diff --check
```

Se o ambiente bloquear `pnpm` ou `node`, executar as validacoes em outra maquina/terminal antes de producao.

## Criterios De Aceitacao

- Sistema usa a conta Stripe `acct_1TTpQqDF917sGAMh`.
- Checkout Solo abre pagamento unico.
- Checkout Pro abre assinatura mensal de R$ 500.
- Checkout Premium abre assinatura mensal de R$ 2.000.
- Webhook ativa assinatura no Supabase.
- Portal de cobranca abre para cliente com `stripe_customer_id`.
- Nenhuma chave secreta foi salva no repositorio.
- Bot, QR Code e leads nao sofreram regressao.
