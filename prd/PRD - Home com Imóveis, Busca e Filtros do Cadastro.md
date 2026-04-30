# PRD — Home com Imóveis Anunciados, Busca Funcional e Filtros Integrados ao Cadastro

## 1. Visão Geral

Este PRD define as mudanças necessárias para que a **home page do site** passe a exibir os imóveis cadastrados de forma funcional, utilizando os dados já preenchidos no **cadastro do imóvel** como fonte principal para:

- publicação automática dos imóveis na home;
- funcionamento do campo de busca;
- ativação dos botões `Comprar`, `Alugar` e `Anunciar`;
- criação de filtros na home com base nos campos existentes no cadastro;
- reaproveitamento dos campos em formato `dropdown` como filtros de seleção.

Hoje, a home já possui uma estrutura visual com banner, campo de busca e botões de navegação por intenção (`Comprar`, `Alugar`, `Anunciar`), porém o comportamento funcional ainda não está ativo ou não está integrado corretamente à base de imóveis cadastrados.

## 2. Objetivo

Transformar a home do site em uma vitrine funcional de imóveis, garantindo que:

1. **todo imóvel elegível cadastrado** apareça na home;
2. o **campo de busca** funcione de fato;
3. os botões **Comprar**, **Alugar** e **Anunciar** sejam clicáveis e executem a regra correta;
4. os **campos do cadastro do imóvel** sejam usados como base dos filtros da home;
5. campos com seleção por botão ou `dropdown` no cadastro também possam ser usados como filtros na home.

## 3. Problema Atual

- A home já possui campo de busca, mas ele **não funciona**.
- Os botões `Comprar`, `Alugar` e `Anunciar` estão presentes, mas precisam ser **habilitados com comportamento real**.
- Os imóveis cadastrados não estão necessariamente sendo exibidos de forma consistente na home.
- O cadastro de imóveis já contém dados ricos, mas esses dados não estão sendo reaproveitados como filtros na página inicial.
- O usuário final não consegue navegar com eficiência entre intenção de compra, aluguel e anúncio.

## 4. Objetivos de Negócio

- Aumentar a exposição dos imóveis já cadastrados.
- Melhorar a experiência de busca e descoberta de imóveis na home.
- Reduzir atrito entre cadastro interno e exibição pública.
- Transformar a home em um canal real de captação e conversão.
- Padronizar a relação entre o cadastro do imóvel e os filtros públicos do site.

## 5. Escopo

### Incluído

- Exibir na home todos os imóveis elegíveis para anúncio.
- Fazer o campo de busca da home funcionar.
- Habilitar os botões `Comprar`, `Alugar` e `Anunciar`.
- Criar filtros na home baseados nos campos do cadastro do imóvel.
- Utilizar campos `dropdown` do cadastro como opções de filtro na home.
- Aplicar filtros numéricos e categóricos.

### Não incluído neste escopo

- Redesenho visual completo da home.
- Reescrita da identidade visual do site.
- Novo motor avançado de recomendação.
- Personalização por perfil do usuário logado.
- Busca por mapa nesta fase.

## 6. Público-alvo

- Visitantes da home que desejam comprar ou alugar imóveis.
- Proprietários ou interessados em anunciar imóveis.
- Corretores e administradores que cadastram imóveis no sistema.

## 7. Definições Principais

### 7.1. Imóvel elegível para exibição na home

Para aparecer na home, o imóvel deve respeitar as regras do site.

Como regra base recomendada, um imóvel só deve ser exibido se:

- estiver com **status ativo/publicado**;
- tiver **finalidade compatível** com a vitrine pública;
- possuir dados mínimos obrigatórios do anúncio;
- não estiver arquivado, oculto ou indisponível.

> Observação: a regra exata deve seguir o padrão já usado no site para “imóvel anunciado”. Caso já exista uma flag como `publicado`, `ativo`, `disponivel` ou equivalente, ela deve ser respeitada como regra principal.

### 7.2. Fonte única da verdade

