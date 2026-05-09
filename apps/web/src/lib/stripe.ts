import Stripe from "stripe";

function createStripeClient(): Stripe {
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

// IDs dos preços cadastrados no Stripe Dashboard.
// Configure valores de teste com sk_test e valores de produção com sk_live.
export const STRIPE_PRICES = {
  solo: process.env.STRIPE_PRICE_SOLO ?? "", // pagamento único R$ 150 por 3 meses
  pro: process.env.STRIPE_PRICE_PRO ?? "", // recorrente mensal R$ 500
  premium: process.env.STRIPE_PRICE_PREMIUM ?? "", // recorrente mensal R$ 2.000
} as const;

export type StripePlanCode = keyof typeof STRIPE_PRICES;
