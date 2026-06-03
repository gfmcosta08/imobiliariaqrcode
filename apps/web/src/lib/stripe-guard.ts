/** Garante que cada ambiente use apenas a chave Stripe do modo correto. */

type VercelEnvironment = "production" | "preview" | "development" | string | undefined;

export function isStripeKeyAllowedForEnvironment(
  key: string | undefined,
  environment: VercelEnvironment = process.env.VERCEL_ENV,
): boolean {
  if (!key) return false;
  if (environment === "production") return key.startsWith("sk_live_");
  return key.startsWith("sk_test_");
}

export function assertStripeEnvironmentMode(): void {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const environment = process.env.VERCEL_ENV;

  if (!key) {
    throw new Error("STRIPE_SECRET_KEY ausente.");
  }
  if (environment === "production" && !key.startsWith("sk_live_")) {
    throw new Error("STRIPE_SECRET_KEY deve ser de producao (sk_live_) em producao.");
  }
  if (environment !== "production" && !key.startsWith("sk_test_")) {
    throw new Error("STRIPE_SECRET_KEY deve ser de teste (sk_test_) em homologacao.");
  }
}

export function assertStripeTestModeAllowed(): void {
  assertStripeEnvironmentMode();
}

export function redactStripeKeyForLogs(key: string | undefined): string {
  if (!key) return "(ausente)";
  if (key.startsWith("sk_test_")) return "sk_test_[REDACTED]";
  if (key.startsWith("sk_live_")) return "sk_live_[REDACTED]";
  return "[REDACTED]";
}
