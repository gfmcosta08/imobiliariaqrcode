# PRD Operacional: Configuracao Stripe E Vercel

**Status:** Draft (v1)
**Data:** 2026-05-05
**Produto/Modulo:** Stripe Dashboard, Vercel, Variaveis de Ambiente, Webhook

## Resumo

Configurar a conta Stripe ja existente para ser usada pelo sistema, sem expor chaves secretas no repositorio e sem recriar produtos que ja estao corretos.

Este PRD descreve como aproveitar os produtos e Prices encontrados na conta Stripe, criar apenas o Price unico que falta para Solo, configurar variaveis no Vercel e ativar o webhook necessario para o sistema receber confirmacoes de pagamento.

## Diagnostico Do Impacto

- A conta Stripe conectada foi identificada como `Area restrita de imoveisqr`.
- Os produtos Solo, Pro e Premium ja existem na Stripe.
- Pro ja possui Price recorrente mensal correto.
- Premium ja possui Price recorrente mensal correto.
- Solo possui Price recorrente trimestral, mas o produto definido para o sistema e pagamento unico de R$ 150 com validade de 3 meses.
- O projeto Vercel local esta linkado como `farollimoveis`, mas o comando `vercel` nao esta instalado neste terminal.

## Objetivo

1. Aproveitar a conta Stripe ja criada.
2. Aproveitar produtos e Prices existentes quando corretos.
3. Criar novo Price unico para Solo.
4. Configurar variaveis de ambiente no Vercel.
5. Criar webhook Stripe apontando para o app.
6. Validar que checkout e webhook funcionam antes de liberar pagamentos reais.

## Dados Stripe Identificados

### Conta

- Nome: `Area restrita de imoveisqr`
- Account ID: `acct_1TTpQqDF917sGAMh`

### Produto Solo

- Produto: `prod_USl9wY641ZCe4J`
- Price atual encontrado: `price_1TTpdZDF917sGAMhZKeF1qdm`
- Valor atual: R$ 150
- Problema: o Price atual e recorrente a cada 3 meses.
- Decisao: nao usar este Price no sistema v1.
- Acao obrigatoria: criar um novo Price unico de R$ 150 no mesmo produto.

### Produto Pro

- Produto: `prod_USlqtZc2Nx5X5d`
- Price correto: `price_1TTqJADF917sGAMhCbMl43h2`
- Valor: R$ 500/mes
- Tipo: recorrente mensal
- Acao: usar este Price em `STRIPE_PRICE_PRO`.

### Produto Premium

- Produto: `prod_USltU1gxorMHvb`
- Price correto: `price_1TTqM1DF917sGAMhiEAuF9m1`
- Valor: R$ 2.000/mes
- Tipo: recorrente mensal
- Acao: usar este Price em `STRIPE_PRICE_PREMIUM`.

## Criacao Do Novo Price Solo

Criar um novo Price no produto existente:

- Produto: `prod_USl9wY641ZCe4J`
- Valor: `15000`
- Moeda: `brl`
- Tipo: pagamento unico
- Sem recorrencia

Resultado esperado:

- Um novo ID `price_...`.
- Este novo ID deve ser usado em `STRIPE_PRICE_SOLO`.

Importante:

- Nao apagar o Price recorrente trimestral antigo sem revisar se ha assinaturas vinculadas.
- Nao usar o Price antigo recorrente no sistema, porque ele causaria renovacao automatica do Solo.

## Variaveis De Ambiente Necessarias

