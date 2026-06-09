-- Ajustes de seguranca para trial: periodo vencido nao conta como plano ativo
-- e imovel trial expirado nao pode ser reativado por simples edicao.

CREATE OR REPLACE FUNCTION public.get_active_plan_code(p_account_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN s.status = 'trial_active'
      AND s.plan_code = 'trial'
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
      THEN 'trial'
    WHEN s.status = 'solo_active'
      AND s.plan_code = 'solo'
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
      THEN 'solo'
    WHEN s.status = 'pro_active'
      AND s.plan_code IN ('pro', 'premium')
      THEN s.plan_code
    WHEN s.status = 'free'
      THEN 'trial'
    ELSE NULL
  END
  FROM public.subscriptions s
  WHERE s.account_id = p_account_id
  LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.before_property_lifecycle_cycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_version    integer;
  v_expiration_days integer;
BEGIN
  SELECT expiration_days
  INTO v_expiration_days
  FROM public.plans
  WHERE code = new.origin_plan_code;

  v_expiration_days := COALESCE(v_expiration_days, 120);

  IF tg_op = 'UPDATE'
    AND auth.uid() IS NOT NULL
    AND old.listing_status = 'expired'
    AND old.expires_at IS NOT NULL
    AND old.expires_at <= now()
    AND new.origin_plan_code IN ('free', 'trial', 'solo')
  THEN
    new.listing_status := 'expired';
    new.expires_at := old.expires_at;
    RETURN new;
  END IF;

  IF new.listing_status IN ('published', 'printed')
    AND (
      new.expires_at IS NULL
      OR (
        tg_op = 'UPDATE'
        AND old.listing_status NOT IN ('published', 'printed')
        AND new.expires_at <= now()
      )
    ) THEN
    new.expires_at := now() + (v_expiration_days || ' days')::interval;
  END IF;

  IF tg_op = 'UPDATE'
    AND old.listing_status = 'expired'
    AND old.expires_at IS NOT NULL
    AND old.expires_at <= now()
    AND (
      new.origin_plan_code NOT IN ('free', 'trial', 'solo')
      OR (auth.uid() IS NULL AND new.origin_plan_code = 'solo')
    )
  THEN
    UPDATE public.property_qrcodes
    SET
      is_active = false,
      expired_at = now(),
      invalidation_reason = 'listing_cycle_restart'
    WHERE property_id = old.id
      AND is_active = true;

    SELECT COALESCE(MAX(version), 0) + 1
    INTO v_next_version
    FROM public.property_qrcodes
    WHERE property_id = old.id;

    INSERT INTO public.property_qrcodes (property_id, qr_token, version, is_active, created_at)
    VALUES (old.id, public.generate_qr_token(), v_next_version, true, now());

    new.expires_at := now() + (v_expiration_days || ' days')::interval;
    new.listing_status := 'published';
  END IF;

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
  UPDATE public.subscriptions s
  SET
    status = 'expired',
    updated_at = now()
  WHERE s.status = 'trial_active'
    AND s.plan_code = 'trial'
    AND s.current_period_end IS NOT NULL
    AND s.current_period_end < now();

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
