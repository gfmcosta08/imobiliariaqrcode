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
