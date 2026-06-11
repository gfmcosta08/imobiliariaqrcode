-- Busca publica escalavel para a home: filtros no banco, paginacao e indices.

create extension if not exists pg_trgm;
create extension if not exists unaccent;
create index if not exists idx_properties_home_public_sort
on public.properties (created_at desc)
where listing_status in ('published', 'printed')
  and purpose in ('sale', 'rent', 'season');
create index if not exists idx_properties_home_public_filters
on public.properties (
  purpose,
  property_type,
  property_subtype,
  city_region,
  is_furnished,
  created_at desc
)
where listing_status in ('published', 'printed')
  and purpose in ('sale', 'rent', 'season');
create index if not exists idx_properties_home_numeric_filters
on public.properties (
  bedrooms,
  suites,
  bathrooms,
  parking_spaces,
  living_rooms,
  built_area_m2,
  land_area_m2,
  sale_price,
  rent_price,
  condo_fee
)
where listing_status in ('published', 'printed')
  and purpose in ('sale', 'rent', 'season');
create index if not exists idx_properties_home_search_trgm
on public.properties
using gin (
  lower(
    coalesce(title, '') || ' ' ||
    coalesce(public_id, '') || ' ' ||
    coalesce(internal_code, '') || ' ' ||
    coalesce(property_type, '') || ' ' ||
    coalesce(property_subtype, '') || ' ' ||
    coalesce(neighborhood, '') || ' ' ||
    coalesce(city, '') || ' ' ||
    coalesce(state, '') || ' ' ||
    coalesce(city_region, '') || ' ' ||
    coalesce(full_address, '') || ' ' ||
    coalesce(full_description, '') || ' ' ||
    coalesce(highlights, '')
  ) gin_trgm_ops
)
where listing_status in ('published', 'printed')
  and purpose in ('sale', 'rent', 'season');
