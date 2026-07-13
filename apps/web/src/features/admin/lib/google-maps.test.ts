import { describe, expect, it } from "vitest";

import { buildGoogleMapsUrl, hasPropertyLocation } from "./google-maps";

describe("google-maps", () => {
  it("builds maps url", () => {
    expect(buildGoogleMapsUrl(-23.55, -46.63)).toBe("https://www.google.com/maps?q=-23.55,-46.63");
  });

  it("checks location availability", () => {
    expect(hasPropertyLocation(-23.55, -46.63)).toBe(true);
    expect(hasPropertyLocation(null, -46.63)).toBe(false);
  });
});
