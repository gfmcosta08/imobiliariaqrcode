# Edge Functions - Staging Security Matrix

Ambiente de referencia: Supabase staging `coeuoyeydqoslhvbbojx`.

Este README registra a postura esperada das Edge Functions antes de qualquer promocao para producao. O ambiente de teste nao possui bot WhatsApp ativo; portanto, a validacao obrigatoria em staging cobre contratos, autenticacao, respostas de erro e guardrails, nao envio/recebimento live do bot.

## Regras

- `SUPABASE_SERVICE_ROLE_KEY` nao deve ser usado como bearer de scheduler.
- Crons internos devem exigir `CRON_SECRET`.
- Webhooks de pagamento autoritativos ficam no app Next.js em `/api/webhooks/stripe`.
- Edge Functions legadas de billing devem permanecer desativadas ou protegidas.
- Functions publicas devem existir apenas quando ha motivo externo claro: QR publico, webhook de provedor ou fallback operacional.
- Secrets nunca devem aparecer em logs, docs ou payloads de erro.

## Matriz

| Function                      | `verify_jwt` | Tipo                 | Auth esperada                                                         | Status staging                            |
| ----------------------------- | ------------ | -------------------- | --------------------------------------------------------------------- | ----------------------------------------- |
| `qr-resolve`                  | `false`      | Publica legitima     | Token QR publico; sem bearer                                          | Mantida publica para resolucao QR.        |
| `partner-print-register`      | `true`       | Parceiro autenticado | JWT Supabase do parceiro                                              | Mantida com JWT.                          |
| `whatsapp-webhook-inbound`    | `false`      | Webhook externo      | Validade do provedor/contrato do bot; bot live nao exigido em staging | Mantida publica por natureza de webhook.  |
| `whatsapp-dispatch`           | `false`      | Cron interno         | `Authorization: Bearer <CRON_SECRET>`                                 | Chamada anonima deve retornar 401.        |
| `bot-health-monitor`          | `false`      | Cron interno         | `Authorization: Bearer <CRON_SECRET>`                                 | Chamada anonima deve retornar 401.        |
| `billing-stripe-webhook`      | `false`      | Billing legado       | Desativada por padrao; quando habilitada, exige `CRON_SECRET`         | Chamada publica deve retornar 410 ou 401. |
| `billing-mercadopago-webhook` | `false`      | Billing legado       | Desativada por padrao; quando habilitada, exige `CRON_SECRET`         | Chamada publica deve retornar 410 ou 401. |
| `media-process`               | `false`      | Worker opcional      | Desativada por padrao; quando habilitada, exige `CRON_SECRET`         | Chamada publica deve retornar 410 ou 401. |
| `lead-notify-broker`          | `false`      | Cron/notificacao     | `Authorization: Bearer <CRON_SECRET>`                                 | Deve rejeitar anonimo.                    |
| `conversation-handle`         | `false`      | Handler bot          | Contrato do bot; bot live nao exigido em staging                      | Mantida para guardrails/contratos.        |

## CORS

O helper compartilhado (`_shared/cors.ts`) usa `CORS_ALLOW_ORIGIN` quando configurado. Se a secret estiver ausente, o fallback e `*` para nao quebrar ambientes locais ou webhooks externos.

Staging deve configurar:

```text
CORS_ALLOW_ORIGIN=https://farollimoveis-staging.vercel.app
```

Antes de producao, functions internas devem manter uma destas alternativas:

- remover resposta CORS quando nao houver consumo por browser;
- limitar origem via allowlist de ambiente;
- manter `*` apenas em webhook externo ou QR publico sem credencial.

## Smokes Recomendados

```powershell
$base = "https://coeuoyeydqoslhvbbojx.supabase.co/functions/v1"
Invoke-WebRequest "$base/whatsapp-dispatch" -Method POST -UseBasicParsing
Invoke-WebRequest "$base/bot-health-monitor" -Method POST -UseBasicParsing
Invoke-WebRequest "$base/billing-stripe-webhook" -Method POST -UseBasicParsing
Invoke-WebRequest "$base/billing-mercadopago-webhook" -Method POST -UseBasicParsing
```

Resultado esperado:

- `whatsapp-dispatch`: 401 sem bearer.
- `bot-health-monitor`: 401 sem bearer.
- billing legado: 410 quando desativado ou 401 quando habilitado sem bearer.
