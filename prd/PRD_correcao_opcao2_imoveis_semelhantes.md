# PRD — Correção da Opção 2 (Imóveis semelhantes): enviar descrição + fotos (não link)

**Produto/Canal:** WhatsApp/Chatbot  
**Status:** Draft para implementação  
**Data:** 2026-04-24

---

## 1) Contexto e problema

Atualmente, quando o usuário seleciona a **opção 2 do menu** (fluxo “imóveis semelhantes”), o sistema responde **apenas com o link do anúncio** do(s) imóvel(is) semelhante(s).

**Comportamento incorreto (atual):**

- Retorna somente um **URL** do anúncio semelhante.

**Comportamento esperado (novo):**

- Para cada imóvel semelhante, retornar **descrição do imóvel + fotos** (sem expor o link).
- Se houver mais de um imóvel semelhante, enviar em sequência: **descrição + fotos** do 1º, depois **descrição + fotos** do 2º, etc.
- Enviar **no máximo 5 imóveis por vez** e, ao final desse lote, **enviar o menu novamente**.

> Importante: **o uso do menu após a opção 2 (navegação/fluxo de menu) está funcionando perfeitamente e não deve ser alterado.** A mudança é apenas no conteúdo da resposta de imóveis semelhantes (formatação/payload de retorno).

---

## 2) Objetivos

1. Substituir a resposta baseada em **link** por uma resposta baseada em **conteúdo**: descrição e fotos.
2. Manter o fluxo existente do menu **inalterado** (mesmas opções, mesmas transições, mesma “volta ao menu” após envio).
3. Garantir envio de **até 5 imóveis por lote**, com menu ao final.
4. Melhorar a qualidade percebida pelo usuário (mais contexto e visual) e reduzir fricção (não obrigar o usuário a abrir link).

## 3) Não objetivos (fora de escopo)

- Alterar a lógica de **matching**/similaridade de imóveis (quais imóveis são considerados semelhantes).
- Alterar o comportamento do **menu** (textos, opções, navegação, pós-opção-2).
- Alterar cadastros/estoque de imóveis.
- Adicionar novas integrações externas (assumimos que **já existe** descrição + fotos disponíveis no sistema).

---

## 4) Personas e casos de uso

**Persona:** Usuário final no WhatsApp buscando alternativas similares ao imóvel consultado.

**Caso de uso principal:**

1. Usuário escolhe **Opção 2 — Imóveis semelhantes**.
2. Bot envia até 5 imóveis semelhantes, cada um como **descrição + fotos**.
3. Ao final do lote, bot reenvia o menu (comportamento atual preservado).

---

## 5) Requisitos funcionais

### RF-01 — Remover envio de link

Ao responder a opção 2, o bot **não deve enviar URL** (nem texto contendo link, nem preview de link).

**Critério:** nenhuma mensagem do lote deve conter `http://` ou `https://` ou variações reconhecíveis como URL.

### RF-02 — Enviar descrição do imóvel semelhante

Para cada imóvel semelhante selecionado, enviar uma mensagem textual com a descrição.

**Template da descrição (oficial / já existente no sistema):**  
Usar o template de “descrição completa” já existente (exemplo fornecido mais abaixo), contendo seções como:

- **Título + Descrição Completa**
- **Diferenciais do Imóvel**
- **Dados do Imóvel** (ID, tipo/subtipo, finalidade, status, etc.)
- **Valores**
- **Áreas e Cômodos**
- **Endereço** (preferencialmente com bairro/cidade/UF; evitar detalhes excessivos se não forem necessários)
- **Características e Infraestrutura**
- **Documentação e Detalhes Técnicos**
- **Localização Estratégica**
- **Observações**

**Regras:**

- Omitir seções/campos vazios (não enviar “AAAAA”/placeholder).
- **Não incluir links/URLs** em nenhuma seção (ver RF-01).
- A descrição deve ser enviada **em um bloco único (uma única mensagem)** por imóvel.

### RF-03 — Enviar fotos do imóvel semelhante

Após a descrição, enviar as fotos do imóvel semelhante como mensagens de mídia (imagens) no WhatsApp.

**Regras:**

- Enviar as fotos associadas ao imóvel (p. ex., 1 a N).
- **Limite:** enviar no máximo **15 fotos por anúncio/imóvel**. Se houver mais, enviar as primeiras 15.
- As fotos devem aparecer **logo após** a descrição correspondente (mesma ordem de imóveis).
- As imagens **não devem conter legendas** (sem texto/caption).

### RF-04 — Ordem e agrupamento por imóvel

Para cada imóvel, respeitar:

1. Mensagem de **descrição**
2. Mensagens com **fotos** do mesmo imóvel
3. Passar para o próximo imóvel

### RF-05 — Lote de até 5 imóveis + retorno do menu

