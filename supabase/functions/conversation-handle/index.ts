import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

type InboundInput = {
  lead_phone?: string;
  text?: string;
  event_id?: string;
  payload?: Record<string, unknown>;
};

type LeadSnapshot = {
  id: string;
  primeiro_nome: string;
  nome_completo: string;
  nome_validado: boolean;
};

function matchChoice1(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (/^(1|s|sim|yes|y|quero)$/.test(t)) return true;
  if (/\b(agendar|visita|visitar|marcar)\b/.test(t)) return true;
  if (/^sim\b/.test(t)) return true;
  return false;
}

function matchChoice2(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (/^2$/.test(t)) return true;
  return /\b(mais\s+imoveis|imoveis\s+(parecidos|similares)|outros\s+imoveis|ver\s+mais)\b/.test(t);
}

function matchChoice3(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (/^3$/.test(t)) return true;
  return /\b(anunciar?|anunciem|divulgar|publicar|vender\s+meu\s+imovel)\b/.test(t);
}

function matchNo(text: string): boolean {
  const t = text.toLowerCase().trim();
  return /^(nao|não|n|no|0)$/.test(t) || /^nao\b/.test(t) || /^não\b/.test(t);
}

function normalizePhone(v: string): string {
  return v.replace(/\D/g, "");
}

function parseQrToken(text: string): string | null {
  const t = text.trim();
  const m = t.match(/(?:imovel|imóvel)\s+([a-z0-9_-]{16,80})/i);
  if (m?.[1]) return m[1];
  const mRef = t.match(/Ref:\s*([a-z0-9]{32,80})/i);
  if (mRef?.[1]) return mRef[1];
  const uuidLike = t.match(/[a-z0-9]{32,80}/i);
  return uuidLike?.[0] ?? null;
}

