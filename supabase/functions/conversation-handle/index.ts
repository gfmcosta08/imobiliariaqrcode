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
  interaction_count: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function getStringByKeys(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

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


function matchNo(text: string): boolean {
  const t = text.toLowerCase().trim();
  return /^(nao|não|n|no|0)$/.test(t) || /^nao\b/.test(t) || /^não\b/.test(t);
}

function normalizePhone(v: string): string {
  return v.replace(/\D/g, "");
}

function parseQrToken(text: string): string | null {
  const t = text.trim();
  // Hash longo após "imovel" (mensagens legadas)
  const m = t.match(/(?:imovel|imóvel)\s+([a-z0-9_-]{16,100})/i);
  if (m?.[1]) return m[1];
  // Hash longo após "Ref:" (mensagens legadas)
  const mRef = t.match(/Ref:\s*([a-z0-9_-]{16,100})/i);
  if (mRef?.[1]) return mRef[1];
  // public_id formato curto: IMV-2026-BD5699 (mensagens novas)
  const mPub = t.match(/\b([A-Z]{2,5}-\d{4}-[A-Z0-9]{4,})\b/);
  if (mPub?.[1]) return mPub[1];
  // Fallback genérico: qualquer sequência 16+ chars
  const uuidLike = t.match(/[a-z0-9][a-z0-9_-]{15,99}/i);
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
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function isGenericName(value: string | null | undefined): boolean {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!v) return true;

  return (
    /^cliente\b/.test(v) ||
    v === "unknown" ||
    v === "desconhecido" ||
    v === "sem nome" ||
    v === "nome nao informado" ||
    v === "nome não informado" ||
    v === "whatsapp user"
  );
}

function extractProfileName(payload: Record<string, unknown> | undefined): string | null {
  if (!payload) return null;

  const keys = ["pushName", "notifyName", "senderName", "profileName", "name"];
  const direct = getStringByKeys(payload, keys);
  if (direct && !isGenericName(direct)) return normalizePersonName(direct);

  const message = asRecord(payload.message);
  const messageName = message ? getStringByKeys(message, keys) : null;
  if (messageName && !isGenericName(messageName)) return normalizePersonName(messageName);

  const chat = asRecord(payload.chat);
  const chatName = chat ? getStringByKeys(chat, keys) : null;
  if (chatName && !isGenericName(chatName)) return normalizePersonName(chatName);

  const raw = asRecord(payload.raw);
  if (raw) return extractProfileName(raw);

  return null;
}

function pickGreetingName(lead: LeadSnapshot | null, profileName: string | null): string | null {
  if (lead && !isGenericName(lead.primeiro_nome)) return lead.primeiro_nome;
  if (lead && !isGenericName(lead.nome_completo)) {
    return normalizePersonName(lead.nome_completo).split(" ")[0] ?? null;
  }
  if (profileName && !isGenericName(profileName)) {
    return normalizePersonName(profileName).split(" ")[0] ?? null;
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
  const lines: string[] = ["Aqui estao as informacoes do imovel que voce solicitou:", ""];

  const title = fmt(row.title || row.public_id);
  if (title) lines.push(title);

  const local = [fmt(row.neighborhood), fmt(row.city), fmt(row.state)].filter(Boolean).join(" / ");
  if (local) lines.push(`Local: ${local}`);

  const addressParts = [fmt(row.full_address), fmt(row.street_number), fmt(row.address_complement)].filter(Boolean);
  if (addressParts.length) lines.push(`Endereco: ${addressParts.join(", ")}`);

  const purpose = fmt(row.purpose) === "sale" ? "Venda" : fmt(row.purpose) === "rent" ? "Aluguel" : fmt(row.purpose);
  if (purpose) lines.push(`Finalidade: ${purpose}`);

  const value = fmtBRL(row.price ?? row.sale_price ?? row.rent_price);
  if (value) lines.push(`Valor: ${value}`);
  const saleValue = fmtBRL(row.sale_price);
  if (saleValue) lines.push(`Valor de Venda: ${saleValue}`);
  const rentValue = fmtBRL(row.rent_price);
  if (rentValue) lines.push(`Valor de Aluguel: ${rentValue}`);
  const otherFees = fmtBRL(row.other_fees);
  if (otherFees) lines.push(`Outras Taxas: ${otherFees}`);

  if (row.area_m2 || row.total_area_m2) lines.push(`Area: ${row.area_m2 ?? row.total_area_m2}m2`);
  if (row.built_area_m2) lines.push(`Area Construida: ${row.built_area_m2}m2`);
  if (row.land_area_m2) lines.push(`Area do Terreno: ${row.land_area_m2}m2`);

  if (row.bedrooms != null) lines.push(`Quartos: ${row.bedrooms}`);
  if (row.suites != null) lines.push(`Suites: ${row.suites}`);
  if (row.bathrooms != null) lines.push(`Banheiros: ${row.bathrooms}`);
  if (row.parking_spaces != null) lines.push(`Vagas: ${row.parking_spaces}`);
  if (row.living_rooms != null) lines.push(`Salas: ${row.living_rooms}`);
  if (row.floors_count != null) lines.push(`Andares: ${row.floors_count}`);

  if (row.is_furnished != null) lines.push(`Mobiliado: ${row.is_furnished ? "Sim" : "Nao"}`);
  if (fmt(row.furnishing_status)) lines.push(`Status da Mobilia: ${fmt(row.furnishing_status)}`);

  const features = fmt(row.highlights) || fmtList(row.features);
  if (features) lines.push(`Caracteristicas: ${features}`);

  const infra = fmtList(row.infrastructure);
  if (infra) lines.push(`Infraestrutura: ${infra}`);

  const security = fmtList(row.security_items);
  if (security) lines.push(`Seguranca: ${security}`);

  const nearby = fmtList(row.nearby_points);
  if (nearby) lines.push(`Proximidades: ${nearby}`);

  const desc = fmt(row.full_description || row.description);
  if (desc) {
    lines.push("");
    lines.push("Descricao:");
    lines.push(desc);
  }

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
    flow_group?: string | null;
    flow_step?: number | null;
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
    payload: {
      ...(input.payload ?? {}),
      flow_group: input.flow_group ?? null,
      flow_step: input.flow_step ?? null,
    },
  });
}

