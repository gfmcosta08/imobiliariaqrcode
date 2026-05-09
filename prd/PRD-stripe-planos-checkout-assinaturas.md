# PRD Tecnico: Stripe, Planos, Checkout E Assinaturas

**Status:** Draft (v1)
**Data:** 2026-05-05
**Produto/Modulo:** Pagamentos, Planos, Checkout Stripe, Webhook Stripe, Supabase

## Resumo

Implementar a integracao Stripe usando a estrutura ja existente no sistema, atualizando a pagina de planos e corrigindo as regras de cobranca para os planos Solo, Pro e Premium.

O objetivo e permitir que o cliente contrate pelo Stripe Checkout, que o sistema ative o plano via webhook Stripe e que assinantes Pro/Premium possam gerenciar cobranca pelo Stripe Customer Portal, preservando os fluxos atuais de imoveis, leads, QR Code, bot WhatsApp e dashboard.

## Diagnostico Do Impacto

- A pagina `apps/web/src/app/plans/page.tsx` ja existe, mas contem valores e textos antigos.
- O botao de checkout `apps/web/src/app/plans/checkout-button.tsx` ja chama `POST /api/stripe/create-checkout`.
- A rota `apps/web/src/app/api/stripe/create-checkout/route.ts` ja cria sessoes Stripe Checkout, usando `mode: payment` para Solo e `mode: subscription` para Pro/Premium.
- O webhook `apps/web/src/app/api/webhooks/stripe/route.ts` ja recebe eventos Stripe e atualiza `subscriptions`, mas ainda trata Solo como 120 dias em trechos de codigo/documentacao.
- A lib `apps/web/src/lib/stripe.ts` ja centraliza o cliente Stripe e os Price IDs por variavel de ambiente.
- O banco ja possui tabelas `plans`, `accounts` e `subscriptions`, alem de migrations relacionadas a Solo, expiracao e Stripe.

Esta implementacao deve ser cirurgica: completar e corrigir a integracao existente, sem reescrever arquitetura de pagamento.

## Objetivo

1. Atualizar a pagina de planos para refletir a oferta comercial final.
2. Garantir checkout Stripe correto para Solo, Pro e Premium.
3. Garantir ativacao/atualizacao de plano via webhook Stripe.
4. Adicionar acesso ao Stripe Customer Portal para clientes Pro/Premium.
5. Ajustar Solo para validade de 3 meses, sem renovacao automatica.
6. Garantir que Premium tenha preco, plano e limites corretos.

## Planos Finais

### Solo

- Preco: R$ 150 trimestral.
- Cobranca Stripe: pagamento unico.
- Validade: 3 meses.
- Beneficios:
  - 1 anuncio ativo.
  - 1 placa QR Code inclusa.
  - Bot WhatsApp automatico.
  - Captura de leads.

### Pro

- Preco: R$ 500/mes.
- Cobranca Stripe: assinatura mensal recorrente.
- Renovacao mensal automatica.
- Beneficios:
  - Multiplos imoveis.
  - Kit inicial: 10 placas QR Code.
  - Bot WhatsApp + leads ilimitados.

### Premium

- Preco: R$ 2.000/mes.
- Cobranca Stripe: assinatura mensal recorrente.
- Renovacao mensal automatica.
- Beneficios:
  - Multiplos imoveis.
  - 5 corretores.
  - Kit inicial: 20 placas QR Code.
  - Bot WhatsApp + leads ilimitados.

## Fora De Escopo

- Cobrar placas adicionais pelo Stripe nesta fase.
- Criar checkout separado para placas QR Code extras.
- Reescrever fluxo de bot WhatsApp, leads, QR publico ou cadastro de imoveis.
- Alterar gateway de pagamento para outro provedor.
- Criar tela propria de gestao de cartao, fatura ou cancelamento.

## Arquivos Afetados Na Implementacao

- Codigo:
  - `apps/web/src/app/plans/page.tsx`
  - `apps/web/src/app/plans/checkout-button.tsx`, somente se for necessario ajustar estados/labels.
  - `apps/web/src/app/api/stripe/create-checkout/route.ts`
  - `apps/web/src/app/api/webhooks/stripe/route.ts`
  - `apps/web/src/lib/stripe.ts`
  - Novo endpoint: `apps/web/src/app/api/stripe/customer-portal/route.ts`
- Banco:
  - Nova migration Supabase para ajustar Solo para 90 dias/3 meses.
  - Nova migration Supabase para garantir plano `premium` e limite de 5 corretores, se ainda nao existir.
- Documentacao:
  - `stripe.md`
  - `apps/web/.env.example`

Nao alterar dependencias sem necessidade. A dependencia `stripe` ja existe em `apps/web/package.json`.

## Regras De Cobranca

- Solo deve usar Stripe Checkout com `mode: "payment"`.
- Solo deve usar um Price unico, sem `recurring`.
- Pro e Premium devem usar Stripe Checkout com `mode: "subscription"`.
- Pro deve usar Price recorrente mensal de R$ 500.
- Premium deve usar Price recorrente mensal de R$ 2.000.
- Todos os checkouts devem associar o pagamento ao `account_id` e ao `plan_code` via metadata.
- O sistema deve criar ou reutilizar `stripe_customer_id` em `accounts`.
- `success_url` deve voltar para o dashboard com indicacao de sucesso.
- `cancel_url` deve voltar para `/plans`.

## Contratos De API

### Criar Checkout

Rota:

```http
POST /api/stripe/create-checkout
```

Entrada:

```json
{
  "planCode": "solo"
}
```

