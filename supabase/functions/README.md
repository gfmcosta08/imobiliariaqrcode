# Edge Functions (Supabase)

Funções previstas no SDD (implementação por sprint):

| Função                        | Descrição                           |
| ----------------------------- | ----------------------------------- |
| `partner-print-register`      | Registro de impressão pelo parceiro |
| `qr-resolve`                  | Resolução pública do QR             |
| `whatsapp-webhook-inbound`    | Webhook Uazapi                      |
| `whatsapp-dispatch`           | Fila outbound                       |
| `billing-stripe-webhook`      | Stripe                              |
| `billing-mercadopago-webhook` | Mercado Pago                        |
| `media-process`               | Pipeline de imagens                 |
| `lead-notify-broker`          | Notificação de lead                 |
| `conversation-handle`         | Máquina de estados WhatsApp         |

**Secrets:** configure no Dashboard do projeto Supabase ou via CLI (`supabase secrets set`), nunca no repositório.
