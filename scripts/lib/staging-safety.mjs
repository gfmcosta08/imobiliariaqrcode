const DEFAULT_STAGING_WEB_HOSTS = ["farollimoveis-staging.vercel.app"];

function requireValue(env, name) {
  const value = String(env[name] ?? "").trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function normalizePhone(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function parseCsv(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function extractSupabaseProjectRef(supabaseUrl) {
  let url;
  try {
    url = new URL(supabaseUrl);
  } catch {
    throw new Error("SUPABASE_URL must be a valid URL");
  }

  const suffix = ".supabase.co";
  if (url.protocol !== "https:" || !url.hostname.endsWith(suffix)) {
    throw new Error("SUPABASE_URL must target a hosted Supabase project");
  }

  const projectRef = url.hostname.slice(0, -suffix.length);
  if (!projectRef || projectRef.includes(".")) {
    throw new Error("SUPABASE_URL must contain a single Supabase project ref");
  }
  return projectRef;
}

function assertAllowedStagingWebUrl(env) {
  const stagingBaseUrl = requireValue(env, "STAGING_BASE_URL");
  const configuredHosts = parseCsv(env.STAGING_ALLOWED_WEB_HOSTS);
  const allowedHosts = configuredHosts.length > 0 ? configuredHosts : DEFAULT_STAGING_WEB_HOSTS;

  let url;
  try {
    url = new URL(stagingBaseUrl);
  } catch {
    throw new Error("STAGING_BASE_URL must be a valid URL");
  }

  if (url.protocol !== "https:" || !allowedHosts.includes(url.hostname)) {
    throw new Error("STAGING_BASE_URL must target an allowed staging host");
  }
  return url.hostname;
}

export function assertStagingBotSafety(env = process.env) {
  const runtimeEnvironment = requireValue(env, "BOT_RUNTIME_ENVIRONMENT");
  if (runtimeEnvironment !== "staging") {
    throw new Error("BOT_RUNTIME_ENVIRONMENT must be staging");
  }

  if (String(env.CONFIRM_STAGING_PROVIDER_SEND ?? "") !== "1") {
    throw new Error("CONFIRM_STAGING_PROVIDER_SEND must be 1");
  }

  const expectedProjectRef = requireValue(env, "STAGING_SUPABASE_PROJECT_REF");
  const actualProjectRef = extractSupabaseProjectRef(requireValue(env, "SUPABASE_URL"));
  if (actualProjectRef !== expectedProjectRef) {
    throw new Error("SUPABASE_URL does not match STAGING_SUPABASE_PROJECT_REF");
  }

  const testLeadPhone = normalizePhone(requireValue(env, "TEST_LEAD_PHONE"));
  const allowedPhones = new Set(
    parseCsv(requireValue(env, "BOT_STAGING_ALLOWED_PHONES")).map(normalizePhone),
  );
  if (!allowedPhones.has(testLeadPhone)) {
    throw new Error("TEST_LEAD_PHONE is not present in BOT_STAGING_ALLOWED_PHONES");
  }

  return {
    runtimeEnvironment,
    stagingWebHost: assertAllowedStagingWebUrl(env),
    supabaseProjectRef: actualProjectRef,
    testLeadPhone,
  };
}
