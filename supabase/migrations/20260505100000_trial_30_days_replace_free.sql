-- Trial de 30 dias como substituto funcional do plano free.
-- Mantem compatibilidade tecnica com registros legados de free, mas o produto passa a usar trial.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_used_at timestamptz;

INSERT INTO public.plans (
  code, name, max_active_properties, max_images_per_property,
  has_auto_expiration, expiration_days, recommendation_source
)
VALUES
  ('trial', 'Trial', 1, 10, true, 30, 'self')
ON CONFLICT (code) DO UPDATE
  SET name = 'Trial',
      max_active_properties = 1,
      max_images_per_property = 10,
      has_auto_expiration = true,
      expiration_days = 30,
      recommendation_source = 'self';

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check CHECK (status IN (
    'free',
    'trial_active',
    'solo_active',
    'pro_pending_activation',
    'pro_active',
    'past_due',
    'canceled',
    'expired'
  ));

UPDATE public.subscriptions
SET
  plan_code = 'trial',
  status = 'trial_active',
  current_period_start = COALESCE(current_period_start, created_at, now()),
  current_period_end = COALESCE(current_period_end, created_at + interval '30 days', now() + interval '30 days'),
  updated_at = now()
WHERE plan_code = 'free'
  OR status = 'free';

UPDATE public.properties
SET origin_plan_code = 'trial'
WHERE origin_plan_code = 'free';

UPDATE public.accounts a
SET
  trial_started_at = COALESCE(a.trial_started_at, s.current_period_start, s.created_at, now()),
  trial_used_at = COALESCE(a.trial_used_at, s.current_period_start, s.created_at, now())
FROM public.subscriptions s
WHERE s.account_id = a.id
  AND s.plan_code = 'trial';

CREATE OR REPLACE FUNCTION public.get_active_plan_code(p_account_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN s.status = 'trial_active' AND s.plan_code = 'trial' THEN 'trial'
    WHEN s.status = 'solo_active' AND s.plan_code = 'solo' THEN 'solo'
    WHEN s.status = 'pro_active' AND s.plan_code IN ('pro', 'premium') THEN s.plan_code
    WHEN s.status = 'free' THEN 'trial'
    ELSE NULL
  END
  FROM public.subscriptions s
  WHERE s.account_id = p_account_id;
$$;

CREATE OR REPLACE FUNCTION public.can_create_property(p_account_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  plan_code text;
  max_props integer;
  current_count integer;
BEGIN
  plan_code := public.get_active_plan_code(p_account_id);
  IF plan_code IS NULL THEN
    RETURN false;
  END IF;

  SELECT pl.max_active_properties
  INTO max_props
  FROM public.plans pl
  WHERE pl.code = plan_code;

  IF max_props IS NULL THEN
    RETURN false;
  END IF;

  current_count := public.properties_active_count(p_account_id);
  RETURN current_count < max_props;
END;
$$;

CREATE OR REPLACE FUNCTION public.before_property_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  plan_code text;
  bid uuid;
  aid uuid;
  max_props integer;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT b.id, b.account_id INTO bid, aid
    FROM public.brokers b
    JOIN public.profiles p ON p.account_id = b.account_id
    WHERE p.id = auth.uid();

    IF bid IS NULL THEN
      RAISE EXCEPTION 'Corretor nao encontrado para o usuario atual';
    END IF;

    new.broker_id := bid;
    new.account_id := aid;
  ELSE
    IF new.account_id IS NULL OR new.broker_id IS NULL THEN
      RAISE EXCEPTION 'account_id e broker_id sao obrigatorios para insert sem sessao';
    END IF;
    SELECT b.account_id INTO aid FROM public.brokers b WHERE b.id = new.broker_id;
    IF aid IS NULL OR aid <> new.account_id THEN
      RAISE EXCEPTION 'broker_id e account_id inconsistentes';
    END IF;
  END IF;

  plan_code := public.get_active_plan_code(new.account_id);
  IF plan_code IS NULL THEN
    RAISE EXCEPTION 'Escolha um plano antes de cadastrar imoveis.';
  END IF;

  IF NOT public.can_create_property(new.account_id) THEN
    SELECT pl.max_active_properties INTO max_props FROM public.plans pl WHERE pl.code = plan_code;
    RAISE EXCEPTION 'Seu plano atual permite apenas % imovel(is) ativo(s).', max_props;
  END IF;

  new.origin_plan_code := plan_code;

  IF new.public_id IS NULL OR new.public_id = '' THEN
    new.public_id := public.generate_public_property_id();
  END IF;

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_account_id uuid;
  meta jsonb := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
  v_full_name text := NULLIF(TRIM(meta ->> 'full_name'), '');
  v_whatsapp text := NULLIF(TRIM(meta ->> 'whatsapp_number'), '');
BEGIN
  IF v_full_name IS NULL THEN
    v_full_name := split_part(COALESCE(new.email, 'usuario'), '@', 1);
  END IF;
  IF v_whatsapp IS NULL THEN
    v_whatsapp := 'pending-' || replace(new.id::text, '-', '');
  END IF;

  INSERT INTO public.accounts DEFAULT VALUES
  RETURNING id INTO new_account_id;

  INSERT INTO public.profiles (id, account_id, email, full_name, whatsapp_number, role)
  VALUES (new.id, new_account_id, new.email, v_full_name, v_whatsapp, 'broker');

  INSERT INTO public.brokers (account_id, profile_id, display_name, whatsapp_number)
  VALUES (new_account_id, new.id, v_full_name, v_whatsapp);

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_free_properties()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  WITH expired AS (
    UPDATE public.properties p
    SET
      listing_status = 'expired',
      updated_at = now()
    WHERE p.expires_at IS NOT NULL
      AND p.expires_at < now()
      AND p.listing_status IN ('published', 'printed')
    RETURNING p.id, p.account_id, p.broker_id, p.public_id
  ),
  deactivate_qr AS (
    UPDATE public.property_qrcodes q
    SET
      is_active = false,
      expired_at = now(),
      invalidation_reason = 'listing_expired'
    FROM expired e
    WHERE q.property_id = e.id
      AND q.is_active = true
    RETURNING q.property_id
  ),
  notify AS (
    INSERT INTO public.whatsapp_messages (
      direction,
      provider,
      account_id,
      property_id,
      lead_phone,
      broker_phone,
      message_type,
      status,
      payload
    )
    SELECT
      'outbound',
      'uazapi',
      e.account_id,
      e.id,
      NULL,
      b.whatsapp_number,
      'text',
      'queued',
      jsonb_build_object(
        'kind', 'qr_expired',
        'property_id', e.id,
        'public_id', e.public_id,
        'text', 'O anuncio ' || COALESCE(e.public_id, 'sem referencia') || ' expirou. Acesse o painel e escolha um plano para renovar.',
        'to_broker', true
      )
    FROM expired e
    JOIN public.brokers b ON b.id = e.broker_id
    WHERE b.whatsapp_number IS NOT NULL
    RETURNING id
  )
  SELECT count(*)::integer INTO affected
  FROM expired;

  RETURN COALESCE(affected, 0);
END;
$$;
