# Cobrança Stripe

## Objetivo

Documentar tudo que ainda precisa ser tratado antes de colocar as cobranças Stripe em funcionamento real no sistema, sem quebrar planos, trial, QR Code, bot WhatsApp, leads, webhooks, automações ou produção.

Este arquivo é um checklist operacional e técnico. Ele não substitui os PRDs Stripe já criados; ele consolida os bloqueios restantes antes de começar cobranças reais.

## Estado Atual Confirmado

- A conta Stripe correta é a empresa `imoveisqr`, vinculada ao account id `acct_1TTpQqDF917sGAMh`.
- O código local da integração Stripe já foi implementado para:
  - checkout Solo, Pro e Premium;
  - Solo como pagamento único;
  - Pro e Premium como assinaturas mensais;
  - webhook Stripe;
  - Customer Portal;
  - trial de 30 dias;
  - proteção para não alterar Edge Functions do bot.
- As validações locais já passaram:
  - `pnpm --filter web run typecheck`;
  - `pnpm test:bot-guardrails`;
  - `pnpm test`;
  - `pnpm --filter web run build`;
  - `pnpm --filter web run lint`;
  - `git diff --check`.
- O diff de `supabase/functions` e `apps/web/src/guardrails` ficou vazio, então o bot/QR/WhatsApp não foi alterado.
- O Supabase CLI autenticou e o projeto linked é `imobiliariaqrcode`.
- O dry-run do Supabase indicou exatamente 3 migrations pendentes:
  - `20260505090000_stripe_plans_solo_90_premium.sql`;
  - `20260505100000_trial_30_days_replace_free.sql`;
  - `20260505110000_trial_expiration_safety.sql`.
- A Vercel está vinculada ao projeto `farollimoveis`.

## O Que Ainda Falta Antes Das Cobranças

### 1. Configurar variáveis Stripe na Vercel

Na Vercel, projeto `farollimoveis`, ambiente `Production`, adicionar:

```text
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_SOLO=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_PREMIUM=price_...
```

Regras:

- `STRIPE_SECRET_KEY` deve ser a chave secreta live da Stripe, começando com `sk_live_`.
- Não usar a chave publicável `pk_live_` no backend.
- Não salvar `sk_live_...` nem `whsec_...` no repositório.
- Não mandar prints ou mensagens mostrando chaves secretas.

### 2. Criar ou confirmar webhook Stripe de produção

No Stripe Dashboard, criar um webhook apontando para:

```text
https://DOMINIO_DE_PRODUCAO/api/webhooks/stripe
```

Eventos obrigatórios:

```text
checkout.session.completed
invoice.payment_succeeded
invoice.payment_failed
customer.subscription.updated
customer.subscription.deleted
```

Depois de criar, copiar o signing secret `whsec_...` e configurar na Vercel como `STRIPE_WEBHOOK_SECRET`.

### 3. Confirmar domínio de produção

Antes de criar webhook e deploy final, confirmar qual URL será usada em produção:

- domínio próprio, se já estiver ativo;
- ou URL Vercel do projeto `farollimoveis`.

Essa URL precisa estar em:

```text
NEXT_PUBLIC_APP_URL
```

E também deve ser usada no endpoint do webhook Stripe.

### 4. Confirmar Price IDs live

Confirmar que os Price IDs usados em Production pertencem à conta `imoveisqr` e estão em modo live.

Planos esperados:

- Solo:
  - pagamento único;
  - R$ 150;
  - validade no sistema: 90 dias;
  - não pode ser assinatura recorrente trimestral.
- Pro:
  - assinatura mensal;
  - R$ 500/mês.
- Premium:
  - assinatura mensal;
  - R$ 2.000/mês.

Atenção:

- O Price antigo do Solo recorrente trimestral não deve ser usado.
- O Price de teste do Solo não deve ser usado em produção.
- Se ainda não existir Price live único para Solo, criar um novo no produto Solo.

### 5. Aplicar migrations no Supabase

Somente depois da revisão final, executar:

```powershell
$env:SUPABASE_ACCESS_TOKEN=[Environment]::GetEnvironmentVariable("SUPABASE_ACCESS_TOKEN","User")
.\supabase.exe db push
```

Antes de executar, confirmar novamente:

```powershell
.\supabase.exe migration list
.\supabase.exe db push --dry-run
```

As migrations esperadas para subir são apenas:

