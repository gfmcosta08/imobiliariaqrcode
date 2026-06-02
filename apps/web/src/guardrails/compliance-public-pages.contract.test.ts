import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const cwd = process.cwd();
const read = (path: string) => readFileSync(join(cwd, path), "utf8");

describe("Public compliance pages", () => {
  it("publishes the real supplier identification without legal placeholders", () => {
    const legalEntity = read("src/lib/legal-entity.ts");
    const termsPage = read("src/app/termos/page.tsx");
    const privacyPage = read("src/app/privacidade/page.tsx");

    expect(legalEntity).toContain("66.615.554/0001-01");
    expect(legalEntity).toContain("GIANPAOLO FERREIRA MATOS COSTA");
    expect(termsPage).toContain("LEGAL_ENTITY");
    expect(privacyPage).toContain("LEGAL_ENTITY");
    expect(termsPage).not.toContain("[PREENCHER");
    expect(privacyPage).not.toContain("[PREENCHER");
  });

  it("publishes content removal and cancellation channels", () => {
    const removalPage = read("src/app/remocao-de-conteudo/page.tsx");
    const cancellationPage = read("src/app/cancelamento-e-reembolso/page.tsx");

    expect(removalPage).toContain("LEGAL_ENTITY.legalEmail");
    expect(removalPage).toContain("Direitos autorais");
    expect(cancellationPage).toContain("LEGAL_ENTITY.supportEmail");
    expect(cancellationPage).toContain("Cancelamento");
    expect(cancellationPage).toContain("Reembolso");
  });

  it("exposes public legal links from the landing page and plans catalog", () => {
    const homePage = read("src/app/page.tsx");
    const plansPage = read("src/app/plans/page.tsx");

    for (const href of [
      "/termos",
      "/privacidade",
      "/remocao-de-conteudo",
      "/cancelamento-e-reembolso",
    ]) {
      expect(homePage).toContain(href);
      expect(plansPage).toContain(href);
    }
  });

  it("keeps checkout labels disabled while online checkout is unavailable", () => {
    const checkoutButton = read("src/app/plans/checkout-button.tsx");

    expect(checkoutButton).toContain("Checkout indisponivel");
    expect(checkoutButton).not.toContain("{label}");
  });
});
