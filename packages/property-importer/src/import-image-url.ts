import { hostnameMatchesSourceSite } from "./import-policy";
import { isBlockedPublicHostname } from "./ssrf";
import { getRegisteredImageCdnHosts } from "./site-parsers/registry";

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
  if (host === "jetimob.com" || host.endsWith(".jetimob.com")) return true;
  if (host.endsWith(".jetimob.com.br")) return true;
  if (host.endsWith(".vistahost.com.br")) return true;
  if (host.endsWith(".imovelweb.com.br")) return true;
  if (host.endsWith(".olx.com.br")) return true;
  if (host.endsWith(".zapimoveis.com.br")) return true;
  if (host.endsWith(".staticflickr.com")) return true;
  if (host.endsWith(".unreel.me")) return true;
  if (host.endsWith(".imgbroker.com.br")) return true;
  if (host === "static.arboimoveis.com.br" || host.endsWith(".arboimoveis.com.br")) return true;
  if (host === "vivanci.com" || host.endsWith(".vivanci.com")) return true;
  if (host.endsWith(".imobiliariasonhar.com.br")) return true;
  // ImoView / Universal Software
  if (host === "cdn.imoview.com.br" || host.endsWith(".imoview.com.br")) return true;
  // Gestor Imobiliária / Objetiva Software
  if (host === "images.gestorimob.com.br" || host.endsWith(".gestorimob.com.br")) return true;
  // Imóvel Web / Grupo ZAP
  if (host.endsWith(".grupozap.com") || host.endsWith(".vivareal.com.br")) return true;
  // ImóvelAqui
  if (host.endsWith(".imovelaqui.com.br")) return true;
  if (
    getRegisteredImageCdnHosts().some(
      (cdn) => host === cdn || host.endsWith(`.${cdn.replace(/^\./, "")}`),
    )
  ) {
    return true;
  }
  return false;
}

export function isDecorativeImportImageUrl(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  if (!lower) return true;
  if (lower.endsWith(".svg")) return true;
  if (lower.includes("kenlo.svg")) return true;
  if (lower.includes("static-sites.kenlo.io")) return true;
  // Proxy Next.js — deve ser normalizado para URL direta antes do upload
  if (/\/_next\/image(?:\?|$)/i.test(lower)) return true;
  if (/\/assets\/icons?\//i.test(lower)) return true;
  if (/\/assets\/img\/[a-z0-9]{5,12}\.png/i.test(lower)) return true;
  if (/\/flags?\//i.test(lower)) return true;
  if (/\/cms\/files\//i.test(lower)) return true;
  if (/icon-|favicon|sprite|logo-link|\/logo[./-]/i.test(lower)) return true;
  if (
    /whatsapp|facebook|instagram|youtube|linkedin|twitter/i.test(lower) &&
    /icon|logo|svg/i.test(lower)
  ) {
    return true;
  }
  return false;
}

/** Converte proxy Next.js `/_next/image?url=...` na URL original (ex.: Supabase). */
export function normalizeImportImageUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.pathname.includes("/_next/image")) {
      const embedded = url.searchParams.get("url");
      if (embedded) {
        return decodeURIComponent(embedded);
      }
    }
  } catch {
    // ignore
  }
  return trimmed;
}

export function propertyImportImageScore(raw: string): number {
  const lower = raw.trim().toLowerCase();
  if (!lower || isDecorativeImportImageUrl(lower)) return -100;
  if (/imoview\.com\.br.*\/imoveis\//i.test(lower)) return 100;
  if (/cdn\.imoview\.com\.br/i.test(lower)) return 95;
  if (/images\.gestorimob\.com\.br/i.test(lower)) return 95;
  if (/kenlo\.io/i.test(lower)) return 95;
  // Vivanci usa Supabase Storage para fotos de imóveis
  if (/supabase\.co\/storage.*imoveis/i.test(lower)) return 90;
  if (/foto\d+\.(jpe?g|webp|png)/i.test(lower)) return 90;
  if (/storage\.googleapis\.com.*kenlo/i.test(lower)) return 85;
  if (/managing-images\.kenlo\.io/i.test(lower)) return 85;
  if (/supabase\.co.*\/storage\/v1\/object\/public\/.*imoveis-fotos/i.test(lower)) return 90;
  if (/static\.arboimoveis\.com\.br/i.test(lower)) return 90;
  if (/jetimob\.com/i.test(lower)) return 88;
  if (/vistahost\.com\.br/i.test(lower)) return 88;
  if (/imovelweb\.com\.br/i.test(lower)) return 85;
  // Muitos sites Next.js servem imagens via proxy sem extensÃ£o: /_next/image?url=...&w=...
  if (/\/_next\/image\?/.test(lower) && /[?&]url=/.test(lower)) return 30;
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
      // Aceita qualquer URL não-decorativa do mesmo domínio da fonte,
      // independente de ter extensão ou score (vivanci, sonhar, etc.)
      return !isDecorativeImportImageUrl(raw);
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
    .map((u) => normalizeImportImageUrl(u.trim()))
    .filter((u) => u && isPropertyImportImageUrl(u, sourceHostname))
    .sort((a, b) => propertyImportImageScore(b) - propertyImportImageScore(a))
    .filter((u) => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });
}
