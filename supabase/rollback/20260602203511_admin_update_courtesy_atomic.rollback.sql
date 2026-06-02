begin;

drop function if exists public.admin_update_courtesy(uuid, uuid, integer, timestamptz, text);
drop table if exists public.courtesy_admin_audit_events;

commit;
