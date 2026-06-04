# PRD - Produto Investivel 10/10: QR Imobiliario, WhatsApp e Leads Rastreaveis

Data: 2026-06-03
Status: Proposto
Prioridade: P0/P1/P2, com foco em transformar o projeto em SaaS investivel
Produto: ImoveisQR / ImobQR, a ser unificado em uma marca oficial

## 1. Resumo Executivo

Este PRD define a evolucao necessaria para transformar o projeto em um SaaS imobiliario 10/10 sob olhar de investidor, corretor usuario e operador tecnico.

O diagnostico atual e que o projeto tem uma boa tese, boa base tecnica e muito trabalho ja feito, mas ainda sofre com dispersao de foco, inconsistencias de release, monetizacao incompleta, riscos de seguranca e experiencia de produto que ainda nao transmite valor imediato.

A solucao central e reduzir o produto a uma promessa brutalmente clara:

> Cole esse QR no imovel e nunca mais perca um interessado anonimo.

A partir dessa promessa, todo o restante deve virar suporte:

- Bot WhatsApp: qualifica e registra o lead.
- Dashboard: mostra dinheiro, oportunidades e performance.
- Importador: acelera onboarding de corretores leigos.
- Billing: transforma uso em receita recorrente.
- Admin/compliance: garante operacao segura.
- Marketplace: fica rebaixado para fase futura, depois de haver oferta, demanda e retencao.

## 2. Problema Principal

Hoje o projeto tenta provar muitas teses simultaneamente:

- QR imobiliario funciona?
- Bot WhatsApp converte?
- Importador de anuncios e diferencial?
- Marketplace proprio importa?
- Painel SaaS com assinatura vende?
- Admin/compliance esta maduro?

Cada uma dessas perguntas poderia sustentar um produto separado. Todas juntas criam ruido, dificultam priorizacao e reduzem confianca de investidor.

O maior risco atual nao e tecnico. E foco.

## 3. Objetivo do PRD

Transformar o produto em um SaaS com:

- promessa central clara;
- experiencia inicial curta e encantadora;
- fluxo QR ponta a ponta demonstravel;
- monetizacao recorrente funcional;
- seguranca corrigida;
- release disciplinado;
- metricas de ativacao e valor;
- marca unica;
- caminho claro para pilotos pagos ou quase pagos.

## 4. Score Atual e Score Alvo

| Dimensao | Score atual | Score alvo | Como chegar a 10/10 |
|---|---:|---:|---|
| Tese | 7/10 | 10/10 | Focar em QR fisico/digital que gera lead rastreavel no WhatsApp |
| Produto | 5/10 | 10/10 | Onboarding curto, dashboard de dinheiro e experiencia premium |
| Engenharia | 6/10 | 10/10 | Main verde, CI verde, staging alinhado e sem codigo critico untracked |
| Seguranca | 3/10 | 10/10 | Cron fechado, payload limitado, webhooks assinados, segredo rotacionado |
| Monetizacao | 2/10 | 10/10 | Stripe completo de ponta a ponta com testes e runbook |
| GTM/venda | 3/10 | 10/10 | ICP claro, pilotos reais, metricas de ativacao, valor e retencao |

## 5. Tese Primaria do Produto

### 5.1 Tese oficial

O ImoveisQR e um sistema para corretores e imobiliarias transformarem placas, vitrines, folders e anuncios fisicos em leads rastreaveis no WhatsApp.

Fluxo central:

`corretor cadastra imovel -> gera QR -> cola/divulga QR -> interessado escaneia -> WhatsApp abre -> bot qualifica -> lead aparece no painel -> corretor age`

### 5.2 Promessa publica

Mensagem principal recomendada:

> Cole esse QR no imovel e nunca mais perca um interessado anonimo.

Mensagens secundarias:

- Saiba quais imoveis mais geram interesse.
- Receba leads qualificados direto no WhatsApp.
- Veja oportunidades perdidas antes que elas esfriem.
- Transforme placa, vitrine e folder em canal de captacao.

### 5.3 O que nao deve ser a tese principal

O produto nao deve se posicionar inicialmente como:

- portal imobiliario;
- CRM completo;
- marketplace;
- robo inteligente de vendas;
- importador universal de anuncios;
- plataforma imobiliaria generica.

Esses elementos podem existir, mas nao devem liderar a narrativa.

## 6. Principio de Foco

Toda feature deve responder positivamente a pelo menos uma pergunta:

