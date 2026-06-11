# PRD Técnico — Estabilização de Produção: Cadastro, Upload, Convites e Go-Live

Data: 2026-05-18
Status: Implementado, validado e publicado em produção
Prioridade: P0 (liberação segura para produção)

## 1. Resumo

Este PRD registra o pacote de correções que destravou a liberação do ImobQR para produção.

O objetivo foi estabilizar o fluxo completo:

`visitante → cadastro normal → dashboard → anúncio → upload 10 fotos → QR → homepage`

e o fluxo de cortesia:

`admin → convite → corretor convidado → onboarding → anúncio → upload 10 fotos → QR → homepage`

As correções foram validadas em preview e promovidas para produção em:

- Produção principal: `https://imoveisqr.com`
- Alias Vercel: `https://farollimoveis.vercel.app`
- Deploy production validado: `https://farollimoveis-qc37i7gpx.vercel.app`
- Commit sincronizado na `main`: `c24cfdeaa16f15284e1e9c7028017c56a823adc2`

## 2. Problemas Corrigidos

### 2.1 Cadastro normal instável

Antes:

- Cadastro público podia falhar com erro de banco ao criar usuário.
- Fluxo dependia demais de trigger/metadata e podia colidir em `whatsapp_number`.
- Havia risco de usuário sem `profile`, `broker`, `account` ou assinatura inicial.

Depois:

- Cadastro usa rota dedicada `POST /api/auth/signup`.
- Usuário é criado confirmado, sem exigir confirmação de e-mail no ambiente operacional.
- A rota provisiona explicitamente:
  - `profiles`;
  - `accounts`;
  - `brokers`;
  - `subscriptions` iniciais.
- WhatsApp enviado ao trigger é temporário/seguro para evitar colisão; depois o valor final é normalizado.

### 2.2 Upload de imagens quebrando com limite de Server Action

Antes:

- Fotos eram enviadas junto com formulário textual do anúncio.
- Upload de várias imagens podia estourar limite de corpo da Server Action/Next/Vercel.
- O usuário precisava lidar com botões duplicados e fluxo confuso.

Depois:

- Upload foi separado para API dedicada: `POST /api/properties/[propertyId]/media`.
- Imagens são enviadas via `multipart/form-data`, fora do Server Action principal.
- Upload começa automaticamente após selecionar arquivos.
- Interface mostra contador, previews e mensagens de limite.
- Formulário principal salva apenas dados textuais do imóvel.

### 2.3 Previews de imagens indisponíveis

Antes:

- Banco registrava `10/10`, mas previews podiam aparecer como indisponíveis.
- Assinatura de URL do Supabase Storage podia falhar quando feita com cliente autenticado comum.

Depois:

- Páginas server-side já autorizadas assinam URLs de mídia com service role.
- A autorização do imóvel continua sendo validada antes da assinatura.
- Previews persistem após reload.

### 2.4 Convite/cortesia instável

Antes:

- `claim` do convite podia retornar erro genérico.
- Onboarding podia falhar com conflito de e-mail/WhatsApp.
- Convite precisava funcionar ponta a ponta para liberar operação sem Stripe real.

Depois:

- `POST /api/convite/claim` valida estados explicitamente:
  - pendente;
  - expirado;
  - já ativado;
  - concluído;
  - credenciais inválidas.
- `complete-profile` normaliza e valida e-mail/WhatsApp antes de atualizar Auth/Profile/Broker.
- Convite gera imóvel inicial com valores compatíveis com os selects do formulário.

### 2.5 Selects Tipo/Subtipo sem persistência

Antes:

- Quick-create/convite podiam gravar valores legados como `residential` e `apartment`.
- Formulário esperava opções em português, causando perda visual do valor após salvar/recarregar.

Depois:

- `property_type` e `property_subtype` são normalizados antes de salvar.
- Valores legados são convertidos para opções compatíveis:
  - `residential` → `Residencial`;
  - `apartment` → `Apartamento`;
  - aliases equivalentes para casa, terreno, comercial etc.
- Selects persistem após edição e reload.

## 3. Requisitos Implementados

### Cadastro/Login

- Cadastro normal cria conta e entra no dashboard.
- Login posterior funciona com a conta criada.
- Cadastro não exige confirmação de e-mail para o fluxo de produto validado.
- Mensagens de erro foram melhoradas para e-mail/WhatsApp duplicados.

### Anúncio

- Criação de anúncio normal funciona.
- Criação por convidado funciona.
- Preço `850000` é exibido como `R$ 850.000,00`.
- Área `120` permanece `120`.
- Dados persistem após reload.
- Status e selects ficam consistentes.

### Upload

- Seleção de até 10 imagens inicia upload automaticamente.
- Upload não depende mais de botão manual de envio.
- Seleção acima do limite respeita o limite do plano e informa o usuário.
- Previews aparecem após upload e continuam após reload.

### QR e Página Pública

