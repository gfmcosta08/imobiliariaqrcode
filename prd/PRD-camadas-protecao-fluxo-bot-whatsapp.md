# PRD: Camadas De Protecao Do Fluxo Do Bot WhatsApp

## Resumo

Criar uma blindagem obrigatoria para impedir que mudancas futuras no sistema quebrem o fluxo principal do bot WhatsApp. O objetivo e garantir que qualquer alteracao solicitada fique restrita ao ponto pedido e nao altere, direta ou indiretamente, comportamentos criticos ja validados.

Este PRD nao muda regra comercial do bot. Ele cria camadas de protecao, validacao e bloqueio para preservar o funcionamento atual.

## Fluxos Criticos Protegidos

- Entrada por QR/codigo do imovel:
  - envio de descricao;
  - envio de fotos;
  - envio do menu.
- Menu principal:
  - `1 - Falar com o corretor sobre esse imovel`;
  - `2 - Ver imoveis semelhantes`;
  - `3 - Quero o contato do corretor`.
- Fluxo pos-semelhantes:
  - opcao 2 lista imoveis semelhantes;
  - opcao 1 pede ID do imovel;
  - ID valido registra interesse e notifica o corretor captador;
  - ID invalido pede novo ID sem perder contexto;
  - opcao 3 envia contato do corretor captador do QR original.
- Regras de sessao:
  - `origin_property_id` identifica o imovel original e corretor captador;
  - `current_property_id` identifica o imovel atual do contexto;
  - `target_property_id` so e usado temporariamente durante confirmacao/coleta de dados.
- Protecao anti-silencio:
  - toda mensagem inbound precisa gerar resposta visivel ao cliente, fallback ou erro rastreavel;
  - mensagens internas e notificacoes ao corretor nao contam como resposta ao cliente.

## Camadas De Protecao

### Camada 1: PRD obrigatorio por mudanca sensivel

Toda alteracao que toque em `conversation-handle`, `whatsapp-webhook-inbound`, `whatsapp-dispatch`, `bot-health-monitor`, `conversation_sessions`, `whatsapp_messages` ou `bot_interactions` deve ter PRD aprovado antes da implementacao.

O PRD deve declarar quais fluxos do bot serao afetados e quais nao podem ser alterados.

### Camada 2: Mapa de invariantes do bot

O projeto deve manter um documento tecnico com as regras que jamais podem ser quebradas. Esse mapa e a fonte oficial para revisao de codigo, testes e validacao de deploy.

### Camada 3: Guardrails automatizados

Os testes em `apps/web/src/guardrails` devem proteger contratos permanentes do bot. Cada bug corrigido no bot deve virar um teste de contrato permanente.

### Camada 4: Suite de regressao do bot

A suite deve cobrir jornadas completas:

- QR novo cliente;
- QR duplicado em ate 5 minutos;
- opcao 1 direta;
- opcao 2 semelhantes;
- opcao 2 -> opcao 1 -> ID valido;
- opcao 2 -> opcao 1 -> ID invalido;
- opcao 2 -> imovel de outro corretor -> opcao 3;
- falha tecnica com fallback anti-silencio.

### Camada 5: Checklist obrigatorio antes de deploy

Antes de deploy de qualquer funcao do bot, executar:

- `pnpm test`;
- `pnpm --filter web run typecheck`;
- `git diff --check`.

Se tocar em Edge Function do Supabase, confirmar deploy da funcao correta. Se tocar em fluxo do WhatsApp, registrar no resumo quais fluxos foram testados.

### Camada 6: Protecao contra alteracao fora do escopo

Toda implementacao deve listar os arquivos alterados. Se a mudanca solicitada nao for sobre bot, o fluxo do bot nao deve ser alterado. Se for necessario tocar em arquivo compartilhado com o bot, a mudanca deve incluir guardrail especifico demonstrando que o bot continuou intacto.

## Mudancas Tecnicas Planejadas

- Criar este PRD como documento oficial de protecao do fluxo do bot.
- Criar `prd/INVARIANTES-fluxo-bot-whatsapp.md` com regras permanentes de sessao, roteamento, notificacao e anti-silencio.
- Expandir guardrails em `apps/web/src/guardrails` para validar:
  - existencia do PRD;
  - existencia do mapa de invariantes;
  - existencia de comando dedicado para contratos do bot;
  - preservacao dos contratos criticos de WhatsApp e monitoramento.
- Manter `bot-monitor.contract.test.ts` como protecao do monitor anti-silencio e ampliar somente se a regra de monitoramento mudar.
- Criar script dedicado `pnpm test:bot-guardrails` para rodar os contratos criticos antes de mudancas sensiveis.

## Criterios De Aceite

- Existe um PRD oficial descrevendo as camadas de protecao do bot.
- Os fluxos criticos do bot estao documentados como invariantes.
- Toda correcao historica importante do bot possui teste de contrato.
- Alteracoes futuras em arquivos sensiveis do bot falham nos testes se quebrarem comportamento ja validado.
- O bot nao pode voltar a:
  - ficar em silencio;
  - perder contexto apos imoveis semelhantes;
  - tratar ID pos-semelhantes como novo QR;
  - enviar contato do corretor errado;
  - contar notificacao interna como resposta ao cliente.
- O processo de deploy exige validacao local e confirmacao da funcao publicada.

## Testes

- Rodar:
  - `pnpm test`;
  - `pnpm --filter web run typecheck`;
  - `git diff --check`.
- Validar guardrails especificos:
  - `whatsapp-flow.contract.test.ts`;
  - `bot-monitor.contract.test.ts`;
  - `bot-protection.contract.test.ts`.
- Testar manualmente no WhatsApp, quando houver alteracao em bot:
  - QR inicial;
  - opcao 2;
  - opcao 1 apos semelhantes;
  - ID valido;
  - ID invalido;
  - opcao 3 apos imovel semelhante;
  - ausencia de silencio.

## Assumptions

- O fluxo atual do bot esta correto e deve ser tratado como comportamento protegido.
- Este PRD cria protecao de processo, testes e contratos; nao altera regra comercial do bot.
- Mudancas futuras no bot so devem ser feitas com escopo explicito, teste correspondente e validacao antes do deploy.
- Alteracoes locais pendentes de correcoes anteriores devem ser preservadas e nao revertidas.
