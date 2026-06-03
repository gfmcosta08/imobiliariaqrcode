# Homologacao Free, Starter, Cortesia e Stripe - 2026-06-02

## Escopo executado somente em teste

- Worktree isolado: `C:\tmp\imobiliariaopencode-homologacao-segura`
- Branch: `codex/homologacao-segura`
- Site homologacao: `https://farollimoveis-staging.vercel.app`
- Deployment Preview: `https://farollimoveis-j582yxgcr.vercel.app`
- Supabase homologacao: `coeuoyeydqoslhvbbojx`
- Producao: nao alterada e nao promovida.

## Implementacoes concluídas

- Guardrail comercial bloqueia Supabase diferente do projeto de homologacao, deploy diferente de Preview e chave Stripe fora de `sk_test_`.
- Plano Free mantido com 30 dias e 1 anuncio ativo.
- Plano Starter criado com R$ 150/mês e anuncios ilimitados.
- Admin pode editar convite cortesia inclusive depois da ativacao.
- Reducao do limite arquiva os anuncios ativos mais antigos e preserva os mais novos.
- Expiracao retroativa encerra a cortesia imediatamente, arquiva anuncios ativos e invalida QR Codes correspondentes.
- Operacoes de cortesia sao atomicas e geram trilha de auditoria.
- Checkout Starter, Customer Portal, webhook idempotente e registro append-only de aceites juridicos foram preparados.
- Catalogo publico exibe Termos, Privacidade, Cancelamento/Reembolso e Remocao de Conteudo.
- Checkout fica explicitamente indisponivel enquanto Stripe teste nao estiver configurada.

## Migrations confirmadas em homologacao

- `20260602203204_free_starter_courtesy.sql`
- `20260602203511_admin_update_courtesy_atomic.sql`
- `20260602204050_checkout_legal_acceptance_events.sql`

## Evidencias de validacao

- `pnpm test`: aprovado.
- Web: 96 testes aprovados.
- Importador: 47 testes aprovados.
- Guardrail bot staging: 6 testes aprovados.
- Guardrail comercial staging: 5 testes aprovados.
- Total: 154 testes aprovados.
- `pnpm typecheck`: aprovado.
- `pnpm build`: aprovado localmente e na Vercel Preview.
- Guardrail de deploy Preview: aprovado.
- Tentativa simulada de deploy production: bloqueada como esperado.
- `GET /api/health`: HTTP 200 com `{ "ok": true, "service": "web" }`.
- `GET /plans`: HTTP 200 e validacao visual concluida.
- `GET /termos`: HTTP 200.
- `GET /cancelamento-e-reembolso`: HTTP 200.
- Lista remota de migrations Supabase: local e homologacao alinhados.

## Pendencia bloqueada: Stripe teste

A variavel local encontrada possui prefixo `sk_test_`, mas nao e uma chave valida. A API Stripe respondeu HTTP 401 antes de criar produto ou preco. Nenhum recurso Stripe foi criado e nenhuma credencial de producao foi usada.

Para concluir o E2E de assinatura em homologacao ainda faltam:

1. Disponibilizar uma `STRIPE_SECRET_KEY` valida de modo teste.
2. Executar `pnpm --filter web run stripe:setup-starter-test` para criar produto/preco recorrente de R$ 150.
3. Configurar no Preview: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STARTER` e `STRIPE_WEBHOOK_SECRET`, todos do modo teste.
4. Registrar webhook de teste apontando para `https://farollimoveis-staging.vercel.app/api/webhooks/stripe`.
5. Testar checkout, pagamento de teste, webhook, ativacao Starter, falha de pagamento, cancelamento e Customer Portal.

## Bot

O E2E do bot permanece adiado conforme autorizacao do proprietario, pois ainda nao existe numero exclusivo de teste.

## Regra mantida

Nenhuma alteracao deve ser promovida para producao sem aprovacao humana explicita depois da conclusao da Stripe teste e da homologacao manual.

## Complemento Stripe E2E - 2026-06-02 21:05 America/Sao_Paulo

### Configuracao Stripe teste concluida

- Chave API usada: somente modo teste (`sk_test_...`), sem exibicao em chat, logs ou Git.
- Produto/preco criado no Stripe teste:
  - Produto: `prod_UdFsaqlDO8bL0r`
  - Preco Starter: `price_1TdzMMDLux2wr4a970gsPdll`
  - Valor: R$ 150,00/mês
- Webhook antigo de Preview foi desativado para evitar sobrescrita por codigo antigo:
  - `we_1TdzSgDLux2wr4a9XjngF2lr`: disabled
  - `we_1TVAtDDLux2wr4a95sWIvTxs`: disabled
- Webhook ativo correto:
  - `we_1Te27HDLux2wr4a9agbWKKe7`
  - URL: `https://farollimoveis-staging.vercel.app/api/webhooks/stripe`
  - Eventos: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`
- Segredos foram armazenados no Vercel Preview da branch `codex/homologacao-segura` e tambem injetados no deployment atual de homologacao.
- Arquivos temporarios e clipboard local foram limpos apos a configuracao.

### E2E de assinatura validado

- Checkout abriu em `checkout.stripe.com` em area restrita de teste.
- Plano exibido: `ImobQR Starter (teste)`.
- Valor exibido: `R$ 150,00 por mês`.
- Cartao de teste usado: Visa final `4242`.
- Sessao Stripe: status `complete`, payment_status `paid`.
- Subscription Stripe: `sub_1Te2CIDLux2wr4a9xNmoq3ic`.
- Customer Stripe: `cus_UdIlt5m1f1jnNS`.
- Retorno apos pagamento: `https://farollimoveis-staging.vercel.app/dashboard?checkout=success&plan=starter`.

### Banco de homologacao validado

Conta homologada: `242e020f-02e5-4e60-96e8-7197cd2bdaf1`.

Resultado final em `subscriptions`:

- `plan_code`: `starter`
- `status`: `starter_active`
- `billing_provider`: `stripe`
- `provider_subscription_id`: `sub_1Te2CIDLux2wr4a9xNmoq3ic`
- `current_period_start`: `2026-06-02 23:58:16+00`
- `current_period_end`: `2026-07-02 23:58:16+00`

Aceite juridico persistido:

- `terms_version`: `2026-06-02`
- `privacy_version`: `2026-06-02`
- `refund_cancellation_version`: `2026-06-02`
- `accepted_at`: `2026-06-02 23:55:59.923416+00`

Eventos webhook processados:

- `checkout.session.completed`: processed
- `invoice.payment_succeeded`: processed
- `customer.subscription.updated`: processed

### Portal do Cliente validado

- Botao `Gerenciar assinatura (cancelar)` abriu `billing.stripe.com` em modo teste.
- Portal exibiu assinatura atual `ImobQR Starter (teste)`.
- Portal exibiu valor `R$ 150,00 por mês`.
- Portal exibiu proxima cobranca em `2 de julho de 2026`.
- Portal exibiu fatura paga e link `Cancelar assinatura`.
- A assinatura nao foi cancelada para manter a conta de homologacao ativa para revisao humana.

### Observacao importante

A primeira consulta detectou `status=pro_active` apos o pagamento. A causa foi um webhook antigo ainda ativo apontando para um Preview antigo. Esse endpoint foi desativado e o evento correto foi reenviado ao webhook novo, deixando a assinatura em `starter_active`.

### Producao

Nenhum deploy de producao foi executado. Nenhuma chave live foi usada.
