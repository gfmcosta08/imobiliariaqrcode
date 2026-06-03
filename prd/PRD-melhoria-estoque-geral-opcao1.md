# PRD — Melhoria na Opção 1 após o cliente visualizar múltiplos imóveis (inclui “Estoque Geral”)

**Status:** Draft (v1)  
**Data:** 2026-04-24  
**Produto/Módulo:** Bot WhatsApp (fluxo via QR Code) + Busca no estoque geral + Notificações ao corretor

## 1) Contexto

O fluxo atual do bot (já implementado e funcionando) segue a lógica:

1. O cliente inicia a conversa via **leitura de QR Code** (mensagem pré-cadastrada).
2. O bot busca imóveis primeiro no **estoque do corretor** associado ao QR Code.
3. Se não encontrar opções, amplia a busca para o **estoque geral** (imóveis de todos os corretores do sistema).

O menu atual do bot possui (entre outras) a **Opção 1: “Falar com o corretor sobre este imóvel”**, que hoje notifica o corretor do QR Code com os dados do lead e o identificador do imóvel.

### 1.1 Problema

Quando o cliente visualiza uma **lista com múltiplos imóveis** (ex.: resultado do **estoque geral**, ou paginação de resultados/sugestões), ao selecionar a Opção 1 o sistema precisa:

- **descobrir de qual imóvel** o cliente está falando (pois foram exibidas várias opções); e
- quando estiver no **estoque geral**, **rotear corretamente** a notificação, preservando o corretor captador (do QR Code), mas incluindo o **dono real do anúncio** quando aplicável.

## 2) Objetivo

Ao cliente selecionar a **Opção 1** após ter visualizado **múltiplos imóveis** (ex.: numa listagem/página de resultados), o bot deve:

1. perguntar qual é o **ID do imóvel (ID do sistema)** sobre o qual deseja falar;
2. localizar o imóvel e identificar o **dono do anúncio**;
3. seguir uma de duas rotas:

- **Cenário A:** dono do anúncio = corretor do QR Code → manter o fluxo atual, sem mudanças (apenas agora com o ID explicitamente informado pelo cliente).
- **Cenário B:** dono do anúncio ≠ corretor do QR Code → notificar o corretor captador (QR Code), mas **enriquecendo a mensagem** com os dados do dono do anúncio.

## 3) Premissas e definições

### 3.1 Entidades

- **Corretor captador:** corretor associado ao **QR Code** lido (origem do lead).
- **Dono do anúncio:** corretor ao qual o imóvel selecionado (no estoque geral) pertence.
- **Lead:** cliente (nome e telefone) que iniciou conversa via QR Code.

### 3.2 Definição de “ID do imóvel”

O **ID do imóvel** solicitado ao cliente é o **ID do sistema** (identificador único do imóvel no sistema), que deve ser exibido junto às opções quando o bot listar imóveis.

Recomendação:

- Usar **sempre** o _ID do sistema_ como “chave canônica” para consulta do imóvel.
- Se existir também um _código público_, ele pode continuar sendo exibido, mas o bot deve orientar o cliente a informar o **ID do sistema**.

## 4) Escopo (o que será implementado)

### 4.1 Mudança de fluxo: Opção 1 após listagem (inclui estoque geral)

Quando o cliente estiver em um contexto onde **viu mais de um imóvel** (ex.: listagem/página de resultados) e selecionar a **Opção 1**, o bot deve:

1. Perguntar: **“Qual o ID do imóvel sobre o qual você deseja falar?”**
2. Aguardar a resposta do cliente contendo o ID.
3. Validar o ID e localizar o imóvel correspondente.
4. Identificar o corretor dono do anúncio do imóvel.
5. Executar o roteamento:
   - **Cenário A:** dono do anúncio = corretor captador (QR Code) → executar fluxo atual.
   - **Cenário B:** dono do anúncio ≠ corretor captador (QR Code) → notificar corretor captador com mensagem atualizada (seção 5).

