import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";
import { buildWelcomeBackMessage, extractUazapiName, resolveLeadNameFromTextOrFallback } from "./name-flow.ts";

type InboundInput = {
  lead_phone?: string;
  text?: string;
  event_id?: string;
  is_audio?: boolean;
  payload?: Record<string, unknown>;
};

const YES = /^(sim|s|yes|y|1|quero)$/i;
const NO = /^(nao|não|n|no|0)$/i;

function isOption(text: string, option: string): boolean {
  const t = text.trim();
  return t === option || new RegExp(`^${option}\\s*[-–—:]`, "i").test(t);
}

const AUDIO = /\[(audio|áudio|áudio)\]/i;

type MainChoice = "1" | "2" | "3" | null;
type LeadNameSource = "text" | "uazapi" | "existing" | "none";
const NAME_REFUSAL = /^(nao|não|prefiro nao|prefiro não|nao quero informar|não quero informar|sem nome)$/i;

function normalizeIntentText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsableText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^\[(audio|a[uá]dio)\]$/i.test(t)) return false;
  return !AUDIO.test(t);
}

function resolveMainChoice(text: string): MainChoice {
  if (isOption(text, "1")) return "1";
  if (isOption(text, "2")) return "2";
  if (isOption(text, "3")) return "3";

  const t = normalizeIntentText(text);
  if (!t) return null;

  if (/ver mais|mais imoveis|outro imovel|outros imoveis|parecid|semelhante|similar/.test(t)) {
    return "2";
  }
  if (/agendar visita|marcar visita|quero visitar|visitar|visita|conhecer o imovel|conhecer imovel/.test(t)) {
    return "1";
  }
  if (/anunciar|anuncie|anuncio|divulgar imovel|colocar imovel/.test(t)) {
    return "3";
  }

  return null;
}

function parseQrToken(text: string): string | null {
  const t = text.trim();
  // Padrao 1: imovel [token]
  const m = t.match(/(?:imovel|im[oó]vel)\s+([a-z0-9_-]{16,80})/i);
  if (m?.[1]) return m[1];
  // Padrao 2: (Ref: [token]) ou Ref: [token]
  const mRef = t.match(/Ref:\s*([a-z0-9]{32,80})/i);
  if (mRef?.[1]) return mRef[1];
  // Padrao 3: apenas o token (hash de 32 a 80 chars)
  const uuidLike = t.match(/[a-z0-9]{32,80}/i);
  return uuidLike?.[0] ?? null;
}

