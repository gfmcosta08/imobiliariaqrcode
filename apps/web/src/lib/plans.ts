/** Planos comerciais ativos (homologacao / producao futura). */
export const ACTIVE_PLAN_CODES = ["free", "starter"] as const;
export type ActivePlanCode = (typeof ACTIVE_PLAN_CODES)[number];

export const CHECKOUT_PLAN_CODE = "starter" as const;

export const STARTER_MONTHLY_BRL = 150;
export const FREE_ACTIVE_PROPERTY_LIMIT = 1;
export const STARTER_ACTIVE_PROPERTY_LIMIT = 10;
export const PLAN_IMAGES_PER_PROPERTY_LIMIT = 10;
export const STARTER_IMPORT_BATCHES_PER_MONTH = 3;
export const STARTER_INCLUDED_USERS = 1;

export const ACTIVE_SUBSCRIPTION_STATUSES = [
  "free",
  "starter_active",
  "pro_pending_activation",
  "pro_active",
] as const;
