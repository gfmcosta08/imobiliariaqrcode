import { describe, expect, it } from "vitest";

import {
  IMPORT_IMAGE_CAP,
  SITE_IMPORT_REGISTRY,
  detectSiteImportDefinition,
  getGoldenFixtures,
  resolveImportSite,
} from "./registry";

describe("SITE_IMPORT_REGISTRY", () => {
  it("tem ids unicos", () => {
    const ids = SITE_IMPORT_REGISTRY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sites verified nao permitem fallback generico", () => {
    for (const entry of SITE_IMPORT_REGISTRY.filter((e) => e.tier === "verified")) {
      expect(entry.allowGenericFallback).toBe(false);
    }
  });

  it("kenlo precede generica-br para host compartilhado", () => {
    const kenloIdx = SITE_IMPORT_REGISTRY.findIndex((e) => e.id === "kenlo");
    const genericaIdx = SITE_IMPORT_REGISTRY.findIndex((e) => e.id === "generica-br");
    expect(kenloIdx).toBeGreaterThan(-1);
    expect(genericaIdx).toBeGreaterThan(-1);
    expect(kenloIdx).toBeLessThan(genericaIdx);

    const def = detectSiteImportDefinition("ritacamposnegocios.com.br");
    expect(def?.id).toBe("kenlo");
  });
});

describe("detectSiteImportDefinition", () => {
  it("resolve vivanci.com e www", () => {
    expect(detectSiteImportDefinition("vivanci.com")?.id).toBe("vivanci");
    expect(detectSiteImportDefinition("www.vivanci.com")?.id).toBe("vivanci");
  });

  it("resolve imobiliariasonhar", () => {
    expect(detectSiteImportDefinition("www.imobiliariasonhar.com.br")?.id).toBe(
      "imobiliariasonhar",
    );
  });

  it("retorna null para host desconhecido", () => {
    expect(detectSiteImportDefinition("example-unknown-site.com.br")).toBeNull();
  });
});

describe("resolveImportSite", () => {
  it("mensagem homologada para vivanci verified", () => {
    const result = resolveImportSite("https://vivanci.com/imovel/0826");
    expect(result.ok).toBe(true);
    expect(result.siteId).toBe("vivanci");
    expect(result.tier).toBe("verified");
    expect(result.message).toContain("Import homologado");
    expect(result.allowGenericFallback).toBe(false);
  });

  it("mensagem de aviso para site desconhecido", () => {
    const result = resolveImportSite("https://portal-desconhecido.com.br/imovel/1");
    expect(result.tier).toBe("unknown");
    expect(result.message).toContain("extrator genérico");
    expect(result.allowGenericFallback).toBe(true);
  });

  it("rejeita URL invalida", () => {
    const result = resolveImportSite("nao-e-url");
    expect(result.ok).toBe(false);
  });
});

describe("getGoldenFixtures", () => {
  it("vivanci tem fixtures 0826 e 0694", () => {
    const fixtures = getGoldenFixtures("vivanci");
    expect(fixtures.length).toBeGreaterThanOrEqual(2);
    expect(fixtures.some((f) => f.listingUrl.includes("0826"))).toBe(true);
    expect(fixtures.some((f) => f.listingUrl.includes("0694"))).toBe(true);
    for (const fixture of fixtures) {
      expect(fixture.minPhotos).toBeLessThanOrEqual(IMPORT_IMAGE_CAP);
    }
  });

  it("sonhar tem fixture de URL direta", () => {
    const fixtures = getGoldenFixtures("imobiliariasonhar");
    expect(fixtures.length).toBeGreaterThan(0);
    expect(fixtures[0]?.listingUrl).toContain("imobiliariasonhar.com.br");
  });
});
