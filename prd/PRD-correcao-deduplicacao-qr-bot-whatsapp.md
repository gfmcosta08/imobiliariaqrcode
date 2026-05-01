# PRD Tecnico: Correcao Segura Da Deduplicacao Do QR Code No Bot WhatsApp

## Resumo

Corrigir o fluxo inicial do QR Code para impedir que mensagens internas, como `lead_created`, sejam tratadas como resposta ja enviada ao cliente.

O objetivo e garantir que todo numero novo que leia um QR receba o pacote correto do imovel: descricao, fotos e menu, sem quebrar opcao 1, opcao 2, opcao 3, atendimento ao corretor, monitor anti-silencio ou dispatcher.

## Diagnostico Do Impacto

- A area sensivel e `supabase/functions/conversation-handle/index.ts`.
- A deduplicacao do QR usava contagem de qualquer mensagem outbound recente do lead/imovel.
- Mensagens internas `message_type = "system"`, como `lead_created`, podiam entrar nessa contagem e bloquear o envio do pacote completo.
- No caso analisado de 30/04/2026 as 16:45, o sistema criou lead e mensagem interna, mas o cliente nao recebeu descricao, fotos e menu no fluxo inicial.

## Arquivos Afetados

- Codigo: `supabase/functions/conversation-handle/index.ts`.
- Testes: `apps/web/src/guardrails/whatsapp-flow.contract.test.ts`.
- Documentacao: `prd/PRD-correcao-deduplicacao-qr-bot-whatsapp.md`.

Nao ha alteracao de banco, migration, dependencias, dispatcher, home, cadastro de imoveis ou QR publico.

## Alteracao Proposta

- Criar uma contagem especifica para pacote visivel do QR.
- Considerar como pacote visivel apenas mensagens outbound do cliente, do mesmo imovel, recentes e com `kind` esperado do pacote:
  - `lead_intro`;
  - `property_summary`;
  - `property_image`;
  - `main_menu`;
  - `menu_option_*`.
- Ignorar explicitamente:
  - `message_type = "system"`;
  - `payload.to_broker = true`;
  - `payload.kind = "lead_created"`;
  - alertas internos e notificacoes tecnicas.
- Se existir apenas `lead_created`, o bot deve continuar e enviar o pacote completo.
- Se ja existir pacote real recente, o bot deve manter a deduplicacao e evitar duplicidade.

## Testes Obrigatorios

- Garantir que `lead_created` nao conta como pacote ja enviado.
- Garantir que mensagem `system` nao bloqueia `sendPropertyPack`.
- Garantir que `payload.to_broker = true` nao bloqueia `sendPropertyPack`.
- Garantir que pacote real recente continua protegendo contra duplicidade.
- Garantir que QR inicial segue com descricao, fotos e menu.
- Garantir que opcao 2, opcao 1 pos-semelhantes, ID invalido, notificacao ao corretor e trava anti-silencio continuam protegidos.

## Validacao

Executar:

- `pnpm test`
- `pnpm --filter web run typecheck`
- `git diff --check`

Quando possivel, executar tambem:

- `pnpm --filter web run build`

## Criterios De Aceitacao

- Numero novo que le QR nao fica sem pacote por causa de `lead_created`.
- Mensagem `system` nunca conta como atendimento visivel ao cliente.
- Notificacao ao corretor nunca conta como atendimento ao cliente.
- Retry real do webhook nao gera pacote duplicado.
- Bot segue funcionando nos fluxos principais.
- Nenhuma migration ou mudanca de dependencia.
