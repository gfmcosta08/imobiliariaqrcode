-- Planos com expiração que exigem pagamento para reativar (não podem reativar por edição)
-- free  = cortesia (grátis, exige assinar)
-- solo  = pago com validade, exige renovar pagamento

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

  -- REGRA 2: Reativação via edição — apenas planos sem expiração (pro, premium)
  --          free e solo exigem pagamento; bloqueados aqui.
  IF tg_op = 'UPDATE'
    AND old.listing_status = 'expired'
    AND old.expires_at IS NOT NULL
    AND old.expires_at <= now()
    AND new.origin_plan_code NOT IN ('free', 'solo')
  THEN
    UPDATE public.property_qrcodes
    SET
      is_active           = false,
      expired_at          = now(),
      invalidation_reason = 'listing_cycle_restart'
    WHERE property_id = old.id
      AND is_active = true;

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
