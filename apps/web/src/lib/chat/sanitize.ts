import { CHAT_CONTENT_MAX_LENGTH } from "./types";

const HTML_TAG_RE = /<[^>]*>/g;

/** Remove tags HTML simples, trim e limita a 1000 caracteres. */
export function sanitizeChatContent(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  const withoutTags = trimmed.replace(HTML_TAG_RE, "");
  return withoutTags.slice(0, CHAT_CONTENT_MAX_LENGTH);
}
