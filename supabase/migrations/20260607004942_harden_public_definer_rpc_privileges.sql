begin;

-- RPCs that run with elevated privileges must not allow a caller to probe a
-- different tenant by passing an arbitrary account_id. The helper stays in the
-- private schema so it is not exposed through PostgREST.
create schema if not exists private;

create or replace function private.assert_rpc_account_scope(p_account_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := nullif(auth.role(), '');
begin
  if p_account_id is null then
    raise exception 'account_id required' using errcode = '22023';
  end if;

  if v_uid is not null then
    if exists (
      select 1
      from public.profiles p
      where p.id = v_uid
        and p.account_id = p_account_id
    ) then
      return;
    end if;

    raise exception 'account scope violation' using errcode = '42501';
  end if;

  if v_role = 'service_role'
    or (v_role is null and current_user in ('postgres', 'supabase_admin'))
  then
    return;
  end if;

  raise exception 'authentication required' using errcode = '28000';
end;
$$;

revoke all on function private.assert_rpc_account_scope(uuid)
  from public, anon, authenticated;
grant execute on function private.assert_rpc_account_scope(uuid)
  to service_role;

create or replace function public.get_active_plan_code(p_account_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_plan_code text;
begin
  perform private.assert_rpc_account_scope(p_account_id);

  select case
    when s.status in ('starter_active', 'pro_active')
      and s.plan_code in ('starter', 'pro') then s.plan_code
    else 'free'
  end
  into v_plan_code
  from public.subscriptions s
  where s.account_id = p_account_id;

  return v_plan_code;
end;
$$;

create or replace function public.account_property_limit(p_account_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_override integer;
  v_plan_code text;
  v_max integer;
begin
  perform private.assert_rpc_account_scope(p_account_id);

  select s.property_limit_override
  into v_override
  from public.subscriptions s
  where s.account_id = p_account_id;

  if v_override is not null then
    return v_override;
  end if;

  v_plan_code := public.get_active_plan_code(p_account_id);
  select pl.max_active_properties
  into v_max
  from public.plans pl
  where pl.code = v_plan_code;

  return coalesce(v_max, 1);
end;
$$;

create or replace function public.can_create_property(p_account_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  max_props integer;
  current_count integer;
begin
  perform private.assert_rpc_account_scope(p_account_id);

  max_props := public.account_property_limit(p_account_id);
  current_count := public.properties_active_count(p_account_id);
  return current_count < max_props;
end;
$$;

revoke execute on function public.get_active_plan_code(uuid)
  from public, anon;
revoke execute on function public.account_property_limit(uuid)
  from public, anon;
revoke execute on function public.can_create_property(uuid)
  from public, anon;
revoke execute on function public.properties_active_count(uuid)
  from public, anon;

grant execute on function public.get_active_plan_code(uuid)
  to authenticated, service_role;
grant execute on function public.account_property_limit(uuid)
  to authenticated, service_role;
grant execute on function public.can_create_property(uuid)
  to authenticated, service_role;
grant execute on function public.properties_active_count(uuid)
  to authenticated, service_role;

-- Internal lead routing is trigger/service-role driven. Direct RPC exposure is
-- unnecessary and lets callers try account/broker combinations.
revoke execute on function public.assign_premium_lead_recipient(uuid, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.assign_premium_lead_recipient(uuid, uuid, uuid, uuid, uuid)
  to service_role;

-- Global dashboard metrics are not a public product surface.
revoke execute on function public.get_global_dashboard_metrics()
  from public, anon, authenticated;
grant execute on function public.get_global_dashboard_metrics()
  to service_role;

-- The account-scoped dashboard RPC can remain available to authenticated users,
-- but it should not be callable anonymously through the Data API.
revoke execute on function public.get_my_dashboard_metrics()
  from public, anon;
grant execute on function public.get_my_dashboard_metrics()
  to authenticated, service_role;

commit;