Ao selecionar a opção 2, o bot deve enviar **no máximo 5 imóveis por vez**.  
Depois de concluir o envio do lote (descrições + fotos), o bot deve **enviar o menu novamente**.

> O mecanismo de “voltar o menu” já funciona hoje. A implementação deve apenas garantir que o menu seja enviado **depois** do lote completo.

**Nota (confirmado):** o limite de **5 imóveis por lote** já é uma regra atual do **backend**; esta correção não deve alterar essa regra — apenas o conteúdo enviado para cada imóvel.

### RF-06 — Tratamento de ausência de dados

- Se o imóvel semelhante não tiver fotos, enviar apenas a descrição e uma frase do tipo: “Fotos indisponíveis no momento.”
- Se faltar algum campo (ex.: área), omitir o campo sem quebrar o template.

### RF-07 — Estabilidade do fluxo existente

Nenhuma alteração na lógica de estado do menu (ex.: como o chatbot interpreta “2”, como persiste sessão, como reexibe menu).

---

## 6) Requisitos não funcionais

### RNF-01 — Tempo de resposta

O envio do lote (até 5 imóveis) deve começar em tempo aceitável.

- **Meta:** primeira resposta (descrição do 1º imóvel) iniciada em até **3s** (ajustar conforme SLA atual).

### RNF-02 — Confiabilidade no envio de mídia

- Se o envio de uma foto falhar, tentar novamente 1 vez.
- Se persistir falha, registrar erro e continuar com as demais fotos/imóveis (não travar o fluxo).

### RNF-03 — Observabilidade

Registrar logs estruturados para:

- quantidade de imóveis retornados
- quantidade de imóveis enviados (até 5)
- quantidade de fotos por imóvel (encontradas vs. enviadas)
- ocorrência de link indevido (deve tender a zero)
- falhas no envio de mídia (por foto)

---

## 7) Fluxo e experiência (WhatsApp)

### 7.1 Fluxo atual (preservado)

Usuário seleciona **Opção 2** → bot retorna imóveis semelhantes → bot reenvia menu → usuário continua navegando.

### 7.2 Fluxo novo (apenas conteúdo da resposta muda)

Usuário seleciona **Opção 2**:

1. Bot envia: **Descrição do Imóvel Semelhante #1**
2. Bot envia: **Fotos do #1** (1..N)
3. Repetir para #2, #3, #4, #5 (se existirem)
4. Bot envia: **Menu** (igual ao atual)

### 7.3 Exemplo de mensagem (template)

**Descrição (exemplo curto/compacto):**

> _Apartamento 2 quartos — Bairro Centro_  
> Cidade: Curitiba/PR  
> 65 m² • 2 quartos • 1 vaga
>
> _Diferenciais do Imóvel_
>
> - Próximo ao metrô
> - Varanda
> - Condomínio com portaria 24h
>
> _Imóvel semelhante 1 de 5_

Em seguida, enviar as imagens do imóvel (sem URL na legenda).  
As imagens devem ser enviadas **sem legenda**.

### 7.4 Exemplo de descrição completa (template oficial — fornecido)

> _sobrado no alpha village_
>
> _Descrição Completa do sobrado do alpha village_  
> Diferenciais do Imóvel  
> Alpha village
>
> ---
>
> **Dados do Imóvel**
>
> - ID do Imóvel IMV-2026-BD5699
> - Código Interno 01
> - Tipo de Imóvel Residencial
> - Subtipo de Imóvel Sobrado
> - Finalidade Venda
> - Status do Imóvel Disponível
>
> ---
>
> **Valores**
>
> - Preço de Venda R$ 1.000.000,00
> - Condomínio R$ 600,00
> - IPTU R$ 3.000,00
> - Outras Taxas R$ 1.000,00
> - Aceita Financiamento Sim
> - Aceita Permuta Sim
>
> ---
>
> **Áreas e Cômodos**
>
> - Área Total 200 m²
> - Área Construída 140 m²
> - Área do Terreno 3.000 m²
> - Quartos 3
> - Suítes 2
> - Banheiros 3
> - Vagas de Garagem 2
> - Salas 2
> - Número de Andares 2
> - Mobiliado Mobiliado
> - Tipo de Piso porcelana
> - Posição Solar Nascente
>
> ---
>
> **Endereço**
>
> - Endereço Completo sul alameda 09 lote 10 qi 01 lt 10
> - Número 605
> - Complemento sobrado
> - Bairro Plano Diretor Sul
> - Cidade Palmas
> - Estado / UF TO
> - CEP 77016398
>
> ---
>
> **Características e Infraestrutura**
>
> - Características sobrado no alpha village
> - Infraestrutura aaaaa
> - Segurança bbbbb
> - Chave Disponível Sim
> - Imóvel Ocupado Sim
>
> ---
>
> **Documentação e Detalhes Técnicos**
>
> - Documentação tem doc
> - Detalhes Técnicos Avançados tem detalhes tecnicos
> - Tipo de Construção Alvenaria
> - Padrão de Acabamento Alto padrão
> - Matrícula do Imóvel 123456
> - Situação da Documentação Regular
> - Possui Escritura Sim
> - Possui Registro Sim
>
> ---
>
> **Localização Estratégica**
>
> - Proximidades perto do colegio marista
> - Distância do Centro 3 km
> - Região da Cidade Centro
>
> ---
>
> **Observações**
>
> - Observações do Corretor Observações funciona

