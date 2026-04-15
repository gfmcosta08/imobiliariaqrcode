-- Suporte a novos valores de dropdown no cadastro avançado.

alter table public.properties
  add column if not exists furnishing_status text;

alter table public.properties
  drop constraint if exists properties_purpose_check;

alter table public.properties
  add constraint properties_purpose_check
  check (purpose in ('sale', 'rent', 'season'));

