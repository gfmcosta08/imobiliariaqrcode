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

  // Vivanci usa Next.js + Tailwind — sem classes semânticas de descrição.
  // A descrição fica num bloco de texto longo próximo ao botão "Ver mais".
  // Estratégia: pegar o parágrafo mais longo da área principal da página.
  const descRaw = (() => {
    // Tentar primeiro seletores de conteúdo comuns
    const bySelector = firstText($, [
      "section p",
      "article p",
      "main p",
      "[role='main'] p",
      ".prose",
      // Texto logo antes/depois de "Ver mais"
      "button:contains('Ver mais')",
    ]);
    if (bySelector && bySelector.length > 80) return bySelector;
    // Fallback: maior parágrafo da página
    let longest = "";
    $("p").each((_i, el) => {
      const t = $(el).text().trim();
      if (t.length > longest.length) longest = t;
    });
    return longest;
  })();
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

  // Vivanci: Next.js custom + Supabase Storage (confirmado por inspeção real).
  // CDN: tyqawceqowjmzgujrptx.supabase.co/storage/v1/object/public/imoveis-fotos/
  // O seletor ".supabase.co" já é coberto pelo isKnownPropertyCdnHost global.
  const images = collectImages(
    $,
    [
      // Supabase Storage (CDN real confirmado)
      "img[src*='.supabase.co/storage']",
      "img[data-src*='.supabase.co/storage']",
      "img[src*='supabase.co']",
      "img[data-src*='supabase.co']",
      // Tailwind: imagens com object-cover (padrão Next.js)
      "img[class*='object-cover']",
      "img[class*='object-fit']",
      ".gallery img",
      ".swiper-slide img",
      ".carousel img",
      "[class*='gallery'] img",
      "[class*='slider'] img",
      "[class*='foto'] img",
      "img[class*='property']",
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
