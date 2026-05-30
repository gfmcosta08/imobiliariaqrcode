/**
 * Parser para sites que usam a plataforma ImoView / Universal Software.
 * Identificada em: varandaimobiliaria.com.br
 * CDN de imagens: cdn.imoview.com.br
 *
 * Seletores confirmados por inspeção:
 *   Título:    h1.titulo-principal
 *   Descrição: .descricao / p.descricao
 *   Preço:     h6.preco-imovel (ou .detalhes_color_preco)
 *   Galeria:   .galeria-vs2 img  (lazy: atributo data-src ou src)
 *   URL:       /imovel/{slug}/{codigo}
 */
import * as cheerio from "cheerio";
import type { ExtratorListing } from "../../extrator-types";
import { cleanDescription, collectImages, firstText } from "../html-helpers";
import { parseGenericaBr } from "./generica-br";
import type { SiteParser } from "../types";

function parse(html: string, url: string): Partial<ExtratorListing> {
  const $ = cheerio.load(html);

  const title = firstText($, [
    "h1.titulo-principal",
    ".titulo-principal",
    "h1.imovel-titulo",
    "h1.titulo",
    ".detalhe-titulo h1",
    "h1",
  ]);

  const descRaw = firstText($, [
    ".descricao-completa",
    ".descricao-imovel",
    "p.descricao",
    ".descricao",
    "#descricao",
    "[class*='descricao']",
    "[class*='description']",
  ]);
  const full_description = cleanDescription(descRaw);

  const priceRaw = firstText($, [
    "h6.preco-imovel",
    ".preco-imovel",
    ".detalhes_color_preco",
    "[class*='preco-imovel']",
    "[class*='preco']",
    "[class*='valor']",
    ".price",
  ]);

  const images = collectImages(
    $,
    [
      ".galeria-vs2 img",
      ".galeria-vs2 a",
      ".galeria img",
      "#galeria img",
      "[class*='galeria'] img",
      "[class*='galeria'] a",
      // ImoView lazy-loading pattern
      "img[data-src*='cdn.imoview.com.br']",
      "img[src*='cdn.imoview.com.br']",
      "a[href*='cdn.imoview.com.br']",
      // Thumbnail/full links
      ".foto-destaque img",
      ".thumb img",
    ],
    url,
  );

  // ImoView often puts full-size image URLs in anchor href
  $("a[href*='cdn.imoview.com.br'], a[href*='.jpg'], a[href*='.jpeg'], a[href*='.webp']").each((_i, el) => {
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

export const imoviewParser: SiteParser = {
  hostnames: [
    "varandaimobiliaria.com.br",
    // outros sites ImoView/Universal Software podem ser adicionados aqui
  ],
  needsRendering: false,
  parse,
};
