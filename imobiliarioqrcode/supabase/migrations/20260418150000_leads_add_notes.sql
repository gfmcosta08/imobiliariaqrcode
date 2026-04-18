alter table public.leads add column if not exists notes text;
alter table public.leads add column if not exists source text default 'qr_whatsapp' check (source in ('qr_whatsapp', 'manual', 'whatsapp_bot'));
alter table public.leads add column if not exists broker_notes text;

comment on column public.leads.notes is 'Observações internas do corretor sobre o lead';
comment on column public.leads.broker_notes is 'Notas privadas do corretor sobre o lead';