import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CITY_REGIONS,
  PROPERTY_SUBTYPES,
  PROPERTY_TYPES,
  SUN_POSITIONS,
} from "@/lib/property-options";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type HomePurposeFilter = "sale" | "rent" | null;

export type HomePropertyFilters = {
  q: string;
  purpose: HomePurposeFilter;
  property_type: string;
  property_subtype: string;
  furnished: "" | "true" | "false";
  floor_type: string;
  sun_position: string;
  city_region: string;
  built_area_min: number | null;
  built_area_max: number | null;
  land_area_min: number | null;
  land_area_max: number | null;
  bedrooms_min: number | null;
  bedrooms_max: number | null;
  suites_min: number | null;
  suites_max: number | null;
  bathrooms_min: number | null;
  bathrooms_max: number | null;
  sale_price_min: number | null;
  sale_price_max: number | null;
  rent_price_min: number | null;
  rent_price_max: number | null;
  condo_fee_min: number | null;
  condo_fee_max: number | null;
  parking_spaces_min: number | null;
  parking_spaces_max: number | null;
  living_rooms_min: number | null;
  living_rooms_max: number | null;
};

export type HomePropertyCard = {
  id: string;
  public_id: string;
  qr_token: string | null;
  title: string | null;
  purpose: string | null;
  property_type: string | null;
  property_subtype: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  city_region: string | null;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  living_rooms: number | null;
  built_area_m2: number | null;
  land_area_m2: number | null;
  total_area_m2: number | null;
  sale_price: number | null;
  rent_price: number | null;
  condo_fee: number | null;
  is_furnished: boolean | null;
  furnishing_status: string | null;
  floor_type: string | null;
  sun_position: string | null;
  image_url: string | null;
  detail_href: string;
  search_text: string;
};

export type PublicPropertyDetail = HomePropertyCard & {
  full_description: string | null;
  highlights: string | null;
  images: string[];
};

export type HomeFilterOptions = {
  propertyTypes: string[];
  propertySubtypes: string[];
  floorTypes: string[];
  sunPositions: string[];
  cityRegions: string[];
};

