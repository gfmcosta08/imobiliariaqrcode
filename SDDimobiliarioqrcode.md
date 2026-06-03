# SDD Completo â€” SaaS ImobiliÃ¡rio com QR Code + WhatsApp + Supabase

## Atualizacao De Produto Homologada - 2026-06-02

Este SDD contem referencias historicas aos planos `PRO`, `Solo` e `Premium`. Para a versao comercial homologada em 2026-06-02, a regra vigente no ambiente de teste e:

- **Free**: 30 dias gratuitos, 1 anuncio ativo, sem cobranca automatica.
- **Starter**: R$ 150,00/mes, anuncios ilimitados, QR Codes, leads, bot WhatsApp e demais beneficios do sistema.
- **Cortesia Admin**: convite cortesia equivalente a Free customizavel, com limite de imoveis e data de validade editaveis mesmo apos ativacao.
- **Stripe**: Checkout, webhook e Billing Portal validados somente em modo teste no staging `https://farollimoveis-staging.vercel.app`.
- **Status final de assinatura Starter**: `subscriptions.plan_code = 'starter'` e `subscriptions.status = 'starter_active'`.
- **Aceite juridico**: Termos de Uso, Politica de Privacidade e Cancelamento/Reembolso devem ser aceitos antes do checkout e registrados em `checkout_legal_acceptance_events`.
- **Promocao para producao**: bloqueada ate aprovacao humana explicita; nenhum deploy de producao foi feito nesta homologacao.

As secoes antigas que falam em `PRO` continuam como historico/legado ou referencia de arquitetura, mas qualquer nova implementacao comercial deve seguir Free + Starter, salvo PRD aprovado em contrario.
## 1. Entendimento

Plataforma SaaS para corretores imobiliÃ¡rios e imobiliÃ¡rias futuras, com cadastro detalhado de imÃ³veis, geraÃ§Ã£o de QR Code por imÃ³vel, atendimento automatizado via WhatsApp, recomendaÃ§Ã£o de imÃ³veis similares, captura de leads e monetizaÃ§Ã£o por assinatura.

O produto possui dois perfis:

- **FREE**: 1 imÃ³vel, 10 imagens, validade de 30 dias apÃ³s impressÃ£o da placa.
- **PRO**: mÃºltiplos imÃ³veis, 15 imagens por imÃ³vel, sem expiraÃ§Ã£o automÃ¡tica.

Quando o cliente escaneia o QR Code de uma placa:

1. o sistema identifica o imÃ³vel;
2. inicia o fluxo no WhatsApp;
3. envia descriÃ§Ã£o + imagens;
4. oferece opÃ§Ãµes:
   - `1` agendar visita
   - `2` ver imÃ³veis parecidos

Regra de monetizaÃ§Ã£o:

- Se o imÃ³vel original Ã© **PRO**, os similares vÃªm do prÃ³prio acervo desse corretor.
- Se o imÃ³vel original Ã© **FREE**, os similares vÃªm **somente de imÃ³veis PRO**.

---

## 2. Objetivo

Construir um SaaS robusto, escalÃ¡vel e pronto para produÃ§Ã£o usando **Supabase como backend principal**, com:

- autenticaÃ§Ã£o;
- autorizaÃ§Ã£o por RLS;
- banco PostgreSQL;
- Storage para imagens;
- Edge Functions para integraÃ§Ãµes e lÃ³gica server-side;
- filas e jobs recorrentes;
- billing;
- portal parceiro;
- observabilidade e seguranÃ§a.

---

## 3. Escopo

### In-scope

- Auth e sessÃ£o
- Cadastro de corretor
- GestÃ£o de imÃ³veis
- Upload, compressÃ£o e armazenamento de imagens
- GeraÃ§Ã£o de QR Code
- Portal parceiro para impressÃ£o
- IntegraÃ§Ã£o WhatsApp (Uazapi no MVP)
- Motor de recomendaÃ§Ã£o
- Captura de leads
- Billing com Stripe e Mercado Pago
- ExpiraÃ§Ã£o de anÃºncios FREE
- Auditoria bÃ¡sica
- Observabilidade mÃ­nima

### Out-of-scope (MVP)

- CRM completo
- Mobile app nativo
- IA generativa para descriÃ§Ã£o
- MultiusuÃ¡rio por conta no MVP
- IntegraÃ§Ã£o com portais externos
- Analytics avanÃ§ado
- API pÃºblica para terceiros

---

## 4. DecisÃ£o TÃ©cnica Oficial

### Backend oficial

**Supabase serÃ¡ o backend oficial do projeto.**

### Componentes oficiais a usar

- **Supabase Postgres** como banco principal
- **Supabase Auth** para autenticaÃ§Ã£o
- **Supabase RLS** para autorizaÃ§Ã£o multi-tenant
- **Supabase Storage** para imagens
- **Supabase Edge Functions** para integraÃ§Ãµes e server-side logic
- **Supabase Cron** para jobs recorrentes
- **Supabase Queues / pgmq** para processamento assÃ­ncrono
- **Supabase Realtime** opcional para dashboards internos

### Frontend

- **Next.js**
- Supabase JS client

### IntegraÃ§Ãµes externas

