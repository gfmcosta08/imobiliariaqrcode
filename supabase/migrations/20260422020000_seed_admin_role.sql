-- Promover conta principal para admin, habilitando geração de convites cortesia.
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'gfmcosta@gmail.com';
