-- Correcao definitiva do milestone de visualizacoes por QR:
-- 1) lock transacional por qr_token para evitar corrida;
-- 2) idempotencia forte via indice unico parcial para filas ativas;
-- 3) payload com vinculo explicito ao anuncio correto;
-- 4) saneamento de duplicatas legadas em queued (sem delete fisico).

-- Saneamento seguro: manter apenas a mensagem mais recente por chave logica
-- para milestones em fila (queued), marcando o restante como abandoned.
with ranked_duplicates as (
  select
    id,
    row_number() over (
      partition by
        coalesce(broker_phone, ''),
        coalesce(payload ->> 'qr_token', ''),
        coalesce(payload ->> 'milestone', ''),
        coalesce(payload ->> 'kind', '')
      order by created_at desc, id desc
    ) as rn
  from public.whatsapp_messages
  where direction = 'outbound'
    and provider = 'uazapi'
    and message_type = 'text'
    and status = 'queued'
    and payload ->> 'kind' = 'qr_views_milestone'
)
update public.whatsapp_messages w
set
  status = 'abandoned',
  payload = coalesce(w.payload, '{}'::jsonb)
    || jsonb_build_object(
      'dedupe_reason', 'legacy_qr_milestone_duplicate',
      'dedupe_at', clock_timestamp()
    ),
  updated_at = now()
from ranked_duplicates d
where w.id = d.id
  and d.rn > 1;
-- Idempotencia no ponto critico de enfileiramento:
-- somente uma mensagem ativa (queued/processing) por broker + qr + milestone + kind.
create unique index if not exists idx_whatsapp_qr_milestone_unique_active
  on public.whatsapp_messages (
    broker_phone,
    (payload ->> 'qr_token'),
    (payload ->> 'milestone'),
    (payload ->> 'kind')
  )
  where direction = 'outbound'
    and provider = 'uazapi'
    and message_type = 'text'
    and status in ('queued', 'processing')
    and payload ->> 'kind' = 'qr_views_milestone';
create or replace function public.register_qr_access(
  p_qr_token text,
  p_user_agent text default null,
  p_ip_hash text default null,
  p_lead_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qr record;
  v_total integer;
  v_phone text := nullif(regexp_replace(coalesce(p_lead_phone, ''), '\\D', '', 'g'), '');
begin
  select
    q.id,
    q.property_id,
    q.qr_token,
    q.is_active,
    p.public_id,
    p.account_id,
    p.broker_id,
    p.listing_status,
    p.expires_at,
    b.whatsapp_number as broker_phone
  into v_qr
  from public.property_qrcodes q
  join public.properties p on p.id = q.property_id
  left join public.brokers b on b.id = p.broker_id
  where q.qr_token = p_qr_token
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'state', 'not_found');
  end if;

  if not v_qr.is_active then
    return jsonb_build_object('ok', false, 'state', 'inactive');
  end if;

  if v_qr.listing_status in ('removed', 'blocked', 'expired') then
    return jsonb_build_object('ok', false, 'state', v_qr.listing_status);
  end if;

  if v_qr.expires_at is not null and v_qr.expires_at < now() then
    return jsonb_build_object('ok', false, 'state', 'expired');
  end if;

  -- Serializa por token para evitar corrida no count/milestone.
  perform pg_advisory_xact_lock(
    hashtext('register_qr_access'),
    hashtext(coalesce(v_qr.qr_token, ''))
  );

  insert into public.qr_access_events (
    property_id,
    qr_code_id,
    qr_token,
    lead_phone,
    user_agent,
    ip_hash,
    source
  )
  values (
    v_qr.property_id,
    v_qr.id,
    v_qr.qr_token,
    v_phone,
    p_user_agent,
    p_ip_hash,
    'qr_scan'
  );

  select count(*)::integer
  into v_total
  from public.qr_access_events e
  where e.qr_token = v_qr.qr_token;

  if v_total > 0 and mod(v_total, 10) = 0 and v_qr.broker_phone is not null then
    insert into public.whatsapp_messages (
      direction,
      provider,
      account_id,
      property_id,
      lead_phone,
      broker_phone,
      message_type,
      status,
      payload
    )
    values (
      'outbound',
      'uazapi',
      v_qr.account_id,
      v_qr.property_id,
      null,
      v_qr.broker_phone,
      'text',
      'queued',
      jsonb_build_object(
        'kind', 'qr_views_milestone',
        'qr_token', v_qr.qr_token,
        'milestone', v_total,
        'property_id', v_qr.property_id,
        'public_id', v_qr.public_id,
        'event_timestamp', clock_timestamp(),
        'text', v_total::text || ' pessoas visualizaram seu anuncio (' || coalesce(v_qr.public_id, 'sem_ref') || ').',
        'to_broker', true
      )
    )
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'state', 'active',
    'property_id', v_qr.property_id,
    'count', v_total
  );
end;
$$;
grant execute on function public.register_qr_access(text, text, text, text) to service_role;
