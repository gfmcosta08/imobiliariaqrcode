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
  // Seletores confirmados por inspeção real (Kenlo CMS)
  const titleSpecific = firstText($, [
    "h1 > span",
    "h1",
    ".imovel-titulo",
    ".imovel-title",
    ".ficha-titulo",
    "h1.titulo",
    ".titulo-anuncio",
  ]);

  const descSpecific = firstText($, [
    // Kenlo CMS — descrição completa após "ver mais" expandido
    ".box-description",
    ".box-description p",
    "[class*='box-description']",
    ".imovel-descricao-completa",
    ".descricao-completa",
    ".texto-completo",
    ".imovel-descricao",
    "#descricao-completa",
    "#descricao",
    ".description",
    ".descricao",
    "[class*='ver-mais-conteudo']",
    "[class*='descricao-expandida']",
    ".descricao-imovel",
    "section.descricao p",
  ]);

  // Preço Kenlo: .price-text ou h6
  const priceSpecific = firstText($, [
    ".price-text",
    "[class*='price-text']",
    "h6",
    "[class*='preco']",
    "[class*='price']",
  ]);

  const images = collectImages(
    $,
    [
      // Kenlo CDN (imgs.kenlo.io) — confirmado
      "img[src*='imgs.kenlo.io']",
      "img[data-src*='imgs.kenlo.io']",
      "img[src*='kenlo.io']",
      "img[data-src*='kenlo.io']",
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
      ...(priceSpecific ? { sale_price: priceSpecific } : {}),
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
