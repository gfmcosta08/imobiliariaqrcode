# PRD — Expansão do Painel Admin: Conteúdo de Planos, Assinaturas, Anúncios e Criação Rápida

**Status:** Draft (v1)
**Data:** 2026-05-09
**Produto/Módulo:** Admin, Planos, Assinaturas, Anúncios, QR Code

---

## 1. Visão Geral

O painel admin (`/admin`) existe mas está incompleto. Este PRD o expande com cinco novas capacidades:

1. **Edição de conteúdo e valores dos planos** — admin altera o que é exibido na página `/plans` (preço, benefícios, textos) e essas mudanças valem imediatamente para todos os visitantes e clientes.
2. **Gestão de variáveis operacionais dos planos** — admin edita limites técnicos de cada plano (validade em dias, máximo de anúncios, máximo de corretores).
3. **Gestão de assinaturas de clientes** — admin lista, filtra e edita manualmente a validade e o status de qualquer assinatura.
4. **Gestão de validade de anúncios** — admin busca e edita a data de expiração e o status de um anúncio específico.
5. **Botão "+" no painel do corretor** — criação instantânea de anúncio em rascunho com QR Code exclusivo.

---

## 2. Problema

- Preço do plano Pro está hardcoded como "R$ 500" no código — mudar exige redeploy.
- Lista de benefícios de cada plano está hardcoded — qualquer edição exige commit de código.
- Alterar `expiration_days` de um plano requer query SQL direta.
- Estender assinatura de um cliente exige acesso ao Supabase Studio.
- Reativar anúncio expirado não tem interface.
- Criar um anúncio exige preencher todo o formulário antes de ter o QR Code disponível.

---

## 3. O que NÃO muda

- Lógica de geração de convite existente (`/api/admin/invitations`) não é quebrada.
- Fluxo do bot WhatsApp, QR Code, leads e notificações ao corretor permanecem intocados.
- Arquivos `conversation-handle`, `whatsapp-dispatch`, `whatsapp-webhook-inbound`, `qr-resolve`, `lead-notify-broker` e `bot-health-monitor` não são alterados.

---

## 4. Arquitetura atual relevante

### Tabela `plans` (seed data, existente)
- `code` (PK): `trial`, `solo`, `pro`, `premium`
- `expiration_days`: 30 (trial), 90 (solo), null (pro/premium)
- `max_active_properties`: 1 (trial/solo), null = ilimitado (pro/premium)
- `max_brokers`: 1 (trial/solo/pro), 5 (premium)
- `has_auto_expiration`: true (trial/solo), false (pro/premium)
- **Não tem:** preço de exibição, benefícios, textos de marketing

### Página `/plans` (hardcoded)
Arquivo: `apps/web/src/app/plans/page.tsx`
- Array estático `paidPlans` com: `name`, `price`, `suffix`, `note`, `features[]`, `label`, `featured`
- Nada vem do banco para renderização da página

### Tabela `subscriptions` (existente)
- `account_id`, `plan_code`, `status`, `current_period_start`, `current_period_end`
- Status possíveis: `free | trial_active | solo_active | pro_pending_activation | pro_active | past_due | canceled | expired`

### Tabela `properties` (existente)
- `listing_status`: `draft | published | printed | expired | removed | blocked | reserved`
- `expires_at`, `public_id` (formato `IMV-YYYY-XXXXXX`)

### Admin atual
- `apps/web/src/app/admin/page.tsx`: verifica `profile.role !== 'admin'`, renderiza `<InvitationGenerator />` e lista de convites

---

## 5. Funcionalidade 1 — Edição de Conteúdo e Preços dos Planos

### 5.1. Objetivo

O admin deve poder editar, diretamente pelo painel, tudo que é exibido na página `/plans` para cada plano. As mudanças devem ser salvas no banco e a página `/plans` deve renderizar dinamicamente a partir desses dados. Sem necessidade de redeploy.

### 5.2. O que é editável por plano

| Campo | Exemplo atual | Descrição |
|---|---|---|
| `display_name` | "Pro" | Nome exibido no card |
| `display_price` | "R$ 500" | Valor principal exibido |
| `display_suffix` | "/mês" | Texto após o valor |
| `display_note` | "Renovação mensal automática" | Nota abaixo do preço |
| `display_label` | "Assinar Pro" | Texto do botão de contratação |
| `display_featured` | true/false | Se o card aparece em destaque |
| `features` | ["Múltiplos imóveis", "10 placas..."] | Lista de benefícios (array de strings) |

