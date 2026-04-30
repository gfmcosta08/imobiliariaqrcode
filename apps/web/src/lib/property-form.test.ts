import { describe, expect, it } from "vitest";

import { buildPropertyPayload, validateLocationMapUrl } from "./property-form";

describe("buildPropertyPayload", () => {
  it("parseia lista de texto por virgula e quebra de linha", () => {
    const fd = new FormData();
    fd.set("features", "Piscina, Churrasqueira\nAcademia");

    const payload = buildPropertyPayload(fd);
    expect(payload.features).toEqual(["Piscina", "Churrasqueira", "Academia"]);
  });

  it("parseia boolean tri-state", () => {
    const fd = new FormData();
    fd.set("accepts_financing", "true");
    fd.set("accepts_trade", "false");
    const payload = buildPropertyPayload(fd);
    expect(payload.accepts_financing).toBe(true);
    expect(payload.accepts_trade).toBe(false);
  });

  it("parseia numeros no formato BR", () => {
    const fd = new FormData();
    fd.set("sale_price", "1.234.567,89");
    fd.set("total_area_m2", "250,5");
    fd.set("purpose", "sale");

    const payload = buildPropertyPayload(fd);
    expect(payload.sale_price).toBeCloseTo(1234567.89);
    expect(payload.total_area_m2).toBeCloseTo(250.5);
    expect(payload.price).toBeCloseTo(1234567.89);
    expect(payload.area_m2).toBeCloseTo(250.5);
  });

  it("suporta finalidade temporada e mobiliado semi", () => {
    const fd = new FormData();
    fd.set("purpose", "season");
    fd.set("furnishing_status", "semi_furnished");
    fd.set("rent_price", "3.500,00");
    const payload = buildPropertyPayload(fd);
    expect(payload.purpose).toBe("season");
    expect(payload.furnishing_status).toBe("semi_furnished");
    expect(payload.is_furnished).toBe(true);
    expect(payload.price).toBeCloseTo(3500);
  });

  it("permite rascunho sem link de geolocalizacao", () => {
    const fd = new FormData();
    fd.set("listing_status", "draft");

    const payload = buildPropertyPayload(fd);
    expect(payload.location_map_url).toBeNull();
    expect(validateLocationMapUrl(payload.listing_status, payload.location_map_url)).toBeNull();
  });

  it("bloqueia publicacao sem link de geolocalizacao", () => {
    const fd = new FormData();
    fd.set("listing_status", "published");

    const payload = buildPropertyPayload(fd);
    expect(validateLocationMapUrl(payload.listing_status, payload.location_map_url)).toBe(
      "Informe a localização do imóvel.",
    );
  });

  it("bloqueia publicacao com texto comum no link de geolocalizacao", () => {
    const fd = new FormData();
    fd.set("listing_status", "published");
    fd.set("location_map_url", "Rua exemplo");

    const payload = buildPropertyPayload(fd);
    expect(validateLocationMapUrl(payload.listing_status, payload.location_map_url)).toBe(
      "Insira um link de geolocalização válido.",
    );
  });

  it("permite publicacao com URL http ou https valida", () => {
    const fd = new FormData();
    fd.set("listing_status", "published");
    fd.set("location_map_url", "https://maps.google.com/?q=-10,-48");

    const payload = buildPropertyPayload(fd);
    expect(payload.location_map_url).toBe("https://maps.google.com/?q=-10,-48");
    expect(validateLocationMapUrl(payload.listing_status, payload.location_map_url)).toBeNull();
  });

  it("normaliza espacos extras do link de geolocalizacao", () => {
    const fd = new FormData();
    fd.set("listing_status", "printed");
    fd.set("location_map_url", "  https://maps.google.com/place/teste  ");

    const payload = buildPropertyPayload(fd);
    expect(payload.location_map_url).toBe("https://maps.google.com/place/teste");
    expect(validateLocationMapUrl(payload.listing_status, payload.location_map_url)).toBeNull();
  });
});
