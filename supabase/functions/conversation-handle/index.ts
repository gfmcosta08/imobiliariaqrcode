import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

type InboundInput = {
  lead_phone?: string;
  text?: string;
  event_id?: string;
  payload?: Record<string, unknown>;
};

const YES = /^(sim|s|yes|y|1|2|quero)$/i;
const NO = /^(nao|não|n|no|0)$/i;

function normalizePhone(v: string): string {
  return v.replace(/\D/g, "");
}

function parseQrToken(text: string): string | null {
  const t = text.trim();
  // Padrão 1: imovel [token]
  const m = t.match(/(?:imovel|im[oó]vel)\s+([a-z0-9_-]{16,80})/i);
  if (m?.[1]) return m[1];
  // Padrão 2: (Ref: [token]) ou Ref: [token]
  const mRef = t.match(/Ref:\s*([a-z0-9]{32,80})/i);
  if (mRef?.[1]) return mRef[1];
  // Padrão 3: apenas o token (hash de 32 a 80 chars)
  const uuidLike = t.match(/[a-z0-9]{32,80}/i);
  return uuidLike?.[0] ?? null;
}

function summarizeProperty(row: Record<string, unknown>): string {
  const title = String(row.title ?? row.public_id ?? "Imóvel");
  const city = String(row.city ?? "");
  const state = String(row.state ?? "");
  const purpose = String(row.purpose ?? "");
  const price = row.price == null ? "" : Number(row.price).toLocaleString("pt-BR");
  return [
    `🏠 *${title}*`,
    city || state ? `📍 Local: ${[city, state].filter(Boolean).join(" / ")}` : null,
    purpose ? `📋 Finalidade: ${purpose === "sale" ? "Venda" : "Aluguel"}` : null,
    price ? `💰 Valor: R$ ${price}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function queueOutbound(
  supabase: ReturnType<typeof createClient>,
  input: {
    account_id: string;
    property_id: string | null;
    lead_phone: string;
    broker_phone: string | null;
    message_type: "text" | "image" | "menu" | "system";
    payload: Record<string, unknown>;
  },
) {
  await supabase.from("whatsapp_messages").insert({
    direction: "outbound",
    provider: "uazapi",
    account_id: input.account_id,
    property_id: input.property_id,
    lead_phone: input.lead_phone,
    broker_phone: input.broker_phone,
    message_type: input.message_type,
    status: "queued",
    payload: input.payload,
  });
}

async function loadPropertyByQr(
  supabase: ReturnType<typeof createClient>,
  qrToken: string,
) {
  const { data, error } = await supabase
    .from("property_qrcodes")
    .select(
      "qr_token, is_active, properties(id, public_id, broker_id, account_id, title, city, state, purpose, price, origin_plan_code, listing_status)",
    )
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data?.properties) return null;
  const p = Array.isArray(data.properties) ? data.properties[0] : data.properties;
  if (!p || p.listing_status === "removed" || p.listing_status === "blocked" || p.listing_status === "expired") {
    return null;
  }
  return p as Record<string, unknown>;
}

async function sendPropertyPack(
  supabase: ReturnType<typeof createClient>,
  property: Record<string, unknown>,
  leadPhone: string,
) {
  const propertyId = String(property.id);
  const accountId = String(property.account_id);
  const brokerId = String(property.broker_id);
  const { data: broker } = await supabase
    .from("brokers")
    .select("whatsapp_number")
    .eq("id", brokerId)
    .maybeSingle();

  const brokerPhone = broker?.whatsapp_number ? String(broker.whatsapp_number) : null;

  await queueOutbound(supabase, {
    account_id: accountId,
    property_id: propertyId,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: {
      kind: "property_summary",
      text: `Opa! Tudo bem? Vi que você se interessou pelo imóvel no QR Code. Seguem as informações dele:\n\n${summarizeProperty(property)}\n\nE aí, bora agendar uma visita? Responda com *SIM* ou *NÃO* pra gente conversar!`,
      public_id: property.public_id,
    },
  });

  const { data: mediaRows } = await supabase
    .from("property_media")
    .select("storage_path")
    .eq("property_id", propertyId)
    .neq("status", "deleted")
    .order("created_at", { ascending: true })
    .limit(8);

  for (const m of mediaRows ?? []) {
    const { data: signed } = await supabase.storage
      .from("property-media")
      .createSignedUrl(String(m.storage_path), 60 * 60);
    if (!signed?.signedUrl) continue;

    await queueOutbound(supabase, {
      account_id: accountId,
      property_id: propertyId,
      lead_phone: leadPhone,
      broker_phone: brokerPhone,
      message_type: "image",
      payload: {
        kind: "property_image",
        image_url: signed.signedUrl,
        caption: `Fotos do imóvel ${String(property.public_id ?? "")}`,
      },
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as InboundInput;
    const leadPhone = normalizePhone(String(body.lead_phone ?? ""));
    const text = String(body.text ?? "").trim();
    if (!leadPhone || !text) {
      return json({ ok: false, error: "missing_input" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: session } = await supabase
      .from("conversation_sessions")
      .select("id, state, origin_property_id, current_property_id")
      .eq("lead_phone", leadPhone)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const qrToken = parseQrToken(text);
    if (qrToken) {
      const property = await loadPropertyByQr(supabase, qrToken);
      if (!property) {
        return json({ ok: false, error: "invalid_or_unavailable_qr" }, 400);
      }

      const propertyId = String(property.id);
      if (session?.id) {
        await supabase
          .from("conversation_sessions")
          .update({
            origin_property_id: propertyId,
            current_property_id: propertyId,
            state: "awaiting_main_choice",
            last_menu: "visit_question",
          })
          .eq("id", session.id);
      } else {
        await supabase.from("conversation_sessions").insert({
          lead_phone: leadPhone,
          origin_property_id: propertyId,
          current_property_id: propertyId,
          state: "awaiting_main_choice",
          last_menu: "visit_question",
        });
      }

      await sendPropertyPack(supabase, property, leadPhone);
      return json({ ok: true, state: "started", property_id: propertyId });
    }

    if (!session?.id || !session.origin_property_id) {
      return json({ ok: true, state: "ignored_without_session" });
    }

    const { data: property } = await supabase
      .from("properties")
      .select("id, public_id, broker_id, account_id")
      .eq("id", session.origin_property_id)
      .maybeSingle();
    if (!property) {
      return json({ ok: false, error: "property_not_found" }, 400);
    }

    const { data: broker } = await supabase
      .from("brokers")
      .select("whatsapp_number")
      .eq("id", property.broker_id)
      .maybeSingle();
    const brokerPhone = broker?.whatsapp_number ? String(broker.whatsapp_number) : null;

    if (session.state === "awaiting_main_choice") {
      if (YES.test(text)) {
        const { data: leadId } = await supabase.rpc("create_lead_from_visit_interest", {
          p_property_id: property.id,
          p_broker_id: property.broker_id,
          p_client_phone: leadPhone,
          p_intent: "visit_interest",
        });

        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "visit_registered",
            text: "Fechado! Já anotei aqui seu interesse. O corretor vai te dar um alô em breve pra combinarmos tudo! 😉",
            lead_id: leadId ?? null,
          },
        });

        if (brokerPhone) {
          await queueOutbound(supabase, {
            account_id: property.account_id,
            property_id: property.id,
            lead_phone: leadPhone,
            broker_phone: brokerPhone,
            message_type: "text",
            payload: {
              kind: "broker_notification",
              to_broker: true,
              text: `🚨 *Novo Lead!* 🚨\n\nUm cliente quer visitar o imóvel *${property.public_id}*.\n\n📱 Contato: ${leadPhone}\n\nEntra em contato com ele assim que puder!`,
            },
          });
        }

        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "similar_question",
            text: "Enquanto isso, quer dar uma olhadinha em outros imóveis parecidos com esse? (Responda SIM ou NÃO)",
          },
        });

        await supabase
          .from("conversation_sessions")
          .update({ state: "awaiting_recommendation_choice", last_menu: "similar_question" })
          .eq("id", session.id);

        return json({ ok: true, state: "visit_registered" });
      }

      if (NO.test(text)) {
        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "similar_question",
            text: "Sem problemas! Quer que eu te mostre outros imóveis que talvez você curta? (Responda SIM ou NÃO)",
          },
        });
        await supabase
          .from("conversation_sessions")
          .update({ state: "awaiting_recommendation_choice", last_menu: "similar_question" })
          .eq("id", session.id);
        return json({ ok: true, state: "asked_similar" });
      }
    }

    if (session.state === "awaiting_recommendation_choice") {
      if (YES.test(text)) {
        const { data: ranked } = await supabase.rpc("recommend_similar_properties", {
          origin_property_id: property.id,
          limit_count: 5,
        });

        const ids = (ranked ?? []).map((r: { id: string }) => r.id);
        if (!ids.length) {
          await queueOutbound(supabase, {
            account_id: property.account_id,
            property_id: property.id,
            lead_phone: leadPhone,
            broker_phone: brokerPhone,
            message_type: "text",
            payload: {
              kind: "similar_empty",
              text: "Poxa, no momento não encontrei outros imóveis parecidos com esse aqui na região. Mas fica de olho que sempre tem novidade!",
            },
          });
          await supabase.from("conversation_sessions").update({ state: "closed" }).eq("id", session.id);
          return json({ ok: true, state: "closed_no_similar" });
        }

        const { data: props } = await supabase
          .from("properties")
          .select("id, public_id, title, city, state, purpose, price")
          .in("id", ids);

        const { data: qrs } = await supabase
          .from("property_qrcodes")
          .select("property_id, qr_token")
          .in("property_id", ids)
          .eq("is_active", true);

        const tokenById = new Map((qrs ?? []).map((q) => [q.property_id, q.qr_token]));
        const byId = new Map((props ?? []).map((p) => [p.id, p]));
        for (const id of ids) {
          const p = byId.get(id);
          if (!p) continue;
          const token = tokenById.get(id);
          const line = [
            p.title || p.public_id,
            [p.city, p.state].filter(Boolean).join(" / "),
            p.price != null ? `R$ ${Number(p.price).toLocaleString("pt-BR")}` : null,
            token ? `Link: /q/${token}` : null,
          ]
            .filter(Boolean)
            .join("\n");
          await queueOutbound(supabase, {
            account_id: property.account_id,
            property_id: p.id,
            lead_phone: leadPhone,
            broker_phone: brokerPhone,
            message_type: "text",
            payload: {
              kind: "similar_item",
              text: line,
            },
          });
        }

        await supabase
          .from("conversation_sessions")
          .update({
            state: "recommendations_sent",
            last_recommended_properties: ids,
          })
          .eq("id", session.id);

        return json({ ok: true, state: "recommendations_sent", count: ids.length });
      }

      if (NO.test(text)) {
        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "close",
            text: "Perfeito. Quando quiser, é só enviar outro QR para continuar.",
          },
        });
        await supabase.from("conversation_sessions").update({ state: "closed" }).eq("id", session.id);
        return json({ ok: true, state: "closed" });
      }
    }

    await queueOutbound(supabase, {
      account_id: property.account_id,
      property_id: property.id,
      lead_phone: leadPhone,
      broker_phone: brokerPhone,
      message_type: "text",
      payload: {
        kind: "help",
        text: "Nao entendi. Responda com 'sim' ou 'nao'.",
      },
    });
    return json({ ok: true, state: "awaiting_valid_reply" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: "unexpected", detail: message }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