- **Uazapi** para WhatsApp no MVP
- **Stripe** para assinatura cartÃ£o
- **Mercado Pago** para Pix e assinatura regional

---

## 5. Arquitetura de Alto NÃ­vel

```text
[ Next.js Web App ]
        |
        v
[ Supabase Auth ]
        |
        v
[ Supabase Postgres + RLS ]
        |
        +--> [ Storage ] (imagens)
        +--> [ Edge Functions ]
        |         +--> Uazapi
        |         +--> Stripe
        |         +--> Mercado Pago
        |         +--> QR / jobs auxiliares
        |
        +--> [ Queues / PGMQ ]
        |
        +--> [ Cron / pg_cron ]
```

### PrincÃ­pio central

O banco Ã© o **source of truth**. Toda regra crÃ­tica deve nascer ou terminar no Postgres:

- plano do usuÃ¡rio;
- status do imÃ³vel;
- data de impressÃ£o;
- expiraÃ§Ã£o;
- histÃ³rico de lead;
- auditoria.

---

## 6. EstratÃ©gia de SeguranÃ§a e Tenancy

### Modelo de tenancy

Mesmo comeÃ§ando com 1 corretor por conta, o modelo deve nascer assim:

- `accounts`
- `profiles`
- `brokers`
- `properties`

Hoje:

- 1 `account` = 1 `broker`

AmanhÃ£:

- 1 `account` = N `brokers`

### Isolamento de dados

Toda tabela de domÃ­nio deve carregar `account_id`.

Toda leitura/escrita vinda do frontend deve passar por **RLS**.

### Acesso administrativo

OperaÃ§Ãµes administrativas e integraÃ§Ãµes crÃ­ticas serÃ£o executadas via:

- Edge Functions com `service_role`
- SQL functions `security definer` apenas quando necessÃ¡rio

---

## 7. Regras de NegÃ³cio Congeladas

### Plano FREE

- 1 imÃ³vel ativo por conta
- 10 imagens por imÃ³vel
- QR e anÃºncio sÃ³ entram em ciclo de validade apÃ³s `print_registered`
- validade: 30 dias apÃ³s primeira impressÃ£o
- reimpressÃ£o **nÃ£o** renova validade
- imÃ³vel FREE **nÃ£o** Ã© fonte de recomendaÃ§Ã£o
- ao expirar, QR deve responder: `Este anÃºncio nÃ£o estÃ¡ mais disponÃ­vel.`

### Plano PRO

- mÃºltiplos imÃ³veis
- 15 imagens por imÃ³vel
- nÃ£o expira automaticamente
- permanece ativo atÃ© remoÃ§Ã£o manual ou polÃ­tica futura de billing
- imÃ³veis PRO podem ser fonte de recomendaÃ§Ã£o

### WhatsApp

- integraÃ§Ã£o inicial via Uazapi
- todas as mensagens devem passar por fila
- aplicar throttling e jitter operacional
- nunca acoplar regra de negÃ³cio diretamente ao provider

### ImpressÃ£o

- parceiro registra evento de impressÃ£o
- apenas a **primeira impressÃ£o** do FREE inicia o prazo de 30 dias
- PRO apenas registra histÃ³rico

---

## 8. Modelagem de Banco de Dados (DDL LÃ³gico)

> ObservaÃ§Ã£o: para autenticaÃ§Ã£o, o projeto usa `auth.users` do Supabase. As tabelas de domÃ­nio ficam em `public`.

### 8.1 Tabela `accounts`

