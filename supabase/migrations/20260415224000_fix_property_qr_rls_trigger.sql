-- Ensure QR creation runs with definer privileges to avoid RLS insert denial.
create or replace function public.after_property_insert_qr()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.property_qrcodes (property_id, qr_token)
  values (new.id, public.generate_qr_token());
  return new;
end;
$$;
