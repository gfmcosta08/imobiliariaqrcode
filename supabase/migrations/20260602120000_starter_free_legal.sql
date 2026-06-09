-- Homologação: catálogo Free + Starter, cortesia com limite customizado, documentos legais.

-- ============================================================
-- 1. Plano Starter (substitui Solo) + Free 30 dias
-- ============================================================

insert into public.plans (
  code, name, max_active_properties, max_images_per_property,
  has_auto_expiration, expiration_days, recommendation_source
)
values
  ('starter', 'STARTER', 999999, 15, false, null, 'self')
on conflict (code) do update set
  name = excluded.name,
  max_active_properties = excluded.max_active_properties,
  max_images_per_property = excluded.max_images_per_property,
  has_auto_expiration = excluded.has_auto_expiration,
  expiration_days = excluded.expiration_days,
  recommendation_source = excluded.recommendation_source;

update public.plans
set expiration_days = 30,
    has_auto_expiration = true,
    max_active_properties = 1
where code = 'free';

update public.subscriptions
set plan_code = 'starter',
    status = 'starter_active'
where plan_code = 'solo' or status = 'solo_active';

update public.properties
set origin_plan_code = 'starter'
where origin_plan_code = 'solo';

delete from public.plan_display_config
where plan_code not in ('free', 'starter');

delete from public.plans
where code = 'solo';

-- ============================================================
-- 2. Cortesia: limite de imóveis configurável pelo admin
-- ============================================================

alter table public.subscriptions
  add column if not exists property_limit_override integer;

alter table public.subscriptions
  drop constraint if exists subscriptions_property_limit_override_check;

alter table public.subscriptions
  add constraint subscriptions_property_limit_override_check
  check (property_limit_override is null or property_limit_override >= 1);

-- ============================================================
-- 3. Status de assinatura (starter_active)
-- ============================================================

alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check check (status in (
    'free',
    'trial_active',
    'solo_active',
    'starter_active',
    'pro_pending_activation',
    'pro_active',
    'past_due',
    'canceled',
    'expired'
  ));

-- ============================================================
-- 4. Funções de plano e limite
-- ============================================================

create or replace function public.account_property_limit(p_account_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_override integer;
  v_plan_code text;
  v_max integer;
begin
  select s.property_limit_override
  into v_override
  from public.subscriptions s
  where s.account_id = p_account_id;

  if v_override is not null then
    return v_override;
  end if;

  v_plan_code := public.get_active_plan_code(p_account_id);
  select pl.max_active_properties
  into v_max
  from public.plans pl
  where pl.code = v_plan_code;

  return coalesce(v_max, 1);
end;
$$;

create or replace function public.get_active_plan_code(p_account_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when s.status in ('starter_active', 'pro_active')
      and s.plan_code in ('starter', 'pro') then s.plan_code
  else 'free'
  end
  from public.subscriptions s
  where s.account_id = p_account_id;
$$;

create or replace function public.can_create_property(p_account_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  max_props integer;
  current_count integer;
begin
  max_props := public.account_property_limit(p_account_id);
  current_count := public.properties_active_count(p_account_id);
  return current_count < max_props;
end;
$$;

grant execute on function public.account_property_limit(uuid) to authenticated, service_role;
grant execute on function public.get_active_plan_code(uuid) to authenticated, service_role;
grant execute on function public.can_create_property(uuid) to authenticated, service_role;

-- ============================================================
-- 5. Ciclo de vida: free exige assinatura; starter pode reativar
-- ============================================================

create or replace function public.before_property_lifecycle_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_version integer;
  v_expiration_days integer;
  v_invitation_days integer;
begin
  select expiration_days
  into v_expiration_days
  from public.plans
  where code = new.origin_plan_code;

  v_expiration_days := coalesce(v_expiration_days, 30);

  if new.listing_status in ('published', 'printed')
    and (
      new.expires_at is null
      or (
        tg_op = 'UPDATE'
        and old.listing_status not in ('published', 'printed')
        and new.expires_at <= now()
      )
    ) then
    select bi.expiration_days_configured
    into v_invitation_days
    from public.broker_invitations bi
    where new.id = any (bi.property_ids)
       or bi.property_id = new.id
    order by bi.generated_at desc nulls last
    limit 1;

    if v_invitation_days is not null and v_invitation_days > 0 then
      new.expires_at := now() + (v_invitation_days || ' days')::interval;
    else
      new.expires_at := now() + (v_expiration_days || ' days')::interval;
    end if;
  end if;

  if tg_op = 'UPDATE'
    and old.listing_status = 'expired'
    and old.expires_at is not null
    and old.expires_at <= now()
    and new.origin_plan_code not in ('free') then
    update public.property_qrcodes
    set
      is_active = false,
      expired_at = now(),
      invalidation_reason = 'listing_cycle_restart'
    where property_id = old.id
      and is_active = true;

    select coalesce(max(version), 0) + 1
    into v_next_version
    from public.property_qrcodes
    where property_id = old.id;

    insert into public.property_qrcodes (property_id, qr_token, version, is_active, created_at)
    values (old.id, public.generate_qr_token(), v_next_version, true, now());

    new.expires_at := now() + (coalesce(v_expiration_days, 30) || ' days')::interval;
    new.listing_status := 'published';
  end if;

  return new;
end;
$$;

create or replace function public.fn_set_property_published_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer;
begin
  if new.listing_status = 'published' and (old.listing_status is distinct from 'published') then
    new.published_at := now();

    select bi.expiration_days_configured
    into v_days
    from public.broker_invitations bi
    where new.id = any (bi.property_ids)
       or bi.property_id = new.id
    order by bi.generated_at desc nulls last
    limit 1;

    if v_days is not null and v_days > 0 then
      new.expires_at := now() + (v_days || ' days')::interval;
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================
-- 6. Exibição pública: apenas Free e Starter
-- ============================================================

insert into public.plan_display_config (
  plan_code, display_name, display_price, display_suffix, display_note,
  display_label, display_featured, display_description, features
)
values
  (
    'free',
    'Free',
    'R$ 0',
    ' por 30 dias',
    'Avaliacao sem cobranca automatica',
    'Comecar gratis',
    false,
    'Teste gratuito por 30 dias com 1 anuncio ativo. Apos o periodo, assine o Starter para continuar.',
    array[
      '1 anuncio ativo',
      'QR Code e captura de leads',
      'Bot WhatsApp automatico',
      'Sem renovacao automatica'
    ]
  ),
  (
    'starter',
    'Starter',
    'R$ 150',
    '/mes',
    'Renovacao mensal automatica',
    'Assinar Starter',
    true,
    'Anuncios ilimitados com QR Code, leads, bot WhatsApp e integracao completa. Cancele quando quiser.',
    array[
      'Anuncios ilimitados',
      'QR Codes',
      'Captura de leads',
      'Bot WhatsApp',
      'Cancelamento simples'
    ]
  )
on conflict (plan_code) do update set
  display_name = excluded.display_name,
  display_price = excluded.display_price,
  display_suffix = excluded.display_suffix,
  display_note = excluded.display_note,
  display_label = excluded.display_label,
  display_featured = excluded.display_featured,
  display_description = excluded.display_description,
  features = excluded.features;

-- ============================================================
-- 7. Documentos legais versionados
-- ============================================================

create table if not exists public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('terms', 'privacy', 'refund_cancellation')),
  version text not null,
  title text not null,
  content_md text not null,
  published_at timestamptz not null default now(),
  unique (document_type, version)
);

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  document_type text not null,
  document_version text not null,
  context text not null check (context in ('signup', 'checkout')),
  accepted_at timestamptz not null default now()
);

