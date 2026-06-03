const STAGING_PROJECT_REF = "coeuoyeydqoslhvbbojx";
const STAGING_WEB_HOST = "farollimoveis-staging.vercel.app";

function requireValue(env, name) {
  const value = String(env[name] ?? "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function projectRefFromUrl(value) {
  const url = new URL(value);
  const suffix = ".supabase.co";
  if (url.protocol !== "https:" || !url.hostname.endsWith(suffix)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must target hosted Supabase");
  }
  return url.hostname.slice(0, -suffix.length);
}

function stagingHostFromUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== STAGING_WEB_HOST) {
    throw new Error("STAGING_BASE_URL must target the isolated staging host");
  }
  return url.hostname;
}

export function assertCommercialStagingSafety(env = process.env, options = {}) {
  const operation = options.operation ?? "migration";
  const supabaseProjectRef = projectRefFromUrl(requireValue(env, "NEXT_PUBLIC_SUPABASE_URL"));
  const stagingWebHost = stagingHostFromUrl(requireValue(env, "STAGING_BASE_URL"));

  if (supabaseProjectRef !== STAGING_PROJECT_REF) {
    throw new Error("Supabase project must be the isolated staging project");
  }
  if (operation === "deploy" && options.target !== "preview") {
    throw new Error("production deploy forbidden");
  }

  let stripeMode = null;
  if (operation === "stripe") {
    const stripeSecretKey = requireValue(env, "STRIPE_SECRET_KEY");
    if (!stripeSecretKey.startsWith("sk_test_")) {
      throw new Error("Stripe test key required");
    }
    stripeMode = "test";
  }

  return { operation, stagingWebHost, stripeMode, supabaseProjectRef };
}
