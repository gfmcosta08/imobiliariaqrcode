import { fetchRenderedHtmlFromExtrator } from "../extrator-client";
import type { ExtratorListing } from "../extrator-types";
import { validateImportUrl } from "../ssrf";
import { detectSiteParser } from "./detect";

const DIRECT_FETCH_TIMEOUT_MS = 30_000;

async function fetchHtmlDirect(url: string): Promise<string | null> {
  try {
    const v = validateImportUrl(url);
    if (!v.ok) return null;
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "accept-language": "pt-BR,pt;q=0.9",
      },
      signal: AbortSignal.timeout(DIRECT_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

function mergeWithDefaults(partial: Partial<ExtratorListing>): ExtratorListing {
  return {
    title: "",
    description: "",
    full_description: "",
    property_subtype: "",
    purpose: "",
    city: "",
    state: "",
    neighborhood: "",
    postal_code: "",
    bedrooms: null,
    suites: null,
    bathrooms: null,
    parking_spaces: null,
    area_m2: "",
    sale_price: "",
    rent_price: "",
    condo_fee: "",
    iptu_amount: "",
    built_area_m2: "",
    land_area_m2: "",
    full_address: "",
    internal_code: "",
    images: [],
    ...partial,
  };
}

/**
 * Try to extract a property listing using the site-specific parser for the given URL.
 * Returns null if no parser is registered for the site.
 */
export async function extractListingWithSiteParser(
  url: string,
  extratorBaseUrl: string,
): Promise<ExtratorListing | null> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }

  const parser = detectSiteParser(hostname);
  if (!parser) return null;

  const html = parser.needsRendering
    ? await fetchRenderedHtmlFromExtrator(extratorBaseUrl, url)
    : await fetchHtmlDirect(url);

  if (!html) return null;

  const partial = parser.parse(html, url);

  if (!partial.title?.trim()) return null;

  return mergeWithDefaults(partial);
}
