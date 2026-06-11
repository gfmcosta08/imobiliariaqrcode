/**
 * Registro central de importação por site (fonte única de verdade).
 *
 * Checklist para adicionar novo site:
 * 1. Criar parser em sites/
 * 2. Registrar aqui com tier, hostnames e CDNs de imagem
 * 3. Adicionar goldenFixtures
 * 4. Rodar E2E staging
 * 5. Promover para tier "verified" só após E2E verde
 */
import type { ExtratorListing } from "../extrator-types";
import { casa63Parser } from "./sites/casa63";
import { genericaBrParser } from "./sites/generica-br";
import { gestorImobParser } from "./sites/gestor-imob";
import { imobiliariasonharParser } from "./sites/imobiliariasonhar";
import { imperioNegociosParser } from "./sites/imperionegociosimob";
import { imoviewParser } from "./sites/imoview";
import { kenloParser } from "./sites/kenlo";
import { logosToParser } from "./sites/logos-to";
import { olxParser } from "./sites/olx";
import { fetchVivanciListingFromApi } from "./sites/vivanci-api";
import { vivanciparser } from "./sites/vivanci";
import { zapImoveisParser } from "./sites/zapimoveis";
import type { SiteParser } from "./types";

export type ImportSiteTier = "verified" | "supported" | "experimental";

export type ImportGoldenFixture = {
  listingUrl: string;
  minPhotos: number;
  minDescriptionLength: number;
};

export type SiteEnrichFn = (
  url: string,
  htmlPartial: Partial<ExtratorListing>,
) => Promise<Partial<ExtratorListing> | null>;

export type SiteImportDefinition = {
  id: string;
  displayName: string;
  hostnames: string[];
  tier: ImportSiteTier;
  parser: SiteParser;
  allowGenericFallback: boolean;
  enrich?: SiteEnrichFn;
  imageCdnHosts?: string[];
  goldenFixtures?: ImportGoldenFixture[];
  notes?: string;
};

export type ResolveImportSiteResult = {
  ok: boolean;
  hostname: string;
  siteId: string | null;
  displayName: string | null;
  tier: ImportSiteTier | "unknown";
  message: string;
  allowGenericFallback: boolean;
};

/** Limite de fotos por import (map-to-property-payload.slice). */
export const IMPORT_IMAGE_CAP = 10;

