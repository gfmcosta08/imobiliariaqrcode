-- Migration: plan_display_config + broker_invitations columns
-- PRD: Expansão do Painel Admin (2026-05-09)

-- ============================================================
-- 1. plan_display_config
--    Armazena o conteúdo de exibição editável de cada plano.
--    A página /plans passa a ler desta tabela em vez do código.
-- ============================================================

create table if not exists public.plan_display_config (
  plan_code        text primary key references public.plans(code) on delete cascade,
  display_name     text not null,
  display_price    text not null,
  display_suffix   text not null default '',
  display_note     text not null default '',
  display_label    text not null,
  display_featured boolean not null default false,
  features         text[] not null default '{}',
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles(id) on delete set null
);

alter table public.plan_display_config enable row level security;

-- Leitura pública (página /plans é acessível sem login)
create policy "public_read_plan_display_config"
  on public.plan_display_config for select
  using (true);

-- Escrita somente por admin (via service role nas API routes)
-- As API routes usam createServiceRoleClient, então RLS não bloqueia.
-- Esta policy é para segurança adicional via client anon.
create policy "admin_write_plan_display_config"
  on public.plan_display_config for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Seed: valores atuais hardcoded de apps/web/src/app/plans/page.tsx
-- Garante que a página /plans funcione imediatamente após a migration.
insert into public.plan_display_config
  (plan_code, display_name, display_price, display_suffix, display_note, display_label, display_featured, features)
values
  (
    'trial',
    'Teste',
    'R$ 0',
    ' por 30 dias',
    'Sem cobrança Stripe',
    'Começar teste',
    false,
    array['1 anuncio ativo', '1 placa QR Code inclusa', 'Bot WhatsApp automatico', 'Captura de leads']
  ),
  (
    'solo',
    'Solo',
    'R$ 150',
    ' trimestral',
    'Validade: 3 meses',
    'Contratar Solo',
    false,
    array['1 anuncio ativo', '1 placa QR Code inclusa', 'Bot WhatsApp automatico', 'Captura de leads']
  ),
  (
    'pro',
    'Pro',
    'R$ 500',
    '/mes',
    'Renovacao mensal automatica',
    'Assinar Pro',
    true,
    array['Multiplos imoveis', 'Kit inicial: 10 placas QR Code', 'Bot WhatsApp + leads ilimitados']
  ),
  (
    'premium',
    'Premium',
    'R$ 2.000',
    '/mes',
    'Renovacao mensal automatica',
    'Assinar Premium',
    false,
    array['Multiplos imoveis', '5 corretores', 'Kit inicial: 20 placas QR Code', 'Bot WhatsApp + leads ilimitados']
  )
on conflict (plan_code) do nothing;

-- ============================================================
-- 2. broker_invitations — novas colunas para configuração
-- ============================================================

alter table public.broker_invitations
  add column if not exists property_count integer not null default 1,
  add column if not exists property_ids uuid[] not null default '{}',
  add column if not exists expiration_days_configured integer not null default 180;

-- ============================================================
-- 3. Índice útil para listagem admin de broker_invitations
-- ============================================================

create index if not exists idx_broker_invitations_status
  on public.broker_invitations (status, generated_at desc);
