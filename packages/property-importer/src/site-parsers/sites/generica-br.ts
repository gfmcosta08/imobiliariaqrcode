/**
 * Parser genérico para imobiliárias brasileiras.
 *
 * Cobre sites que usam plataformas CMS comuns (Kenlo/Imoview, Jetimob, VistaHost,
 * Superlógica, etc.) com HTML estático e estrutura similar.
 *
 * Estratégia: lista extensa de seletores por ordem de especificidade,
 * selecionando o primeiro que retornar valor não-vazio.
 */
import * as cheerio from "cheerio";
import type { ExtratorListing } from "../../extrator-types";
import { cleanDescription, collectImages, firstText } from "../html-helpers";
import type { SiteParser } from "../types";

export function parseGenericaBr(html: string, url: string): Partial<ExtratorListing> {
  const $ = cheerio.load(html);

  // ── Título ──────────────────────────────────────────────────────────────────
  const title = firstText($, [
    "h1.imovel-title",
    "h1.property-title",
    "h1.titulo-imovel",
    "h1.titulo",
    ".imovel-detalhe h1",
    ".property-detail h1",
    ".ficha-imovel h1",
    ".detalhe-imovel h1",
    "h1[itemprop='name']",
    ".product-title h1",
    "h1",
  ]);

  // ── Descrição ────────────────────────────────────────────────────────────────
  const descRaw = firstText($, [
    ".descricao-completa",
    ".descricao-imovel",
    ".description-full",
    ".property-description",
    ".imovel-descricao",
    "#descricao",
    "[itemprop='description']",
    ".description",
    ".descricao",
    ".texto-descricao",
    ".detail-description",
    ".conteudo-descricao",
    "section.descricao",
    ".text-description",
    ".about-property p",
    ".property-info .text",
  ]);
  const full_description = cleanDescription(descRaw);

  // ── Preço ────────────────────────────────────────────────────────────────────
  const saleRaw = firstText($, [
    ".preco-venda",
    ".preco.venda",
    ".price-sale",
    ".valor-venda",
    "[class*='sale-price']",
    "[class*='preco-venda']",
    ".preco",
    ".valor",
    ".price",
    "[class*='price']",
    "[itemprop='price']",
    "[class*='valor']",
  ]);
  const rentRaw = firstText($, [
    ".preco-aluguel",
    ".preco.aluguel",
    ".price-rent",
    ".valor-aluguel",
    "[class*='rent-price']",
    "[class*='preco-aluguel']",
  ]);

  // ── Localização ───────────────────────────────────────────────────────────────
  const locationRaw = firstText($, [
    ".cidade-estado",
    ".location",
    ".endereco",
    "[class*='location']",
    "[class*='cidade']",
    "[class*='endereco']",
    "[itemprop='addressLocality']",
    ".property-address",
    "address",
    ".breadcrumb li:last-child",
    ".migas-de-pao li:last-child",
  ]);
  const bairroRaw = firstText($, [
    ".bairro",
    "[class*='bairro']",
    "[class*='neighborhood']",
    "[itemprop='addressRegion']",
    ".neighborhood",
  ]);
  const estadoRaw = firstText($, [
    "[class*='estado']",
    "[class*='state']",
    "[itemprop='addressCountry']",
    ".estado",
  ]);

  // ── Características ────────────────────────────────────────────────────────
  const bedText = firstText($, [
    "[class*='quarto']",
    "[class*='dormit']",
    "[class*='bedroom']",
    "[title*='quarto']",
    "[aria-label*='quarto']",
    ".quartos",
    ".dormitorios",
    ".bedrooms",
    "li.quartos",
    "li.dormitorios",
  ]);
  const bathText = firstText($, [
    "[class*='banheiro']",
    "[class*='bathroom']",
    "[title*='banheiro']",
    ".banheiros",
    ".bathrooms",
    "li.banheiros",
  ]);
  const areaText = firstText($, [
    "[class*='area']",
    "[class*='metragem']",
    "[class*='m2']",
    "[class*='tamanho']",
    ".area-total",
    ".area-util",
    ".area",
    "li.area",
    "[title*='área']",
    "[title*='m²']",
  ]);
  const parkText = firstText($, [
    "[class*='vaga']",
    "[class*='garage']",
    "[class*='estacion']",
    ".vagas",
    ".garagem",
    "li.vagas",
    "li.garagem",
  ]);
  const suiteText = firstText($, ["[class*='suite']", "[class*='suíte']", ".suites", "li.suites"]);

  const bedNum = bedText.match(/\d+/);
  const bathNum = bathText.match(/\d+/);
  const areaNum = areaText.match(/[\d,.]+/);
  const parkNum = parkText.match(/\d+/);
  const suiteNum = suiteText.match(/\d+/);

  // ── Subtipo ──────────────────────────────────────────────────────────────────
  const subtype = firstText($, [
    ".tipo-imovel",
    "[class*='tipo']",
    "[class*='type']",
    ".property-type",
    ".categoria",
    "[itemprop='category']",
    // breadcrumb is often: Home > Tipo > Cidade > Imóvel
    ".breadcrumb li:nth-child(2)",
    ".migas-de-pao li:nth-child(2)",
  ]);

  // ── Finalidade ───────────────────────────────────────────────────────────────
  const purposeRaw = (
    firstText($, [
      "[class*='finalidade']",
      "[class*='purpose']",
      "[class*='negocio']",
      ".tipo-negocio",
    ]) || saleRaw
  ).toLowerCase();
  const purpose: "" | "sale" | "rent" =
    purposeRaw.includes("alug") || rentRaw.length > 0
      ? "rent"
      : purposeRaw.includes("vend") || saleRaw.length > 0
        ? "sale"
        : "";

  // ── Código interno ────────────────────────────────────────────────────────
  const internalCode = firstText($, [
    "[class*='codigo']",
    "[class*='code']",
    "[class*='referencia']",
    "[class*='ref']",
    ".codigo-imovel",
    ".property-code",
    ".ref",
    "[id*='codigo']",
  ])
    .replace(/[^\w\-]/g, "")
    .slice(0, 20);

  // ── Imagens ──────────────────────────────────────────────────────────────────
  const images = collectImages(
    $,
    [
      // Kenlo/Imoview patterns
      ".galeria-fotos img",
      ".galeria img",
      ".foto-principal img",
      ".fotos img",
      "#galeria img",
      // Jetimob patterns
      ".property-gallery img",
      ".gallery-item img",
      ".carousel-item img",
      ".swiper-slide img",
      // Generic patterns
      "[class*='galeria'] img",
      "[class*='gallery'] img",
      "[class*='slider'] img",
      "[class*='carousel'] img",
      "[class*='foto'] img",
      "[class*='image-'] img",
      // Lightbox links
      "a[data-fancybox] img",
      "a[rel='lightbox'] img",
      "a[data-lightbox] img",
      // Meta tags
      "meta[property='og:image']",
      "meta[name='og:image']",
    ],
    url,
  );

  // Also parse meta og:image
  $("meta[property='og:image'], meta[name='og:image']").each((_i, el) => {
    const content = $(el).attr("content")?.trim();
    if (content && content.startsWith("http")) {
      images.push({ url: content });
    }
  });

  // Deduplicate
  const seen = new Set<string>();
  const uniqueImages = images.filter((img) => {
    if (seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  });

  // Derive city/state
  const parts = locationRaw.split(/[-–,]/);
  const city = parts[0]?.trim() ?? "";
  const state = estadoRaw || parts.find((p) => /^[A-Z]{2}$/.test(p.trim()))?.trim() || "";

  return {
    title,
    description: full_description,
    full_description,
    property_subtype: subtype,
    purpose,
    city,
    state,
    neighborhood: bairroRaw,
    bedrooms: bedNum ? parseInt(bedNum[0], 10) : null,
    suites: suiteNum ? parseInt(suiteNum[0], 10) : null,
    bathrooms: bathNum ? parseInt(bathNum[0], 10) : null,
    parking_spaces: parkNum ? parseInt(parkNum[0], 10) : null,
    area_m2: areaNum ? areaNum[0] : "",
    sale_price: purpose !== "rent" ? saleRaw : "",
    rent_price: purpose === "rent" ? rentRaw || saleRaw : "",
    internal_code: internalCode,
    images: uniqueImages,
  };
}

export const genericaBrParser: SiteParser = {
  // Sites que usam padrões genéricos — listados aqui para roteamento explícito
  hostnames: [
    "ritacamposnegocios.com.br",
    "estiloimobiliaria.com",
    "eduardomotaimoveis.com.br",
    "valadaresimoveis.com.br",
    "simimoveis.net",
    "ricanato.com.br",
    "boasorteimoveis.com.br",
    "imobgurupi.com.br",
    "varandaimobiliaria.com.br",
    "imobiliariatropical.com",
    "invistaemtocantins.com.br",
    "niloimoveis.com.br",
    "achelar.com.br",
    "dfimoveis.com.br",
  ],
  needsRendering: false,
  parse: parseGenericaBr,
};
