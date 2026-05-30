/**
 * Parser para olx.com.br
 *
 * OLX usa Cloudflare e React. Com needsRendering=true o extrator
 * tenta renderizar. Pode ser bloqueado; a mensagem site_blocked_cloudflare
 * é tratada pelo run-job.ts quando o título retorna genérico.
 *
 * Estrutura OLX (anúncios de imóveis):
 *   - Título: h1[class*='title'], .ad-title h1
 *   - Preço: h2[class*='price'], .ad-price
 *   - Descrição: .ad-description p, [class*='description'] p
 *   - Imagens: [class*='image'] img, .slick-slide img, [data-src], [src*='olxcdn.com']
 */
import * as cheerio from "cheerio";
import type { ExtratorListing } from "../../extrator-types";
import { cleanDescription, collectImages, firstText } from "../html-helpers";
import type { SiteParser } from "../types";

function parse(html: string, url: string): Partial<ExtratorListing> {
  const $ = cheerio.load(html);

  const title = firstText($, [
    "h1[class*='title']",
    "h1[class*='Title']",
    ".ad-title h1",
    ".title h1",
    "h1",
  ]);

  const descRaw = firstText($, [
    "[class*='description'] p",
    ".ad-description",
    "[class*='Description']",
    "#ad-description",
    "section[class*='description']",
    "div[class*='description']",
  ]);
  const full_description = cleanDescription(descRaw);

  const priceRaw = firstText($, [
    "h2[class*='price']",
    "[class*='Price']",
    "[class*='price']",
    ".ad-price",
    "h2",
  ]);

  const images = collectImages(
    $,
    [
      "[class*='image'] img",
      ".slick-slide img",
      ".carousel img",
      "[class*='gallery'] img",
      "[class*='Gallery'] img",
      "img[src*='olxcdn.com']",
      "img[data-src*='olxcdn.com']",
      "img[src*='olx.com.br']",
    ],
    url,
  );

  // OLX also encodes images in JSON state
  $("script").each((_i, el) => {
    const content = $(el).html() ?? "";
    const matches = content.matchAll(/"url"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi);
    for (const m of matches) {
      images.push({ url: m[1] });
    }
  });

  const seen = new Set<string>();
  const uniqueImages = images.filter((img) => {
    if (seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  });

  const cityRaw = firstText($, [
    "[class*='location']",
    "[class*='Location']",
    ".location-text",
    "address",
    "[class*='address']",
  ]);

  const bedText = firstText($, ["[class*='bedroom']", "[class*='quarto']", "[aria-label*='Quarto']"]);
  const areaText = firstText($, ["[class*='area']", "[class*='m2']", "[aria-label*='rea']"]);

  return {
    title,
    description: full_description,
    full_description,
    property_subtype: "",
    purpose: url.toLowerCase().includes("aluguel") ? "rent" : "sale",
    city: cityRaw.split(",")[0]?.trim() ?? "",
    sale_price: priceRaw,
    bedrooms: bedText.match(/\d+/) ? parseInt(bedText.match(/\d+/)![0], 10) : null,
    area_m2: areaText.match(/[\d,.]+/)?.[0] ?? "",
    images: uniqueImages,
  };
}

export const olxParser: SiteParser = {
  hostnames: ["olx.com.br"],
  needsRendering: true,
  parse,
};
