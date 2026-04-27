# PRD — Estruturação da Descrição do Imóvel no WhatsApp

## 1. Visão Geral

Atualmente, a descrição do imóvel (campos preenchidos pelo corretor responsável pelo anúncio) está sendo enviada pelo bot no WhatsApp de forma “poluída” e com baixa legibilidade. Este PRD define as mudanças para tornar a mensagem **mais estruturada, escaneável e agradável de ler**, exibindo **somente os campos que possuem informações preenchidas**, seguindo uma **ordem fixa** e com um **menu de 3 opções** ao final.

## 2. Objetivo

Padronizar a mensagem enviada no WhatsApp com:

1. **Saudação**
2. **Descrição do imóvel (completa, estruturada e só com campos preenchidos; sem data de cadastro/atualização)**
3. **Todas as fotos**
4. **Menu com 3 opções**

## 3. Problema / Dor

- A mensagem atual mistura campos e valores sem agrupamento consistente.
- Campos vazios geram ruído (“rótulos” sem valor), tornando a leitura cansativa.
- Informações de baixa relevância para o cliente (ex.: datas) atrapalham a tomada de decisão.

## 4. Público-alvo

- Clientes finais no WhatsApp (leitura rápida, rolagem longa, atenção limitada).
- Corretores/operadores (precisam de uma apresentação padronizada e coerente do anúncio).

## 5. Escopo (Mudanças solicitadas)

### 5.1. Estrutura da mensagem (ordem)

**Ordem obrigatória do envio:**

1. **Saudação**
2. **Descrição do imóvel completa, estruturada e só com campos preenchidos** (NÃO exibir data de cadastro/atualização)
3. **Todas as fotos**
4. **Menu com 3 opções**

### 5.2. Regras de exibição (anti-poluição)

**Regra R1 — Exibir somente campos preenchidos**

- Um campo só deve ser renderizado se o valor estiver presente e for “significativo”.
- Se um campo estiver vazio/nulo/indefinido, **não renderizar o rótulo**.

**Regra R2 — Ocultar seções vazias**

- Uma seção (ex.: “Documentação e Detalhes Técnicos”) só deve aparecer se **pelo menos 1 campo** dentro dela for exibido.

**Regra R3 — Não mostrar datas**

- **NÃO exibir** em hipótese alguma:
  - Data de Cadastro
  - Data de Atualização

**Regra R4 — Formatação para WhatsApp**

- Preferir **títulos curtos**, separadores visuais simples e quebras de linha.
- Evitar textos em caixa alta (exceto siglas como IPTU/UF/CEP).
- Manter rótulos consistentes (ex.: “Área Total”, “Quartos”, “Condomínio”).

**Regra R5 — “Sem ver mais”**

- Não utilizar “ver mais”, “ler mais”, “continuar lendo”, nem fluxos de paginação.
- O descritivo deve ser **completo** na mesma sequência prevista (antes das fotos).

## 6. Conteúdo e Organização (ordem interna do descritivo)

O descritivo deve ser exibido na ordem abaixo, respeitando as regras R1 e R2.

### 6.1. Cabeçalho do anúncio

1. **Título do Anúncio**
2. **Descrição Completa**
3. **Diferenciais do Imóvel**

> Observação: “Diferenciais” pode ser exibido em lista (um item por linha) quando houver múltiplos valores.

### 6.2. Dados do Imóvel (básicos)

- ID do Imóvel (preenchido automaticamente ao cadastrar)
- Código Interno
- Tipo de Imóvel
- Subtipo de Imóvel
- Finalidade
- Status do Imóvel

### 6.3. Valores

- Preço de Venda
- Valor de Aluguel/Temporada
- Valor do Condomínio
- Valor do IPTU
- Outras Taxas
- Aceita Financiamento
- Aceita Permuta

### 6.4. Áreas e Cômodos

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

### 6.5. Endereço

- Endereço Completo
- Número
- Complemento
- Bairro
- Cidade
- Estado / UF
- CEP
- Latitude
- Longitude

### 6.6. Características e Infraestrutura

- Características
- Infraestrutura
- Segurança
- Chave Disponível
- Imóvel Ocupado

### 6.7. Documentação e Detalhes Técnicos

- Documentação
- Detalhes Técnicos Avançados
- Tipo de Construção
- Padrão de Acabamento
- Matrícula do Imóvel
- Situação da Documentação
- Possui Escritura
- Possui Registro

### 6.8. Localização Estratégica

- Proximidades
- Distância do Centro
- Região da Cidade

### 6.9. Observações

- Observações do Corretor

## 7. Modelo de mensagem (template WhatsApp)

> Nota: este template é ilustrativo. O sistema deve montar dinamicamente, respeitando R1/R2/R3.

### 7.1. Saudação (exemplo)

**Olá, {nome}!** Seguem as informações do imóvel:

### 7.2. Descritivo completo (exemplo)

**{Título do Anúncio}**
{Descrição Completa}

---

## Dados do Imóvel