### 5.3. Comportamento ao salvar

- Salvar no banco via `PATCH /api/admin/plans/:planCode/display`
- A página `/plans` passa a buscar esses dados do banco (Server Component com `supabase.from('plan_display_config').select(...)`)
- Mudanças entram em vigor imediatamente para todos os visitantes
- Toda alteração grava em `audit_logs` com `before` e `after`

### 5.4. Importante: distinção entre exibição e cobrança Stripe

**Mudar o `display_price` (ex.: de "R$ 500" para "R$ 300") altera apenas o texto mostrado ao visitante.** A cobrança real via Stripe continua usando o Price ID configurado nas variáveis de ambiente (`STRIPE_PRICE_PRO`).

Para alterar o valor cobrado pelo Stripe, é necessário um passo operacional separado:
1. Criar novo Price no Stripe Dashboard com o valor desejado
2. Atualizar a variável de ambiente `STRIPE_PRICE_PRO` no Vercel
3. Fazer redeploy

Este PRD cobre apenas a edição de exibição. A integração de atualização do Price Stripe fica como escopo futuro.

### 5.5. Nova tabela: `plan_display_config`

```sql
CREATE TABLE plan_display_config (
  plan_code        TEXT PRIMARY KEY REFERENCES plans(code),
  display_name     TEXT NOT NULL,
  display_price    TEXT NOT NULL,
  display_suffix   TEXT NOT NULL DEFAULT '',
  display_note     TEXT NOT NULL DEFAULT '',
  display_label    TEXT NOT NULL,
  display_featured BOOLEAN NOT NULL DEFAULT FALSE,
  features         TEXT[] NOT NULL DEFAULT '{}',
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_by       UUID REFERENCES profiles(id)
);
```

Seed inicial (valores atuais hardcoded do `plans/page.tsx`):

- `trial`: "Teste", "R$ 0", " por 30 dias", "Sem cobrança Stripe", "Começar teste", false, ["1 anúncio ativo", "1 placa QR Code inclusa", "Bot WhatsApp automático", "Captura de leads"]
- `solo`: "Solo", "R$ 150", " trimestral", "Validade: 3 meses", "Contratar Solo", false, [mesmos benefícios do trial]
- `pro`: "Pro", "R$ 500", "/mês", "Renovação mensal automática", "Assinar Pro", **true** (destaque), ["Múltiplos imóveis", "Kit inicial: 10 placas QR Code", "Bot WhatsApp + leads ilimitados"]
- `premium`: "Premium", "R$ 2.000", "/mês", "Renovação mensal automática", "Assinar Premium", false, ["Múltiplos imóveis", "5 corretores", "Kit inicial: 20 placas QR Code", "Bot WhatsApp + leads ilimitados"]

### 5.6. Interface no admin

- Tabela com os 4 planos (Trial, Solo, Pro, Premium)
- Cada linha com botão "Editar"
- Ao editar: formulário com campos de texto + gerenciamento de lista de benefícios (adicionar/remover item)
- Botão "Salvar" por plano

---

## 6. Funcionalidade 2 — Gestão de Variáveis Operacionais dos Planos

### 6.1. O que o admin edita (tabela `plans`)

| Campo | Trial | Solo | Pro | Premium |
|---|---|---|---|---|
| `expiration_days` | 30 | 90 | null | null |
| `max_active_properties` | 1 | 1 | null (ilimitado) | null (ilimitado) |
| `max_brokers` | 1 | 1 | 1 | 5 |
| `has_auto_expiration` | true | true | false | false |

### 6.2. Regras

- Alterações **não afetam assinaturas já ativas retroativamente**.
- Toda alteração grava em `audit_logs`.

### 6.3. API

**`PATCH /api/admin/plans/:planCode`**
```json
{ "expiration_days": 45, "max_active_properties": 2, "max_brokers": 1, "has_auto_expiration": true }
```

---

## 7. Funcionalidade 3 — Gestão de Assinaturas de Clientes

