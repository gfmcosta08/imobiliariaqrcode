# PRD Tecnico - Geracao de QR do Anuncio com Logo Embutida (Sem Regressao no Bot)

Data: 2026-05-14  
Status: Proposto para implementacao controlada  
Prioridade: P0 (seguranca operacional do bot)

## 1. Resumo
Este PRD define a padronizacao visual do QR Code do anuncio: o QR passa a ser renderizado dentro da logo oficial aprovada, preservando escaneabilidade e identidade da marca.

Regra central: cada anuncio continua tendo um QR/token unico que identifica aquele anuncio. A mudanca e somente visual: o mesmo QR Code, novo ou antigo, deve ser exibido e impresso dentro da logo de placa `qr-sign-logo-black-blue.png`.

Requisito critico: nenhuma alteracao desta entrega pode causar regressao no bot WhatsApp nem degradar os fluxos atuais do sistema.

## 2. Invariantes de Nao Regressao (Obrigatorio)
Este PRD herda e respeita integralmente os contratos ja definidos em:
- `prd/INVARIANTES-fluxo-bot-whatsapp.md`
- `prd/PRD-camadas-protecao-fluxo-bot-whatsapp.md`
- `prd/PRD-trava-anti-silencio-bot-whatsapp.md`
- `prd/PRD-correcao-deduplicacao-qr-bot-whatsapp.md`
- `prd/PRD-monitor-deterministico-rastreabilidade-bot-whatsapp.md`

Bloqueios de escopo para esta entrega:
- Nao alterar regras de sessao, menu, deduplicacao funcional, dispatch, monitoramento e webhook inbound do bot.
- Nao alterar contratos de `origin_property_id`, `current_property_id` e fluxos pos-semelhantes.
- Nao alterar sem PRD separado: `conversation-handle`, `whatsapp-webhook-inbound`, `whatsapp-dispatch`, `bot-health-monitor`, tabelas `conversation_sessions`, `whatsapp_messages`, `bot_interactions`.

## 3. Objetivo da Mudanca
Padronizar o artefato visual do QR no cadastro/edicao de anuncio para que o bloco inferior de QR exiba o QR embutido na logo, com leitura tecnica confiavel em digital e impressao.

Objetivo operacional:
- anuncios novos ja devem nascer com o QR Code visualmente inserido dentro da logo da placa;
- anuncios antigos devem preservar o mesmo `qr_token`/URL e apenas passar a ser reexibidos no novo layout com logo;
- nenhum QR antigo deve ser trocado, invalidado ou recriado apenas por causa da mudanca visual.

## 4. Escopo Funcional
Incluido:
- Composicao visual do QR do anuncio com moldura oficial da logo `qr-sign-logo-black-blue.png`.
- Geracao automatica da composicao visual ao salvar/criar anuncio novo.
- Reexibicao de anuncios antigos no layout novo, reaproveitando o QR/token ja existente.
- Botao `Imprimir PDF` na tela do anuncio, usando a impressao do navegador para salvar a placa em PDF.
- Impressao da placa com arte oficial, QR do anuncio, ID automatico do sistema e codigo interno informado pelo usuario.
- Logs, metricas e criterio de bloqueio por saude do bot.

Nao incluido:
- Mudanca de dominio/resolve/token do QR.
- Mudanca na tabela `property_qrcodes` ou no valor de `qr_token`.
- Criacao de token novo para anuncio antigo apenas para atualizar a aparencia da placa.
- Mudanca de menu do bot ou fluxos conversacionais.
- Mudanca em APIs publicas externas.

## 5. Isolamento Tecnico da Solucao
A implementacao deve ficar restrita ao pipeline de geracao de imagem do QR do anuncio.

Deve permanecer intacto:
- token/URL atual ja usado pelo QR (`/q/{qr_token}`);
- tabela `property_qrcodes` e valor de `property_qrcodes.qr_token`;
- fluxo de resolucao do QR (`qr-resolve`);
- deduplicacao, contagem de leituras e eventos de acesso;
- payloads/eventos esperados pelo bot.

Regra de seguranca:
- Se a composicao visual falhar, manter fallback para ativo anterior sem interromper fluxo de anuncio.
- O fallback pode exibir QR simples, mas nao pode gerar token novo nem alterar o destino do QR.

## 6. Estrategia de Rollout sem Impacto
### Fase 1 - Shadow
- Validar a composicao visual em paralelo (shadow) para comparacao de leitura, sem alterar token, URL ou fluxo de bot.

### Fase 2 - Novos anuncios
- Habilitar por feature flag o layout novo para anuncios novos/atualizados.
- A primeira visualizacao/placa do anuncio novo ja deve mostrar o QR dentro da logo.

### Fase 3 - Backfill legado
- Reprocessar apenas a composicao visual de anuncios antigos em lotes pequenos com throttle e idempotencia.
- Anuncios antigos devem manter o mesmo `qr_token` e a mesma URL publica.
- Falha por item nao interrompe lote inteiro; item falho entra em retry.

