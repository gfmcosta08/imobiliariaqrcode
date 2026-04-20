# SDD Completo — SaaS Imobiliário com QR Code + WhatsApp + Supabase

## 1. Entendimento

Plataforma SaaS para corretores imobiliários e imobiliárias futuras, com cadastro detalhado de imóveis, geração de QR Code por imóvel, atendimento automatizado via WhatsApp, recomendação de imóveis similares, captura de leads e monetização por assinatura.

O produto possui dois perfis:

- **FREE**: 1 imóvel, 10 imagens, validade de 30 dias após impressão da placa.
- **PRO**: múltiplos imóveis, 15 imagens por imóvel, sem expiração automática.

Quando o cliente escaneia o QR Code de uma placa:

1. o sistema identifica o imóvel;
2. inicia o fluxo no WhatsApp;
3. envia descrição + imagens;
4. oferece opções:
   - `1` agendar visita
   - `2` ver imóveis parecidos

Regra de monetização:

- Se o imóvel original é **PRO**, os similares vêm do próprio acervo desse corretor.
- Se o imóvel original é **FREE**, os similares vêm **somente de imóveis PRO**.

---

## 2. Objetivo

Construir um SaaS robusto, escalável e pronto para produção usando **Supabase como backend principal**, com:

- autenticação;
- autorização por RLS;
- banco PostgreSQL;
- Storage para imagens;
- Edge Functions para integrações e lógica server-side;
- filas e jobs recorrentes;
- billing;
- portal parceiro;
- observabilidade e segurança.

---

## 3. Escopo

### In-scope

- Auth e sessão
- Cadastro de corretor
- Gestão de imóveis
- Upload, compressão e armazenamento de imagens
- Geração de QR Code
- Portal parceiro para impressão
- Integração WhatsApp (Uazapi no MVP)
- Motor de recomendação
- Captura de leads
- Billing com Stripe e Mercado Pago
- Expiração de anúncios FREE
- Auditoria básica
- Observabilidade mínima

### Out-of-scope (MVP)

- CRM completo
- Mobile app nativo
- IA generativa para descrição
- Multiusuário por conta no MVP
- Integração com portais externos
- Analytics avançado
- API pública para terceiros

---

## 4. Decisão Técnica Oficial

### Backend oficial

**Supabase será o backend oficial do projeto.**

### Componentes oficiais a usar

- **Supabase Postgres** como banco principal
- **Supabase Auth** para autenticação
- **Supabase RLS** para autorização multi-tenant
- **Supabase Storage** para imagens
- **Supabase Edge Functions** para integrações e server-side logic
- **Supabase Cron** para jobs recorrentes
- **Supabase Queues / pgmq** para processamento assíncrono
- **Supabase Realtime** opcional para dashboards internos

### Frontend

- **Next.js**
- Supabase JS client

### Integrações externas

- **Uazapi** para WhatsApp no MVP
- **Stripe** para assinatura cartão
- **Mercado Pago** para Pix e assinatura regional

---

## 5. Arquitetura de Alto Nível

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

### Princípio central

O banco é o **source of truth**. Toda regra crítica deve nascer ou terminar no Postgres:

- plano do usuário;
- status do imóvel;
- data de impressão;
- expiração;
- histórico de lead;
- auditoria.

---

## 6. Estratégia de Segurança e Tenancy

### Modelo de tenancy

Mesmo começando com 1 corretor por conta, o modelo deve nascer assim:

- `accounts`
- `profiles`
- `brokers`
- `properties`

Hoje:

- 1 `account` = 1 `broker`

Amanhã:

- 1 `account` = N `brokers`

### Isolamento de dados

Toda tabela de domínio deve carregar `account_id`.

Toda leitura/escrita vinda do frontend deve passar por **RLS**.

### Acesso administrativo

Operações administrativas e integrações críticas serão executadas via:

- Edge Functions com `service_role`
- SQL functions `security definer` apenas quando necessário

