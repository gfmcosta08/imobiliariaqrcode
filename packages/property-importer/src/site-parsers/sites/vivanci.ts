import * as cheerio from "cheerio";
import type { ExtratorListing } from "../../extrator-types";
import {
  cleanDescription,
  collectImages,
  firstAttr,
  firstText,
} from "../html-helpers";
import type { SiteParser } from "../types";

function parse(html: string, url: string): Partial<ExtratorListing> {
  const $ = cheerio.load(html);

  const title = firstText($, [
    "h1.property-title",
    "h1[class*='title']",
    "h1[class*='Title']",
    ".property-detail h1",
    ".imovel-title",
    "h1",
  ]);

  const descRaw = firstText($, [
    ".property-description",
    "[class*='description']",
    "[class*='Description']",
    ".descricao",
    "[class*='descricao']",
    ".detail-description",
    "section[class*='description'] p",
    ".property-info p",
  ]);
  const full_description = cleanDescription(descRaw);

  const priceRaw = firstText($, [
    "[class*='price']",
    "[class*='Price']",
    "[class*='preco']",
    "[class*='valor']",
    ".property-price",
    ".value",
  ]);
  const saleMatch = priceRaw.match(/[\d.,]+/);
  const sale_price = saleMatch ? saleMatch[0] : "";

  const cityRaw = firstText($, [
    "[class*='location']",
    "[class*='cidade']",
    "[class*='city']",
    ".property-address",
    "address",
  ]);

  const bedText = firstText($, [
    "[class*='bedroom']",
    "[class*='quarto']",
    "[class*='dormit']",
    "[aria-label*='quarto']",
    "[title*='quarto']",
  ]);
  const bathText = firstText($, [
    "[class*='bathroom']",
    "[class*='banheiro']",
    "[aria-label*='banheiro']",
  ]);
  const areaText = firstText($, [
    "[class*='area']",
    "[class*='Area']",
    "[class*='m2']",
    "[class*='metragem']",
  ]);
  const parkText = firstText($, ["[class*='garage']", "[class*='vaga']", "[class*='estacion']"]);

  const bedNum = bedText.match(/\d+/);
  const bathNum = bathText.match(/\d+/);
  const areaNum = areaText.match(/[\d,.]+/);
  const parkNum = parkText.match(/\d+/);

  // Images: vivanci serves images from their own domain and possibly CDN
  const images = collectImages(
    $,
    [
      ".gallery img",
      ".swiper-slide img",
      ".carousel img",
      "[class*='gallery'] img",
      "[class*='Gallery'] img",
      "[class*='slider'] img",
      "[class*='Slider'] img",
      "[class*='foto'] img",
      "[class*='image'] img",
      "img[class*='property']",
      // Also check anchor wrapping images
      "a[href*='vivanci.com'] img",
      // JSON-LD structured data
    ],
    url,
  );

  // Also extract from meta og:image and JSON-LD
  $("meta[property='og:image'], meta[name='og:image']").each((_i, el) => {
    const content = $(el).attr("content")?.trim();
    if (content && content.startsWith("http")) {
      images.push({ url: content });
    }
  });

  // Extract images from JSON-LD if present
  $("script[type='application/ld+json']").each((_i, el) => {
    try {
      const json = JSON.parse($(el).html() ?? "");
      const extractUrls = (obj: unknown): void => {
        if (!obj || typeof obj !== "object") return;
        if (Array.isArray(obj)) {
          for (const item of obj) extractUrls(item);
          return;
        }
        const o = obj as Record<string, unknown>;
        for (const key of ["image", "contentUrl", "url", "thumbnail"]) {
          const val = o[key];
          if (typeof val === "string" && val.startsWith("http")) {
            images.push({ url: val });
          } else if (Array.isArray(val)) {
            for (const v of val) {
              if (typeof v === "string" && v.startsWith("http")) images.push({ url: v });
              else if (v && typeof v === "object") extractUrls(v);
            }
          }
        }
        for (const v of Object.values(o)) extractUrls(v);
      };
      extractUrls(json);
    } catch {
      // ignore
    }
  });

  // Deduplicate images
  const seen = new Set<string>();
  const uniqueImages = images.filter((img) => {
    if (seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  });

  const subtype = firstText($, [
    "[class*='type']",
    "[class*='tipo']",
    "[class*='categoria']",
    ".property-type",
  ]);

  const neighborhood = firstText($, [
    "[class*='bairro']",
    "[class*='neighborhood']",
    "[class*='district']",
  ]);

  const purposeRaw = firstText($, [
    "[class*='finalidade']",
    "[class*='purpose']",
    "[class*='negocio']",
  ]).toLowerCase();
  const purpose: "" | "sale" | "rent" =
    purposeRaw.includes("alug") ? "rent" : purposeRaw.includes("vend") ? "sale" : "";

  const internalCode = firstAttr($, [
    { sel: "[data-code]", attr: "data-code" },
    { sel: "[data-id]", attr: "data-id" },
  ]) || firstText($, ["[class*='codigo']", "[class*='code']", "[class*='referencia']"]);

  return {
    title,
    description: full_description,
    full_description,
    property_subtype: subtype,
    purpose,
    city: cityRaw.split(",")[0]?.trim() ?? "",
    neighborhood,
    bedrooms: bedNum ? parseInt(bedNum[0], 10) : null,
    bathrooms: bathNum ? parseInt(bathNum[0], 10) : null,
    area_m2: areaNum ? areaNum[0] : "",
    parking_spaces: parkNum ? parseInt(parkNum[0], 10) : null,
    sale_price: purpose === "rent" ? "" : sale_price,
    rent_price: purpose === "rent" ? sale_price : "",
    internal_code: internalCode,
    images: uniqueImages,
  };
}

export const vivanciparser: SiteParser = {
  hostnames: ["vivanci.com"],
  needsRendering: true,
  parse,
};
