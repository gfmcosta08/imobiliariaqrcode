export const LEGAL_DOCUMENT_TYPES = ["terms", "privacy", "refund_cancellation"] as const;
export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

export const LEGAL_VERSION = "2026-06-02";

export const LEGAL_ROUTES: Record<LegalDocumentType, string> = {
  terms: "/termos",
  privacy: "/privacidade",
  refund_cancellation: "/cancelamento-reembolso",
};

export const SUPPORT_EMAIL = "suporte@imoveisqr.com.br";
