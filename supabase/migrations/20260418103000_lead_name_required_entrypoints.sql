create or replace function public.create_lead_from_visit_interest(
  p_property_id uuid,
  p_broker_id uuid,
  p_client_phone text,
  p_intent text default 'visit_interest',
  p_client_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing uuid;
  new_id uuid;
begin
  select l.id into existing
  from public.leads l
  where l.property_id = p_property_id
    and l.client_phone = p_client_phone
    and l.intent = p_intent
    and l.created_at > now() - interval '24 hours'
  limit 1;

  if existing is not null then
    if nullif(trim(p_client_name), '') is not null then
      update public.leads
      set client_name = coalesce(nullif(trim(client_name), ''), trim(p_client_name))
      where id = existing;
    end if;
    return existing;
  end if;

  insert into public.leads (property_id, broker_id, client_phone, intent, client_name)
  values (p_property_id, p_broker_id, p_client_phone, p_intent, nullif(trim(p_client_name), ''))
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.create_lead_from_visit_interest(uuid, uuid, text, text, text) to service_role;