- Cada imóvel mantém QR/token próprio.
- `/q/{token}` abre o imóvel correto.
- QR continua direcionando para WhatsApp/bot quando configurado.
- Homepage encontra imóveis publicados por título, cidade, bairro e código interno.

### Admin e Convites

- Admin cria convite/cortesia.
- Convite pode ser ativado pelo corretor convidado.
- Convidado completa perfil, edita anúncio, faz upload e publica.
- Admin encontra anúncio e usuário convidado.

## 4. Invariantes de Não Regressão do Bot

Esta entrega não altera:

- `supabase/functions/whatsapp-webhook-inbound`;
- `supabase/functions/conversation-handle`;
- `supabase/functions/whatsapp-dispatch`;
- `supabase/functions/bot-health-monitor`;
- contratos de mensagens do WhatsApp;
- tabelas de conversa ou deduplicação do bot;
- workflows agendados do bot.

Validações executadas:

- Guardrails do bot: `39 passed`.
- Endpoints cron sem autorização retornam `401`, mantendo proteção:
  - `/api/cron/whatsapp-dispatch`;
  - `/api/cron/bot-health-monitor`.

Importante:

- A promoção para produção foi feita sem `supabase functions deploy`.
- Nenhuma migration foi executada durante a promoção.
- Nenhum secret/env do bot foi alterado.

## 5. Arquivos/Áreas Alteradas

Principais áreas técnicas:

- Cadastro público:
  - `apps/web/src/app/api/auth/signup/route.ts`
  - `apps/web/src/app/login/page.tsx`

- Convites e onboarding:
  - `apps/web/src/app/api/admin/invitations/route.ts`
  - `apps/web/src/app/api/convite/claim/route.ts`
  - `apps/web/src/app/api/onboarding/complete-profile/route.ts`
  - `apps/web/src/app/onboarding/complete-listing/page.tsx`

- Anúncio e upload:
  - `apps/web/src/app/api/properties/[propertyId]/media/route.ts`
  - `apps/web/src/app/properties/[id]/media-section.tsx`
  - `apps/web/src/app/properties/[id]/page.tsx`
  - `apps/web/src/app/properties/actions.ts`
  - `apps/web/src/app/properties/property-editor-form.tsx`

- Normalização e testes:
  - `apps/web/src/lib/property-form.ts`
  - `apps/web/src/lib/property-form.test.ts`

## 6. Validação Executada

### Testes automatizados

- `pnpm --filter web typecheck` — OK
- `pnpm --filter web test -- src/lib/property-form.test.ts` — OK
- `pnpm run test:bot-guardrails` — OK (`39 passed`)

### Testes manuais/automatizados em produção

- Homepage carrega em `https://imoveisqr.com`.
- Login/cadastro normal funciona.
- Criação de imóvel funciona.
- Upload automático de 10 imagens funciona e persiste.
- QR `/q/{token}` abre imóvel correto.
- Homepage encontra imóvel publicado.
- Mobile smoke OK.
- Admin acessível.
- Cron do bot protegido sem autenticação (`401`).

Dados de smoke em produção:

- Usuário: `qa.prod.smoke+1779100767015@mailinator.com`
- Imóvel: `https://imoveisqr.com/properties/e0830930-4205-4fac-9ffa-62da183b5bb7`
- QR: `https://farollimoveis.vercel.app/q/b09e2209989847aaa1029124fb1021c2fe0f3d2a3faa4591b8bee0becd49df20`

## 7. Rollout e Estado Atual

- Preview validado originalmente: `https://farollimoveis-htu5yope9.vercel.app`
- Produção promovida e depois alinhada via Git.
- Branch `main` sincronizada para evitar rollback por deploy automático.
- Produção atual:
  - `https://imoveisqr.com`
  - `https://farollimoveis.vercel.app`

## 8. Critério de Aceite Final

O sistema é considerado aprovado para produção porque:

- Cadastro normal passou.
- Fluxo de convite passou.
- Upload 10 fotos passou.
- QR por imóvel passou.
- Homepage/busca passou.
- Mobile smoke passou.
- Guardrails do bot passaram.
- Produção e Git foram alinhados para evitar regressão futura.

## 9. Itens Fora do Escopo

- Não foi implementada rota pública `/q/{token}/pdf`.
- PDF continua via botão `Imprimir PDF` na tela de edição do anúncio.
- Stripe/pagamento real não foi considerado bloqueante para o servidor de teste/produção controlada.
- Bot WhatsApp real não foi retestado com número real; foram preservados contratos, guardrails e proteção dos endpoints.

## 10. Decisão

Status final: aprovado para produção.

Recomendação operacional:

- Manter este PRD como registro do go-live.
- Não alterar `supabase/functions/**` sem PRD específico de bot.
- Em futuras correções de produção, sempre validar:
  - cadastro;
  - convite;
  - upload;
  - QR;
  - guardrails do bot.