Rollback:
- Desativar feature flag para retorno imediato ao render anterior, sem tocar no fluxo conversacional do bot.

## 7. Backfill com Protecao
- Unidade de processamento: `property_id`.
- Idempotencia: repeticao de execucao nao pode corromper ativo, duplicar efeitos nem gerar novo `qr_token`.
- Persistir status por item: `pending`, `processing`, `done`, `failed`, `retrying`.
- Em falha de composicao visual: manter QR simples/ativo atual e registrar causa tecnica.

## 8. Observabilidade e Alertas
Logs obrigatorios:
- inicio da geracao;
- sucesso;
- falha;
- fallback;
- tempo de processamento.

Metricas obrigatorias:
- taxa de leitura QR pos-render;
- taxa de erro de geracao;
- tempo medio de geracao;
- saude do bot antes/durante/depois rollout (resposta visivel, anti-silencio, estabilidade de dispatch).

Gate de seguranca:
- Qualquer degradacao confirmada do bot pausa rollout e aciona rollback.

## 9. Interfaces e Contratos
- Nenhuma API publica nova.
- Sem alteracao de contrato do bot.
- Alteracao restrita ao artefato visual de QR do anuncio.
- Fonte de verdade do destino continua sendo `property_qrcodes.qr_token`.
- A URL publica continua no formato `/q/{qr_token}`.

## 9.1. Impressao/PDF Da Placa
- Quando houver QR ativo, a tela do anuncio deve exibir a composicao visual da placa com a logo `qr-sign-logo-black-blue.png` e o QR gerado para a URL `/q/{qr_token}`.
- A mesma area deve oferecer o botao `Imprimir PDF`.
- O botao deve acionar a impressao do navegador (`window.print()`), permitindo que o usuario escolha `Salvar como PDF`.
- A area imprimivel deve conter somente:
  - arte da logo com o QR Code referente ao anuncio;
  - ID automatico do sistema (`properties.public_id`);
  - codigo interno informado pelo usuario (`properties.internal_code`), quando existir;
  - URL publica do QR em texto menor para conferencia.
- Se `internal_code` estiver vazio, a placa deve exibir `Codigo interno: nao informado`.
- Se nao houver QR ativo, manter a mensagem de indisponibilidade e nao exibir o botao de impressao.
- A impressao/PDF nao pode criar novo `qr_token`, alterar status do anuncio, registrar leitura, acionar bot ou chamar `qr-resolve`.

## 10. Criterios de Aceite
1. Entrada via QR continua abrindo fluxo correto no bot.
2. Menu/opcoes do bot continuam sem regressao e sem silencio.
3. Deduplicacao/dispatch sem aumento de duplicidade ou perda de envio.
4. QR visual novo abre destino correto em mobile.
5. Anuncio novo ja aparece com QR dentro da logo na primeira visualizacao apos salvar/criar.
6. Anuncio antigo preserva o mesmo `qr_token`/URL e passa a aparecer no layout novo com logo.
7. QR visual novo aparece no bloco inferior do cadastro/edicao sem quebrar UI.
8. Botao `Imprimir PDF` abre a impressao do navegador contendo somente a placa com QR, `public_id`, `internal_code` e URL publica.
9. Backfill/reprocessamento visual conclui lotes com rastreabilidade de sucesso/falha por `property_id`.
10. Qualquer falha de regressao no bot bloqueia release e exige rollback.

## 11. Plano de Testes (Nao Regressao Obrigatoria)
Executar antes de liberar feature flag global:
- `pnpm test:bot-guardrails`
- `pnpm test`
- `pnpm --filter web run typecheck`
- `git diff --check`

Validacoes funcionais manuais:
- criar anuncio e confirmar que o primeiro QR exibido ja vem dentro da logo;
- abrir anuncio antigo e confirmar que o mesmo token/URL aparece dentro da logo;
- clicar em `Imprimir PDF` e confirmar que a pre-visualizacao contem somente a placa com QR, ID do sistema, codigo interno e URL;
- escanear QR novo e antigo em celular;
- testar jornada via QR no bot ate menu e opcoes.

## 12. Assumptions
- A logo oficial ja aprovada para o QR do anuncio e a referencia da esquerda do PRD de identidade visual, registrada como `qr-sign-logo-black-blue.png`.
- Essa referencia sera usada como base visual da placa do anuncio, com o QR Code gerado do imovel inserido dentro dela.
- A infraestrutura de resolve do QR permanece a mesma.
- QR existente significa token/URL existente, nao necessariamente imagem PNG previamente salva.
- `public_id` e o codigo automatico criado pelo sistema.
- `internal_code` e o codigo livre informado pelo usuario para o imovel.
- `Imprimir PDF` significa abrir a impressao do navegador para salvar como PDF, sem geracao server-side de arquivo.
- Nao regressao do bot e criterio P0 com precedencia sobre prazo.

## 13. Referencia de Branding
Documento de apoio visual:
- `prd/PRD-identidade-visual-imoveisqr-2026-05-14.md`

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