async function loadPropertyByQr(supabase: ReturnType<typeof createClient>, qrToken: string) {
  const { data, error } = await supabase
    .from("property_qrcodes")
    .select(
      "qr_token, is_active, properties(id, public_id, broker_id, account_id, listing_status, expires_at, title, description, full_description, highlights, property_type, property_subtype, purpose, city, state, neighborhood, city_region, full_address, street_number, address_complement, bedrooms, suites, bathrooms, parking_spaces, living_rooms, floors_count, area_m2, built_area_m2, total_area_m2, land_area_m2, price, sale_price, rent_price, condo_fee, iptu_amount, other_fees, accepts_financing, accepts_trade, is_furnished, furnishing_status, floor_type, sun_position, construction_type, finish_standard, property_age_years, features, infrastructure, security_items, nearby_points, distance_to_center_km, documentation_status, has_deed, has_registration, technical_details, documentation)",
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

async function loadPropertyByPublicId(supabase: ReturnType<typeof createClient>, publicId: string) {
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, public_id, broker_id, account_id, listing_status, expires_at, title, description, full_description, highlights, property_type, property_subtype, purpose, city, state, neighborhood, city_region, full_address, street_number, address_complement, bedrooms, suites, bathrooms, parking_spaces, living_rooms, floors_count, area_m2, built_area_m2, total_area_m2, land_area_m2, price, sale_price, rent_price, condo_fee, iptu_amount, other_fees, accepts_financing, accepts_trade, is_furnished, furnishing_status, floor_type, sun_position, construction_type, finish_standard, property_age_years, features, infrastructure, security_items, nearby_points, distance_to_center_km, documentation_status, has_deed, has_registration, technical_details, documentation",
    )
    .eq("public_id", publicId)
    .maybeSingle();

  if (error || !data) return null;

  if (
    data.listing_status === "removed" ||
    data.listing_status === "blocked" ||
    data.listing_status === "expired" ||
    (data.expires_at && new Date(String(data.expires_at)) < new Date())
  ) {
    return null;
  }

  return data as Record<string, unknown>;
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
    p_observacao: null,
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

  const { count } = await supabase
    .from("lead_interactions")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId);

  return {
    id: String(lead.id),
    primeiro_nome: String(lead.primeiro_nome ?? ""),
    nome_completo: String(lead.nome_completo ?? ""),
    nome_validado: Boolean(lead.nome_validado),
    interaction_count: count ?? 0,
  };
}

