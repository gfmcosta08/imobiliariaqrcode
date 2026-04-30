import { describe, expect, it } from "vitest";

import {
  applyHomePropertyFilters,
  parseHomeFilters,
  type HomePropertyCard,
} from "./home-properties";

function card(overrides: Partial<HomePropertyCard>): HomePropertyCard {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    public_id: overrides.public_id ?? "IMV-TESTE",
    qr_token: null,
    title: "Casa no centro",
    purpose: "sale",
    property_type: "Casa",
    property_subtype: "Padrao",
    city: "Palmas",
    state: "TO",
    neighborhood: "Centro",
    city_region: "Sul",
    bedrooms: 3,
    suites: 1,
    bathrooms: 2,
    parking_spaces: 2,
    living_rooms: 1,
    built_area_m2: 120,
    land_area_m2: 250,
    total_area_m2: 250,
    sale_price: 450000,
    rent_price: null,
    condo_fee: null,
    is_furnished: false,
    furnishing_status: null,
    floor_type: "Porcelanato",
    sun_position: "Nascente",
    image_url: null,
    detail_href: "/imoveis/IMV-TESTE",
    search_text: "casa no centro imv-teste codigo-1 casa padrao centro palmas to sul rua exemplo",
    ...overrides,
  };
}

describe("parseHomeFilters", () => {
  it("parseia finalidade e filtros numericos", () => {
    const filters = parseHomeFilters(
      new URLSearchParams("purpose=sale&bedrooms_min=3&sale_price_max=500.000,00"),
    );

    expect(filters.purpose).toBe("sale");
    expect(filters.bedrooms_min).toBe(3);
    expect(filters.sale_price_max).toBe(500000);
  });
});

describe("applyHomePropertyFilters", () => {
  it("filtra Comprar apenas por imoveis de venda", () => {
    const filters = parseHomeFilters(new URLSearchParams("purpose=sale"));
    const rows = [
      card({ id: "sale", purpose: "sale" }),
      card({ id: "rent", purpose: "rent", rent_price: 2500, sale_price: null }),
      card({ id: "season", purpose: "season", rent_price: 700, sale_price: null }),
    ];

    expect(applyHomePropertyFilters(rows, filters).map((row) => row.id)).toEqual(["sale"]);
  });

  it("filtra Alugar incluindo aluguel e temporada", () => {
    const filters = parseHomeFilters(new URLSearchParams("purpose=rent"));
    const rows = [
      card({ id: "sale", purpose: "sale" }),
      card({ id: "rent", purpose: "rent", rent_price: 2500, sale_price: null }),
      card({ id: "season", purpose: "season", rent_price: 700, sale_price: null }),
    ];

    expect(applyHomePropertyFilters(rows, filters).map((row) => row.id)).toEqual([
      "rent",
      "season",
    ]);
  });

  it("busca por cidade, bairro, public_id e codigo interno no texto indexado", () => {
    const rows = [
      card({ id: "palmas", search_text: "casa centro palmas imv-2026 codigo-abc rua 1" }),
      card({ id: "goiania", search_text: "apartamento bueno goiania imv-999 codigo-xyz" }),
    ];

    expect(
      applyHomePropertyFilters(rows, parseHomeFilters(new URLSearchParams("q=palmas"))),
    ).toHaveLength(1);
    expect(
      applyHomePropertyFilters(rows, parseHomeFilters(new URLSearchParams("q=centro"))),
    ).toHaveLength(1);
    expect(
      applyHomePropertyFilters(rows, parseHomeFilters(new URLSearchParams("q=IMV-999"))),
    ).toHaveLength(1);
    expect(
      applyHomePropertyFilters(rows, parseHomeFilters(new URLSearchParams("q=codigo-abc"))),
    ).toHaveLength(1);
  });

  it("combina filtros numericos minimos e maximos", () => {
    const filters = parseHomeFilters(
      new URLSearchParams("bedrooms_min=3&sale_price_max=500000&built_area_min=100"),
    );
    const rows = [
      card({ id: "match", bedrooms: 3, sale_price: 450000, built_area_m2: 120 }),
      card({ id: "small", bedrooms: 3, sale_price: 450000, built_area_m2: 80 }),
      card({ id: "expensive", bedrooms: 4, sale_price: 700000, built_area_m2: 160 }),
    ];

    expect(applyHomePropertyFilters(rows, filters).map((row) => row.id)).toEqual(["match"]);
  });
});
