/**
 * Parser para sites que usam a plataforma Gestor Imobiliária / Objetiva Software.
 * Identificada em: imobiliariatropical.com
 * CDN de imagens: images.gestorimob.com.br
 *
 * Seletores aproximados (plataforma usa estrutura mista com lightbox/modal):
 *   Título:    h1, h2, h3 (sem classe consistente)
 *   Descrição: [class*="descri"], .description, p
 *   Preço:     elemento que contém "R$"
 *   Galeria:   imagens em lightbox/modal — coleta todos img com src do CDN
 *   URL:       /imoveis/ver/{id}
 */
import * as cheerio from "cheerio";
import type { ExtratorListing } from "../../extrator-types";
import { cleanDescription, collectImages, firstText } from "../html-helpers";
import { parseGenericaBr } from "./generica-br";
import type { SiteParser } from "../types";

function parse(html: string, url: string): Partial<ExtratorListing> {
  const $ = cheerio.load(html);

  const title = firstText($, ["h1", "h2.title", "h2.titulo", ".titulo-imovel", ".property-title"]);

  const descRaw = firstText($, [
    "[class*='descri']",
    ".description",
    ".descricao",
    "p.texto",
    ".texto",
    "section p",
  ]);
  const full_description = cleanDescription(descRaw);

  // Price: find element that contains "R$"
  let priceRaw = "";
  $("*").each((_i, el) => {
    const text = $(el).children().length === 0 ? $(el).text().trim() : "";
    if (text.includes("R$") && text.length < 30) {
      priceRaw = text;
      return false; // break
    }
  });

  const images = collectImages(
    $,
    [
      "img[src*='gestorimob.com.br']",
      "img[data-src*='gestorimob.com.br']",
      "a[href*='gestorimob.com.br']",
      "[class*='galeri'] img",
      "[class*='slider'] img",
      "[class*='carousel'] img",
      "a[data-lightbox] img",
      "a[data-fancybox] img",
      ".lightbox img",
      ".fotos img",
    ],
    url,
  );

  // Full-size images often in anchor href on Gestor
  $("a[href*='gestorimob.com.br']").each((_i, el) => {
    const href = $(el).attr("href")?.trim();
    if (href?.startsWith("http")) images.push({ url: href });
  });

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

  const generic = parseGenericaBr(html, url);
  return {
    ...generic,
    ...(title ? { title } : {}),
    ...(full_description ? { description: full_description, full_description } : {}),
    ...(priceRaw ? { sale_price: priceRaw } : {}),
    ...(uniqueImages.length > 0 ? { images: uniqueImages } : {}),
  };
}

export const gestorImobParser: SiteParser = {
  hostnames: ["imobiliariatropical.com"],
  needsRendering: false,
  parse,
};
