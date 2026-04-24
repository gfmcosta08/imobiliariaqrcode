import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY ausente nas variáveis de ambiente.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-03-25.dahlia",
  typescript: true,
});

// IDs dos preços cadastrados no Stripe Dashboard.
// Preencha após criar os produtos/preços no painel do Stripe.
export const STRIPE_PRICES = {
  solo: process.env.STRIPE_PRICE_SOLO ?? "",        // pagamento único R$ 150
  pro: process.env.STRIPE_PRICE_PRO ?? "",           // recorrente mensal R$ 500
  premium: process.env.STRIPE_PRICE_PREMIUM ?? "",   // recorrente mensal R$ 1.000
} as const;

export type StripePlanCode = keyof typeof STRIPE_PRICES;
