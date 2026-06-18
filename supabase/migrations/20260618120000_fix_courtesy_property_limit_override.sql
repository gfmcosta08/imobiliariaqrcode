begin;

-- Convites de cortesia gravam max_active_properties_override. A funcao
-- endurecida de limite passou a consultar apenas property_limit_override,
-- ignorando convites com mais de 1 imovel.
alter table public.subscriptions
  add column if not exists max_active_properties_override integer;

alter table public.subscriptions
  add column if not exists property_limit_override integer;

alter table public.subscriptions
  drop constraint if exists subscriptions_max_active_properties_override_check;

alter table public.subscriptions
  add constraint subscriptions_max_active_properties_override_check
  check (max_active_properties_override is null or max_active_properties_override >= 1);

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

  select coalesce(s.max_active_properties_override, s.property_limit_override)
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

revoke execute on function public.account_property_limit(uuid)
  from public, anon;

grant execute on function public.account_property_limit(uuid)
  to authenticated, service_role;

commit;
