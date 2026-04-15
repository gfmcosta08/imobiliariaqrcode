-- Campos para consolidar vendas e métricas no dashboard.

alter table public.properties
  add column if not exists sold_at date,
  add column if not exists sold_commission_amount numeric(14, 2),
  add column if not exists sold_confirmed_at timestamptz,
  add column if not exists sold_notes text;

create or replace function public.get_global_dashboard_metrics()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total_properties', (select count(*)::int from public.properties),
    'total_sold', (select count(*)::int from public.properties p where p.sold_at is not null),
    'total_clients', (select count(distinct l.client_phone)::int from public.leads l where l.client_phone is not null and l.client_phone <> ''),
    'active_brokers', (select count(*)::int from public.brokers b where b.status = 'active'),
    'total_commission', (select coalesce(sum(p.sold_commission_amount), 0)::numeric from public.properties p where p.sold_at is not null)
  );
$$;

create or replace function public.get_my_dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  aid uuid;
  out_json jsonb;
begin
  select p.account_id into aid
  from public.profiles p
  where p.id = auth.uid();

  if aid is null then
    return jsonb_build_object(
      'total_properties', 0,
      'total_sold', 0,
      'total_clients', 0,
      'total_commission', 0
    );
  end if;

  select jsonb_build_object(
    'total_properties', (select count(*)::int from public.properties p where p.account_id = aid),
    'total_sold', (select count(*)::int from public.properties p where p.account_id = aid and p.sold_at is not null),
    'total_clients', (
      select count(distinct l.client_phone)::int
      from public.leads l
      join public.properties p on p.id = l.property_id
      where p.account_id = aid
        and l.client_phone is not null
        and l.client_phone <> ''
    ),
    'total_commission', (
      select coalesce(sum(p.sold_commission_amount), 0)::numeric
      from public.properties p
      where p.account_id = aid
        and p.sold_at is not null
    )
  ) into out_json;

  return out_json;
end;
$$;

grant execute on function public.get_global_dashboard_metrics() to anon, authenticated, service_role;
grant execute on function public.get_my_dashboard_metrics() to authenticated, service_role;
