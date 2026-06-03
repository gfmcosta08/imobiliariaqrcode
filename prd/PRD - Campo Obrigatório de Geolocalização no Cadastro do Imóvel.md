# PRD — Campo Obrigatório de Geolocalização no Cadastro do Imóvel

## 1. Visão Geral

Este documento define a alteração no fluxo de criação de anúncios de imóveis para tornar **obrigatório** o preenchimento da **localização do imóvel** por meio de um **link de geolocalização**, como por exemplo um link do **Google Maps**.

O objetivo é garantir maior precisão na localização cadastrada, reduzir erros manuais de endereço e melhorar a qualidade das informações do anúncio para uso interno e externo.

## 2. Objetivo do Produto

Ao criar um anúncio de imóvel, o corretor deve obrigatoriamente informar um **link de geolocalização válido** antes de conseguir concluir o cadastro/publicação do imóvel.

## 3. Problema

Atualmente, o cadastro pode ser realizado sem uma referência geográfica precisa, o que gera problemas como:

- localização incompleta ou inconsistente;
- dificuldade para identificar corretamente a posição do imóvel;
- perda de qualidade no anúncio;
- dificuldade futura para integração com mapas, busca por região e automações;
- dependência excessiva de endereço digitado manualmente.

## 4. Objetivos de Negócio

- Garantir que todo imóvel cadastrado tenha uma referência geográfica válida.
- Melhorar a qualidade dos dados da base de imóveis.
- Aumentar a confiabilidade das informações para clientes, corretores e sistemas internos.
- Preparar a plataforma para recursos futuros baseados em mapa, proximidade e localização.

## 5. Escopo

### Incluído

- Tornar obrigatório o campo de **link de geolocalização** no cadastro de imóvel.
- Validar se o link informado possui formato aceito.
- Impedir a conclusão do cadastro caso o campo não esteja preenchido ou esteja inválido.
- Exibir mensagens claras de erro para o corretor.

### Não incluído neste escopo

- Validação automática da existência real do imóvel no mapa.
- Extração obrigatória de latitude e longitude a partir do link.
- Sugestão automática de endereço a partir do mapa.
- Integrações avançadas com APIs externas de mapas.

## 6. Público-alvo

- Corretores e administradores que cadastram imóveis na plataforma.
- Equipe operacional que revisa anúncios.
- Sistemas consumidores dos dados de localização.

## 7. Definição da Mudança

Durante a criação de um anúncio de imóvel, o sistema deverá exigir o preenchimento do campo:

- **Localização do imóvel**
- Tipo: **URL / link de geolocalização**
- Exemplo aceito: **Google Maps**

O cadastro **não poderá ser salvo/publicado/finalizado** sem esse campo preenchido com um link válido.

## 8. Requisitos Funcionais

### RF01 — Campo obrigatório

No formulário de cadastro de imóvel, o campo **Localização do imóvel** deve ser obrigatório.

### RF02 — Tipo do campo

O campo deve aceitar um **link de geolocalização**.

Exemplos de links esperados:

- link do Google Maps;
- outros links equivalentes de mapas, caso a regra de negócio permita.

### RF03 — Bloqueio de conclusão

Se o campo não estiver preenchido, o sistema deve impedir a continuidade da ação de salvar/publicar/finalizar cadastro.

### RF04 — Validação de formato

Se o valor informado não for um link válido, o sistema deve apresentar erro e impedir a conclusão do cadastro.

### RF05 — Mensagem de orientação

O formulário deve orientar o corretor sobre o que deve ser informado, com texto de ajuda como:

`Cole aqui o link de localização do imóvel no mapa (ex.: Google Maps).`

### RF06 — Persistência

O link informado deve ser salvo no cadastro do imóvel e ficar disponível para uso posterior no anúncio e em integrações internas.

### RF07 — Edição do imóvel

Ao editar um imóvel já cadastrado, o campo de geolocalização deve continuar obrigatório.

## 9. Regras de Negócio

### RN01

Todo novo imóvel cadastrado deve possuir um link de geolocalização antes de sua conclusão.

### RN02

O campo não pode aceitar somente espaços em branco.

### RN03

O sistema deve considerar inválidos valores que não sejam URL.

### RN04

Se a regra da operação for restritiva, o sistema pode aceitar apenas domínios autorizados, como:

- `google.com`
- `maps.google.com`
- `goo.gl`
- `maps.app.goo.gl`

> Observação: esta validação de domínio pode ser opcional na primeira versão. O mínimo obrigatório é validar que se trata de um link válido.

### RN05

Caso o imóvel esteja em rascunho, a regra deve ser definida pelo produto:

- opção A: exigir o campo já no salvamento do rascunho;
- opção B: permitir rascunho incompleto e exigir apenas na publicação.