O **cadastro do imóvel** será a base oficial para:

- dados exibidos nos cards da home;
- filtros da home;
- segmentação entre compra e aluguel;
- ordenação e busca.

## 8. Requisitos Funcionais

### RF01 — Publicação automática na home

Todo imóvel cadastrado e elegível deve aparecer automaticamente na home, sem depender de cadastro manual adicional em outra área.

### RF02 — Atualização automática

Sempre que um imóvel for criado, editado, publicado, despublicado ou alterado no cadastro, a home deve refletir essas alterações.

### RF03 — Campo de busca funcional

O campo de busca da home deve retornar resultados com base nos dados do imóvel cadastrados no sistema.

### RF04 — Botão `Comprar`

Ao clicar em `Comprar`, a home deve exibir imóveis com finalidade de compra/venda, respeitando as regras do site.

### RF05 — Botão `Alugar`

Ao clicar em `Alugar`, a home deve exibir imóveis com finalidade de aluguel e, se aplicável pela regra do negócio, também temporada.

### RF06 — Botão `Anunciar`

Ao clicar em `Anunciar`, o usuário deve ser direcionado ao fluxo correto de anúncio do site, respeitando a regra já existente da plataforma.

### RF07 — Filtros baseados no cadastro

Os filtros da home devem usar os campos do cadastro do imóvel como parâmetros reais de consulta.

### RF08 — Reaproveitamento dos campos `dropdown`

Todo campo do cadastro que já seja estruturado como seleção, botão, lista ou `dropdown` deve poder ser reutilizado como filtro equivalente na home, quando fizer sentido para o público final.

### RF09 — Filtros múltiplos

O usuário deve conseguir combinar mais de um filtro ao mesmo tempo.

### RF10 — Resultado coerente com a busca e filtros

A lista de imóveis exibidos na home deve ser atualizada conforme busca, botões e filtros aplicados.

## 9. Requisitos da Busca

O campo de busca da home deve funcionar com base em parâmetros já existentes no cadastro do imóvel.

### 9.1. Campos mínimos sugeridos para busca textual

- título do anúncio;
- código interno;
- ID do imóvel;
- tipo de imóvel;
- subtipo de imóvel;
- bairro;
- cidade;
- estado/UF;
- região da cidade;
- proximidades;
- endereço, quando permitido pela regra do site.

### 9.2. Comportamento esperado

- busca por termo livre;
- retorno por correspondência parcial;
- atualização da listagem conforme o termo informado;
- combinação com botões `Comprar` e `Alugar`;
- combinação com os demais filtros.

## 10. Regras dos Botões da Home

### 10.1. Botão `Comprar`

Ao ser selecionado:

- ativa o contexto de imóveis para venda;
- filtra imóveis com finalidade compatível com compra;
- ajusta os filtros e resultados para esse contexto.

### 10.2. Botão `Alugar`

Ao ser selecionado:

- ativa o contexto de imóveis para aluguel;
- filtra imóveis com finalidade compatível com aluguel;
- se a regra atual do site tratar temporada dentro de aluguel, incluir `temporada`.

### 10.3. Botão `Anunciar`

Ao ser selecionado:

- direciona o usuário para o fluxo de anúncio;
- pode abrir página própria, formulário, landing page ou área de cadastro, conforme a regra já existente no site;
- deve funcionar de ponta a ponta.

## 11. Filtros da Home

Os filtros devem ser montados com base no cadastro do imóvel.

### 11.1. Filtros solicitados pelo usuário

Os seguintes filtros devem ser implementados:

- Área Construída (m²)
- Área do Terreno (m²)
- Número de Quartos
- Número de Suítes
- Mobiliado
- Número de Banheiros
- Preço de Venda
- Valor de Aluguel/Temporada
- Valor do Condomínio
- Número de Vagas de Garagem
- Número de Salas

### 11.2. Tipo de filtro recomendado por campo

#### Numéricos

Devem funcionar preferencialmente como:

- valor mínimo;
- valor máximo;
- ou faixas prontas, se o site já tiver padrão definido.

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

#### Booleanos / sim-não

Campos:

- Mobiliado

Deve funcionar com opções como:

- Sim
- Não

#### Campos de seleção / dropdown do cadastro

Todo campo que no cadastro seja estruturado como:

- botão de seleção;
- dropdown;
- lista fechada de opções;
- enumerador;

deve ser elegível para virar filtro na home, desde que tenha valor útil para busca pública.

Exemplos prováveis:

- Tipo de Imóvel
- Subtipo de Imóvel
- Finalidade
- Status do Imóvel
- Mobiliado
- Tipo de Piso
- Posição Solar
- Região da Cidade

> Observação: alguns campos internos podem existir no cadastro, mas não devem virar filtro público. A decisão deve seguir a regra de negócio e a utilidade para o usuário final.

## 12. Mapeamento entre Cadastro e Home

### Princípio

Os mesmos campos usados no cadastro do imóvel devem ser usados como parâmetros da home, evitando duplicidade de estrutura.

### Exemplos de mapeamento

- `area_construida` → filtro `Área Construída`
- `area_terreno` → filtro `Área do Terreno`
- `quartos` → filtro `Número de Quartos`
- `suites` → filtro `Número de Suítes`
- `mobiliado` → filtro `Mobiliado`
- `banheiros` → filtro `Número de Banheiros`
- `preco_venda` → filtro `Preço de Venda`
- `valor_aluguel_temporada` → filtro `Valor de Aluguel/Temporada`
- `valor_condominio` → filtro `Valor do Condomínio`
- `vagas_garagem` → filtro `Número de Vagas de Garagem`
- `salas` → filtro `Número de Salas`

> Os nomes técnicos acima são apenas ilustrativos. O desenvolvimento deve usar o nome real dos campos já existentes no sistema.

## 13. Regras de Exibição dos Imóveis na Home

### RN01

Todo imóvel elegível deve aparecer na home automaticamente.

### RN02

O critério de elegibilidade deve seguir o status e as regras já existentes do site.

### RN03

Imóveis não publicados, inativos, ocultos ou indisponíveis não devem aparecer.

### RN04

Se o imóvel tiver finalidade `venda`, ele deve aparecer no contexto `Comprar`.

### RN05

Se o imóvel tiver finalidade `aluguel`, ele deve aparecer no contexto `Alugar`.

### RN06

Se a plataforma tratar `temporada` separadamente, o produto deve decidir:

- incluir dentro de `Alugar`; ou
- criar comportamento específico em fase futura.

### RN07

Os filtros da home devem refletir somente imóveis elegíveis e disponíveis na listagem pública.

## 14. Card do Imóvel na Home

Cada imóvel anunciado na home deve exibir pelo menos:

- imagem principal;
- título do anúncio;
- localização resumida;
- preço compatível com a finalidade;
- características principais do imóvel;
- link para detalhes do imóvel.

Se já houver padrão visual existente, ele deve ser mantido.

## 15. Experiência do Usuário

### 15.1. Fluxo esperado na home

1. Usuário entra na home.
2. Visualiza os imóveis anunciados.
3. Pode clicar em `Comprar` ou `Alugar`.
4. Pode buscar por termo.
5. Pode aplicar filtros.
6. Recebe resultados consistentes.
7. Pode clicar em um imóvel e abrir a página de detalhes.

### 15.2. Requisitos de usabilidade

- os filtros devem ser claros e objetivos;
- a busca deve responder com rapidez;
- a home deve exibir imóveis mesmo sem filtro aplicado;
- a combinação de busca + botões + filtros não deve quebrar a listagem.

## 16. Critérios de Aceite

