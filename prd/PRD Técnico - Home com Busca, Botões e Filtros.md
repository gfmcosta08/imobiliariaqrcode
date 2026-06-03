# PRD Técnico — Home com Busca, Botões e Filtros Integrados ao Cadastro de Imóveis

## 1. Objetivo

Este documento complementa o PRD funcional da home e detalha o comportamento técnico esperado para:

- publicação automática de imóveis na home;
- funcionamento do campo de busca;
- funcionamento dos botões `Comprar`, `Alugar` e `Anunciar`;
- funcionamento dos filtros baseados no cadastro do imóvel;
- reaproveitamento de campos `dropdown` do cadastro como filtros públicos.

Este material serve como referência para produto, desenvolvimento, QA e homologação.

## 2. Contexto Técnico

A home já possui:

- banner principal;
- botões `Comprar`, `Alugar` e `Anunciar`;
- campo de busca;
- área de exibição de imóveis.

O problema atual é que esses elementos visuais não estão plenamente conectados à base de imóveis cadastrados e às regras do site.

## 3. Princípios de Solução

### 3.1. Fonte única de dados

Todos os dados da home devem vir do **cadastro do imóvel**, sem duplicação manual de informações em outra estrutura.

### 3.2. Regra única de elegibilidade

O mesmo conjunto de regras que define se um imóvel está “anunciado/publicado/ativo” deve governar:

- presença na home;
- presença na busca;
- presença nos filtros;
- presença nos resultados de `Comprar` e `Alugar`.

### 3.3. Filtros públicos derivados do cadastro

Os filtros da home não devem ser inventados fora do cadastro. Eles devem ser derivados dos campos já existentes, com mapeamento claro.

### 3.4. Composição de critérios

Busca textual, botões de intenção e filtros devem funcionar em conjunto, sem conflito.

## 4. Modelo Conceitual dos Resultados da Home

Cada item retornado para a home deve representar um imóvel elegível e conter, no mínimo:

- identificador do imóvel;
- título do anúncio;
- finalidade;
- status público;
- imagem principal;
- localização resumida;
- preço principal aplicável;
- atributos principais para exibição em card;
- link para a página do imóvel.

## 5. Regras de Elegibilidade para Exibição

Um imóvel só pode ser retornado para a home se atender aos critérios públicos do site.

### Regras mínimas recomendadas

- estar ativo;
- estar publicado/anunciado;
- não estar oculto;
- não estar excluído/arquivado;
- possuir finalidade válida;
- possuir conteúdo mínimo para vitrine pública.

### Conteúdo mínimo recomendado para vitrine

- título ou identificação de exibição;
- ao menos 1 imagem, se essa for a regra atual do site;
- localização mínima;
- preço, quando aplicável à finalidade;

> Caso o site já tenha outra regra, ela deve prevalecer. O importante é que a mesma regra seja reaproveitada em toda a home.

## 6. Comportamento da Home

### 6.1. Estado inicial

Ao carregar a home, o sistema deve:

- buscar imóveis elegíveis;
- exibir uma listagem inicial;
- permitir refino por botões, busca e filtros.

### 6.2. Estado sem filtro

Sem filtro algum, a home deve mostrar imóveis elegíveis conforme ordenação padrão definida pelo negócio.

### 6.3. Estado com contexto selecionado

Quando o usuário clicar em `Comprar` ou `Alugar`, a home deve mudar de contexto e restringir os resultados à finalidade correspondente.

## 7. Especificação do Campo de Busca

### 7.1. Objetivo da busca

Permitir que o usuário encontre imóveis por texto livre com base nos dados do cadastro.

### 7.2. Campos recomendados para indexação de busca

- título do anúncio;
- descrição completa;
- ID do imóvel;
- código interno;
- tipo de imóvel;
- subtipo de imóvel;
- bairro;
- cidade;
- UF;
- região da cidade;
- proximidades;
- observações relevantes, se permitido;
- endereço, quando a regra pública permitir.

### 7.3. Regras de comportamento