export type HomePropertiesResult = {
  filters: HomePropertyFilters;
  items: HomePropertyCard[];
  totalEligible: number;
  options: HomeFilterOptions;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

type PropertyRow = {
  id: string;
  public_id: string;
  title: string | null;
  internal_code: string | null;
  listing_status: string | null;
  purpose: string | null;
  property_type: string | null;
  property_subtype: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  city_region: string | null;
  full_address: string | null;
  full_description: string | null;
  highlights: string | null;
  built_area_m2: number | string | null;
  land_area_m2: number | string | null;
  total_area_m2: number | string | null;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  living_rooms: number | null;
  sale_price: number | string | null;
  rent_price: number | string | null;
  condo_fee: number | string | null;
  is_furnished: boolean | null;
  furnishing_status: string | null;
  floor_type: string | null;
  sun_position: string | null;
  expires_at: string | null;
  created_at: string | null;
};

type MediaRow = {
  property_id: string;
  storage_path: string;
};

type QrRow = {
  property_id: string;
  qr_token: string;
};

type SearchRpcRow = PropertyRow & {
  total_count: number | string | null;
};

type OptionsRpcRow = {
  property_types: string[] | null;
  property_subtypes: string[] | null;
  floor_types: string[] | null;
  sun_positions: string[] | null;
  city_regions: string[] | null;
};

const SELECT_FIELDS =
  "id, public_id, title, internal_code, listing_status, purpose, property_type, property_subtype, city, state, neighborhood, city_region, full_address, full_description, highlights, built_area_m2, land_area_m2, total_area_m2, bedrooms, suites, bathrooms, parking_spaces, living_rooms, sale_price, rent_price, condo_fee, is_furnished, furnishing_status, floor_type, sun_position, expires_at, created_at";

const HOME_PAGE_SIZE = 60;

export function parseHomeFilters(
  searchParams?: URLSearchParams | RawSearchParams,
): HomePropertyFilters {
  const get = (key: string): string => {
    if (!searchParams) return "";
    if (searchParams instanceof URLSearchParams) return searchParams.get(key)?.trim() ?? "";
    const value = searchParams[key];
    const raw = Array.isArray(value) ? value[0] : value;
    return String(raw ?? "").trim();
  };

  const purposeRaw = get("purpose");
  const furnishedRaw = get("furnished");

  return {
    q: get("q"),
    purpose: purposeRaw === "sale" || purposeRaw === "rent" ? purposeRaw : null,
    property_type: get("property_type"),
    property_subtype: get("property_subtype"),
    furnished: furnishedRaw === "true" || furnishedRaw === "false" ? furnishedRaw : "",
    floor_type: get("floor_type"),
    sun_position: get("sun_position"),
    city_region: get("city_region"),
    built_area_min: parseNumber(get("built_area_min")),
    built_area_max: parseNumber(get("built_area_max")),
    land_area_min: parseNumber(get("land_area_min")),
    land_area_max: parseNumber(get("land_area_max")),
    bedrooms_min: parseNumber(get("bedrooms_min")),
    bedrooms_max: parseNumber(get("bedrooms_max")),
    suites_min: parseNumber(get("suites_min")),
    suites_max: parseNumber(get("suites_max")),
    bathrooms_min: parseNumber(get("bathrooms_min")),
    bathrooms_max: parseNumber(get("bathrooms_max")),
    sale_price_min: parseNumber(get("sale_price_min")),
    sale_price_max: parseNumber(get("sale_price_max")),
    rent_price_min: parseNumber(get("rent_price_min")),
    rent_price_max: parseNumber(get("rent_price_max")),
    condo_fee_min: parseNumber(get("condo_fee_min")),
    condo_fee_max: parseNumber(get("condo_fee_max")),
    parking_spaces_min: parseNumber(get("parking_spaces_min")),
    parking_spaces_max: parseNumber(get("parking_spaces_max")),
    living_rooms_min: parseNumber(get("living_rooms_min")),
    living_rooms_max: parseNumber(get("living_rooms_max")),
  };
}

export function applyHomePropertyFilters(
  rows: HomePropertyCard[],
  filters: HomePropertyFilters,
): HomePropertyCard[] {
  const query = normalizeSearch(filters.q);

  return rows.filter((row) => {
    if (filters.purpose === "sale" && row.purpose !== "sale") return false;
    if (filters.purpose === "rent" && row.purpose !== "rent" && row.purpose !== "season") {
      return false;
    }

    if (filters.property_type && row.property_type !== filters.property_type) return false;
    if (filters.property_subtype && row.property_subtype !== filters.property_subtype) return false;
    if (filters.floor_type && row.floor_type !== filters.floor_type) return false;
    if (filters.sun_position && row.sun_position !== filters.sun_position) return false;
    if (filters.city_region && row.city_region !== filters.city_region) return false;
    if (filters.furnished === "true" && row.is_furnished !== true) return false;
    if (filters.furnished === "false" && row.is_furnished !== false) return false;

    if (!inRange(row.built_area_m2, filters.built_area_min, filters.built_area_max)) return false;
    if (!inRange(row.land_area_m2, filters.land_area_min, filters.land_area_max)) return false;
    if (!inRange(row.bedrooms, filters.bedrooms_min, filters.bedrooms_max)) return false;
    if (!inRange(row.suites, filters.suites_min, filters.suites_max)) return false;
    if (!inRange(row.bathrooms, filters.bathrooms_min, filters.bathrooms_max)) return false;
    if (!inRange(row.sale_price, filters.sale_price_min, filters.sale_price_max)) return false;
    if (!inRange(row.rent_price, filters.rent_price_min, filters.rent_price_max)) return false;
    if (!inRange(row.condo_fee, filters.condo_fee_min, filters.condo_fee_max)) return false;
    if (!inRange(row.parking_spaces, filters.parking_spaces_min, filters.parking_spaces_max)) {
      return false;
    }
    if (!inRange(row.living_rooms, filters.living_rooms_min, filters.living_rooms_max)) {
      return false;
    }

    if (!query) return true;
    return buildSearchText(row).includes(query);
  });
}

export function buildHomeHref(overrides: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(overrides)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/?${query}#imoveis` : "/#imoveis";
}

export async function loadHomeProperties(
  searchParams?: RawSearchParams,
): Promise<HomePropertiesResult> {
  const filters = parseHomeFilters(searchParams);
  const supabase = createServiceRoleClient();

  const rpcResult = await loadHomePropertiesFromRpc(supabase, filters);
  if (rpcResult) return rpcResult;

  return loadHomePropertiesLegacy(supabase, filters);
}

async function loadHomePropertiesFromRpc(
  supabase: SupabaseClient,
  filters: HomePropertyFilters,
): Promise<HomePropertiesResult | null> {
  const { data, error } = await supabase.rpc("search_public_home_properties", {
    p_q: filters.q || null,
    p_purpose: filters.purpose,
    p_property_type: filters.property_type || null,
    p_property_subtype: filters.property_subtype || null,
    p_furnished: filters.furnished === "true" ? true : filters.furnished === "false" ? false : null,
    p_floor_type: filters.floor_type || null,
    p_sun_position: filters.sun_position || null,
    p_city_region: filters.city_region || null,
    p_built_area_min: filters.built_area_min,
    p_built_area_max: filters.built_area_max,
    p_land_area_min: filters.land_area_min,
    p_land_area_max: filters.land_area_max,
    p_bedrooms_min: filters.bedrooms_min,
    p_bedrooms_max: filters.bedrooms_max,
    p_suites_min: filters.suites_min,
    p_suites_max: filters.suites_max,
    p_bathrooms_min: filters.bathrooms_min,
    p_bathrooms_max: filters.bathrooms_max,
    p_sale_price_min: filters.sale_price_min,
    p_sale_price_max: filters.sale_price_max,
    p_rent_price_min: filters.rent_price_min,
    p_rent_price_max: filters.rent_price_max,
    p_condo_fee_min: filters.condo_fee_min,
    p_condo_fee_max: filters.condo_fee_max,
    p_parking_spaces_min: filters.parking_spaces_min,
    p_parking_spaces_max: filters.parking_spaces_max,
    p_living_rooms_min: filters.living_rooms_min,
    p_living_rooms_max: filters.living_rooms_max,
    p_limit: HOME_PAGE_SIZE,
    p_offset: 0,
  });

  if (error) return null;

  const rows = (data ?? []) as SearchRpcRow[];
  const cards = rows.map(toCard);
  const totalEligible = rows.length ? Number(rows[0]?.total_count ?? rows.length) : 0;
  const propertyIds = cards.map((item) => item.id);
  const [mediaByProperty, qrByProperty, options] = await Promise.all([
    loadPrimaryMediaUrls(supabase, propertyIds),
    loadQrTokens(supabase, propertyIds),
    loadFilterOptions(supabase, cards),
  ]);

  const items = cards.map((item) => ({
    ...item,
    image_url: mediaByProperty.get(item.id) ?? null,
    qr_token: qrByProperty.get(item.id) ?? null,
  }));

  return {
    filters,
    items,
    totalEligible,
    options,
  };
}

async function loadHomePropertiesLegacy(
  supabase: SupabaseClient,
  filters: HomePropertyFilters,
): Promise<HomePropertiesResult> {
  const { data, error } = await supabase
    .from("properties")
    .select(SELECT_FIELDS)
    .in("listing_status", ["published", "printed"])
    .in("purpose", ["sale", "rent", "season"])
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  const eligible = ((data ?? []) as PropertyRow[]).filter(isPubliclyEligible).map(toCard);
  const propertyIds = eligible.map((item) => item.id);
  const [mediaByProperty, qrByProperty] = await Promise.all([
    loadPrimaryMediaUrls(supabase, propertyIds),
    loadQrTokens(supabase, propertyIds),
  ]);

  const withMedia = eligible.map((item) => ({
    ...item,
    image_url: mediaByProperty.get(item.id) ?? null,
    qr_token: qrByProperty.get(item.id) ?? null,
  }));

  return {
    filters,
    items: applyHomePropertyFilters(withMedia, filters),
    totalEligible: withMedia.length,
    options: buildFilterOptions(withMedia),
  };
}

export async function loadPublicPropertyDetail(
  publicId: string,
): Promise<PublicPropertyDetail | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("properties")
    .select(SELECT_FIELDS)
    .eq("public_id", publicId)
    .in("listing_status", ["published", "printed"])
    .in("purpose", ["sale", "rent", "season"])
    .maybeSingle();

  if (error || !data || !isPubliclyEligible(data as PropertyRow)) return null;

  const card = toCard(data as PropertyRow);
  const [imagesByProperty, qrByProperty] = await Promise.all([
    loadAllMediaUrls(supabase, [card.id]),
    loadQrTokens(supabase, [card.id]),
  ]);
  const images = imagesByProperty.get(card.id) ?? [];

  return {
    ...card,
    image_url: images[0] ?? null,
    qr_token: qrByProperty.get(card.id) ?? null,
    images,
    full_description: (data as PropertyRow).full_description,
    highlights: (data as PropertyRow).highlights,
  };
}

