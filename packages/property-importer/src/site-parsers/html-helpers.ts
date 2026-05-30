import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

export type { CheerioAPI };
export { cheerio };

/** Pick the first non-empty text from a list of CSS selectors. */
export function firstText($: CheerioAPI, selectors: string[]): string {
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    if (text) return text;
  }
  return "";
}

/** Pick the first non-empty attribute value from a list of selector+attr pairs. */
export function firstAttr(
  $: CheerioAPI,
  pairs: Array<{ sel: string; attr: string }>,
): string {
  for (const { sel, attr } of pairs) {
    const val = $(sel).first().attr(attr)?.trim();
    if (val) return val;
  }
  return "";
}

/**
 * Collect all image URLs matching any of the given selectors.
 * Resolves relative URLs against baseUrl when provided.
 */
export function collectImages(
  $: CheerioAPI,
  selectors: string[],
  baseUrl?: string,
): Array<{ url: string }> {
  const seen = new Set<string>();
  const results: Array<{ url: string }> = [];

  const resolve = (raw: string | undefined): string | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("data:")) return null;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    if (baseUrl && trimmed.startsWith("/")) {
      try {
        return new URL(trimmed, baseUrl).toString();
      } catch {
        return null;
      }
    }
    return null;
  };

  for (const sel of selectors) {
    $(sel).each((_i, el) => {
      const $el = $(el);
      const candidates = [
        $el.attr("src"),
        $el.attr("data-src"),
        $el.attr("data-lazy"),
        $el.attr("data-original"),
        $el.attr("data-full"),
        $el.attr("data-zoom"),
        $el.attr("data-image"),
        $el.attr("data-url"),
        $el.attr("content"),
      ];
      for (const raw of candidates) {
        const url = resolve(raw);
        if (url && !seen.has(url)) {
          seen.add(url);
          results.push({ url });
        }
      }
    });
  }
  return results;
}

/**
 * Parse a Brazilian price string like "R$ 450.000" or "450000" into a string
 * suitable for ExtratorListing fields (they store as string).
 */
export function extractPrice(text: string): string {
  return text.replace(/[^\d,.]/g, "").trim();
}

/** Extract a numeric value (bedrooms, area, etc.) from a string. */
export function extractNumber(text: string): number | null {
  const match = text.replace(/[^\d]/g, "").match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Clean and normalize description text:
 * - Remove leading/trailing whitespace
 * - Collapse multiple blank lines
 * - Remove common UI noise like "Ver mais", "Ver menos"
 */
export function cleanDescription(raw: string): string {
  return raw
    .replace(/\bver mais\b/gi, "")
    .replace(/\bver menos\b/gi, "")
    .replace(/\bsaiba mais\b/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extract city and state from a breadcrumb or location string like "Palmas - TO". */
export function parseCityState(text: string): { city: string; state: string } {
  const match = text.match(/([^,\-–]+)[\s]*[-–,][\s]*([A-Z]{2})/);
  if (match) {
    return { city: match[1].trim(), state: match[2].trim() };
  }
  return { city: text.trim(), state: "" };
}

/** Extract the hostname from a URL string. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}
