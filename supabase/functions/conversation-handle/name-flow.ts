export type ResolvedLeadName = {
  name: string | null;
  source: "text" | "uazapi" | "none";
};

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripCommonPrefixes(value: string): string {
  return value.replace(/^(meu nome e|meu nome é|nome[:\s-]*)/i, "").trim();
}

function splitWords(value: string): string[] {
  return value
    .split(" ")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function normalizeFullNameCandidate(raw: string): string | null {
  const base = normalizeSpaces(stripCommonPrefixes(raw));
  if (!base) return null;
  if (/^\d+$/.test(base)) return null;
  if (base.length < 5 || base.length > 120) return null;

  const words = splitWords(base);
  if (words.length < 2) return null;
  if (words.some((w) => w.length < 2)) return null;

  const valid = words.every((w) => /^[a-zA-ZÀ-ÿ'`.-]+$/u.test(w));
  if (!valid) return null;
  return words.join(" ");
}

function getNestedString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function collectPossibleNameCandidates(payload: Record<string, unknown>): string[] {
  const out: string[] = [];
  const add = (value: string | null) => {
    if (value) out.push(value);
  };

  add(getNestedString(payload, ["senderName", "sender_name", "pushName", "contactName", "notifyName", "name"]));

  const message = payload.message;
  if (message && typeof message === "object") {
    const m = message as Record<string, unknown>;
    add(getNestedString(m, ["senderName", "sender_name", "pushName", "contactName", "notifyName", "name"]));

    const content = m.content;
    if (content && typeof content === "object") {
      const c = content as Record<string, unknown>;
      add(getNestedString(c, ["senderName", "sender_name", "pushName", "contactName", "notifyName", "name"]));
    }
  }

  const chat = payload.chat;
  if (chat && typeof chat === "object") {
    const c = chat as Record<string, unknown>;
    add(getNestedString(c, ["pushName", "contactName", "name"]));
  }

  const data = payload.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    add(getNestedString(d, ["senderName", "sender_name", "pushName", "contactName", "notifyName", "name"]));
  }

  return out;
}

export function extractUazapiName(payload: Record<string, unknown> | null | undefined): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates = collectPossibleNameCandidates(payload);
  for (const candidate of candidates) {
    const normalized = normalizeFullNameCandidate(candidate);
    if (normalized) return normalized;
  }
  return null;
}

export function resolveLeadNameFromTextOrFallback(
  text: string,
  payload: Record<string, unknown> | null | undefined,
): ResolvedLeadName {
  const fromText = normalizeFullNameCandidate(text);
  if (fromText) return { name: fromText, source: "text" };

  const fromUazapi = extractUazapiName(payload);
  if (fromUazapi) return { name: fromUazapi, source: "uazapi" };

  return { name: null, source: "none" };
}

export function buildWelcomeBackMessage(name: string): string {
  return `Ola ${name}, bem-vindo(a) novamente!`;
}
