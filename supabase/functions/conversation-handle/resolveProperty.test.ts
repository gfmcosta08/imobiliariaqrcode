import { resolvePropertyByQrOrPublicId } from "./resolveProperty.ts";

Deno.test("resolvePropertyByQrOrPublicId - retorna por qr_token quando disponivel", async () => {
  const calls = { qr: 0, publicId: 0 };

  const result = await resolvePropertyByQrOrPublicId(
    "qr_token_x",
    async () => {
      calls.qr += 1;
      return { id: "P1" };
    },
    async () => {
      calls.publicId += 1;
      return { id: "P2" };
    },
  );

  if (result?.id !== "P1") {
    throw new Error(`esperado P1, obtido ${String(result?.id)}`);
  }
  if (calls.qr !== 1 || calls.publicId !== 0) {
    throw new Error(`chamadas inesperadas: ${JSON.stringify(calls)}`);
  }
});

Deno.test("resolvePropertyByQrOrPublicId - faz fallback por public_id quando qr_token falha", async () => {
  const calls = { qr: 0, publicId: 0 };

  const result = await resolvePropertyByQrOrPublicId(
    "IMV-2026-567596",
    async () => {
      calls.qr += 1;
      return null;
    },
    async () => {
      calls.publicId += 1;
      return { id: "P_PUBLIC" };
    },
  );

  if (result?.id !== "P_PUBLIC") {
    throw new Error(`esperado P_PUBLIC, obtido ${String(result?.id)}`);
  }
  if (calls.qr !== 1 || calls.publicId !== 1) {
    throw new Error(`chamadas inesperadas: ${JSON.stringify(calls)}`);
  }
});

