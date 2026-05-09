# PRD: Ambiente Seguro De Homologacao Com Dados Sanitizados E WhatsApp De Teste

**Status:** Aprovado para implementacao (v1)
**Data:** 2026-05-08
**Produto/Modulo:** Supabase, Vercel, GitHub, WhatsApp, Bot, Edge Functions, Dados Sanitizados

## Resumo

Criar um fluxo seguro para desenvolver, testar e publicar novas funcionalidades sem afetar clientes reais.

O sistema passa a ter separacao clara entre:

- **Producao:** Vercel Production + Supabase Production + WhatsApp real.
- **Homologacao/Staging:** Vercel Preview + Supabase Staging + WhatsApp de teste.
- **Local:** desenvolvimento na maquina.

Como ainda nao existe um numero exclusivo para testes, a homologacao fica em duas fases: primeiro Staging para site, banco e testes simulados; depois numero WhatsApp de homologacao para testar o bot completo de ponta a ponta.

## Objetivo

1. Evitar publicar erro para clientes finais.
2. Testar mudancas em Vercel Preview antes de liberar.
3. Criar Supabase Staging separado do Supabase Production.
4. Usar dados falsos ou sanitizados em Staging.
5. Testar banco, QR, leads, planos e rotas server-side sem tocar em producao.
6. Preparar homologacao completa do WhatsApp/bot com numero exclusivo de teste.
7. Garantir que alteracoes de banco sejam feitas por migrations.
8. Definir checklist obrigatorio antes de merge na `main`.

## Ambientes

### Producao

- Frontend: Vercel Production.
- Backend/Banco: Supabase Production.
- Branch: `main`.
- WhatsApp: numero real do sistema.
- Webhook WhatsApp: Supabase Production.
- Dados: reais.

Variaveis Production devem apontar somente para recursos reais:

```env
NEXT_PUBLIC_SUPABASE_URL=https://projeto-producao.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon_key_producao
SUPABASE_SERVICE_ROLE_KEY=service_role_producao
NEXT_PUBLIC_APP_URL=https://dominio-real.com.br
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...
```

### Homologacao / Staging

- Frontend: Vercel Preview.
- Backend/Banco: Supabase Staging.
- Branches: `develop` e/ou `feature/*`.
- WhatsApp: numero exclusivo de teste, quando providenciado.
- Webhook WhatsApp: Supabase Staging.
- Dados: falsos ou sanitizados.

Variaveis Preview devem apontar somente para recursos de teste:

