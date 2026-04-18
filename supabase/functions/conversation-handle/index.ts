import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

type InboundInput = {
  lead_phone?: string;
  text?: string;
  event_id?: string;
  payload?: Record<string, unknown>;
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
  return /\b(mais\s+im[oó]veis|im[oó]veis\s+(parecidos|similares)|outros\s+im[oó]veis|ver\s+mais)\b/.test(t);
}

function matchChoice3(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (/^3$/.test(t)) return true;
  return /\b(anunci[ao]r?|anunciem|divulgar|publicar)\b/.test(t);
}

function matchNo(text: string): boolean {
  const t = text.toLowerCase().trim();
  return /^(n[aã]o|n|no|0)$/.test(t) || /^n[aã]o\b/.test(t);
}

function normalizePhone(v: string): string {
  return v.replace(/\D/g, "");
}

function parseQrToken(text: string): string | null {
  const t = text.trim();
  const m = t.match(/(?:imovel|im[oó]vel)\s+([a-z0-9_-]{16,80})/i);
  if (m?.[1]) return m[1];
  const uuidLike = t.match(/[a-z0-9]{32,80}/i);
  return uuidLike?.[0] ?? null;
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

  lines.push(`🏠 *${title}*`);
  if (row.public_id) lines.push(`Ref: ${fmt(row.public_id)}`);
  if (type) lines.push(`Tipo: ${type}`);
  if (purpose) lines.push(`Finalidade: ${purpose}`);

  // Localização
  const loc = [fmt(row.neighborhood), fmt(row.city_region), fmt(row.city), fmt(row.state)].filter(Boolean);
  if (loc.length) lines.push(`\n📍 *Localização*\n${loc.join(", ")}`);
  if (row.full_address) lines.push(`Endereço: ${fmt(row.full_address)}`);

  // Características
  const chars: string[] = [];
  if (row.bedrooms) chars.push(`${row.bedrooms} quarto(s)`);
  if (row.suites) chars.push(`${row.suites} suíte(s)`);
  if (row.bathrooms) chars.push(`${row.bathrooms} banheiro(s)`);
  if (row.parking_spaces) chars.push(`${row.parking_spaces} vaga(s)`);
  if (row.living_rooms) chars.push(`${row.living_rooms} sala(s)`);
  if (row.floors_count) chars.push(`${row.floors_count} pavimento(s)`);
  if (chars.length) lines.push(`\n🛏 *Características*\n${chars.join(" | ")}`);

  const areas: string[] = [];
  if (row.area_m2 || row.total_area_m2) areas.push(`Área total: ${row.area_m2 ?? row.total_area_m2} m²`);
  if (row.built_area_m2) areas.push(`Área construída: ${row.built_area_m2} m²`);
  if (row.land_area_m2) areas.push(`Terreno: ${row.land_area_m2} m²`);
  if (areas.length) lines.push(areas.join(" | "));

  const extras: string[] = [];
  if (row.floor_type) extras.push(`Piso: ${fmt(row.floor_type)}`);
  if (row.sun_position) extras.push(`Posição solar: ${fmt(row.sun_position)}`);
  if (row.construction_type) extras.push(`Construção: ${fmt(row.construction_type)}`);
  if (row.finish_standard) extras.push(`Padrão: ${fmt(row.finish_standard)}`);
  if (row.property_age_years != null) extras.push(`Idade: ${row.property_age_years} anos`);
  if (extras.length) lines.push(extras.join(" | "));

  const furnishing = fmt(row.furnishing_status);
  if (furnishing) {
    const fmap: Record<string, string> = { furnished: "Mobiliado", semi_furnished: "Semi-mobiliado", unfurnished: "Sem mobília" };
    lines.push(`Mobília: ${fmap[furnishing] ?? furnishing}`);
  }

  // Preços
  const priceLines: string[] = [];
  const mainPrice = fmtBRL(row.sale_price ?? row.rent_price ?? row.price);
  if (mainPrice) priceLines.push(purpose === "Aluguel" ? `Aluguel: ${mainPrice}` : `Preço: ${mainPrice}`);
  if (row.condo_fee) priceLines.push(`Condomínio: ${fmtBRL(row.condo_fee)}`);
  if (row.iptu_amount) priceLines.push(`IPTU: ${fmtBRL(row.iptu_amount)}`);
  if (row.other_fees) priceLines.push(`Outras taxas: ${fmtBRL(row.other_fees)}`);
  if (priceLines.length) lines.push(`\n💰 *Valores*\n${priceLines.join(" | ")}`);

  const conditions: string[] = [];
  if (row.accepts_financing) conditions.push("Aceita financiamento");
  if (row.accepts_trade) conditions.push("Aceita permuta");
  if (conditions.length) lines.push(conditions.join(" | "));

  // Descrição
  const desc = fmt(row.description || row.full_description);
  if (desc) lines.push(`\n📝 *Descrição*\n${desc}`);
  const highlights = fmt(row.highlights);
  if (highlights) lines.push(`Destaques: ${highlights}`);

  // Diferenciais
  const feats = fmtList(row.features);
  if (feats) lines.push(`\n✅ *Diferenciais*\n${feats}`);
  const infra = fmtList(row.infrastructure);
  if (infra) lines.push(`Infraestrutura: ${infra}`);
  const security = fmtList(row.security_items);
  if (security) lines.push(`Segurança: ${security}`);

  // Localização próxima
  const nearby = fmtList(row.nearby_points);
  if (nearby) lines.push(`\n📌 *Pontos próximos*\n${nearby}`);
  if (row.distance_to_center_km) lines.push(`Distância ao centro: ${row.distance_to_center_km} km`);

  // Documentação
  const docParts: string[] = [];
  if (row.documentation_status) docParts.push(`Situação: ${fmt(row.documentation_status)}`);
  if (row.has_deed) docParts.push("Escritura: Sim");
  if (row.has_registration) docParts.push("Registro: Sim");
  if (row.documentation) docParts.push(fmt(row.documentation));
  if (row.technical_details) docParts.push(fmt(row.technical_details));
  if (docParts.length) lines.push(`\n📄 *Documentação*\n${docParts.join(" | ")}`);

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

async function loadPropertyByQr(
  supabase: ReturnType<typeof createClient>,
  qrToken: string,
) {
  const { data, error } = await supabase
    .from("property_qrcodes")
    .select(
      "qr_token, is_active, properties(id, public_id, broker_id, account_id, listing_status, origin_plan_code, title, description, highlights, property_type, property_subtype, purpose, city, state, neighborhood, city_region, full_address, bedrooms, suites, bathrooms, parking_spaces, living_rooms, floors_count, area_m2, built_area_m2, total_area_m2, land_area_m2, price, sale_price, rent_price, condo_fee, iptu_amount, other_fees, accepts_financing, accepts_trade, is_furnished, furnishing_status, floor_type, sun_position, construction_type, finish_standard, property_age_years, features, infrastructure, security_items, nearby_points, distance_to_center_km, documentation_status, has_deed, has_registration, technical_details, documentation)",
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
      text: summarizeProperty(property),
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

  const appUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? Deno.env.get("APP_URL") ?? Deno.env.get("PUBLIC_APP_URL") ?? "";

  await queueOutbound(supabase, {
    account_id: accountId,
    property_id: propertyId,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: { kind: "menu_option_1", text: "1 - Gostaria de agendar uma visita ao imóvel" },
  });

  await queueOutbound(supabase, {
    account_id: accountId,
    property_id: propertyId,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: { kind: "menu_option_2", text: "2 - Gostaria de ver mais imóveis como esse" },
  });

  await queueOutbound(supabase, {
    account_id: accountId,
    property_id: propertyId,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: { kind: "menu_option_3", text: `3 - Anunciem conosco e entre no nosso site${appUrl ? `: ${appUrl}` : ""}` },
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

      // Prevent re-sending pack if session already active for this property
      if (
        session?.id &&
        session.origin_property_id === propertyId &&
        session.state === "awaiting_main_choice"
      ) {
        return json({ ok: true, state: "already_started" });
      }

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
      if (matchChoice1(text)) {
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
            text: "Perfeito. Seu interesse de visita foi registrado. O corretor vai entrar em contato.",
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
              text: `Novo cliente aguardando contato para visita.\nImóvel: ${property.public_id}\nTelefone: ${leadPhone}`,
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
            text: "Deseja ver mais imóveis como esse? (responda: sim ou nao)",
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
            text: "Tudo bem. Deseja ver mais imóveis como esse? (responda: sim ou nao)",
          },
        });
        await supabase
          .from("conversation_sessions")
          .update({ state: "awaiting_recommendation_choice", last_menu: "similar_question" })
          .eq("id", session.id);
        return json({ ok: true, state: "asked_similar" });
      }

      if (matchChoice3(text)) {
        const appUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? Deno.env.get("APP_URL") ?? Deno.env.get("PUBLIC_APP_URL") ?? "";
        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "close_advertise",
            text: `Que ótimo! Acesse nosso site e saiba mais${appUrl ? `: ${appUrl}` : "."}`,
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
              text: "No momento nao encontramos outros imóveis similares.",
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

      if (matchNo(text)) {
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
        text: "Nao entendi. Responda com 1, 2 ou 3.",
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
