import { describe, expect, it } from "vitest";

import { parsePastedListing } from "./pasted-listing";

describe("parsePastedListing", () => {
  it("extracts BRL sale price", () => {
    const draft = parsePastedListing("Apartamento a venda por R$ 850.000 em Salvador");
    expect(draft.sale_price).toBe(850_000);
  });

  it("extracts rent price", () => {
    const draft = parsePastedListing("Aluguel R$ 3.200,00 com 2 quartos");
    expect(draft.rent_price).toBe(3_200);
  });

  it("extracts bedrooms from quartos", () => {
    const draft = parsePastedListing("Casa com 3 quartos e 2 banheiros");
    expect(draft.bedrooms).toBe(3);
    expect(draft.bathrooms).toBe(2);
  });

  it("extracts area from m2", () => {
    const draft = parsePastedListing("Area de 120 m2");
    expect(draft.area).toBe(120);
  });

  it("returns null for missing values", () => {
    const draft = parsePastedListing("Texto sem dados estruturados");
    expect(draft.city).toBeNull();
    expect(draft.neighborhood).toBeNull();
    expect(draft.sale_price).toBeNull();
  });
});