```env
NEXT_PUBLIC_SUPABASE_URL=https://projeto-staging.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon_key_staging
SUPABASE_SERVICE_ROLE_KEY=service_role_staging
NEXT_PUBLIC_APP_URL=https://preview-ou-develop.vercel.app
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

### Local

- Frontend: `pnpm dev`.
- Backend: Supabase local ou Supabase Staging.
- Dados: locais, falsos ou sanitizados.
- Uso: desenvolvimento inicial antes de abrir PR.

## WhatsApp E Bot

### Regra Principal

O WhatsApp de producao nunca deve ser usado para homologacao.

O provedor de WhatsApp normalmente direciona cada numero/instancia para um webhook. Se o numero real for apontado para Staging, mensagens reais podem parar de chegar na producao ou serem processadas no banco errado.

### Etapa 1: Sem Numero De Teste Ainda

Enquanto o numero de homologacao nao existir, sera permitido testar:

- Vercel Preview com Supabase Staging.
- Login, dashboard, imoveis, QR publico e leads.
- Planos e checkout em modo teste.
- Rotas internas.
- Migrations no banco Staging.
- Edge Functions por chamada manual.
- Webhook WhatsApp com payload simulado.
- Logs e tabelas de eventos no Supabase Staging.

Nesta etapa, o fluxo real completo de WhatsApp nao sera considerado homologado, porque nao havera conversa real passando por numero/instancia de teste.

### Etapa 2: Com Numero WhatsApp De Teste

Quando o numero de teste for providenciado, configurar uma instancia separada no provedor WhatsApp.

Essa instancia deve apontar para:

```text
https://PROJETO_STAGING.supabase.co/functions/v1/whatsapp-webhook-inbound
```

A producao deve continuar apontando para:

```text
https://PROJETO_PRODUCTION.supabase.co/functions/v1/whatsapp-webhook-inbound
```

O numero de teste deve usar secrets e credenciais separadas das credenciais de producao.

Com isso, sera possivel testar:

- escanear QR de imovel de teste;
- iniciar conversa real com o bot;
- receber descricao, fotos e menu;
- testar opcoes do menu;
- testar semelhantes;
- registrar lead;
- testar notificacao para corretor de teste;
- testar fila de mensagens;
- testar monitoramento anti-silencio;
- validar logs sem afetar clientes reais.

## Dados Sanitizados

Dados sanitizados sao copias de dados reais com informacoes sensiveis removidas, mascaradas ou substituidas antes de irem para Staging.

| Dado Real              | Dado Sanitizado             |
| ---------------------- | --------------------------- |
| `Joao Silva`           | `Cliente Teste 001`         |
| `joao@email.com`       | `cliente001@example.com`    |
| `(11) 99999-8888`      | `(11) 90000-0001`           |
| CPF real               | `NULL` ou CPF ficticio      |
| Endereco completo real | `Rua Teste, 123`            |
| Mensagem real de lead  | `Mensagem de teste do lead` |
| Token/API key real     | Removido                    |

Devem ser sanitizados: nomes, e-mails, telefones, WhatsApp, documentos, enderecos completos, mensagens de leads, dados de pagamento, tokens, secrets, chaves de API e arquivos privados que identifiquem pessoas reais.

Podem ser preservados, quando nao identificarem pessoas reais: estrutura das tabelas, status dos registros, tipos de imovel, faixas aproximadas de preco, cidade/bairro, regras de plano, limites e dados operacionais.

## Fluxo De Desenvolvimento E Publicacao

1. Criar branch nova:

   ```bash
   git checkout -b feature/nome-da-mudanca
   ```

2. Desenvolver localmente.
3. Se houver banco, criar migration nova em `supabase/migrations`.
4. Rodar validacoes locais:

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

5. Aplicar migration no Supabase Staging.
6. Subir branch para GitHub.
7. Aguardar GitHub Actions passar.
8. Testar link Preview da Vercel.
9. Testar fluxos do sistema no Staging.
10. Se a mudanca envolver WhatsApp/bot:
    - antes do numero de teste: testar com payload simulado;
    - depois do numero de teste: testar conversa real no WhatsApp Staging.
11. Abrir Pull Request.
12. Revisar codigo, migration, env vars e checklist.
13. Fazer merge na `main` somente apos aprovacao.
14. Aplicar migration no Supabase Production.
15. Publicar Vercel Production.
16. Fazer smoke test controlado em producao.

## Checklist De Homologacao

- CI passou.
- Preview abriu corretamente.
- Preview aponta para Supabase Staging.
- Supabase Staging nao contem dados reais sem sanitizacao.
- Migration foi aplicada e testada no Staging.
- Login funciona.
- Dashboard funciona.
- Cadastro/edicao de imovel funciona.
- QR publico funciona.
- Lead e salvo no Staging.
- `/api/health` funciona.
- `/api/health?deep=1` funciona.
- Stripe usa modo teste, quando aplicavel.
- Nenhuma env var Preview aponta para Production.

Quando houver numero WhatsApp de teste, validar tambem:

- webhook de teste aponta para Supabase Staging;
- mensagem real chega no banco Staging;
- bot responde no numero de teste;
- menu funciona;
- semelhantes funcionam;
- lead vindo do bot e registrado;
- notificacao vai para corretor de teste;
- logs nao aparecem em producao;
- numero real de producao continua apontando para Supabase Production.

## Regras De Seguranca

- Preview nunca aponta para Supabase Production.
- WhatsApp de teste nunca aponta para Supabase Production.
- WhatsApp real nunca aponta para Supabase Staging.
- Staging nao usa service role de producao.
- Staging nao usa Stripe live.
- Staging nao usa webhook secret de producao.
- Secrets nunca entram no Git.
- `SUPABASE_SERVICE_ROLE_KEY` nunca recebe prefixo `NEXT_PUBLIC_`.
- Migrations antigas aplicadas em producao nao devem ser editadas.
- Toda mudanca estrutural de banco deve ter migration nova.
- Producao so recebe merge depois de teste no Preview.

## Implementacao Recomendada

### Fase 1: Base De Homologacao

- Criar Supabase Staging.
- Aplicar migrations existentes.
- Configurar Vercel Preview com env vars de Staging.
- Criar dados falsos iniciais.
- Validar Preview com banco Staging.
- Documentar checklist de PR.

### Fase 2: Testes Simulados Do Bot

- Preparar payloads de teste para `whatsapp-webhook-inbound`.
- Testar gravacao em `webhook_events`.
- Testar processamento no banco Staging.
- Testar fila e monitoramento quando aplicavel.
- Validar que nenhuma chamada simulada usa producao.

### Fase 3: Numero WhatsApp De Homologacao

- Providenciar numero exclusivo de teste.
- Criar instancia separada no provedor WhatsApp.
- Configurar webhook para Supabase Staging.
- Configurar secrets Staging.
- Validar conversa real de ponta a ponta.

### Fase 4: Publicacao Controlada

- Exigir PR para merge na `main`.
- Exigir CI verde.
- Exigir Preview testado.
- Aplicar migrations em producao somente apos Staging.
- Fazer smoke test controlado apos deploy.

## Criterios De Aceite

- Supabase Staging existe separado de Production.
- Vercel Preview aponta para Supabase Staging.
- Vercel Production aponta para Supabase Production.
- Dados de teste sao falsos ou sanitizados.
- Migrations sao testadas em Staging antes de Production.
- Pull Requests geram Preview testavel.
- Existe checklist de homologacao.
- Testes simulados do webhook WhatsApp sao possiveis.
- Quando o numero de teste for providenciado, o bot funciona de ponta a ponta em Staging.
- O WhatsApp real continua isolado em producao.

## Assumptions

- `main` sera a branch de producao.
- O numero WhatsApp de homologacao sera providenciado posteriormente.
- Ate existir numero de teste, o bot sera validado por payloads simulados e testes parciais.
- O fluxo real completo do WhatsApp so sera considerado homologado depois de configurar uma instancia de teste separada.
- Stripe, WhatsApp e demais integracoes externas devem usar credenciais de teste em Staging.