**Recomendação:** aplicar a obrigatoriedade no momento de **publicar/finalizar** e, se possível, também sinalizar no rascunho que o campo está pendente.

## 10. Experiência do Usuário

### 10.1. Campo no formulário

Nome sugerido do campo:

- **Localização do imóvel**

Texto de apoio:

- **Cole o link de localização do imóvel no mapa, como Google Maps.**

Placeholder sugerido:

- `https://maps.google.com/...`

### 10.2. Comportamento visual

- O campo deve aparecer marcado como obrigatório.
- Em caso de erro, o sistema deve destacar visualmente o campo.
- A mensagem de erro deve aparecer próxima ao campo.

### 10.3. Mensagens de validação

Mensagens sugeridas:

- **Informe a localização do imóvel.**
- **Insira um link de geolocalização válido.**
- **Use um link de mapa, como Google Maps.**

## 11. Fluxo Funcional

### Fluxo principal

1. O corretor acessa o cadastro de imóvel.
2. Preenche os dados do anúncio.
3. Informa o campo **Localização do imóvel** com um link de geolocalização.
4. O sistema valida o preenchimento e o formato do link.
5. Se estiver válido, o sistema permite concluir o cadastro/publicação.

### Fluxo de erro 1 — Campo vazio

1. O corretor tenta concluir o cadastro sem preencher a localização.
2. O sistema bloqueia a ação.
3. O sistema exibe a mensagem: **Informe a localização do imóvel.**

### Fluxo de erro 2 — Link inválido

1. O corretor informa um texto ou link inválido.
2. O sistema bloqueia a ação.
3. O sistema exibe a mensagem: **Insira um link de geolocalização válido.**

## 12. Requisitos Técnicos de Alto Nível

### Validação mínima recomendada

- verificar se o campo foi preenchido;
- remover espaços extras no início e no fim;
- validar formato de URL;
- opcionalmente validar domínio permitido.

### Armazenamento

Salvar o valor em um campo dedicado, por exemplo:

- `location_map_url`
- ou nome equivalente no padrão já existente da plataforma.

### Normalização recomendada

Antes de salvar:

- aplicar `trim`;
- padronizar protocolo quando possível;
- armazenar o valor final validado.

## 13. Impactos Esperados

### Positivos

- melhoria da qualidade dos anúncios;
- maior consistência da base de dados;
- facilidade para localizar imóveis;
- melhor preparação para funcionalidades baseadas em mapa.

### Atenções

- corretores precisarão copiar o link do mapa no momento do cadastro;
- pode haver aumento pequeno no tempo de preenchimento do formulário;
- links encurtados ou formatos diferentes podem exigir tratamento adicional.

## 14. Critérios de Aceite

1. O campo **Localização do imóvel** aparece como obrigatório no cadastro.
2. O sistema não permite concluir/publicar o imóvel sem preencher esse campo.
3. O sistema não permite concluir/publicar o imóvel com link inválido.
4. O sistema exibe mensagem clara quando o campo estiver vazio.
5. O sistema exibe mensagem clara quando o link for inválido.
6. O valor informado é salvo corretamente no cadastro do imóvel.
7. Ao editar um imóvel, a obrigatoriedade continua sendo aplicada.

## 15. Cenários de Teste

### Cenário 1

**Dado** que o corretor está criando um imóvel  
**Quando** tenta concluir sem preencher a localização  
**Então** o sistema deve bloquear a ação e exibir erro.

### Cenário 2

**Dado** que o corretor informa um texto comum no campo  
**Quando** tenta concluir o cadastro  
**Então** o sistema deve bloquear a ação por link inválido.

### Cenário 3

**Dado** que o corretor informa um link válido do Google Maps  
**Quando** conclui o cadastro  
**Então** o sistema deve permitir a conclusão e salvar o valor.

### Cenário 4

**Dado** que o corretor está editando um imóvel existente  
**Quando** remove o link de localização e tenta salvar/publicar  
**Então** o sistema deve bloquear a ação.

## 16. Métricas Recomendadas

- percentual de imóveis novos com localização válida;
- quantidade de tentativas de publicação bloqueadas por ausência do link;
- quantidade de erros por link inválido;
- percentual de imóveis antigos sem localização preenchida.

## 17. Recomendação de Evolução Futura

Em uma próxima fase, o produto pode evoluir para:

- extrair latitude e longitude automaticamente do link;
- exibir pré-visualização do mapa;
- validar se o endereço cadastrado é compatível com a geolocalização;
- permitir seleção do ponto diretamente em mapa embutido.

## 18. Resumo Executivo

O sistema deverá tornar obrigatório, no cadastro de imóveis, o campo de **localização do imóvel** por meio de um **link de geolocalização válido**, como o **Google Maps**, impedindo a conclusão do anúncio quando a informação não estiver preenchida corretamente.

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
