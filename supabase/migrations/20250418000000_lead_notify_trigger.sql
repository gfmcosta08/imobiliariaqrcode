-- Enfileira notificação ao corretor quando um lead é criado (consumida depois por whatsapp-dispatch / Uazapi).

create or replace function public.enqueue_lead_broker_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
  p record;
  msg_text text;
begin
  select * into b from public.brokers where id = new.broker_id;
  if not found then
    return new;
  end if;

  select * into p from public.properties where id = new.property_id;

  msg_text := '🚨 *Novo Lead Recebido!* 🚨' || chr(10) || chr(10) ||
              'Um cliente demonstrou interesse em um imóvel.' || chr(10) || chr(10) ||
              '📱 *Cliente:* ' || new.client_phone || chr(10);

  if p.public_id is not null then
    msg_text := msg_text || '🏠 *Imóvel:* ' || p.public_id || chr(10);
  end if;

  if new.intent = 'visit_interest' then
    msg_text := msg_text || '📅 *Ação:* Quer agendar uma visita!' || chr(10);
  else
    msg_text := msg_text || '🔍 *Ação:* Visualizou detalhes do imóvel' || chr(10);
  end if;

  msg_text := msg_text || chr(10) || 'Entra em contato com ele o quanto antes! 🚀';

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
    b.account_id,
    new.property_id,
    new.client_phone,
    b.whatsapp_number,
    'text',
    'queued',
    jsonb_build_object(
      'kind', 'lead_created',
      'lead_id', new.id,
      'intent', new.intent,
      'text', msg_text,
      'to_broker', true
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_leads_after_insert_notify on public.leads;
create trigger trg_leads_after_insert_notify
after insert on public.leads
for each row execute function public.enqueue_lead_broker_notification();
