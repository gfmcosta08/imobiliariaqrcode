/**
 * Parser para imobiliariasonhar.com.br
 *
 * Este site usa uma plataforma customizada com botão "ver mais" JavaScript.
 * needsRendering=true garante que o extrator (Playwright) renderiza a página
 * e expande a descrição antes de retornar o HTML.
 */
import * as cheerio from "cheerio";
import type { ExtratorListing } from "../../extrator-types";
import { cleanDescription, collectImages, firstText } from "../html-helpers";
import { parseGenericaBr } from "./generica-br";
import type { SiteParser } from "../types";

function parse(html: string, url: string): Partial<ExtratorListing> {
  const $ = cheerio.load(html);

  // Tenta seletores específicos do sonhar primeiro
  const titleSpecific = firstText($, [
    ".imovel-titulo",
    ".imovel-title",
    ".ficha-titulo",
    "h1.titulo",
    ".titulo-anuncio",
    "h1",
  ]);

  const descSpecific = firstText($, [
    ".imovel-descricao-completa",
    ".descricao-completa",
    ".texto-completo",
    ".imovel-descricao",
    "#descricao-completa",
    "#descricao",
    ".description",
    ".descricao",
    // Após clicar "ver mais" o conteúdo fica visível
    "[class*='ver-mais-conteudo']",
    "[class*='descricao-expandida']",
    ".descricao-imovel",
    "section.descricao p",
  ]);

  const images = collectImages(
    $,
    [
      ".galeria-imovel img",
      ".galeria img",
      ".fotos-imovel img",
      ".slider-fotos img",
      ".swiper-slide img",
      ".carousel img",
      "[class*='galeria'] img",
      "[class*='foto'] img",
      "[class*='slider'] img",
      "a[data-fancybox] img",
      "a[rel='lightbox'] img",
      "a[data-lightbox] img",
      // lightbox links that wrap the full-size image
      "a[data-fancybox]",
    ],
    url,
  );

  // Also collect from meta
  $("meta[property='og:image']").each((_i, el) => {
    const c = $(el).attr("content")?.trim();
    if (c && c.startsWith("http")) images.push({ url: c });
  });

  const seen = new Set<string>();
  const uniqueImages = images.filter((img) => {
    if (seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  });

  if (titleSpecific || descSpecific || uniqueImages.length > 0) {
    // Merge with generic for fields not found in specific selectors
    const generic = parseGenericaBr(html, url);
    return {
      ...generic,
      ...(titleSpecific ? { title: titleSpecific } : {}),
      ...(descSpecific
        ? {
            description: cleanDescription(descSpecific),
            full_description: cleanDescription(descSpecific),
          }
        : {}),
      ...(uniqueImages.length > 0 ? { images: uniqueImages } : {}),
    };
  }

  return parseGenericaBr(html, url);
}

export const imobiliariasonharParser: SiteParser = {
  hostnames: ["imobiliariasonhar.com.br"],
  needsRendering: true,
  parse,
};
