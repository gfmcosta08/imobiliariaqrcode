import { describe, expect, it } from "vitest";

import { buildConvitePrintTitle } from "./convite-print";

describe("buildConvitePrintTitle", () => {
  it("inclui o public_id no titulo sugerido ao salvar PDF", () => {
    expect(buildConvitePrintTitle("IMV-2026-ABC123")).toBe("Convite Cortesia - IMV-2026-ABC123");
  });

  it("usa fallback quando public_id estiver ausente", () => {
    expect(buildConvitePrintTitle(null)).toBe("Convite Cortesia - sem ID");
    expect(buildConvitePrintTitle("   ")).toBe("Convite Cortesia - sem ID");
  });
});
