/**
 * URLs diretas de anúncio (não listagens) para matriz de importação nos 21 sites obrigatórios.
 * Preferir /imovel/..., detalhes-imovel.php?id= ou slug/ID numérico.
 */
export const REQUIRED_IMPORT_SITES = [
  "casa63.com.br",
  "ritacamposnegocios.com.br",
  "estiloimobiliaria.com",
  "eduardomotaimoveis.com.br",
  "imperionegociosimob.com.br",
  "valadaresimoveis.com.br",
  "olx.com.br",
  "zapimoveis.com.br",
  "imobiliariasonhar.com.br",
  "simimoveis.net",
  "ricanato.com.br",
  "logos-to.com.br",
  "boasorteimoveis.com.br",
  "imobgurupi.com.br",
  "varandaimobiliaria.com.br",
  "casa63araguaina.com.br",
  "imobiliariatropical.com",
  "invistaemtocantins.com.br",
  "niloimoveis.com.br",
  "achelar.com.br",
  "dfimoveis.com.br",
] as const;

export type RequiredImportSite = (typeof REQUIRED_IMPORT_SITES)[number];

/** URL curada conhecida por domínio (batch mínimo = 1). Demais sites usam harvest em /imoveis. */
export const CURATED_LISTING_URLS: Partial<Record<RequiredImportSite, string>> = {
  "casa63.com.br": "https://www.casa63.com.br/imovel/casa-terrea-bertaville/14015",
  "estiloimobiliaria.com":
    "https://www.estiloimobiliaria.com/imovel/apartamento-a-venda-graciosa-orla-14-palmas-to/5900",
  "imobiliariasonhar.com.br":
    "https://imobiliariasonhar.com.br/imovel/apartamento-palmas-2-quartos-65-m/AP0029-SOOR",
  "logos-to.com.br":
    "https://www.logos-to.com.br/detalhes-imovel.php?imovel=1746&finalidade=1",
  "niloimoveis.com.br":
    "https://niloimoveis.com.br/imovel/apartamento-1-dormitorio-nossa-senhora-de-fatima_santa-maria_rs-santa-maria_rs-72307/",
  "casa63araguaina.com.br":
    "https://www.casa63araguaina.com.br/imovel/casa-terrea-bertaville/14015",
};

export function normalizeSiteHost(site: string): string {
  return site.toLowerCase().replace(/^www\./, "");
}

/** Heurística: aceita só URL de detalhe, rejeita páginas de listagem. */
export function looksLikeDirectListingUrl(raw: string, siteHost: string): boolean {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const expected = normalizeSiteHost(siteHost);
    if (host !== expected && !host.endsWith(`.${expected}`)) return false;

    const path = u.pathname.toLowerCase();
    if (path.includes("/todos-os-bairros") || path.includes("/apenas-lancamentos")) return false;
    if (/\/venda\/imovel\//.test(path) || /\/aluguel\/imovel\//.test(path)) return false;
    if (path.includes("detalhes-imovel.php") || path.endsWith("/imovel.php")) {
      return u.searchParams.has("id") || u.searchParams.has("imovel");
    }
    if (/\/imoveis\/(?:a-venda|aluguel|venda|para-alugar|locacao)/.test(path)) return false;
    if (/\/venda\/imovel\//.test(path) || /\/aluguel\/imovel\//.test(path)) return false;
    if (path.includes("apenas-lancamentos") || path.includes("na-planta")) return false;
    if (path.includes("/imoveis-favoritos") || path === "/imoveis") return false;
    if (path.includes("/imovel/")) return true;
    if (/\/\d{3,}\/?$/.test(path)) return true;
    if (u.hostname.includes("olx.com.br") && /-\d{5,}\/?$/.test(path)) return true;
    if (u.hostname.includes("zapimoveis.com.br") && path.includes("/imovel/")) return true;
    return false;
  } catch {
    return false;
  }
}
