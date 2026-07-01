-- Corrige ambiguidade de full_name/account_id com colunas de RETURNS TABLE em plpgsql.

create or replace function public.admin_search_subscribers(
  p_query text default '',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  account_id uuid,
  full_name text,
  email text,
  whatsapp_number text,
  plan_code text,
  subscription_status text,
  total_properties bigint,
  total_qr_reads bigint,
  total_leads bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := lower(btrim(coalesce(p_query, '')));
  v_digits text := regexp_replace(v_q, '\D', '', 'g');
begin
  perform public.assert_is_admin();

  return query
  with base as (
    select
      a.id as acct_id,
      coalesce(p.full_name, b.display_name, 'Sem nome') as subscriber_name,
      coalesce(p.email, '') as subscriber_email,
      coalesce(nullif(b.whatsapp_number, ''), p.whatsapp_number, '') as subscriber_whatsapp,
      coalesce(s.plan_code, 'free') as subscriber_plan_code,
      coalesce(s.status, 'free') as subscriber_status
    from public.accounts a
    left join public.profiles p on p.account_id = a.id
    left join public.brokers b on b.account_id = a.id
    left join public.subscriptions s on s.account_id = a.id
  ),
  filtered as (
    select *
    from base
    where v_q = ''
      or lower(subscriber_name) like '%' || v_q || '%'
      or lower(subscriber_email) like '%' || v_q || '%'
      or lower(subscriber_whatsapp) like '%' || v_q || '%'
      or lower(acct_id::text) like '%' || v_q || '%'
      or (v_digits <> '' and regexp_replace(subscriber_whatsapp, '\D', '', 'g') like '%' || v_digits || '%')
  ),
  metrics as (
    select
      f.acct_id,
      f.subscriber_name,
      f.subscriber_email,
      f.subscriber_whatsapp,
      f.subscriber_plan_code,
      f.subscriber_status,
      (
        select count(*)::bigint
        from public.properties pr
        where pr.account_id = f.acct_id
      ) as total_properties,
      (
        select count(*)::bigint
        from public.qr_access_events qae
        join public.properties pr on pr.id = qae.property_id
        where pr.account_id = f.acct_id
      ) as total_qr_reads,
      (
        select count(*)::bigint
        from public.leads l
        join public.properties pr on pr.id = l.property_id
        where pr.account_id = f.acct_id
      ) as total_leads
    from filtered f
  )
  select
    m.acct_id,
    m.subscriber_name,
    m.subscriber_email,
    m.subscriber_whatsapp,
    m.subscriber_plan_code,
    m.subscriber_status,
    m.total_properties,
    m.total_qr_reads,
    m.total_leads
  from metrics m
  order by m.subscriber_name asc, m.acct_id asc
  limit greatest(coalesce(p_limit, 50), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_search_subscribers(text, integer, integer) from public;
grant execute on function public.admin_search_subscribers(text, integer, integer) to authenticated;
