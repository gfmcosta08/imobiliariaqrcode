import { NextResponse } from "next/server";

import { assertQrTokenActive } from "@/lib/public/qr-token-active";
import { loadSimilarPropertyCards } from "@/lib/public/similar-properties";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Lista imóveis similares (RPC) para um visitante que possui o token de QR válido.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
  }

  const v = await assertQrTokenActive(token);
  if (!v.ok) {
    return NextResponse.json(
      { ok: false, error: "qr_unavailable", state: v.state },
      { status: 400 },
    );
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return NextResponse.json({ ok: false, error: "server_config" }, { status: 500 });
  }

  try {
    const items = await loadSimilarPropertyCards(supabase, v.property_id, 5);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
