# PRD — Melhorias no Bot de Imóveis (Sistema Existente)

**Status:** Draft (v1)  
**Data:** 2026-04-24  
**Autor:** (preencher)  
**Produto/Módulo:** Bot (fluxo via QR Code) + Catálogo de imóveis + Busca de semelhantes

## 1) Contexto

Este PRD descreve **alterações e adições** em um **sistema já existente** (bot de imóveis). O usuário final (cliente) interage com o bot; há também o painel/cadastro do **corretor**, que mantém anúncios e atributos do imóvel.

O fluxo atual é iniciado por **leitura de QR Code** (mensagem pré-cadastrada). Existe um **menu** no bot (já cadastrado) com **3 opções**, incluindo a **opção 2: “ver imóveis semelhantes”**.

**Canal:** WhatsApp.

### 1.1) Menu atual (3 opções)

1. **Falar com o corretor sobre esse imóvel** — bot envia para o corretor as informações sobre o cliente que entrou em contato, junto com o identificador do imóvel.
2. **Ver imóveis semelhantes** — mudança descrita na seção 6.
3. **Quero o contato do corretor** — bot envia para o cliente as informações do corretor.

## 2) Problema / Oportunidade

Quando o cliente pede imóveis semelhantes, o bot deve priorizar o estoque do **corretor responsável** pelo imóvel apresentado e entregar resultados em **lotes paginados (5 em 5)**, reduzindo fricção e aumentando a chance de conversão sem exigir nova busca manual.

## 3) Objetivos (o que queremos alcançar)

- Melhorar a relevância: **priorizar imóveis semelhantes do mesmo corretor**.
- Melhorar a experiência: apresentar alternativas em **batches de 5**, com navegação clara (“ver mais” via opção 2).
- Garantir fallback: se não houver semelhantes suficientes no corretor, buscar no **estoque geral** do sistema.

## 4) Não-objetivos (fora de escopo)

- Alterar o cadastro de imóveis/campos do corretor (a não ser que seja necessário para cálculo de compatibilidade).
- Criar um novo menu do zero (o PRD assume que o menu de 3 opções já existe; apenas o comportamento da opção 2 muda).
- Mudanças de UI/branding do bot além de mensagens necessárias para o fluxo.

## 5) Premissas e definições

### 5.1. Entidades

- **Imóvel base:** imóvel que acabou de ser apresentado ao cliente e a partir do qual o “semelhante” será calculado.
- **Corretor do imóvel base:** corretor associado ao imóvel base.
- **Estoque do corretor:** imóveis anunciados/cadastrados por esse corretor.
- **Estoque geral:** todos os imóveis do sistema (todos os corretores).

### 5.2. “Compatibilidade / Semelhança”

- Cada campo preenchido no cadastro do imóvel é um **item de filtro**.
- A compatibilidade é calculada como uma **porcentagem**.
- Requisito de negócio informado:
  - iniciar em **100%** e ir “baixando” até **51%** para encontrar opções;
  - apresentar resultados **de 5 em 5**;
  - priorizar estoque do corretor; se insuficiente, usar estoque geral.

**Regras confirmadas:**

- Todos os campos têm o **mesmo peso** no cálculo de compatibilidade.
- Campos vazios no imóvel base ou candidato: **ignorar** (não entram no denominador do cálculo).
- Passo de redução do score: **de 5 em 5** (100 → 95 → 90 → ... → 55 → 51).

### 5.3. Campos que entram no cálculo de compatibilidade (lista exata)

**Regra geral:** entram no cálculo os campos abaixo (todos com o mesmo peso), **exceto** os campos explicitamente listados em **“Exclusões”**.

#### Exclusões (não entram no cálculo)

- ID do Imóvel (automático)
- Código Interno
- Status do Imóvel
- Data de Cadastro
- Data de Atualização
- Latitude / Longitude
- Matrícula do Imóvel
- Imagens do Imóvel

#### Campos incluídos

**Dados básicos**

- Tipo de Imóvel
- Subtipo de Imóvel
- Finalidade

**Anúncio**

- Título do Anúncio
- Descrição Completa
- Diferenciais do Imóvel

**Valores**

- Preço de Venda
- Valor de Aluguel/Temporada
- Valor do Condomínio
- Valor do IPTU
- Outras Taxas
- Aceita Financiamento
- Aceita Permuta

**Áreas e cômodos**

