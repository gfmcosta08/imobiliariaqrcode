/**
 * Parser para casa63.com.br e casa63araguaina.com.br
 *
 * URLs tipo /imovel/{slug}/{codigo} ou /{slug}/14015
 * Ambos os domínios compartilham a mesma plataforma.
 */
import * as cheerio from "cheerio";
import type { ExtratorListing } from "../../extrator-types";
import { cleanDescription, collectImages, firstText } from "../html-helpers";
import { parseGenericaBr } from "./generica-br";
import type { SiteParser } from "../types";

function parse(html: string, url: string): Partial<ExtratorListing> {
  const $ = cheerio.load(html);

  const title = firstText($, [
    "h1.property-title",
    "h1.imovel-title",
    ".property-header h1",
    ".imovel-header h1",
    "h1[class*='title']",
    "h1[class*='titulo']",
    "h1",
  ]);

  const descRaw = firstText($, [
    ".property-description",
    ".imovel-descricao",
    ".description-text",
    ".descricao-completa",
    "[class*='description']",
    "[class*='descricao']",
    "#descricao",
    ".descricao",
  ]);
  const full_description = cleanDescription(descRaw);

  const images = collectImages(
    $,
    [
      ".property-gallery img",
      ".property-images img",
      ".imovel-fotos img",
      ".galeria img",
      ".gallery img",
      ".swiper-slide img",
      ".carousel-item img",
      "[class*='gallery'] img",
      "[class*='galeria'] img",
      "[class*='foto'] img",
      "[class*='slider'] img",
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

  const generic = parseGenericaBr(html, url);
  return {
    ...generic,
    ...(title ? { title } : {}),
    ...(full_description ? { description: full_description, full_description } : {}),
    ...(uniqueImages.length > 0 ? { images: uniqueImages } : {}),
  };
}

export const casa63Parser: SiteParser = {
  hostnames: ["casa63.com.br", "casa63araguaina.com.br"],
  needsRendering: true,
  parse,
};
