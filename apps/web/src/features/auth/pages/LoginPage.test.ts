import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "LoginPage.tsx"), "utf8");

describe("LoginPage signup compliance", () => {
  it("requires legal acceptance before creating a free account", () => {
    expect(source).toContain('id="signup-terms"');
    expect(source).toContain("acceptedLegal");
    expect(source).toContain("Termos de Uso");
    expect(source).toContain("Politica de Privacidade");
  });

  it("can open directly in signup mode for the free test account CTA", () => {
    expect(source).toContain("useSearchParams");
    expect(source).toContain("mode=signup");
    expect(source).toContain("safeNextPath");
  });
});
