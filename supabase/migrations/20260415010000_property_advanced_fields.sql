-- Expansao do cadastro de imoveis com campos avancados e melhoria do score de similares.

alter table public.properties
  alter column description drop not null,
  alter column description drop default,
  alter column property_type drop not null,
  alter column property_subtype drop not null,
  alter column purpose drop not null,
  alter column city drop not null,
  alter column state drop not null,
  alter column bedrooms drop not null,
  alter column bedrooms drop default,
  alter column suites drop not null,
  alter column suites drop default,
  alter column bathrooms drop not null,
  alter column bathrooms drop default,
  alter column parking_spaces drop not null,
  alter column parking_spaces drop default;

alter table public.properties
  add column if not exists internal_code text,
  add column if not exists full_description text,
  add column if not exists highlights text,
  add column if not exists broker_notes text,
  add column if not exists sale_price numeric(14, 2),
  add column if not exists rent_price numeric(14, 2),
  add column if not exists other_fees numeric(14, 2),
  add column if not exists accepts_financing boolean,
  add column if not exists accepts_trade boolean,
  add column if not exists total_area_m2 numeric(12, 2),
  add column if not exists built_area_m2 numeric(12, 2),
  add column if not exists land_area_m2 numeric(12, 2),
  add column if not exists living_rooms integer,
  add column if not exists floors_count integer,
  add column if not exists unit_floor integer,
  add column if not exists is_furnished boolean,
  add column if not exists floor_type text,
  add column if not exists sun_position text,
  add column if not exists property_age_years integer,
  add column if not exists full_address text,
  add column if not exists street_number text,
  add column if not exists address_complement text,
  add column if not exists latitude numeric(10, 7),
  add column if not exists longitude numeric(10, 7),
  add column if not exists owner_name text,
  add column if not exists owner_phone text,
  add column if not exists owner_email text,
  add column if not exists listing_broker_name text,
  add column if not exists listing_broker_phone text,
  add column if not exists listing_broker_email text,
  add column if not exists features text[],
  add column if not exists infrastructure text[],
  add column if not exists security_items text[],
  add column if not exists key_available boolean,
  add column if not exists is_occupied boolean,
  add column if not exists documentation text,
  add column if not exists technical_details text,
  add column if not exists construction_type text,
  add column if not exists finish_standard text,
  add column if not exists registry_number text,
  add column if not exists documentation_status text,
  add column if not exists has_deed boolean,
  add column if not exists has_registration boolean,
  add column if not exists nearby_points text[],
  add column if not exists distance_to_center_km numeric(8, 2),
  add column if not exists city_region text;

create or replace function public.recommend_similar_properties(
  origin_property_id uuid,
  limit_count integer default 5
)
returns table (
  id uuid,
  score numeric
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
    select p.*
    from public.properties p, origin o
    where p.id <> o.id
      and p.broker_id = o.broker_id
      and p.listing_status in ('published', 'printed')
      and (
        (o.origin_plan_code = 'free' and p.origin_plan_code = 'pro')
        or (o.origin_plan_code = 'pro' and p.origin_plan_code = 'pro')
      )
  ),
  ranked as (
    select
      c.id,
      (
        (case when coalesce(c.property_type, '') <> '' and c.property_type = o.property_type then 4 else 0 end) +
        (case when coalesce(c.property_subtype, '') <> '' and c.property_subtype = o.property_subtype then 3 else 0 end) +
        (case when c.purpose is not null and c.purpose = o.purpose then 2 else 0 end) +
        (case when coalesce(c.city, '') <> '' and c.city = o.city then 2 else 0 end) +
        (case when coalesce(c.state, '') <> '' and c.state = o.state then 1 else 0 end) +
        (case when coalesce(c.neighborhood, '') <> '' and c.neighborhood = o.neighborhood then 2 else 0 end) +
        (case
          when c.price is not null and o.price is not null and o.price > 0
          then greatest(0::numeric, 3::numeric - abs(c.price - o.price) / greatest(o.price, 1) * 3)
          else 0::numeric
        end) +
        (case
          when c.area_m2 is not null and o.area_m2 is not null and o.area_m2 > 0
          then greatest(0::numeric, 2::numeric - abs(c.area_m2 - o.area_m2) / greatest(o.area_m2, 1) * 2)
          else 0::numeric
        end) +
        (case when c.bedrooms is not null and c.bedrooms = o.bedrooms then 1 else 0 end) +
        (case when c.suites is not null and c.suites = o.suites then 1 else 0 end) +
        (case when c.bathrooms is not null and c.bathrooms = o.bathrooms then 1 else 0 end) +
        (case when c.parking_spaces is not null and c.parking_spaces = o.parking_spaces then 1 else 0 end) +
        (case when c.living_rooms is not null and c.living_rooms = o.living_rooms then 1 else 0 end) +
        (case when c.is_furnished is not null and c.is_furnished = o.is_furnished then 1 else 0 end) +
        (case when coalesce(c.finish_standard, '') <> '' and c.finish_standard = o.finish_standard then 1 else 0 end) +
        (case when coalesce(c.construction_type, '') <> '' and c.construction_type = o.construction_type then 1 else 0 end) +
        (case when coalesce(c.city_region, '') <> '' and c.city_region = o.city_region then 1 else 0 end) +
        (case
          when c.distance_to_center_km is not null and o.distance_to_center_km is not null and o.distance_to_center_km > 0
          then greatest(0::numeric, 1::numeric - abs(c.distance_to_center_km - o.distance_to_center_km) / greatest(o.distance_to_center_km, 1))
          else 0::numeric
        end) +
        (coalesce((select count(*) from unnest(coalesce(c.features, '{}')) v where v = any(coalesce(o.features, '{}'))), 0)::numeric * 0.4) +
        (coalesce((select count(*) from unnest(coalesce(c.infrastructure, '{}')) v where v = any(coalesce(o.infrastructure, '{}'))), 0)::numeric * 0.4) +
        (coalesce((select count(*) from unnest(coalesce(c.security_items, '{}')) v where v = any(coalesce(o.security_items, '{}'))), 0)::numeric * 0.4) +
        (coalesce((select count(*) from unnest(coalesce(c.nearby_points, '{}')) v where v = any(coalesce(o.nearby_points, '{}'))), 0)::numeric * 0.3)
      )::numeric as score,
      c.updated_at
    from candidates c
    cross join origin o
  )
  select ranked.id, ranked.score
  from ranked
  order by ranked.score desc, ranked.updated_at desc
  limit greatest(1, least(limit_count, 20));
$$;
