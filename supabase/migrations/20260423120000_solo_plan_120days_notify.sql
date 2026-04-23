-- ============================================================
-- 1. Plano SOLO (pago, 120 dias) e atualizar FREE para 120 dias
-- ============================================================

INSERT INTO public.plans (
  code, name, max_active_properties, max_images_per_property,
  has_auto_expiration, expiration_days, recommendation_source
) VALUES
  ('solo', 'Solo', 1, 10, true, 120, 'self')
ON CONFLICT (code) DO UPDATE
  SET name = 'Solo',
      expiration_days = 120,
      has_auto_expiration = true;

UPDATE public.plans
SET expiration_days = 120
WHERE code = 'free';

-- ============================================================
-- 2. Trigger: usar expiration_days do plano (dinâmico)
-- ============================================================

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
  -- Busca validade do plano; padrão 120 dias
  SELECT expiration_days
  INTO v_expiration_days
  FROM public.plans
  WHERE code = new.origin_plan_code;

  v_expiration_days := COALESCE(v_expiration_days, 120);

  -- REGRA 1: Ao publicar/imprimir, seta expires_at se ainda não definido ou inválido
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

  -- REGRA 2: Reativação de anúncio expirado (apenas planos pagos — free exige upgrade)
  IF tg_op = 'UPDATE'
    AND old.listing_status = 'expired'
    AND old.expires_at IS NOT NULL
    AND old.expires_at <= now()
    AND new.origin_plan_code <> 'free'
  THEN
    -- Desativa QR codes antigos
    UPDATE public.property_qrcodes
    SET
      is_active            = false,
      expired_at           = now(),
      invalidation_reason  = 'listing_cycle_restart'
    WHERE property_id = old.id
      AND is_active = true;

    -- Gera novo QR
    SELECT COALESCE(MAX(version), 0) + 1
    INTO v_next_version
    FROM public.property_qrcodes
    WHERE property_id = old.id;

    INSERT INTO public.property_qrcodes (property_id, qr_token, version, is_active, created_at)
    VALUES (old.id, public.generate_qr_token(), v_next_version, true, now());

    new.expires_at     := now() + (v_expiration_days || ' days')::interval;
    new.listing_status := 'published';
  END IF;

  RETURN new;
END;
$$;

-- ============================================================
-- 3. Função: notificar corretores com anúncios próximos de vencer
--    Chame com p_days_ahead = 7 ou 1.
--    Deduplica: não reenvia se já notificou nas últimas 23 horas.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_expiring_properties(p_days_ahead integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
  v_kind   text;
BEGIN
  v_kind := 'expiring_soon_' || p_days_ahead;

  WITH expiring AS (
    SELECT p.id, p.account_id, p.broker_id, p.public_id, p.expires_at
    FROM public.properties p
    WHERE p.listing_status IN ('published', 'printed')
      AND p.expires_at IS NOT NULL
      -- Janela: expira entre (days_ahead - 1) e (days_ahead) dias a partir de agora
      AND p.expires_at >= now() + ((p_days_ahead - 1) || ' days')::interval
      AND p.expires_at <  now() + ( p_days_ahead      || ' days')::interval
                                 + interval '2 hours'
      -- Deduplicação: não enviar se já foi notificado nas últimas 23 h
      AND NOT EXISTS (
        SELECT 1
        FROM public.whatsapp_messages wm
        WHERE wm.property_id = p.id
          AND wm.payload->>'kind' = v_kind
          AND wm.created_at > now() - interval '23 hours'
      )
  ),
  sent AS (
    INSERT INTO public.whatsapp_messages (
      direction, provider, account_id, property_id,
      lead_phone, broker_phone, message_type, status, payload
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
        'kind',        v_kind,
        'property_id', e.id,
        'public_id',   e.public_id,
        'days_ahead',  p_days_ahead,
        'expires_at',  e.expires_at,
        'text',
        CASE p_days_ahead
          WHEN 1 THEN
            'Atenção! Seu anúncio ' || COALESCE(e.public_id, '') ||
            ' vence AMANHÃ. Acesse o painel e renove agora: ' ||
            current_setting('app.base_url', true) || '/plans'
          ELSE
            'Seu anúncio ' || COALESCE(e.public_id, '') ||
            ' vence em ' || p_days_ahead || ' dias. Renove em: ' ||
            current_setting('app.base_url', true) || '/plans'
        END,
        'to_broker',   true
      )
    FROM expiring e
    JOIN public.brokers b ON b.id = e.broker_id
    WHERE b.whatsapp_number IS NOT NULL
    RETURNING id
  )
  SELECT count(*)::integer INTO affected FROM sent;

  RETURN COALESCE(affected, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_expiring_properties(integer) TO service_role;
