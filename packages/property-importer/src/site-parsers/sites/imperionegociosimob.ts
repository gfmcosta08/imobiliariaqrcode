/**
 * Parser para imperionegociosimob.com.br
 *
 * URLs do tipo /imovel/{slug}-id-{numero}
 * Requer rendering pois pode usar lazy loading.
 */
import * as cheerio from "cheerio";
import type { ExtratorListing } from "../../extrator-types";
import { cleanDescription, collectImages, firstText } from "../html-helpers";
import { parseGenericaBr } from "./generica-br";
import type { SiteParser } from "../types";

function parse(html: string, url: string): Partial<ExtratorListing> {
  const $ = cheerio.load(html);

  // Extract internal code from URL: /imovel/slug-id-12345
  const codeMatch = url.match(/-id-(\d+)/i);
  const internal_code = codeMatch?.[1] ?? "";

  const title = firstText($, [
    ".imovel-titulo",
    ".property-title",
    "h1.titulo",
    "h1[class*='title']",
    ".ficha-imovel h1",
    "h1",
  ]);

  const descRaw = firstText($, [
    ".descricao-completa",
    ".descricao-imovel",
    "[class*='descricao']",
    "[class*='description']",
    "#descricao",
    ".descricao",
  ]);
  const full_description = cleanDescription(descRaw);

  const images = collectImages(
    $,
    [
      ".galeria img",
      ".fotos img",
      ".property-gallery img",
      "[class*='galeria'] img",
      "[class*='gallery'] img",
      "[class*='foto'] img",
      ".swiper-slide img",
      ".carousel img",
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
    internal_code: internal_code || generic.internal_code,
    ...(title ? { title } : {}),
    ...(full_description ? { description: full_description, full_description } : {}),
    ...(uniqueImages.length > 0 ? { images: uniqueImages } : {}),
  };
}

export const imperioNegociosParser: SiteParser = {
  hostnames: ["imperionegociosimob.com.br"],
  needsRendering: true,
  parse,
};
