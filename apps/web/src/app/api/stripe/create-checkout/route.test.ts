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

  it("authenticates the request before exposing Stripe configuration state", () => {
    const authIndex = source.indexOf("auth.getUser");
    const guardIndex = source.indexOf("assertStripeTestModeAllowed();");
    const priceIndex = source.indexOf("STRIPE_STARTER_PRICE_ID");

    expect(authIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeGreaterThan(authIndex);
    expect(priceIndex).toBeGreaterThan(authIndex);
  });

  it("accepts the legacy staging Starter price env name while staging is being realigned", () => {
    expect(source).toContain("STRIPE_STARTER_PRICE_ID");
    expect(source).toContain("STRIPE_PRICE_STARTER");
  });

  it("prefills and repairs the Stripe customer email before checkout", () => {
    expect(source).toContain("const customerEmail = user.email?.trim() || undefined");
    expect(source).toContain("email: customerEmail");
    expect(source).toContain("stripe.customers.update");

    const customerIndex = source.indexOf("stripe.customers.create");
    const repairIndex = source.indexOf("stripe.customers.update");
    const checkoutIndex = source.indexOf("stripe.checkout.sessions.create");

    expect(customerIndex).toBeGreaterThan(-1);
    expect(repairIndex).toBeGreaterThan(customerIndex);
    expect(checkoutIndex).toBeGreaterThan(repairIndex);
  });
});
