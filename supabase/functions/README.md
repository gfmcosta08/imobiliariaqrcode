# Edge Functions (Supabase)

| Função                        | Estado                                                            |
| ----------------------------- | ----------------------------------------------------------------- |
| `qr-resolve`                  | Implementada — resolve token, valida FREE/PRO e status do anúncio |
| `partner-print-register`      | Implementada — JWT de parceiro + RPC `register_print_event`       |
| `whatsapp-webhook-inbound`    | Stub — integrar Uazapi + `webhook_events` + fila                  |
| `whatsapp-dispatch`           | Stub — fila outbound + throttling                                 |
| `billing-stripe-webhook`      | Stub — validar Stripe e atualizar `subscriptions`                 |
| `billing-mercadopago-webhook` | Stub — Mercado Pago                                               |
| `media-process`               | Stub — variantes de imagem                                        |
| `lead-notify-broker`          | Stub — notificar corretor                                         |
| `conversation-handle`         | Stub — máquina de estados WhatsApp                                |

Secrets via Dashboard ou `supabase secrets set`. Em local, use `supabase functions serve` com `.env`.
