import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  ACTIVE_PLAN_CODES,
  CHECKOUT_PLAN_CODE,
  FREE_ACTIVE_PROPERTY_LIMIT,
  PLAN_IMAGES_PER_PROPERTY_LIMIT,
  STARTER_ACTIVE_PROPERTY_LIMIT,
  STARTER_IMPORT_BATCHES_PER_MONTH,
  STARTER_INCLUDED_USERS,
  STARTER_MONTHLY_BRL,
} from "@/lib/plans";
import { assertStripeTestModeAllowed, redactStripeKeyForLogs } from "@/lib/stripe-guard";
import { LEGAL_VERSION, LEGAL_ROUTES } from "@/lib/legal";

describe("planos Free + Starter", () => {
  it("catalogo ativo contem apenas free e starter", () => {
    expect(ACTIVE_PLAN_CODES).toEqual(["free", "starter"]);
    expect(CHECKOUT_PLAN_CODE).toBe("starter");
    expect(STARTER_MONTHLY_BRL).toBe(150);
    expect(FREE_ACTIVE_PROPERTY_LIMIT).toBe(1);
    expect(STARTER_ACTIVE_PROPERTY_LIMIT).toBe(10);
    expect(PLAN_IMAGES_PER_PROPERTY_LIMIT).toBe(10);
    expect(STARTER_IMPORT_BATCHES_PER_MONTH).toBe(3);
    expect(STARTER_INCLUDED_USERS).toBe(1);
  });

  it("rotas legais estao definidas", () => {
    expect(LEGAL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(LEGAL_ROUTES.terms).toBe("/termos");
    expect(LEGAL_ROUTES.privacy).toBe("/privacidade");
    expect(LEGAL_ROUTES.refund_cancellation).toBe("/cancelamento-reembolso");
  });
});

describe("stripe guard (homologacao)", () => {
  const env = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it("rejeita sk_live fora de producao", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.STRIPE_SECRET_KEY = "sk_live_fake";
    expect(() => assertStripeTestModeAllowed()).toThrow(/sk_test_/);
  });

  it("aceita sk_test em preview", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    expect(() => assertStripeTestModeAllowed()).not.toThrow();
  });

  it("nao vaza segredo completo em logs", () => {
    expect(redactStripeKeyForLogs("sk_test_51abc")).toBe("sk_test_[REDACTED]");
    expect(redactStripeKeyForLogs("sk_live_51abc")).toBe("sk_live_[REDACTED]");
    expect(redactStripeKeyForLogs(undefined)).toBe("(ausente)");
  });
});
