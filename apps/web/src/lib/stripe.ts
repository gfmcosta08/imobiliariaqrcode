import Stripe from "stripe";

import { assertStripeTestModeAllowed } from "@/lib/stripe-guard";

function createStripeClient(): Stripe {
  assertStripeTestModeAllowed();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY ausente nas variáveis de ambiente.");
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia", typescript: true });
}

let _stripe: Stripe | null = null;

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripe) _stripe = createStripeClient();
    return (_stripe as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const STRIPE_PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER ?? process.env.STRIPE_PRICE_SOLO ?? "",
} as const;

export type StripePlanCode = keyof typeof STRIPE_PRICES;