- Área Total
- Área Construída
- Área do Terreno
- Número de Quartos
- Número de Suítes
- Número de Banheiros
- Número de Vagas de Garagem
- Número de Salas
- Número de Andares
- Andar do Imóvel
- Mobiliado
- Tipo de Piso
- Posição Solar
- Idade do Imóvel

**Endereço**

- Endereço Completo
- Número
- Complemento
- Bairro
- Cidade
- Estado / UF
- CEP

**Características e infraestrutura**

- Características
- Infraestrutura
- Segurança
- Chave Disponível
- Imóvel Ocupado

**Documentação e detalhes técnicos**

- Documentação
- Detalhes Técnicos Avançados
- Tipo de Construção
- Padrão de Acabamento
- Situação da Documentação
- Possui Escritura
- Possui Registro

**Localização estratégica**

- Proximidades
- Distância do Centro
- Região da Cidade

**Observações**

- Observações do Corretor

## 6) Escopo — Mudança 1 (Opção 2: Ver imóveis semelhantes)

### 6.1. Regra principal (ordem de busca)

Quando o cliente selecionar **opção 2 (ver imóveis semelhantes)**, o bot deve:

1. Buscar imóveis semelhantes **primeiro no estoque do corretor** do imóvel base.
2. Considerar compatibilidade **de 100% até 51%** (decrescendo).
3. Apresentar imóveis em **lotes de 5**.
4. Após cada lote de 5, reenviar o **menu existente de 3 opções**.
5. Se o cliente escolher novamente “ver imóveis semelhantes” (opção 2), enviar o **próximo lote de 5** seguindo a ordem de compatibilidade.
6. Se **não encontrar** imóveis suficientes no corretor (considerando 100%→51%), então repetir a busca no **estoque geral**, mantendo:
   - compatibilidade 100%→51%;
   - lotes de 5;
   - menu ao final de cada lote.

### 6.2. Paginação / estado da conversa

O bot deve manter estado da sessão para:

- saber qual foi o **imóvel base**;
- saber se já está em “modo semelhantes”;
- saber quais imóveis já foram mostrados para **não repetir**;
- saber o “cursor” da paginação (ex.: quais compatibilidades e quais IDs já enviados).

**Regra anti-duplicação (recomendado):**

- Não mostrar o **mesmo imóvel** em lotes seguintes dentro da mesma sessão para o mesmo imóvel base.
- Não sugerir o **próprio imóvel base** (excluir por ID).

### 6.3. Ordenação dos resultados

Dentro de cada compatibilidade:

- priorizar maior compatibilidade primeiro.
- se houver mais que 5 com a mesma compatibilidade, completar o lote com os primeiros 5 ordenados por critério de desempate.

**Critério de desempate (confirmado):**

- Priorizar o imóvel que foi **cadastrado primeiro** no sistema.

### 6.4. Conteúdo da mensagem de cada imóvel

O bot deve enviar a apresentação de cada imóvel em **mensagem WhatsApp** (formato texto), contendo no mínimo:

- Título do anúncio
- Código do imóvel para referência do cliente (se houver código público) **ou** identificador/“ID” exibível ao cliente
- Finalidade (venda/aluguel/temporada)
- Valores aplicáveis (ex.: preço de venda ou valor de aluguel) + condomínio/IPTU (se preenchidos)
- Localização resumida (bairro, cidade/UF)
- Principais atributos: área total (se houver) + quartos/suítes/banheiros/vagas
- Link, mídia ou instrução para ver fotos (conforme padrão atual do canal)

**Observação:** o menu de 3 opções deve ser enviado ao final de cada lote de 5 imóveis.

### 6.5. Critérios de parada

O fluxo de “semelhantes” pode parar quando:

- não existirem mais imóveis para sugerir acima de 51% no corretor e no estoque geral; **ou**
- o cliente escolher uma opção do menu que não seja “ver imóveis semelhantes”; **ou**
- expirar a sessão (timeout padrão do bot).

## 7) Requisitos funcionais (Mudança 1)

### RF1 — Priorizar estoque do corretor

Ao acionar opção 2, o bot **deve** buscar semelhantes no cadastro/anúncios do corretor associado ao imóvel base.

### RF2 — Similaridade por campos do imóvel

O comparativo **deve** usar os campos já cadastrados do imóvel como itens de filtro e produzir um score de compatibilidade (%).

### RF3 — Compatibilidade decrescente 100% → 51%

O bot **deve** começar tentando 100% e reduzir gradualmente até 51% para encontrar imóveis.

