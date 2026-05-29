import { describe, expect, it } from "vitest";

import type { ExtratorListing } from "./extrator-types";
import { mapExtratorListingToPropertyPayload } from "./map-to-property-payload";

function baseListing(overrides: Partial<ExtratorListing> = {}): ExtratorListing {
  return {
    property_subtype: "Apartamento",
    purpose: "sale",
    title: "Apartamento 3 quartos",
    description: "Descricao curta",
    city: "Palmas",
    state: "TO",
    neighborhood: "Plano Diretor",
    postal_code: "77000000",
    bedrooms: 3,
    suites: 1,
    bathrooms: 2,
    parking_spaces: 2,
    area_m2: "85",
    sale_price: "450.000",
    rent_price: "",
    condo_fee: "600",
    iptu_amount: "120",
    built_area_m2: "85",
    land_area_m2: "",
    full_address: "Rua Teste, 100",
    internal_code: "apartamento-teste",
    full_description: "Descricao completa",
    images: [{ url: "https://www.imobiliariasonhar.com.br/img/1.jpg" }],
    ...overrides,
  };
}

describe("mapExtratorListingToPropertyPayload", () => {
  it("mapeia para rascunho sem geolocalizacao", () => {
    const mapped = mapExtratorListingToPropertyPayload(
      baseListing(),
      "https://www.imobiliariasonhar.com.br/apartamento-teste",
    );
    expect(mapped.listing_status).toBe("draft");
    expect(mapped.location_map_url).toBeNull();
    expect(mapped.purpose).toBe("sale");
    expect(mapped.sale_price).toBe(450000);
    expect(mapped.property_subtype).toBe("Apartamento");
    expect(mapped.import_image_urls).toHaveLength(1);
    expect(mapped.broker_notes).toContain("Geolocalização pendente");
  });

  it("normaliza aluguel", () => {
    const mapped = mapExtratorListingToPropertyPayload(
      baseListing({ purpose: "rent", sale_price: "", rent_price: "2.500" }),
      "https://www.imobiliariasonhar.com.br/apartamento-aluguel",
    );
    expect(mapped.purpose).toBe("rent");
    expect(mapped.rent_price).toBe(2500);
    expect(mapped.price).toBe(2500);
  });

  it("preenche venda e aluguel com finalidade vazia quando ambos existem", () => {
    const mapped = mapExtratorListingToPropertyPayload(
      baseListing({
        purpose: "",
        sale_price: "680000",
        rent_price: "3200",
      }),
      "https://www.casa63.com.br/imovel/dual",
    );
    expect(mapped.purpose).toBeNull();
    expect(mapped.sale_price).toBe(680000);
    expect(mapped.rent_price).toBe(3200);
    expect(mapped.price).toBe(680000);
  });
});
