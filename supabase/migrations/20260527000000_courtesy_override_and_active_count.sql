-- Courtesy overrides + correct "active properties" semantics (staging-first).
-- Goal:
-- - "Active properties" should mean published/printed (draft must not consume plan limits).
-- - Allow per-account courtesy override via subscriptions.max_active_properties_override.
-- - Enforce subscription validity via subscriptions.current_period_end when set.

-- 1) Add override column (safe to run multiple times)
alter table public.subscriptions
  add column if not exists max_active_properties_override integer;
-- 2) Count only truly active listings
create or replace function public.properties_active_count(p_account_id uuid)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.properties p
  where p.account_id = p_account_id
    and p.listing_status in ('published', 'printed');
$$;
-- 3) Enforce max actives with courtesy override + validity window
create or replace function public.can_create_property(p_account_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  max_props integer;
  current_count integer;
  plan_code text;
  sub_override integer;
  sub_period_end timestamptz;
begin
  select s.max_active_properties_override, s.current_period_end
    into sub_override, sub_period_end
  from public.subscriptions s
  where s.account_id = p_account_id;

  -- Validity enforcement: if a period end exists and is in the past, deny.
  if sub_period_end is not null and sub_period_end < now() then
    return false;
  end if;

  plan_code := public.get_active_plan_code(p_account_id);

  if sub_override is not null then
    max_props := sub_override;
  else
    select pl.max_active_properties into max_props
    from public.plans pl
    where pl.code = plan_code;
  end if;

  -- Defensive fallback: if plan is missing, deny (fail-secure).
  if max_props is null then
    return false;
  end if;

  current_count := public.properties_active_count(p_account_id);
  return current_count < max_props;
end;
$$;