---

## 8) Dados e contratos (alto nível)

Premissa informada: **o sistema já possui descrição e fotos**; o problema é de “montagem da resposta”.

### 8.1 Campos necessários por imóvel semelhante

- `id` (interno)
- `descricao` (texto pronto ou campos para montar)
- `fotos[]` (lista de URLs internas/IDs de mídia já acessíveis ao provedor WhatsApp)

### 8.2 Regras de formatação

- Nunca incluir `link_anuncio`/`url` na mensagem final para o usuário.
- Se houver URLs em campos de descrição por erro de cadastro, sanitizar/remover URLs antes do envio (opcional, mas recomendado).

---

## 9) Critérios de aceite (Acceptance Criteria)

1. Ao selecionar a opção 2, **nenhuma mensagem** contém link/URL.
2. Para cada imóvel semelhante enviado, o usuário recebe:
   - 1 mensagem de descrição; e
   - pelo menos 1 foto quando houver fotos disponíveis.
3. Para mais de um imóvel semelhante, o envio respeita a ordem:
   - descrição + fotos do imóvel A → descrição + fotos do imóvel B → ...
4. O chatbot envia **no máximo 5 imóveis por lote** e, ao final do lote, **reenvia o menu** (sem mudanças no conteúdo/funcionamento do menu).
5. Se um imóvel não tiver fotos, o bot informa “Fotos indisponíveis” e segue o fluxo normalmente.
6. Em falha de envio de uma foto, o fluxo não interrompe o envio do restante do lote.

---

## 10) Casos de teste (QA)

### CT-01 — 1 imóvel semelhante com fotos

- Dado que existem 1 imóvel semelhante com 3 fotos
- Quando usuário seleciona opção 2
- Então o bot envia 1 descrição + 3 imagens + menu
- E nenhuma mensagem contém link

### CT-02 — 3 imóveis semelhantes com fotos

- Dado que existem 3 imóveis semelhantes, cada um com ≥1 foto
- Então o bot envia (descrição+fotos) do #1, depois do #2, depois do #3, e então o menu

### CT-03 — 7 imóveis semelhantes (paginação por lote)

- Dado que existem 7 imóveis semelhantes
- Então o bot envia apenas os 5 primeiros (descrição+fotos), e em seguida o menu
- (Se existir fluxo atual de “pegar mais” via menu, validar que ele continua igual ao atual)

### CT-04 — Imóvel sem fotos

- Dado que há 1 imóvel semelhante sem fotos
- Então o bot envia descrição + “Fotos indisponíveis...” + menu

### CT-05 — Falha no envio de mídia

- Simular falha ao enviar 1 foto
- Verificar retry (1 tentativa) e logging
- Garantir que envio continua para demais fotos/imóveis e finaliza com menu

### CT-06 — Sanitização de URL

- Dado que algum campo textual contém “https://...”
- Então o bot não envia a URL ao usuário (removida ou substituída)

---

## 11) Métricas de sucesso

- **Taxa de respostas com URL** na opção 2: meta = **0%**
- **Taxa de envio de mídia bem-sucedido** (por imagem): meta ≥ **99%** (ajustar ao histórico)
- **Tempo até 1ª mensagem de descrição**: meta p95 ≤ **3s** (ajustar)
- **Engajamento**: cliques/ações subsequentes no menu após ver semelhantes (proxy de utilidade)

---

## 12) Rollout e mitigação de risco

- Feature flag/config para alternar entre “resposta por link” e “resposta por descrição+fotos” (recomendado).
- Implantar primeiro em ambiente de homologação → piloto (pequena % ou grupo interno) → 100%.
- Monitorar:
  - falhas de envio de mídia
  - tempo de resposta
  - logs de URL detectada

---

## 13) Perguntas em aberto (para fechar antes de desenvolver)

1. Existe limite atual de fotos por imóvel na integração WhatsApp/provedor? Se sim, qual?
2. Confirmar se existe algum limite de caracteres no WhatsApp/provedor que possa impedir o envio da **descrição completa em um único bloco** (atualmente: **não**).

**Respostas registradas:**

- Limite de fotos por anúncio: **15**
- Limite de caracteres para descrição: **não tem limite**
