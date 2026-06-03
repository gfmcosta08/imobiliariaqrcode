import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const cwd = process.cwd();
const read = (path: string) => readFileSync(join(cwd, path), "utf8");

describe("Legal acceptance guardrails", () => {
  it("exige aceite no cadastro comum e no onboarding por convite", () => {
    const loginPage = read("src/app/login/page.tsx");
    const onboardingPage = read("src/app/onboarding/complete-profile/page.tsx");

    expect(loginPage).toContain('id="signup-terms"');
    expect(loginPage).toContain("acceptedTerms");
    expect(onboardingPage).toContain('id="onboarding-terms"');
    expect(onboardingPage).toContain("acceptedTerms");
  });

  it("valida e registra o aceite no backend dos dois fluxos", () => {
    const signupRoute = read("src/app/api/auth/signup/route.ts");
    const onboardingRoute = read("src/app/api/onboarding/complete-profile/route.ts");

    expect(signupRoute).toContain("buildLegalAcceptanceRecord");
    expect(onboardingRoute).toContain("buildLegalAcceptanceRecord");
    expect(signupRoute).toContain('legalSource: "signup"');
    expect(onboardingRoute).toContain('legalSource: "invitation_onboarding"');
  });

  it("mantem documentos publicos versionados e migration auditavel", () => {
    const termsPage = read("src/app/termos/page.tsx");
    const privacyPage = read("src/app/privacidade/page.tsx");
    const migration = read(
      "../../supabase/migrations/20260602131511_add_legal_acceptance_to_profiles.sql",
    );

    expect(termsPage).toContain("LEGAL_DOCUMENT_VERSIONS.terms");
    expect(privacyPage).toContain("LEGAL_DOCUMENT_VERSIONS.privacy");
    expect(migration).toContain("accepted_terms_at");
    expect(migration).toContain("accepted_terms_version");
    expect(migration).toContain("accepted_privacy_at");
    expect(migration).toContain("accepted_privacy_version");
    expect(migration).toContain("accepted_legal_source");
  });

  it("mantem um historico imutavel dos aceites legais", () => {
    const migration = read(
      "../../supabase/migrations/20260602150000_immutable_legal_acceptance_history.sql",
    );

    expect(migration).toContain("create table if not exists public.legal_acceptance_events");
    expect(migration).toContain(
      "alter table public.legal_acceptance_events enable row level security",
    );
    expect(migration).toContain("create trigger trg_profiles_log_legal_acceptance");
    expect(migration).toContain("private.log_legal_acceptance_event");
  });
});
