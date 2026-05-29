import { hostnameMatchesSourceSite } from "./import-policy";
import { isBlockedPublicHostname } from "./ssrf";

/** CDNs comuns em sites imobiliários brasileiros. */
function isKnownPropertyCdnHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (isBlockedPublicHostname(host)) return false;
  if (host === "kenlo.io" || host.endsWith(".kenlo.io")) return true;
  if (host === "imoview.com.br" || host.endsWith(".imoview.com.br")) return true;
  if (host.endsWith(".cloudinary.com")) return true;
  if (host.endsWith(".amazonaws.com")) return true;
  if (host === "storage.googleapis.com") return true;
  if (host.endsWith(".wp.com")) return true;
  if (host.endsWith(".imgix.net")) return true;
  if (host.endsWith(".akamaized.net")) return true;
  if (host.endsWith(".cloudfront.net")) return true;
  if (host.endsWith(".digitaloceanspaces.com")) return true;
  if (host.endsWith(".supabase.co")) return true;
  return false;
}

export function isDecorativeImportImageUrl(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  if (!lower) return true;
  if (lower.endsWith(".svg")) return true;
  if (lower.includes("kenlo.svg")) return true;
  if (lower.includes("static-sites.kenlo.io")) return true;
  if (/\/assets\/icons?\//i.test(lower)) return true;
  if (/\/assets\/img\/[a-z0-9]{5,12}\.png/i.test(lower)) return true;
  if (/\/flags?\//i.test(lower)) return true;
  if (/\/cms\/files\//i.test(lower)) return true;
  if (/icon-|favicon|sprite|logo-link|\/logo[./-]/i.test(lower)) return true;
  if (/whatsapp|facebook|instagram|youtube|linkedin|twitter/i.test(lower) && /icon|logo|svg/i.test(lower)) {
    return true;
  }
  return false;
}

export function propertyImportImageScore(raw: string): number {
  const lower = raw.trim().toLowerCase();
  if (!lower || isDecorativeImportImageUrl(lower)) return -100;
  if (/imoview\.com\.br.*\/imoveis\//i.test(lower)) return 100;
  if (/kenlo\.io/i.test(lower)) return 95;
  if (/foto\d+\.(jpe?g|webp|png)/i.test(lower)) return 90;
  if (/storage\.googleapis\.com.*kenlo/i.test(lower)) return 85;
  if (/managing-images\.kenlo\.io/i.test(lower)) return 85;
  if (/supabase\.co.*\/storage\/v1\/object\/public\/.*imoveis-fotos/i.test(lower)) return 90;
  if (/\.(jpe?g|webp|png)(\?|$)/i.test(lower)) return 40;
  return 0;
}

export function isAllowedImportImageUrl(raw: string, sourceHostname?: string): boolean {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (isBlockedPublicHostname(url.hostname)) return false;
    if (isDecorativeImportImageUrl(raw)) return false;
    if (
      url.hostname.endsWith(".supabase.co") &&
      url.pathname.includes("/storage/v1/object/public/")
    ) {
      return propertyImportImageScore(raw) > 0;
    }
    if (propertyImportImageScore(raw) >= 85) return true;
    if (sourceHostname && hostnameMatchesSourceSite(url.hostname, sourceHostname)) {
      return propertyImportImageScore(raw) > 0;
    }
    return isKnownPropertyCdnHost(url.hostname);
  } catch {
    return false;
  }
}

export function isPropertyImportImageUrl(raw: string, sourceHostname?: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || isDecorativeImportImageUrl(trimmed)) return false;
  return isAllowedImportImageUrl(trimmed, sourceHostname);
}

export function rankPropertyImportImageUrls(urls: string[], sourceHostname?: string): string[] {
  const seen = new Set<string>();
  return urls
    .map((u) => u.trim())
    .filter((u) => u && isPropertyImportImageUrl(u, sourceHostname))
    .sort((a, b) => propertyImportImageScore(b) - propertyImportImageScore(a))
    .filter((u) => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });
}
