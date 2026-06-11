import type { ExtratorListing } from "./extrator-types";
import { isPropertyImportImageUrl, rankPropertyImportImageUrls } from "./import-image-url";

/** Subconjunto alinhado a `PropertyFormPayload` do app web (sem dependência circular). */
export type MappedPropertyPayload = {
  title: string | null;
  internal_code: string | null;
  property_type: string | null;
  property_subtype: string | null;
  purpose: "sale" | "rent" | "season" | null;
  listing_status: string;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  full_address: string | null;
  location_map_url: string | null;
  description: string | null;
  full_description: string | null;
  broker_notes: string | null;
  sale_price: number | null;
  rent_price: number | null;
  price: number | null;
  condo_fee: number | null;
  iptu_amount: number | null;
  total_area_m2: number | null;
  built_area_m2: number | null;
  land_area_m2: number | null;
  area_m2: number | null;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  features: string[] | null;
  import_source_url: string;
  import_image_urls: string[];
};

const SUBTYPE_ALIASES: Record<string, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  sobrado: "Sobrado",
  terreno: "Terreno",
  kitnet: "Kitnet/Studio",
  kitinete: "Kitnet/Studio",
  chácara: "Chácara",
  chacara: "Chácara",
  galpão: "Galpão",
  galpao: "Galpão",
  flat: "Flat",
  sala: "Loja",
  lote: "Lote",
};

function parseMoney(value: string | null | undefined): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/\s/g, "")
    .replace(/[R$]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

function parseArea(value: string | null | undefined): number | null {
  return parseMoney(value);
}

function normalizeSubtype(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return SUBTYPE_ALIASES[text.toLowerCase()] ?? text;
}

function inferPropertyType(subtype: string | null): string | null {
  if (!subtype) return "Residencial";
  const commercial = ["Loja", "Galpão", "Sala"];
  if (commercial.some((c) => subtype.toLowerCase().includes(c.toLowerCase()))) return "Comercial";
  if (subtype === "Terreno" || subtype === "Lote") return "Terreno";
  return "Residencial";
}

function resolvePurpose(
  listing: ExtratorListing,
  salePrice: number | null,
  rentPrice: number | null,
): "sale" | "rent" | "season" | null {
  if (salePrice != null && rentPrice != null) return null;
  if (salePrice != null) return "sale";
  if (rentPrice != null) return "rent";
  if (listing.purpose === "sale" || listing.purpose === "rent") return listing.purpose;
  return null;
}

export function mapExtratorListingToPropertyPayload(
  listing: ExtratorListing,
  sourceUrl: string,
): MappedPropertyPayload {
  const salePrice = parseMoney(listing.sale_price);
  const rentPrice = parseMoney(listing.rent_price);
  const purpose = resolvePurpose(listing, salePrice, rentPrice);
  const totalArea = parseArea(listing.area_m2);
  const property_subtype = normalizeSubtype(listing.property_subtype);
  const title = listing.title?.trim() || null;
  const description = listing.full_description?.trim() || listing.description?.trim() || null;
  const sourceHostname = (() => {
    try {
      return new URL(sourceUrl).hostname;
    } catch {
      return undefined;
    }
  })();

  const imageUrls = rankPropertyImportImageUrls(
    listing.images.map((img) => img.url?.trim() ?? "").filter(Boolean),
    sourceHostname,
  ).slice(0, 10);

  return {
    title,
    internal_code: listing.internal_code?.trim() || null,
    property_type: inferPropertyType(property_subtype),
    property_subtype,
    purpose,
    listing_status: "draft",
    city: listing.city?.trim() || null,
    state: listing.state?.trim() || null,
    neighborhood: listing.neighborhood?.trim() || null,
    postal_code: listing.postal_code?.trim() || null,
    full_address: listing.full_address?.trim() || null,
    location_map_url: null,
    description,
    full_description: description,
    broker_notes: `Importado automaticamente de ${sourceUrl}\nGeolocalização pendente: informe o link do mapa antes de publicar.`,
    sale_price: salePrice,
    rent_price: rentPrice,
    price:
      purpose === "sale" ? salePrice : purpose === "rent" ? rentPrice : (salePrice ?? rentPrice),
    condo_fee: parseMoney(listing.condo_fee),
    iptu_amount: parseMoney(listing.iptu_amount),
    total_area_m2: totalArea,
    built_area_m2: parseArea(listing.built_area_m2),
    land_area_m2: parseArea(listing.land_area_m2),
    area_m2: totalArea,
    bedrooms: listing.bedrooms,
    suites: listing.suites,
    bathrooms: listing.bathrooms,
    parking_spaces: listing.parking_spaces,
    features: null,
    import_source_url: sourceUrl,
    import_image_urls: imageUrls,
  };
}
