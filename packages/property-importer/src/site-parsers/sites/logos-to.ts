/**
 * Parser para logos-to.com.br
 *
 * Site PHP legado. URLs do tipo:
 *   detalhes-imovel.php?imovel=123
 *   imovel.php?id=123
 *
 * Fetch direto funciona (sem anti-bot).
 */
import * as cheerio from "cheerio";
import type { ExtratorListing } from "../../extrator-types";
import { cleanDescription, collectImages, firstText } from "../html-helpers";
import { parseGenericaBr } from "./generica-br";
import type { SiteParser } from "../types";

function parse(html: string, url: string): Partial<ExtratorListing> {
  const $ = cheerio.load(html);

  const title = firstText($, [
    "#titulo-imovel",
    ".titulo-imovel",
    "h1#titulo",
    "h1.titulo",
    ".ficha h1",
    "h1",
  ]);

  const descRaw = firstText($, [
    "#descricao-imovel",
    ".descricao-imovel",
    "#descricao",
    ".descricao",
    ".texto-imovel",
    "#texto",
    "td.descricao",
    "div.descricao",
    "p.descricao",
  ]);
  const full_description = cleanDescription(descRaw);

  const priceRaw = firstText($, [
    "#preco",
    ".preco",
    "#valor",
    ".valor",
    "td.preco",
    "span.preco",
    "b.preco",
    "strong.preco",
  ]);

  const images = collectImages(
    $,
    [
      "#galeria img",
      ".galeria img",
      ".fotos img",
      "#fotos img",
      "a[rel='lightbox'] img",
      "a[data-lightbox] img",
      "a[data-fancybox] img",
      "table img",
      // PHP sites often wrap full-size in anchor href
      "a[href$='.jpg']",
      "a[href$='.jpeg']",
      "a[href$='.png']",
      "a[href*='/fotos/']",
      "a[href*='/images/']",
      "a[href*='/imagens/']",
    ],
    url,
  );

  // Also grab anchor hrefs that point to images
  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href")?.trim() ?? "";
    if (/\.(jpe?g|png|webp)$/i.test(href) || /\/(fotos|images|imagens|photos)\//i.test(href)) {
      const abs = href.startsWith("http") ? href : new URL(href, url).toString();
      images.push({ url: abs });
    }
  });

  const seen = new Set<string>();
  const uniqueImages = images.filter((img) => {
    if (seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  });

  if (!title) return parseGenericaBr(html, url);

  const generic = parseGenericaBr(html, url);
  return {
    ...generic,
    title,
    description: full_description || generic.description,
    full_description: full_description || generic.full_description,
    sale_price: priceRaw || generic.sale_price,
    images: uniqueImages.length > 0 ? uniqueImages : generic.images,
  };
}

export const logosToParser: SiteParser = {
  hostnames: ["logos-to.com.br"],
  needsRendering: false,
  parse,
};
