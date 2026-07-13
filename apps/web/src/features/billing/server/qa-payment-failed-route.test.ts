import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "qa-payment-failed-route.ts"), "utf8");

describe("qa stripe payment failed route", () => {
  it("is denied in production and restricted to QA users", () => {
    expect(source).toContain('process.env.VERCEL_ENV === "production"');
    expect(source).toContain("qa_user_required");
    expect(source).toContain("assertStripeTestModeAllowed");
  });

  it("uses a Stripe test clock and failing billing card", () => {
    expect(source).toContain("testHelpers.testClocks.create");
    expect(source).toContain("testHelpers.testClocks.advance");
    expect(source).toContain("pm_card_chargeCustomerFail");
  });
});
