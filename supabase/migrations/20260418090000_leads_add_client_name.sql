alter table public.leads
  add column if not exists client_name text;

create index if not exists idx_leads_phone_name
  on public.leads (client_phone, client_name);
