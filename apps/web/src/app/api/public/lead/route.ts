import { NextResponse } from "next/server";

import { normalizeBrazilPhone } from "@/lib/phone";
import { assertQrTokenActive } from "@/lib/public/qr-token-active";
import { clampString, parseJsonObjectWithLimit, rejectUnknownKeys } from "@/lib/security/json-body";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Registra interesse de visita a partir do QR público (sem WhatsApp API).
 * Valida o token via Edge `qr-resolve` e chama RPC `create_lead_from_visit_interest` com service role.
 */
export async function POST(request: Request) {
  // 🔒 SEGURANÇA [VULN-2]: limita bytes + rejeita chaves extras — previne DoS e mass assignment.
  const parsed = await parseJsonObjectWithLimit(request, { maxBytes: 8_192 });
  if (!parsed.ok) return parsed.response;

  const o = parsed.value;
  const unknown = rejectUnknownKeys(o, [
    "qr_token",
    "client_phone",
    "nome",
    "profile_name",
    "observation",
    "intent",
  ]);
  if (unknown) {
    return NextResponse.json({ ok: false, error: "unexpected_field", field: unknown }, { status: 400 });
  }

  const qr_token = clampString(o.qr_token, { maxLength: 128, trim: true });
  const client_phone = clampString(o.client_phone, { maxLength: 32, trim: true });
  const provided_name = clampString(o.nome, { maxLength: 120, trim: true });
  const profile_name = clampString(o.profile_name, { maxLength: 120, trim: true });
  const observation = clampString(o.observation, { maxLength: 500, trim: true });
  const intent = clampString(o.intent, { maxLength: 40, trim: true }) || "visit_interest";

  const phone = normalizeBrazilPhone(client_phone);
  if (!phone) {
    return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
  }
  if (!qr_token) {
    return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
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
  const { data: leadId, error } = await supabase.rpc("upsert_lead_from_qr_event", {
    p_property_id: property_id,
    p_broker_id: broker_id,
    p_client_phone: phone,
    p_nome_informado: provided_name || null,
    p_nome_perfil: profile_name || null,
    p_observacao: observation || null,
    p_origem: "qr_code_anuncio",
    p_interaction_type: "public_qr_interest",
    p_intent: intent,
    p_force_name_update: false,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lead_id: leadId });
}
