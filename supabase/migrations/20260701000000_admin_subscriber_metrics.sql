-- Admin metrics: busca de assinantes e relatórios QR (role admin only).

create or replace function public.assert_is_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_is_admin() from public;
grant execute on function public.assert_is_admin() to authenticated;

create or replace function public.admin_classify_user_agent(p_ua text)
returns text
language sql
immutable
as $$
  select case
    when p_ua is null or btrim(p_ua) = '' then 'unknown'
    when p_ua ~* 'bot|crawl|spider|slurp|facebookexternalhit' then 'bot'
    when p_ua ~* 'ipad|tablet|kindle|playbook' then 'tablet'
    when p_ua ~* 'mobile|android|iphone|ipod|webos|blackberry|iemobile|opera mini' then 'mobile'
    else 'desktop'
  end;
$$;

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
      a.id as account_id,
      coalesce(p.full_name, b.display_name, 'Sem nome') as full_name,
      coalesce(p.email, '') as email,
      coalesce(nullif(b.whatsapp_number, ''), p.whatsapp_number, '') as whatsapp_number,
      coalesce(s.plan_code, 'free') as plan_code,
      coalesce(s.status, 'free') as subscription_status
    from public.accounts a
    left join public.profiles p on p.account_id = a.id
    left join public.brokers b on b.account_id = a.id
    left join public.subscriptions s on s.account_id = a.id
  ),
  filtered as (
    select *
    from base
    where v_q = ''
      or lower(full_name) like '%' || v_q || '%'
      or lower(email) like '%' || v_q || '%'
      or lower(whatsapp_number) like '%' || v_q || '%'
      or lower(account_id::text) like '%' || v_q || '%'
      or (v_digits <> '' and regexp_replace(whatsapp_number, '\D', '', 'g') like '%' || v_digits || '%')
  ),
  metrics as (
    select
      f.account_id,
      f.full_name,
      f.email,
      f.whatsapp_number,
      f.plan_code,
      f.subscription_status,
      (
        select count(*)::bigint
        from public.properties pr
        where pr.account_id = f.account_id
      ) as total_properties,
      (
        select count(*)::bigint
        from public.qr_access_events qae
        join public.properties pr on pr.id = qae.property_id
        where pr.account_id = f.account_id
      ) as total_qr_reads,
      (
        select count(*)::bigint
        from public.leads l
        join public.properties pr on pr.id = l.property_id
        where pr.account_id = f.account_id
      ) as total_leads
    from filtered f
  )
  select *
  from metrics
  order by full_name asc, account_id asc
  limit greatest(coalesce(p_limit, 50), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_search_subscribers(text, integer, integer) from public;
grant execute on function public.admin_search_subscribers(text, integer, integer) to authenticated;

create or replace function public.admin_get_subscriber_dashboard(p_account_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_account jsonb;
  v_properties jsonb;
begin
  perform public.assert_is_admin();

  if not exists (select 1 from public.accounts a where a.id = p_account_id) then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'account_id', a.id,
    'full_name', coalesce(p.full_name, b.display_name, 'Sem nome'),
    'email', coalesce(p.email, ''),
    'whatsapp_number', coalesce(nullif(b.whatsapp_number, ''), p.whatsapp_number, ''),
    'plan_code', coalesce(s.plan_code, 'free'),
    'subscription_status', coalesce(s.status, 'free'),
    'created_at', a.created_at,
    'total_properties', (select count(*) from public.properties pr where pr.account_id = a.id),
    'total_qr_reads', (
      select count(*)
      from public.qr_access_events qae
      join public.properties pr on pr.id = qae.property_id
      where pr.account_id = a.id
    ),
    'total_leads', (
      select count(*)
      from public.leads l
      join public.properties pr on pr.id = l.property_id
      where pr.account_id = a.id
    ),
    'unique_qr_visitors', (
      select count(distinct qae.ip_hash)
      from public.qr_access_events qae
      join public.properties pr on pr.id = qae.property_id
      where pr.account_id = a.id
        and qae.ip_hash is not null
        and btrim(qae.ip_hash) <> ''
    )
  )
  into v_account
  from public.accounts a
  left join public.profiles p on p.account_id = a.id
  left join public.brokers b on b.account_id = a.id
  left join public.subscriptions s on s.account_id = a.id
  where a.id = p_account_id
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'property_id', pr.id,
        'public_id', pr.public_id,
        'title', coalesce(pr.title, pr.public_id),
        'listing_status', pr.listing_status,
        'city', pr.city,
        'state', pr.state,
        'qr_token', (
          select pq.qr_token
          from public.property_qrcodes pq
          where pq.property_id = pr.id
            and pq.is_active = true
          order by pq.created_at desc
          limit 1
        ),
        'qr_reads', (
          select count(*)::bigint
          from public.qr_access_events qae
          where qae.property_id = pr.id
        ),
        'unique_visitors', (
          select count(distinct qae.ip_hash)::bigint
          from public.qr_access_events qae
          where qae.property_id = pr.id
            and qae.ip_hash is not null
            and btrim(qae.ip_hash) <> ''
        ),
        'total_leads', (
          select count(*)::bigint
          from public.leads l
          where l.property_id = pr.id
        ),
        'visit_interest_count', (
          select count(*)::bigint
          from public.leads l
          where l.property_id = pr.id
            and l.intent = 'visit_interest'
        ),
        'updated_at', pr.updated_at
      )
      order by pr.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_properties
  from public.properties pr
  where pr.account_id = p_account_id;

  return jsonb_build_object(
    'account', v_account,
    'properties', v_properties
  );