---

## 7. Regras de Negócio Congeladas

### Plano FREE

- 1 imóvel ativo por conta
- 10 imagens por imóvel
- QR e anúncio só entram em ciclo de validade após `print_registered`
- validade: 30 dias após primeira impressão
- reimpressão **não** renova validade
- imóvel FREE **não** é fonte de recomendação
- ao expirar, QR deve responder: `Este anúncio não está mais disponível.`

### Plano PRO

- múltiplos imóveis
- 15 imagens por imóvel
- não expira automaticamente
- permanece ativo até remoção manual ou política futura de billing
- imóveis PRO podem ser fonte de recomendação

### WhatsApp

- integração inicial via Uazapi
- todas as mensagens devem passar por fila
- aplicar throttling e jitter operacional
- nunca acoplar regra de negócio diretamente ao provider

### Impressão

- parceiro registra evento de impressão
- apenas a **primeira impressão** do FREE inicia o prazo de 30 dias
- PRO apenas registra histórico

---

## 8. Modelagem de Banco de Dados (DDL Lógico)

> Observação: para autenticação, o projeto usa `auth.users` do Supabase. As tabelas de domínio ficam em `public`.

### 8.1 Tabela `accounts`

```sql
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.2 Tabela `profiles`

Relaciona `auth.users` ao domínio.

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

## 9. Índices Recomendados

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

## 10. Funções SQL e Triggers Recomendadas

### 10.1 `handle_new_user()`

Cria a base de domínio quando um usuário nasce em `auth.users`.

Responsabilidades:

1. criar `accounts`;
2. criar `profiles`;
3. criar `brokers`;
4. criar `subscriptions` com `free`.

### 10.2 `set_updated_at()`

Trigger genérica para atualizar `updated_at`.

### 10.3 `generate_public_property_id()`

Gera `public_id` curto e legível.

Exemplo: `IMV-2026-8F4K29`.

### 10.4 `generate_qr_token()`

Gera token único do QR.

### 10.5 `register_print_event(p_property_id uuid, p_partner_id uuid, p_profile_id uuid)`

Responsabilidades:

- registrar evento de impressão;
- se o imóvel for FREE e `printed_at` estiver nulo:
  - preencher `printed_at = now()`
  - preencher `expires_at = now() + interval '30 days'`
  - atualizar status para `printed`
- se já existir `printed_at`, apenas registrar reimpressão.

### 10.6 `expire_free_properties()`

Responsabilidades:

- localizar FREE com `expires_at < now()` e `listing_status in ('published','printed')`
- marcar `listing_status = 'expired'`

### 10.7 `can_create_property(account_id)`

Valida limites do plano.

### 10.8 `get_active_plan(account_id)`

Retorna plano canônico da conta.

### 10.9 `recommend_similar_properties(origin_property_id uuid, limit_count integer)`

Implementa score determinístico por:

- tipo
- subtipo
- finalidade
- cidade/bairro
- faixa de preço
- metragem
- quartos
- vagas

Aplicando as regras:

- origem PRO → buscar imóveis PRO do mesmo corretor
- origem FREE → buscar imóveis PRO apenas

### 10.10 `create_lead_from_visit_interest(...)`

Cria lead com idempotência.

---

## 11. RLS — Estratégia Oficial

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

### Política base de ownership por account

A política-base para o corretor autenticado é sempre:

- o usuário só acessa registros cujo `account_id` seja o mesmo do seu `profile.account_id`

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

O parceiro **não** deve ganhar acesso irrestrito às tabelas do domínio via frontend direto.

O caminho recomendado é:

- autenticação do parceiro via Supabase Auth
- leitura e ação de impressão via **Edge Function protegida**
- função usa `service_role` e valida papel do usuário

### Admin e suporte

Admin e suporte devem operar:

- via Edge Functions seguras
- ou via Dashboard / SQL
- nunca por políticas permissivas no cliente

---

## 12. Storage — Estratégia Oficial

### Bucket recomendado

- `property-media`

### Organização de paths

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

- frontend envia upload apenas para pastas da própria conta
- imagens originais e processadas ficam no mesmo bucket
- `storage.objects` é gerenciado pela API do Storage, não por SQL manual

### Política recomendada

- usuário autenticado só pode fazer upload na sua própria pasta
- leitura pública direta não é obrigatória
- preferir URLs assinadas para consumo controlado

---

## 13. Edge Functions Necessárias

### 13.1 `partner-print-register`

Função protegida para parceiro registrar impressão.

Entrada:

```json
{
  "property_id": "uuid"
}
```

Saída:

```json
{
  "ok": true,
  "property_id": "uuid",
  "printed_at": "timestamp | null",
  "expires_at": "timestamp | null"
}
```

### 13.2 `qr-resolve`

Recebe token do QR e resolve o estado do anúncio.

Entrada:

```json
{
  "qr_token": "token"
}
```

Saídas possíveis:

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
- atualizar sessão conversacional
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

Mesma função para Mercado Pago.

### 13.7 `media-process`

Responsabilidades:

- processar imagens enfileiradas
- comprimir
- gerar variantes
- atualizar `property_media`

### 13.8 `lead-notify-broker`

Notifica o corretor quando lead é criado.

### 13.9 `conversation-handle`

Orquestra máquina de estados do WhatsApp.

---

## 14. Filas Oficiais

### Estratégia preferencial

Usar **Supabase Queues / pgmq** para jobs duráveis.

### Filas

- `media_processing`
- `whatsapp_outbound`
- `whatsapp_retry`
- `billing_webhooks`
- `lead_notifications`
- `property_expiration_checks`

### Regras

- mensagens devem ter idempotência
- retries com backoff exponencial
- arquivamento em falhas definitivas
- correlation id por operação

---

## 15. Jobs Recorrentes (Cron)

### 15.1 `expire-free-properties-job`

Frequência:

- a cada 5 minutos

Responsabilidades:

- chamar `expire_free_properties()`

### 15.2 `process-whatsapp-queue-job`

Frequência:

- a cada 10–30 segundos, conforme volume

Responsabilidades:

- disparar `whatsapp-dispatch`

### 15.3 `process-media-job`

Frequência:

- a cada 30 segundos ou 1 minuto

### 15.4 `retry-failed-webhooks-job`

Frequência:

- a cada 5 minutos

---

## 16. Fluxos Funcionais Principais

### 16.1 Cadastro de usuário

1. usuário faz signup com email, senha, nome e WhatsApp;
2. `auth.users` é criado;
3. trigger cria `account`, `profile`, `broker`, `subscription` FREE;
4. usuário entra no dashboard.

### 16.2 Criação de imóvel

1. corretor cria imóvel;
2. sistema valida limite do plano;
3. gera `public_id`;
4. gera QR;
5. imagens entram em processamento.

### 16.3 Registro de impressão

1. parceiro busca imóvel;
2. parceiro registra impressão;
3. para FREE: primeira impressão ativa `printed_at` e `expires_at`;
4. para PRO: apenas histórico.

### 16.4 Scan do QR

1. QR token chega na função `qr-resolve`;
2. sistema resolve status do imóvel;
3. se ativo, começa fluxo WhatsApp;
4. se expirado/removido, responde indisponível.

### 16.5 Agendamento de visita

1. usuário responde `1`;
2. sistema valida contexto;
3. cria lead;
4. notifica corretor.

### 16.6 Ver similares

1. usuário responde `2`;
2. sistema chama `recommend_similar_properties`;
3. retorna até 5 imóveis;
4. usuário escolhe um;
5. sistema pode gerar novo lead.

---

## 17. Fluxos de Exceção

### 17.1 FREE tentando criar segundo imóvel

- backend bloqueia
- mensagem: `Seu plano atual permite apenas 1 imóvel ativo.`

### 17.2 Upload acima do limite do plano

- rejeitar excedente
- manter válidas

### 17.3 Falha na compressão

- mídia fica `failed`
- não quebra o imóvel inteiro
- permitir reprocesso

### 17.4 QR expirado

- responder: `Este anúncio não está mais disponível.`

### 17.5 Reimpressão de FREE

- não renovar `expires_at`

### 17.6 Webhook duplicado

- ignorar por idempotência

### 17.7 Uazapi fora do ar

- manter fila
- retry controlado
- alertar operação

### 17.8 Cliente responde fora do fluxo

- reenviar menu resumido
- limitar tentativas

---

## 18. Máquina de Estados do WhatsApp

### Sessão

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

- sessão expira por tempo configurável
- estado sempre validado antes de processar resposta
- duplicidade de mensagem não pode gerar lead duplicado

---

## 19. Recomendação de Imóveis

### Estratégia inicial

Nada de IA no MVP.

Usar score determinístico.

### Campos de score

- tipo
- subtipo
- finalidade
- cidade
- bairro
- faixa de preço
- metragem
- quartos
- vagas

### Regra de origem

- origem PRO → busca no próprio acervo PRO elegível do corretor
- origem FREE → busca apenas em imóveis PRO ativos

### Restrições

Nunca recomendar:

- imóvel expirado
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

### Regra crítica

Plano PRO só é liberado após webhook validado.

### Estados

- `free`
- `pro_pending_activation`
- `pro_active`
- `past_due`
- `canceled`
- `expired`

### Política operacional mínima

Se PRO perder pagamento:

- não apagar imóveis
- bloquear novas criações acima do limite
- manter política de grace period como decisão futura

---

## 21. Observabilidade

### Logs obrigatórios

- signup
- login
- criação de imóvel
- upload de imagem
- falha de processamento de mídia
- impressão registrada
- QR resolvido
- lead criado
- webhook recebido
- webhook falhou
- mensagem WhatsApp falhou

### Métricas

- imóveis ativos
- scans de QR
- leads por imóvel
- falha por provider
- fila pendente
- tempo de processamento de mídia
- expirações por dia

---

## 22. Critérios de Aceitação

### Auth

- signup cria `account`, `profile`, `broker` e `subscription free`
- sessão funciona

### Properties

- FREE não cria segundo imóvel ativo
- PRO cria múltiplos

### Media

- FREE limita 10 imagens
- PRO limita 15
- mídia processada fica disponível

### Print

- primeira impressão de FREE ativa prazo de 30 dias
- reimpressão não renova prazo

### QR

- QR ativo funciona
- QR expirado responde indisponível
- PRO não expira automaticamente

### Recommendation

- FREE nunca recomenda FREE
- PRO recomenda do próprio acervo

### Billing

- PRO só ativa por webhook válido

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

### Sprint 0 — Foundation / Supabase Setup

**Objetivo**
Criar a fundação do projeto com Supabase e web app.

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

### Sprint 1 — Auth + Domain Bootstrap

**Objetivo**
Colocar autenticação de pé com bootstrap automático de domínio.

**Entregas**

- signup/login com Supabase Auth
- trigger `handle_new_user()`
- criação de `accounts`, `profiles`, `brokers`, `subscriptions`
- tela de login e cadastro
- rota protegida de dashboard
- helper `current_account_id()`
- RLS inicial de ownership

**DoD**

- novo usuário entra no sistema com conta FREE pronta

---

### Sprint 2 — Property Core

**Objetivo**
Implementar CRUD de imóveis.

**Entregas**

- tabelas `properties` e `property_features`
- criação, edição, listagem e remoção lógica
- função `can_create_property()`
- status do imóvel
- geração de `public_id`
- validação FREE vs PRO
- UI do formulário detalhado

**DoD**

- corretor gerencia imóveis respeitando regras do plano

---

### Sprint 3 — Storage + Media Pipeline

**Objetivo**
Implementar upload e processamento de imagens.

**Entregas**

- bucket `property-media`
- tabela `property_media`
- upload no frontend
- policies de storage
- fila `media_processing`
- Edge Function `media-process`
- geração de variantes: original, optimized, whatsapp, thumb
- limite por plano

**DoD**

- imagens sobem, processam e ficam disponíveis

---

### Sprint 4 — QR Code

**Objetivo**
Gerar e resolver QR por imóvel.

**Entregas**

- tabela `property_qrcodes`
- função de geração de token
- endpoint/Edge Function `qr-resolve`
- tela do QR no painel
- fluxo de status ativo/expirado/removido

**DoD**

- todo imóvel elegível tem QR funcional

---

### Sprint 5 — Partner Portal + Print Events

**Objetivo**
Ativar o fluxo físico da placa.

**Entregas**

- tabelas `partners`, `partner_users`, `print_events`
- login parceiro
- busca por ID e telefone
- registrar impressão via `partner-print-register`
- função `register_print_event()`
- UI portal parceiro

**DoD**

- impressão registrada altera FREE corretamente

---

### Sprint 6 — WhatsApp Provider Layer

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

- sistema envia e recebe mensagens reais sem acoplamento do domínio ao provider

---

### Sprint 7 — Conversation Engine

**Objetivo**
Implementar a máquina de estados do fluxo WhatsApp.

**Entregas**

- tabela `conversation_sessions`
- estados de conversa
- fluxo de envio do imóvel
- menu `1` / `2`
- tratamento de mensagens inválidas
- reinício controlado de sessão

**DoD**

- cliente percorre o fluxo sem quebrar o contexto

---

### Sprint 8 — Lead Capture

**Objetivo**
Capturar leads e notificar o corretor.

**Entregas**

- tabelas `leads` e `lead_interactions`
- função `create_lead_from_visit_interest()`
- Edge Function `lead-notify-broker`
- idempotência de geração de lead

**DoD**

- ação de agendar gera lead e notifica o corretor

---

### Sprint 9 — Recommendation Engine

**Objetivo**
Implementar o diferencial de negócio.

**Entregas**

- função `recommend_similar_properties()`
- tabela `recommendation_events`
- retorno em lotes de até 5 imóveis
- regra FREE vs PRO
- integração com WhatsApp

**DoD**

- recomendações respeitam as regras comerciais

---

### Sprint 10 — Billing

**Objetivo**
Ativar monetização real.

**Entregas**

- integração Stripe
- integração Mercado Pago
- Edge Functions de webhook
- tabela `subscriptions` com ciclo de atualização
- área de planos no frontend
- upgrade/downgrade

**DoD**

- usuário vira PRO por pagamento confirmado

---

### Sprint 11 — Expiration Engine

**Objetivo**
Fechar o ciclo do plano FREE.

**Entregas**

- função `expire_free_properties()`
- Cron `expire-free-properties-job`
- atualização automática de imóveis vencidos
- integração com QR resolve

**DoD**

- anúncio FREE expira automaticamente no prazo correto

---

### Sprint 12 — Observability + Hardening

**Objetivo**
Preparar produção.

**Entregas**

- logs estruturados
- alertas operacionais
- dashboards
- rate limiting
- revisão de RLS
- revisão de storage policies
- revisão de idempotência
- testes finais E2E

**DoD**

- sistema monitorável, previsível e pronto para beta fechado

---

## 25. Agentes de Execução Especializados

### 25.1 Auth Agent

Responsável por:

- Supabase Auth
- onboarding
- sessões
- RBAC / vínculo com domínio

### 25.2 Database & RLS Agent

Responsável por:

- schema SQL
- migrations
- functions
- triggers
- índices
- policies

### 25.3 Property Agent

Responsável por:

- CRUD dos imóveis
- validação de plano
- estado do anúncio

### 25.4 Media Agent

Responsável por:

- upload
- compressão
- variantes
- Storage

### 25.5 QR Agent

Responsável por:

- tokens
- geração visual
- resolução pública

### 25.6 Partner Agent

Responsável por:

- portal parceiro
- consulta
- impressão
- auditoria de print

### 25.7 WhatsApp Gateway Agent

Responsável por:

- provider layer
- Uazapi
- retries
- throttling
- webhooks

### 25.8 Conversation Agent

Responsável por:

- state machine do WhatsApp
- menus
- fallback
- contexto

### 25.9 Recommendation Agent

Responsável por:

- motor de similares
- score
- filtros
- regras FREE vs PRO

### 25.10 Lead Agent

Responsável por:

- criação de leads
- interações
- notificação do corretor

### 25.11 Billing Agent

Responsável por:

- Stripe
- Mercado Pago
- reconciliação de plano
- webhooks

### 25.12 Expiration Agent

Responsável por:

- contagem pós-impressão
- cron de expiração
- consistência temporal

### 25.13 Frontend UI Agent

Responsável por:

- dashboard
- forms
- área de planos
- portal parceiro
- UX operacional

### 25.14 DevOps / Platform Agent

Responsável por:

- ambientes
- CI/CD
- secrets
- deploy de Edge Functions
- backups
- observabilidade

### 25.15 QA Agent

Responsável por:

- testes de migrations
- testes de funções SQL
- testes de RLS
- testes E2E dos fluxos críticos

---

## 26. Testes Obrigatórios

### Banco

- migrations sobem do zero
- rollback viável quando aplicável
- funções SQL testadas
- índices presentes

### RLS

- usuário A não acessa dados do usuário B
- parceiro não acessa recursos fora do fluxo permitido

### Storage

- upload autorizado só em pasta própria
- leitura indevida bloqueada

### Billing

- webhook duplicado não duplica efeito
- upgrade só após validação

### WhatsApp

- inbound cria contexto
- outbound respeita fila
- falha parcial não quebra todo o fluxo

### Expiração

- primeira impressão FREE ativa validade
- reimpressão não renova
- job expira corretamente

---

## 27. Prompt Mestre para outra IA construir o sistema

Use o texto abaixo exatamente como prompt inicial:

```text
Você é um arquiteto e engenheiro sênior responsável por implementar este sistema exatamente como especificado neste SDD.

