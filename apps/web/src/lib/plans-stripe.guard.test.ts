import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ACTIVE_PLAN_CODES,
  ACTIVE_SUBSCRIPTION_STATUSES,
  CHECKOUT_PLAN_CODE,
  STARTER_MONTHLY_BRL,
} from "@/lib/plans";
import {
  assertStripeEnvironmentMode,
  assertStripeTestModeAllowed,
  isStripeKeyAllowedForEnvironment,
} from "@/lib/stripe-guard";

describe("Free + Starter", () => {
  it("publishes only free and starter", () => {
    expect(ACTIVE_PLAN_CODES).toEqual(["free", "starter"]);
    expect(CHECKOUT_PLAN_CODE).toBe("starter");
    expect(STARTER_MONTHLY_BRL).toBe(150);
  });

  it("treats starter as an active subscription status", () => {
    expect(ACTIVE_SUBSCRIPTION_STATUSES).toContain("starter_active");
    expect(ACTIVE_SUBSCRIPTION_STATUSES).toContain("past_due");
    expect(ACTIVE_SUBSCRIPTION_STATUSES).toContain("canceled");
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

describe("Stripe production readiness", () => {
  const env = process.env;
  beforeEach(() => {
    process.env = { ...env, VERCEL_ENV: "production" };
  });
  afterEach(() => {
    process.env = env;
  });

  it("rejects test keys in production", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    expect(() => assertStripeEnvironmentMode()).toThrow(/sk_live_/);
    expect(isStripeKeyAllowedForEnvironment("sk_test_fake", "production")).toBe(false);
  });

  it("accepts live keys in production", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_fake";
    expect(() => assertStripeEnvironmentMode()).not.toThrow();
    expect(isStripeKeyAllowedForEnvironment("sk_live_fake", "production")).toBe(true);
  });
});
