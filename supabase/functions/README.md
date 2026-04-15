# Edge Functions (Supabase)

| Função                        | Estado                                                                 |
| ----------------------------- | ---------------------------------------------------------------------- |
| `qr-resolve`                  | Implementada — resolve token, valida FREE/PRO, link WhatsApp corretor  |
| `partner-print-register`      | Implementada — JWT de parceiro + RPC `register_print_event`            |
| `whatsapp-webhook-inbound`    | MVP — persiste payload em `webhook_events` (dedupe); falta Uazapi+fila |
| `whatsapp-dispatch`           | Stub — fila outbound + throttling                                      |
| `billing-stripe-webhook`      | MVP — grava evento bruto em `webhook_events`; falta assinatura Stripe  |
| `billing-mercadopago-webhook` | MVP — grava evento bruto em `webhook_events`                           |
| `media-process`               | Stub — variantes de imagem                                             |
| `lead-notify-broker`          | Stub — notificar corretor                                              |
| `conversation-handle`         | Stub — máquina de estados WhatsApp                                     |

Secrets via Dashboard ou `supabase secrets set`. Em local, use `supabase functions serve` com `.env`.
