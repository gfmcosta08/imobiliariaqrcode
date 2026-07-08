export function parseQrToken(text: string): string | null {
  const t = text.trim();
  if (!t) return null;

  // Formato mais comum do QR: "(Ref: <qr_token>)"
  const mRef = t.match(/Ref:\s*([a-z0-9_-]{16,100})/i);
  if (mRef?.[1]) return mRef[1];

  // Alguns fluxos podem enviar: "imovel <qr_token>"
  const mImovel = t.match(/(?:imovel|imóvel)\s+([a-z0-9_-]{16,100})/i);
  if (mImovel?.[1]) return mImovel[1];

  // public_id exibido ao usuário: "IMV-2026-567596"
  const mPublicId = t.match(/\b([A-Z]{2,5}-\d{4}-[A-Z0-9]{4,})\b/i);
  if (mPublicId?.[1]) return mPublicId[1];

  // Fallback genérico para tokens longos.
  const uuidLike = t.match(/[a-z0-9][a-z0-9_-]{15,99}/i);
  return uuidLike?.[0] ?? null;
}

export function isSessionExpired(
  updatedAt: string | null | undefined,
  nowMs: number,
  timeoutMs: number,
): boolean {
  if (!updatedAt) return true;
  const lastUpdate = new Date(String(updatedAt)).getTime();
  if (!Number.isFinite(lastUpdate)) return true;
  return nowMs - lastUpdate > timeoutMs;
}

export function isQrEntryMessage(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

  return /\btenho interesse\b/.test(normalized) && /\bvi no\b/.test(normalized);
}

export function getEffectiveSessionState(
  sessionState: string | null | undefined,
  sessionExpired: boolean,
): string | null {
  if (!sessionState || sessionExpired) return null;
  return sessionState;
}

export type ConversationIntent =
  | "qr_entry"
  | "property_code_lookup"
  | "main_menu_choice"
  | "post_similar_menu_choice"
  | "post_similar_property_id"
  | "visit_property_id"
  | "conversation_message";

type IntentMatchers = {
  matchChoice1: (text: string) => boolean;
  matchChoice2: (text: string) => boolean;
  matchChoice3: (text: string) => boolean;
  matchChoice4: (text: string) => boolean;
  matchNo: (text: string) => boolean;
};

export function classifyConversationIntent(
  sessionState: string | null | undefined,
  text: string,
  parsedQrToken: string | null,
  matchers: IntentMatchers,
): ConversationIntent {
  if (sessionState === "awaiting_visit_property_id") return "visit_property_id";

  if (sessionState === "awaiting_post_similar_choice") {
    if (
      matchers.matchChoice1(text) ||
      matchers.matchChoice2(text) ||
      matchers.matchChoice3(text) ||
      matchers.matchChoice4(text) ||
      matchers.matchNo(text)
    ) {
      return "post_similar_menu_choice";
    }
    return parsedQrToken ? "post_similar_property_id" : "post_similar_menu_choice";
  }

  if (sessionState === "awaiting_main_choice") {
    if (
      matchers.matchChoice1(text) ||
      matchers.matchChoice2(text) ||
      matchers.matchChoice3(text) ||
      matchers.matchChoice4(text)
    ) {
      return "main_menu_choice";
    }
    return parsedQrToken ? "property_code_lookup" : "conversation_message";
  }

  if (parsedQrToken) return sessionState ? "property_code_lookup" : "qr_entry";
  return "conversation_message";
}

export function shouldForceQrEntryForCrossProperty(input: {
  parsedQrToken: string | null;
  text: string;
  sessionOriginPropertyId: string | null | undefined;
  incomingPropertyId: string | null | undefined;
  sessionExpired: boolean;
}): boolean {
  if (!input.parsedQrToken || input.sessionExpired) return false;
  if (!input.sessionOriginPropertyId || !input.incomingPropertyId) return false;
  if (!isQrEntryMessage(input.text)) return false;
  return String(input.incomingPropertyId) !== String(input.sessionOriginPropertyId);
}