- **ID do Imóvel:** {id_imovel}
- **Código Interno:** {codigo_interno}
- **Tipo de Imóvel:** {tipo_imovel}
- **Subtipo de Imóvel:** {subtipo_imovel}
- **Finalidade:** {finalidade}
- **Status do Imóvel:** {status_imovel}

---

## Valores

- **Preço de Venda:** {preco_venda}
- **Valor de Aluguel/Temporada:** {valor_locacao_temporada}
- **Condomínio:** {valor_condominio}
- **IPTU:** {valor_iptu}
- **Outras Taxas:** {outras_taxas}
- **Aceita Financiamento:** {aceita_financiamento}
- **Aceita Permuta:** {aceita_permuta}

---

## Áreas e Cômodos

- **Área Total:** {area_total}
- **Área Construída:** {area_construida}
- **Área do Terreno:** {area_terreno}
- **Quartos:** {num_quartos}
- **Suítes:** {num_suites}
- **Banheiros:** {num_banheiros}
- **Vagas de Garagem:** {num_vagas}
- **Salas:** {num_salas}
- **Número de Andares:** {num_andares}
- **Andar do Imóvel:** {andar_imovel}
- **Mobiliado:** {mobiliado}
- **Tipo de Piso:** {tipo_piso}
- **Posição Solar:** {posicao_solar}
- **Idade do Imóvel:** {idade_imovel}

---

## Endereço

- **Endereço Completo:** {endereco_completo}
- **Número:** {numero}
- **Complemento:** {complemento}
- **Bairro:** {bairro}
- **Cidade:** {cidade}
- **Estado / UF:** {uf}
- **CEP:** {cep}
- **Latitude:** {latitude}
- **Longitude:** {longitude}

---

## Características e Infraestrutura

- **Características:** {caracteristicas}
- **Infraestrutura:** {infraestrutura}
- **Segurança:** {seguranca}
- **Chave Disponível:** {chave_disponivel}
- **Imóvel Ocupado:** {imovel_ocupado}

---

## Documentação e Detalhes Técnicos

- **Documentação:** {documentacao}
- **Detalhes Técnicos Avançados:** {detalhes_tecnicos_avancados}
- **Tipo de Construção:** {tipo_construcao}
- **Padrão de Acabamento:** {padrao_acabamento}
- **Matrícula do Imóvel:** {matricula_imovel}
- **Situação da Documentação:** {situacao_documentacao}
- **Possui Escritura:** {possui_escritura}
- **Possui Registro:** {possui_registro}

---

## Localização Estratégica

- **Proximidades:** {proximidades}
- **Distância do Centro:** {distancia_centro}
- **Região da Cidade:** {regiao_cidade}

---

## Observações

- **Observações do Corretor:** {observacoes_corretor}

---

### Diferenciais do Imóvel

{diferenciais_imovel}

## 8. Imagens (requisitos)

### 8.1. Sequência

- Após o texto completo do descritivo, enviar **todas as imagens** do anúncio.

### 8.2. Regras

- Se não houver imagens, pular esta etapa e seguir para o menu.
- Caso exista ordenação (capa, prioridade, etc.), respeitá-la.

## 9. Menu (3 opções) — texto final obrigatório

Após as fotos (ou após o descritivo quando não houver fotos), enviar:

**Gianpaolo, como posso te ajudar agora:**
1 - Falar com o corretor sobre esse imovel  
2 - Ver imoveis semelhantes  
3 - Quero o contato do corretor

## 10. Requisitos Não Funcionais

- A mensagem deve ser legível no WhatsApp (mobile) e evitar “blocos gigantes” sem separação.
- Respeitar limites/boas práticas da API do WhatsApp (se houver necessidade técnica de quebrar em múltiplas mensagens, a ordem deve ser preservada: texto → imagens → menu).

## 11. Casos de borda / Exceções

1. **Apenas 1 campo preenchido em uma seção**: exibir a seção com somente aquele campo.
2. **Descrição completa vazia**: exibir o título e seguir para seções (sem mostrar “Descrição Completa:” vazio).
3. **Valores parcialmente preenchidos**: exibir apenas os existentes (ex.: só aluguel).
4. **Endereço incompleto**: exibir só bairro/cidade/UF/CEP, conforme disponível.
5. **Diferenciais em texto único**: exibir como parágrafo; se for lista, exibir em linhas.

## 12. Critérios de Aceite (QA)

1. **Ordem do fluxo** está correta: saudação → descritivo → fotos → menu.
2. **Nenhum campo vazio** aparece na mensagem (rótulo não pode aparecer sem valor).
3. **Nenhuma seção vazia** aparece.
4. **Data de cadastro/atualização não aparece** em nenhuma situação.
5. O menu final contém exatamente as 3 opções aprovadas (texto conforme seção 9).
6. Em anúncios com imagens, **todas** as imagens são enviadas após o descritivo.

## 13. Telemetria (opcional, recomendado)

- Evento “mensagem_descritivo_enviada” com:
  - id_imovel, canal=whatsapp, contagem_campos_exibidos, contagem_secoes_exibidas, contagem_imagens
- Evento “opcao_menu_selecionada” com:
  - id_imovel, opcao (1/2/3)