1. Ajuda o corretor a gerar mais leads por QR?
2. Ajuda o corretor a responder melhor esses leads?
3. Ajuda o corretor a enxergar dinheiro, oportunidade ou perda?
4. Ajuda o produto a cobrar, operar ou escalar com seguranca?
5. Ajuda o piloto a provar valor real?

Se a resposta for "nao", a feature deve ser removida, adiada ou rebaixada.

## 7. Experiencia 10/10 do Usuario

### 7.1 Primeira tela publica

Objetivo: em ate 5 segundos, o visitante deve entender o valor.

Requisitos:

- Remover metricas publicas fracas, artificiais ou de staging.
- Nao exibir "0 vendido", "R$ 0" ou numeros que diminuam confianca.
- Abrir com a promessa central.
- Mostrar o fluxo em uma composicao simples:
  - cadastrar imovel;
  - gerar QR;
  - receber lead no WhatsApp;
  - acompanhar no painel.
- Ter CTA primario para criar primeiro QR.
- Ter CTA secundario para ver exemplo de QR/lead.

Nao objetivo:

- Nao vender marketplace na primeira dobra.
- Nao liderar com grade generica de imoveis.
- Nao mostrar estatisticas publicas sem prova real.

### 7.2 Onboarding curto

O onboarding deve ser:

`criar conta -> cadastrar primeiro imovel minimo -> gerar QR -> abrir pagina publica do QR -> baixar/compartilhar placa`

Requisitos:

- O usuario deve sentir valor antes de preencher um cadastro completo.
- O primeiro imovel pode ser criado com campos minimos:
  - titulo;
  - tipo;
  - cidade/bairro;
  - preco;
  - telefone WhatsApp;
  - uma foto opcional;
  - descricao opcional.
- Campos avancados devem ficar em etapa posterior.
- Ao gerar o QR, a interface deve oferecer:
  - testar QR;
  - baixar placa;
  - copiar link publico;
  - ver lead de exemplo.

Criterio de aceite:

- Um corretor leigo deve conseguir sair de conta criada para QR testado em ate 5 minutos.

### 7.3 Dashboard orientado a dinheiro

O dashboard nao deve parecer apenas cadastro. Ele deve responder:

- Onde estou perdendo oportunidade?
- Qual imovel gera mais interesse?
- Qual lead precisa de resposta agora?
- Quanto dinheiro potencial esta parado?

Metricas obrigatorias:

- leads gerados;
- leads novos;
- leads respondidos;
- leads sem resposta;
- tempo medio de primeira resposta;
- imoveis com mais scans;
- imoveis com mais conversas;
- conversas qualificadas;
- oportunidades perdidas;
- valor comercial em aberto somente quando houver regra validada.

Exemplos de cards:

- "Voce recebeu 12 interessados esta semana."
- "3 leads ainda nao foram respondidos."
- "O apartamento do Centro gerou 42% dos scans."
- "5 interessados abriram conversa e ainda precisam de retorno."

### 7.4 Listagem e imovel

Requisitos:

- A listagem deve destacar performance, nao apenas dados cadastrais.
- Cada imovel deve mostrar:
  - QR ativo/inativo;
  - scans;
  - leads;
  - conversas;
  - ultimo interesse;
  - status de publicacao;
  - acao rapida para baixar placa.
- O corretor deve conseguir identificar rapidamente qual imovel merece atencao.

## 8. Importador de Anuncios: Solucao Para Corretores Leigos

### 8.1 Decisao de produto

O importador nao deve ser removido. Ele deve ser reposicionado.

Ele nao e a tese principal do produto, mas e um acelerador de onboarding para corretores leigos.

Objetivo:

> Ajudar o corretor a trazer seus anuncios rapidamente para gerar QR, sem transformar o produto em uma guerra tecnica contra portais externos.

### 8.2 Modos de importacao

O importador deve ter tres caminhos, em ordem de confiabilidade:

1. Importacao assistida por URL
   - Usuario cola o link do anuncio.
   - Sistema tenta extrair dados.
   - Usuario revisa antes de salvar.

2. Copiar e colar inteligente
   - Usuario cola texto do anuncio.
   - Sistema sugere titulo, descricao, preco, cidade, bairro, area e quartos.
   - Usuario confirma.

3. Cadastro rapido manual
   - Quando a URL falha, o sistema nao pode travar.
   - Deve cair para formulario minimo com mensagem simples.

### 8.3 Regras de experiencia

- Nunca prometer "importamos qualquer portal".
- Prometer "traga seu anuncio mais rapido".
- Quando falhar, explicar sem linguagem tecnica.
- Sempre oferecer caminho alternativo manual.
- Salvar rascunho para nao fazer o corretor perder trabalho.