end;
$$;

revoke all on function public.admin_get_subscriber_dashboard(uuid) from public;
grant execute on function public.admin_get_subscriber_dashboard(uuid) to authenticated;

create or replace function public.admin_get_property_qr_metrics(p_property_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_property jsonb;
  v_summary jsonb;
  v_scans_by_day jsonb;
  v_scans_by_hour jsonb;
  v_device_breakdown jsonb;
  v_recent_scans jsonb;
  v_leads jsonb;
  v_interactions jsonb;
  v_total_scans bigint;
  v_unique_visitors bigint;
  v_total_leads bigint;
  v_visit_interest bigint;
  v_qr_entry bigint;
  v_similar_interest bigint;
  v_public_interest bigint;
begin
  perform public.assert_is_admin();

  if not exists (select 1 from public.properties pr where pr.id = p_property_id) then
    raise exception 'property_not_found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'property_id', pr.id,
    'account_id', pr.account_id,
    'public_id', pr.public_id,
    'title', coalesce(pr.title, pr.public_id),
    'listing_status', pr.listing_status,
    'city', pr.city,
    'state', pr.state,
    'neighborhood', pr.neighborhood,
    'full_address', pr.full_address,
    'latitude', pr.latitude,
    'longitude', pr.longitude,
    'qr_token', (
      select pq.qr_token
      from public.property_qrcodes pq
      where pq.property_id = pr.id
        and pq.is_active = true
      order by pq.created_at desc
      limit 1
    )
  )
  into v_property
  from public.properties pr
  where pr.id = p_property_id;

  select count(*)::bigint,
         count(distinct qae.ip_hash) filter (where qae.ip_hash is not null and btrim(qae.ip_hash) <> '')
  into v_total_scans, v_unique_visitors
  from public.qr_access_events qae
  where qae.property_id = p_property_id;

  select count(*)::bigint into v_total_leads
  from public.leads l where l.property_id = p_property_id;

  select count(*)::bigint into v_visit_interest
  from public.lead_interactions li
  join public.leads l on l.id = li.lead_id
  where l.property_id = p_property_id
    and li.interaction_type = 'visit_interest';

  select count(*)::bigint into v_qr_entry
  from public.lead_interactions li
  join public.leads l on l.id = li.lead_id
  where l.property_id = p_property_id
    and li.interaction_type = 'qr_entry';

  select count(*)::bigint into v_similar_interest
  from public.lead_interactions li
  join public.leads l on l.id = li.lead_id
  where l.property_id = p_property_id
    and li.interaction_type = 'similar_interest';

  select count(*)::bigint into v_public_interest
  from public.lead_interactions li
  join public.leads l on l.id = li.lead_id
  where l.property_id = p_property_id
    and li.interaction_type = 'public_qr_interest';

  select jsonb_build_object(
    'total_scans', v_total_scans,
    'unique_visitors', v_unique_visitors,
    'total_leads', v_total_leads,
    'visit_interest_count', v_visit_interest,
    'qr_entry_count', v_qr_entry,
    'similar_interest_count', v_similar_interest,
    'public_qr_interest_count', v_public_interest,
    'conversion_scan_to_lead', case when v_total_scans > 0 then round((v_total_leads::numeric / v_total_scans::numeric) * 100, 2) else 0 end,
    'conversion_scan_to_visit', case when v_total_scans > 0 then round((v_visit_interest::numeric / v_total_scans::numeric) * 100, 2) else 0 end,
    'first_scan_at', (select min(qae.created_at) from public.qr_access_events qae where qae.property_id = p_property_id),
    'last_scan_at', (select max(qae.created_at) from public.qr_access_events qae where qae.property_id = p_property_id)
  )
  into v_summary;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('day', d.day, 'count', d.cnt)
      order by d.day desc
    ),
    '[]'::jsonb
  )
  into v_scans_by_day
  from (
    select date_trunc('day', qae.created_at)::date as day, count(*)::bigint as cnt
    from public.qr_access_events qae
    where qae.property_id = p_property_id
      and qae.created_at >= now() - interval '90 days'
    group by 1
    order by 1 desc
    limit 90
  ) d;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('hour', h.hr, 'count', h.cnt)
      order by h.hr
    ),
    '[]'::jsonb
  )
  into v_scans_by_hour
  from (
    select extract(hour from qae.created_at)::int as hr, count(*)::bigint as cnt
    from public.qr_access_events qae
    where qae.property_id = p_property_id
    group by 1
  ) h;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('device', d.device, 'count', d.cnt)
      order by d.cnt desc
    ),
    '[]'::jsonb
  )
  into v_device_breakdown
  from (
    select public.admin_classify_user_agent(qae.user_agent) as device, count(*)::bigint as cnt
    from public.qr_access_events qae
    where qae.property_id = p_property_id
    group by 1
  ) d;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', qae.id,
        'created_at', qae.created_at,
        'source', qae.source,
        'device', public.admin_classify_user_agent(qae.user_agent),
        'user_agent', left(coalesce(qae.user_agent, ''), 200),
        'has_ip_hash', (qae.ip_hash is not null and btrim(qae.ip_hash) <> '')
      )
      order by qae.created_at desc
    ),
    '[]'::jsonb
  )
  into v_recent_scans
  from (
    select *
    from public.qr_access_events qae
    where qae.property_id = p_property_id
    order by qae.created_at desc
    limit 50
  ) qae;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'nome_completo', l.nome_completo,
        'telefone', l.telefone,
        'intent', l.intent,
        'status', l.status,
        'origem', l.origem,
        'created_at', l.created_at,
        'updated_at', l.updated_at
      )
      order by l.created_at desc
    ),
    '[]'::jsonb
  )
  into v_leads
  from public.leads l
  where l.property_id = p_property_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', li.id,
        'lead_id', li.lead_id,
        'interaction_type', li.interaction_type,
        'created_at', li.created_at,
        'payload', li.payload
      )
      order by li.created_at desc
    ),
    '[]'::jsonb
  )
  into v_interactions
  from (
    select li.*
    from public.lead_interactions li
    join public.leads l on l.id = li.lead_id
    where l.property_id = p_property_id
    order by li.created_at desc
    limit 100
  ) li;

  return jsonb_build_object(
    'property', v_property,
    'summary', v_summary,
    'scans_by_day', v_scans_by_day,
    'scans_by_hour', v_scans_by_hour,
    'device_breakdown', v_device_breakdown,
    'recent_scans', v_recent_scans,
    'leads', v_leads,
    'interactions', v_interactions,
    'location_note', 'Localização exibida refere-se ao imóvel cadastrado, não ao visitante do QR.'
  );
end;
$$;

revoke all on function public.admin_get_property_qr_metrics(uuid) from public;
grant execute on function public.admin_get_property_qr_metrics(uuid) to authenticated;
