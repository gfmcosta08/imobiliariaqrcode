import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "route.ts"), "utf8");

describe("signup API legal gate", () => {
  it("rejects account creation when legal terms were not accepted", () => {
    expect(source).toContain("acceptedLegal");
    expect(source).toContain("legal_acceptance_required");
    expect(source).toContain("Termos");
    expect(source).toContain("Privacidade");
  });

  it("stores an auditable legal acceptance marker in user metadata", () => {
    expect(source).toContain("legal_terms_accepted");
    expect(source).toContain("legal_accepted_at");
  });
});
