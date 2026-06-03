import assert from "node:assert/strict";
import test from "node:test";

import { assertStagingBotSafety } from "./staging-safety.mjs";

function validEnv(overrides = {}) {
  return {
    BOT_RUNTIME_ENVIRONMENT: "staging",
    BOT_STAGING_ALLOWED_PHONES: "5511999990001, 5511988880002",
    CONFIRM_STAGING_PROVIDER_SEND: "1",
    STAGING_BASE_URL: "https://farollimoveis-staging.vercel.app",
    STAGING_SUPABASE_PROJECT_REF: "stagingref123",
    SUPABASE_URL: "https://stagingref123.supabase.co",
    TEST_LEAD_PHONE: "5511999990001",
    ...overrides,
  };
}

test("accepts an explicitly confirmed staging bot run", () => {
  const result = assertStagingBotSafety(validEnv());

  assert.equal(result.runtimeEnvironment, "staging");
  assert.equal(result.supabaseProjectRef, "stagingref123");
  assert.equal(result.testLeadPhone, "5511999990001");
});

test("rejects a bot smoke run outside staging", () => {
  assert.throws(
    () => assertStagingBotSafety(validEnv({ BOT_RUNTIME_ENVIRONMENT: "production" })),
    /BOT_RUNTIME_ENVIRONMENT must be staging/,
  );
});

test("rejects a run without explicit provider-send confirmation", () => {
  assert.throws(
    () => assertStagingBotSafety(validEnv({ CONFIRM_STAGING_PROVIDER_SEND: "0" })),
    /CONFIRM_STAGING_PROVIDER_SEND must be 1/,
  );
});

test("rejects a production-like web URL", () => {
  assert.throws(
    () => assertStagingBotSafety(validEnv({ STAGING_BASE_URL: "https://app-production.example" })),
    /STAGING_BASE_URL must target an allowed staging host/,
  );
});

test("rejects a Supabase project that differs from the staging project ref", () => {
  assert.throws(
    () =>
      assertStagingBotSafety(
        validEnv({
          SUPABASE_URL: "https://productionref.supabase.co",
        }),
      ),
    /SUPABASE_URL does not match STAGING_SUPABASE_PROJECT_REF/,
  );
});

test("rejects a test phone outside the staging allowlist", () => {
  assert.throws(
    () => assertStagingBotSafety(validEnv({ TEST_LEAD_PHONE: "5511977770003" })),
    /TEST_LEAD_PHONE is not present in BOT_STAGING_ALLOWED_PHONES/,
  );
});