### 4.2 Fora de escopo

- Alterar o conteúdo/roteamento das notificações fora da Opção 1 (ex.: Opção 2 e Opção 3).
- Alterar a forma de busca, ranking ou paginação dos imóveis do estoque geral.
- Alterar integrações externas (apenas conteúdo/roteamento da notificação).

## 5) Conteúdo das mensagens

### 5.1 Mensagem ao cliente (pergunta de identificação)

**Trigger:** cliente seleciona Opção 1 após ter visualizado **múltiplos imóveis** (independente de serem do estoque do corretor ou do estoque geral).

**Mensagem:**

> Qual o ID do imóvel sobre o qual você deseja falar?

### 5.2 Mensagem ao corretor captador — Cenário B (novo template)

**Condição:** imóvel selecionado pertence a outro corretor (dono do anúncio ≠ corretor captador).

**Mensagem deve conter (nesta ordem ou equivalente):**

1. **Alerta:** “Alerta de novo lead para visita.”
2. **Dados do lead (QR Code):**
   - Nome do lead
   - Telefone do lead
3. **Dados do imóvel:**
   - ID do imóvel escolhido
4. **Dados do dono do anúncio:**
   - Nome do corretor dono do anúncio
   - Telefone/contato do corretor dono do anúncio

> **Observação:** a notificação continua indo para o **corretor captador** (QR Code), mesmo quando o imóvel for de outro corretor.

### 5.3 Mensagem ao corretor captador — Cenário A (sem mudança)

Quando o imóvel selecionado pertence ao corretor do QR Code, manter exatamente a notificação atual (sem alterações no conteúdo).

## 6) Requisitos funcionais

### RF1 — Detecção de contexto “multi-imóvel”

O bot deve distinguir quando a Opção 1 foi acionada após o cliente ter visualizado **múltiplos imóveis** (ex.: uma lista/página de resultados) e, nesse caso, solicitar o ID do imóvel para identificar com precisão a escolha do cliente.

Observação:

- Quando o cliente tiver visto apenas **um** imóvel (ex.: o imóvel base inicial do QR Code) o fluxo atual pode continuar sem pergunta do ID, pois o contexto é unívoco.

### RF2 — Coleta do ID do imóvel

Ao acionar a Opção 1 em contexto “multi-imóvel”, o bot deve solicitar o ID do imóvel e manter o estado até receber uma resposta válida ou até expirar a sessão.

### RF3 — Validação do ID

Ao receber o ID, o bot deve:

- localizar o imóvel;
- se **não encontrar**, responder uma mensagem de erro e pedir o ID novamente.

**Mensagem sugerida (erro):**

> Não encontrei esse imóvel. Por favor, informe novamente o ID do imóvel.

### RF4 — Identificação do dono do anúncio

Localizado o imóvel, o bot deve obter o corretor ao qual o anúncio pertence (nome e telefone/contato).

### RF5 — Roteamento A/B

Com o corretor dono do anúncio identificado, o bot deve:

- **Cenário A:** se dono do anúncio = corretor do QR Code → seguir fluxo atual.
- **Cenário B:** se dono do anúncio ≠ corretor do QR Code → enviar notificação ao corretor do QR Code usando o novo template (seção 5.2).

## 7) Regras de estado (sessão)

O bot deve manter em sessão:

- `corretor_captador_id` (do QR Code)
- `lead_nome`, `lead_telefone`
- um indicador de **contexto multi-imóvel** (ex.: `modo_lista_imoveis=true` e, se aplicável, a origem `fonte_lista=corretor|geral`)
- um indicador de que está aguardando `imovel_id_para_falar` (após Opção 1 em contexto multi-imóvel)

## 8) Critérios de aceitação

### CA1 — Pergunta obrigatória do ID em contexto multi-imóvel

Dado que o cliente visualizou múltiplos imóveis (ex.: listagem/página de resultados), quando selecionar Opção 1, então o bot deve perguntar “Qual o ID do imóvel sobre o qual você deseja falar?”.