```sql
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.2 Tabela `profiles`

Relaciona `auth.users` ao domÃ­nio.

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  whatsapp_number text not null unique,
  role text not null default 'broker' check (role in ('broker','partner','admin','support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.3 Tabela `brokers`

```sql
create table public.brokers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text not null,
  whatsapp_number text not null,
  status text not null default 'active' check (status in ('active','inactive','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.4 Tabela `plans`

```sql
create table public.plans (
  code text primary key,
  name text not null,
  max_active_properties integer not null,
  max_images_per_property integer not null,
  has_auto_expiration boolean not null,
  expiration_days integer,
  recommendation_source text not null check (recommendation_source in ('self','pro_only')),
  created_at timestamptz not null default now()
);
```

### 8.5 Seed de planos

```sql
insert into public.plans (
  code, name, max_active_properties, max_images_per_property,
  has_auto_expiration, expiration_days, recommendation_source
)
values
  ('free', 'FREE', 1, 10, true, 30, 'pro_only'),
  ('pro',  'PRO', 999999, 15, false, null, 'self');
```

### 8.6 Tabela `subscriptions`

```sql
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  plan_code text not null references public.plans(code),
  status text not null check (status in (
    'free', 'pro_pending_activation', 'pro_active', 'past_due', 'canceled', 'expired'
  )),
  billing_provider text check (billing_provider in ('stripe','mercado_pago')),
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.7 Tabela `properties`

```sql
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  account_id uuid not null references public.accounts(id) on delete cascade,
  broker_id uuid not null references public.brokers(id) on delete cascade,
  origin_plan_code text not null references public.plans(code),

  listing_status text not null check (listing_status in (
    'draft','published','printed','expired','removed','blocked'
  )),

  property_type text not null,
  property_subtype text not null,
  purpose text not null check (purpose in ('sale','rent')),

  title text,
  description text not null,
  city text not null,
  state text not null,
  neighborhood text,
  address_line text,
  postal_code text,

  bedrooms integer not null default 0,
  suites integer not null default 0,
  bathrooms integer not null default 0,
  parking_spaces integer not null default 0,
  area_m2 numeric(12,2),
  price numeric(14,2),
  condo_fee numeric(14,2),
  iptu_amount numeric(14,2),

  printed_at timestamptz,
  expires_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.8 Tabela `property_features`

```sql
create table public.property_features (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  feature_key text not null,
  feature_value text,
  created_at timestamptz not null default now()
);
```

### 8.9 Tabela `property_media`

```sql
create table public.property_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  bucket_id text not null default 'property-media',
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  width integer,
  height integer,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  status text not null check (status in ('uploaded','processing','ready','failed','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.10 Tabela `property_qrcodes`

```sql
create table public.property_qrcodes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  qr_token text not null unique,
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
```

### 8.11 Tabela `partners`

```sql
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  status text not null default 'active' check (status in ('active','inactive','blocked')),
  created_at timestamptz not null default now()
);
```

### 8.12 Tabela `partner_users`

```sql
create table public.partner_users (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
```

### 8.13 Tabela `print_events`

```sql
create table public.print_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  partner_id uuid references public.partners(id),
  partner_user_profile_id uuid references public.profiles(id),
  event_type text not null default 'print_registered' check (event_type in ('print_registered','reprint_registered')),
  created_at timestamptz not null default now()
);
```

### 8.14 Tabela `leads`

```sql
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  broker_id uuid not null references public.brokers(id) on delete cascade,
  client_phone text not null,
  source text not null default 'qr_whatsapp' check (source in ('qr_whatsapp')),
  intent text not null check (intent in ('visit_interest','similar_property_interest')),
  status text not null default 'new' check (status in ('new','contacted','scheduled','closed','invalid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.15 Tabela `lead_interactions`

```sql
create table public.lead_interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  interaction_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

### 8.16 Tabela `conversation_sessions`

```sql
create table public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  lead_phone text not null,
  origin_property_id uuid references public.properties(id) on delete set null,
  current_property_id uuid references public.properties(id) on delete set null,
  state text not null check (state in (
    'started',
    'property_sent',
    'awaiting_main_choice',
    'recommendations_sent',
    'awaiting_recommendation_choice',
    'visit_interest_registered',
    'closed',
    'error'
  )),
  last_menu text,
  last_recommended_properties jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.17 Tabela `whatsapp_messages`

```sql
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('inbound','outbound')),
  provider text not null check (provider in ('uazapi','official_whatsapp')),
  account_id uuid references public.accounts(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  lead_phone text,
  broker_phone text,
  message_type text not null check (message_type in ('text','image','menu','system')),
  provider_message_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('queued','processing','sent','delivered','failed','abandoned')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.18 Tabela `webhook_events`

```sql
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_name text not null,
  external_event_id text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'pending' check (processing_status in ('pending','processed','failed','ignored')),
  unique (provider, external_event_id)
);
```

### 8.19 Tabela `recommendation_events`

```sql
create table public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  origin_property_id uuid not null references public.properties(id) on delete cascade,
  returned_property_ids jsonb not null,
  lead_phone text,
  created_at timestamptz not null default now()
);
```

### 8.20 Tabela `audit_logs`

```sql
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid,
  actor_profile_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

---

## 9. Ãndices Recomendados

```sql
create index idx_profiles_account_id on public.profiles(account_id);
create index idx_brokers_account_id on public.brokers(account_id);
create index idx_subscriptions_account_id on public.subscriptions(account_id);
create index idx_properties_account_id on public.properties(account_id);
create index idx_properties_broker_id on public.properties(broker_id);
create index idx_properties_listing_status on public.properties(listing_status);
create index idx_properties_origin_plan_code on public.properties(origin_plan_code);
create index idx_properties_city_state on public.properties(city, state);
create index idx_properties_type_subtype on public.properties(property_type, property_subtype);
create index idx_property_media_property_id on public.property_media(property_id);
create index idx_print_events_property_id on public.print_events(property_id);
create index idx_leads_property_id on public.leads(property_id);
create index idx_leads_broker_id on public.leads(broker_id);
create index idx_conversation_sessions_phone on public.conversation_sessions(lead_phone);
create index idx_whatsapp_messages_status on public.whatsapp_messages(status);
create index idx_webhook_events_provider_status on public.webhook_events(provider, processing_status);
```

---

## 10. FunÃ§Ãµes SQL e Triggers Recomendadas

### 10.1 `handle_new_user()`

Cria a base de domÃ­nio quando um usuÃ¡rio nasce em `auth.users`.

Responsabilidades:

1. criar `accounts`;
2. criar `profiles`;
3. criar `brokers`;
4. criar `subscriptions` com `free`.

### 10.2 `set_updated_at()`

Trigger genÃ©rica para atualizar `updated_at`.

### 10.3 `generate_public_property_id()`

Gera `public_id` curto e legÃ­vel.

Exemplo: `IMV-2026-8F4K29`.

### 10.4 `generate_qr_token()`

Gera token Ãºnico do QR.

### 10.5 `register_print_event(p_property_id uuid, p_partner_id uuid, p_profile_id uuid)`

Responsabilidades:

- registrar evento de impressÃ£o;
- se o imÃ³vel for FREE e `printed_at` estiver nulo:
  - preencher `printed_at = now()`
  - preencher `expires_at = now() + interval '30 days'`
  - atualizar status para `printed`
- se jÃ¡ existir `printed_at`, apenas registrar reimpressÃ£o.

### 10.6 `expire_free_properties()`

Responsabilidades:

- localizar FREE com `expires_at < now()` e `listing_status in ('published','printed')`
- marcar `listing_status = 'expired'`

### 10.7 `can_create_property(account_id)`

Valida limites do plano.

### 10.8 `get_active_plan(account_id)`

Retorna plano canÃ´nico da conta.

### 10.9 `recommend_similar_properties(origin_property_id uuid, limit_count integer)`

Implementa score determinÃ­stico por:

- tipo
- subtipo
- finalidade
- cidade/bairro
- faixa de preÃ§o
- metragem
- quartos
- vagas

Aplicando as regras:

- origem PRO â†’ buscar imÃ³veis PRO do mesmo corretor
- origem FREE â†’ buscar imÃ³veis PRO apenas

### 10.10 `create_lead_from_visit_interest(...)`

Cria lead com idempotÃªncia.

---

## 11. RLS â€” EstratÃ©gia Oficial

### Regra geral

Todas as tabelas em `public` com acesso via frontend devem ter RLS habilitado.

### Habilitar RLS

```sql
alter table public.accounts enable row level security;
alter table public.profiles enable row level security;
alter table public.brokers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.properties enable row level security;
alter table public.property_features enable row level security;
alter table public.property_media enable row level security;
alter table public.property_qrcodes enable row level security;
alter table public.leads enable row level security;
alter table public.lead_interactions enable row level security;
alter table public.conversation_sessions enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.audit_logs enable row level security;
```

### PolÃ­tica base de ownership por account

A polÃ­tica-base para o corretor autenticado Ã© sempre:

- o usuÃ¡rio sÃ³ acessa registros cujo `account_id` seja o mesmo do seu `profile.account_id`

### Helper function sugerida

```sql
create or replace function public.current_account_id()
returns uuid
language sql
stable
as $$
  select account_id
  from public.profiles
  where id = auth.uid()
$$;
```

### Exemplo de policy para `properties`

```sql
create policy "broker_select_own_properties"
on public.properties
for select
to authenticated
using (account_id = public.current_account_id());

create policy "broker_insert_own_properties"
on public.properties
for insert
to authenticated
with check (account_id = public.current_account_id());

create policy "broker_update_own_properties"
on public.properties
for update
to authenticated
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

create policy "broker_delete_own_properties"
on public.properties
for delete
to authenticated
using (account_id = public.current_account_id());
```

### Portal parceiro

O parceiro **nÃ£o** deve ganhar acesso irrestrito Ã s tabelas do domÃ­nio via frontend direto.

O caminho recomendado Ã©:

- autenticaÃ§Ã£o do parceiro via Supabase Auth
- leitura e aÃ§Ã£o de impressÃ£o via **Edge Function protegida**
- funÃ§Ã£o usa `service_role` e valida papel do usuÃ¡rio

### Admin e suporte

Admin e suporte devem operar:

- via Edge Functions seguras
- ou via Dashboard / SQL
- nunca por polÃ­ticas permissivas no cliente

---

## 12. Storage â€” EstratÃ©gia Oficial

### Bucket recomendado

- `property-media`

### OrganizaÃ§Ã£o de paths

```text
property-media/
  account/{account_id}/
    property/{property_id}/
      original/{filename}
      optimized/{filename}
      whatsapp/{filename}
      thumb/{filename}
```

### Regras

- frontend envia upload apenas para pastas da prÃ³pria conta
- imagens originais e processadas ficam no mesmo bucket
- `storage.objects` Ã© gerenciado pela API do Storage, nÃ£o por SQL manual

### PolÃ­tica recomendada

- usuÃ¡rio autenticado sÃ³ pode fazer upload na sua prÃ³pria pasta
- leitura pÃºblica direta nÃ£o Ã© obrigatÃ³ria
- preferir URLs assinadas para consumo controlado

---

## 13. Edge Functions NecessÃ¡rias

### 13.1 `partner-print-register`

FunÃ§Ã£o protegida para parceiro registrar impressÃ£o.

Entrada:

```json
{
  "property_id": "uuid"
}
```

SaÃ­da:

```json
{
  "ok": true,
  "property_id": "uuid",
  "printed_at": "timestamp | null",
  "expires_at": "timestamp | null"
}
```

### 13.2 `qr-resolve`

Recebe token do QR e resolve o estado do anÃºncio.

Entrada:

```json
{
  "qr_token": "token"
}
```

SaÃ­das possÃ­veis:

- ativo
- expirado
- removido
- inexistente

### 13.3 `whatsapp-webhook-inbound`

Recebe webhooks da Uazapi.

Responsabilidades:

- validar request
- persistir raw event em `webhook_events`
- normalizar mensagem inbound
- atualizar sessÃ£o conversacional
- enfileirar resposta

### 13.4 `whatsapp-dispatch`

Consumidor de fila de outbound.

Responsabilidades:

- ler mensagens pendentes
- aplicar throttling
- aplicar jitter operacional
- enviar via provider atual
- persistir status

### 13.5 `billing-stripe-webhook`

Responsabilidades:

- validar assinatura do webhook
- persistir evento cru
- atualizar `subscriptions`
- registrar auditoria

### 13.6 `billing-mercadopago-webhook`

Mesma funÃ§Ã£o para Mercado Pago.

### 13.7 `media-process`

Responsabilidades:

- processar imagens enfileiradas
- comprimir
- gerar variantes
- atualizar `property_media`

### 13.8 `lead-notify-broker`

Notifica o corretor quando lead Ã© criado.

### 13.9 `conversation-handle`

Orquestra mÃ¡quina de estados do WhatsApp.

---

## 14. Filas Oficiais

### EstratÃ©gia preferencial

Usar **Supabase Queues / pgmq** para jobs durÃ¡veis.

### Filas

- `media_processing`
- `whatsapp_outbound`
- `whatsapp_retry`
- `billing_webhooks`
- `lead_notifications`
- `property_expiration_checks`

### Regras

- mensagens devem ter idempotÃªncia
- retries com backoff exponencial
- arquivamento em falhas definitivas
- correlation id por operaÃ§Ã£o

---

## 15. Jobs Recorrentes (Cron)

### 15.1 `expire-free-properties-job`

FrequÃªncia:

- a cada 5 minutos

Responsabilidades:

- chamar `expire_free_properties()`

### 15.2 `process-whatsapp-queue-job`

FrequÃªncia:

- a cada 10â€“30 segundos, conforme volume

Responsabilidades:

- disparar `whatsapp-dispatch`

### 15.3 `process-media-job`

FrequÃªncia:

- a cada 30 segundos ou 1 minuto

### 15.4 `retry-failed-webhooks-job`

FrequÃªncia:

- a cada 5 minutos

---

## 16. Fluxos Funcionais Principais

### 16.1 Cadastro de usuÃ¡rio

1. usuÃ¡rio faz signup com email, senha, nome e WhatsApp;
2. `auth.users` Ã© criado;
3. trigger cria `account`, `profile`, `broker`, `subscription` FREE;
4. usuÃ¡rio entra no dashboard.

### 16.2 CriaÃ§Ã£o de imÃ³vel

1. corretor cria imÃ³vel;
2. sistema valida limite do plano;
3. gera `public_id`;
4. gera QR;
5. imagens entram em processamento.

### 16.3 Registro de impressÃ£o

1. parceiro busca imÃ³vel;
2. parceiro registra impressÃ£o;
3. para FREE: primeira impressÃ£o ativa `printed_at` e `expires_at`;
4. para PRO: apenas histÃ³rico.

### 16.4 Scan do QR

1. QR token chega na funÃ§Ã£o `qr-resolve`;
2. sistema resolve status do imÃ³vel;
3. se ativo, comeÃ§a fluxo WhatsApp;
4. se expirado/removido, responde indisponÃ­vel.

### 16.5 Agendamento de visita

1. usuÃ¡rio responde `1`;
2. sistema valida contexto;
3. cria lead;
4. notifica corretor.

### 16.6 Ver similares

1. usuÃ¡rio responde `2`;
2. sistema chama `recommend_similar_properties`;
3. retorna atÃ© 5 imÃ³veis;
4. usuÃ¡rio escolhe um;
5. sistema pode gerar novo lead.

---

## 17. Fluxos de ExceÃ§Ã£o

### 17.1 FREE tentando criar segundo imÃ³vel

- backend bloqueia
- mensagem: `Seu plano atual permite apenas 1 imÃ³vel ativo.`

### 17.2 Upload acima do limite do plano

- rejeitar excedente
- manter vÃ¡lidas

### 17.3 Falha na compressÃ£o

- mÃ­dia fica `failed`
- nÃ£o quebra o imÃ³vel inteiro
- permitir reprocesso

### 17.4 QR expirado

- responder: `Este anÃºncio nÃ£o estÃ¡ mais disponÃ­vel.`

### 17.5 ReimpressÃ£o de FREE

- nÃ£o renovar `expires_at`

### 17.6 Webhook duplicado

- ignorar por idempotÃªncia

### 17.7 Uazapi fora do ar

- manter fila
- retry controlado
- alertar operaÃ§Ã£o

### 17.8 Cliente responde fora do fluxo

- reenviar menu resumido
- limitar tentativas

---

## 18. MÃ¡quina de Estados do WhatsApp

### SessÃ£o

Campos:

- `lead_phone`
- `origin_property_id`
- `current_property_id`
- `state`
- `last_menu`
- `last_recommended_properties`
- `expires_at`

### Estados

- `started`
- `property_sent`
- `awaiting_main_choice`
- `recommendations_sent`
- `awaiting_recommendation_choice`
- `visit_interest_registered`
- `closed`
- `error`

### Regras

- sessÃ£o expira por tempo configurÃ¡vel
- estado sempre validado antes de processar resposta
- duplicidade de mensagem nÃ£o pode gerar lead duplicado

---

## 19. RecomendaÃ§Ã£o de ImÃ³veis

### EstratÃ©gia inicial

Nada de IA no MVP.

Usar score determinÃ­stico.

### Campos de score

- tipo
- subtipo
- finalidade
- cidade
- bairro
- faixa de preÃ§o
- metragem
- quartos
- vagas

### Regra de origem

- origem PRO â†’ busca no prÃ³prio acervo PRO elegÃ­vel do corretor
- origem FREE â†’ busca apenas em imÃ³veis PRO ativos

### RestriÃ§Ãµes

Nunca recomendar:

- imÃ³vel expirado
- removido
- bloqueado
- inativo

---

## 20. Billing

### Provedores

- Stripe
- Mercado Pago

### Source of truth

Tabela `subscriptions`.

### Regra crÃ­tica

Plano PRO sÃ³ Ã© liberado apÃ³s webhook validado.

### Estados

- `free`
- `pro_pending_activation`
- `pro_active`
- `past_due`
- `canceled`
- `expired`

### PolÃ­tica operacional mÃ­nima

Se PRO perder pagamento:

- nÃ£o apagar imÃ³veis
- bloquear novas criaÃ§Ãµes acima do limite
- manter polÃ­tica de grace period como decisÃ£o futura

---

## 21. Observabilidade

### Logs obrigatÃ³rios

- signup
- login
- criaÃ§Ã£o de imÃ³vel
- upload de imagem
- falha de processamento de mÃ­dia
- impressÃ£o registrada
- QR resolvido
- lead criado
- webhook recebido
- webhook falhou
- mensagem WhatsApp falhou

### MÃ©tricas

- imÃ³veis ativos
- scans de QR
- leads por imÃ³vel
- falha por provider
- fila pendente
- tempo de processamento de mÃ­dia
- expiraÃ§Ãµes por dia

---

## 22. CritÃ©rios de AceitaÃ§Ã£o

### Auth

- signup cria `account`, `profile`, `broker` e `subscription free`
- sessÃ£o funciona

### Properties

- FREE nÃ£o cria segundo imÃ³vel ativo
- PRO cria mÃºltiplos

### Media

- FREE limita 10 imagens
- PRO limita 15
- mÃ­dia processada fica disponÃ­vel

### Print

- primeira impressÃ£o de FREE ativa prazo de 30 dias
- reimpressÃ£o nÃ£o renova prazo

### QR

- QR ativo funciona
- QR expirado responde indisponÃ­vel
- PRO nÃ£o expira automaticamente

### Recommendation

- FREE nunca recomenda FREE
- PRO recomenda do prÃ³prio acervo

### Billing

- PRO sÃ³ ativa por webhook vÃ¡lido

---

## 23. Estrutura de Projeto Recomendada

```text
/apps
  /web                 # Next.js

/supabase
  /migrations          # SQL versionado
  /seed                # seeds opcionais
  /functions
    /partner-print-register
    /qr-resolve
    /whatsapp-webhook-inbound
    /whatsapp-dispatch
    /billing-stripe-webhook
    /billing-mercadopago-webhook
    /media-process
    /lead-notify-broker
    /conversation-handle

/packages
  /shared-types
  /shared-utils
  /domain-rules
```

---

## 24. Sprint Plan Completo

### Sprint 0 â€” Foundation / Supabase Setup

**Objetivo**
Criar a fundaÃ§Ã£o do projeto com Supabase e web app.

**Entregas**

- criar projeto Supabase
- configurar ambiente local com CLI
- criar projeto Next.js
- configurar `supabase-js`
- criar estrutura de migrations
- criar buckets e ambiente inicial
- configurar secrets de Edge Functions
- configurar lint, format, CI

**DoD**

- projeto sobe localmente
- login em ambiente local funcional
- migrations versionadas

---

### Sprint 1 â€” Auth + Domain Bootstrap

**Objetivo**
Colocar autenticaÃ§Ã£o de pÃ© com bootstrap automÃ¡tico de domÃ­nio.

**Entregas**

- signup/login com Supabase Auth
- trigger `handle_new_user()`
- criaÃ§Ã£o de `accounts`, `profiles`, `brokers`, `subscriptions`
- tela de login e cadastro
- rota protegida de dashboard
- helper `current_account_id()`
- RLS inicial de ownership

**DoD**

- novo usuÃ¡rio entra no sistema com conta FREE pronta

---

### Sprint 2 â€” Property Core

**Objetivo**
Implementar CRUD de imÃ³veis.

**Entregas**

- tabelas `properties` e `property_features`
- criaÃ§Ã£o, ediÃ§Ã£o, listagem e remoÃ§Ã£o lÃ³gica
- funÃ§Ã£o `can_create_property()`
- status do imÃ³vel
- geraÃ§Ã£o de `public_id`
- validaÃ§Ã£o FREE vs PRO
- UI do formulÃ¡rio detalhado

**DoD**

- corretor gerencia imÃ³veis respeitando regras do plano

---

### Sprint 3 â€” Storage + Media Pipeline

**Objetivo**
Implementar upload e processamento de imagens.

**Entregas**

- bucket `property-media`
- tabela `property_media`
- upload no frontend
- policies de storage
- fila `media_processing`
- Edge Function `media-process`
- geraÃ§Ã£o de variantes: original, optimized, whatsapp, thumb
- limite por plano

**DoD**

- imagens sobem, processam e ficam disponÃ­veis

---

### Sprint 4 â€” QR Code

**Objetivo**
Gerar e resolver QR por imÃ³vel.

**Entregas**

- tabela `property_qrcodes`
- funÃ§Ã£o de geraÃ§Ã£o de token
- endpoint/Edge Function `qr-resolve`
- tela do QR no painel
- fluxo de status ativo/expirado/removido

**DoD**

- todo imÃ³vel elegÃ­vel tem QR funcional

---

### Sprint 5 â€” Partner Portal + Print Events

**Objetivo**
Ativar o fluxo fÃ­sico da placa.

**Entregas**

- tabelas `partners`, `partner_users`, `print_events`
- login parceiro
- busca por ID e telefone
- registrar impressÃ£o via `partner-print-register`
- funÃ§Ã£o `register_print_event()`
- UI portal parceiro

**DoD**

- impressÃ£o registrada altera FREE corretamente

---

### Sprint 6 â€” WhatsApp Provider Layer

**Objetivo**
Integrar Uazapi de forma isolada.

**Entregas**

- tabela `whatsapp_messages`
- tabela `webhook_events`
- provider adapter interno
- Edge Function `whatsapp-webhook-inbound`
- Edge Function `whatsapp-dispatch`
- fila `whatsapp_outbound`
- throttling + jitter operacional

**DoD**

- sistema envia e recebe mensagens reais sem acoplamento do domÃ­nio ao provider

---

### Sprint 7 â€” Conversation Engine

**Objetivo**
Implementar a mÃ¡quina de estados do fluxo WhatsApp.

**Entregas**

- tabela `conversation_sessions`
- estados de conversa
- fluxo de envio do imÃ³vel
- menu `1` / `2`
- tratamento de mensagens invÃ¡lidas
- reinÃ­cio controlado de sessÃ£o

**DoD**

- cliente percorre o fluxo sem quebrar o contexto

---

### Sprint 8 â€” Lead Capture

**Objetivo**
Capturar leads e notificar o corretor.

**Entregas**

- tabelas `leads` e `lead_interactions`
- funÃ§Ã£o `create_lead_from_visit_interest()`
- Edge Function `lead-notify-broker`
- idempotÃªncia de geraÃ§Ã£o de lead

**DoD**

- aÃ§Ã£o de agendar gera lead e notifica o corretor

---

### Sprint 9 â€” Recommendation Engine

**Objetivo**
Implementar o diferencial de negÃ³cio.

**Entregas**

- funÃ§Ã£o `recommend_similar_properties()`
- tabela `recommendation_events`
- retorno em lotes de atÃ© 5 imÃ³veis
- regra FREE vs PRO
- integraÃ§Ã£o com WhatsApp

**DoD**

- recomendaÃ§Ãµes respeitam as regras comerciais

---

### Sprint 10 â€” Billing

**Objetivo**
Ativar monetizaÃ§Ã£o real.

**Entregas**

- integraÃ§Ã£o Stripe
- integraÃ§Ã£o Mercado Pago
- Edge Functions de webhook
- tabela `subscriptions` com ciclo de atualizaÃ§Ã£o
- Ã¡rea de planos no frontend
- upgrade/downgrade

**DoD**

- usuÃ¡rio vira PRO por pagamento confirmado

---

### Sprint 11 â€” Expiration Engine

**Objetivo**
Fechar o ciclo do plano FREE.

**Entregas**

- funÃ§Ã£o `expire_free_properties()`
- Cron `expire-free-properties-job`
- atualizaÃ§Ã£o automÃ¡tica de imÃ³veis vencidos
- integraÃ§Ã£o com QR resolve

**DoD**

- anÃºncio FREE expira automaticamente no prazo correto

---

### Sprint 12 â€” Observability + Hardening

**Objetivo**
Preparar produÃ§Ã£o.

**Entregas**

- logs estruturados
- alertas operacionais
- dashboards
- rate limiting
- revisÃ£o de RLS
- revisÃ£o de storage policies
- revisÃ£o de idempotÃªncia
- testes finais E2E

**DoD**

- sistema monitorÃ¡vel, previsÃ­vel e pronto para beta fechado

---

## 25. Agentes de ExecuÃ§Ã£o Especializados

### 25.1 Auth Agent

ResponsÃ¡vel por:

- Supabase Auth
- onboarding
- sessÃµes
- RBAC / vÃ­nculo com domÃ­nio

### 25.2 Database & RLS Agent

ResponsÃ¡vel por:

- schema SQL
- migrations
- functions
- triggers
- Ã­ndices
- policies

### 25.3 Property Agent

ResponsÃ¡vel por:

- CRUD dos imÃ³veis
- validaÃ§Ã£o de plano
- estado do anÃºncio

### 25.4 Media Agent

ResponsÃ¡vel por:

- upload
- compressÃ£o
- variantes
- Storage

### 25.5 QR Agent

ResponsÃ¡vel por:

- tokens
- geraÃ§Ã£o visual
- resoluÃ§Ã£o pÃºblica

### 25.6 Partner Agent

ResponsÃ¡vel por:

- portal parceiro
- consulta
- impressÃ£o
- auditoria de print

### 25.7 WhatsApp Gateway Agent

ResponsÃ¡vel por:

- provider layer
- Uazapi
- retries
- throttling
- webhooks

### 25.8 Conversation Agent

ResponsÃ¡vel por:

- state machine do WhatsApp
- menus
- fallback
- contexto

### 25.9 Recommendation Agent

ResponsÃ¡vel por:

- motor de similares
- score
- filtros
- regras FREE vs PRO

### 25.10 Lead Agent

ResponsÃ¡vel por:

- criaÃ§Ã£o de leads
- interaÃ§Ãµes
- notificaÃ§Ã£o do corretor

### 25.11 Billing Agent

ResponsÃ¡vel por:

- Stripe
- Mercado Pago
- reconciliaÃ§Ã£o de plano
- webhooks

### 25.12 Expiration Agent

ResponsÃ¡vel por:

- contagem pÃ³s-impressÃ£o
- cron de expiraÃ§Ã£o
- consistÃªncia temporal

### 25.13 Frontend UI Agent

ResponsÃ¡vel por:

- dashboard
- forms
- Ã¡rea de planos
- portal parceiro
- UX operacional

### 25.14 DevOps / Platform Agent

ResponsÃ¡vel por:

- ambientes
- CI/CD
- secrets
- deploy de Edge Functions
- backups
- observabilidade

### 25.15 QA Agent

ResponsÃ¡vel por:

- testes de migrations
- testes de funÃ§Ãµes SQL
- testes de RLS
- testes E2E dos fluxos crÃ­ticos

---

## 26. Testes ObrigatÃ³rios

### Banco

- migrations sobem do zero
- rollback viÃ¡vel quando aplicÃ¡vel
- funÃ§Ãµes SQL testadas
- Ã­ndices presentes

### RLS

- usuÃ¡rio A nÃ£o acessa dados do usuÃ¡rio B
- parceiro nÃ£o acessa recursos fora do fluxo permitido

### Storage

- upload autorizado sÃ³ em pasta prÃ³pria
- leitura indevida bloqueada

### Billing

- webhook duplicado nÃ£o duplica efeito
- upgrade sÃ³ apÃ³s validaÃ§Ã£o

### WhatsApp

- inbound cria contexto
- outbound respeita fila
- falha parcial nÃ£o quebra todo o fluxo

### ExpiraÃ§Ã£o

- primeira impressÃ£o FREE ativa validade
- reimpressÃ£o nÃ£o renova
- job expira corretamente

---

## 27. Prompt Mestre para outra IA construir o sistema

Use o texto abaixo exatamente como prompt inicial:

```text
VocÃª Ã© um arquiteto e engenheiro sÃªnior responsÃ¡vel por implementar este sistema exatamente como especificado neste SDD.

Regras:
1. O backend oficial Ã© Supabase.
2. Use Supabase Auth, Postgres, RLS, Storage, Edge Functions, Cron e Queues.
3. NÃ£o troque a arquitetura.
4. NÃ£o remova regras de negÃ³cio.
5. Gere a implementaÃ§Ã£o em ordem de sprint.
6. Sempre entregue cÃ³digo completo, migrations completas, policies completas e testes.
7. NÃ£o substitua RLS por checagens apenas no frontend.
8. NÃ£o use Firebase.
9. NÃ£o use backend Node separado como core do sistema.
10. Toda integraÃ§Ã£o externa deve passar por Edge Functions.
11. O banco Ã© o source of truth.
12. Sempre respeite as regras FREE vs PRO.
13. ReimpressÃ£o de FREE nÃ£o renova expiraÃ§Ã£o.
14. ImÃ³vel FREE expira 30 dias apÃ³s primeira impressÃ£o.
15. ImÃ³vel PRO fica ativo atÃ© remoÃ§Ã£o manual.
16. O provider atual de WhatsApp Ã© Uazapi, mas deve ficar isolado atrÃ¡s de adapter.
17. Billing deve suportar Stripe e Mercado Pago.
18. Entregue por sprints, comeÃ§ando pelo Sprint 0.

Agora implemente o Sprint 0 completo com cÃ³digo, migrations, estrutura de pastas, variÃ¡veis de ambiente, policies e instruÃ§Ãµes de execuÃ§Ã£o.
```

---

## 28. ConclusÃ£o

Este documento define:

- produto
- regras de negÃ³cio
- arquitetura tÃ©cnica
- modelagem de dados
- estratÃ©gia de seguranÃ§a
- estratÃ©gia de storage
- Edge Functions
- filas e cron
- sprints completos
- agentes especializados
- prompt mestre para implementaÃ§Ã£o por outra IA

Este Ã© o blueprint oficial do projeto.
