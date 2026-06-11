-- Align FREE plan semantics for staging homologation:
-- - 1 active listing
-- - automatic expiration enabled
-- - 30 days period
update public.plans
set
  max_active_properties = 1,
  has_auto_expiration = true,
  expiration_days = 30
where code = 'free';
