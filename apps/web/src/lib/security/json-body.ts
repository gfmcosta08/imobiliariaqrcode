import { NextResponse } from "next/server";

export type JsonParseOk<T> = { ok: true; value: T };
export type JsonParseFail = { ok: false; response: NextResponse };
export type JsonParseResult<T> = JsonParseOk<T> | JsonParseFail;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * 🔒 SEGURANÇA: JSON com limite de tamanho (DoS) + validação de shape.
 * - Evita `await req.json()` em endpoints públicos sem limites.
 * - Falha-seguro com 413/400.
 */
export async function parseJsonObjectWithLimit(
  request: Request,
  options: { maxBytes: number },
): Promise<JsonParseResult<Record<string, unknown>>> {
  let buf: ArrayBuffer;
  try {
    buf = await request.arrayBuffer();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 }),
    };
  }

  if (buf.byteLength > options.maxBytes) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 }),
    };
  }

  let parsed: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    parsed = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }),
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "invalid_json_object" }, { status: 400 }),
    };
  }

  return { ok: true, value: parsed };
}

/**
 * 🔒 SEGURANÇA: rejeita chaves não permitidas (mass assignment).
 */
export function rejectUnknownKeys(
  obj: Record<string, unknown>,
  allowedKeys: readonly string[],
): string | null {
  const allowed = new Set(allowedKeys);
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) return k;
  }
  return null;
}

/**
 * 🔒 SEGURANÇA: enforce `maxLength` em strings.
 */
export function clampString(
  value: unknown,
  options: { maxLength: number; trim?: boolean },
): string {
  if (typeof value !== "string") return "";
  const s = options.trim ? value.trim() : value;
  if (s.length > options.maxLength) return "";
  return s;
}

