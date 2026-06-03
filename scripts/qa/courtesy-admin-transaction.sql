begin;

do $$
declare
  v_admin_id uuid;
  v_broker_id uuid;
  v_account_id uuid;
  v_invitation_id uuid;
  v_oldest_id uuid;
  v_middle_id uuid;
  v_newest_id uuid;
  v_result jsonb;
  v_archived_ids uuid[];
begin
  if to_regprocedure(
    'public.admin_update_courtesy(uuid,uuid,integer,timestamp with time zone,text)'
  ) is null then
    raise exception 'admin_update_courtesy rpc missing';
  end if;

  select id into strict v_admin_id
  from public.profiles
  where role = 'admin'
  limit 1;

  select id, account_id into strict v_broker_id, v_account_id
  from public.brokers
  order by created_at
  limit 1;

  update public.subscriptions
  set
    max_active_properties_override = 99,
    current_period_end = now() + interval '30 days',
    status = 'free'
  where account_id = v_account_id;

  insert into public.properties (
    account_id, broker_id, origin_plan_code, listing_status,
    property_type, property_subtype, purpose, title, city, state, created_at
  )
  values (
    v_account_id, v_broker_id, 'free', 'draft',
    'Residencial', 'Apartamento', 'sale', 'QA cortesia antigo', 'QA', 'QA',
    now() - interval '3 minutes'
  )
  returning id into v_oldest_id;

  insert into public.properties (
    account_id, broker_id, origin_plan_code, listing_status,
    property_type, property_subtype, purpose, title, city, state, created_at
  )
  values (
    v_account_id, v_broker_id, 'free', 'draft',
    'Residencial', 'Apartamento', 'sale', 'QA cortesia intermediario', 'QA', 'QA',
    now() - interval '2 minutes'
  )
  returning id into v_middle_id;

  insert into public.properties (
    account_id, broker_id, origin_plan_code, listing_status,
    property_type, property_subtype, purpose, title, city, state, created_at
  )
  values (
    v_account_id, v_broker_id, 'free', 'draft',
    'Residencial', 'Apartamento', 'sale', 'QA cortesia recente', 'QA', 'QA',
    now() - interval '1 minute'
  )
  returning id into v_newest_id;

  insert into public.broker_invitations (
    login_code,
    access_code_hash,
    temp_email,
    property_id,
    property_ids,
    property_count,
    expiration_days_configured,
    courtesy_expires_at,
    status
  )
  values (
    '999991',
    repeat('a', 64),
    'qa-courtesy-rollback@opencode.internal',
    v_oldest_id,
    array[v_oldest_id, v_middle_id, v_newest_id],
    3,
    30,
    now() + interval '30 days',
    'pending'
  )
  returning id into v_invitation_id;

  v_result := public.admin_update_courtesy(
    v_admin_id,
    v_invitation_id,
    2,
    now() + interval '15 days',
    'qa reduce courtesy'
  );

  select archived_property_ids into strict v_archived_ids
  from public.courtesy_admin_audit_events
  where invitation_id = v_invitation_id
  order by created_at desc
  limit 1;

  if v_archived_ids <> array[v_oldest_id] then
    raise exception 'reduction did not archive only the oldest property: %', v_result;
  end if;

  if exists (
    select 1 from public.property_qrcodes
    where property_id = v_oldest_id and is_active
  ) then
    raise exception 'oldest property QR Code remains active';
  end if;

  if exists (
    select 1 from public.properties
    where id in (v_middle_id, v_newest_id) and listing_status = 'removed'
  ) then
    raise exception 'recent properties were archived';
  end if;

  perform public.admin_update_courtesy(
    v_admin_id,
    v_invitation_id,
    2,
    now() - interval '1 minute',
    'qa expire courtesy'
  );

  if exists (
    select 1 from public.properties
    where id in (v_middle_id, v_newest_id) and listing_status <> 'removed'
  ) then
    raise exception 'expired courtesy did not archive all remaining properties';
  end if;

  if (select status from public.broker_invitations where id = v_invitation_id) <> 'expired' then
    raise exception 'expired courtesy did not update invitation status';
  end if;

  if (select count(*) from public.courtesy_admin_audit_events where invitation_id = v_invitation_id) <> 2 then
    raise exception 'courtesy audit event count mismatch';
  end if;
end;
$$;

rollback;
