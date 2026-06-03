begin;

insert into public.plans (
  code,
  name,
  max_active_properties,
  max_images_per_property,
  has_auto_expiration,
  expiration_days,
  recommendation_source
)
values ('starter', 'STARTER', 999999, 15, false, null, 'self')
on conflict (code) do update set
  name = excluded.name,
  max_active_properties = excluded.max_active_properties,
  max_images_per_property = excluded.max_images_per_property,
  has_auto_expiration = excluded.has_auto_expiration,
  expiration_days = excluded.expiration_days,
  recommendation_source = excluded.recommendation_source;

update public.plans
set
  max_active_properties = 1,
  has_auto_expiration = true,
  expiration_days = 30
where code = 'free';

alter table public.broker_invitations
  add column if not exists courtesy_expires_at timestamptz;

update public.broker_invitations
set courtesy_expires_at = coalesce(
  courtesy_expires_at,
  expires_at,
  generated_at + (expiration_days_configured || ' days')::interval
);

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

create or replace function public.get_active_plan_code(p_account_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when s.status = 'starter_active' and s.plan_code = 'starter' then 'starter'
    when s.status = 'pro_active' and s.plan_code = 'premium' then 'premium'
    when s.status = 'pro_active' and s.plan_code = 'pro' then 'pro'
    when s.status = 'solo_active' and s.plan_code = 'solo' then 'solo'
    else 'free'
  end
  from public.subscriptions s
  where s.account_id = p_account_id;
$$;

insert into public.plan_display_config (
  plan_code,
  display_name,
  display_price,
  display_suffix,
  display_note,
  display_description,
  display_label,
  display_featured,
  features
)
values
  (
    'free',
    'Free',
    'R$ 0',
    ' por 30 dias',
    'Sem cobranca automatica',
    'Avaliacao gratuita por 30 dias com 1 anuncio ativo. Apos o periodo, assine o Starter.',
    'Comecar gratis',
    false,
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
    'Anuncios ilimitados com QR Code, leads, bot WhatsApp e integracao completa. Cancele quando quiser.',
    'Assinar Starter',
    true,
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
  display_description = excluded.display_description,
  display_label = excluded.display_label,
  display_featured = excluded.display_featured,
  features = excluded.features;

commit;
