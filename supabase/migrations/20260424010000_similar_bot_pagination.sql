-- Similaridade paginada para o bot de WhatsApp, sem alterar a RPC publica existente.

alter table public.conversation_sessions
  add column if not exists similar_shown_property_ids jsonb not null default '[]'::jsonb,
  add column if not exists similar_page_number integer not null default 0;
create or replace function public.property_similarity_norm(p_value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(btrim(coalesce(p_value, ''))), '\s+', ' ', 'g'), '');
$$;
create or replace function public.recommend_similar_properties_for_bot(
  origin_property_id uuid,
  limit_count integer default 5,
  excluded_property_ids uuid[] default '{}'::uuid[]
)
returns table (
  id uuid,
  score numeric,
  source text
)
language sql
stable
security definer
set search_path = public
as $$
  with origin as (
    select p.*
    from public.properties p
    where p.id = origin_property_id
  ),
  candidates as (
    select
      p.*,
      case when p.broker_id = o.broker_id then 'corretor' else 'geral' end as source_label,
      case when p.broker_id = o.broker_id then 0 else 1 end as source_rank
    from public.properties p
    cross join origin o
    where p.id <> o.id
      and not (p.id = any(coalesce(excluded_property_ids, '{}'::uuid[])))
      and p.listing_status in ('published', 'printed')
      and (p.expires_at is null or p.expires_at > now())
  ),
  scored as (
    select
      c.id,
      c.source_label,
      c.source_rank,
      c.created_at,
      round(
        100::numeric * sum(case when f.matched then 1 else 0 end)::numeric / count(*)::numeric,
        2
      ) as score
    from candidates c
    cross join origin o
    cross join lateral (
      values
        (public.property_similarity_norm(o.property_type) is not null and public.property_similarity_norm(c.property_type) is not null, public.property_similarity_norm(o.property_type) = public.property_similarity_norm(c.property_type)),
        (public.property_similarity_norm(o.property_subtype) is not null and public.property_similarity_norm(c.property_subtype) is not null, public.property_similarity_norm(o.property_subtype) = public.property_similarity_norm(c.property_subtype)),
        (public.property_similarity_norm(o.purpose) is not null and public.property_similarity_norm(c.purpose) is not null, public.property_similarity_norm(o.purpose) = public.property_similarity_norm(c.purpose)),
        (public.property_similarity_norm(o.title) is not null and public.property_similarity_norm(c.title) is not null, public.property_similarity_norm(o.title) = public.property_similarity_norm(c.title)),
        (public.property_similarity_norm(o.full_description) is not null and public.property_similarity_norm(c.full_description) is not null, public.property_similarity_norm(o.full_description) = public.property_similarity_norm(c.full_description)),
        (public.property_similarity_norm(o.highlights) is not null and public.property_similarity_norm(c.highlights) is not null, public.property_similarity_norm(o.highlights) = public.property_similarity_norm(c.highlights)),
        (o.sale_price is not null and c.sale_price is not null, o.sale_price = c.sale_price),
        (o.rent_price is not null and c.rent_price is not null, o.rent_price = c.rent_price),
        (o.condo_fee is not null and c.condo_fee is not null, o.condo_fee = c.condo_fee),
        (o.iptu_amount is not null and c.iptu_amount is not null, o.iptu_amount = c.iptu_amount),
        (o.other_fees is not null and c.other_fees is not null, o.other_fees = c.other_fees),
        (o.accepts_financing is not null and c.accepts_financing is not null, o.accepts_financing = c.accepts_financing),
        (o.accepts_trade is not null and c.accepts_trade is not null, o.accepts_trade = c.accepts_trade),
        (o.total_area_m2 is not null and c.total_area_m2 is not null, o.total_area_m2 = c.total_area_m2),
        (o.built_area_m2 is not null and c.built_area_m2 is not null, o.built_area_m2 = c.built_area_m2),
        (o.land_area_m2 is not null and c.land_area_m2 is not null, o.land_area_m2 = c.land_area_m2),
        (o.bedrooms is not null and c.bedrooms is not null, o.bedrooms = c.bedrooms),
        (o.suites is not null and c.suites is not null, o.suites = c.suites),
        (o.bathrooms is not null and c.bathrooms is not null, o.bathrooms = c.bathrooms),
        (o.parking_spaces is not null and c.parking_spaces is not null, o.parking_spaces = c.parking_spaces),
        (o.living_rooms is not null and c.living_rooms is not null, o.living_rooms = c.living_rooms),
        (o.floors_count is not null and c.floors_count is not null, o.floors_count = c.floors_count),
        (o.unit_floor is not null and c.unit_floor is not null, o.unit_floor = c.unit_floor),
        (public.property_similarity_norm(o.furnishing_status) is not null and public.property_similarity_norm(c.furnishing_status) is not null, public.property_similarity_norm(o.furnishing_status) = public.property_similarity_norm(c.furnishing_status)),
        (public.property_similarity_norm(o.floor_type) is not null and public.property_similarity_norm(c.floor_type) is not null, public.property_similarity_norm(o.floor_type) = public.property_similarity_norm(c.floor_type)),
        (public.property_similarity_norm(o.sun_position) is not null and public.property_similarity_norm(c.sun_position) is not null, public.property_similarity_norm(o.sun_position) = public.property_similarity_norm(c.sun_position)),
        (o.property_age_years is not null and c.property_age_years is not null, o.property_age_years = c.property_age_years),
        (public.property_similarity_norm(o.full_address) is not null and public.property_similarity_norm(c.full_address) is not null, public.property_similarity_norm(o.full_address) = public.property_similarity_norm(c.full_address)),
        (public.property_similarity_norm(o.street_number) is not null and public.property_similarity_norm(c.street_number) is not null, public.property_similarity_norm(o.street_number) = public.property_similarity_norm(c.street_number)),
        (public.property_similarity_norm(o.address_complement) is not null and public.property_similarity_norm(c.address_complement) is not null, public.property_similarity_norm(o.address_complement) = public.property_similarity_norm(c.address_complement)),
        (public.property_similarity_norm(o.neighborhood) is not null and public.property_similarity_norm(c.neighborhood) is not null, public.property_similarity_norm(o.neighborhood) = public.property_similarity_norm(c.neighborhood)),
        (public.property_similarity_norm(o.city) is not null and public.property_similarity_norm(c.city) is not null, public.property_similarity_norm(o.city) = public.property_similarity_norm(c.city)),
        (public.property_similarity_norm(o.state) is not null and public.property_similarity_norm(c.state) is not null, public.property_similarity_norm(o.state) = public.property_similarity_norm(c.state)),
        (public.property_similarity_norm(o.postal_code) is not null and public.property_similarity_norm(c.postal_code) is not null, public.property_similarity_norm(o.postal_code) = public.property_similarity_norm(c.postal_code)),
        (cardinality(coalesce(o.features, '{}'::text[])) > 0 and cardinality(coalesce(c.features, '{}'::text[])) > 0, coalesce(o.features, '{}'::text[]) && coalesce(c.features, '{}'::text[])),
        (cardinality(coalesce(o.infrastructure, '{}'::text[])) > 0 and cardinality(coalesce(c.infrastructure, '{}'::text[])) > 0, coalesce(o.infrastructure, '{}'::text[]) && coalesce(c.infrastructure, '{}'::text[])),
        (cardinality(coalesce(o.security_items, '{}'::text[])) > 0 and cardinality(coalesce(c.security_items, '{}'::text[])) > 0, coalesce(o.security_items, '{}'::text[]) && coalesce(c.security_items, '{}'::text[])),
        (o.key_available is not null and c.key_available is not null, o.key_available = c.key_available),
        (o.is_occupied is not null and c.is_occupied is not null, o.is_occupied = c.is_occupied),
        (public.property_similarity_norm(o.documentation) is not null and public.property_similarity_norm(c.documentation) is not null, public.property_similarity_norm(o.documentation) = public.property_similarity_norm(c.documentation)),
        (public.property_similarity_norm(o.technical_details) is not null and public.property_similarity_norm(c.technical_details) is not null, public.property_similarity_norm(o.technical_details) = public.property_similarity_norm(c.technical_details)),
        (public.property_similarity_norm(o.construction_type) is not null and public.property_similarity_norm(c.construction_type) is not null, public.property_similarity_norm(o.construction_type) = public.property_similarity_norm(c.construction_type)),
        (public.property_similarity_norm(o.finish_standard) is not null and public.property_similarity_norm(c.finish_standard) is not null, public.property_similarity_norm(o.finish_standard) = public.property_similarity_norm(c.finish_standard)),
        (public.property_similarity_norm(o.documentation_status) is not null and public.property_similarity_norm(c.documentation_status) is not null, public.property_similarity_norm(o.documentation_status) = public.property_similarity_norm(c.documentation_status)),
        (o.has_deed is not null and c.has_deed is not null, o.has_deed = c.has_deed),
        (o.has_registration is not null and c.has_registration is not null, o.has_registration = c.has_registration),
        (cardinality(coalesce(o.nearby_points, '{}'::text[])) > 0 and cardinality(coalesce(c.nearby_points, '{}'::text[])) > 0, coalesce(o.nearby_points, '{}'::text[]) && coalesce(c.nearby_points, '{}'::text[])),
        (o.distance_to_center_km is not null and c.distance_to_center_km is not null, o.distance_to_center_km = c.distance_to_center_km),
        (public.property_similarity_norm(o.city_region) is not null and public.property_similarity_norm(c.city_region) is not null, public.property_similarity_norm(o.city_region) = public.property_similarity_norm(c.city_region)),
        (public.property_similarity_norm(o.broker_notes) is not null and public.property_similarity_norm(c.broker_notes) is not null, public.property_similarity_norm(o.broker_notes) = public.property_similarity_norm(c.broker_notes))
    ) as f(applicable, matched)
    where f.applicable
    group by c.id, c.source_label, c.source_rank, c.created_at
  )
  select scored.id, scored.score, scored.source_label as source
  from scored
  where scored.score >= 51
  order by scored.source_rank asc, scored.score desc, scored.created_at asc, scored.id asc
  limit greatest(1, least(limit_count, 20));
$$;
grant execute on function public.recommend_similar_properties_for_bot(uuid, integer, uuid[]) to service_role;
