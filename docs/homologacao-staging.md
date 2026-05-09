# Homologacao E Publicacao Segura

Este guia operacional implementa o PRD `prd/PRD-homologacao-staging-dados-sanitizados-whatsapp.md`.

## Ambientes

| Ambiente | Frontend          | Banco/Funcoes             | Dados              | Uso             |
| -------- | ----------------- | ------------------------- | ------------------ | --------------- |
| Local    | `pnpm dev`        | Supabase local ou Staging | falsos             | desenvolvimento |
| Staging  | Vercel Preview    | Supabase Staging          | falsos/sanitizados | homologacao     |
| Producao | Vercel Production | Supabase Production       | reais              | cliente final   |

## Regras Que Nao Podem Quebrar

- Preview da Vercel nunca aponta para Supabase Production.
- WhatsApp real nunca aponta para Supabase Staging.
- WhatsApp de teste nunca aponta para Supabase Production.
- Staging usa Stripe teste e secrets de teste.
- Toda alteracao de schema usa nova migration em `supabase/migrations`.
- Nenhum segredo entra no Git.

## Setup Inicial Do Staging

1. Criar um projeto separado no Supabase para Staging.
2. Aplicar as migrations existentes nesse projeto.
3. Configurar as variaveis Preview na Vercel usando `env/vercel-preview.example.env` como referencia.
4. Criar dados falsos ou importar dados sanitizados.
5. Publicar/atualizar Edge Functions no projeto Staging antes de testar bot e webhooks.

## Fluxo Padrao De Mudanca

1. Criar branch `feature/nome-da-mudanca`.
2. Desenvolver localmente.
3. Criar migration nova se mudar banco.
4. Rodar:

   ```powershell
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

5. Aplicar migrations no Supabase Staging.
6. Subir branch e abrir Pull Request.
7. Testar o link Preview.
8. Preencher a checklist do PR.
9. Fazer merge na `main` somente depois de CI verde e homologacao.
10. Aplicar migrations em Production.
11. Validar Production com smoke test controlado.

## Teste Do WhatsApp Sem Numero De Homologacao

Enquanto nao houver numero exclusivo de teste, valide o webhook com payload simulado:

```powershell
$env:SUPABASE_URL="https://projeto-staging.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="service_role_staging"
$env:TEST_LEAD_PHONE="5511900000001"
$env:TEST_MESSAGE_TEXT="IMV-TESTE-001"
.\scripts\test-whatsapp-webhook-staging.ps1
```

O script chama:

```text
https://PROJETO_STAGING.supabase.co/functions/v1/whatsapp-webhook-inbound
```

Depois da chamada, confira no Supabase Staging:

- `webhook_events`;
- `whatsapp_messages`;
- `bot_interactions`;
- logs das Edge Functions `whatsapp-webhook-inbound`, `conversation-handle` e `whatsapp-dispatch`.

Esse teste valida processamento simulado. Ele nao substitui uma conversa real com numero de homologacao.

## Teste Do WhatsApp Com Numero De Homologacao

Quando o numero de teste existir:

1. Criar instancia separada no provedor WhatsApp.
2. Configurar webhook da instancia para:

   ```text
   https://PROJETO_STAGING.supabase.co/functions/v1/whatsapp-webhook-inbound
   ```

3. Configurar secrets da instancia no Supabase Staging.
4. Cadastrar um imovel de teste pelo Preview.
5. Escanear o QR de teste e conversar com o numero de homologacao.
6. Validar resposta do bot, menu, semelhantes, lead, notificacao e logs.

## Smoke Test De Producao

Apos deploy em producao:

- abrir home;
- fazer login;
- abrir dashboard;
- abrir um imovel existente;
- abrir `/api/health`;
- abrir `/api/health?deep=1`;
- se a mudanca mexeu em bot, enviar uma mensagem controlada e curta no numero real.

## Sanitizacao De Dados

Antes de copiar qualquer dado real para Staging, remover ou trocar:

- nomes reais;
- e-mails;
- telefones;
- documentos;
- enderecos completos;
- mensagens de leads;
- dados de pagamento;
- tokens, secrets, chaves de API e webhook secrets;
- arquivos ou URLs privadas que identifiquem pessoas reais.

Use dados ficticios sempre que possivel. Dados reais sanitizados so devem entrar no Staging quando forem necessarios para reproduzir volume, combinacoes de status ou cenarios de borda.
