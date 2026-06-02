import assert from "node:assert/strict";
import test from "node:test";

import { assertCommercialStagingSafety } from "./staging-commercial-safety.mjs";

function validEnv(overrides = {}) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: "https://coeuoyeydqoslhvbbojx.supabase.co",
    STAGING_BASE_URL: "https://farollimoveis-staging.vercel.app",
    STRIPE_SECRET_KEY: "sk_test_fake",
    ...overrides,
  };
}

test("accepts staging migration against the isolated Supabase project", () => {
  const result = assertCommercialStagingSafety(validEnv(), { operation: "migration" });

  assert.equal(result.supabaseProjectRef, "coeuoyeydqoslhvbbojx");
  assert.equal(result.stagingWebHost, "farollimoveis-staging.vercel.app");
});

test("rejects the production Supabase project", () => {
  assert.throws(
    () =>
      assertCommercialStagingSafety(
        validEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://egeteyzfpkbtkwraizwz.supabase.co" }),
        { operation: "migration" },
      ),
    /Supabase project must be the isolated staging project/,
  );
});

test("rejects a non-preview deploy", () => {
  assert.throws(
    () => assertCommercialStagingSafety(validEnv(), { operation: "deploy", target: "production" }),
    /production deploy forbidden/,
  );
});

test("rejects Stripe live keys", () => {
  assert.throws(
    () =>
      assertCommercialStagingSafety(validEnv({ STRIPE_SECRET_KEY: "sk_live_fake" }), {
        operation: "stripe",
      }),
    /Stripe test key required/,
  );
});

test("accepts Stripe test keys", () => {
  const result = assertCommercialStagingSafety(validEnv(), { operation: "stripe" });

  assert.equal(result.stripeMode, "test");
});
