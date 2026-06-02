-- Ensure the Premium plan exists anywhere the app allows selecting it.
insert into public.plans (
  code,
  name,
  max_active_properties,
  max_images_per_property,
  has_auto_expiration,
  expiration_days,
  recommendation_source
)
values (
  'premium',
  'Premium',
  999999,
  15,
  false,
  null,
  'self'
)
on conflict (code) do update
set
  name = excluded.name,
  max_active_properties = excluded.max_active_properties,
  max_images_per_property = excluded.max_images_per_property,
  has_auto_expiration = excluded.has_auto_expiration,
  expiration_days = excluded.expiration_days,
  recommendation_source = excluded.recommendation_source;
