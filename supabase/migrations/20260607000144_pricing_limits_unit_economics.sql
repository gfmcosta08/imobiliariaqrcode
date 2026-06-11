-- Pricing guardrails for investable staging readiness.
-- Removes "unlimited" Starter promises and keeps variable-cost features inside explicit pilot limits.

begin;

update public.plans
set
  name = 'STARTER',
  max_active_properties = 10,
  max_images_per_property = 10,
  has_auto_expiration = false,
  expiration_days = null,
  recommendation_source = 'self'
where code = 'starter';

update public.plans
set
  max_active_properties = 1,
  max_images_per_property = 10,
  has_auto_expiration = true,
  expiration_days = 30
where code = 'free';

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
    'Teste gratuito com 1 anuncio ativo, 10 imagens e QR para validar o fluxo antes de assinar.',
    'Comecar gratis',
    false,
    array[
      '1 anuncio ativo',
      '10 imagens no anuncio',
      'QR Code e formulario de lead',
      'Sem renovacao automatica'
    ]
  ),
  (
    'starter',
    'Starter',
    'R$ 150',
    '/mes',
    'Corretor solo',
    'Plano mensal para corretor solo: ate 10 anuncios ativos, QR por anuncio, captura de leads e painel de oportunidades. Importacao assistida em piloto controlado.',
    'Assinar Starter',
    true,
    array[
      'Ate 10 anuncios ativos',
      '10 imagens por anuncio',
      'QR Code por anuncio ativo',
      'Captura de leads e painel',
      'Ate 3 importacoes assistidas por mes no piloto',
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

delete from public.plan_display_config
where plan_code not in ('free', 'starter');

commit;