function parseNumber(value: string): number | null {
  if (!value) return null;
  const normalized = value
    .replace(/\s/g, "")
    .replace(/[R$]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function numeric(value: number | string | null): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function inRange(value: number | null, min: number | null, max: number | null): boolean {
  if (min == null && max == null) return true;
  if (value == null) return false;
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

function normalizeSearch(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function buildSearchText(row: HomePropertyCard): string {
  return row.search_text;
}

function buildRowSearchText(row: PropertyRow): string {
  return normalizeSearch(
    [
      row.title,
      row.public_id,
      row.internal_code,
      row.property_type,
      row.property_subtype,
      row.neighborhood,
      row.city,
      row.state,
      row.city_region,
      row.full_address,
    ].join(" "),
  );
}

function toCard(row: PropertyRow): HomePropertyCard {
  return {
    id: row.id,
    public_id: row.public_id,
    qr_token: null,
    title: row.title,
    purpose: row.purpose,
    property_type: row.property_type,
    property_subtype: row.property_subtype,
    city: row.city,
    state: row.state,
    neighborhood: row.neighborhood,
    city_region: row.city_region,
    bedrooms: row.bedrooms,
    suites: row.suites,
    bathrooms: row.bathrooms,
    parking_spaces: row.parking_spaces,
    living_rooms: row.living_rooms,
    built_area_m2: numeric(row.built_area_m2),
    land_area_m2: numeric(row.land_area_m2),
    total_area_m2: numeric(row.total_area_m2),
    sale_price: numeric(row.sale_price),
    rent_price: numeric(row.rent_price),
    condo_fee: numeric(row.condo_fee),
    is_furnished: row.is_furnished,
    furnishing_status: row.furnishing_status,
    floor_type: row.floor_type,
    sun_position: row.sun_position,
    image_url: null,
    detail_href: `/imoveis/${encodeURIComponent(row.public_id)}`,
    search_text: buildRowSearchText(row),
  };
}

function isPubliclyEligible(row: PropertyRow): boolean {
  if (row.listing_status !== "published" && row.listing_status !== "printed") return false;
  if (row.purpose !== "sale" && row.purpose !== "rent" && row.purpose !== "season") return false;
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > Date.now();
}

function buildFilterOptions(rows: HomePropertyCard[]): HomeFilterOptions {
  return {
    propertyTypes: [...PROPERTY_TYPES],
    propertySubtypes: [...PROPERTY_SUBTYPES],
    floorTypes: uniqueSorted(rows.map((row) => row.floor_type)),
    sunPositions: [...SUN_POSITIONS],
    cityRegions: [...CITY_REGIONS],
  };
}

async function loadFilterOptions(
  supabase: SupabaseClient,
  fallbackRows: HomePropertyCard[],
): Promise<HomeFilterOptions> {
  const { data, error } = await supabase.rpc("get_public_home_filter_options").maybeSingle();
  if (error || !data) return buildFilterOptions(fallbackRows);

  const row = data as OptionsRpcRow;
  return {
    propertyTypes: [...PROPERTY_TYPES],
    propertySubtypes: [...PROPERTY_SUBTYPES],
    floorTypes: uniqueSorted(row.floor_types ?? []),
    sunPositions: [...SUN_POSITIONS],
    cityRegions: [...CITY_REGIONS],
  };
}

function uniqueSorted(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
}

async function loadPrimaryMediaUrls(
  supabase: SupabaseClient,
  propertyIds: string[],
): Promise<Map<string, string>> {
  const allUrls = await loadAllMediaUrls(supabase, propertyIds, true);
  return new Map(Array.from(allUrls.entries()).map(([propertyId, urls]) => [propertyId, urls[0]]));
}

async function loadAllMediaUrls(
  supabase: SupabaseClient,
  propertyIds: string[],
  onlyFirst = false,
): Promise<Map<string, string[]>> {
  if (!propertyIds.length) return new Map();

  const { data } = await supabase
    .from("property_media")
    .select("property_id, storage_path")
    .in("property_id", propertyIds)
    .eq("status", "ready")
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as MediaRow[];
  const urls = new Map<string, string[]>();

  for (const row of rows) {
    if (onlyFirst && urls.has(row.property_id)) continue;
    const signed = await supabase.storage
      .from("property-media")
      .createSignedUrl(row.storage_path, 3600);
    if (signed.error || !signed.data?.signedUrl) continue;
    const list = urls.get(row.property_id) ?? [];
    list.push(signed.data.signedUrl);
    urls.set(row.property_id, list);
  }

  return urls;
}

async function loadQrTokens(
  supabase: SupabaseClient,
  propertyIds: string[],
): Promise<Map<string, string>> {
  if (!propertyIds.length) return new Map();
  const { data } = await supabase
    .from("property_qrcodes")
    .select("property_id, qr_token")
    .in("property_id", propertyIds)
    .eq("is_active", true);

  return new Map((data ?? []).map((row: QrRow) => [row.property_id, row.qr_token]));
}