### CA2 — Cenário A (sem mudança)

Dado que o cliente informou um ID cujo imóvel pertence ao corretor do QR Code, quando o bot processar a solicitação, então deve executar o mesmo fluxo/notificação atual, sem mudanças.

### CA3 — Cenário B (mensagem enriquecida)

Dado que o cliente informou um ID cujo imóvel pertence a outro corretor, quando o bot processar a solicitação, então deve enviar notificação ao corretor do QR Code contendo:

- alerta de novo lead;
- nome e telefone do lead;
- ID do imóvel;
- nome e telefone do dono do anúncio.

### CA4 — ID inválido

Dado que o cliente informou um ID inexistente, quando o bot validar, então deve informar que não encontrou e solicitar novamente o ID.

## 9) Observabilidade (recomendado)

Eventos sugeridos:

- `option1_selected_in_multi_property_context` (lead_id/telefone, corretor_captador_id, fonte_lista=corretor|geral)
- `option1_property_id_received` (imovel_id_digitado)
- `option1_property_not_found` (imovel_id_digitado)
- `option1_routing_decided` (scenario=A|B, corretor_captador_id, corretor_dono_id, imovel_id)
- `option1_notification_sent` (scenario=A|B)

## 10) Riscos e considerações

- **Ambiguidade de identificador:** se o “ID exibido” não for unívoco (ex.: código repetido), deve ser padronizado para um identificador único.
- **UX:** se o cliente digitar algo fora do formato esperado, retornar mensagem objetiva e pedir novamente.
- **Privacidade:** garantir que o compartilhamento do contato do dono do anúncio na notificação respeite as políticas internas do produto.

## Alinhamento De Homologacao - 2026-06-02

Este PRD deve ser interpretado em conjunto com o pacote homologado na branch `codex/homologacao-segura`, documentado em `docs/compliance/evidencias/HOMOLOGACAO_FREE_STARTER_CORTESIA_STRIPE_2026-06-02.md`.

Regras vigentes de produto/ambiente apos a homologacao:

- Toda implementacao e teste deve ocorrer primeiro em homologacao: `https://farollimoveis-staging.vercel.app`.
- Producao nao pode receber deploy automatico; exige aprovacao humana separada.
- Plano Free vigente: 30 dias, 1 anuncio ativo, sem cobranca automatica.
- Plano Starter vigente em homologacao: R$ 150,00/mes, anuncios ilimitados, QR Codes, leads, bot WhatsApp e demais beneficios do sistema.
- Checkout Stripe foi validado somente em modo teste, com chave `sk_test_`, preco `STRIPE_PRICE_STARTER` e webhook exclusivo de staging.
- Webhooks Stripe antigos de Preview foram desativados para impedir sobrescrita por codigo antigo.
- Assinatura de teste validada: `plan_code=starter`, `status=starter_active`, via Stripe Checkout e Billing Portal.
- Antes do checkout, o usuario precisa aceitar Termos de Uso, Politica de Privacidade e Cancelamento/Reembolso; o aceite e registrado em trilha append-only.
- Admin pode gerar convite cortesia e editar limite de imoveis/data de validade mesmo apos ativacao; reducao de limite arquiva anuncios antigos e expiracao retroativa arquiva ativos e invalida QR Codes.
- Qualquer PRD de bot/WhatsApp continua bloqueado para E2E real ate existir numero exclusivo de teste e allowlist de homologacao.

Impacto neste PRD:

- Se este PRD mencionar PRO, Solo, Premium ou checkout desativado, considere essas referencias historicas/substituidas para o escopo comercial atual por Free + Starter, salvo quando o texto tratar explicitamente de legado.
- Se este PRD tocar cadastro, anuncios, QR, leads, planos, billing, aceite legal, admin ou bot, os testes devem incluir os guardrails de homologacao e a verificacao de que producao nao foi alterada.
