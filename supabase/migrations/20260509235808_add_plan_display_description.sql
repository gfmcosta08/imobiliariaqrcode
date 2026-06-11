alter table public.plan_display_config
  add column if not exists display_description text not null default '';
update public.plan_display_config
set
  display_description = case plan_code
    when 'trial' then 'Teste gratuito para validar o atendimento por QR Code e WhatsApp automatico.'
    when 'solo' then 'Plano trimestral para manter um anuncio ativo com QR Code e captura de leads.'
    when 'pro' then 'Plano mensal para operar varios imoveis com leads ilimitados.'
    when 'premium' then 'Plano mensal para equipes com multiplos corretores e roteamento de leads.'
    else display_description
  end,
  features = case
    when plan_code = 'trial' then array_replace(features, '1 placa QR Code inclusa', '1 QR Code ativo por 30 dias')
    else features
  end,
  updated_at = now()
where plan_code in ('trial', 'solo', 'pro', 'premium')
  and display_description = '';
update public.plan_display_config
set
  features = array_replace(features, '1 placa QR Code inclusa', '1 QR Code ativo por 30 dias'),
  updated_at = now()
where plan_code = 'trial'
  and '1 placa QR Code inclusa' = any(features);
