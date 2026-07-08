import { parseQrToken } from "../conversation-handle/routing.ts";
import { buildLeadStartText } from "./lead-text.ts";

function assertEquals<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`assertEquals falhou: esperado=${String(expected)} atual=${String(actual)}`);
  }
}

Deno.test("buildLeadStartText inclui public_id e Ref e parseQrToken retorna qr_token", () => {
  const publicId = "IMV-2026-567596";
  const qrToken = "d3ecad275c05413098d27f128707824d20a0b3289ece47a2ae5ebdb3a748890a";

  const text = buildLeadStartText(publicId, qrToken);
  if (!text.includes(publicId)) throw new Error("public_id ausente no texto");
  if (!text.includes(`(Ref: ${qrToken})`)) throw new Error("Ref ausente/alterado no texto");

  assertEquals(parseQrToken(text), qrToken);
});

Deno.test("parseQrToken consegue extrair public_id quando QR vem sem Ref", () => {
  const publicId = "IMV-2026-567596";
  const withoutRefText = `Olá! Tenho interesse no imóvel ${publicId} que vi no ImoveisQR`;

  assertEquals(parseQrToken(withoutRefText), publicId);
});

