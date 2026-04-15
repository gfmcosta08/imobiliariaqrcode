export type PropertyFormPayload = {
  title: string | null;
  internal_code: string | null;
  property_type: string | null;
  property_subtype: string | null;
  purpose: "sale" | "rent" | null;
  listing_status: string;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  full_address: string | null;
  street_number: string | null;
  address_complement: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  full_description: string | null;
  highlights: string | null;
  broker_notes: string | null;
  sale_price: number | null;
  rent_price: number | null;
  price: number | null;
  condo_fee: number | null;
  iptu_amount: number | null;
  other_fees: number | null;
  accepts_financing: boolean | null;
  accepts_trade: boolean | null;
  total_area_m2: number | null;
  built_area_m2: number | null;
  land_area_m2: number | null;
  area_m2: number | null;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  living_rooms: number | null;
  floors_count: number | null;
  unit_floor: number | null;
  is_furnished: boolean | null;
  floor_type: string | null;
  sun_position: string | null;
  property_age_years: number | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  listing_broker_name: string | null;
  listing_broker_phone: string | null;
  listing_broker_email: string | null;
  features: string[] | null;
  infrastructure: string[] | null;
  security_items: string[] | null;
  key_available: boolean | null;
  is_occupied: boolean | null;
  documentation: string | null;
  technical_details: string | null;
  construction_type: string | null;
  finish_standard: string | null;
  registry_number: string | null;
  documentation_status: string | null;
  has_deed: boolean | null;
  has_registration: boolean | null;
  nearby_points: string[] | null;
  distance_to_center_km: number | null;
  city_region: string | null;
};

function nullableText(value: FormDataEntryValue | null): string | null {
  const txt = String(value ?? "").trim();
  return txt === "" ? null : txt;
}

function parseDecimalInput(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const normalized = raw
    .replace(/\s/g, "")
    .replace(/[R$]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

function parseIntegerInput(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  const normalized = raw.replace(/\D/g, "");
  if (!normalized) {
    return null;
  }
  const num = Number.parseInt(normalized, 10);
  return Number.isFinite(num) ? num : null;
}

function parseTriState(value: FormDataEntryValue | null): boolean | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) {
    return null;
  }
  if (raw === "true" || raw === "sim" || raw === "yes") {
    return true;
  }
  if (raw === "false" || raw === "nao" || raw === "não" || raw === "no") {
    return false;
  }
  return null;
}

function parseTextList(value: FormDataEntryValue | null): string[] | null {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  const items = raw
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : null;
}

export function buildPropertyPayload(formData: FormData): PropertyFormPayload {
  const purposeRaw = String(formData.get("purpose") ?? "").trim();
  const purpose = purposeRaw === "sale" || purposeRaw === "rent" ? purposeRaw : null;

  const listingStatusRaw = String(formData.get("listing_status") ?? "").trim();
  const listing_status =
    listingStatusRaw === "published" ||
    listingStatusRaw === "printed" ||
    listingStatusRaw === "expired" ||
    listingStatusRaw === "removed" ||
    listingStatusRaw === "blocked"
      ? listingStatusRaw
      : "draft";

  const salePrice = parseDecimalInput(formData.get("sale_price"));
  const rentPrice = parseDecimalInput(formData.get("rent_price"));
  const totalArea = parseDecimalInput(formData.get("total_area_m2"));
  const fullDescription = nullableText(formData.get("full_description"));
  const legacyDescription = nullableText(formData.get("description"));

  const payload: PropertyFormPayload = {
    title: nullableText(formData.get("title")),
    internal_code: nullableText(formData.get("internal_code")),
    property_type: nullableText(formData.get("property_type")),
    property_subtype: nullableText(formData.get("property_subtype")),
    purpose,
    listing_status,
    city: nullableText(formData.get("city")),
    state: nullableText(formData.get("state")),
    neighborhood: nullableText(formData.get("neighborhood")),
    postal_code: nullableText(formData.get("postal_code")),
    full_address: nullableText(formData.get("full_address")),
    street_number: nullableText(formData.get("street_number")),
    address_complement: nullableText(formData.get("address_complement")),
    latitude: parseDecimalInput(formData.get("latitude")),
    longitude: parseDecimalInput(formData.get("longitude")),
    description: fullDescription ?? legacyDescription,
    full_description: fullDescription ?? legacyDescription,
    highlights: nullableText(formData.get("highlights")),
    broker_notes: nullableText(formData.get("broker_notes")),
    sale_price: salePrice,
    rent_price: rentPrice,
    price: purpose === "rent" ? rentPrice : salePrice,
    condo_fee: parseDecimalInput(formData.get("condo_fee")),
    iptu_amount: parseDecimalInput(formData.get("iptu_amount")),
    other_fees: parseDecimalInput(formData.get("other_fees")),
    accepts_financing: parseTriState(formData.get("accepts_financing")),
    accepts_trade: parseTriState(formData.get("accepts_trade")),
    total_area_m2: totalArea,
    built_area_m2: parseDecimalInput(formData.get("built_area_m2")),
    land_area_m2: parseDecimalInput(formData.get("land_area_m2")),
    area_m2: totalArea,
    bedrooms: parseIntegerInput(formData.get("bedrooms")),
    suites: parseIntegerInput(formData.get("suites")),
    bathrooms: parseIntegerInput(formData.get("bathrooms")),
    parking_spaces: parseIntegerInput(formData.get("parking_spaces")),
    living_rooms: parseIntegerInput(formData.get("living_rooms")),
    floors_count: parseIntegerInput(formData.get("floors_count")),
    unit_floor: parseIntegerInput(formData.get("unit_floor")),
    is_furnished: parseTriState(formData.get("is_furnished")),
    floor_type: nullableText(formData.get("floor_type")),
    sun_position: nullableText(formData.get("sun_position")),
    property_age_years: parseIntegerInput(formData.get("property_age_years")),
    owner_name: nullableText(formData.get("owner_name")),
    owner_phone: nullableText(formData.get("owner_phone")),
    owner_email: nullableText(formData.get("owner_email")),
    listing_broker_name: nullableText(formData.get("listing_broker_name")),
    listing_broker_phone: nullableText(formData.get("listing_broker_phone")),
    listing_broker_email: nullableText(formData.get("listing_broker_email")),
    features: parseTextList(formData.get("features")),
    infrastructure: parseTextList(formData.get("infrastructure")),
    security_items: parseTextList(formData.get("security_items")),
    key_available: parseTriState(formData.get("key_available")),
    is_occupied: parseTriState(formData.get("is_occupied")),
    documentation: nullableText(formData.get("documentation")),
    technical_details: nullableText(formData.get("technical_details")),
    construction_type: nullableText(formData.get("construction_type")),
    finish_standard: nullableText(formData.get("finish_standard")),
    registry_number: nullableText(formData.get("registry_number")),
    documentation_status: nullableText(formData.get("documentation_status")),
    has_deed: parseTriState(formData.get("has_deed")),
    has_registration: parseTriState(formData.get("has_registration")),
    nearby_points: parseTextList(formData.get("nearby_points")),
    distance_to_center_km: parseDecimalInput(formData.get("distance_to_center_km")),
    city_region: nullableText(formData.get("city_region")),
  };

  return payload;
}
