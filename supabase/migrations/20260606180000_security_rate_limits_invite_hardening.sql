-- Staging 10/10: anti-abuse persistente para rotas publicas e lockout de convite.

alter table public.broker_invitations
  add column if not exists invalid_attempt_count integer not null default 0,
  add column if not exists last_failed_at timestamptz,
  add column if not exists locked_until timestamptz,
  add column if not exists claimed_ip_hash text;

create index if not exists idx_broker_invitations_locked_until
  on public.broker_invitations (locked_until)
  where locked_until is not null;

create table if not exists public.security_rate_limits (
  rate_key text primary key,
  window_start timestamptz not null default now(),
  attempt_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.security_rate_limits enable row level security;

drop policy if exists security_rate_limits_service_role_all on public.security_rate_limits;
create policy security_rate_limits_service_role_all
  on public.security_rate_limits
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.check_security_rate_limit(
  p_rate_key text,
  p_limit integer,
  p_window_seconds integer,
  p_lock_seconds integer
)
returns table (
  allowed boolean,
  attempt_count integer,
  locked_until timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.security_rate_limits%rowtype;
  v_next_count integer;
begin
  if p_rate_key is null or length(trim(p_rate_key)) = 0 then
    raise exception 'rate_key_required';
  end if;
  if p_limit < 1 or p_window_seconds < 1 or p_lock_seconds < 1 then
    raise exception 'invalid_rate_limit_config';
  end if;

  select *
  into v_row
  from public.security_rate_limits s
  where s.rate_key = p_rate_key
  for update;

  if not found then
    insert into public.security_rate_limits (
      rate_key,
      window_start,
      attempt_count,
      locked_until,
      updated_at
    )
    values (p_rate_key, v_now, 1, null, v_now)
    returning * into v_row;

    return query select true, v_row.attempt_count, v_row.locked_until;
    return;
  end if;

  if v_row.locked_until is not null and v_row.locked_until > v_now then
    return query select false, v_row.attempt_count, v_row.locked_until;
    return;
  end if;

  if v_row.window_start + make_interval(secs => p_window_seconds) <= v_now then
    update public.security_rate_limits
    set window_start = v_now,
        attempt_count = 1,
        locked_until = null,
        updated_at = v_now
    where rate_key = p_rate_key
    returning * into v_row;

    return query select true, v_row.attempt_count, v_row.locked_until;
    return;
  end if;

  v_next_count := v_row.attempt_count + 1;

  update public.security_rate_limits
  set attempt_count = v_next_count,
      locked_until = case
        when v_next_count > p_limit then v_now + make_interval(secs => p_lock_seconds)
        else null
      end,
      updated_at = v_now
  where rate_key = p_rate_key
  returning * into v_row;

  return query select (v_next_count <= p_limit), v_row.attempt_count, v_row.locked_until;
end;
$$;

revoke all on function public.check_security_rate_limit(text, integer, integer, integer) from public;
grant execute on function public.check_security_rate_limit(text, integer, integer, integer) to service_role;