function parseNameFromIntroduction(text: string): string | null {
  const t = text.trim();
  const regexes = [
    /(?:meu\s+nome\s+e|meu\s+nome\s+é)\s+([a-zA-ZÀ-ÿ'\-\s]{2,60})/i,
    /(?:me\s+chamo|eu\s+sou|sou\s+o|sou\s+a)\s+([a-zA-ZÀ-ÿ'\-\s]{2,60})/i,
  ];
  for (const r of regexes) {
    const m = t.match(r);
    if (m?.[1]) return normalizePersonName(m[1]);
  }
  return null;
}

function parseNameCorrection(text: string): string | null {
  const t = text.trim();
  const regexes = [
    /meu\s+nome\s+(?:nao\s+e|não\s+é)\s+[a-zA-ZÀ-ÿ'\-\s]{2,60},?\s*(?:e|é)\s+([a-zA-ZÀ-ÿ'\-\s]{2,60})/i,
    /(?:nao\s+e|não\s+é)\s+[a-zA-ZÀ-ÿ'\-\s]{2,60},?\s*(?:e|é)\s+([a-zA-ZÀ-ÿ'\-\s]{2,60})/i,
    /corrigindo.*(?:meu\s+nome\s+e|meu\s+nome\s+é)\s+([a-zA-ZÀ-ÿ'\-\s]{2,60})/i,
  ];
  for (const r of regexes) {
    const m = t.match(r);
    if (m?.[1]) return normalizePersonName(m[1]);
  }
  return null;
}

function normalizePersonName(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Cliente";
  return cleaned
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractProfileName(payload: Record<string, unknown> | undefined): string | null {
  if (!payload) return null;

  const directKeys = ["pushName", "notifyName", "senderName", "profileName", "name"];
  for (const key of directKeys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length >= 2) {
      return normalizePersonName(value);
    }
  }

  const message = payload.message;
  if (message && typeof message === "object") {
    const m = message as Record<string, unknown>;
    for (const key of directKeys) {
      const value = m[key];
      if (typeof value === "string" && value.trim().length >= 2) {
        return normalizePersonName(value);
      }
    }
  }

  return null;
}

function fmt(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function fmtBRL(v: unknown): string {
  if (v == null || v === "") return "";
  const n = Number(v);
  return isNaN(n) ? "" : `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function fmtList(v: unknown): string {
  if (!v || !Array.isArray(v)) return "";
  return (v as string[]).filter(Boolean).join(", ");
}

function summarizeProperty(row: Record<string, unknown>): string {
  const lines: string[] = [];

  const purpose = fmt(row.purpose) === "sale" ? "Venda" : fmt(row.purpose) === "rent" ? "Aluguel" : fmt(row.purpose);
  const title = fmt(row.title || row.public_id);
  const type = [fmt(row.property_type), fmt(row.property_subtype)].filter(Boolean).join(" - ");

  lines.push(`?? *${title}*`);
  if (row.public_id) lines.push(`Ref: ${fmt(row.public_id)}`);
  if (type) lines.push(`Tipo: ${type}`);
  if (purpose) lines.push(`Finalidade: ${purpose}`);

  const loc = [fmt(row.neighborhood), fmt(row.city_region), fmt(row.city), fmt(row.state)].filter(Boolean);
  if (loc.length) lines.push(`\n?? *Localizacao*\n${loc.join(", ")}`);
  if (row.full_address) lines.push(`Endereco: ${fmt(row.full_address)}`);

  const chars: string[] = [];
  if (row.bedrooms) chars.push(`${row.bedrooms} quarto(s)`);
  if (row.suites) chars.push(`${row.suites} suite(s)`);
  if (row.bathrooms) chars.push(`${row.bathrooms} banheiro(s)`);
  if (row.parking_spaces) chars.push(`${row.parking_spaces} vaga(s)`);
  if (row.living_rooms) chars.push(`${row.living_rooms} sala(s)`);
  if (chars.length) lines.push(`\n?? *Caracteristicas*\n${chars.join(" | ")}`);

  const areas: string[] = [];
  if (row.area_m2 || row.total_area_m2) areas.push(`Area total: ${row.area_m2 ?? row.total_area_m2} m2`);
  if (row.built_area_m2) areas.push(`Area construida: ${row.built_area_m2} m2`);
  if (row.land_area_m2) areas.push(`Terreno: ${row.land_area_m2} m2`);
  if (areas.length) lines.push(areas.join(" | "));

  const priceLines: string[] = [];
  const mainPrice = fmtBRL(row.sale_price ?? row.rent_price ?? row.price);
  if (mainPrice) priceLines.push(purpose === "Aluguel" ? `Aluguel: ${mainPrice}` : `Preco: ${mainPrice}`);
  if (row.condo_fee) priceLines.push(`Condominio: ${fmtBRL(row.condo_fee)}`);
  if (row.iptu_amount) priceLines.push(`IPTU: ${fmtBRL(row.iptu_amount)}`);
  if (priceLines.length) lines.push(`\n?? *Valores*\n${priceLines.join(" | ")}`);

  const desc = fmt(row.description || row.full_description);
  if (desc) lines.push(`\n?? *Descricao*\n${desc}`);

  const feats = fmtList(row.features);
  if (feats) lines.push(`\n? *Diferenciais*\n${feats}`);

  return lines.join("\n");
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

async function loadPropertyByQr(supabase: ReturnType<typeof createClient>, qrToken: string) {
  const { data, error } = await supabase
    .from("property_qrcodes")
    .select(
      "qr_token, is_active, properties(id, public_id, broker_id, account_id, listing_status, expires_at, title, description, highlights, property_type, property_subtype, purpose, city, state, neighborhood, city_region, full_address, bedrooms, suites, bathrooms, parking_spaces, living_rooms, floors_count, area_m2, built_area_m2, total_area_m2, land_area_m2, price, sale_price, rent_price, condo_fee, iptu_amount, other_fees, accepts_financing, accepts_trade, is_furnished, furnishing_status, floor_type, sun_position, construction_type, finish_standard, property_age_years, features, infrastructure, security_items, nearby_points, distance_to_center_km, documentation_status, has_deed, has_registration, technical_details, documentation)",
    )
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data?.properties) return null;
  const p = Array.isArray(data.properties) ? data.properties[0] : data.properties;
  if (!p) return null;

  if (
    p.listing_status === "removed" ||
    p.listing_status === "blocked" ||
    p.listing_status === "expired" ||
    (p.expires_at && new Date(String(p.expires_at)) < new Date())
  ) {
    return null;
  }

  return p as Record<string, unknown>;
}

async function upsertLead(
  supabase: ReturnType<typeof createClient>,
  input: {
    propertyId: string;
    brokerId: string;
    leadPhone: string;
    text: string;
    profileName: string | null;
    informedName: string | null;
    intent: string;
    interactionType: string;
    forceNameUpdate: boolean;
  },
): Promise<LeadSnapshot | null> {
  const { data: leadId, error } = await supabase.rpc("upsert_lead_from_qr_event", {
    p_property_id: input.propertyId,
    p_broker_id: input.brokerId,
    p_client_phone: input.leadPhone,
    p_nome_informado: input.informedName,
    p_nome_perfil: input.profileName,
    p_observacao: input.text,
    p_origem: "qr_code_anuncio",
    p_interaction_type: input.interactionType,
    p_intent: input.intent,
    p_force_name_update: input.forceNameUpdate,
  });

  if (error || !leadId) {
    console.error("upsert_lead_from_qr_event failed", error?.message ?? "unknown");
    return null;
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("id, primeiro_nome, nome_completo, nome_validado")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return null;

  return {
    id: String(lead.id),
    primeiro_nome: String(lead.primeiro_nome ?? "Cliente"),
    nome_completo: String(lead.nome_completo ?? "Cliente"),
    nome_validado: Boolean(lead.nome_validado),
  };
}

async function sendPropertyPack(
  supabase: ReturnType<typeof createClient>,
  property: Record<string, unknown>,
  leadPhone: string,
  lead: LeadSnapshot | null,
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
  const firstName = lead?.primeiro_nome || "Cliente";

  const introText = lead?.nome_validado
    ? `Ola, ${firstName}! Que bom ter voce aqui. Separei os detalhes do imovel:`
    : `Ola! Posso te chamar de ${firstName}? Se preferir outro nome, me fala que eu atualizo agora.`;

  await queueOutbound(supabase, {
    account_id: accountId,
    property_id: propertyId,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: {
      kind: "lead_intro",
      text: introText,
    },
  });

  await queueOutbound(supabase, {
    account_id: accountId,
    property_id: propertyId,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: {
      kind: "property_summary",
      text: summarizeProperty(property),
      public_id: property.public_id,
    },
  });

  const { data: mediaRows } = await supabase
    .from("property_media")
    .select("storage_path")
    .eq("property_id", propertyId)
    .neq("status", "deleted")
    .order("sort_order", { ascending: true })
    .limit(10);

  for (const media of mediaRows ?? []) {
    const { data: signed } = await supabase.storage
      .from("property-media")
      .createSignedUrl(String(media.storage_path), 60 * 60);

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
        caption: `Foto do imovel ${String(property.public_id ?? "")}`,
      },
    });
  }

  const appUrl =
    Deno.env.get("NEXT_PUBLIC_APP_URL") ??
    Deno.env.get("APP_URL") ??
    Deno.env.get("PUBLIC_APP_URL") ??
    "";

  await queueOutbound(supabase, {
    account_id: accountId,
    property_id: propertyId,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: {
      kind: "menu_prompt",
      text: `${firstName}, me diga como posso te ajudar agora:\n1 - Agendar visita ao imovel\n2 - Ver imoveis semelhantes\n3 - Anunciar um imovel conosco${appUrl ? ` (${appUrl})` : ""}`,
    },
  });
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

    const profileName = extractProfileName(body.payload);
    const correctedName = parseNameCorrection(text);
    const informedName = correctedName ?? parseNameFromIntroduction(text);

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
      const brokerId = String(property.broker_id);

      const lead = await upsertLead(supabase, {
        propertyId,
        brokerId,
        leadPhone,
        text,
        profileName,
        informedName,
        intent: "visit_interest",
        interactionType: "qr_entry",
        forceNameUpdate: Boolean(correctedName),
      });

      if (session?.id) {
        await supabase
          .from("conversation_sessions")
          .update({
            origin_property_id: propertyId,
            current_property_id: propertyId,
            state: "awaiting_main_choice",
            last_menu: "main_menu",
          })
          .eq("id", session.id);
      } else {
        await supabase.from("conversation_sessions").insert({
          lead_phone: leadPhone,
          origin_property_id: propertyId,
          current_property_id: propertyId,
          state: "awaiting_main_choice",
          last_menu: "main_menu",
        });
      }

      await sendPropertyPack(supabase, property, leadPhone, lead);
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

    const lead = await upsertLead(supabase, {
      propertyId: String(property.id),
      brokerId: String(property.broker_id),
      leadPhone,
      text,
      profileName,
      informedName,
      intent: "visit_interest",
      interactionType: correctedName ? "name_correction" : "conversation_message",
      forceNameUpdate: Boolean(correctedName),
    });

    const firstName = lead?.primeiro_nome || "Cliente";

    if (correctedName) {
      await queueOutbound(supabase, {
        account_id: property.account_id,
        property_id: property.id,
        lead_phone: leadPhone,
        broker_phone: brokerPhone,
        message_type: "text",
        payload: {
          kind: "name_updated",
          text: `Perfeito, ${firstName}. Nome atualizado aqui. Obrigado por avisar!`,
        },
      });
    }

    if (session.state === "awaiting_main_choice") {
      if (matchChoice1(text)) {
        const leadVisit = await upsertLead(supabase, {
          propertyId: String(property.id),
          brokerId: String(property.broker_id),
          leadPhone,
          text: `Interesse em visita: ${text}`,
          profileName,
          informedName: informedName ?? null,
          intent: "visit_interest",
          interactionType: "visit_interest",
          forceNameUpdate: false,
        });

        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "visit_registered",
            text: `${firstName}, combinado! Ja registrei seu pedido de visita. O corretor vai falar com voce em instantes.`,
            lead_id: leadVisit?.id ?? null,
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
              text: `Novo lead para visita no imovel ${property.public_id}. Cliente: ${leadPhone}. Nome: ${lead?.nome_completo ?? firstName}.`,
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
            text: `${firstName}, quer que eu te mostre imoveis semelhantes tambem? (Responda SIM ou NAO)`,
          },
        });

        await supabase
          .from("conversation_sessions")
          .update({ state: "awaiting_recommendation_choice", last_menu: "similar_question" })
          .eq("id", session.id);

        return json({ ok: true, state: "visit_registered" });
      }

      if (matchChoice2(text)) {
        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "similar_question",
            text: `${firstName}, otimo. Quer que eu te envie agora os imoveis mais parecidos? (Responda SIM ou NAO)`,
          },
        });

        await supabase
          .from("conversation_sessions")
          .update({ state: "awaiting_recommendation_choice", last_menu: "similar_question" })
          .eq("id", session.id);

        return json({ ok: true, state: "asked_similar" });
      }

      if (matchChoice3(text)) {
        const appUrl =
          Deno.env.get("NEXT_PUBLIC_APP_URL") ??
          Deno.env.get("APP_URL") ??
          Deno.env.get("PUBLIC_APP_URL") ??
          "";

        await upsertLead(supabase, {
          propertyId: String(property.id),
          brokerId: String(property.broker_id),
          leadPhone,
          text: `Interesse em anunciar: ${text}`,
          profileName,
          informedName: informedName ?? null,
          intent: "similar_property_interest",
          interactionType: "advertise_interest",
          forceNameUpdate: false,
        });

        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "close_advertise",
            text: `${firstName}, excelente! ${appUrl ? `Acesse ${appUrl} para anunciar com a gente.` : "Nosso time vai te orientar para anunciar com a gente."}`,
          },
        });

        await supabase
          .from("conversation_sessions")
          .update({ state: "closed", last_menu: "advertise" })
          .eq("id", session.id);

        return json({ ok: true, state: "closed_advertise" });
      }
    }

    if (session.state === "awaiting_recommendation_choice") {
      if (matchChoice1(text)) {
        await upsertLead(supabase, {
          propertyId: String(property.id),
          brokerId: String(property.broker_id),
          leadPhone,
          text: `Interesse em imoveis semelhantes: ${text}`,
          profileName,
          informedName: informedName ?? null,
          intent: "similar_property_interest",
          interactionType: "similar_interest",
          forceNameUpdate: false,
        });

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
              text: `${firstName}, por enquanto nao encontrei imoveis semelhantes disponiveis. Posso te avisar quando entrar uma opcao nova.`,
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

        const appUrl =
          Deno.env.get("NEXT_PUBLIC_APP_URL") ??
          Deno.env.get("APP_URL") ??
          Deno.env.get("PUBLIC_APP_URL") ??
          "";

        const tokenById = new Map((qrs ?? []).map((q) => [q.property_id, q.qr_token]));
        const byId = new Map((props ?? []).map((p) => [p.id, p]));

        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "similar_intro",
            text: `${firstName}, encontrei estas opcoes para voce:`,
          },
        });

        for (const id of ids) {
          const p = byId.get(id);
          if (!p) continue;
          const token = tokenById.get(id);
          const link = token ? (appUrl ? `${appUrl}/q/${token}` : `/q/${token}`) : null;
          const line = [
            p.title || p.public_id,
            [p.city, p.state].filter(Boolean).join(" / "),
            p.price != null ? `R$ ${Number(p.price).toLocaleString("pt-BR")}` : null,
            link ? `Link: ${link}` : null,
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
          .update({ state: "recommendations_sent", last_recommended_properties: ids })
          .eq("id", session.id);

        return json({ ok: true, state: "recommendations_sent", count: ids.length });
      }

      if (matchNo(text)) {
        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "close",
            text: `${firstName}, perfeito. Quando quiser, e so me chamar por aqui que continuamos.`,
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
        text: `${firstName}, para te ajudar melhor, responda com 1, 2 ou 3.`,
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
