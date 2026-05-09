# PRD: Trial 30 Dias Sem Quebrar Bot, QR Code Ou Planos Stripe

**Status:** Draft (v1)
**Data:** 2026-05-05
**Produto/Modulo:** Planos, Trial, QR Code, Bot WhatsApp, Stripe, Supabase

## Resumo

Substituir o conceito de plano `free` por `trial` de 30 dias, mas com implementacao em camadas seguras. O bot WhatsApp e area intocavel: nenhuma alteracao em `conversation-handle`, `whatsapp-dispatch`, `whatsapp-webhook-inbound`, `qr-resolve` ou funcoes criticas do bot sem PRD especifico, guardrail e validacao.

A expiracao do trial deve usar mecanismos ja existentes de `expires_at`, `listing_status = expired` e desativacao de QR. O objetivo e fazer o plano de teste funcionar sem quebrar o pacote inicial do QR, menu, semelhantes, leads, notificacoes ao corretor ou anti-silencio.

## Objetivo

1. Trocar o conceito funcional de `free` por `trial`.
2. Permitir que o cliente escolha explicitamente entre teste de 30 dias ou plano pago.
3. Fazer o trial funcionar por 30 dias sem Stripe.
4. Encerrar a entrega do QR/bot apos a expiracao do trial.
5. Preservar integralmente o funcionamento do bot e do site.
6. Completar o sistema de planos junto com Solo, Pro e Premium.

## Regra Principal De Seguranca

O bot e intocavel nesta implementacao inicial.

Arquivos intocaveis por padrao:

- `supabase/functions/conversation-handle/index.ts`
- `supabase/functions/whatsapp-dispatch/index.ts`
- `supabase/functions/whatsapp-webhook-inbound/index.ts`
- `supabase/functions/qr-resolve/index.ts`
- `supabase/functions/lead-notify-broker/index.ts`

Qualquer mudanca nesses arquivos exige outro PRD especifico de bot, guardrail novo e validacao manual do fluxo de QR inicial.

## Contexto Dos PRDs Do Bot E QR

Os PRDs existentes definem invariantes que nao podem ser quebradas:

- QR/codigo valido deve enviar pacote visivel ao cliente:
  - introducao/descricao;
  - fotos quando existirem;
  - menu principal.
- Deduplicacao de QR so pode bloquear reenvio quando ja existir pacote visivel ao cliente.
- Mensagens internas e notificacoes ao corretor nao contam como resposta ao cliente.
- Toda mensagem inbound precisa gerar resposta visivel, fallback ou erro rastreavel.
- Opcao 1, opcao 2, opcao 3 e fluxo pos-semelhantes devem permanecer iguais.

Portanto, a regra do trial deve se apoiar no estado do imovel/QR e nao reescrever o fluxo conversacional.

## Produto: Plano Trial

O sistema deve ter um unico plano gratuito funcional chamado `trial`.

Caracteristicas:

- gratuito;
- validade de 30 dias;
- 1 anuncio ativo;
- 1 corretor;
- sem cobranca Stripe;
- usado uma unica vez por conta;
- apos expiracao, renovacao somente por Solo, Pro ou Premium.

Nao manter `free` como plano de produto paralelo. O conceito funcional de `free` deve ser migrado para `trial` para evitar poluicao de codigo, conflito e bugs.

## Escolha Do Cliente

Novo cliente nao deve iniciar automaticamente em trial sem escolha.

O cliente deve escolher explicitamente:

- comecar teste de 30 dias; ou
- contratar Solo; ou
- contratar Pro; ou
- contratar Premium.

Se escolher teste:

- ativar assinatura local `trial_active`;
- criar/permitir 1 anuncio ativo;
- definir `expires_at = now() + interval '30 days'` no imovel publicado/impresso.

Se escolher plano pago:

- seguir para Stripe Checkout;
- nao ativar trial automaticamente.

## Comportamento Apos 30 Dias

Quando o trial expirar:

- imovel/anuncio deve ficar `listing_status = expired`;
- QR ativo deve ser desativado;
- `property_qrcodes.expired_at` deve receber timestamp;
- `property_qrcodes.invalidation_reason` deve indicar expiracao do trial ou expiracao do anuncio;
- leitura do QR nao deve entregar descricao, fotos, menu, semelhantes ou opcoes do bot;
- renovacao deve acontecer pela pagina `/plans`.

O cliente final que le um QR expirado nao deve receber pacote do imovel. O sistema deve evitar silencio usando os mecanismos ja existentes de QR expirado/indisponivel.

## Implementacao Em Camadas

### Fase 1: Documentacao E Banco

- Criar este PRD como documento oficial.
- Criar migration nova para `trial`, sem editar migrations antigas.
- Migrar dados existentes de `free` para `trial`.
- Manter compatibilidade temporaria com registros legados `free` se houver FK/constraint impedindo remocao imediata.
- Nao mexer em Edge Functions do bot.

### Fase 2: Ativacao Explicita Do Trial

- Adicionar fluxo de UI para `Comecar teste de 30 dias`.
- Criar endpoint seguro para ativar trial apenas quando usuario autenticado clicar.
- Impedir segunda ativacao de trial na mesma conta.
- Se usuario escolher Solo/Pro/Premium, ir direto para Stripe Checkout.

