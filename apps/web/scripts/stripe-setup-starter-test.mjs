/**
 * Cria produto e preco Starter (R$ 150/mes) no Stripe modo teste.
 * Uso (em apps/web): node scripts/stripe-setup-starter-test.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(envPath);

const key = process.env.STRIPE_SECRET_KEY;
if (!key?.startsWith("sk_test_")) {
  console.error("ERRO: defina STRIPE_SECRET_KEY=sk_test_... em apps/web/.env.local");
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });

const product = await stripe.products.create({
  name: "ImobQR Starter (teste)",
  description: "Assinatura mensal Starter — homologacao",
  metadata: { plan_code: "starter", environment: "staging" },
});

const price = await stripe.prices.create({
  product: product.id,
  currency: "brl",
  unit_amount: 15000,
  recurring: { interval: "month" },
  metadata: { plan_code: "starter" },
});

console.log("STRIPE_STARTER_PRODUCT_ID=" + product.id);
console.log("STRIPE_PRICE_STARTER=" + price.id);
