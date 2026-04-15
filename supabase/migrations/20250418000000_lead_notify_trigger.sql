-- Enfileira notificação ao corretor quando um lead é criado (consumida depois por whatsapp-dispatch / Uazapi).

create or replace function public.enqueue_lead_broker_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
begin
  select * into b from public.brokers where id = new.broker_id;
  if not found then
    return new;
  end if;

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
    'system',
    'queued',
    jsonb_build_object(
      'kind', 'lead_created',
      'lead_id', new.id,
      'intent', new.intent
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_leads_after_insert_notify on public.leads;
create trigger trg_leads_after_insert_notify
after insert on public.leads
for each row execute function public.enqueue_lead_broker_notification();
