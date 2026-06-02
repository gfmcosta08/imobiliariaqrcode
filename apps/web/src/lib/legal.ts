export const LEGAL_DOCUMENT_VERSIONS = {
  terms: "2026-06-02",
  privacy: "2026-06-02",
  refund_cancellation: "2026-06-02",
} as const;

export const LEGAL_VERSION = "2026-06-02";
export const LEGAL_ROUTES = {
  terms: "/termos",
  privacy: "/privacidade",
  refund_cancellation: "/cancelamento-e-reembolso",
} as const;
export { LEGAL_ENTITY } from "@/lib/legal-entity";
export const SUPPORT_EMAIL = "gpmcosta@gmail.com";

type LegalSource = "signup" | "invitation_onboarding";

type LegalAcceptanceInput = {
  acceptedTerms?: unknown;
  acceptedPrivacy?: unknown;
  legalSource: LegalSource;
};

export function buildLegalAcceptanceRecord(input: LegalAcceptanceInput) {
  if (input.acceptedTerms !== true || input.acceptedPrivacy !== true) {
    return null;
  }

  const acceptedAt = new Date().toISOString();
  return {
    accepted_terms_at: acceptedAt,
    accepted_terms_version: LEGAL_DOCUMENT_VERSIONS.terms,
    accepted_privacy_at: acceptedAt,
    accepted_privacy_version: LEGAL_DOCUMENT_VERSIONS.privacy,
    accepted_legal_source: input.legalSource,
  };
}
