export const MAX_PROPERTIES_PER_IMPORT = 10;

export const PILOT_HOST_SUFFIX = "imobiliariasonhar.com.br";

/** Slug legado na raiz (ex.: /apartamento-centro-3-quartos). */
export const PROPERTY_DETAIL_SLUG_PATH =
  /^\/(apartamento|casa|sobrado|terreno|kitnet|kitinete|chacara|chácara|galpao|galpão|flat|sala|lote)-/i;

/** Rota FacilImóveis / Sonhar (ex.: /imovel/casa-palmas-.../CODIGO). */
export const PROPERTY_DETAIL_IMOVEL_PATH = /^\/imovel\/[^/]+(?:\/[^/]+)?\/?$/i;

/** Prefixos comuns em sites imobiliários (casa63, portais white-label, etc.). */
export const PROPERTY_DETAIL_PREFIX_PATH =
  /^\/(?:imovel|imoveis|property|properties|detalhes|detalhe|anuncio|anuncios|listing|listings)\/[^/]+(?:\/[^/]+)?\/?$/i;

/** Slug + ID numérico (ex.: /casa-terrea-bertaville/14015). */
export const PROPERTY_DETAIL_NUMERIC_SUFFIX_PATH = /^\/[^/]+\/\d{3,}\/?$/;

/** OLX e portais regionais: /estado/categoria/slug-12345678 */
export const PROPERTY_DETAIL_SLUG_ID_PATH = /^\/[^/]+\/[^/]+\/.+-\d{5,}\/?$/;

/** Slug terminando em ID numérico (ex.: /categoria/anuncio-123456) */
export const PROPERTY_DETAIL_TRAILING_ID_PATH = /^\/(?:[^/]+\/)*[^/]+-\d{5,}\/?$/;

const LISTING_PATH_EXACT = new Set([
  "/imoveis",
  "/imovel",
  "/busca",
  "/search",
  "/lancamentos",
  "/aluguel",
  "/venda",
]);

/** Caminhos comuns de listagem quando a homepage é SPA sem links de anúncio. */
export const LISTING_FALLBACK_PATHS = [
  "/imoveis",
  "/imoveis?tipo=comprar",
  "/imoveis?tipo=alugar",
  "/imoveis?tipo=venda",
  "/imoveis?tipo=aluguel",
  "/properties",
  "/busca",
];

/** @deprecated use isPropertyDetailPathname */
export const PROPERTY_DETAIL_PATH = PROPERTY_DETAIL_SLUG_PATH;

export function isPropertyDetailPathname(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (LISTING_PATH_EXACT.has(path.toLowerCase())) return false;
  return (
    PROPERTY_DETAIL_SLUG_PATH.test(path) ||
    PROPERTY_DETAIL_IMOVEL_PATH.test(path) ||
    PROPERTY_DETAIL_PREFIX_PATH.test(path) ||
    PROPERTY_DETAIL_NUMERIC_SUFFIX_PATH.test(path) ||
    PROPERTY_DETAIL_SLUG_ID_PATH.test(path) ||
    PROPERTY_DETAIL_TRAILING_ID_PATH.test(path)
  );
}

/** URL que parece anúncio individual (fallback quando discover é bloqueado). */
export function looksLikeSingleListingUrl(url: URL): boolean {
  if (isPropertyDetailPathname(url.pathname)) return true;
  const host = url.hostname.toLowerCase();
  if (host.includes("olx.com.br") && PROPERTY_DETAIL_SLUG_ID_PATH.test(url.pathname.replace(/\/+$/, ""))) {
    return true;
  }
  return PROPERTY_DETAIL_TRAILING_ID_PATH.test(url.pathname.replace(/\/+$/, "") || "/");
}
