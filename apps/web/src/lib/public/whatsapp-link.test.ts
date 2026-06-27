import { describe, expect, it } from "vitest";

import { chooseWhatsappRedirect } from "./whatsapp-link";

describe("chooseWhatsappRedirect", () => {
  it("prioriza deep link em mobile", () => {
    expect(
      chooseWhatsappRedirect(
        "https://wa.me/5511999998888?text=oi",
        "whatsapp://send?phone=5511999998888&text=oi",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      ),
    ).toBe("whatsapp://send?phone=5511999998888&text=oi");
  });

  it("usa wa.me em desktop", () => {
    expect(
      chooseWhatsappRedirect(
        "https://wa.me/5511999998888?text=oi",
        "whatsapp://send?phone=5511999998888&text=oi",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      ),
    ).toBe("https://wa.me/5511999998888?text=oi");
  });

  it("faz fallback para deep link quando nao ha link web", () => {
    expect(
      chooseWhatsappRedirect(null, "whatsapp://send?phone=5511999998888&text=oi", "desktop"),
    ).toBe("whatsapp://send?phone=5511999998888&text=oi");
  });
});