function summarizeProperty(row: Record<string, any>): string {
  const title = String(row.title ?? row.public_id ?? "Imovel");
  const city = String(row.city ?? "");
  const state = String(row.state ?? "");
  const neighborhood = String(row.neighborhood ?? "");
  const purpose = String(row.purpose ?? "");
  const price = row.price == null ? null : Number(row.price).toLocaleString("pt-BR");
  const area = row.area_m2 || row.total_area_m2;
  const builtArea = row.built_area_m2;
  const landArea = row.land_area_m2;
  const bedrooms = row.bedrooms;
  const suites = row.suites;
  const bathrooms = row.bathrooms;
  const parking = row.parking_spaces;
  const livingRooms = row.living_rooms;
  const floorsCount = row.floors_count;
  const unitFloor = row.unit_floor;
  const isFurnished = row.is_furnished;
  const furnishingStatus = row.furnishing_status;
  const ownerName = row.owner_name;
  const listingBrokerName = row.listing_broker_name;
  const fullAddress = row.full_address;
  const streetNumber = row.street_number;
  const addressComplement = row.address_complement;
  const salePrice = row.sale_price == null ? null : Number(row.sale_price).toLocaleString("pt-BR");
  const rentPrice = row.rent_price == null ? null : Number(row.rent_price).toLocaleString("pt-BR");
  const otherFees = row.other_fees == null ? null : Number(row.other_fees).toLocaleString("pt-BR");
  const description = row.description || row.full_description;
  const features = Array.isArray(row.features) ? row.features.join(", ") : "";
  const infrastructure = Array.isArray(row.infrastructure) ? row.infrastructure.join(", ") : "";
  const securityItems = Array.isArray(row.security_items) ? row.security_items.join(", ") : "";
  const nearbyPoints = Array.isArray(row.nearby_points) ? row.nearby_points.join(", ") : "";

  const lines = [
    `*${title}*`,
    city || state || neighborhood ? `Local: ${[neighborhood, city, state].filter(Boolean).join(" / ")}` : null,
    fullAddress || streetNumber || addressComplement ? `Endereco: ${[fullAddress, streetNumber, addressComplement].filter(Boolean).join(", ")}` : null,
    purpose ? `Finalidade: ${purpose === "sale" ? "Venda" : "Aluguel"}` : null,
    price ? `Valor: R$ ${price}` : null,
    salePrice ? `Valor de Venda: R$ ${salePrice}` : null,
    rentPrice ? `Valor de Aluguel: R$ ${rentPrice}` : null,
    otherFees ? `Outras Taxas: R$ ${otherFees}` : null,
    area ? `Area: ${area}m2` : null,
    builtArea ? `Area Construida: ${builtArea}m2` : null,
    landArea ? `Area do Terreno: ${landArea}m2` : null,
    bedrooms ? `Quartos: ${bedrooms}` : null,
    suites ? `Suites: ${suites}` : null,
    bathrooms ? `Banheiros: ${bathrooms}` : null,
    parking ? `Vagas: ${parking}` : null,
    livingRooms ? `Salas: ${livingRooms}` : null,
    floorsCount ? `Andares: ${floorsCount}` : null,
    unitFloor ? `Andar da Unidade: ${unitFloor}` : null,
    typeof isFurnished === "boolean" ? `Mobiliado: ${isFurnished ? "Sim" : "Nao"}` : null,
    furnishingStatus ? `Status da Mobilia: ${furnishingStatus}` : null,
    ownerName ? `Proprietario: ${ownerName}` : null,
    listingBrokerName ? `Corretor Responsavel: ${listingBrokerName}` : null,
    features ? `Caracteristicas: ${features}` : null,
    infrastructure ? `Infraestrutura: ${infrastructure}` : null,
    securityItems ? `Seguranca: ${securityItems}` : null,
    nearbyPoints ? `Proximidades: ${nearbyPoints}` : null,
    description ? `\n*Descricao:*\n${description}` : null,
  ];

  return lines.filter(Boolean).join("\n");
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
      `qr_token, is_active, 
       properties(
         id, public_id, broker_id, account_id, title, city, state, purpose, price, 
         origin_plan_code, listing_status, description, full_description, 
         area_m2, total_area_m2, built_area_m2, land_area_m2, bedrooms, suites, bathrooms, parking_spaces,
         neighborhood, full_address, street_number, address_complement, sale_price, rent_price, other_fees,
         living_rooms, floors_count, unit_floor, is_furnished, furnishing_status,
         owner_name, listing_broker_name, features, infrastructure, security_items, nearby_points
       )`,
    )
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data?.properties) return null;
  const p = Array.isArray(data.properties) ? data.properties[0] : data.properties;
  if (!p || p.listing_status === "removed" || p.listing_status === "blocked" || p.listing_status === "expired") {
    return null;
  }
  return p as Record<string, any>;
}

async function sendPropertyPack(
  supabase: ReturnType<typeof createClient>,
  property: Record<string, any>,
  leadPhone: string,
  knownLeadName: string | null,
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
      text: knownLeadName
        ? `${buildWelcomeBackMessage(knownLeadName)}\n\nAqui estao as informacoes do imovel que voce solicitou:\n\n${summarizeProperty(property)}`
        : `Aqui estao as informacoes do imovel que voce solicitou:\n\n${summarizeProperty(property)}`,
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
        caption: "",
      },
    });
  }

  const siteUrl = Deno.env.get("PUBLIC_APP_URL") || "nosso site";
  const finalMessages = [
    "1 - Gostaria de agendar uma visita ao imovel",
    "2 - Gostaria de ver mais imoveis como esse",
    "3 - Anunciem conosco e entre no nosso site: " + siteUrl,
  ];

  for (const msg of finalMessages) {
    await queueOutbound(supabase, {
      account_id: accountId,
      property_id: propertyId,
      lead_phone: leadPhone,
      broker_phone: brokerPhone,
      message_type: "text",
      payload: {
        kind: "final_option",
        text: msg,
      },
    });
  }
}

