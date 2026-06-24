import { describe, expect, it } from "vitest";

import { matchChoice4 } from "../../../../supabase/functions/conversation-handle/messages";
import {
  classifyConversationIntent,
  getEffectiveSessionState,
  isQrEntryMessage,
  isSessionExpired,
  parseQrToken,
  shouldForceQrEntryForCrossProperty,
} from "../../../../supabase/functions/conversation-handle/routing";

const ACTIVE_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const INCIDENT_MESSAGE = "Olá! Tenho interesse no imóvel IMV-2026-6BDCDC que vi no QRImoveis";

const matchers = {
  matchChoice1: (text: string) => /^(1|s|sim|yes|y|quero)$/.test(text.toLowerCase().trim()),
  matchChoice2: (text: string) => /^2(\b|[\s.)-])/.test(text.toLowerCase().trim()),
  matchChoice3: (text: string) => /^3$/.test(text.toLowerCase().trim()),
  matchChoice4,
  matchNo: (text: string) => /^(nao|não|n|no|0)$/.test(text.toLowerCase().trim()),
};

describe("WhatsApp flow routing", () => {
  it("extrai o public_id da mensagem real do incidente", () => {
    expect(parseQrToken(INCIDENT_MESSAGE)).toBe("IMV-2026-6BDCDC");
  });

  it("reconhece o template de entrada por QR", () => {
    expect(isQrEntryMessage(INCIDENT_MESSAGE)).toBe(true);
    expect(isQrEntryMessage("IMV-2026-6BDCDC")).toBe(false);
  });

  it("trata sessao expirada como sem estado para classificacao", () => {
    const staleUpdatedAt = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString();
    const sessionExpired = isSessionExpired(staleUpdatedAt, Date.now(), ACTIVE_SESSION_TIMEOUT_MS);

    expect(sessionExpired).toBe(true);
    expect(getEffectiveSessionState("awaiting_post_similar_choice", sessionExpired)).toBeNull();
    expect(
      classifyConversationIntent(
        getEffectiveSessionState("awaiting_post_similar_choice", sessionExpired),
        INCIDENT_MESSAGE,
        parseQrToken(INCIDENT_MESSAGE),
        matchers,
      ),
    ).toBe("qr_entry");
  });

  it("mantem ID pos-semelhantes em sessao ativa", () => {
    const recentUpdatedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const sessionExpired = isSessionExpired(recentUpdatedAt, Date.now(), ACTIVE_SESSION_TIMEOUT_MS);

    expect(sessionExpired).toBe(false);
    expect(
      classifyConversationIntent(
        getEffectiveSessionState("awaiting_post_similar_choice", sessionExpired),
        "IMV-2026-AAAA11",
        parseQrToken("IMV-2026-AAAA11"),
        matchers,
      ),
    ).toBe("post_similar_property_id");
  });

  it("forca novo QR quando o template aponta para outro imovel", () => {
    expect(
      shouldForceQrEntryForCrossProperty({
        parsedQrToken: "IMV-2026-6BDCDC",
        text: INCIDENT_MESSAGE,
        sessionOriginPropertyId: "61ded2f4-594a-4626-a5cb-e2f9850f94d0",
        incomingPropertyId: "another-property-id",
        sessionExpired: false,
      }),
    ).toBe(true);
  });

  it("nao forca novo QR para o mesmo imovel da sessao", () => {
    const propertyId = "61ded2f4-594a-4626-a5cb-e2f9850f94d0";
    expect(
      shouldForceQrEntryForCrossProperty({
        parsedQrToken: "IMV-2026-DE8E29",
        text: "Olá! Tenho interesse no imóvel IMV-2026-DE8E29 que vi no ImoveisQR",
        sessionOriginPropertyId: propertyId,
        incomingPropertyId: propertyId,
        sessionExpired: false,
      }),
    ).toBe(false);
  });
});