### Fase 3: Expiracao

- Usar `expires_at`, `listing_status = expired` e desativacao de QR ja existentes.
- Garantir que o cron de expiracao rode em producao.
- Evitar alterar `conversation-handle`.
- So tocar em `qr-resolve` ou bot se testes provarem que o comportamento atual nao bloqueia QR expirado corretamente.

### Fase 4: Remocao Segura Do Free

- Remover uso de `free` apenas apos mapear dependencias e passar testes.
- Se houver risco, manter alias interno temporario, mas nao expor `free` como plano de produto.
- Atualizar documentacao, env examples e mensagens de UI para `trial`.

## Banco De Dados

Migration nova deve:

- criar/atualizar `plans.trial`;
- migrar `subscriptions.plan_code = 'free'` para `trial`;
- migrar status `free` para status compativel, preferencialmente `trial_active`;
- revisar constraints de `subscriptions.status`;
- atualizar funcoes que retornam fallback `free`;
- garantir que `trial` tenha `expiration_days = 30`;
- preservar `solo`, `pro` e `premium`.

Pontos a revisar antes de remover `free`:

- FKs de `properties.origin_plan_code`;
- FKs de `subscriptions.plan_code`;
- `get_active_plan_code`;
- `can_create_property`;
- `before_property_insert`;
- funcoes de expiracao;
- onboarding/bootstrapping de conta;
- queries no frontend que exibem plano/status.

## UI E Rotas

Pagina de planos deve exibir:

- teste de 30 dias;
- Solo;
- Pro;
- Premium.

Regra de UX:

- Botao de trial: ativa trial localmente.
- Botoes pagos: abrem Stripe Checkout.
- Se a conta ja usou trial, esconder ou desabilitar o botao de trial e orientar a escolher Solo/Pro/Premium.
- Se o trial expirou, mostrar chamada clara para renovar.

## Stripe E Planos Pagos

Trial nao usa Stripe.

Solo, Pro e Premium seguem os PRDs Stripe existentes:

- Solo: pagamento unico por 3 meses.
- Pro: assinatura mensal.
- Premium: assinatura mensal.

Etapas faltantes para producao plena:

1. Aplicar migrations no Supabase.
2. Criar Price live unico do Solo na conta Stripe live.
3. Confirmar Price live de Pro e Premium na mesma conta.
4. Configurar env vars no Vercel:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_SOLO`
   - `STRIPE_PRICE_PRO`
   - `STRIPE_PRICE_PREMIUM`
   - `NEXT_PUBLIC_APP_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
5. Criar webhook live em:

```text
https://seu-dominio.com.br/api/webhooks/stripe
```

6. Fazer redeploy no Vercel.
7. Validar checkout, webhook e Customer Portal.

## Checklist De Nao Regressao Do Bot

Nao alterar nesta implementacao inicial:

- entrada por QR;
- envio de descricao;
- envio de fotos;
- menu principal;
- opcao 1;
- opcao 2;
- opcao 3;
- fluxo pos-semelhantes;
- deduplicacao de pacote visivel;
- notificacao ao corretor;
- monitor anti-silencio.

Validar obrigatoriamente:

- QR trial valido envia descricao, fotos e menu.
- QR expirado nao entrega pacote.
- Opcao 1 direta segue funcionando.
- Opcao 2 semelhantes segue funcionando.
- Opcao 1 apos semelhantes pede ID.
- ID valido registra interesse.
- ID invalido pede novo ID.
- Opcao 3 envia contato do corretor captador.
- Nenhum fluxo fica em silencio.

## Testes Obrigatorios

Trial:

- usuario sem escolha nao inicia teste automaticamente;
- usuario clica em teste e recebe `trial_active`;
- imovel trial recebe `expires_at = now() + 30 days`;
- trial usado uma vez nao pode ser ativado novamente;
- apos expirar, cron marca imovel como `expired`;
- apos expirar, QR e desativado.

Planos pagos:

- Solo vai para Stripe Checkout de pagamento unico;
- Pro vai para Stripe Checkout de assinatura mensal;
- Premium vai para Stripe Checkout de assinatura mensal;
- webhook ativa assinatura;
- Customer Portal abre para conta com `stripe_customer_id`.

Bot/QR:

- QR valido continua enviando descricao, fotos e menu;
- QR expirado nao entrega pacote;
- fluxos de menu permanecem iguais.

Comandos:

```bash
pnpm test:bot-guardrails
pnpm test
pnpm --filter web run typecheck
pnpm --filter web run build
git diff --check
```

## Criterios De Aceitacao

- `free` nao aparece como plano de produto.
- `trial` substitui `free` funcionalmente.
- Cliente escolhe entre teste ou plano pago.
- Trial dura 30 dias.
- Trial expirado bloqueia entrega do QR/bot usando expiracao existente.
- Bot nao foi alterado na primeira implementacao.
- Stripe continua funcionando para Solo, Pro e Premium.
- Site, cadastro, dashboard, QR e leads continuam funcionando.
- Nenhuma chave secreta foi salva no repositorio.