- a busca deve aceitar texto parcial;
- a busca deve ignorar diferenças simples entre maiúsculas/minúsculas;
- a busca deve funcionar em conjunto com filtros;
- a busca deve funcionar em conjunto com `Comprar` e `Alugar`;
- se o termo estiver vazio, o sistema deve voltar ao conjunto padrão do contexto atual.

### 7.4. Exemplos esperados

- buscar `apartamento` deve retornar imóveis com tipo/subtipo/título compatíveis;
- buscar `Moema` deve retornar imóveis relacionados ao bairro/cidade/região;
- buscar um código interno deve retornar o imóvel correspondente, se elegível;
- buscar `3 suítes` não precisa necessariamente interpretar linguagem natural nesta fase, a menos que isso já exista no site.

### 7.5. Comportamento do acionamento

O campo de busca deve funcionar:

- ao clicar no botão/lupa;
- e, se desejado pela regra do produto, também por tecla `Enter`.

## 8. Especificação dos Botões da Home

### 8.1. Botão `Comprar`

#### Objetivo

Exibir imóveis com finalidade de compra/venda.

#### Regras

- aplicar filtro de finalidade compatível com venda;
- atualizar resultados;
- manter demais filtros disponíveis;
- se o usuário já tiver filtros aplicados, eles devem continuar válidos dentro do contexto de compra.

### 8.2. Botão `Alugar`

#### Objetivo

Exibir imóveis com finalidade de aluguel.

#### Regras

- aplicar filtro de finalidade compatível com aluguel;
- se temporada fizer parte da lógica de aluguel, incluir conforme regra do site;
- atualizar os resultados mantendo coerência com demais filtros.

### 8.3. Botão `Anunciar`

#### Objetivo

Levar o usuário ao fluxo correto para anunciar imóvel.

#### Regras

- o botão não deve apenas existir visualmente; deve executar navegação real;
- o destino pode ser página de captação, formulário de contato, login, área do corretor ou formulário de anúncio, conforme a regra vigente do site;
- o fluxo deve ser consistente em desktop e mobile.

## 9. Estratégia de Filtros

Os filtros devem ser organizados por tipo de campo.

### 9.1. Filtros numéricos

Campos:

- Área Construída (m²)
- Área do Terreno (m²)
- Número de Quartos
- Número de Suítes
- Número de Banheiros
- Preço de Venda
- Valor de Aluguel/Temporada
- Valor do Condomínio
- Número de Vagas de Garagem
- Número de Salas

#### Regra recomendada

Para campos numéricos, suportar ao menos uma destas abordagens:

- mínimo e máximo;
- faixas prontas;
- seleção de quantidade mínima, quando fizer mais sentido.

#### Comportamento por campo

##### Área Construída (m²)

- aceitar filtro por faixa;
- exemplo: de `80` até `150`.

##### Área do Terreno (m²)

- aceitar filtro por faixa;
- exemplo: de `200` até `500`.

##### Número de Quartos

- aceitar valor exato ou mínimo;
- recomendação: `1+`, `2+`, `3+`, `4+`.

##### Número de Suítes

- aceitar valor exato ou mínimo;
- recomendação: `1+`, `2+`, `3+`.

##### Número de Banheiros

- aceitar valor exato ou mínimo.

##### Preço de Venda

- disponível no contexto `Comprar`;
- aceitar faixa de preço.

##### Valor de Aluguel/Temporada

- disponível no contexto `Alugar`;
- aceitar faixa de preço.

##### Valor do Condomínio

- aceitar faixa de valor.

##### Número de Vagas de Garagem

- aceitar valor exato ou mínimo.

##### Número de Salas

- aceitar valor exato ou mínimo.

### 9.2. Filtros booleanos

Campo:

- Mobiliado

#### Regra

- opções: `Sim`, `Não`;
- alternativamente `Todos`, `Sim`, `Não`.

### 9.3. Filtros de seleção / dropdown

Todo campo do cadastro que já possui opções controladas deve ser candidato a filtro.

Exemplos:

- Tipo de Imóvel
- Subtipo de Imóvel
- Finalidade
- Mobiliado
- Tipo de Piso
- Posição Solar
- Região da Cidade

