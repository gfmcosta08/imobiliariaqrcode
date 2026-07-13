/** Garante uso exclusivo de chaves Stripe de teste fora de produção. */

export function assertStripeTestModeAllowed(): void {
  if (process.env.VERCEL_ENV === "production") return;

  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY ausente.");
  }
  if (!key.startsWith("sk_test_")) {
    throw new Error("STRIPE_SECRET_KEY deve ser de teste (sk_test_) em homologacao.");
  }
}

export function redactStripeKeyForLogs(key: string | undefined): string {
  if (!key) return "(ausente)";
  if (key.startsWith("sk_test_")) return "sk_test_[REDACTED]";
  if (key.startsWith("sk_live_")) return "sk_live_[REDACTED]";
  return "[REDACTED]";
}
