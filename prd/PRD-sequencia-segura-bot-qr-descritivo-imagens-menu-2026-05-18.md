# PRD — Sequência Segura Do Bot Após QR Code

Data: 2026-05-18

## Objetivo

Garantir que, ao receber uma mensagem originada por QR Code de anúncio, o bot identifique automaticamente o imóvel relacionado e responda primeiro ao cliente com informação útil e visível, sem depender do processamento de lead para não ficar silencioso.

## Sequência Oficial

1. Resolver o QR Code, token ou código público do imóvel.
2. Criar/atualizar apenas o contexto mínimo de sessão para manter `origin_property_id`, `current_property_id`, estado e menu.
3. Enfileirar o pacote visível ao cliente nesta ordem:
   - descritivo completo do imóvel, incluindo corretor responsável, nome e WhatsApp/telefone;
   - imagens do imóvel, quando existirem;
   - menu principal com as três opções já previstas.
4. Validar a trava anti-silêncio confirmando que houve resposta visível ao cliente.
5. Somente depois disso, processar lead, interação, rastros internos e notificações em bloco protegido por `try/catch`.

## Regras Obrigatórias

- A primeira mensagem visível do fluxo QR deve ser o descritivo do imóvel; não deve haver mensagem introdutória separada antes do imóvel.
- O corretor responsável é o broker vinculado ao anúncio do QR.
- Se nome ou telefone do corretor não estiverem disponíveis, o bot deve informar fallback seguro, sem travar o fluxo.
- Imóvel sem imagens deve seguir normalmente: descritivo e menu.
- `origin_property_id` não muda quando o cliente navega para imóveis semelhantes; ele continua representando o imóvel captador do QR.
- `current_property_id` pode mudar conforme interação do menu e imóveis semelhantes.
- Deduplicação só pode considerar mensagens visíveis ao cliente.
- Mensagens `system` e notificações ao corretor com `payload.to_broker = true` nunca contam como resposta ao cliente.
- Falha no processamento posterior de lead não pode impedir o envio do descritivo, imagens ou menu.

## Proteções Mantidas

- Anti-silêncio por janela de resposta.
- Deduplicação de pacotes QR recentes.
- Ordenação por `flow_group` e `flow_step`.
- Rastreabilidade por etapas de interação.
- Fallback quando o pacote do imóvel falhar.
- Menu existente com opções:
  1. falar com o corretor sobre o imóvel;
  2. ver imóveis semelhantes;
  3. receber contato do corretor.

## Critérios De Aceite

- QR de imóvel com imagens envia: descritivo com corretor → imagens → menu.
- QR de imóvel sem imagens envia: descritivo com corretor → menu.
- Lead é salvo/processado apenas após o pacote visível ser enfileirado e validado.
- Falha de lead fica registrada, mas não silencia o bot.
- Repetição do mesmo QR em até 5 minutos não duplica pacote se já houver mensagens visíveis ativas/recentes.
- Guardrails automatizados impedem regressão da ordem do fluxo.

## Fora Do Escopo Desta Alteração

- Não alterar `/q/{token}` nem a geração do link WhatsApp.
- Não alterar secrets, telefone do bot, crons ou deploy das funções não relacionadas.
- Não criar migration, fila nova ou tabela nova nesta versão.