async function sendPropertyPack(
  supabase: ReturnType<typeof createClient>,
  property: Record<string, unknown>,
  leadPhone: string,
  lead: LeadSnapshot | null,
  profileName: string | null,
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
  const firstName = pickGreetingName(lead, profileName);
  const introText = firstName
    ? `Ola, ${firstName}! Que bom ter voce aqui. Separei os detalhes do imovel:`
    : `Ola! Que bom ter voce aqui. Separei os detalhes do imovel:`;
  const flowGroup = crypto.randomUUID();
  let flowStep = 1;

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
    flow_group: flowGroup,
    flow_step: flowStep++,
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
    flow_group: flowGroup,
    flow_step: flowStep++,
  });

  const { data: mediaRows } = await supabase
    .from("property_media")
    .select("storage_path")
    .eq("property_id", propertyId)
    .neq("status", "deleted")
    .order("sort_order", { ascending: true });

  for (const media of mediaRows ?? []) {
    const { data: signed, error: signedError } = await supabase.storage
      .from("property-media")
      .createSignedUrl(String(media.storage_path), 60 * 60);

    if (signedError || !signed?.signedUrl) {
      console.error("property image signed url failed", {
        propertyId,
        storagePath: String(media.storage_path),
        error: signedError?.message ?? "missing_signed_url",
      });
      continue;
    }

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
      flow_group: flowGroup,
      flow_step: flowStep++,
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
      text: firstName ? `${firstName}, como posso te ajudar agora:` : `Como posso te ajudar agora:`,
    },
    flow_group: flowGroup,
    flow_step: flowStep++,
  });

  await queueOutbound(supabase, {
    account_id: accountId,
    property_id: propertyId,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: {
      kind: "menu_option_1",
      text: "1 - Falar com o corretor sobre esse imóvel",
    },
    flow_group: flowGroup,
    flow_step: flowStep++,
  });

  await queueOutbound(supabase, {
    account_id: accountId,
    property_id: propertyId,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: {
      kind: "menu_option_2",
      text: "2 - Ver imoveis semelhantes",
    },
    flow_group: flowGroup,
    flow_step: flowStep++,
  });
}

async function sendMainMenu(
  supabase: ReturnType<typeof createClient>,
  property: Record<string, unknown>,
  leadPhone: string,
  brokerPhone: string | null,
  firstName: string,
) {
  const accountId = String(property.account_id);
  const propertyId = String(property.id);
  const flowGroup = crypto.randomUUID();
  let flowStep = 1;

  await queueOutbound(supabase, {
    account_id: accountId,
    property_id: propertyId,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: { kind: "menu_prompt", text: `${firstName}, como posso te ajudar agora:` },
    flow_group: flowGroup,
    flow_step: flowStep++,
  });
  await queueOutbound(supabase, {
    account_id: accountId,
    property_id: propertyId,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: { kind: "menu_option_1", text: "1 - Falar com o corretor sobre esse imóvel" },
    flow_group: flowGroup,
    flow_step: flowStep++,
  });
  await queueOutbound(supabase, {
    account_id: accountId,
    property_id: propertyId,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: { kind: "menu_option_2", text: "2 - Ver imoveis semelhantes" },
    flow_group: flowGroup,
    flow_step: flowStep++,
  });
}

