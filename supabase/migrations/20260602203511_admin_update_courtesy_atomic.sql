begin;

create table if not exists public.courtesy_admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  admin_profile_id uuid not null references public.profiles (id),
  invitation_id uuid not null references public.broker_invitations (id),
  account_id uuid not null references public.accounts (id),
  previous_property_limit integer not null,
  new_property_limit integer not null,
  previous_expires_at timestamptz,
  new_expires_at timestamptz not null,
  previous_status text not null,
  new_status text not null,
  archived_property_ids uuid[] not null default '{}',
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.courtesy_admin_audit_events enable row level security;
revoke all on public.courtesy_admin_audit_events from public, anon, authenticated;

create or replace function public.admin_update_courtesy(
  p_admin_profile_id uuid,
  p_invitation_id uuid,
  p_property_limit integer,
  p_expires_at timestamptz,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.broker_invitations%rowtype;
  v_account_id uuid;
  v_previous_limit integer;
  v_previous_expires_at timestamptz;
  v_new_status text;
  v_archived_property_ids uuid[] := '{}';
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = p_admin_profile_id
      and p.role = 'admin'
  ) then
    raise exception 'admin profile required';
  end if;

  if p_property_limit < 1 then
    raise exception 'property limit must be greater than zero';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'reason is required';
  end if;

  select *
  into strict v_invitation
  from public.broker_invitations bi
  where bi.id = p_invitation_id
  for update;

  select p.account_id
  into strict v_account_id
  from public.properties p
  where p.id = coalesce(v_invitation.property_id, v_invitation.property_ids[1]);

  select
    coalesce(s.max_active_properties_override, v_invitation.property_count, 1),
    coalesce(v_invitation.courtesy_expires_at, s.current_period_end)
  into v_previous_limit, v_previous_expires_at
  from public.subscriptions s
  where s.account_id = v_account_id
  for update;

  if not found then
    raise exception 'subscription not found';
  end if;

  v_new_status := case when p_expires_at <= now() then 'expired' else v_invitation.status end;

  with ranked as (
    select
      p.id,
      row_number() over (order by p.created_at desc, p.id desc) as position
    from public.properties p
    where p.account_id = v_account_id
      and p.listing_status in ('draft', 'reserved', 'published', 'printed')
  ),
  archived as (
    update public.properties p
    set
      listing_status = 'removed',
      removed_at = now(),
      updated_at = now()
    from ranked r
    where p.id = r.id
      and (p_expires_at <= now() or r.position > p_property_limit)
    returning p.id
  )
  select coalesce(array_agg(id), '{}')
  into v_archived_property_ids
  from archived;

  update public.property_qrcodes q
  set
    is_active = false,
    expired_at = now(),
    invalidation_reason = 'courtesy_admin_update'
  where q.property_id = any (v_archived_property_ids)
    and q.is_active = true;

  update public.subscriptions
  set
    max_active_properties_override = p_property_limit,
    current_period_end = p_expires_at,
    status = case when p_expires_at <= now() then 'expired' else status end,
    updated_at = now()
  where account_id = v_account_id;

  update public.broker_invitations
  set
    property_count = p_property_limit,
    expiration_days_configured = greatest(1, ceil(extract(epoch from (p_expires_at - now())) / 86400)::integer),
    courtesy_expires_at = p_expires_at,
    expires_at = p_expires_at,
    status = v_new_status
  where id = p_invitation_id;

  insert into public.courtesy_admin_audit_events (
    admin_profile_id,
    invitation_id,
    account_id,
    previous_property_limit,
    new_property_limit,
    previous_expires_at,
    new_expires_at,
    previous_status,
    new_status,
    archived_property_ids,
    reason
  )
  values (
    p_admin_profile_id,
    p_invitation_id,
    v_account_id,
    v_previous_limit,
    p_property_limit,
    v_previous_expires_at,
    p_expires_at,
    v_invitation.status,
    v_new_status,
    v_archived_property_ids,
    trim(p_reason)
  );

  return jsonb_build_object(
    'ok', true,
    'invitation_id', p_invitation_id,
    'account_id', v_account_id,
    'property_limit', p_property_limit,
    'expires_at', p_expires_at,
    'status', v_new_status,
    'archived_property_ids', to_jsonb(v_archived_property_ids)
  );
end;
$$;

revoke all on function public.admin_update_courtesy(uuid, uuid, integer, timestamptz, text)
from public, anon;
grant execute on function public.admin_update_courtesy(uuid, uuid, integer, timestamptz, text)
to authenticated, service_role;

commit;