### 7.1. Lista paginada com:
- E-mail / nome completo, plano atual, status, início e fim do período, provedor de cobrança

### 7.2. Filtros
- Status (multiselect), plano, busca por e-mail ou nome

### 7.3. Ação: Editar assinatura
Modal com data picker para `current_period_end` e dropdown para `status`.

**`PATCH /api/admin/subscriptions/:accountId`**
```json
{ "current_period_end": "2026-09-01T00:00:00Z", "status": "trial_active" }
```

### 7.4. Regras
- Não dispara webhook Stripe (operação local).
- Exibir aviso quando conta tem `billing_provider = 'stripe'`.
- Toda alteração grava em `audit_logs`.

---

## 8. Funcionalidade 4 — Gestão de Validade de Anúncios

### 8.1. Busca por
- `public_id`, código interno, e-mail do corretor

### 8.2. Ação: Editar
- `expires_at` (date picker) e `listing_status` (dropdown)

**`PATCH /api/admin/properties/:propertyId`**
```json
{ "expires_at": "2026-12-31T00:00:00Z", "listing_status": "published" }
```

### 8.3. Regras
- `published`/`printed` → QR Code `is_active = true`
- `expired`/`removed` → QR Code `is_active = false`
- `qr_token` nunca muda
- Toda alteração grava em `audit_logs`

---

## 9. Melhoria no Sistema de Convites (existente)

### 9.1. O que existe hoje
- 1 imóvel + 1 QR Code por convite (fixo), 180 dias (hardcoded), credenciais 6 dígitos

### 9.2. Melhorias
- **Quantidade de imóveis configurável:** 1–10 (padrão: 1)
- **Validade configurável em dias** (padrão: 30)
- **Listagem ampliada:** e-mail do corretor, quantidade de imóveis, data de expiração

### 9.3. API atualizada
`POST /api/admin/invitations` aceita body:
```json
{ "property_count": 3, "expiration_days": 30 }
```

Novas colunas em `broker_invitations`:
```sql
ADD COLUMN property_count INT DEFAULT 1,
ADD COLUMN property_ids UUID[] DEFAULT '{}',
ADD COLUMN expiration_days_configured INT DEFAULT 180;
```

---

## 10. Funcionalidade 5 — Botão "+" no Painel do Corretor

### 10.1. Localização
Painel do corretor → lista de imóveis

### 10.2. Comportamento
1. `POST /api/properties/quick-create`
2. Cria anúncio `listing_status = 'draft'` + QR Code via trigger existente
3. Aparece no topo da lista imediatamente
4. Formulário de edição abre automaticamente

### 10.3. Salvar = produção
- Valida campos obrigatórios (incluindo `location_map_url`)
- Muda para `listing_status = 'published'`

### 10.4. QR Code permanente
- `qr_token` criado uma vez, nunca muda
- Apenas `is_active` varia conforme status

### 10.5. API
**`POST /api/properties/quick-create`**
```json
{ "ok": true, "property_id": "uuid", "public_id": "IMV-2026-XXXXXX", "qr_token": "abc123", "listing_status": "draft" }
```
Erros: `401`, `403` sem plano ativo, `422` limite do plano atingido.

---

## 11. Requisitos Funcionais

| ID | Descrição |
|---|---|
| RF01 | Admin edita conteúdo de exibição de cada plano (preço, benefícios, textos) |
| RF02 | Página `/plans` renderiza dinamicamente a partir de `plan_display_config` |
| RF03 | Mudanças no conteúdo dos planos valem imediatamente para todos |
| RF04 | Admin edita variáveis operacionais dos planos (`expiration_days`, limites) |
| RF05 | Admin lista assinaturas com filtros |
| RF06 | Admin edita validade e status de qualquer assinatura |
| RF07 | Admin busca e edita validade/status de anúncio específico |
| RF08 | Reativar anúncio reativa QR Code automaticamente |
| RF09 | Toda alteração admin grava em `audit_logs` |
| RF10 | Admin configura quantidade de imóveis e validade antes de gerar convite |
| RF11 | Corretor tem botão "+" para criar anúncio rascunho + QR Code instantâneo |
| RF12 | Formulário de edição abre automaticamente após "+" |
| RF13 | Salvar via "+" publica o anúncio |
| RF14 | `qr_token` nunca muda após criação |

