-- Admin-controlled plan selection + validity semantics (staging-first).
-- - get_active_plan_code must reflect solo/pro/premium when their statuses are active.
-- - Plan selection is driven by subscriptions.plan_code + subscriptions.status.

create or replace function public.get_active_plan_code(p_account_id uuid)
returns text
language sql
stable
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