1. Todo imóvel elegível cadastrado aparece na home automaticamente.
2. Ao despublicar ou inativar um imóvel, ele deixa de aparecer na home.
3. O campo de busca da home retorna resultados válidos.
4. O botão `Comprar` filtra apenas imóveis compatíveis com venda.
5. O botão `Alugar` filtra apenas imóveis compatíveis com aluguel, conforme a regra do site.
6. O botão `Anunciar` direciona corretamente para o fluxo de anúncio.
7. Os filtros da home usam os mesmos dados do cadastro do imóvel.
8. Campos `dropdown` do cadastro podem ser reaproveitados como filtros na home, quando aplicável.
9. Os filtros solicitados funcionam individualmente.
10. Os filtros solicitados funcionam em combinação.
11. A listagem é atualizada corretamente ao aplicar busca e filtros.

## 17. Cenários de Teste

### Cenário 1 — Imóvel novo publicado

**Dado** que um corretor cadastra e publica um imóvel elegível  
**Quando** o cadastro é concluído  
**Então** o imóvel deve aparecer automaticamente na home.

### Cenário 2 — Busca por cidade

**Dado** que existem imóveis cadastrados em determinada cidade  
**Quando** o usuário busca pela cidade na home  
**Então** os imóveis compatíveis devem ser retornados.

### Cenário 3 — Botão Comprar

**Dado** que existem imóveis de venda e aluguel  
**Quando** o usuário clica em `Comprar`  
**Então** apenas imóveis compatíveis com compra/venda devem ser exibidos.

### Cenário 4 — Botão Alugar

**Dado** que existem imóveis com finalidade aluguel  
**Quando** o usuário clica em `Alugar`  
**Então** a listagem deve mostrar apenas imóveis compatíveis.

### Cenário 5 — Filtro de Quartos

**Dado** que existem imóveis com diferentes quantidades de quartos  
**Quando** o usuário filtra por número de quartos  
**Então** a home deve exibir somente imóveis compatíveis com o valor selecionado.

### Cenário 6 — Filtro Mobiliado

**Dado** que existem imóveis mobiliados e não mobiliados  
**Quando** o usuário seleciona `Mobiliado = Sim`  
**Então** apenas imóveis mobiliados devem aparecer.

### Cenário 7 — Combinação de filtros

**Dado** que o usuário seleciona `Alugar`, `3 quartos` e `Mobiliado = Sim`  
**Quando** os filtros são aplicados  
**Então** a listagem deve refletir exatamente essa combinação.

### Cenário 8 — Imóvel inativado

**Dado** que um imóvel estava na home  
**Quando** ele for marcado como inativo ou deixar de respeitar as regras do site  
**Então** ele não deve mais aparecer na home.

## 18. Requisitos Não Funcionais

- A home deve carregar com desempenho compatível com navegação pública.
- A busca e os filtros devem responder sem travamentos perceptíveis.
- A solução deve permitir crescimento futuro do número de imóveis cadastrados.
- O comportamento deve ser responsivo para desktop e mobile.

## 19. Métricas Recomendadas

- quantidade de imóveis exibidos na home;
- taxa de uso da busca;
- taxa de clique em `Comprar`, `Alugar` e `Anunciar`;
- taxa de uso por filtro;
- quantidade de sessões com aplicação de múltiplos filtros;
- taxa de clique nos cards de imóveis.

## 20. Recomendações de Implementação

- usar o cadastro do imóvel como fonte única de exibição;
- evitar criar campos duplicados só para home;
- mapear todos os campos `dropdown` do cadastro e classificar quais devem virar filtros públicos;
- validar a regra atual do site para `venda`, `aluguel`, `temporada`, `ativo`, `publicado` e `anunciar`;
- padronizar o comportamento dos filtros numéricos em formato mínimo/máximo ou faixas.

## 21. Resumo Executivo

O site deve passar a usar a base de imóveis cadastrados como origem real da home, tornando a página inicial uma vitrine funcional. Para isso, será necessário publicar automaticamente imóveis elegíveis, ativar o campo de busca, habilitar os botões `Comprar`, `Alugar` e `Anunciar`, e implementar filtros com base direta nos campos já existentes no cadastro do imóvel, inclusive reaproveitando campos em formato `dropdown`.
