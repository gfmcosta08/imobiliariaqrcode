import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Legal evidence persistence", () => {
  it("keeps signup fail-closed when profile legal fields cannot persist", () => {
    const signup = read("src/app/api/auth/signup/route.ts");
    expect(signup).toContain("...legalAcceptance");
    expect(signup).toContain("if (profileErr)");
  });

  it("stops checkout when checkout acceptance cannot persist", () => {
    const checkout = read("src/app/api/stripe/create-checkout/route.ts");
    expect(checkout).toContain("checkout_legal_acceptance_events");
    expect(checkout).toContain("legal_acceptance_persist_failed");
    expect(checkout).toContain("if (acceptanceError)");
  });
});