#### Regra

- as opções exibidas na home devem vir do mesmo conjunto de valores válidos do cadastro;
- evitar duplicidade semântica, por exemplo: `Apartamento` e `apartamento`;
- idealmente, reutilizar a chave do cadastro e mostrar apenas o rótulo amigável na interface.

## 10. Regras de Visibilidade dos Filtros por Contexto

Alguns filtros podem ou devem variar conforme o contexto.

### Contexto `Comprar`

Deve priorizar:

- Preço de Venda;
- Área Construída;
- Área do Terreno;
- Quartos;
- Suítes;
- Banheiros;
- Vagas;
- Mobiliado;
- Salas.

### Contexto `Alugar`

Deve priorizar:

- Valor de Aluguel/Temporada;
- Valor do Condomínio;
- Área Construída;
- Quartos;
- Suítes;
- Banheiros;
- Vagas;
- Mobiliado;
- Salas.

### Observação

`Preço de Venda` não precisa aparecer em `Alugar` e `Valor de Aluguel/Temporada` não precisa aparecer em `Comprar`, salvo se a estratégia comercial exigir ambos.

## 11. Lógica de Combinação

Todos os critérios devem ser acumulativos.

### Ordem lógica recomendada

1. aplicar elegibilidade pública;
2. aplicar contexto (`Comprar`/`Alugar`);
3. aplicar busca textual;
4. aplicar filtros estruturados;
5. ordenar resultados.

### Exemplo

Se o usuário:

- clicar em `Alugar`;
- buscar `Brooklin`;
- filtrar `3 quartos`;
- marcar `Mobiliado = Sim`;

então o resultado final deve conter apenas imóveis:

- elegíveis;
- de aluguel;
- relacionados a `Brooklin`;
- com 3 quartos compatíveis;
- mobiliados.

## 12. Comportamento sem Resultados

Quando nenhum imóvel corresponder à combinação:

- a interface deve informar que não foram encontrados imóveis;
- os filtros aplicados devem permanecer visíveis;
- o usuário deve poder limpar filtros com facilidade.

## 13. Ordenação

### Recomendação inicial

Se não houver regra definida, usar uma ordenação padrão como:

- imóveis em destaque primeiro;
- depois imóveis mais recentes;
- ou outra prioridade comercial já existente.

### Importante

A ordenação precisa respeitar o modelo atual do site, caso já exista.

## 14. Estrutura de Mapeamento Cadastro → Home

Cada filtro da home deve estar ligado diretamente a um campo do cadastro.

### Exemplo de tabela lógica de mapeamento

- `campo cadastro: area_construida` → `filtro home: Área Construída`
- `campo cadastro: area_terreno` → `filtro home: Área do Terreno`
- `campo cadastro: quartos` → `filtro home: Número de Quartos`
- `campo cadastro: suites` → `filtro home: Número de Suítes`
- `campo cadastro: mobiliado` → `filtro home: Mobiliado`
- `campo cadastro: banheiros` → `filtro home: Número de Banheiros`
- `campo cadastro: preco_venda` → `filtro home: Preço de Venda`
- `campo cadastro: valor_aluguel_temporada` → `filtro home: Valor de Aluguel/Temporada`
- `campo cadastro: valor_condominio` → `filtro home: Valor do Condomínio`
- `campo cadastro: vagas_garagem` → `filtro home: Número de Vagas de Garagem`
- `campo cadastro: salas` → `filtro home: Número de Salas`

> O time técnico deve substituir os nomes ilustrativos pelos nomes reais do banco/modelo/API já existentes no sistema.

## 15. Histórias de Usuário

### HU01 — Ver imóveis na home

Como visitante do site,  
quero visualizar imóveis já anunciados na home,  
para descobrir opções disponíveis sem precisar navegar por páginas internas antes.

### HU02 — Buscar imóvel por termo

Como visitante do site,  
quero usar a busca da home com termos como bairro, cidade, tipo ou código,  
para encontrar imóveis com mais rapidez.

### HU03 — Filtrar por compra

