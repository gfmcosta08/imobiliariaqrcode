-- Pro/Premium listings must not have countdown/expiration.
-- The current subscription may be upgraded after an invitation generated the first property,
-- so lifecycle rules must respect non-expiring plans every time a property is saved/published.

create or replace function public.before_property_lifecycle_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_version integer;
  v_expiration_days integer;
  v_has_auto_expiration boolean;
begin
  select expiration_days, has_auto_expiration
  into v_expiration_days, v_has_auto_expiration
  from public.plans
  where code = new.origin_plan_code;

  if new.origin_plan_code in ('pro', 'premium')
    or coalesce(v_has_auto_expiration, false) = false
    or v_expiration_days is null
  then
    new.expires_at := null;
  elsif new.listing_status in ('published', 'printed')
    and (
      new.expires_at is null
      or (
        tg_op = 'UPDATE'
        and old.listing_status not in ('published', 'printed')
        and new.expires_at <= now()
      )
    ) then
    new.expires_at := now() + (v_expiration_days || ' days')::interval;
  end if;

  -- Quando salvar um anúncio já expirado: apenas planos sem expiração podem reativar
  -- por edição. Free/Solo continuam exigindo renovação/ação comercial.
  if tg_op = 'UPDATE'
    and old.listing_status = 'expired'
    and old.expires_at is not null
    and old.expires_at <= now()
    and (
      new.origin_plan_code in ('pro', 'premium')
      or coalesce(v_has_auto_expiration, false) = false
      or v_expiration_days is null
    )
  then
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

    new.expires_at := null;
    new.listing_status := 'published';
  end if;

  return new;
end;
$$;
update public.properties p
set
  origin_plan_code = s.plan_code,
  expires_at = null,
  updated_at = now()
from public.subscriptions s
where s.account_id = p.account_id
  and s.plan_code in ('pro', 'premium')
  and s.status = 'pro_active'
  and (
    p.origin_plan_code is distinct from s.plan_code
    or p.expires_at is not null
  );