### 8.4 Criterios de aceite

- Corretor consegue criar primeiro imovel mesmo se importacao por URL falhar.
- Importacao nunca bloqueia geracao de QR.
- Falhas de WAF, timeout ou site incompativel nao aparecem como erro tecnico bruto.
- O sistema mede taxa de sucesso por origem.

### 8.5 Metricas do importador

- URLs coladas;
- importacoes bem-sucedidas;
- importacoes com revisao manual;
- falhas por dominio;
- tempo economizado estimado;
- taxa de conversao de importacao para QR gerado.

## 9. Marketplace: Solucao Recomendada

### 9.1 Decisao

Marketplace deve ser rebaixado para fase futura.

Ele nao deve liderar a home, a promessa ou a venda ate que o produto tenha:

- oferta suficiente;
- usuarios ativos;
- leads reais;
- retencao;
- sinais de demanda publica.

### 9.2 Estado permitido no curto prazo

Permitido:

- pagina publica do imovel via QR;
- link compartilhavel do imovel;
- vitrine simples opcional do corretor;
- indexacao controlada se fizer sentido.

Nao permitido como prioridade:

- marketplace publico amplo;
- SEO massivo;
- filtros avancados como produto principal;
- promessa de portal imobiliario.

### 9.3 Criterio para retomar marketplace

So reabrir a frente de marketplace quando houver pelo menos:

- 500 imoveis publicados reais;
- 50 corretores ativos;
- 1.000 leads rastreados;
- evidencia de pessoas buscando imoveis fora do QR;
- capacidade de moderacao e qualidade de dados.

## 10. Bot WhatsApp: Solucao Recomendada

### 10.1 Decisao

O bot deve continuar, mas com foco em confiabilidade, nao sofisticacao.

O bot ideal neste momento e previsivel, rastreavel e chato de tao confiavel.

### 10.2 Funcoes obrigatorias

- Responder sempre.
- Identificar o imovel correto.
- Registrar o lead.
- Qualificar interesse basico.
- Avisar o corretor.
- Registrar conversa no painel.
- Nao silenciar.
- Ter fallback claro quando nao entender.

### 10.3 Melhorias recomendadas

- Monitor de silencio com alerta acionavel.
- Timeline da conversa no painel.
- Status do lead:
  - novo;
  - respondido;
  - em atendimento;
  - visita marcada;
  - perdido;
  - convertido.
- Resumo do lead para o corretor:
  - imovel de interesse;
  - mensagem inicial;
  - origem QR/link;
  - hora do scan;
  - dados coletados.
- SLA de resposta:
  - lead sem resposta por X minutos vira oportunidade em risco.

### 10.4 Nao objetivos

- Nao adicionar IA complexa antes de provar confiabilidade.
- Nao criar negociacao automatica.
- Nao substituir o corretor.
- Nao criar fluxos longos que atrasem o contato humano.

## 11. Monetizacao 10/10

### 11.1 Objetivo

Transformar o produto em SaaS real com assinatura funcional.

Fluxo obrigatorio:

`plano escolhido -> checkout Stripe -> pagamento -> webhook assinado -> assinatura ativa -> limites liberados -> portal do cliente -> cancelamento/past_due tratado`

### 11.2 Requisitos P0

- Checkout Stripe funcional.
- Webhook Stripe com verificacao de assinatura.
- Idempotencia de evento.
- Ativacao correta do plano Starter.
- Portal do cliente funcional.
- Cancelamento refletido no produto.
- Pagamento vencido/past_due refletido no produto.
- Logs e tabela de eventos de webhook.
- Testes automatizados para eventos principais.

### 11.3 Planos

Planos devem ser simples:

- Free: testar valor com limite baixo.
- Starter: corretor solo que quer gerar QR e receber leads.
- Pro/Imobiliaria: mais imoveis, equipe e relatorios.

Evitar confusao entre nomes antigos como `solo`, `starter` e `pro`. Deve haver uma tabela de equivalencia e migracao, mas a experiencia publica precisa usar apenas a nomenclatura oficial.

## 12. Seguranca 10/10

### 12.1 Bloqueios P0

Antes de qualquer escala, corrigir:

- cron fail-open quando segredo ausente;
- endpoint publico de lead sem limite forte de payload;
- funcoes service-role expostas sem autenticacao adequada;
- webhooks de pagamento sem assinatura real;
- segredo sensivel em documento local;
- divergencia entre documento de auditoria e codigo real.

### 12.2 Requisitos

