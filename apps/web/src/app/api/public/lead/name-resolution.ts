export type ResolvedPublicLeadName = {
  name: string | null;
  source: "client_name" | "uazapi_name" | "none";
  requiresPrompt: boolean;
};

const REFUSAL_PATTERNS = [
  /^(nao|não|prefiro nao|prefiro não|sem nome|nao quero informar|não quero informar)$/i,
];

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeName(value: string): string | null {
  const base = normalizeSpaces(value);
  if (!base) return null;
  if (looksLikeRefusal(base)) return null;
  if (base.length < 5 || base.length > 120) return null;
  if (/^\d+$/.test(base)) return null;

  const words = base.split(" ").filter(Boolean);
  if (words.length < 2 || words.some((w) => w.length < 2)) return null;
  if (!words.every((w) => /^[a-zA-ZÀ-ÿ'`.-]+$/u.test(w))) return null;
  return words.join(" ");
}

function looksLikeRefusal(value: string): boolean {
  const text = normalizeSpaces(value);
  if (!text) return true;
  return REFUSAL_PATTERNS.some((r) => r.test(text));
}

export function resolvePublicLeadName(input: {
  clientNameRaw: string;
  uazapiNameRaw: string;
}): ResolvedPublicLeadName {
  const fromClient = sanitizeName(input.clientNameRaw);
  if (fromClient) {
    return { name: fromClient, source: "client_name", requiresPrompt: false };
  }

  const fromUazapi = sanitizeName(input.uazapiNameRaw);
  if (fromUazapi && looksLikeRefusal(input.clientNameRaw)) {
    return { name: fromUazapi, source: "uazapi_name", requiresPrompt: false };
  }

  return { name: null, source: "none", requiresPrompt: true };
}
