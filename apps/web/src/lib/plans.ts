/** Planos comerciais ativos (homologação / produção futura). */
export const ACTIVE_PLAN_CODES = ["free", "starter"] as const;
export type ActivePlanCode = (typeof ACTIVE_PLAN_CODES)[number];

export const CHECKOUT_PLAN_CODE = "starter" as const;

export const STARTER_MONTHLY_BRL = 150;

export const ACTIVE_SUBSCRIPTION_STATUSES = [
  "free",
  "starter_active",
  "pro_pending_activation",
  "pro_active",
] as const;