- Cron deve falhar fechado quando `CRON_SECRET` estiver ausente.
- Payload publico deve ter limite de tamanho, shape e campos aceitos.
- Webhook Stripe deve rejeitar evento sem assinatura valida.
- Webhook Mercado Pago deve ter verificacao equivalente antes de uso produtivo.
- Funcoes Supabase com service role devem exigir autenticacao ou segredo forte.
- Segredos expostos devem ser removidos e rotacionados.
- RLS deve ter testes reais de isolamento entre contas.

### 12.3 Criterios de aceite

- Nenhuma rota operacional sensivel responde anonimamente.
- Nenhum segredo aparece em PRD, QA report, screenshot ou log versionado.
- Testes de seguranca cobrem os fluxos publicos e administrativos.
- Documento de auditoria bate com o estado real do codigo.

## 13. Engenharia e Release 10/10

### 13.1 Main sagrada

A branch `main` deve sempre representar o estado confiavel do produto.

Requisitos:

- CI verde.
- Testes unitarios verdes.
- Typecheck verde.
- Lint verde.
- Build verde.
- Staging alinhado com branch aprovada.
- Nenhum codigo critico untracked.
- Nenhum artefato QA acidental pronto para commit.

### 13.2 Politica de branch

- Trabalho novo entra por branch.
- Homologacao so vira producao depois de passar checklist.
- `main` nao deve conter fluxo comercial quebrado.
- Relatorios QA devem citar commit, ambiente e data.
- Documentos devem diferenciar claramente:
  - planejado;
  - implementado;
  - validado em staging;
  - validado em producao.

### 13.3 Criterios de aceite

- `pnpm --filter web run test` passa.
- `pnpm --filter web run typecheck` passa.
- `pnpm --filter web run lint` passa.
- `pnpm --filter web run build` passa.
- Importer tests passam.
- CI remoto passa antes de merge.
- Checklist de deploy assinado no PR.

## 14. Fluxo QR Demonstravel

### 14.1 Objetivo

Ter um fluxo completo demonstravel em video, sem corte enganoso.

Roteiro:

1. Criar conta.
2. Cadastrar primeiro imovel.
3. Gerar QR.
4. Escanear QR.
5. Abrir pagina publica do QR.
6. Registrar interesse publico.
7. Lead ser registrado.
8. Corretor receber/visualizar lead.
9. Dashboard atualizar metricas.
10. Baixar placa com QR.

Observacao: em staging, este roteiro nao deve depender de numero real do bot/WhatsApp. Quando nao houver link de WhatsApp/bot, a pagina publica do QR deve permitir registrar interesse por formulario e gravar lead via `/api/public/lead`. O bot continua protegido por testes de regressao e pode ser validado ao vivo apenas quando houver credenciais/numero de homologacao disponiveis.

### 14.2 Criterios de aceite

- Video de ate 3 minutos mostrando o fluxo completo.
- Ambiente de staging limpo e alinhado.
- Dados de teste identificados como teste.
- Nenhuma etapa depende de intervencao manual invisivel.

## 15. Marca Unica

### 15.1 Problema

O produto aparece com nomes diferentes, o que reduz confianca:

- Imobiliaria QR Code;
- ImobQR;
- ImoveisQR;
- FarolImoveis;
- QRImoveis.

### 15.2 Decisao requerida

Escolher uma marca oficial para produto, dominio, UI, documentacao, emails, placas e QR.

Recomendacao:

- Marca publica: ImoveisQR.
- Descricao: QR e WhatsApp para corretores de imoveis.
- Promessa: Cole esse QR no imovel e nunca mais perca um interessado anonimo.

### 15.3 Criterios de aceite

- Header, login, dashboard, emails, placas, QR e docs usam a mesma marca.
- Textos antigos sao removidos ou migrados.
- A marca da placa e a marca do site seguem o mesmo sistema visual.

## 16. Metricas Obrigatorias

### 16.1 Metricas de ativacao

Medir:

- contas criadas;
- usuarios que cadastraram primeiro imovel;
- usuarios que geraram QR;
- usuarios que testaram QR;
- usuarios que receberam primeiro lead;
- usuarios que voltaram em 7 dias;
- tempo ate primeiro QR;
- tempo ate primeiro lead.

### 16.2 Metricas de valor

Medir:

- leads por imovel;
- scans por QR;
- conversas iniciadas;
- conversas qualificadas;
- tempo de primeira resposta;
- oportunidades sem resposta;
- taxa de lead respondido;
- valor comercial em aberto somente apos validacao comercial;
- imoveis com melhor performance.

### 16.3 Metricas comerciais

Medir:

