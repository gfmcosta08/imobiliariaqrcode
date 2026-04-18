import { getRequiredEnv } from "./env.ts";

export type UazapiMessagePayload = {
  to: string;
  message: string;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export async function sendUazapiMessage(payload: UazapiMessagePayload) {
  const baseUrl = normalizeBaseUrl(getRequiredEnv("UAZAPI_BASE_URL"));
  const instanceToken = getRequiredEnv("UAZAPI_TOKEN");
  const to = payload.to.replace(/\D/g, "");

  const url = `${baseUrl}/send/text`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      token: instanceToken,
    },
    body: JSON.stringify({ number: to, text: payload.message }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Uazapi send failed: HTTP ${response.status} — ${responseText}`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return { ok: true };
  }
}

export async function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const secret = Deno.env.get("UAZAPI_WEBHOOK_SECRET");

  if (!secret) {
    return true;
  }

  if (!signatureHeader) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return expected === signatureHeader;
}
