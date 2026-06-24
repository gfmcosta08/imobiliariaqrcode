# Invariantes Do Fluxo Do Bot WhatsApp

Este documento e a fonte oficial das regras que nao podem ser quebradas em alteracoes futuras do bot WhatsApp.

## Arquivos Sensiveis

Mudancas nestes pontos exigem PRD aprovado, guardrail e validacao antes de deploy:

- `supabase/functions/conversation-handle/index.ts`
- `supabase/functions/whatsapp-webhook-inbound/index.ts`
- `supabase/functions/whatsapp-dispatch/index.ts`
- `supabase/functions/bot-health-monitor/index.ts`
- migrations que alterem `conversation_sessions`, `whatsapp_messages` ou `bot_interactions`
- testes em `apps/web/src/guardrails`

## Sessao

- `origin_property_id` e o imovel original do QR/codigo e define o corretor captador do lead.
- `current_property_id` e o imovel atual usado como contexto do menu e da navegacao.
- `target_property_id` e temporario e so deve existir enquanto o bot aguarda confirmacao/coleta de nome ou conclusao de escolha.
- Escolher um imovel semelhante pode atualizar `current_property_id`, mas nao pode sobrescrever `origin_property_id`.

## Entrada Por QR Ou Codigo

- Um QR/codigo valido deve enviar pacote visivel ao cliente:
  - introducao/descricao;
  - fotos quando existirem;
  - menu principal.
- Deduplicacao de QR em ate 5 minutos so pode bloquear reenvio quando ja existir pacote visivel ao cliente.
- Mensagens internas e notificacoes ao corretor nao podem contar como pacote visivel ao cliente.

## Menu Principal

- Opcao 1 registra interesse no imovel do contexto quando o contexto e unico.
- Opcao 2 mostra imoveis semelhantes e preserva a sessao.
- Opcao 3 envia contato do corretor captador quando existe `origin_property_id`.
- Apos enviar contato do corretor, a sessao continua aberta e o menu deve ser reenviado.
- Opcao 4 envia exatamente `Ok! Agradeço seu contato!` e fecha a sessao.
- Uma sessao fechada so volta ao fluxo de atendimento por um novo QR/codigo valido.

## Fluxo Pos-Semelhantes

- Opcao 2 deve listar imoveis semelhantes sem alterar o corretor captador.
- Opcao 1 deve perguntar `Qual o ID do imovel sobre o qual voce deseja falar?`.
- O ID informado deve ser resolvido contra todos os imoveis semelhantes ja exibidos, nao apenas a ultima pagina.
- ID valido registra interesse, notifica o corretor captador e reenvia menu.
- ID invalido informa que nao encontrou o imovel e pede o ID novamente sem perder contexto.
- ID enviado diretamente no menu pos-semelhantes deve ser aceito como escolha implicita, quando pertencer aos imoveis exibidos.
- ID pos-semelhantes nunca deve ser tratado como novo QR antes do estado da sessao decidir o significado da mensagem.

## Notificacoes

- O corretor captador e o corretor vinculado ao QR/codigo original.
- Se o imovel escolhido pertence a outro corretor, a notificacao continua indo ao captador e deve incluir dados do dono do anuncio.
- Notificacao ao corretor deve usar `payload.to_broker = true`.
- Notificacao ao corretor nao e resposta visivel ao cliente.
- A confirmacao de visita ao cliente deve incluir nome e WhatsApp do corretor dono do anuncio
  escolhido, mesmo quando ele for diferente do corretor captador.

## Anti-Silencio

- Toda mensagem inbound deve terminar com resposta visivel ao cliente, fallback tecnico ou erro rastreavel.
- Resposta visivel ao cliente ignora:
  - `message_type = "system"`;
  - payload com `to_broker = true`.
- Sucesso falso deve ser bloqueado com erro rastreavel e fallback quando aplicavel.
- O monitor de saude deve detectar travamento em no maximo 5 minutos.

## Checklist Para Mudancas No Bot

Antes de fechar qualquer mudanca sensivel:

- confirmar PRD aprovado;
- listar arquivos alterados;
- declarar quais fluxos do bot foram afetados;
- adicionar ou atualizar guardrail correspondente;
- executar `pnpm test:bot-guardrails`;
- executar `pnpm test`;
- executar `pnpm --filter web run typecheck`;
- executar `git diff --check`;
- se houver Edge Function alterada, confirmar deploy da funcao correta.
