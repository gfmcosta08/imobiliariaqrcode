# Revisao de checkout, cancelamento, reembolso e atendimento eletronico

Atualizado em: 2026-06-02

## Estado encontrado

- O checkout online do Stripe esta desativado em `apps/web/src/app/api/stripe/create-checkout/route.ts`.
- O catalogo de planos informa que a contratacao e temporariamente comercial.
- Existem webhooks e stubs de provedores, mas isso nao significa que a cobranca online esteja pronta
  para producao.

## Ajustes executados em homologacao

- Criada a pagina publica `/cancelamento-e-reembolso`.
- Adicionado canal eletronico temporario para solicitacao de cancelamento.
- Adicionados links para Termos, Privacidade, remocao de conteudo e cancelamento na pagina de planos.
- Adicionado aviso para confirmar preco total, periodicidade, renovacao, beneficios, cancelamento e
  reembolso antes da contratacao manual.

## Revisao do fluxo atual

Enquanto o checkout permanecer desativado:

1. Toda proposta comercial deve informar por escrito plano, valor total, periodicidade, vencimento,
   renovacao, beneficios, limites, cancelamento, atendimento e reembolso.
2. O aceite da proposta e do contrato deve ser guardado.
3. Pedidos recebidos pelo canal eletronico devem gerar protocolo e resposta.
4. Nao prometer renovacao automatica, estorno ou prazo que nao esteja implementado.

## Bloqueios antes de ativar checkout online

### P0

- Confirmar fornecedor, CNPJ, endereco e canal eletronico em destaque.
- Exibir resumo completo imediatamente antes da confirmacao.
- Implementar caminho simples de cancelamento.
- Tratar direito de arrependimento quando aplicavel a relacao de consumo.
- Revisar webhook Stripe para idempotencia, recuperacao, logs sem segredos e testes.
- Implementar ambiente Stripe de teste separado.
- Registrar aceite e versao dos termos aplicaveis a compra.

### P1

- Usar Stripe Billing com Checkout em modo assinatura para planos recorrentes.
- Disponibilizar Stripe Customer Portal ou fluxo proprio equivalente para administracao e
  cancelamento.
- Criar politica contratual final de reembolso.
- Definir atendimento eletronico, protocolo e prazo de resposta.

## Observacao B2B e consumidor

O enquadramento de cada cliente como consumidor ou contratante empresarial deve ser validado por
advogado. A plataforma deve adotar transparencia e facilidade de cancelamento como padrao, mesmo
quando o caso concreto exigir analise adicional.

## Fontes

- Decreto 7.962/2013: https://www.planalto.gov.br/ccivil_03/_Ato2011-2014/2013/Decreto/D7962.htm
- CDC: https://www.planalto.gov.br/ccivil_03/leis/L8078compilado.htm
- Stripe subscriptions: https://docs.stripe.com/billing/subscriptions/designing-integration
- Stripe Customer Portal: https://docs.stripe.com/customer-management/integrate-customer-portal
