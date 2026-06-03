# Revisao de checkout, cancelamento, reembolso e atendimento eletronico

Atualizado em: 2026-06-02

## Estado homologado

- O checkout online do Stripe foi ativado e validado somente em homologacao/staging.
- O ambiente validado foi `https://farollimoveis-staging.vercel.app`.
- Producao continua sem deploy automatico e exige aprovacao humana separada.
- O plano comercial vigente homologado e o Starter: R$ 150,00/mes, anuncios ilimitados, QR Codes, leads, bot WhatsApp e demais beneficios do sistema.
- O checkout exige aceite previo de Termos de Uso, Politica de Privacidade e Cancelamento/Reembolso.
- O aceite e registrado em `checkout_legal_acceptance_events` com versoes dos documentos.

## Ajustes executados em homologacao

- Criada a pagina publica `/cancelamento-e-reembolso`.
- Adicionado canal eletronico para solicitacao de cancelamento: `gpmcosta@gmail.com`.
- Adicionados links para Termos, Privacidade, remocao de conteudo e cancelamento na pagina de planos.
- Criado resumo antes do pagamento com preco, periodicidade, renovacao, beneficios, cancelamento e suporte.
- Implementado Checkout Stripe em modo assinatura para o Starter.
- Implementado Stripe Billing Portal para gerenciamento/cancelamento.
- Implementado webhook idempotente para eventos de assinatura.
- Desativados webhooks antigos de Preview que sobrescreviam status de assinatura.

## E2E validado em staging

- Checkout abriu em `checkout.stripe.com` em area restrita de teste.
- Produto: `ImobQR Starter (teste)`.
- Valor: R$ 150,00 por mes.
- Cartao teste: Visa final `4242`.
- Sessao Stripe: `complete` e `paid`.
- Banco final: `plan_code=starter`, `status=starter_active`.
- Portal do Cliente exibiu assinatura, fatura paga e link `Cancelar assinatura`.
- A assinatura de homologacao foi mantida ativa para revisao humana.

## Bloqueios antes de producao

### P0

- Revisar Termos, Privacidade, Cancelamento/Reembolso e contrato SaaS com advogado.
- Confirmar tratamento fiscal/nota/cobranca recorrente com contador.
- Confirmar DPA/suboperadores da Stripe, Supabase e Vercel.
- Repetir E2E em ambiente de pre-producao quando as variaveis live forem criadas.
- Configurar webhook live separado e remover qualquer endpoint antigo/duplicado.
- Garantir monitoramento pos-deploy e plano de rollback.
- Obter aprovacao humana explicita antes de qualquer deploy de producao.

### P1

- Criar protocolo formal de atendimento eletronico.
- Definir politica final de reembolso e direito de arrependimento conforme enquadramento juridico.
- Criar rotina periodica para auditar webhooks ativos no Stripe.
- Documentar playbook de conciliacao de pagamentos e assinaturas.

## Observacao B2B e consumidor

O enquadramento de cada cliente como consumidor ou contratante empresarial deve ser validado por advogado. A plataforma deve adotar transparencia e facilidade de cancelamento como padrao, mesmo quando o caso concreto exigir analise adicional.

## Fontes

- Decreto 7.962/2013: https://www.planalto.gov.br/ccivil_03/_Ato2011-2014/2013/Decreto/D7962.htm
- CDC: https://www.planalto.gov.br/ccivil_03/leis/L8078compilado.htm
- Stripe subscriptions: https://docs.stripe.com/billing/subscriptions/designing-integration
- Stripe Customer Portal: https://docs.stripe.com/customer-management/integrate-customer-portal
- Evidencia interna: `docs/compliance/evidencias/HOMOLOGACAO_FREE_STARTER_CORTESIA_STRIPE_2026-06-02.md`