function normalizeHost(h: string): string {
  return h
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

export function mergeEnrichedListing(
  htmlPartial: Partial<ExtratorListing>,
  enriched: Partial<ExtratorListing> | null,
): Partial<ExtratorListing> {
  if (!enriched) return htmlPartial;

  const apiDesc = enriched.full_description?.trim() ?? "";
  const htmlDesc = htmlPartial.full_description?.trim() ?? "";
  const apiImages = enriched.images ?? [];
  const htmlImages = htmlPartial.images ?? [];

  return {
    ...htmlPartial,
    ...enriched,
    title: enriched.title?.trim() || htmlPartial.title,
    full_description: apiDesc.length >= htmlDesc.length ? apiDesc : htmlDesc,
    description:
      (apiDesc.length >= htmlDesc.length ? apiDesc : htmlDesc) || htmlPartial.description,
    images: apiImages.length >= htmlImages.length ? apiImages : htmlImages,
  };
}

async function enrichVivanci(
  url: string,
  htmlPartial: Partial<ExtratorListing>,
): Promise<Partial<ExtratorListing> | null> {
  return fetchVivanciListingFromApi(url);
}

export const SITE_IMPORT_REGISTRY: SiteImportDefinition[] = [
  {
    id: "imobiliariasonhar",
    displayName: "Imobiliária Sonhar",
    hostnames: imobiliariasonharParser.hostnames,
    tier: "verified",
    parser: imobiliariasonharParser,
    allowGenericFallback: false,
    goldenFixtures: [
      {
        listingUrl:
          "https://imobiliariasonhar.com.br/imovel/apartamento-palmas-2-quartos-65-m/AP0029-SOOR",
        minPhotos: 1,
        minDescriptionLength: 250,
      },
    ],
    notes: "Kenlo CMS — fetch direto, sem Playwright.",
  },
  {
    id: "vivanci",
    displayName: "Vivanci Imobiliária",
    hostnames: vivanciparser.hostnames,
    tier: "verified",
    parser: vivanciparser,
    allowGenericFallback: false,
    enrich: enrichVivanci,
    imageCdnHosts: ["static.arboimoveis.com.br", "tyqawceqowjmzgujrptx.supabase.co"],
    goldenFixtures: [
      {
        listingUrl: "https://vivanci.com/imovel/0826",
        minPhotos: IMPORT_IMAGE_CAP,
        minDescriptionLength: 1000,
      },
      {
        listingUrl: "https://vivanci.com/imovel/0694",
        minPhotos: IMPORT_IMAGE_CAP,
        minDescriptionLength: 400,
      },
    ],
    notes: "Plataforma Arbo — HTML + API Supabase; fotos em Supabase ou CDN Arbo.",
  },
  {
    id: "logos-to",
    displayName: "Logos Imobiliária TO",
    hostnames: logosToParser.hostnames,
    tier: "supported",
    parser: logosToParser,
    allowGenericFallback: true,
  },
  {
    id: "casa63",
    displayName: "Casa 63",
    hostnames: casa63Parser.hostnames,
    tier: "supported",
    parser: casa63Parser,
    allowGenericFallback: true,
  },
  {
    id: "imperionegociosimob",
    displayName: "Império Negócios Imobiliários",
    hostnames: imperioNegociosParser.hostnames,
    tier: "supported",
    parser: imperioNegociosParser,
    allowGenericFallback: true,
  },
  {
    id: "olx",
    displayName: "OLX",
    hostnames: olxParser.hostnames,
    tier: "experimental",
    parser: olxParser,
    allowGenericFallback: true,
    notes: "Best-effort — Cloudflare pode bloquear.",
  },
  {
    id: "zapimoveis",
    displayName: "Zap Imóveis",
    hostnames: zapImoveisParser.hostnames,
    tier: "experimental",
    parser: zapImoveisParser,
    allowGenericFallback: true,
    notes: "Best-effort.",
  },
  {
    id: "imoview",
    displayName: "ImoView CMS",
    hostnames: imoviewParser.hostnames,
    tier: "supported",
    parser: imoviewParser,
    allowGenericFallback: true,
  },
  {
    id: "gestor-imob",
    displayName: "Gestor Imobiliária",
    hostnames: gestorImobParser.hostnames,
    tier: "supported",
    parser: gestorImobParser,
    allowGenericFallback: true,
  },
  {
    id: "kenlo",
    displayName: "Kenlo CMS (genérico)",
    hostnames: kenloParser.hostnames,
    tier: "supported",
    parser: kenloParser,
    allowGenericFallback: true,
  },
  {
    id: "generica-br",
    displayName: "Imobiliária genérica BR",
    hostnames: genericaBrParser.hostnames,
    tier: "experimental",
    parser: genericaBrParser,
    allowGenericFallback: true,
  },
];

/** Parsers na ordem do registry (específico → genérico). */
export const ALL_PARSERS: SiteParser[] = SITE_IMPORT_REGISTRY.map((entry) => entry.parser);

export function detectSiteImportDefinition(hostname: string): SiteImportDefinition | null {
  const host = normalizeHost(hostname);
  for (const entry of SITE_IMPORT_REGISTRY) {
    for (const registered of entry.hostnames) {
      const norm = normalizeHost(registered);
      if (host === norm || host.endsWith(`.${norm}`)) {
        return entry;
      }
    }
  }
  return null;
}

export function getRegisteredImageCdnHosts(): string[] {
  const hosts = new Set<string>();
  for (const entry of SITE_IMPORT_REGISTRY) {
    for (const cdn of entry.imageCdnHosts ?? []) {
      hosts.add(cdn.toLowerCase());
    }
  }
  return [...hosts];
}

function tierMessage(def: SiteImportDefinition): string {
  if (def.tier === "verified") {
    return `Import homologado: ${def.displayName} — descrição completa e até ${IMPORT_IMAGE_CAP} fotos`;
  }
  if (def.tier === "experimental") {
    return `Parser experimental (${def.displayName}) — resultado pode falhar ou ficar incompleto`;
  }
  return `Parser disponível (${def.displayName}), mas não validado em staging — resultado pode variar`;
}

export function resolveImportSite(input: string): ResolveImportSiteResult {
  let hostname = "";
  try {
    hostname = normalizeHost(new URL(input.trim()).hostname);
  } catch {
    return {
      ok: false,
      hostname: "",
      siteId: null,
      displayName: null,
      tier: "unknown",
      message: "URL inválida — use um endereço HTTPS completo",
      allowGenericFallback: true,
    };
  }

  const def = detectSiteImportDefinition(hostname);
  if (!def) {
    return {
      ok: true,
      hostname,
      siteId: null,
      displayName: null,
      tier: "unknown",
      message: "Site não homologado — tentativa via extrator genérico (pode falhar)",
      allowGenericFallback: true,
    };
  }

  return {
    ok: true,
    hostname,
    siteId: def.id,
    displayName: def.displayName,
    tier: def.tier,
    message: tierMessage(def),
    allowGenericFallback: def.allowGenericFallback,
  };
}

export function getGoldenFixtures(siteId: string): ImportGoldenFixture[] {
  const entry = SITE_IMPORT_REGISTRY.find((e) => e.id === siteId);
  return entry?.goldenFixtures ?? [];
}
