begin;

delete from public.plan_display_config
where plan_code = 'starter';

delete from public.plans
where code = 'starter'
  and not exists (
    select 1 from public.subscriptions where plan_code = 'starter'
  )
  and not exists (
    select 1 from public.properties where origin_plan_code = 'starter'
  );

alter table public.broker_invitations
  drop column if exists courtesy_expires_at;

alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check check (status in (
    'free',
    'trial_active',
    'solo_active',
    'pro_pending_activation',
    'pro_active',
    'past_due',
    'canceled',
    'expired'
  ));

create or replace function public.get_active_plan_code(p_account_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when s.status = 'pro_active' and s.plan_code = 'premium' then 'premium'
    when s.status = 'pro_active' and s.plan_code = 'pro' then 'pro'
    when s.status = 'solo_active' and s.plan_code = 'solo' then 'solo'
    else 'free'
  end
  from public.subscriptions s
  where s.account_id = p_account_id;
$$;

commit;
