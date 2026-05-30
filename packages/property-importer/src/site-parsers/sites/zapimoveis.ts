/**
 * Parser para zapimoveis.com.br
 *
 * Zap usa React SPA com Cloudflare. Pode ser bloqueado.
 * Imagens servidas em img.zapimoveis.com.br (CDN próprio).
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
    ".listing-title",
    "h1",
  ]);

  const descRaw = firstText($, [
    "[class*='description'] p",
    "[class*='Description']",
    ".listing-description",
    "section[class*='desc']",
    "div[class*='desc']",
  ]);
  const full_description = cleanDescription(descRaw);

  const priceRaw = firstText($, [
    "[class*='price']",
    "[class*='Price']",
    ".listing-price",
    "strong[class*='price']",
    "span[class*='price']",
  ]);

  const images = collectImages(
    $,
    [
      ".carousel img",
      "[class*='gallery'] img",
      "[class*='Gallery'] img",
      "[class*='slider'] img",
      "img[src*='zapimoveis.com.br']",
      "img[src*='img.zapimoveis']",
      "img[data-src*='zapimoveis']",
      "[class*='photo'] img",
      "[class*='Photo'] img",
      "[class*='image'] img",
    ],
    url,
  );

  // JSON-LD extraction
  $("script[type='application/ld+json']").each((_i, el) => {
    try {
      const json = JSON.parse($(el).html() ?? "");
      const imgs = json?.image ?? json?.photo ?? [];
      for (const img of Array.isArray(imgs) ? imgs : [imgs]) {
        const u = typeof img === "string" ? img : img?.url ?? img?.contentUrl;
        if (u && typeof u === "string" && u.startsWith("http")) images.push({ url: u });
      }
    } catch {
      // ignore
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
    "[class*='address']",
    "address",
  ]);

  const bedText = firstText($, ["[class*='bedroom']", "[class*='quarto']", "[class*='room']"]);
  const areaText = firstText($, ["[class*='area']", "[class*='totalArea']", "[class*='m2']"]);

  return {
    title,
    description: full_description,
    full_description,
    purpose: url.toLowerCase().includes("aluguel") ? "rent" : "sale",
    city: cityRaw.split(",")[0]?.trim() ?? "",
    sale_price: priceRaw,
    bedrooms: bedText.match(/\d+/) ? parseInt(bedText.match(/\d+/)![0], 10) : null,
    area_m2: areaText.match(/[\d,.]+/)?.[0] ?? "",
    images: uniqueImages,
  };
}

export const zapImoveisParser: SiteParser = {
  hostnames: ["zapimoveis.com.br"],
  needsRendering: true,
  parse,
};
