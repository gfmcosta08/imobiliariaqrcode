import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitResult = {
  allowed: boolean;
  attemptCount: number;
  lockedUntil: string | null;
};

type RateLimitRow = {
  allowed?: boolean;
  attempt_count?: number;
  locked_until?: string | null;
};

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

export function secureNumericCode(length: number): string {
  if (!Number.isInteger(length) || length < 6 || length > 32) {
    throw new Error("invalid_numeric_code_length");
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => String(byte % 10)).join("");
}

export async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashedRateLimitKey(parts: Array<string | null | undefined>): Promise<string> {
  const normalized = parts.map((part) => part?.trim().toLowerCase() || "-").join("|");
  return sha256Hex(normalized);
}

export async function checkSecurityRateLimit(
  supabase: SupabaseClient,
  input: {
    key: string;
    limit: number;
    windowSeconds: number;
    lockSeconds: number;
  },
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("check_security_rate_limit", {
    p_rate_key: input.key,
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
    p_lock_seconds: input.lockSeconds,
  });
  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? (data[0] as RateLimitRow | undefined) : undefined;
  return {
    allowed: row?.allowed === true,
    attemptCount: Number(row?.attempt_count ?? 0),
    lockedUntil: row?.locked_until ?? null,
  };
}

export async function clearSecurityRateLimit(supabase: SupabaseClient, key: string): Promise<void> {
  await supabase.from("security_rate_limits").delete().eq("rate_key", key);
}