- free para starter;
- starter para pro;
- churn;
- cancelamento;
- motivo de cancelamento;
- MRR;
- usuarios ativos por semana;
- usuarios com lead recebido no periodo.

## 17. Prova Comercial

### 17.1 Piloto

Meta inicial:

- 10 a 20 corretores usando com acompanhamento proximo.

Perfil ideal:

- corretor autonomo com estoque proprio;
- pequena imobiliaria com ate 10 corretores;
- corretor que usa WhatsApp diariamente;
- usuario que sente dor de perder interessado vindo de placa, vitrine, folder ou anuncio fisico.

### 17.2 O que validar

- O corretor entende a promessa em menos de 30 segundos?
- Ele consegue gerar QR sozinho?
- Ele cola/divulga o QR em algum lugar real?
- Ele recebe lead real?
- Ele volta ao painel?
- Ele pagaria pelo produto?
- O que o faria cancelar?

### 17.3 Evidencias exigidas

- depoimentos;
- prints permitidos;
- funil de ativacao;
- historico de leads;
- motivos de perda;
- motivos de compra;
- casos reais de uso.

## 18. Plano de Execucao

### 18.1 Primeiros 30 dias - Confianca e core

Objetivo: eliminar riscos que impedem investimento.

Entregas:

- main verde;
- CI verde;
- staging alinhado;
- codigo critico versionado;
- checkout Stripe funcional;
- webhook Stripe assinado e idempotente;
- cron fechado;
- payload publico limitado;
- segredo removido e rotacionado;
- marca escolhida;
- home sem metricas fracas;
- fluxo QR demonstravel em video.

### 18.2 Dias 31 a 60 - Produto que encanta

Objetivo: melhorar ativacao e percepcao de valor.

Entregas:

- onboarding curto;
- primeiro imovel minimo;
- QR testavel imediatamente;
- placa baixavel;
- dashboard de dinheiro;
- lead status;
- oportunidade sem resposta;
- importador assistido com fallback manual;
- metricas de ativacao instrumentadas.

### 18.3 Dias 61 a 90 - Prova comercial

Objetivo: provar que corretores usam e pagam.

Entregas:

- 10 a 20 corretores piloto;
- funil medido;
- entrevistas de compra/cancelamento;
- plano Starter vendido ou validado;
- casos reais;
- relatorio de retencao inicial;
- decisao sobre expansao para imobiliarias.

## 19. Fora de Escopo

Ficam fora desta etapa:

- marketplace publico amplo;
- SEO massivo de imoveis;
- IA complexa de negociacao;
- CRM completo;
- automacoes comerciais avancadas;
- importador universal prometendo suporte a todos os portais;
- relatorios financeiros sofisticados;
- app mobile nativo.

## 20. Criterios de Aceite Investidor

Um investidor tecnico deveria conseguir verificar:

- tese simples e forte;
- produto demonstravel em 3 minutos;
- fluxo pago funcional;
- seguranca minima madura;
- main e CI confiaveis;
- marca consistente;
- pilotos reais;
- metricas de ativacao e valor;
- roadmap focado;
- evidencia de que o produto resolve uma dor especifica.

## 21. Checklist Final 10/10

- [ ] Promessa central aplicada na home.
- [ ] Metricas publicas fracas removidas.
- [ ] Onboarding curto implementado.
- [ ] Primeiro QR gerado em ate 5 minutos.
- [ ] Bot responde, registra lead e avisa corretor.
- [ ] Dashboard mostra leads, tempo de resposta e oportunidades sem resposta, sem comissao estimada artificial.
- [ ] Importador funciona como acelerador, com fallback manual.
- [ ] Marketplace rebaixado para fase futura.
- [ ] Stripe completo e testado.
- [ ] Cron falha fechado.
- [ ] Payload publico limitado.
- [ ] Webhooks assinados.
- [ ] Segredo exposto removido e rotacionado.
- [ ] Main verde.
- [ ] CI verde.
- [ ] Staging alinhado.
- [ ] Codigo critico versionado.
- [ ] Marca unica aplicada.
- [ ] Fluxo QR demonstravel em video.
- [ ] Metricas de ativacao instrumentadas.
- [ ] Metricas de valor instrumentadas.
- [ ] Piloto com corretores reais iniciado.

## 22. Decisao Final

A direcao do produto deve ser:

> ImoveisQR e o SaaS que transforma QR de imovel em lead qualificado no WhatsApp, com painel para o corretor saber onde esta ganhando ou perdendo dinheiro.

Tudo que reforca essa frase entra na prioridade.

Tudo que distrai dessa frase deve ser rebaixado, adiado ou removido.
