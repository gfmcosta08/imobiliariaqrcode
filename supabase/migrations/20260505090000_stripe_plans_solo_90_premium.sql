-- Ajustes finais de planos para Stripe:
-- - Solo pago por 3 meses (90 dias)
-- - Premium mensal com ate 5 corretores
-- - Limite de corretores explicito em plans

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS max_brokers integer NOT NULL DEFAULT 1;

INSERT INTO public.plans (
  code, name, max_active_properties, max_images_per_property,
  has_auto_expiration, expiration_days, recommendation_source, max_brokers
) VALUES
  ('solo', 'Solo', 1, 10, true, 90, 'self', 1),
  ('premium', 'Premium', 999999, 15, false, null, 'self', 5)
ON CONFLICT (code) DO UPDATE
  SET name = excluded.name,
      max_active_properties = excluded.max_active_properties,
      max_images_per_property = excluded.max_images_per_property,
      has_auto_expiration = excluded.has_auto_expiration,
      expiration_days = excluded.expiration_days,
      recommendation_source = excluded.recommendation_source,
      max_brokers = excluded.max_brokers;

UPDATE public.plans
SET max_brokers = 1
WHERE code IN ('free', 'pro')
  AND max_brokers IS DISTINCT FROM 1;
