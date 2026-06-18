import { clampString } from "@/lib/security/json-body";
import { normalizeBrazilPhone } from "@/lib/phone";

import { detectChatKind } from "./kind";
import { sanitizeChatContent } from "./sanitize";
import { CHAT_KINDS, type ChatKind, type ChatPostBody } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

export type ValidatePostResult =
  | { ok: true; body: ChatPostBody; kindDetected: ChatKind }
  | { ok: false; error: string };

export function validateChatPostBody(raw: Record<string, unknown>): ValidatePostResult {
  const session_id = clampString(raw.session_id, { maxLength: 36, trim: true });
  if (!session_id || !isValidUuid(session_id)) {
    return { ok: false, error: "invalid_session_id" };
  }

  const content = sanitizeChatContent(raw.content);
  if (!content) {
    return { ok: false, error: "empty_content" };
  }

  const kindRaw = clampString(raw.kind, { maxLength: 32, trim: true });
  const kindDetected = detectChatKind(content, kindRaw || undefined);

  const visitor_name = clampString(raw.visitor_name, { maxLength: 120, trim: true }) || undefined;
  const visitor_email = clampString(raw.visitor_email, { maxLength: 254, trim: true }) || undefined;
  const visitor_phone_raw = clampString(raw.visitor_phone, { maxLength: 32, trim: true }) || undefined;
  const page_url = clampString(raw.page_url, { maxLength: 2048, trim: true }) || undefined;

  if (visitor_email && !isValidEmail(visitor_email)) {
    return { ok: false, error: "invalid_email" };
  }

  let visitor_phone: string | undefined;
  if (visitor_phone_raw) {
    const normalized = normalizeBrazilPhone(visitor_phone_raw);
    if (!normalized) {
      return { ok: false, error: "invalid_phone" };
    }
    visitor_phone = normalized;
  }

  if (kindRaw && !CHAT_KINDS.includes(kindRaw as ChatKind)) {
    return { ok: false, error: "invalid_kind" };
  }

  return {
    ok: true,
    body: {
      session_id,
      content,
      kind: kindDetected,
      visitor_name,
      visitor_email,
      visitor_phone,
      page_url,
    },
    kindDetected,
  };
}

export type ValidateMessagesQueryResult =
  | { ok: true; sessionId: string | null; since: string | null }
  | { ok: false; error: string };

export function validateMessagesQuery(
  params: URLSearchParams,
  options: { requireSessionForAnonymous: boolean },
): ValidateMessagesQueryResult {
  const sessionRaw = params.get("session_id");
  const sessionId = sessionRaw?.trim() ?? null;

  if (sessionId && !isValidUuid(sessionId)) {
    return { ok: false, error: "invalid_session_id" };
  }

  const sinceRaw = params.get("since");
  const since = sinceRaw?.trim() ?? null;
  if (since) {
    const parsed = Date.parse(since);
    if (Number.isNaN(parsed)) {
      return { ok: false, error: "invalid_since" };
    }
  }

  if (options.requireSessionForAnonymous && !sessionId) {
    return { ok: false, error: "session_id_required" };
  }

  return { ok: true, sessionId, since };
}