create or replace function public.search_public_home_properties(
  p_q text default null,
  p_purpose text default null,
  p_property_type text default null,
  p_property_subtype text default null,
  p_furnished boolean default null,
  p_floor_type text default null,
  p_sun_position text default null,
  p_city_region text default null,
  p_built_area_min numeric default null,
  p_built_area_max numeric default null,
  p_land_area_min numeric default null,
  p_land_area_max numeric default null,
  p_bedrooms_min integer default null,
  p_bedrooms_max integer default null,
  p_suites_min integer default null,
  p_suites_max integer default null,
  p_bathrooms_min integer default null,
  p_bathrooms_max integer default null,
  p_sale_price_min numeric default null,
  p_sale_price_max numeric default null,
  p_rent_price_min numeric default null,
  p_rent_price_max numeric default null,
  p_condo_fee_min numeric default null,
  p_condo_fee_max numeric default null,
  p_parking_spaces_min integer default null,
  p_parking_spaces_max integer default null,
  p_living_rooms_min integer default null,
  p_living_rooms_max integer default null,
  p_limit integer default 60,
  p_offset integer default 0
)
returns table (
  id uuid,
  public_id text,
  title text,
  internal_code text,
  listing_status text,
  purpose text,
  property_type text,
  property_subtype text,
  city text,
  state text,
  neighborhood text,
  city_region text,
  full_address text,
  full_description text,
  highlights text,
  built_area_m2 numeric,
  land_area_m2 numeric,
  total_area_m2 numeric,
  bedrooms integer,
  suites integer,
  bathrooms integer,
  parking_spaces integer,
  living_rooms integer,
  sale_price numeric,
  rent_price numeric,
  condo_fee numeric,
  is_furnished boolean,
  furnishing_status text,
  floor_type text,
  sun_position text,
  expires_at timestamptz,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select p.*
    from public.properties p
    where p.listing_status in ('published', 'printed')
      and p.purpose in ('sale', 'rent', 'season')
      and (p.expires_at is null or p.expires_at > now())
      and (
        nullif(btrim(p_q), '') is null
        or lower(
          unaccent(
            concat_ws(
              ' ',
              p.title,
              p.public_id,
              p.internal_code,
              p.property_type,
              p.property_subtype,
              p.neighborhood,
              p.city,
              p.state,
              p.city_region,
              p.full_address,
              p.full_description,
              p.highlights,
              array_to_string(p.nearby_points, ' ')
            )
          )
        ) like '%' || lower(unaccent(btrim(p_q))) || '%'
      )
      and (
        nullif(btrim(p_purpose), '') is null
        or (p_purpose = 'sale' and p.purpose = 'sale')
        or (p_purpose = 'rent' and p.purpose in ('rent', 'season'))
      )
      and (nullif(btrim(p_property_type), '') is null or p.property_type = btrim(p_property_type))
      and (nullif(btrim(p_property_subtype), '') is null or p.property_subtype = btrim(p_property_subtype))
      and (p_furnished is null or p.is_furnished = p_furnished)
      and (nullif(btrim(p_floor_type), '') is null or p.floor_type = btrim(p_floor_type))
      and (nullif(btrim(p_sun_position), '') is null or p.sun_position = btrim(p_sun_position))
      and (nullif(btrim(p_city_region), '') is null or p.city_region = btrim(p_city_region))
      and (p_built_area_min is null or p.built_area_m2 >= p_built_area_min)
      and (p_built_area_max is null or p.built_area_m2 <= p_built_area_max)
      and (p_land_area_min is null or p.land_area_m2 >= p_land_area_min)
      and (p_land_area_max is null or p.land_area_m2 <= p_land_area_max)
      and (p_bedrooms_min is null or p.bedrooms >= p_bedrooms_min)
      and (p_bedrooms_max is null or p.bedrooms <= p_bedrooms_max)
      and (p_suites_min is null or p.suites >= p_suites_min)
      and (p_suites_max is null or p.suites <= p_suites_max)
      and (p_bathrooms_min is null or p.bathrooms >= p_bathrooms_min)
      and (p_bathrooms_max is null or p.bathrooms <= p_bathrooms_max)
      and (p_sale_price_min is null or p.sale_price >= p_sale_price_min)
      and (p_sale_price_max is null or p.sale_price <= p_sale_price_max)
      and (p_rent_price_min is null or p.rent_price >= p_rent_price_min)
      and (p_rent_price_max is null or p.rent_price <= p_rent_price_max)
      and (p_condo_fee_min is null or p.condo_fee >= p_condo_fee_min)
      and (p_condo_fee_max is null or p.condo_fee <= p_condo_fee_max)
      and (p_parking_spaces_min is null or p.parking_spaces >= p_parking_spaces_min)
      and (p_parking_spaces_max is null or p.parking_spaces <= p_parking_spaces_max)
      and (p_living_rooms_min is null or p.living_rooms >= p_living_rooms_min)
      and (p_living_rooms_max is null or p.living_rooms <= p_living_rooms_max)
  )
  select
    filtered.id,
    filtered.public_id,
    filtered.title,
    filtered.internal_code,
    filtered.listing_status,
    filtered.purpose,
    filtered.property_type,
    filtered.property_subtype,
    filtered.city,
    filtered.state,
    filtered.neighborhood,
    filtered.city_region,
    filtered.full_address,
    filtered.full_description,
    filtered.highlights,
    filtered.built_area_m2,
    filtered.land_area_m2,
    filtered.total_area_m2,
    filtered.bedrooms,
    filtered.suites,
    filtered.bathrooms,
    filtered.parking_spaces,
    filtered.living_rooms,
    filtered.sale_price,
    filtered.rent_price,
    filtered.condo_fee,
    filtered.is_furnished,
    filtered.furnishing_status,
    filtered.floor_type,
    filtered.sun_position,
    filtered.expires_at,
    filtered.created_at,
    count(*) over () as total_count
  from filtered
  order by filtered.created_at desc nulls last, filtered.id desc
  limit greatest(1, least(coalesce(p_limit, 60), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;
revoke all on function public.search_public_home_properties(
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer
) from public;
grant execute on function public.search_public_home_properties(
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer
) to service_role;
create or replace function public.get_public_home_filter_options()
returns table (
  property_types text[],
  property_subtypes text[],
  floor_types text[],
  sun_positions text[],
  city_regions text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select p.*
    from public.properties p
    where p.listing_status in ('published', 'printed')
      and p.purpose in ('sale', 'rent', 'season')
      and (p.expires_at is null or p.expires_at > now())
  )
  select
    array(select value from (select distinct property_type as value from eligible where nullif(btrim(property_type), '') is not null) s order by value),
    array(select value from (select distinct property_subtype as value from eligible where nullif(btrim(property_subtype), '') is not null) s order by value),
    array(select value from (select distinct floor_type as value from eligible where nullif(btrim(floor_type), '') is not null) s order by value),
    array(select value from (select distinct sun_position as value from eligible where nullif(btrim(sun_position), '') is not null) s order by value),
    array(select value from (select distinct city_region as value from eligible where nullif(btrim(city_region), '') is not null) s order by value);
$$;
revoke all on function public.get_public_home_filter_options() from public;
grant execute on function public.get_public_home_filter_options() to service_role;