create index if not exists idx_legal_acceptances_profile
  on public.legal_acceptances (profile_id, accepted_at desc);

alter table public.legal_document_versions enable row level security;
alter table public.legal_acceptances enable row level security;

create policy "legal_docs_public_read"
  on public.legal_document_versions
  for select
  using (true);

create policy "legal_acceptances_own_insert"
  on public.legal_acceptances
  for insert
  with check (
    profile_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.account_id = legal_acceptances.account_id
    )
  );

create policy "legal_acceptances_own_read"
  on public.legal_acceptances
  for select
  using (profile_id = auth.uid());

insert into public.legal_document_versions (document_type, version, title, content_md)
values
  (
    'terms',
    '2026-06-02',
    'Termos de Uso',
    E'# Termos de Uso\n\nVersao 2026-06-02. Ao usar o ImobQR voce concorda com as regras de uso da plataforma, publicacao de anuncios e responsabilidade pelos dados informados.\n\n## Plano Free\n\nAvaliacao gratuita por 30 dias com limite de 1 anuncio ativo, sem cobranca automatica.\n\n## Plano Starter\n\nAssinatura mensal de R$ 150,00 com renovacao automatica ate cancelamento.\n\n## Contato\n\nAtendimento eletronico: suporte@imoveisqr.com.br'
  ),
  (
    'privacy',
    '2026-06-02',
    'Politica de Privacidade',
    E'# Politica de Privacidade\n\nVersao 2026-06-02. Tratamos dados de cadastro, anuncios e leads conforme a LGPD. Nao vendemos dados pessoais.\n\n## Dados coletados\n\nNome, e-mail, WhatsApp, dados de imoveis e interacoes com QR Code.\n\n## Contato do encarregado\n\nprivacidade@imoveisqr.com.br'
  ),
  (
    'refund_cancellation',
    '2026-06-02',
    'Cancelamento e Reembolso',
    E'# Cancelamento e Reembolso\n\nVersao 2026-06-02.\n\n## Assinatura Starter\n\nVoce pode cancelar a renovacao automatica a qualquer momento pelo portal de assinatura. O acesso permanece ate o fim do periodo ja pago.\n\n## Reembolso\n\nPagamentos ja processados seguem politica da operadora de pagamento (Stripe) e legislacao aplicavel.\n\n## Contato\n\nsuporte@imoveisqr.com.br'
  )
on conflict (document_type, version) do nothing;
