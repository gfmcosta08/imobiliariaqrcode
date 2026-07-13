import { clampString } from "@/lib/security/json-body";

export type ImportUrlDetail =
  | "no_url_fields"
  | "url_field_empty"
  | "urls_array_empty"
  | "urls_items_invalid"
  | "all_urls_duplicate";

export type ResolveImportUrlFieldsResult =
  | { ok: true; urls: string[] }
  | { ok: false; error: "missing_url"; detail: ImportUrlDetail };

const URL_MAX_LENGTH = 2048;

function normalizeUrlStrings(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is string => typeof item === "string")
      .map((item) => clampString(item, { maxLength: URL_MAX_LENGTH, trim: true }))
      .filter(Boolean);
  }
  const single = clampString(raw, { maxLength: URL_MAX_LENGTH, trim: true });
  return single ? [single] : [];
}

/**
 * Extrai URLs do body de POST /api/properties/import com códigos detail granulares.
 * Espera body já validado por rejectUnknownKeys (somente url/urls).
 */
export function resolveImportUrlFields(
  body: Record<string, unknown>,
): ResolveImportUrlFieldsResult {
  const hasUrl = body.url !== undefined;
  const hasUrls = body.urls !== undefined;

  if (!hasUrl && !hasUrls) {
    return { ok: false, error: "missing_url", detail: "no_url_fields" };
  }

  const raw = hasUrls ? body.urls : body.url;

  if (hasUrls) {
    if (Array.isArray(raw)) {
      if (raw.length === 0) {
        return { ok: false, error: "missing_url", detail: "urls_array_empty" };
      }
      const urls = normalizeUrlStrings(raw);
      if (urls.length === 0) {
        return { ok: false, error: "missing_url", detail: "urls_items_invalid" };
      }
      return { ok: true, urls };
    }

    const urls = normalizeUrlStrings(raw);
    if (urls.length === 0) {
      return { ok: false, error: "missing_url", detail: "urls_items_invalid" };
    }
    return { ok: true, urls };
  }

  const urls = normalizeUrlStrings(raw);
  if (urls.length === 0) {
    return { ok: false, error: "missing_url", detail: "url_field_empty" };
  }
  return { ok: true, urls };
}