```text
20260505090000_stripe_plans_solo_90_premium.sql
20260505100000_trial_30_days_replace_free.sql
20260505110000_trial_expiration_safety.sql
```

Se aparecer qualquer outra migration inesperada, parar.

### 6. Validar banco após migrations

Após aplicar migrations, validar no Supabase:

- tabela `plans` contém `trial`, `solo`, `pro`, `premium`;
- `solo.expiration_days = 90`;
- `trial.expiration_days = 30`;
- `premium.max_brokers = 5`;
- `subscriptions.status` aceita:
  - `trial_active`;
  - `solo_active`;
  - `pro_active`;
  - `past_due`;
  - `canceled`;
  - `expired`;
- função `get_active_plan_code` ignora trial/solo vencidos;
- função `expire_free_properties` expira trial vencido e desativa QR;
- função `before_property_lifecycle_cycle` não permite reativação indevida de trial/solo expirado por edição comum.

### 7. Fazer deploy da Vercel

Após migrations e envs configuradas, executar deploy de produção.

Antes do deploy:

```powershell
pnpm --filter web run typecheck
pnpm test:bot-guardrails
pnpm test
pnpm --filter web run build
pnpm --filter web run lint
git diff --check
```

Depois, fazer deploy pelo fluxo escolhido:

- Vercel Dashboard;
- ou Vercel CLI com token configurado.

### 8. Testes reais pós-deploy

Validar em produção ou homologação:

- `/plans` mostra:
  - Teste 30 dias;
  - Solo R$ 150 por 3 meses;
  - Pro R$ 500/mês;
  - Premium R$ 2.000/mês.
- Botão de trial cria `trial_active` uma única vez.
- Checkout Solo abre pagamento único.
- Checkout Pro abre assinatura mensal.
- Checkout Premium abre assinatura mensal.
- Pagamento concluído ativa `subscriptions`.
- Webhook recebe eventos da Stripe com sucesso.
- Customer Portal abre para cliente com `stripe_customer_id`.
- QR válido continua entregando imóvel.
- QR expirado não entrega pacote no bot.
- Leads continuam sendo capturados.
- Bot WhatsApp continua respondendo opção 1, opção 2, opção 3 e semelhantes.

### 9. Monitorar logs depois do deploy

Monitorar:

- logs Vercel das rotas:
  - `/api/stripe/create-checkout`;
  - `/api/webhooks/stripe`;
  - `/api/stripe/customer-portal`;
  - `/api/trial/start`;
  - `/api/cron/expire`.
- logs Stripe do webhook:
  - status HTTP 200;
  - sem erro de assinatura;
  - sem evento ignorado por falta de metadata.
- Supabase:
  - `subscriptions`;
  - `accounts.stripe_customer_id`;
  - `properties.expires_at`;
  - `property_qrcodes.is_active`;
  - fila `whatsapp_messages`.

## Riscos Que Ainda Precisam Ser Controlados

- Usar chave `sk_test_...` em produção por engano.
- Usar Price de teste em produção.
- Usar o Solo recorrente trimestral antigo em vez do Solo pagamento único.
- Criar webhook com URL errada.
- Esquecer de configurar `STRIPE_WEBHOOK_SECRET`.
- Checkout cobrar, mas webhook não ativar plano.
- Migration subir em projeto Supabase errado.
- Deploy ocorrer antes das envs Stripe.
- Alterar bot/QR/WhatsApp sem necessidade.

## Critério Para Começar Cobranças

As cobranças só devem começar quando todos estes pontos estiverem verdadeiros:

- Migrations aplicadas no Supabase correto.
- Vercel Production com todas as envs Stripe.
- Webhook Stripe ativo e entregando HTTP 200.
- Price IDs live confirmados.
- Deploy de produção concluído.
- Teste real de checkout concluído.
- Assinatura criada/atualizada no Supabase.
- QR e bot validados após alteração.
- Logs monitorados sem falha silenciosa.

## Não Fazer

- Não salvar chave secreta Stripe no repositório.
- Não colar tokens em chat.
- Não usar `pk_live_...` como `STRIPE_SECRET_KEY`.
- Não aplicar migrations se o dry-run mostrar migrations inesperadas.
- Não fazer deploy sem webhook configurado.
- Não mexer em Edge Functions do bot para corrigir cobrança.
- Não alterar fluxo de QR/leads sem PRD específico.
