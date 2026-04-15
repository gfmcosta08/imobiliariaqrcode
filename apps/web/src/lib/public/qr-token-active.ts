export type QrActiveOk = { ok: true; property_id: string; broker_id: string };
export type QrActiveFail = { ok: false; state: string };
export type QrActiveResult = QrActiveOk | QrActiveFail;

/**
 * Valida token de QR via Edge `qr-resolve` (mesma regra que a página pública).
 */
export async function assertQrTokenActive(qr_token: string): Promise<QrActiveResult> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) {
    return { ok: false, state: "config" };
  }
  const res = await fetch(`${base}/functions/v1/qr-resolve?token=${encodeURIComponent(qr_token)}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const resolved = (await res.json()) as Record<string, unknown>;
  if (resolved.ok !== true || resolved.state !== "active") {
    return { ok: false, state: typeof resolved.state === "string" ? resolved.state : "unknown" };
  }
  const property_id = resolved.property_id;
  const broker_id = resolved.broker_id;
  if (typeof property_id !== "string" || typeof broker_id !== "string") {
    return { ok: false, state: "resolve_incomplete" };
  }
  return { ok: true, property_id, broker_id };
}