Configurar no Vercel, no projeto `farollimoveis`, em Production:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_SOLO=price_...
STRIPE_PRICE_PRO=price_1TTqJADF917sGAMhCbMl43h2
STRIPE_PRICE_PREMIUM=price_1TTqM1DF917sGAMhiEAuF9m1
NEXT_PUBLIC_APP_URL=https://seu-dominio.com.br
```

Para ambiente Preview/Development, usar chaves e Prices de teste quando houver:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_SOLO=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_PREMIUM=price_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Regras De Seguranca Para Chaves

- Nunca salvar `STRIPE_SECRET_KEY` em arquivo versionado.
- Nunca salvar `STRIPE_WEBHOOK_SECRET` em arquivo versionado.
- Nunca colar `sk_...` ou `whsec_...` em PRD, README publico, issue ou commit.
- `apps/web/.env.example` deve conter somente placeholders.
- `.env.local` pode ser usado localmente, mas deve continuar fora do Git.
- A chave publicavel `pk_...` nao e necessaria no fluxo atual com Stripe Checkout.

## Configuracao Do Webhook Stripe

Criar endpoint no Stripe Dashboard:

```text
https://seu-dominio.com.br/api/webhooks/stripe
```

Eventos obrigatorios:

- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Apos criar o endpoint, copiar o Signing secret:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

Esse valor deve ir somente para Vercel/env local.

## Configuracao Via Vercel CLI

O projeto local possui `.vercel/project.json` com:

- `projectName`: `farollimoveis`
- `projectId`: `prj_0B0SlXaOYwuXAvLiMASCBsdPevaI`
- `orgId`: `team_9iRnetlGnSVo0lK8KpLVt02W`

O comando `vercel` nao foi encontrado no terminal. Antes de configurar por CLI, instalar ou usar via `pnpm dlx`:

```powershell
pnpm dlx vercel whoami
```

Se nao estiver autenticado:

```powershell
pnpm dlx vercel login
```

Configurar variaveis com cuidado, uma por vez, no ambiente Production:

```powershell
pnpm dlx vercel env add STRIPE_SECRET_KEY production
pnpm dlx vercel env add STRIPE_WEBHOOK_SECRET production
pnpm dlx vercel env add STRIPE_PRICE_SOLO production
pnpm dlx vercel env add STRIPE_PRICE_PRO production
pnpm dlx vercel env add STRIPE_PRICE_PREMIUM production
pnpm dlx vercel env add NEXT_PUBLIC_APP_URL production
```

Depois de configurar ou alterar env vars, fazer novo deploy para a aplicacao receber os valores.

## Configuracao Via Painel Vercel

Alternativa segura se CLI nao estiver disponivel:

1. Acessar o projeto `farollimoveis` no Vercel.
2. Abrir Settings.
3. Abrir Environment Variables.
4. Adicionar as variaveis da secao "Variaveis De Ambiente Necessarias".
5. Selecionar ambiente Production.
6. Salvar.
7. Fazer redeploy da producao.

## Validacao Pos-Configuracao

### Validacao No Stripe

- Confirmar que o novo Price Solo e pagamento unico.
- Confirmar que Pro e Premium sao recorrentes mensais.
- Confirmar que o webhook esta ativo.
- Confirmar que o webhook possui os cinco eventos obrigatorios.
- Confirmar que eventos recentes estao retornando HTTP 200.

### Validacao No Vercel

- Confirmar que todas as variaveis existem em Production.
- Confirmar que `NEXT_PUBLIC_APP_URL` aponta para o dominio publico correto.
- Confirmar que houve redeploy apos alterar variaveis.
- Confirmar que nao ha env de teste misturada com producao.

### Validacao No Sistema

- Abrir `/plans`.
- Clicar em Solo e confirmar que o Stripe Checkout mostra R$ 150 sem renovacao automatica.
- Clicar em Pro e confirmar que o Stripe Checkout mostra R$ 500/mensal.
- Clicar em Premium e confirmar que o Stripe Checkout mostra R$ 2.000/mensal.
- Concluir pagamento de teste ou real controlado.
- Confirmar no banco que `subscriptions` foi atualizada.
- Confirmar que eventos do webhook aparecem como entregues no Stripe Dashboard.

## Riscos Identificados

- Usar o Price antigo do Solo ativaria uma assinatura trimestral, contrariando a regra de pagamento unico.
- Configurar Price de teste em producao faria checkout real falhar ou apontar para ambiente errado.
- Configurar chave secreta de producao em ambiente local sem cuidado pode causar cobranca real em testes.
- Esquecer o webhook faz o Stripe cobrar, mas o sistema nao ativar o plano automaticamente.
- Alterar variaveis no Vercel sem redeploy pode manter o app usando configuracao antiga.

## Estrategia De Rollout

1. Criar novo Price unico do Solo.
2. Configurar env vars no Vercel.
3. Criar webhook Stripe.
4. Fazer deploy.
5. Testar checkout em ambiente controlado.
6. Validar webhook e atualizacao de assinatura.
7. Liberar pagina de planos atualizada.

## Checklist Final De Seguranca

- Pro Price definido como `price_1TTqJADF917sGAMhCbMl43h2`.
- Premium Price definido como `price_1TTqM1DF917sGAMhiEAuF9m1`.
- Solo usa novo Price unico, nao o Price recorrente trimestral antigo.
- `STRIPE_SECRET_KEY` configurada somente em ambiente seguro.
- `STRIPE_WEBHOOK_SECRET` configurada somente em ambiente seguro.
- Nenhuma chave secreta foi salva no repositorio.
- Webhook criado com os eventos obrigatorios.
- Vercel redeployado apos configurar variaveis.
- Checkout e webhook testados antes de divulgar pagamento real.
