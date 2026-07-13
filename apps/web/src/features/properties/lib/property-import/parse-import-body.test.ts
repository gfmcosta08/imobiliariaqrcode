import { describe, expect, it } from "vitest";

import { resolveImportUrlFields } from "./parse-import-body";

describe("resolveImportUrlFields", () => {
  it("retorna no_url_fields quando body não tem url nem urls", () => {
    const result = resolveImportUrlFields({});
    expect(result).toEqual({ ok: false, error: "missing_url", detail: "no_url_fields" });
  });

  it("retorna urls_array_empty quando urls é array vazio", () => {
    const result = resolveImportUrlFields({ urls: [] });
    expect(result).toEqual({ ok: false, error: "missing_url", detail: "urls_array_empty" });
  });

  it("retorna url_field_empty quando url é string vazia", () => {
    const result = resolveImportUrlFields({ url: "" });
    expect(result).toEqual({ ok: false, error: "missing_url", detail: "url_field_empty" });
  });

  it("retorna urls_items_invalid quando urls não tem strings válidas", () => {
    const result = resolveImportUrlFields({ urls: [123, null, ""] });
    expect(result).toEqual({ ok: false, error: "missing_url", detail: "urls_items_invalid" });
  });

  it("aceita url única em string", () => {
    const result = resolveImportUrlFields({ url: "https://exemplo.com/imovel/1" });
    expect(result).toEqual({ ok: true, urls: ["https://exemplo.com/imovel/1"] });
  });

  it("aceita urls como array de strings", () => {
    const result = resolveImportUrlFields({
      urls: ["https://exemplo.com/a", "https://exemplo.com/b"],
    });
    expect(result).toEqual({
      ok: true,
      urls: ["https://exemplo.com/a", "https://exemplo.com/b"],
    });
  });

  it("aceita urls como string única (compat)", () => {
    const result = resolveImportUrlFields({ urls: "https://exemplo.com/imovel/1" });
    expect(result).toEqual({ ok: true, urls: ["https://exemplo.com/imovel/1"] });
  });

  it("trimma espaços nas URLs", () => {
    const result = resolveImportUrlFields({ url: "  https://exemplo.com/imovel/1  " });
    expect(result).toEqual({ ok: true, urls: ["https://exemplo.com/imovel/1"] });
  });
});
