/**
 * Parser para sites que usam a plataforma Kenlo (antigo Imoview CRM/Site).
 *
 * Identificado em: imobiliariasonhar.com.br (por inspeção real)
 * Possivelmente também: ritacamposnegocios.com.br, estiloimobiliaria.com,
 * eduardomotaimoveis.com.br, valadaresimoveis.com.br, simimoveis.net,
 * ricanato.com.br, boasorteimoveis.com.br, achelar.com.br e outros.
 *
 * CDN de imagens: imgs.kenlo.io (confirmado)
 *
 * Seletores confirmados por inspeção real:
 *   Título:    h1 > span  /  h1
 *   Preço:     .price-text  /  h6
 *   Descrição: .box-description  (conteúdo expandido após "ver mais")
 *   Imagens:   img[src*="imgs.kenlo.io"]
 */
import * as cheerio from "cheerio";
import type { ExtratorListing } from "../../extrator-types";
import { cleanDescription, collectImages, firstText } from "../html-helpers";
import type { SiteParser } from "../types";

export function parseKenlo(html: string, url: string): Partial<ExtratorListing> {
  const $ = cheerio.load(html);

  const title = firstText($, ["h1 > span", "h1", ".property-title", ".imovel-title"]);

  const descRaw = firstText($, [
    ".box-description",
    ".box-description p",
    "[class*='box-description']",
    ".descricao-completa",
    ".property-description",
    "[class*='description']",
    "[class*='descricao']",
    "#descricao",
  ]);
  const full_description = cleanDescription(descRaw);

  const priceRaw = firstText($, [
    ".price-text",
    "[class*='price-text']",
    "h6",
    "[class*='price']",
    "[class*='preco']",
    "[class*='valor']",
  ]);

  // Location: Kenlo often encodes city/neighborhood in the URL slug or H1
  const locationRaw = firstText($, [
    "[class*='location']",
    "[class*='cidade']",
    "[class*='endereco']",
    "address",
    ".breadcrumb li:last-child",
  ]);

  const bedText = firstText($, [
    "[class*='quarto']",
    "[class*='dormit']",
    "[class*='bedroom']",
    ".quartos",
    ".bedrooms",
  ]);
  const bathText = firstText($, ["[class*='banheiro']", "[class*='bathroom']", ".banheiros"]);
  const areaText = firstText($, [
    "[class*='area']",
    "[class*='m2']",
    "[class*='metragem']",
    ".area",
  ]);
  const parkText = firstText($, ["[class*='vaga']", "[class*='garage']", ".vagas"]);
  const suiteText = firstText($, ["[class*='suite']", ".suites"]);

  const images = collectImages(
    $,
    [
      "img[src*='imgs.kenlo.io']",
      "img[data-src*='imgs.kenlo.io']",
      "img[src*='kenlo.io']",
      "img[data-src*='kenlo.io']",
      "img[src*='managing-images.kenlo.io']",
      "img[src*='storage.googleapis.com']",
      "[class*='gallery'] img",
      "[class*='galeria'] img",
      "[class*='slider'] img",
      "[class*='carousel'] img",
      ".swiper-slide img",
      "a[data-fancybox] img",
      "a[rel='lightbox'] img",
    ],
    url,
  );

  $("meta[property='og:image']").each((_i, el) => {
    const c = $(el).attr("content")?.trim();
    if (c?.startsWith("http")) images.push({ url: c });
  });

  const seen = new Set<string>();
  const uniqueImages = images.filter((img) => {
    if (seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  });

  const subtype = firstText($, ["[class*='tipo']", "[class*='type']", ".property-type"]);
  const purposeRaw = (priceRaw + " " + url).toLowerCase();
  const purpose: "" | "sale" | "rent" = purposeRaw.includes("alug")
    ? "rent"
    : purposeRaw.includes("vend")
      ? "sale"
      : "";

  const internalCode = (() => {
    // Kenlo URL pattern: /imovel/{slug}/{CODE}
    const m = url.match(/\/([A-Z]{2}\d{4}[-\w]*)(?:\/|$)/i);
    if (m) return m[1];
    return firstText($, ["[class*='codigo']", "[class*='code']", "[class*='ref']"]);
  })();

  return {
    title,
    description: full_description,
    full_description,
    property_subtype: subtype,
    purpose,
    city: locationRaw.split(/[-–,]/)[0]?.trim() ?? "",
    bedrooms: bedText.match(/\d+/) ? parseInt(bedText.match(/\d+/)![0], 10) : null,
    suites: suiteText.match(/\d+/) ? parseInt(suiteText.match(/\d+/)![0], 10) : null,
    bathrooms: bathText.match(/\d+/) ? parseInt(bathText.match(/\d+/)![0], 10) : null,
    parking_spaces: parkText.match(/\d+/) ? parseInt(parkText.match(/\d+/)![0], 10) : null,
    area_m2: areaText.match(/[\d,.]+/)?.[0] ?? "",
    sale_price: purpose !== "rent" ? priceRaw : "",
    rent_price: purpose === "rent" ? priceRaw : "",
    internal_code: internalCode,
    images: uniqueImages,
  };
}

export const kenloParser: SiteParser = {
  hostnames: [
    // Sites confirmados como Kenlo ou com alta probabilidade
    "ritacamposnegocios.com.br",
    "estiloimobiliaria.com",
    "eduardomotaimoveis.com.br",
    "valadaresimoveis.com.br",
    "simimoveis.net",
    "ricanato.com.br",
    "boasorteimoveis.com.br",
    "imobgurupi.com.br",
    "invistaemtocantins.com.br",
    "niloimoveis.com.br",
    "achelar.com.br",
    "dfimoveis.com.br",
  ],
  needsRendering: false,
  parse: parseKenlo,
};
