import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ACTIVE_PLAN_CODES, CHECKOUT_PLAN_CODE, STARTER_MONTHLY_BRL } from "@/lib/plans";
import { assertStripeTestModeAllowed } from "@/lib/stripe-guard";

describe("Free + Starter", () => {
  it("publishes only free and starter", () => {
    expect(ACTIVE_PLAN_CODES).toEqual(["free", "starter"]);
    expect(CHECKOUT_PLAN_CODE).toBe("starter");
    expect(STARTER_MONTHLY_BRL).toBe(150);
  });
});

describe("Stripe preview safety", () => {
  const env = process.env;
  beforeEach(() => {
    process.env = { ...env, VERCEL_ENV: "preview" };
  });
  afterEach(() => {
    process.env = env;
  });

  it("rejects live keys in preview", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_fake";
    expect(() => assertStripeTestModeAllowed()).toThrow(/sk_test_/);
  });

  it("accepts test keys in preview", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    expect(() => assertStripeTestModeAllowed()).not.toThrow();
  });
});
