-- Políticas de Storage para o bucket property-media (path: account/{account_id}/...).

create policy "storage_property_media_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'property-media'
  and split_part(name, '/', 1) = 'account'
  and split_part(name, '/', 2) = (select account_id::text from public.profiles where id = auth.uid())
);

create policy "storage_property_media_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'property-media'
  and split_part(name, '/', 1) = 'account'
  and split_part(name, '/', 2) = (select account_id::text from public.profiles where id = auth.uid())
);

create policy "storage_property_media_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'property-media'
  and split_part(name, '/', 1) = 'account'
  and split_part(name, '/', 2) = (select account_id::text from public.profiles where id = auth.uid())
)
with check (
  bucket_id = 'property-media'
  and split_part(name, '/', 1) = 'account'
  and split_part(name, '/', 2) = (select account_id::text from public.profiles where id = auth.uid())
);

create policy "storage_property_media_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'property-media'
  and split_part(name, '/', 1) = 'account'
  and split_part(name, '/', 2) = (select account_id::text from public.profiles where id = auth.uid())
);
