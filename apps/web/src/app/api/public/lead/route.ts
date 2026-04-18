import { NextResponse } from "next/server";

import { normalizeBrazilPhone } from "@/lib/phone";
import { assertQrTokenActive } from "@/lib/public/qr-token-active";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolvePublicLeadName } from "./name-resolution";

/**
 * Registra interesse de visita a partir do QR público (sem WhatsApp API).
 * Valida o token via Edge `qr-resolve` e chama RPC `create_lead_from_visit_interest` com service role.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const qr_token = typeof o.qr_token === "string" ? o.qr_token.trim() : "";
  const client_phone = typeof o.client_phone === "string" ? o.client_phone : "";
  const client_name = typeof o.client_name === "string" ? o.client_name : "";
  const uazapi_name = typeof o.uazapi_name === "string" ? o.uazapi_name : "";
  const intent =
    typeof o.intent === "string" && o.intent.trim() ? o.intent.trim() : "visit_interest";

  const phone = normalizeBrazilPhone(client_phone);
  if (!phone) {
    return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
  }
  if (!qr_token) {
    return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
  }

  const resolvedName = resolvePublicLeadName({
    clientNameRaw: client_name,
    uazapiNameRaw: uazapi_name,
  });
  if (resolvedName.requiresPrompt || !resolvedName.name) {
    return NextResponse.json(
      {
        ok: false,
        error: "name_required",
        prompt: "Informe o nome completo do lead para continuar.",
      },
      { status: 400 },
    );
  }

  const v = await assertQrTokenActive(qr_token);
  if (!v.ok) {
    return NextResponse.json(
      { ok: false, error: "qr_unavailable", state: v.state },
      { status: 400 },
    );
  }

  const { property_id, broker_id } = v;

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return NextResponse.json({ ok: false, error: "server_config" }, { status: 500 });
  }
  const { data: leadId, error } = await supabase.rpc("create_lead_from_visit_interest", {
    p_property_id: property_id,
    p_broker_id: broker_id,
    p_client_phone: phone,
    p_intent: intent,
    p_client_name: resolvedName.name,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lead_id: leadId });
}
