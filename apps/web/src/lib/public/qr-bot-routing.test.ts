import { describe, expect, it } from "vitest";

import { buildLeadStartText } from "../../../../../supabase/functions/qr-resolve/lead-text.ts";
import { isQrEntryMessage, parseQrToken } from "../../../../../supabase/functions/conversation-handle/routing.ts";

describe("bot QR contract - parsing", () => {
  it("parseQrToken extrai qr_token via Ref", () => {
    const qrToken =
      "d3ecad275c05413098d27f128707824d20b3289ece47a2ae5ebdb3a748890a";
    const text = `Olá! Tenho interesse no imóvel IMV-2026-6BDCDC que vi no ImoveisQR (Ref: ${qrToken})`;

    expect(parseQrToken(text)).toBe(qrToken);
  });

  it("parseQrToken extrai public_id quando o texto vem do qr-resolve", () => {
    const publicId = "IMV-2026-567596";
    const text = `Olá! Tenho interesse no imóvel ${publicId} que vi no ImoveisQR`;

    expect(parseQrToken(text)).toBe(publicId);
  });

  it("isQrEntryMessage reconhece a mensagem automática do QR", () => {
    const text = "Olá! Tenho interesse no imóvel IMV-2026-567596 que vi no ImoveisQR";
    expect(isQrEntryMessage(text)).toBe(true);
  });
});

describe("qr-resolve contract - leadStartText", () => {
  it("buildLeadStartText inclui public_id e Ref", () => {
    const publicId = "IMV-2026-567596";
    const qrToken =
      "d3ecad275c05413098d27f128707824d20b3289ece47a2ae5ebdb3a748890a";

    const text = buildLeadStartText(publicId, qrToken);
    expect(text).toContain(publicId);
    expect(text).toContain(`Ref: ${qrToken}`);
  });
});

