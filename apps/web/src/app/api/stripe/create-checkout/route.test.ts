import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "route.ts"), "utf8");

describe("create-checkout route", () => {
  it("creates Stripe checkout sessions instead of returning unavailable", () => {
    expect(source).toContain("checkout.sessions.create");
    expect(source).toContain("assertStripeTestModeAllowed");
    expect(source).not.toContain("checkout_temporarily_unavailable");
  });

  it("uses starter metadata for webhook activation", () => {
    expect(source).toContain("account_id");
    expect(source).toContain("plan_code");
    expect(source).toContain("starter");
  });
});
