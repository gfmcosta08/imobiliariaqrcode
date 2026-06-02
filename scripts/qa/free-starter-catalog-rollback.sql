begin;

do $$
declare
  v_free public.plans%rowtype;
  v_starter public.plans%rowtype;
begin
  select * into strict v_free from public.plans where code = 'free';
  if v_free.max_active_properties <> 1 or v_free.expiration_days <> 30 then
    raise exception 'free plan mismatch';
  end if;

  select * into strict v_starter from public.plans where code = 'starter';
  if v_starter.max_active_properties < 999999 or v_starter.has_auto_expiration then
    raise exception 'starter plan mismatch';
  end if;

  perform max_active_properties_override from public.subscriptions limit 1;
  perform courtesy_expires_at from public.broker_invitations limit 1;
end;
$$;

rollback;
