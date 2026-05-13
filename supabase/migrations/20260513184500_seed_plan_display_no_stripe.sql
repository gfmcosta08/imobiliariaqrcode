-- Seed idempotente para modo temporario sem Stripe.
-- Garante que o admin tenha configuracoes de exibicao para free/solo/pro.

with seed(
  plan_code,
  display_name,
  display_price,
  display_suffix,
  display_note,
  display_description,
  display_label,
  display_featured,
  features
) as (
  values
    (
      'free',
      'Free',
      'R$ 0',
      ' sem recorrencia',
      'Plano legado ativo',
      'Plano de entrada para manter 1 anuncio ativo.',
      'Checkout indisponivel',
      false,
      array['1 anuncio ativo', '1 placa QR Code inclusa', 'Bot WhatsApp automatico', 'Captura de leads']
    ),
    (
      'solo',
      'Solo',
      'R$ 150',
      ' trimestral',
      'Validade: 3 meses',
      'Plano trimestral para manter um anuncio ativo com QR Code e captura de leads.',
      'Checkout indisponivel',
      false,
      array['1 anuncio ativo', '1 placa QR Code inclusa', 'Bot WhatsApp automatico', 'Captura de leads']
    ),
    (
      'pro',
      'Pro',
      'R$ 500',
      '/mes',
      'Renovacao mensal automatica',
      'Plano mensal para operar varios imoveis com leads ilimitados.',
      'Checkout indisponivel',
      true,
      array['Multiplos imoveis', 'Kit inicial: 10 placas QR Code', 'Bot WhatsApp + leads ilimitados']
    )
)
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
select
  seed.plan_code,
  seed.display_name,
  seed.display_price,
  seed.display_suffix,
  seed.display_note,
  seed.display_description,
  seed.display_label,
  seed.display_featured,
  seed.features
from seed
join public.plans p on p.code = seed.plan_code
on conflict (plan_code) do update set
  display_name = plan_display_config.display_name,
  display_price = plan_display_config.display_price,
  display_suffix = plan_display_config.display_suffix,
  display_note = plan_display_config.display_note,
  display_description = plan_display_config.display_description,
  display_label = plan_display_config.display_label,
  display_featured = plan_display_config.display_featured,
  features = plan_display_config.features;