Valores validos:

- `solo`
- `pro`
- `premium`

Saida de sucesso:

```json
{
  "url": "https://checkout.stripe.com/..."
}
```

Erros esperados:

- `401`: usuario nao autenticado.
- `404`: conta local nao encontrada.
- `400`: plano invalido ou Price ID ausente.
- `500`: falha inesperada ao criar checkout.

### Customer Portal

Rota nova:

```http
POST /api/stripe/customer-portal
```

Entrada:

```json
{}
```

Saida de sucesso:

```json
{
  "url": "https://billing.stripe.com/..."
}
```

Regras:

- Exigir usuario autenticado.
- Buscar `accounts.stripe_customer_id`.
- Se nao houver customer Stripe, retornar erro claro.
- Usar `return_url` apontando para perfil ou dashboard.
- Usar o Stripe Customer Portal para gestao de cartao, faturas e cancelamento.

## Regras De Webhook

Endpoint:

```text
/api/webhooks/stripe
```

Validacao obrigatoria:

- Ler raw body com `req.text()`.
- Validar assinatura com `STRIPE_WEBHOOK_SECRET`.
- Usar `runtime = "nodejs"`.
- Nao processar evento sem assinatura valida.

Eventos obrigatorios:

- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Comportamento:

- `checkout.session.completed` com `mode = payment` e `plan_code = solo`:
  - ativar `subscriptions.plan_code = solo`;
  - definir status ativo para Solo;
  - registrar `billing_provider = stripe`;
  - definir validade de 3 meses;
  - publicar/reativar apenas os imoveis elegiveis do Solo conforme regra existente.
- `invoice.payment_succeeded`:
  - recuperar assinatura Stripe;
  - ler `account_id` e `plan_code` da metadata;
  - ativar Pro/Premium conforme `plan_code`;
  - atualizar periodo atual da assinatura.
- `invoice.payment_failed`:
  - marcar assinatura como `past_due`.
- `customer.subscription.updated`:
  - sincronizar status, plano e periodo atual quando a assinatura mudar.
- `customer.subscription.deleted`:
  - marcar assinatura como `canceled` e registrar `canceled_at`.

## Impacto Em Supabase

### Plans

Garantir que existam os planos:

- `solo`
- `pro`
- `premium`

Regras esperadas:

- Solo:
  - `max_active_properties = 1`
  - `has_auto_expiration = true`
  - `expiration_days = 90`
- Pro:
  - multiplos imoveis;
  - sem expiracao automatica mensal do imovel.
- Premium:
  - multiplos imoveis;
  - limite de 5 corretores;
  - sem expiracao automatica mensal do imovel.

Se a tabela `plans` ainda nao tiver coluna para limite de corretores, criar migration pequena e compatibilizar leituras dependentes.

### Subscriptions

Preservar contrato atual sempre que possivel.

Preferencia:

- Usar `plan_code` para distinguir `pro` e `premium`.
- Evitar criar status novos se o sistema atual consegue operar com status ativo unico.

Se for necessario novo status, revisar todas as consultas que leem:

- `status = pro_active`
- `status in (...)`
- `plan_code`

Nao alterar constraint de status sem revisar dependencias.

### Accounts

Manter `accounts.stripe_customer_id` como vinculo entre conta local e Stripe Customer.

## Criterios De Aceitacao

- `/plans` exibe os tres planos com valores e beneficios finais.
- Solo aparece como R$ 150 trimestral e validade de 3 meses.
- Premium aparece como R$ 2.000/mes.
- Checkout Solo usa Price unico e `mode: payment`.
- Checkout Pro e Premium usam Price recorrente e `mode: subscription`.
- Pagamento Solo aprovado ativa plano por 3 meses.
- Pagamento Pro/Premium aprovado ativa assinatura mensal.
- Falha de pagamento deixa assinatura em `past_due`.
- Cancelamento via Stripe deixa assinatura em `canceled`.
- Customer Portal abre para clientes com `stripe_customer_id`.
- Nenhuma chave secreta e salva no repositorio.
- Placas adicionais nao sao cobradas pelo Stripe no v1.

## Testes Obrigatorios

Executar:

- `pnpm --filter web run typecheck`
- `pnpm --filter web run test`
- `git diff --check`

Quando possivel, executar tambem:

- `pnpm --filter web run build`

Testes manuais com Stripe:

- Checkout Solo com cartao de teste.
- Checkout Pro com cartao de teste.
- Checkout Premium com cartao de teste.
- Webhook `checkout.session.completed`.
- Webhook `invoice.payment_succeeded`.
- Webhook `invoice.payment_failed`.
- Cancelamento pelo Customer Portal.

## Validacao De Nao Regressao

- Criacao e edicao de imoveis continuam funcionando.
- Leads continuam sendo capturados.
- QR Code publico continua resolvendo.
- Bot WhatsApp continua enviando descricao, fotos e menu.
- Dashboard e perfil continuam carregando com assinatura free/solo/pro/premium.
- Usuarios sem plano pago nao quebram telas existentes.

## Checklist Final De Seguranca

- Alterar somente arquivos necessarios.
- Nao refatorar por estetica.
- Nao mudar contratos sem revisar dependencias.
- Nao armazenar `sk_...`, `pk_...` ou `whsec_...` no repositorio.
- Validar Price IDs em ambiente correto: teste ou producao.
- Confirmar webhook ativo antes de liberar pagamentos reais.
- Confirmar variaveis Vercel em Production antes de deploy.
- Confirmar build, tipagem e testes antes de commit.