Regras:
1. O backend oficial é Supabase.
2. Use Supabase Auth, Postgres, RLS, Storage, Edge Functions, Cron e Queues.
3. Não troque a arquitetura.
4. Não remova regras de negócio.
5. Gere a implementação em ordem de sprint.
6. Sempre entregue código completo, migrations completas, policies completas e testes.
7. Não substitua RLS por checagens apenas no frontend.
8. Não use Firebase.
9. Não use backend Node separado como core do sistema.
10. Toda integração externa deve passar por Edge Functions.
11. O banco é o source of truth.
12. Sempre respeite as regras FREE vs PRO.
13. Reimpressão de FREE não renova expiração.
14. Imóvel FREE expira 30 dias após primeira impressão.
15. Imóvel PRO fica ativo até remoção manual.
16. O provider atual de WhatsApp é Uazapi, mas deve ficar isolado atrás de adapter.
17. Billing deve suportar Stripe e Mercado Pago.
18. Entregue por sprints, começando pelo Sprint 0.

Agora implemente o Sprint 0 completo com código, migrations, estrutura de pastas, variáveis de ambiente, policies e instruções de execução.
```

---

## 28. Conclusão

Este documento define:

- produto
- regras de negócio
- arquitetura técnica
- modelagem de dados
- estratégia de segurança
- estratégia de storage
- Edge Functions
- filas e cron
- sprints completos
- agentes especializados
- prompt mestre para implementação por outra IA

Este é o blueprint oficial do projeto.
