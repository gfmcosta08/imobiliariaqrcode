import * as cheerio from "cheerio";
import type { ExtratorListing } from "../../extrator-types";
import { normalizeImportImageUrl } from "../../import-image-url";
import { cleanDescription, collectImages, firstAttr, firstText } from "../html-helpers";
import type { SiteParser } from "../types";
import { extractVivanciCodigoFromUrl } from "./vivanci-api";

const SUPABASE_PHOTO_PATTERN =
  /https?:\\\/\\\/[a-z0-9-]+\.supabase\.co\\\/storage\\\/v1\\\/object\\\/public\\\/imoveis-fotos\\\/[^"'\\\s<>]+|https?:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/imoveis-fotos\/[^\s"'\\)<>]+/gi;

/** Extrai URLs diretas do Supabase Storage embutidas no HTML/JSON do Next.js. */
function extractSupabasePhotosFromHtml(html: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const match of html.matchAll(SUPABASE_PHOTO_PATTERN)) {
    const normalized = normalizeImportImageUrl(match[0].replace(/\\\//g, "/"));
    if (!normalized.includes("supabase.co/storage") || !normalized.includes("imoveis-fotos")) {
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    results.push(normalized);
  }
  return results;
}

/** Mantém fotos do imóvel principal (pasta UUID dominante), excluindo similares. */
function filterPhotosByPrimaryFolder(urls: string[]): string[] {
  const counts = new Map<string, number>();
  for (const url of urls) {
    const match = url.match(/imoveis-fotos\/([a-f0-9-]{36})\//i);
    if (match) counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  }
  const primary = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!primary) return urls;
  return urls.filter((u) => u.includes(`/imoveis-fotos/${primary}/`));
}

function collectVivanciImages(
  $: cheerio.CheerioAPI,
  html: string,
  pageUrl: string,
): Array<{ url: string }> {
  const seen = new Set<string>();
  const results: Array<{ url: string }> = [];

  const add = (raw: string | undefined | null) => {
    if (!raw) return;
    const normalized = normalizeImportImageUrl(raw.trim());
    if (!normalized.includes("supabase.co/storage") || !normalized.includes("imoveis-fotos")) {
      return;
    }
    if (seen.has(normalized)) return;
    seen.add(normalized);
    results.push({ url: normalized });
  };

  // Prioridade: URLs diretas no HTML bruto (inclui __NEXT_DATA__ e props serializadas)
  for (const url of extractSupabasePhotosFromHtml(html)) {
    add(url);
  }

  // Fallback: tags img (podem usar proxy /_next/image — normalizado acima)
  for (const img of collectImages(
    $,
    [
      "img[src*='supabase.co']",
      "img[data-src*='supabase.co']",
      "img[src*='/_next/image']",
      "img[data-src*='/_next/image']",
      "img[class*='object-cover']",
      "[class*='gallery'] img",
      "[class*='slider'] img",
    ],
    pageUrl,
  )) {
    add(img.url);
  }

  const filtered = filterPhotosByPrimaryFolder(results.map((r) => r.url));
  return filtered.map((url) => ({ url }));
}

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

  const uniqueImages = collectVivanciImages($, html, url);

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
  const purpose: "" | "sale" | "rent" = purposeRaw.includes("alug")
    ? "rent"
    : purposeRaw.includes("vend")
      ? "sale"
      : "";

  const internalCode =
    extractVivanciCodigoFromUrl(url) ||
    firstAttr($, [
      { sel: "[data-code]", attr: "data-code" },
      { sel: "[data-id]", attr: "data-id" },
    ]) ||
    firstText($, ["[class*='codigo']", "[class*='code']", "[class*='referencia']"]);

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