async function loadLatestLeadByPhone(
  supabase: ReturnType<typeof createClient>,
  leadPhone: string,
) {
  const { data } = await supabase
    .from("leads")
    .select("id, client_name")
    .eq("client_phone", leadPhone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { id: string; client_name: string | null } | null;
}

async function persistLeadName(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  leadName: string,
) {
  const { error } = await supabase
    .from("leads")
    .update({ client_name: leadName })
    .eq("id", leadId);
  if (error) {
    throw new Error(`persist_lead_name_failed:${error.message}`);
  }
}

function shouldForceFallbackFromRefusal(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return NAME_REFUSAL.test(t);
}

async function loadFallbackUazapiNameFromInboundHistory(
  supabase: ReturnType<typeof createClient>,
  leadPhone: string,
): Promise<string | null> {
  const { data: rows } = await supabase
    .from("whatsapp_messages")
    .select("payload")
    .eq("direction", "inbound")
    .eq("lead_phone", leadPhone)
    .order("created_at", { ascending: false })
    .limit(20);

  for (const row of rows ?? []) {
    const payload = row?.payload as Record<string, unknown> | null;
    if (!payload || typeof payload !== "object") continue;
    const raw = payload.raw;
    if (raw && typeof raw === "object") {
      const extracted = extractUazapiName(raw as Record<string, unknown>);
      if (extracted) return extracted;
    }
    const directExtracted = extractUazapiName(payload);
    if (directExtracted) return directExtracted;
  }
  return null;
}

async function handleVisitRequest(
  supabase: ReturnType<typeof createClient>,
  session: any,
  property: any,
  leadPhone: string,
  brokerPhone: string | null,
  leadName: string | null = null,
  leadNameSource: LeadNameSource = "none",
) {
  const { data: leadId, error: leadError } = await supabase.rpc("create_lead_from_visit_interest", {
    p_property_id: property.id,
    p_broker_id: property.broker_id,
    p_client_phone: leadPhone,
    p_intent: "visit_interest",
    p_client_name: leadName,
  });
  if (leadError) {
    throw new Error(`create_lead_failed:${leadError.message}`);
  }

  if (leadId && leadName) {
    await persistLeadName(supabase, String(leadId), leadName);
  }

  await queueOutbound(supabase, {
    account_id: property.account_id,
    property_id: property.id,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: {
      kind: "visit_registered",
      text: leadName
        ? `Fechado, ${leadName}! Ja anotei aqui seu interesse. O corretor vai te chamar em breve para combinarmos tudo.`
        : "Fechado! Ja anotei aqui seu interesse. O corretor vai te chamar em breve para combinarmos tudo.",
      lead_id: leadId ?? null,
      name_source: leadNameSource,
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
        text: `*Novo Lead!*\n\nUm cliente quer visitar o imovel *${property.public_id}*.\n\nContato: ${leadPhone}\n\nEntre em contato assim que puder.`,
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
      text: "Enquanto isso, quer dar uma olhada em outros imoveis parecidos com esse? (Responda SIM ou NAO)",
    },
  });

  await supabase
    .from("conversation_sessions")
    .update({ state: "awaiting_recommendation_choice", last_menu: "similar_question" })
    .eq("id", session.id);

  return json({ ok: true, state: "visit_registered" });
}

async function handleSimilarRequest(
  supabase: ReturnType<typeof createClient>,
  session: any,
  property: any,
  leadPhone: string,
  brokerPhone: string | null,
) {
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
        text: "No momento nao encontrei outros imoveis parecidos com esse na regiao. Mas sempre entram novidades.",
      },
    });
    await queueOutbound(supabase, {
      account_id: property.account_id,
      property_id: property.id,
      lead_phone: leadPhone,
      broker_phone: brokerPhone,
      message_type: "text",
      payload: {
        kind: "help_main_choice",
        text: "Se quiser, escolha: 1 para agendar visita, 2 para tentar ver mais imoveis ou 3 para anunciar.",
      },
    });
    await supabase
      .from("conversation_sessions")
      .update({ state: "awaiting_main_choice", last_menu: "visit_question" })
      .eq("id", session.id);
    return json({ ok: true, state: "awaiting_main_choice_no_similar" });
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

  await queueOutbound(supabase, {
    account_id: property.account_id,
    property_id: property.id,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: {
      kind: "similar_intro",
      text: "Legal! Separei alguns imoveis que voce pode gostar:",
    },
  });

  for (const id of ids) {
    const p = byId.get(id);
    if (!p) continue;
    const token = tokenById.get(id);
    const line = [
      `*${p.title || p.public_id}*`,
      [p.city, p.state].filter(Boolean).join(" / "),
      p.price != null ? `R$ ${Number(p.price).toLocaleString("pt-BR")}` : null,
      token ? `Ver mais: ${Deno.env.get("PUBLIC_APP_URL")}/q/${token}` : null,
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

async function handleAdvertiseRequest(
  supabase: ReturnType<typeof createClient>,
  session: any,
  property: any,
  leadPhone: string,
  brokerPhone: string | null,
) {
  const siteUrl = Deno.env.get("PUBLIC_APP_URL") || "nosso site";
  await queueOutbound(supabase, {
    account_id: property.account_id,
    property_id: property.id,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: {
      kind: "advertise_info",
      text: `Que bacana!\n\nPara anunciar seu imovel com a gente, basta acessar ${siteUrl} e fazer seu cadastro. E rapidinho.\n\nQualquer duvida, estamos a disposicao.`,
    },
  });
  await supabase.from("conversation_sessions").update({ state: "closed" }).eq("id", session.id);
  return json({ ok: true, state: "closed_advertise" });
}

Deno.serve(async (req) => {
  console.log(`[conversation-handle] Received request: ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    console.log(`[conversation-handle] Raw payload: ${rawBody}`);

    let body: InboundInput;
    try {
      body = JSON.parse(rawBody) as InboundInput;
    } catch (e) {
      console.error("[conversation-handle] Failed to parse JSON:", e);
      return json({ ok: false, error: "invalid_json" }, 400);
    }

    const leadPhone = String(body.lead_phone ?? "").trim();
    const text = String(body.text ?? "").trim();
    const isAudio = !!body.is_audio || AUDIO.test(text);
    const inboundPayload = body.payload ?? null;

    console.log(`[conversation-handle] Processing message from ${leadPhone}: "${text}" (isAudio: ${isAudio})`);

    if (!leadPhone || (!text && !isAudio)) {
      return json({ ok: false, error: "missing_input" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    if (isAudio && !isUsableText(text)) {
      const { data: lastSession } = await supabase
        .from("conversation_sessions")
        .select("id, origin_property_id")
        .eq("lead_phone", leadPhone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const propertyId = lastSession?.origin_property_id;
      let accountId: string | null = null;
      let brokerPhone: string | null = null;

      if (propertyId) {
        const { data: prop } = await supabase
          .from("properties")
          .select("account_id, broker_id")
          .eq("id", propertyId)
          .maybeSingle();
        if (prop) {
          accountId = prop.account_id;
          const { data: brk } = await supabase
            .from("brokers")
            .select("whatsapp_number")
            .eq("id", prop.broker_id)
            .maybeSingle();
          brokerPhone = brk?.whatsapp_number;
        }
      }

      if (accountId) {
        await queueOutbound(supabase, {
          account_id: accountId,
          property_id: propertyId || null,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "audio_fallback",
            text: "No momento eu ainda nao consigo ouvir audios.\n\nPode digitar o que deseja? Responda com 1, 2 ou 3.",
          },
        });
        return json({ ok: true, state: "audio_not_supported" });
      }
      return json({ ok: true, state: "audio_without_active_session" });
    }

    const { data: session } = await supabase
      .from("conversation_sessions")
      .select("id, state, origin_property_id, current_property_id, last_menu")
      .eq("lead_phone", leadPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const leadProfile = await loadLatestLeadByPhone(supabase, leadPhone);
    const knownLeadName = leadProfile?.client_name ? String(leadProfile.client_name) : null;

    const qrToken = parseQrToken(text);
    console.log(`[conversation-handle] Parsed QR Token: ${qrToken}`);

    if (qrToken) {
      console.log("[conversation-handle] QR Token found. Loading property...");
      const property = await loadPropertyByQr(supabase, qrToken);
      if (!property) {
        console.log("[conversation-handle] Property not found or inactive.");
        return json({ ok: false, error: "invalid_or_unavailable_qr" }, 400);
      }

      console.log(`[conversation-handle] Property found: ${property.public_id}`);
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

      console.log(`[conversation-handle] Sending property pack for ${property.public_id} to ${leadPhone}`);
      await sendPropertyPack(supabase, property, leadPhone, knownLeadName);
      console.log("[conversation-handle] Property pack sent successfully.");
      return json({ ok: true, state: "started", property_id: propertyId });
    }

    console.log("[conversation-handle] No QR Token found in message. Checking session...");

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

    if (session.last_menu === "awaiting_name_for_visit") {
      let resolved = resolveLeadNameFromTextOrFallback(text, inboundPayload);
      if (!resolved.name && shouldForceFallbackFromRefusal(text)) {
        const historicalFallback = await loadFallbackUazapiNameFromInboundHistory(supabase, leadPhone);
        if (historicalFallback) {
          resolved = { name: historicalFallback, source: "uazapi" };
        }
      }
      if (!resolved.name) {
        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "ask_name_for_visit_retry",
            text: "Para seguir com o agendamento, preciso do seu nome completo (nome e sobrenome).",
          },
        });
        return json({ ok: true, state: "awaiting_name_for_visit" });
      }

      await supabase
        .from("conversation_sessions")
        .update({ last_menu: "visit_question" })
        .eq("id", session.id);

      return handleVisitRequest(
        supabase,
        session,
        property,
        leadPhone,
        brokerPhone,
        resolved.name,
        resolved.source,
      );
    }

    if (session.last_menu === "awaiting_name_for_close") {
      let resolved = resolveLeadNameFromTextOrFallback(text, inboundPayload);
      if (!resolved.name && shouldForceFallbackFromRefusal(text)) {
        const historicalFallback = await loadFallbackUazapiNameFromInboundHistory(supabase, leadPhone);
        if (historicalFallback) {
          resolved = { name: historicalFallback, source: "uazapi" };
        }
      }
      if (!resolved.name) {
        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "ask_name_before_close_retry",
            text: "Antes de encerrar, preciso do seu nome completo para manter seu cadastro atualizado.",
          },
        });
        return json({ ok: true, state: "awaiting_name_before_close" });
      }

      const { data: leadId, error: leadError } = await supabase.rpc("create_lead_from_visit_interest", {
        p_property_id: property.id,
        p_broker_id: property.broker_id,
        p_client_phone: leadPhone,
        p_intent: "similar_property_interest",
        p_client_name: resolved.name,
      });
      if (leadError) {
        throw new Error(`create_lead_failed:${leadError.message}`);
      }

      if (leadId) {
        await persistLeadName(supabase, String(leadId), resolved.name);
      }

      await queueOutbound(supabase, {
        account_id: property.account_id,
        property_id: property.id,
        lead_phone: leadPhone,
        broker_phone: brokerPhone,
        message_type: "text",
        payload: {
          kind: "close",
          text: `Perfeito, ${resolved.name}. Cadastro atualizado. Quando quiser, e so enviar outro QR para continuar.`,
          name_source: resolved.source,
        },
      });
      await supabase
        .from("conversation_sessions")
        .update({ state: "closed", last_menu: "closed_with_name" })
        .eq("id", session.id);
      return json({ ok: true, state: "closed" });
    }

    if (session.state === "awaiting_main_choice") {
      if (isOption(text, "0")) {
        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "similar_question",
            text: "Sem problemas! Quer que eu te mostre outros imoveis que talvez voce curta? (Responda SIM ou NAO)",
          },
        });
        await supabase
          .from("conversation_sessions")
          .update({ state: "awaiting_recommendation_choice", last_menu: "similar_question" })
          .eq("id", session.id);
        return json({ ok: true, state: "asked_similar" });
      }

      const choice = resolveMainChoice(text);
      if (choice === "1") {
        if (!knownLeadName) {
          await queueOutbound(supabase, {
            account_id: property.account_id,
            property_id: property.id,
            lead_phone: leadPhone,
            broker_phone: brokerPhone,
            message_type: "text",
            payload: {
              kind: "ask_name_for_visit",
              text: leadProfile?.id
                ? "Antes de confirmar o agendamento, me informe seu nome completo para atualizar seu cadastro."
                : "Antes de agendar, preciso do seu nome completo para realizar seu cadastro.",
            },
          });
          await supabase
            .from("conversation_sessions")
            .update({ last_menu: "awaiting_name_for_visit" })
            .eq("id", session.id);
          return json({ ok: true, state: "awaiting_name_for_visit" });
        }
        return handleVisitRequest(supabase, session, property, leadPhone, brokerPhone, knownLeadName, "existing");
      }
      if (choice === "2") {
        return handleSimilarRequest(supabase, session, property, leadPhone, brokerPhone);
      }
      if (choice === "3") {
        return handleAdvertiseRequest(supabase, session, property, leadPhone, brokerPhone);
      }

      await queueOutbound(supabase, {
        account_id: property.account_id,
        property_id: property.id,
        lead_phone: leadPhone,
        broker_phone: brokerPhone,
        message_type: "text",
        payload: {
          kind: "help_main_choice",
          text: "Nao entendi. Escolha uma opcao: 1 para visita, 2 para ver mais imoveis ou 3 para anunciar.",
        },
      });
      return json({ ok: true, state: "awaiting_main_choice" });
    }

    if (session.state === "closed" || session.state === "recommendations_sent") {
      const choice = resolveMainChoice(text);
      if (choice === "1") {
        await supabase
          .from("conversation_sessions")
          .update({ state: "awaiting_main_choice", last_menu: "visit_question" })
          .eq("id", session.id);
        if (!knownLeadName) {
          await queueOutbound(supabase, {
            account_id: property.account_id,
            property_id: property.id,
            lead_phone: leadPhone,
            broker_phone: brokerPhone,
            message_type: "text",
            payload: {
              kind: "ask_name_for_visit",
              text: "Antes de confirmar o agendamento, me informe seu nome completo.",
            },
          });
          await supabase
            .from("conversation_sessions")
            .update({ last_menu: "awaiting_name_for_visit" })
            .eq("id", session.id);
          return json({ ok: true, state: "awaiting_name_for_visit" });
        }
        return handleVisitRequest(supabase, session, property, leadPhone, brokerPhone, knownLeadName, "existing");
      }
      if (choice === "2") {
        await supabase
          .from("conversation_sessions")
          .update({ state: "awaiting_main_choice", last_menu: "visit_question" })
          .eq("id", session.id);
        return handleSimilarRequest(supabase, session, property, leadPhone, brokerPhone);
      }
      if (choice === "3") {
        return handleAdvertiseRequest(supabase, session, property, leadPhone, brokerPhone);
      }
    }

    if (session.state === "awaiting_recommendation_choice") {
      const choice = resolveMainChoice(text);
      if (choice === "1") {
        if (!knownLeadName) {
          await queueOutbound(supabase, {
            account_id: property.account_id,
            property_id: property.id,
            lead_phone: leadPhone,
            broker_phone: brokerPhone,
            message_type: "text",
            payload: {
              kind: "ask_name_for_visit",
              text: "Antes de confirmar o agendamento, me informe seu nome completo.",
            },
          });
          await supabase
            .from("conversation_sessions")
            .update({ last_menu: "awaiting_name_for_visit" })
            .eq("id", session.id);
          return json({ ok: true, state: "awaiting_name_for_visit" });
        }
        return handleVisitRequest(supabase, session, property, leadPhone, brokerPhone, knownLeadName, "existing");
      }
      if (choice === "2") {
        return handleSimilarRequest(supabase, session, property, leadPhone, brokerPhone);
      }
      if (choice === "3") {
        return handleAdvertiseRequest(supabase, session, property, leadPhone, brokerPhone);
      }

      if (YES.test(text)) {
        return handleSimilarRequest(supabase, session, property, leadPhone, brokerPhone);
      }

      if (NO.test(text)) {
        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "ask_name_before_close",
            text: "Sem problemas. Antes de encerrar, me informe seu nome completo para mantermos seu cadastro atualizado.",
          },
        });
        await supabase
          .from("conversation_sessions")
          .update({ last_menu: "awaiting_name_for_close" })
          .eq("id", session.id);
        return json({ ok: true, state: "awaiting_name_before_close" });
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
