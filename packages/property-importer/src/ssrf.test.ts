import { describe, expect, it } from "vitest";

import { isPropertyDetailPathname } from "./constants";
import { inferImportMode, validateImportUrl, validatePilotImportUrl } from "./ssrf";

describe("validateImportUrl (open)", () => {
  it("aceita sites imobiliários públicos via HTTPS", () => {
    const v = validateImportUrl("https://www.casa63.com.br/imovel/casa-terrea-bertaville/14015", {
      mode: "open",
      allowedHosts: [],
    });
    expect(v.ok).toBe(true);
  });

  it("aceita site piloto Sonhar", () => {
    const v = validateImportUrl("https://www.imobiliariasonhar.com.br/apartamento-teste", {
      mode: "open",
      allowedHosts: [],
    });
    expect(v.ok).toBe(true);
  });

  it("rejeita localhost e IPs privados", () => {
    expect(
      validateImportUrl("https://localhost/imovel", { mode: "open", allowedHosts: [] }).ok,
    ).toBe(false);
    expect(
      validateImportUrl("https://127.0.0.1/imovel", { mode: "open", allowedHosts: [] }).ok,
    ).toBe(false);
    expect(
      validateImportUrl("https://192.168.0.1/imovel", { mode: "open", allowedHosts: [] }).ok,
    ).toBe(false);
  });

  it("rejeita http", () => {
    const v = validateImportUrl("http://www.casa63.com.br/imovel", {
      mode: "open",
      allowedHosts: [],
    });
    expect(v.ok).toBe(false);
  });
});

describe("validateImportUrl (allowlist)", () => {
  it("aceita apenas hosts da lista", () => {
    const policy = { mode: "allowlist" as const, allowedHosts: ["casa63.com.br"] };
    expect(validateImportUrl("https://www.casa63.com.br/imovel/x", policy).ok).toBe(true);
    expect(validateImportUrl("https://www.outrosite.com.br/imovel/x", policy).ok).toBe(false);
  });
});

describe("validatePilotImportUrl", () => {
  it("aceita URL https do site piloto", () => {
    const v = validatePilotImportUrl("https://www.imobiliariasonhar.com.br/apartamento-teste");
    expect(v.ok).toBe(true);
  });

  it("rejeita host fora do piloto", () => {
    const v = validatePilotImportUrl("https://www.casa63.com.br/imovel/x");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toBe("host_not_allowed");
  });

  it("rejeita http", () => {
    const v = validatePilotImportUrl("http://www.imobiliariasonhar.com.br/apartamento-teste");
    expect(v.ok).toBe(false);
  });
});

describe("isPropertyDetailPathname", () => {
  it("reconhece rotas casa63 e genéricas", () => {
    expect(isPropertyDetailPathname("/imovel/casa-terrea-bertaville/14015")).toBe(true);
    expect(isPropertyDetailPathname("/property/luxury-apartment/12345")).toBe(true);
    expect(isPropertyDetailPathname("/imoveis")).toBe(false);
  });

  it("reconhece anúncio único OLX", () => {
    expect(isPropertyDetailPathname("/tocantins/lancamentos/terraco-urban-1503931")).toBe(true);
  });
});

describe("inferImportMode", () => {
  it("detecta single, listing e homepage", () => {
    const singleSlug = new URL("https://www.imobiliariasonhar.com.br/apartamento-3-quartos");
    const singleImovel = new URL(
      "https://www.imobiliariasonhar.com.br/imovel/casa-palmas-3-quartos-230-m/CA0340-SOOR",
    );
    const casa63 = new URL("https://www.casa63.com.br/imovel/casa-terrea-bertaville/14015");
    const olx = new URL("https://to.olx.com.br/tocantins/lancamentos/terraco-urban-1503931");
    const listing = new URL("https://www.imobiliariasonhar.com.br/imoveis");
    const home = new URL("https://www.imobiliariasonhar.com.br/");
    expect(inferImportMode(singleSlug)).toBe("single");
    expect(inferImportMode(singleImovel)).toBe("single");
    expect(inferImportMode(casa63)).toBe("single");
    expect(inferImportMode(olx)).toBe("single");
    expect(inferImportMode(listing)).toBe("listing");
    expect(inferImportMode(home)).toBe("homepage");
  });
});
