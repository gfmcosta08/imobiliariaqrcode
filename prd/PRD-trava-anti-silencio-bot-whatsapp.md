# PRD Tecnico: Trava Anti-Silencio Do Bot WhatsApp

## Resumo

Implementar uma protecao obrigatoria para garantir que toda mensagem recebida pelo bot termine com uma resposta visivel ao cliente, um fallback tecnico imediato ou um erro rastreavel.

A falha analisada em 30/04/2026 as 16:45 ocorreu porque o fluxo criou lead e sessao, mas nao comprovou que uma mensagem real ao cliente foi enfileirada. A partir desta melhoria, o webhook nao deve ser considerado processado quando nao houver resposta visivel ao cliente.

## Diagnostico Do Impacto

- Area sensivel: `whatsapp-webhook-inbound`, `conversation-handle`, `whatsapp_messages`, `bot_interactions` e `bot_interaction_steps`.
- O rastreio existente registrava etapas, mas nao validava a pos-condicao principal: houve resposta visivel ao cliente.
- Mensagens internas `message_type = system` e notificacoes ao corretor com `payload.to_broker = true` nao podem contar como atendimento ao cliente.
- A protecao deve preservar QR inicial, opcoes do menu, imoveis semelhantes, coleta/confirmacao de nome e notificacao ao corretor.

## Regras De Produto

- Toda mensagem inbound precisa terminar com resposta visivel ao cliente, fallback tecnico ou erro rastreavel.
- Lead criado sozinho nao e atendimento ao cliente.
- Notificacao ao corretor nao e atendimento ao cliente.
- Mensagem interna do sistema nao e atendimento ao cliente.
- O cliente nao pode ficar sem retorno quando uma etapa falhar ou quando o handler retornar sucesso falso.

## Estrategia Tecnica

- Criar validacao de resposta visivel no `conversation-handle`.
- Contar somente mensagens outbound para o cliente com status `queued`, `processing` ou `sent`.
- Ignorar mensagens `system`.
- Ignorar mensagens com `payload.to_broker = true`.
- Em sucesso silencioso, enfileirar fallback tecnico, marcar erro rastreavel e retornar falha controlada.
- No inbound, fazer checagem defensiva antes de marcar `webhook_events` como `processed`.

## Criterios De Aceitacao

- QR inicial continua enviando descricao, fotos e menu.
- Opcao 2 continua exibindo imoveis semelhantes.
- Opcao 1 apos semelhantes continua perguntando ID e registrando visita.
- ID invalido continua pedindo nova tentativa.
- Falha antes de responder ao cliente gera fallback imediato.
- `bot_interactions.error_detail` registra `silent_response_blocked` quando houver sucesso falso.
- Webhook nao e marcado como `processed` sem resposta visivel ou deduplicacao valida.

## Validacao

- `pnpm test`
- `pnpm --filter web run typecheck`
- `git diff --check`

## Escopo Fora Desta Versao

- Nao altera banco.
- Nao altera schema de imoveis.
- Nao altera home, cadastro, QR publico ou busca.
- Nao altera contratos externos do bot.
- Nao reescreve historico nem refatora fluxo comercial.