Como visitante interessado em compra,  
quero clicar em `Comprar`,  
para ver apenas imóveis compatíveis com venda.

### HU04 — Filtrar por aluguel

Como visitante interessado em aluguel,  
quero clicar em `Alugar`,  
para ver apenas imóveis compatíveis com locação.

### HU05 — Aplicar filtros numéricos

Como visitante,  
quero filtrar imóveis por preço, metragem, quartos e banheiros,  
para refinar minha busca conforme meu perfil.

### HU06 — Filtrar por opções controladas

Como visitante,  
quero filtrar por campos estruturados como `Mobiliado` e outros dropdowns do cadastro,  
para encontrar imóveis mais aderentes ao que procuro.

### HU07 — Anunciar imóvel

Como proprietário ou interessado,  
quero clicar no botão `Anunciar`,  
para acessar o fluxo correto de captação/cadastro do site.

### HU08 — Atualização automática

Como administrador/corretor,  
quero que o imóvel publicado no cadastro apareça automaticamente na home,  
para não depender de retrabalho manual.

## 16. Critérios de Aceite Técnicos

### Busca

1. A busca da home consulta dados reais do cadastro de imóveis.
2. A busca funciona ao menos por clique na lupa e por `Enter`, se suportado pela interface.
3. A busca combina corretamente com contexto e filtros.

### Botões

4. O botão `Comprar` altera o conjunto de resultados para venda.
5. O botão `Alugar` altera o conjunto de resultados para aluguel.
6. O botão `Anunciar` executa o redirecionamento correto.

### Filtros

7. Cada filtro usa o campo correspondente do cadastro.
8. Filtros numéricos aceitam a lógica definida para mínimo/máximo, faixa ou quantidade mínima.
9. O filtro `Mobiliado` funciona corretamente.
10. Campos `dropdown` reaproveitados mostram opções válidas e consistentes.

### Publicação automática

11. Um imóvel elegível novo aparece automaticamente na home.
12. Um imóvel que deixa de ser elegível deixa de aparecer na home.

## 17. Casos de Teste Recomendados

### CT01 — Home inicial

Validar que a home exibe imóveis elegíveis sem necessidade de filtro inicial.

### CT02 — Busca por bairro

Buscar por um bairro existente e confirmar que os resultados são compatíveis.

### CT03 — Busca por código interno

Buscar por código de imóvel elegível e confirmar retorno.

### CT04 — Comprar + filtros

Selecionar `Comprar` e aplicar `3 quartos`, validando que só imóveis de venda compatíveis aparecem.

### CT05 — Alugar + preço

Selecionar `Alugar` e aplicar faixa de aluguel, validando o retorno.

### CT06 — Filtro booleano

Aplicar `Mobiliado = Sim` e validar retorno correto.

### CT07 — Sem resultados

Aplicar combinação impossível e validar mensagem amigável.

### CT08 — Botão anunciar

Clicar em `Anunciar` e validar destino correto.

### CT09 — Imóvel despublicado

Retirar elegibilidade pública de um imóvel e validar remoção da home.

## 18. Riscos e Atenções

- inconsistência entre os nomes dos campos do cadastro e os usados na busca;
- valores duplicados ou não padronizados em dropdowns;
- mistura de finalidades mal classificadas;
- diferença entre comportamento mobile e desktop;
- performance ruim se a busca/filtro não usar estrutura adequada.

## 19. Recomendações de Implementação

- mapear todos os campos do cadastro usados pela home;
- definir uma camada única de consulta dos imóveis públicos;
- centralizar a regra de elegibilidade;
- normalizar os valores de dropdown antes de expor na home;
- documentar quais filtros são públicos e quais continuam internos;
- manter os textos dos filtros alinhados com os rótulos do cadastro.

## 20. Resumo Executivo

Esta versão técnica detalha como a home deve operar sobre os dados do cadastro de imóveis: um conjunto único de imóveis elegíveis, busca textual funcional, botões de intenção operacionais e filtros estruturados por tipo de campo. Com isso, o site passa a ter uma home realmente utilizável, coerente com o cadastro e pronta para evolução.

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