async function handleShowSimilarProperties(
  supabase: ReturnType<typeof createClient>,
  property: Record<string, unknown>,
  lead: LeadSnapshot | null,
  leadPhone: string,
  brokerPhone: string | null,
  firstName: string,
  profileName: string | null,
  informedName: string | null,
  sessionId: string,
): Promise<Response> {
  await upsertLead(supabase, {
    propertyId: String(property.id),
    brokerId: String(property.broker_id),
    leadPhone,
    text: `Interesse em imoveis semelhantes`,
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
      account_id: String(property.account_id),
      property_id: String(property.id),
      lead_phone: leadPhone,
      broker_phone: brokerPhone,
      message_type: "text",
      payload: {
        kind: "similar_empty",
        text: `${firstName}, por enquanto nao encontrei imoveis semelhantes disponiveis.`,
      },
    });
    await sendMainMenu(supabase, property, leadPhone, brokerPhone, firstName);
    await supabase
      .from("conversation_sessions")
      .update({ state: "awaiting_main_choice", last_menu: "main_menu_post_similar" })
      .eq("id", sessionId);
    return json({ ok: true, state: "no_similar_back_to_menu" });
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

  const tokenById = new Map((qrs ?? []).map((q: { property_id: string; qr_token: string }) => [q.property_id, q.qr_token]));
  const byId = new Map((props ?? []).map((p: Record<string, unknown>) => [p.id, p]));

  const flowGroup = crypto.randomUUID();
  let flowStep = 1;

  await queueOutbound(supabase, {
    account_id: String(property.account_id),
    property_id: String(property.id),
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: { kind: "similar_intro", text: `${firstName}, encontrei estas opcoes para voce:` },
    flow_group: flowGroup,
    flow_step: flowStep++,
  });

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const p = byId.get(id);
    if (!p) continue;
    const token = tokenById.get(id);
    const link = token ? (appUrl ? `${appUrl}/q/${token}` : `/q/${token}`) : null;
    const line = [
      `*${i + 1}.* ${p.title || p.public_id}`,
      [p.city, p.state].filter(Boolean).join(" / "),
      p.price != null ? `R$ ${Number(p.price).toLocaleString("pt-BR")}` : null,
      link ? `Link: ${link}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    await queueOutbound(supabase, {
      account_id: String(property.account_id),
      property_id: String(p.id),
      lead_phone: leadPhone,
      broker_phone: brokerPhone,
      message_type: "text",
      payload: { kind: "similar_item", text: line },
      flow_group: flowGroup,
      flow_step: flowStep++,
    });
  }

  await queueOutbound(supabase, {
    account_id: String(property.account_id),
    property_id: String(property.id),
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: {
      kind: "similar_next_action",
      text: `O que deseja fazer?\n1 - Falar com o corretor sobre esse imóvel\n2 - Ver mais imoveis`,
    },
    flow_group: flowGroup,
    flow_step: flowStep++,
  });

  await supabase
    .from("conversation_sessions")
    .update({
      state: "awaiting_post_similar_choice",
      last_menu: "post_similar",
      last_recommended_properties: ids,
    })
    .eq("id", sessionId);

  return json({ ok: true, state: "similar_shown", count: ids.length });
}

async function doRegisterVisit(
  supabase: ReturnType<typeof createClient>,
  property: Record<string, unknown>,
  lead: LeadSnapshot | null,
  leadPhone: string,
  brokerPhone: string | null,
  firstName: string,
  sessionId: string,
  lastMenu: string | null,
  profileName: string | null,
  interactionText: string,
): Promise<void> {
  await upsertLead(supabase, {
    propertyId: String(property.id),
    brokerId: String(property.broker_id),
    leadPhone,
    text: interactionText,
    profileName,
    informedName: null,
    intent: "visit_interest",
    interactionType: "visit_interest",
    forceNameUpdate: false,
  });

  await queueOutbound(supabase, {
    account_id: String(property.account_id),
    property_id: String(property.id),
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: {
      kind: "visit_registered",
      text: `${firstName}, combinado! Ja registrei seu pedido de visita. O corretor vai falar com voce em instantes.`,
      lead_id: lead?.id ?? null,
    },
  });

  if (brokerPhone) {
    await queueOutbound(supabase, {
      account_id: String(property.account_id),
      property_id: String(property.id),
      lead_phone: leadPhone,
      broker_phone: brokerPhone,
      message_type: "text",
      payload: {
        kind: "broker_notification",
        to_broker: true,
        text: `Novo lead para visita no imovel ${property.public_id}. Cliente: ${leadPhone}. Nome: ${lead?.nome_completo || firstName}.`,
      },
    });
  }

  if (lastMenu !== "main_menu_post_similar") {
    await queueOutbound(supabase, {
      account_id: String(property.account_id),
      property_id: String(property.id),
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
      .eq("id", sessionId);
  } else {
    await supabase
      .from("conversation_sessions")
      .update({ state: "closed" })
      .eq("id", sessionId);
  }
}

async function sendTypingNow(leadPhone: string): Promise<void> {
  const baseUrl = Deno.env.get("UAZAPI_BASE_URL") ?? "";
  const token = Deno.env.get("UAZAPI_TOKEN") ?? Deno.env.get("UAZAPI_INSTANCE_TOKEN") ?? null;
  const endpoint = Deno.env.get("UAZAPI_TYPING_ENDPOINT") ?? "";
  console.log("[typing] baseUrl:", baseUrl ? "set" : "MISSING", "endpoint:", endpoint || "MISSING", "phone:", leadPhone);
  if (!baseUrl || !endpoint) return;

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["token"] = token;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ number: leadPhone, presence: "composing" }),
    });
    const body = await res.text();
    console.log("[typing] url:", url, "status:", res.status, "response:", body);
  } catch (err) {
    console.error("[typing] error:", err);
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

    // dispara "digitando" imediatamente para o cliente saber que o sistema recebeu
    await sendTypingNow(leadPhone);

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
      .select("id, state, origin_property_id, current_property_id, last_menu, last_recommended_properties, target_property_id")
      .eq("lead_phone", leadPhone)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const qrToken = parseQrToken(text);
    if (qrToken) {
      const property =
        (await loadPropertyByQr(supabase, qrToken)) ??
        (await loadPropertyByPublicId(supabase, qrToken));
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

      await sendPropertyPack(supabase, property, leadPhone, lead, profileName);
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

    const firstName = pickGreetingName(lead, profileName) ?? "tudo bem";

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
        if (!lead?.nome_validado) {
          const confirmName = profileName ??
            (lead?.nome_completo && !isGenericName(lead.nome_completo) ? lead.nome_completo : null);

          if (confirmName) {
            await queueOutbound(supabase, {
              account_id: property.account_id,
              property_id: property.id,
              lead_phone: leadPhone,
              broker_phone: brokerPhone,
              message_type: "text",
              payload: {
                kind: "name_confirmation",
                text: `${firstName !== "tudo bem" ? firstName + ", a" : "A"}ntes de registrar sua visita: seu nome e ${confirmName}? (Responda SIM ou NAO)`,
              },
            });
            await supabase
              .from("conversation_sessions")
              .update({ state: "awaiting_name_confirmation", last_menu: session.last_menu })
              .eq("id", session.id);
            return json({ ok: true, state: "awaiting_name_confirmation" });
          } else {
            await queueOutbound(supabase, {
              account_id: property.account_id,
              property_id: property.id,
              lead_phone: leadPhone,
              broker_phone: brokerPhone,
              message_type: "text",
              payload: {
                kind: "name_request",
                text: `Para agendar sua visita, pode me informar seu nome completo?`,
              },
            });
            await supabase
              .from("conversation_sessions")
              .update({ state: "awaiting_name_input", last_menu: session.last_menu })
              .eq("id", session.id);
            return json({ ok: true, state: "awaiting_name_input" });
          }
        }

        await doRegisterVisit(
          supabase, property, lead, leadPhone, brokerPhone,
          firstName, session.id, session.last_menu, profileName,
          `Interesse em visita: ${text}`,
        );
        return json({ ok: true, state: "visit_registered" });
      }

      if (matchChoice2(text)) {
        return await handleShowSimilarProperties(
          supabase, property, lead, leadPhone, brokerPhone, firstName, profileName, informedName, session.id,
        );
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

          await sendMainMenu(supabase, property, leadPhone, brokerPhone, firstName);
          await supabase.from("conversation_sessions").update({ state: "awaiting_main_choice", last_menu: "main_menu_post_similar" }).eq("id", session.id);
          return json({ ok: true, state: "no_similar_back_to_menu" });
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
          .update({ state: "awaiting_main_choice", last_menu: "main_menu_post_similar", last_recommended_properties: ids })
          .eq("id", session.id);
        await sendMainMenu(supabase, property, leadPhone, brokerPhone, firstName);
        return json({ ok: true, state: "recommendations_sent_back_to_menu", count: ids.length });
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

    if (session.state === "awaiting_post_similar_choice") {
      if (matchChoice1(text)) {
        const count = Array.isArray(session.last_recommended_properties)
          ? session.last_recommended_properties.length
          : 0;
        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "ask_property_id",
            text: count > 0
              ? `Qual o numero do imovel que deseja visitar? (1 a ${count})`
              : `Qual o numero do imovel que deseja visitar?`,
          },
        });
        await supabase
          .from("conversation_sessions")
          .update({ state: "awaiting_visit_property_id" })
          .eq("id", session.id);
        return json({ ok: true, state: "awaiting_visit_property_id" });
      }

      if (matchChoice2(text)) {
        return await handleShowSimilarProperties(
          supabase, property, lead, leadPhone, brokerPhone, firstName, profileName, informedName, session.id,
        );
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
            text: `${firstName}, tudo bem! Quando quiser, e so me chamar por aqui.`,
          },
        });
        await supabase.from("conversation_sessions").update({ state: "closed" }).eq("id", session.id);
        return json({ ok: true, state: "closed" });
      }

      await queueOutbound(supabase, {
        account_id: property.account_id,
        property_id: property.id,
        lead_phone: leadPhone,
        broker_phone: brokerPhone,
        message_type: "text",
        payload: {
          kind: "similar_next_action_retry",
          text: `Responda:\n1 - Falar com o corretor sobre esse imóvel\n2 - Ver mais imoveis`,
        },
      });
      return json({ ok: true, state: "awaiting_post_similar_choice" });
    }

    if (session.state === "awaiting_visit_property_id") {
      const recommended = Array.isArray(session.last_recommended_properties)
        ? (session.last_recommended_properties as string[])
        : [];
      const num = parseInt(text.trim(), 10);

      if (!isNaN(num) && num >= 1 && num <= recommended.length) {
        const targetId = recommended[num - 1];

        const { data: targetProp } = await supabase
          .from("properties")
          .select("id, public_id, broker_id, account_id")
          .eq("id", targetId)
          .maybeSingle();

        if (targetProp) {
          const hasName = lead?.nome_validado ||
            profileName != null ||
            (lead?.nome_completo && !isGenericName(lead.nome_completo));

          if (hasName) {
            await supabase
              .from("conversation_sessions")
              .update({ target_property_id: targetId, last_menu: "main_menu_post_similar" })
              .eq("id", session.id);
            await doRegisterVisit(
              supabase, targetProp, lead, leadPhone, brokerPhone,
              firstName, session.id, "main_menu_post_similar", profileName,
              `Interesse em visita ao imovel ${targetProp.public_id}`,
            );
          } else {
            const confirmName = profileName ??
              (lead?.nome_completo && !isGenericName(lead.nome_completo) ? lead.nome_completo : null);
            if (confirmName) {
              await queueOutbound(supabase, {
                account_id: property.account_id,
                property_id: property.id,
                lead_phone: leadPhone,
                broker_phone: brokerPhone,
                message_type: "text",
                payload: {
                  kind: "name_confirmation",
                  text: `Antes de registrar sua visita: seu nome e ${confirmName}? (Responda SIM ou NAO)`,
                },
              });
              await supabase
                .from("conversation_sessions")
                .update({ state: "awaiting_name_confirmation", last_menu: "main_menu_post_similar", target_property_id: targetId })
                .eq("id", session.id);
              return json({ ok: true, state: "awaiting_name_confirmation" });
            } else {
              await queueOutbound(supabase, {
                account_id: property.account_id,
                property_id: property.id,
                lead_phone: leadPhone,
                broker_phone: brokerPhone,
                message_type: "text",
                payload: {
                  kind: "name_request",
                  text: `Para agendar sua visita, pode me informar seu nome completo?`,
                },
              });
              await supabase
                .from("conversation_sessions")
                .update({ state: "awaiting_name_input", last_menu: "main_menu_post_similar", target_property_id: targetId })
                .eq("id", session.id);
              return json({ ok: true, state: "awaiting_name_input" });
            }
          }
          return json({ ok: true, state: "visit_registered" });
        }
      }

      const count = recommended.length;
      await queueOutbound(supabase, {
        account_id: property.account_id,
        property_id: property.id,
        lead_phone: leadPhone,
        broker_phone: brokerPhone,
        message_type: "text",
        payload: {
          kind: "ask_property_id_retry",
          text: count > 0
            ? `Numero invalido. Responda com um numero de 1 a ${count}.`
            : `Numero invalido. Responda com o numero do imovel desejado.`,
        },
      });
      return json({ ok: true, state: "awaiting_visit_property_id" });
    }

    if (session.state === "awaiting_name_confirmation") {
      const visitProperty = session.target_property_id
        ? ((await supabase.from("properties").select("id, public_id, broker_id, account_id").eq("id", session.target_property_id).maybeSingle()).data ?? property)
        : property;
      const visitLastMenu = session.target_property_id ? "main_menu_post_similar" : session.last_menu;
      const confirmName = profileName ??
        (lead?.nome_completo && !isGenericName(lead.nome_completo) ? lead.nome_completo : null);

      if (matchChoice1(text)) {
        if (confirmName) {
          const updatedLead = await upsertLead(supabase, {
            propertyId: String(visitProperty.id),
            brokerId: String(visitProperty.broker_id),
            leadPhone,
            text: `Nome confirmado: ${confirmName}`,
            profileName,
            informedName: confirmName,
            intent: "visit_interest",
            interactionType: "name_correction",
            forceNameUpdate: true,
          });
          const confirmedFirstName = pickGreetingName(updatedLead, profileName) ?? firstName;
          await doRegisterVisit(
            supabase, visitProperty, updatedLead ?? lead, leadPhone, brokerPhone,
            confirmedFirstName, session.id, visitLastMenu, profileName,
            `Visita apos confirmacao de nome`,
          );
        } else {
          await doRegisterVisit(
            supabase, visitProperty, lead, leadPhone, brokerPhone,
            firstName, session.id, visitLastMenu, profileName,
            `Visita apos confirmacao de nome`,
          );
        }
        return json({ ok: true, state: "visit_registered_after_name_confirm" });
      }

      if (matchNo(text)) {
        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "name_request",
            text: `Tudo bem! Qual e o seu nome completo?`,
          },
        });
        await supabase
          .from("conversation_sessions")
          .update({ state: "awaiting_name_input" })
          .eq("id", session.id);
        return json({ ok: true, state: "awaiting_name_input" });
      }

      await queueOutbound(supabase, {
        account_id: property.account_id,
        property_id: property.id,
        lead_phone: leadPhone,
        broker_phone: brokerPhone,
        message_type: "text",
        payload: {
          kind: "name_confirmation_retry",
          text: `Responda SIM para confirmar ou NAO para corrigir seu nome.`,
        },
      });
      return json({ ok: true, state: "awaiting_name_confirmation" });
    }

    if (session.state === "awaiting_name_input") {
      const visitProperty = session.target_property_id
        ? ((await supabase.from("properties").select("id, public_id, broker_id, account_id").eq("id", session.target_property_id).maybeSingle()).data ?? property)
        : property;
      const visitLastMenu = session.target_property_id ? "main_menu_post_similar" : session.last_menu;
      const rawName = text.trim();
      if (rawName.length < 2 || matchChoice1(rawName) || matchChoice2(rawName)) {
        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "name_request_retry",
            text: `Por favor, me informe seu nome completo para eu registrar sua visita.`,
          },
        });
        return json({ ok: true, state: "awaiting_name_input" });
      }
      const normalizedName = normalizePersonName(rawName);
      const updatedLead = await upsertLead(supabase, {
        propertyId: String(visitProperty.id),
        brokerId: String(visitProperty.broker_id),
        leadPhone,
        text: `Nome informado: ${normalizedName}`,
        profileName,
        informedName: normalizedName,
        intent: "visit_interest",
        interactionType: "name_correction",
        forceNameUpdate: true,
      });
      const newFirstName = normalizedName.split(" ")[0] || firstName;
      await doRegisterVisit(
        supabase, visitProperty, updatedLead ?? lead, leadPhone, brokerPhone,
        newFirstName, session.id, visitLastMenu, profileName,
        `Visita apos coleta de nome`,
      );
      return json({ ok: true, state: "visit_registered_after_name_input" });
    }

    await queueOutbound(supabase, {
      account_id: property.account_id,
      property_id: property.id,
      lead_phone: leadPhone,
      broker_phone: brokerPhone,
      message_type: "text",
      payload: {
        kind: "help",
        text: `${firstName}, para te ajudar melhor, responda com 1 ou 2.`,
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
