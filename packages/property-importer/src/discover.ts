import * as cheerio from "cheerio";

import { looksLikeSingleListingUrl, LISTING_FALLBACK_PATHS, MAX_PROPERTIES_PER_IMPORT } from "./constants";
import { fetchRenderedHtmlFromExtrator } from "./extrator-client";
import { isPropertyDetailUrl, validateImportUrl } from "./ssrf";

function toAbsolute(base: URL, href: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== "https:") return null;
    if (u.hostname.toLowerCase() !== base.hostname.toLowerCase()) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function normalizeDiscoveredUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

export function parsePropertyLinksFromHtml(base: URL, html: string, max: number): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const urls: string[] = [];

  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    const abs = toAbsolute(base, href);
    if (!abs) return;
    const parsed = new URL(abs);
    if (!isPropertyDetailUrl(parsed)) return;
    const normalized = normalizeDiscoveredUrl(abs);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    urls.push(normalized);
  });

  return urls.slice(0, max);
}

function isHomepageUrl(raw: string): boolean {
  try {
    const path = new URL(raw).pathname.replace(/\/+$/, "") || "/";
    return path === "/";
  } catch {
    return false;
  }
}

async function discoverFromRenderedHtml(
  base: URL,
  pageUrl: string,
  max: number,
  extratorBaseUrl: string,
): Promise<string[]> {
  const rendered = await fetchRenderedHtmlFromExtrator(extratorBaseUrl, pageUrl);
  if (!rendered) return [];
  return parsePropertyLinksFromHtml(base, rendered, max);
}

function inferDiscoverMode(base: URL): "single" | "listing" | "homepage" {
  if (isPropertyDetailUrl(base)) return "single";
  const path = base.pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/home" || path === "/index") return "homepage";
  return "listing";
}

export async function discoverPropertyUrls(
  sourceUrl: string,
  options?: {
    max?: number;
    fetchHtml?: (url: string) => Promise<string>;
    extratorBaseUrl?: string;
  },
): Promise<{ urls: string[]; mode: "single" | "listing" | "homepage" }> {
  const validated = validateImportUrl(sourceUrl);
  if (!validated.ok) {
    throw new Error(validated.error);
  }
  const base = validated.url;

  if (isPropertyDetailUrl(base)) {
    return { urls: [base.toString()], mode: "single" };
  }

  const max = Math.min(options?.max ?? MAX_PROPERTIES_PER_IMPORT, MAX_PROPERTIES_PER_IMPORT);
  const fetchHtml =
    options?.fetchHtml ??
    (async (url: string) => {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
          accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        const blocked = res.status === 403 || res.status === 401 || res.status === 429;
        if (blocked && looksLikeSingleListingUrl(base)) {
          return "";
        }
        throw new Error(`fetch_failed_${res.status}`);
      }
      return res.text();
    });

  let html: string;
  try {
    html = await fetchHtml(base.toString());
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (/^fetch_failed_(403|401|429)$/.test(message) && looksLikeSingleListingUrl(base)) {
      return { urls: [base.toString()], mode: "single" };
    }
    throw e;
  }

  if (!html.trim() && looksLikeSingleListingUrl(base)) {
    return { urls: [base.toString()], mode: "single" };
  }

  let urls = parsePropertyLinksFromHtml(base, html, max);

  if (urls.length === 0 && options?.extratorBaseUrl) {
    urls = await discoverFromRenderedHtml(base, base.toString(), max, options.extratorBaseUrl);
  }

  if (urls.length === 0 && options?.extratorBaseUrl && inferDiscoverMode(base) === "homepage") {
    for (const path of LISTING_FALLBACK_PATHS) {
      const listingUrl = new URL(path, base).toString();
      urls = await discoverFromRenderedHtml(base, listingUrl, max, options.extratorBaseUrl);
      if (urls.length > 0) break;
    }
  }

  const mode = inferDiscoverMode(base);

  return { urls: urls.filter((u) => !isHomepageUrl(u)), mode };
}