**Step (confirmado):** reduzir **de 5 em 5** pontos percentuais até 51%.

### RF4 — Envio em lotes de 5

O bot **deve** enviar até 5 imóveis por página/lote.

### RF5 — Menu ao final do lote

Após enviar um lote de até 5 imóveis, o bot **deve** enviar o menu existente de 3 opções.

### RF6 — “Ver mais” ao selecionar opção 2 novamente

Se o cliente selecionar novamente “ver imóveis semelhantes”, o bot **deve** enviar o próximo lote de 5, continuando do ponto onde parou (sem repetir imóveis).

### RF7 — Fallback para estoque geral

Se não houver imóveis suficientes (do corretor) entre 100% e 51%, o bot **deve** buscar no estoque geral com as mesmas regras (100%→51%, 5 em 5, menu ao final).

### RF8 — Resposta quando não houver resultados

Se, após buscar no corretor e no estoque geral (100%→51%), não houver imóveis para sugerir, o bot **deve**:

- informar que não encontrou imóveis semelhantes; e
- apresentar o menu existente de 3 opções (para o cliente seguir outro caminho).

## 8) Critérios de aceitação (Mudança 1)

### CA1 — Prioridade do corretor

Dado um imóvel base do corretor X, quando o cliente selecionar opção 2, então os primeiros resultados devem ser apenas do corretor X (enquanto existirem candidatos dentro de 100%→51%).

### CA2 — Paginação

Quando houver mais de 5 candidatos, então o bot deve enviar apenas 5 e apresentar o menu.  
Quando o cliente selecionar opção 2 novamente, então o bot deve enviar os próximos 5 (sem repetir).

### CA3 — Compatibilidade mínima

O bot não deve sugerir imóveis com compatibilidade abaixo de 51%.

### CA4 — Fallback

Se não existirem candidatos no corretor X (100%→51%), então o bot deve buscar no estoque geral e seguir o mesmo padrão de paginação.

### CA5 — Sem resultados

Se não houver candidatos nem no corretor nem no estoque geral (100%→51%), então o bot deve informar “não encontramos imóveis semelhantes” e enviar o menu.

## 9) Observabilidade (recomendado)

Eventos/metrics recomendados:

- `similar_search_started` (com `imovel_base_id`, `corretor_id`, canal)
- `similar_results_page_sent` (page_number, count, source=corretor|geral, min_score, max_score)
- `similar_exhausted` (sem mais resultados)
- CTR/engajamento: quantas vezes opção 2 é selecionada, e em qual página o cliente sai.

## 10) Mudança 2 (a detalhar)

Confirmado: a **Mudança 2** é o comportamento descrito na seção 10.1 (mensagens fora do fluxo do QR Code / mensagem pré-cadastrada).

### 10.1. Comportamento citado (fora do QR Code / mensagem pré-cadastrada)

**Requisito (Mudança 2):**

- Se alguém enviar qualquer mensagem ao bot que **não seja** a mensagem pré-cadastrada pela leitura do QR Code, o bot deve responder:
  - **“Informe o imóvel para o qual deseja informação.”**
- Se o cliente informar um **código de imóvel correto**, o bot responde com as informações do imóvel.
- Se informar um **código incorreto**, o bot repete a mensagem:
  - **“Informe o imóvel para o qual deseja informação.”**

#### RF10.1 — Mensagens fora do fluxo do QR Code

O bot deve detectar quando a conversa não foi iniciada pela mensagem pré-cadastrada do QR Code e, nesse caso, orientar o usuário a informar um código de imóvel.

#### RF10.2 — Validação do código do imóvel

Quando o usuário enviar um código:

- se o código existir, o bot deve responder com as informações do imóvel correspondente;
- se o código não existir, o bot deve repetir a instrução **“Informe o imóvel para o qual deseja informação.”**

#### CA10 — Critérios de aceitação (Mudança 2)

- **CA10.1**: Dado que a conversa não foi iniciada por QR Code, quando o usuário enviar uma mensagem livre, então o bot responde **“Informe o imóvel para o qual deseja informação.”**
- **CA10.2**: Dado que o usuário informou um código válido, então o bot retorna as informações do imóvel.
- **CA10.3**: Dado que o usuário informou um código inválido, então o bot repete **“Informe o imóvel para o qual deseja informação.”**

## 11) Perguntas em aberto (para fechar o PRD)

Sem pendências de definição nesta versão.

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
