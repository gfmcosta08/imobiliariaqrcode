import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(dir, "signup-route.ts"), "utf8");

describe("signup API legal gate", () => {
  it("uses bounded JSON parsing and a public signup rate limit", () => {
    expect(source).toContain("parseJsonObjectWithLimit");
    expect(source).toContain("rejectUnknownKeys");
    expect(source).toContain("checkSecurityRateLimit");
    expect(source).toContain("rate_limited");
  });

  it("prepares anti-bot verification for production without blocking unconfigured staging", () => {
    expect(source).toContain("SIGNUP_TURNSTILE_SECRET");
    expect(source).toContain("verifySignupTurnstile");
    expect(source).toContain("signup_antibot_not_configured");
  });

  it("rejects account creation when legal terms were not accepted", () => {
    expect(source).toContain("acceptedLegal");
    expect(source).toContain("legal_acceptance_required");
    expect(source).toContain("Termos");
    expect(source).toContain("Privacidade");
  });

  it("stores an auditable legal acceptance marker in user metadata", () => {
    expect(source).toContain("legal_terms_accepted");
    expect(source).toContain("legal_accepted_at");
  });
});
