# Free, Starter, Stripe e Cortesia em Homologacao

Data: 2026-06-02

## Objetivo

Implementar e validar em homologacao o catalogo comercial Free + Starter, a cobranca recorrente Stripe em modo teste e a edicao administrativa de cortesias. Nenhuma alteracao podera ser aplicada diretamente em producao.

## Trava Obrigatoria de Ambiente

- Banco permitido para migrations e testes com escrita: Supabase staging `coeuoyeydqoslhvbbojx`.
- Site permitido para deploy e testes remotos: `https://farollimoveis-staging.vercel.app`.
- Stripe permitido: exclusivamente chaves `sk_test_`, produto e preco de teste, webhook de teste e Customer Portal de teste.
- Bot e WhatsApp real: fora do escopo ate existir numero dedicado e allowlist de homologacao.
- Producao: nao recebera migration, variavel, alias, deploy ou teste com escrita nesta etapa.
- Se qualquer recurso critico apontar para producao ou estiver compartilhado com producao, interromper a aplicacao e classificar como risco P0.

## Planos Comerciais

### Free

- Gratuito por 30 dias.
- Permite somente 1 anuncio ativo.
- Nao possui cobranca nem renovacao automatica.

### Starter

- Assinatura recorrente de R$ 150,00 por mes.
- Renovacao automatica ate cancelamento.
- Anuncios ilimitados.
- QR Codes, captura de leads, WhatsApp normal, bot e demais beneficios do sistema.
- Bot real nao sera exercitado em homologacao enquanto faltar numero dedicado.

## Convite Cortesia

O convite cortesia continua sendo uma concessao gratuita administrada pelo painel admin. Ele nao deve ser confundido com a avaliacao Free padrao.

### Criacao

Ao gerar um convite, o admin informa:

- quantidade permitida de imoveis;
- validade da cortesia.

### Edicao Posterior

O admin podera editar quantidade e validade mesmo depois que o convite for ativado.

### Reducao de Quantidade

Quando o novo limite for inferior ao numero de imoveis ativos:

- manter ativos os imoveis mais recentes;
- arquivar automaticamente os imoveis excedentes mais antigos;
- nunca apagar imoveis;
- desativar os QR Codes ativos dos imoveis arquivados;
- registrar os imoveis afetados na auditoria.

### Validade Vencida

Quando o admin definir uma validade ja vencida:

- expirar imediatamente a cortesia;
- arquivar todos os anuncios ativos vinculados;
- desativar seus QR Codes ativos;
- impedir novos anuncios enquanto a cortesia permanecer vencida;
- registrar a alteracao na auditoria.

### Atomicidade

A edicao da cortesia sera implementada como operacao transacional no Supabase. Convite, assinatura, imoveis, QR Codes e auditoria devem mudar juntos ou permanecer inalterados em caso de erro.

## Auditoria

Cada alteracao administrativa de cortesia registrara:

- admin responsavel;
- conta e convite afetados;
- data e hora;
- limite anterior e novo;
- validade anterior e nova;
- status anterior e novo;
- imoveis arquivados;
- motivo da alteracao.

## Stripe Test Mode

- Usar Stripe Billing APIs com Checkout Sessions em `mode: "subscription"`.
- Criar produto e Price de teste Starter mensal de R$ 150,00.
- Validar assinatura do webhook.
- Garantir idempotencia para eventos duplicados.
- Sincronizar pagamento aprovado, falha de pagamento, atualizacao e cancelamento.
- Usar Customer Portal para cancelamento simples.
- Impedir qualquer uso de chave `sk_live_` em homologacao.

## Aceites Legais

- Cadastro exige aceite versionado dos Termos de Uso e Politica de Privacidade.
- Checkout exige aceite versionado dos Termos de Uso, Politica de Privacidade e regras de cancelamento e reembolso.
- Falha ao persistir aceite interrompe o fluxo; nao pode ocorrer sucesso silencioso.
- Os documentos completos ja preparados devem permanecer como fonte principal. Textos resumidos nao substituem revisao juridica.

## Migration e Rollback

Antes de aplicar a migration em staging:

- gerar backup ou snapshot verificavel;
- revisar referencias aos planos legados;
- produzir SQL de rollback;
- validar que a migration atua exclusivamente no Supabase staging;
- evitar remocao destrutiva de dados enquanto a compatibilidade nao estiver comprovada.

## Testes Obrigatorios

### Automatizados

- aumento de limite da cortesia;
- reducao preservando os imoveis mais recentes;
- arquivamento dos excedentes mais antigos;
- desativacao dos QR Codes arquivados;
- expiracao imediata por validade vencida;
- auditoria administrativa;
- persistencia obrigatoria dos aceites legais;
- webhook Stripe com assinatura valida e invalida;
- webhook Stripe duplicado;
- pagamento aprovado;
- pagamento falho;
- cancelamento;
- portal de assinatura.

### Homologacao Remota

- Free por 30 dias e limite de 1 anuncio;
- Starter por R$ 150,00 mensais em Stripe test mode;
- cadastro, login, anuncios, uploads, QR Codes e leads;
- admin gera convite cortesia;
- admin edita cortesia antes e depois da ativacao;
- reducao e expiracao produzem os efeitos definidos;
- nenhuma mensagem real do bot e disparada.

## Evidencias e Promocao

- Registrar comandos, resultados, URLs de preview, migrations, rollback e evidencias no Obsidian.
- Produzir checklist para aprovacao humana.
- Nao considerar apto para producao enquanto houver erro verificavel ou requisito sem teste.
- Nunca fazer deploy em producao automaticamente.

## Resultado Executado - 2026-06-02

Este documento foi executado em homologacao na branch `codex/homologacao-segura`.

Resultado final validado:

- Free permanece com 30 dias e 1 anuncio ativo.
- Starter foi homologado por R$ 150,00/mes com anuncios ilimitados.
- Cortesia Admin ficou editavel antes/depois da ativacao, com auditoria e arquivamento automatico quando necessario.
- Stripe Checkout, webhook e Billing Portal foram validados em modo teste.
- O webhook antigo de Preview foi identificado como causa de sobrescrita para `pro_active` e foi desativado.
- O banco de homologacao ficou correto em `plan_code=starter` e `status=starter_active`.
- Aceites juridicos foram persistidos antes do checkout.
- Producao nao foi alterada.
- Bot real segue adiado por falta de numero exclusivo de teste.

Evidencia completa: `docs/compliance/evidencias/HOMOLOGACAO_FREE_STARTER_CORTESIA_STRIPE_2026-06-02.md`.