---

## 12. Critérios de Aceite

1. Admin vê seção "Conteúdo dos Planos" com dados atuais do banco.
2. Admin muda preço do Pro para "R$ 300" → `/plans` exibe "R$ 300" imediatamente.
3. Admin adiciona benefício → aparece na página `/plans`.
4. Admin edita `expiration_days` → banco registra + `audit_logs` grava.
5. Admin filtra assinaturas por `past_due`, edita validade de uma conta.
6. Admin busca anúncio por `public_id`, muda para `published`.
7. Anúncio reativado aparece na home e QR Code fica `is_active = true`.
8. Admin gera convite com 5 imóveis → 5 rascunhos + 5 QR Codes.
9. Corretor clica "+" → anúncio draft, QR Code gerado, formulário abre.
10. Salvar → `listing_status = published`, anúncio na vitrine.
11. Editar título → `qr_token` permanece idêntico.
12. Bot WhatsApp, QR Code público e leads sem regressão.

---

## 13. Impacto no Banco de Dados

### Nova tabela: `plan_display_config` (ver seção 5.5)
### Tabela `broker_invitations` — novas colunas (ver seção 9.3)
### Tabela `audit_logs` — verificar colunas: `actor_id`, `action`, `target_table`, `target_id`, `before` (jsonb), `after` (jsonb), `created_at`
### Nenhuma alteração em tabelas do bot

---

## 14. Arquivos principais a criar/modificar

| Arquivo | Ação |
|---|---|
| `apps/web/src/app/admin/page.tsx` | Expandir com novas seções |
| `apps/web/src/app/admin/plans-display-editor.tsx` | Novo — edição de conteúdo dos planos |
| `apps/web/src/app/admin/plans-config-editor.tsx` | Novo — edição de variáveis operacionais |
| `apps/web/src/app/admin/subscriptions-manager.tsx` | Novo — gestão de assinaturas |
| `apps/web/src/app/admin/properties-manager.tsx` | Novo — gestão de anúncios |
| `apps/web/src/app/plans/page.tsx` | Tornar dinâmico |
| `apps/web/src/app/api/admin/plans/[planCode]/display/route.ts` | Novo |
| `apps/web/src/app/api/admin/plans/[planCode]/route.ts` | Novo |
| `apps/web/src/app/api/admin/subscriptions/[accountId]/route.ts` | Novo |
| `apps/web/src/app/api/admin/properties/[propertyId]/route.ts` | Novo |
| `apps/web/src/app/api/admin/invitations/route.ts` | Atualizar (property_count, expiration_days) |
| `apps/web/src/app/api/properties/quick-create/route.ts` | Novo |
| `supabase/migrations/20260509100000_plan_display_config.sql` | Nova migration |

---

## 15. Salvaguardas do Bot

```bash
pnpm test:bot-guardrails
pnpm test
pnpm --filter web run typecheck
pnpm --filter web run build
git diff --check
```

Arquivos intocáveis:
- `supabase/functions/conversation-handle/index.ts`
- `supabase/functions/whatsapp-dispatch/index.ts`
- `supabase/functions/whatsapp-webhook-inbound/index.ts`
- `supabase/functions/qr-resolve/index.ts`
- `supabase/functions/lead-notify-broker/index.ts`
- `supabase/functions/bot-health-monitor/index.ts`

---

## 16. Resumo Executivo

Este PRD expande o painel admin (`/admin`) com cinco capacidades:

1. **Edição de conteúdo dos planos** — admin muda preço, benefícios e textos da página `/plans` sem redeploy. Página passa a ser dinâmica via `plan_display_config`. Mudar texto de preço não altera cobrança real no Stripe.
2. **Variáveis operacionais dos planos** — admin edita `expiration_days`, `max_active_properties` e `max_brokers`.
3. **Gestão de assinaturas** — lista, filtra e edita validade e status de qualquer cliente.
4. **Gestão de anúncios** — busca e edita validade/status; reativar anúncio reativa QR Code.
5. **Botão "+"** — corretor cria anúncio draft + QR Code com um clique; salvar publica.

Email admin: `gfmcosta@gmail.com`. Bot WhatsApp intocável.
