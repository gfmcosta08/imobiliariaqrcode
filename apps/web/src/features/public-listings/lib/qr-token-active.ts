export type QrActiveOk = { ok: true; property_id: string; broker_id: string };
export type QrActiveFail = { ok: false; state: string };
export type QrActiveResult = QrActiveOk | QrActiveFail;

/**
 * Valida token de QR via Edge `qr-resolve` (mesma regra que a pagina publica).
 */
export async function assertQrTokenActive(qr_token: string): Promise<QrActiveResult> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) {
    return { ok: false, state: "config" };
  }

  try {
    const res = await fetch(
      `${base}/functions/v1/qr-resolve?token=${encodeURIComponent(qr_token)}&track=0`,
      {
        cache: "no-store",
        headers: { Accept: "application/json", "x-skip-access-log": "1" },
      },
    );

    const bodyText = await res.text();
    let resolved: Record<string, unknown> | null = null;
    try {
      resolved = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : null;
    } catch {
      resolved = null;
    }

    if (!res.ok || !resolved) {
      console.error("assertQrTokenActive invalid resolver response", {
        status: res.status,
        tokenPrefix: qr_token.slice(0, 8),
        bodyPreview: bodyText.slice(0, 180),
      });
      return { ok: false, state: "resolve_error" };
    }

    if (resolved.ok !== true) {
      return { ok: false, state: typeof resolved.state === "string" ? resolved.state : "unknown" };
    }

    if (resolved.state === "active") {
      const property_id = resolved.property_id;
      const broker_id = resolved.broker_id;
      if (typeof property_id !== "string" || typeof broker_id !== "string") {
        return { ok: false, state: "resolve_incomplete" };
      }
      return { ok: true, property_id, broker_id };
    }

    // Compat: contrato legado da edge function (`{ ok, property, broker }`).
    const propertyRaw =
      resolved.property && typeof resolved.property === "object"
        ? (resolved.property as Record<string, unknown>)
        : null;
    const property_id = propertyRaw?.id;
    const broker_id = propertyRaw?.broker_id;
    if (typeof property_id === "string" && typeof broker_id === "string") {
      return { ok: true, property_id, broker_id };
    }

    return { ok: false, state: typeof resolved.state === "string" ? resolved.state : "unknown" };
  } catch (e) {
    console.error("assertQrTokenActive fetch failed", {
      tokenPrefix: qr_token.slice(0, 8),
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, state: "network_error" };
  }
}
