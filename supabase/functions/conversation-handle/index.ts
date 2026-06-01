import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

type InboundInput = {
  lead_phone?: string;
  text?: string;
  event_id?: string;
  payload?: Record<string, unknown>;
  interaction_id?: string;
  starting_step_id?: string;
};

// ── Helpers de log por etapa ─────────────────────────────────────────────────

async function logStep(
  supabase: ReturnType<typeof createClient>,
  interactionId: string | null | undefined,
  stepName: string,
): Promise<string | null> {
  if (!interactionId) return null;
  const { data } = await supabase.rpc("fn_start_interaction_step", {
    p_interaction_id: interactionId,
    p_step: stepName,
  });
  return (data as string | null) ?? null;
}

function completeStep(
  supabase: ReturnType<typeof createClient>,
  stepId: string | null | undefined,
  status: "complete" | "failed",
  error?: string,
): void {
  if (!stepId) return;
  supabase
    .rpc("fn_complete_interaction_step", {
      p_step_id: stepId,
      p_status: status,
      p_error: error ?? null,
    })
    .then(() => {})
    .catch(() => {});
}

type LeadSnapshot = {
  id: string;
  primeiro_nome: string;
  nome_completo: string;
  nome_validado: boolean;
  interaction_count: number;
};

type ConversationIntent =
  | "qr_entry"
  | "property_code_lookup"
  | "main_menu_choice"
  | "post_similar_menu_choice"
  | "post_similar_property_id"
  | "visit_property_id"
  | "conversation_message";

const ACTIVE_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const CUSTOMER_RESPONSE_WINDOW_MS = 5 * 60 * 1000;
const TECHNICAL_FALLBACK_TEXT =
  "Desculpe, tivemos um problema tecnico. Tente novamente em instantes.";

class SilentResponseError extends Error {
  fallbackQueued: boolean;

  constructor(message: string, fallbackQueued: boolean) {
    super(message);
    this.name = "SilentResponseError";
    this.fallbackQueued = fallbackQueued;
  }
}

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

function normalizeMenuText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function normalizePropertyCode(text: unknown): string {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function matchChoice2(text: string): boolean {
  const t = normalizeMenuText(text);
  if (/^2(\b|[\s.)-])/.test(t)) return true;
  return /\b(ver\s+imoveis\s+semelhantes|imoveis\s+semelhantes|mais\s+imoveis|imoveis\s+(parecidos|similares)|outros\s+imoveis|ver\s+mais)\b/.test(
    t,
  );
}

function matchChoice3(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (/^3$/.test(t)) return true;
  return /\b(contato\s+do\s+corretor|contato|numero\s+do\s+corretor|telefone\s+do\s+corretor)\b/.test(
    t,
  );
}

function matchNo(text: string): boolean {
  const t = text.toLowerCase().trim();
  return /^(nao|não|n|no|0)$/.test(t) || /^nao\b/.test(t) || /^não\b/.test(t);
}

function normalizePhone(v: string): string {
  return v.replace(/\D/g, "");
}

function sanitizeBrokerPhone(v: string | null | undefined): string | null {
  if (!v) return null;
  // Rejeita placeholders do tipo "pending-{uuid}" gerados pelo trigger de onboarding
  if (v.startsWith("pending-")) return null;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
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

function classifyConversationIntent(
  sessionState: string | null | undefined,
  text: string,
  parsedQrToken: string | null,
): ConversationIntent {
  if (sessionState === "awaiting_visit_property_id") return "visit_property_id";

  if (sessionState === "awaiting_post_similar_choice") {
    if (matchChoice1(text) || matchChoice2(text) || matchChoice3(text) || matchNo(text)) {
      return "post_similar_menu_choice";
    }
    return parsedQrToken ? "post_similar_property_id" : "post_similar_menu_choice";
  }

  if (sessionState === "awaiting_main_choice") {
    if (matchChoice1(text) || matchChoice2(text) || matchChoice3(text)) return "main_menu_choice";
    return parsedQrToken ? "property_code_lookup" : "conversation_message";
  }

  if (parsedQrToken) return sessionState ? "property_code_lookup" : "qr_entry";
  return "conversation_message";
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

function hasMeaningfulText(v: unknown): boolean {
  return fmt(v).length > 0;
}

function meaningfulNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

function formatNumberPt(v: unknown, suffix = ""): string {
  const n = meaningfulNumber(v);
  if (n == null) return "";
  const value = n.toLocaleString("pt-BR", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${value}${suffix}`;
}

function formatInteger(v: unknown): string {
  const n = meaningfulNumber(v);
  if (n == null) return "";
  return String(Math.trunc(n));
}

function formatBool(v: unknown): string {
  if (v === true) return "Sim";
  if (v === false) return "Não";
  return "";
}

function formatPropertyStatus(v: unknown): string {
  const raw = fmt(v);
  if (raw === "draft") return "Rascunho";
  if (raw === "published") return "Disponível";
  if (raw === "removed") return "Vendido";
  if (raw === "printed") return "Impresso";
  if (raw === "expired") return "Expirado";
  if (raw === "blocked") return "Bloqueado";
  return raw;
}

function formatFurnishing(row: Record<string, unknown>): string {
  const status = fmt(row.furnishing_status);
  if (status === "unfurnished") return "Não mobiliado";
  if (status === "semi_furnished") return "Semi-mobiliado";
  if (status === "furnished") return "Mobiliado";
  return formatBool(row.is_furnished);
}

function formatTextList(v: unknown): string {
  if (Array.isArray(v))
    return v
      .map((item) => fmt(item))
      .filter(Boolean)
      .join(", ");
  return fmt(v);
}

function formatHighlights(v: unknown): string {
  const raw = fmt(v);
  if (!raw) return "";
  const items = raw
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length > 1) return items.map((item) => `- ${item}`).join("\n");
  return raw;
}

function addSection(lines: string[], title: string, fields: Array<[string, string]>) {
  const visible = fields.filter(([, value]) => hasMeaningfulText(value));
  if (!visible.length) return;

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(title);
  for (const [label, value] of visible) {
    lines.push(`- ${label} ${value}`);
  }
}

function formatPurpose(v: unknown): string {
  const raw = fmt(v);
  if (raw === "sale") return "Venda";
  if (raw === "rent") return "Aluguel";
  if (raw === "season") return "Temporada";
  return raw;
}

function formatSimilarProperty(
  row: Record<string, unknown>,
  index: number,
  link: string | null,
): string {
  const lines: string[] = [`*${index}.* ${fmt(row.title || row.public_id) || "Imovel"}`];

  const publicId = fmt(row.public_id);
  if (publicId) lines.push(`ID do imovel: ${publicId}`);

  const purpose = formatPurpose(row.purpose);
  if (purpose) lines.push(`Finalidade: ${purpose}`);

  const saleValue = fmtBRL(row.sale_price);
  const rentValue = fmtBRL(row.rent_price);
  const mainValue = fmtBRL(row.price);
  if (saleValue) lines.push(`Valor de Venda: ${saleValue}`);
  if (rentValue) lines.push(`Valor de Aluguel: ${rentValue}`);
  if (!saleValue && !rentValue && mainValue) lines.push(`Valor: ${mainValue}`);
  const condo = fmtBRL(row.condo_fee);
  if (condo) lines.push(`Condominio: ${condo}`);
  const iptu = fmtBRL(row.iptu_amount);
  if (iptu) lines.push(`IPTU: ${iptu}`);

  const local = [fmt(row.neighborhood), fmt(row.city), fmt(row.state)].filter(Boolean).join(" / ");
  if (local) lines.push(`Local: ${local}`);

  const attrs = [
    row.total_area_m2 || row.area_m2 ? `Area ${row.total_area_m2 ?? row.area_m2}m2` : null,
    row.bedrooms != null ? `${row.bedrooms} quarto(s)` : null,
    row.suites != null ? `${row.suites} suite(s)` : null,
    row.bathrooms != null ? `${row.bathrooms} banheiro(s)` : null,
    row.parking_spaces != null ? `${row.parking_spaces} vaga(s)` : null,
  ].filter(Boolean);
  if (attrs.length) lines.push(`Atributos: ${attrs.join(" | ")}`);

  if (link) {
    lines.push(`Fotos e detalhes: ${link}`);
  } else {
    lines.push("Fotos e detalhes: solicite ao corretor por aqui.");
  }

  return lines.join("\n");
}

async function loadBrokerContact(
  supabase: ReturnType<typeof createClient>,
  brokerId: string | null,
): Promise<{ name: string | null; phone: string | null }> {
  if (!brokerId) return { name: null, phone: null };

  const { data: broker } = await supabase
    .from("brokers")
    .select("whatsapp_number, display_name, profiles(whatsapp_number)")
    .eq("id", brokerId)
    .maybeSingle();

  const rawPhone =
    broker?.whatsapp_number ||
    (broker as unknown as { profiles?: { whatsapp_number?: string } })?.profiles?.whatsapp_number ||
    null;

  return {
    name: broker?.display_name ? String(broker.display_name) : null,
    phone: sanitizeBrokerPhone(rawPhone ? String(rawPhone) : null),
  };
}

async function loadOriginPropertyForSession(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
): Promise<Record<string, unknown> | null> {
  const { data: session } = await supabase
    .from("conversation_sessions")
    .select("origin_property_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session?.origin_property_id) return null;

  const { data: originProperty } = await supabase
    .from("properties")
    .select("id, public_id, broker_id, account_id")
    .eq("id", session.origin_property_id)
    .maybeSingle();

  return originProperty ?? null;
}

async function loadLeadOriginBrokerContact(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  fallbackBrokerId: string | null,
  fallbackBrokerName: string | null,
  fallbackBrokerPhone: string | null,
): Promise<{ name: string | null; phone: string | null; brokerPhone: string | null }> {
  const originProperty = await loadOriginPropertyForSession(supabase, sessionId);
  const originBrokerId = fmt(originProperty?.broker_id);

  if (originBrokerId) {
    const originContact = await loadBrokerContact(supabase, originBrokerId);
    return {
      name: originContact.name ?? "Corretor",
      phone: originContact.phone,
      brokerPhone: originContact.phone,
    };
  }

  const fallbackContact = await loadBrokerContact(supabase, fallbackBrokerId);
  return {
    name: fallbackContact.name ?? fallbackBrokerName,
    phone: fallbackContact.phone ?? fallbackBrokerPhone,
    brokerPhone: fallbackContact.phone ?? fallbackBrokerPhone,
  };
}

async function resolveRecommendedProperty(
  supabase: ReturnType<typeof createClient>,
  input: string,
  recommendedIds: string[],
  shownIds: string[] = [],
): Promise<Record<string, unknown> | null> {
  const candidateIds = Array.from(
    new Set(
      [...recommendedIds, ...shownIds]
        .map((id) => String(id ?? "").trim())
        .filter(Boolean),
    ),
  );
  if (!candidateIds.length) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const { data: props } = await supabase
    .from("properties")
    .select("id, public_id, broker_id, account_id")
    .in("id", candidateIds);

  const normalizedInput = normalizePropertyCode(trimmed);
  const byDisplayedOrInternalId =
    (props ?? []).find((p: Record<string, unknown>) => {
      const internalId = fmt(p.id);
      const normalizedPublicId = normalizePropertyCode(p.public_id);
      return (
        (internalId.length > 0 && trimmed === internalId && candidateIds.includes(internalId)) ||
        (normalizedPublicId.length > 0 &&
          (normalizedInput === normalizedPublicId || normalizedInput.includes(normalizedPublicId)))
      );
    }) ?? null;
  if (byDisplayedOrInternalId) return byDisplayedOrInternalId;

  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && String(num) === trimmed && num >= 1 && num <= candidateIds.length) {
    const targetId = candidateIds[num - 1];
    return (props ?? []).find((p: Record<string, unknown>) => fmt(p.id) === targetId) ?? null;
  }

  return null;
}

function summarizeProperty(row: Record<string, unknown>): string {
  const lines: string[] = [];
  const title = fmt(row.title || row.public_id);
  if (title) lines.push(title);

  const desc = fmt(row.full_description || row.description);
  if (desc) {
    if (lines.length) lines.push("");
    lines.push(desc);
  }

  const highlights = formatHighlights(row.highlights);
  if (highlights) {
    if (lines.length) lines.push("");
    lines.push("Diferenciais do Imóvel");
    lines.push(highlights);
  }

  addSection(lines, "Dados do Imóvel", [
    ["ID do Imóvel", fmt(row.public_id)],
    ["Código Interno", fmt(row.internal_code)],
    ["Tipo de Imóvel", fmt(row.property_type)],
    ["Subtipo de Imóvel", fmt(row.property_subtype)],
    ["Finalidade", formatPurpose(row.purpose)],
    ["Status do Imóvel", formatPropertyStatus(row.listing_status)],
  ]);

  addSection(lines, "Valores", [
    ["Preço de Venda", fmtBRL(meaningfulNumber(row.sale_price))],
    ["Valor de Aluguel/Temporada", fmtBRL(meaningfulNumber(row.rent_price))],
    ["Condomínio", fmtBRL(meaningfulNumber(row.condo_fee))],
    ["IPTU", fmtBRL(meaningfulNumber(row.iptu_amount))],
    ["Outras Taxas", fmtBRL(meaningfulNumber(row.other_fees))],
    ["Aceita Financiamento", formatBool(row.accepts_financing)],
    ["Aceita Permuta", formatBool(row.accepts_trade)],
  ]);

  addSection(lines, "Áreas e Cômodos", [
    ["Área Total", formatNumberPt(row.total_area_m2 ?? row.area_m2, " m²")],
    ["Área Construída", formatNumberPt(row.built_area_m2, " m²")],
    ["Área do Terreno", formatNumberPt(row.land_area_m2, " m²")],
    ["Quartos", formatInteger(row.bedrooms)],
    ["Suítes", formatInteger(row.suites)],
    ["Banheiros", formatInteger(row.bathrooms)],
    ["Vagas de Garagem", formatInteger(row.parking_spaces)],
    ["Salas", formatInteger(row.living_rooms)],
    ["Número de Andares", formatInteger(row.floors_count)],
    ["Andar do Imóvel", formatInteger(row.unit_floor)],
    ["Mobiliado", formatFurnishing(row)],
    ["Tipo de Piso", fmt(row.floor_type)],
    ["Posição Solar", fmt(row.sun_position)],
    ["Idade do Imóvel", formatNumberPt(row.property_age_years, " ano(s)")],
  ]);

  addSection(lines, "Endereço", [
    ["Endereço Completo", fmt(row.full_address)],
    ["Número", fmt(row.street_number)],
    ["Complemento", fmt(row.address_complement)],
    ["Bairro", fmt(row.neighborhood)],
    ["Cidade", fmt(row.city)],
    ["Estado / UF", fmt(row.state)],
    ["CEP", fmt(row.postal_code)],
    ["Latitude", formatNumberPt(row.latitude)],
    ["Longitude", formatNumberPt(row.longitude)],
  ]);

  addSection(lines, "Características e Infraestrutura", [
    ["Características", formatTextList(row.features)],
    ["Infraestrutura", formatTextList(row.infrastructure)],
    ["Segurança", formatTextList(row.security_items)],
    ["Chave Disponível", formatBool(row.key_available)],
    ["Imóvel Ocupado", formatBool(row.is_occupied)],
  ]);

  addSection(lines, "Documentação e Detalhes Técnicos", [
    ["Documentação", fmt(row.documentation)],
    ["Detalhes Técnicos Avançados", fmt(row.technical_details)],
    ["Tipo de Construção", fmt(row.construction_type)],
    ["Padrão de Acabamento", fmt(row.finish_standard)],
    ["Matrícula do Imóvel", fmt(row.registry_number)],
    ["Situação da Documentação", fmt(row.documentation_status)],
    ["Possui Escritura", formatBool(row.has_deed)],
    ["Possui Registro", formatBool(row.has_registration)],
  ]);

  addSection(lines, "Localização Estratégica", [
    ["Proximidades", formatTextList(row.nearby_points)],
    ["Distância do Centro", formatNumberPt(row.distance_to_center_km, " km")],
    ["Região da Cidade", fmt(row.city_region)],
  ]);

  addSection(lines, "Observações", [["Observações do Corretor", fmt(row.broker_notes)]]);

  return lines.join("\n").trim();
}

function stripUrlsFromText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

async function queuePropertyCodePrompt(
  supabase: ReturnType<typeof createClient>,
  leadPhone: string,
) {
  await supabase.from("whatsapp_messages").insert({
    direction: "outbound",
    provider: "uazapi",
    lead_phone: leadPhone,
    message_type: "text",
    status: "queued",
    payload: {
      kind: "property_code_prompt",
      text: "Informe o imóvel para o qual deseja informação.",
    },
  });
}

async function loadPropertyByQr(supabase: ReturnType<typeof createClient>, qrToken: string) {
  const { data, error } = await supabase
    .from("property_qrcodes")
    .select(
      "qr_token, is_active, properties(id, public_id, internal_code, broker_id, account_id, listing_status, expires_at, title, description, full_description, highlights, property_type, property_subtype, purpose, city, state, neighborhood, city_region, full_address, street_number, address_complement, postal_code, latitude, longitude, bedrooms, suites, bathrooms, parking_spaces, living_rooms, floors_count, unit_floor, area_m2, built_area_m2, total_area_m2, land_area_m2, price, sale_price, rent_price, condo_fee, iptu_amount, other_fees, accepts_financing, accepts_trade, is_furnished, furnishing_status, floor_type, sun_position, construction_type, finish_standard, property_age_years, features, infrastructure, security_items, nearby_points, distance_to_center_km, key_available, is_occupied, documentation_status, has_deed, has_registration, registry_number, technical_details, documentation, broker_notes)",
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
      "id, public_id, internal_code, broker_id, account_id, listing_status, expires_at, title, description, full_description, highlights, property_type, property_subtype, purpose, city, state, neighborhood, city_region, full_address, street_number, address_complement, postal_code, latitude, longitude, bedrooms, suites, bathrooms, parking_spaces, living_rooms, floors_count, unit_floor, area_m2, built_area_m2, total_area_m2, land_area_m2, price, sale_price, rent_price, condo_fee, iptu_amount, other_fees, accepts_financing, accepts_trade, is_furnished, furnishing_status, floor_type, sun_position, construction_type, finish_standard, property_age_years, features, infrastructure, security_items, nearby_points, distance_to_center_km, key_available, is_occupied, documentation_status, has_deed, has_registration, registry_number, technical_details, documentation, broker_notes",
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
    .select("whatsapp_number, display_name, profiles(whatsapp_number)")
    .eq("id", brokerId)
    .maybeSingle();

  const rawBrokerPhone =
    broker?.whatsapp_number ||
    (broker as unknown as { profiles?: { whatsapp_number?: string } })?.profiles?.whatsapp_number ||
    null;
  const brokerPhone = sanitizeBrokerPhone(rawBrokerPhone ? String(rawBrokerPhone) : null);
  const brokerName = broker?.display_name ? String(broker.display_name) : null;
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
      kind: "main_menu",
      text: `${firstName ? `${firstName}, como` : "Como"} posso te ajudar agora:\n\n1 - Falar com o corretor sobre esse imovel\n2 - Ver imoveis semelhantes\n3 - Quero o contato do corretor`,
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
  flowGroup?: string,
  flowStep?: number,
) {
  const accountId = String(property.account_id);
  const propertyId = String(property.id);
  const group = flowGroup ?? crypto.randomUUID();
  const step = flowStep ?? 1;

  await queueOutbound(supabase, {
    account_id: accountId,
    property_id: propertyId,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: {
      kind: "main_menu",
      text: `${firstName}, como posso te ajudar agora:\n\n1 - Falar com o corretor sobre esse imovel\n2 - Ver imoveis semelhantes\n3 - Quero o contato do corretor`,
    },
    flow_group: group,
    flow_step: step,
  });
}

function isQrPackCustomerMessage(row: Record<string, unknown>): boolean {
  const payload = asRecord(row.payload) ?? {};
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  return (
    row.message_type !== "system" &&
    payload.to_broker !== true &&
    (kind === "lead_intro" ||
      kind === "property_summary" ||
      kind === "property_image" ||
      kind === "main_menu" ||
      kind.startsWith("menu_option_"))
  );
}

async function countRecentQrPackCustomerMessages(
  supabase: ReturnType<typeof createClient>,
  leadPhone: string,
  propertyId: string,
  activeOnly = false,
): Promise<number> {
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id, message_type, payload")
    .eq("lead_phone", leadPhone)
    .eq("property_id", propertyId)
    .eq("direction", "outbound")
    .in("status", activeOnly ? ["queued", "processing"] : ["queued", "processing", "sent"])
    .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
    .limit(100);

  if (error) {
    console.error("[bot] recent QR pack count failed", {
      leadPhone,
      propertyId,
      error: error.message,
    });
    return 0;
  }

  return (data ?? []).filter((row: Record<string, unknown>) => isQrPackCustomerMessage(row)).length;
}

async function countVisibleCustomerOutboundMessages(
  supabase: ReturnType<typeof createClient>,
  leadPhone: string,
  sinceIso: string,
  activeOnly = false,
): Promise<number> {
  let query = supabase
    .from("whatsapp_messages")
    .select("id, message_type, payload")
    .eq("lead_phone", leadPhone)
    .eq("direction", "outbound")
    .in("status", activeOnly ? ["queued", "processing"] : ["queued", "processing", "sent"])
    .gte("created_at", sinceIso)
    .limit(100);

  const { data, error } = await query;
  if (error) {
    console.error("[anti-silence] visible outbound count failed", {
      leadPhone,
      error: error.message,
    });
    return 0;
  }

  return (data ?? []).filter((row: Record<string, unknown>) => {
    const payload = asRecord(row.payload) ?? {};
    return row.message_type !== "system" && payload.to_broker !== true;
  }).length;
}

async function queueCustomerFallback(
  supabase: ReturnType<typeof createClient>,
  leadPhone: string,
  propertyId: string | null,
  accountId: string | null,
  brokerPhone: string | null,
  reason: string,
): Promise<boolean> {
  const { error } = await supabase.from("whatsapp_messages").insert({
    direction: "outbound",
    provider: "uazapi",
    account_id: accountId,
    property_id: propertyId,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    status: "queued",
    payload: {
      kind: "error_fallback",
      text: TECHNICAL_FALLBACK_TEXT,
      silent_guard: true,
      reason,
    },
  });

  if (error) {
    console.error("[anti-silence] fallback enqueue failed", {
      leadPhone,
      propertyId,
      reason,
      error: error.message,
    });
    return false;
  }

  return true;
}

async function ensureCustomerResponseQueued(
  supabase: ReturnType<typeof createClient>,
  input: {
    leadPhone: string;
    sinceIso: string;
    propertyId: string | null;
    accountId: string | null;
    brokerPhone: string | null;
    context: string;
  },
): Promise<void> {
  const visibleCount = await countVisibleCustomerOutboundMessages(
    supabase,
    input.leadPhone,
    input.sinceIso,
  );
  if (visibleCount > 0) return;

  const fallbackQueued = await queueCustomerFallback(
    supabase,
    input.leadPhone,
    input.propertyId,
    input.accountId,
    input.brokerPhone,
    input.context,
  );
  throw new SilentResponseError(`silent_response_blocked:${input.context}`, fallbackQueued);
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
  const { data: sessionCursor } = await supabase
    .from("conversation_sessions")
    .select("similar_shown_property_ids, similar_page_number")
    .eq("id", sessionId)
    .maybeSingle();

  const shownIds = Array.isArray(sessionCursor?.similar_shown_property_ids)
    ? (sessionCursor.similar_shown_property_ids as string[])
    : [];
  const pageNumber =
    typeof sessionCursor?.similar_page_number === "number" ? sessionCursor.similar_page_number : 0;

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

  const excludedIds = Array.from(new Set([String(property.id), ...shownIds]));
  const { data: ranked, error: rankedError } = await supabase.rpc(
    "recommend_similar_properties_for_bot",
    {
      origin_property_id: property.id,
      limit_count: 5,
      excluded_property_ids: excludedIds,
    },
  );

  if (rankedError) {
    console.error("recommend_similar_properties_for_bot failed", rankedError.message);
    return json({ ok: false, error: "similar_search_failed" }, 500);
  }

  const rows = (ranked ?? []) as { id: string; score: number; source: string }[];
  const ids = rows.map((r) => r.id);
  const scoreById = new Map(rows.map((r) => [r.id, Number(r.score)]));
  const sourceById = new Map(rows.map((r) => [r.id, String(r.source)]));

  if (!ids.length) {
    await queueOutbound(supabase, {
      account_id: String(property.account_id),
      property_id: String(property.id),
      lead_phone: leadPhone,
      broker_phone: brokerPhone,
      message_type: "text",
      payload: {
        kind: "similar_empty",
        text: `${firstName}, nao encontramos imoveis semelhantes no momento.`,
      },
    });
    await sendMainMenu(supabase, property, leadPhone, brokerPhone, firstName);
    await supabase
      .from("conversation_sessions")
      .update({
        state: "awaiting_main_choice",
        last_menu: "main_menu_post_similar",
        last_recommended_properties: [],
      })
      .eq("id", sessionId);
    return json({ ok: true, state: "no_similar_back_to_menu" });
  }

  const { data: props } = await supabase
    .from("properties")
    .select(
      "id, public_id, internal_code, broker_id, account_id, listing_status, expires_at, title, description, full_description, highlights, property_type, property_subtype, purpose, city, state, neighborhood, city_region, full_address, street_number, address_complement, postal_code, latitude, longitude, bedrooms, suites, bathrooms, parking_spaces, living_rooms, floors_count, unit_floor, area_m2, built_area_m2, total_area_m2, land_area_m2, price, sale_price, rent_price, condo_fee, iptu_amount, other_fees, accepts_financing, accepts_trade, is_furnished, furnishing_status, floor_type, sun_position, construction_type, finish_standard, property_age_years, features, infrastructure, security_items, nearby_points, distance_to_center_km, key_available, is_occupied, documentation_status, has_deed, has_registration, registry_number, technical_details, documentation, broker_notes",
    )
    .in("id", ids);

  const { data: mediaRows } = await supabase
    .from("property_media")
    .select("property_id, storage_path")
    .in("property_id", ids)
    .neq("status", "deleted")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const byId = new Map((props ?? []).map((p: Record<string, unknown>) => [p.id, p]));
  const mediaByPropertyId = new Map<string, Array<{ storage_path: string }>>();
  for (const media of mediaRows ?? []) {
    const propertyId = String(media.property_id);
    const current = mediaByPropertyId.get(propertyId) ?? [];
    current.push({ storage_path: String(media.storage_path) });
    mediaByPropertyId.set(propertyId, current);
  }

  const flowGroup = crypto.randomUUID();
  let flowStep = 1;
  const page = pageNumber + 1;

  console.log("similar_properties_batch", {
    count: ids.length,
    page,
  });

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const p = byId.get(id);
    if (!p) continue;
    const text = stripUrlsFromText(summarizeProperty(p));
    const mediaForProperty = (mediaByPropertyId.get(id) ?? []).slice(0, 15);

    console.log("similar_property_content_queued", {
      property_id: id,
      public_id: p.public_id,
      score: scoreById.get(id) ?? null,
      source: sourceById.get(id) ?? null,
      media_found: mediaByPropertyId.get(id)?.length ?? 0,
      media_limited_to: mediaForProperty.length,
      page,
    });

    await queueOutbound(supabase, {
      account_id: String(property.account_id),
      property_id: String(p.id),
      lead_phone: leadPhone,
      broker_phone: brokerPhone,
      message_type: "text",
      payload: {
        kind: "similar_item",
        text,
        score: scoreById.get(id) ?? null,
        source: sourceById.get(id) ?? null,
        page,
      },
      flow_group: flowGroup,
      flow_step: flowStep++,
    });

    let photosQueued = 0;
    for (const media of mediaForProperty) {
      const { data: signed, error: signedError } = await supabase.storage
        .from("property-media")
        .createSignedUrl(String(media.storage_path), 60 * 60);

      if (signedError || !signed?.signedUrl) {
        console.error("similar_property_image_signed_url_failed", {
          property_id: id,
          public_id: p.public_id,
          storage_path: String(media.storage_path),
          error: signedError?.message ?? "missing_signed_url",
        });
        continue;
      }

      await queueOutbound(supabase, {
        account_id: String(property.account_id),
        property_id: String(p.id),
        lead_phone: leadPhone,
        broker_phone: brokerPhone,
        message_type: "image",
        payload: {
          kind: "similar_property_image",
          image_url: signed.signedUrl,
          score: scoreById.get(id) ?? null,
          source: sourceById.get(id) ?? null,
          page,
        },
        flow_group: flowGroup,
        flow_step: flowStep++,
      });
      photosQueued += 1;
    }

    if (photosQueued === 0) {
      await queueOutbound(supabase, {
        account_id: String(property.account_id),
        property_id: String(p.id),
        lead_phone: leadPhone,
        broker_phone: brokerPhone,
        message_type: "text",
        payload: {
          kind: "similar_no_images",
          text: "Fotos indisponiveis no momento.",
          score: scoreById.get(id) ?? null,
          source: sourceById.get(id) ?? null,
          page,
        },
        flow_group: flowGroup,
        flow_step: flowStep++,
      });
    }
  }

  await sendMainMenu(supabase, property, leadPhone, brokerPhone, firstName, flowGroup, flowStep++);

  const nextShownIds = Array.from(new Set([...shownIds, ...ids]));
  await supabase
    .from("conversation_sessions")
    .update({
      state: "awaiting_post_similar_choice",
      last_menu: "post_similar",
      last_recommended_properties: ids,
      similar_shown_property_ids: nextShownIds,
      similar_page_number: page,
    })
    .eq("id", sessionId);

  return json({
    ok: true,
    state: "similar_shown",
    count: ids.length,
    page,
    min_score: Math.min(...ids.map((id) => scoreById.get(id) ?? 0)),
    max_score: Math.max(...ids.map((id) => scoreById.get(id) ?? 0)),
  });
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
  options: { postListingFlow?: boolean } = {},
): Promise<void> {
  const originProperty = await loadOriginPropertyForSession(supabase, sessionId);
  const originBrokerId = fmt(originProperty?.broker_id) || String(property.broker_id);
  const originAccountId = fmt(originProperty?.account_id) || String(property.account_id);
  const listingOwnerBrokerId = String(property.broker_id);
  const isPostListingFlow =
    options.postListingFlow === true || lastMenu === "main_menu_post_similar";
  const flowGroup = isPostListingFlow ? crypto.randomUUID() : null;
  let flowStep = 1;
  const originBrokerContact = isPostListingFlow
    ? await loadBrokerContact(supabase, originBrokerId)
    : { name: null, phone: brokerPhone };
  const notificationBrokerPhone = isPostListingFlow
    ? (originBrokerContact.phone ?? brokerPhone)
    : brokerPhone;
  const isGeneralStockOwner =
    Boolean(originBrokerId) &&
    Boolean(listingOwnerBrokerId) &&
    originBrokerId !== listingOwnerBrokerId;

  console.log("option1_routing_decided", {
    scenario: isGeneralStockOwner ? "B" : "A",
    captador_broker_id: originBrokerId,
    listing_owner_broker_id: listingOwnerBrokerId,
    property_id: property.id,
  });

  const registeredLead = await upsertLead(supabase, {
    propertyId: String(property.id),
    brokerId: originBrokerId,
    leadPhone,
    text: interactionText,
    profileName,
    informedName: null,
    intent: "visit_interest",
    interactionType: "visit_interest",
    forceNameUpdate: false,
  });
  const leadForMessage = registeredLead ?? lead;

  await queueOutbound(supabase, {
    account_id: String(property.account_id),
    property_id: String(property.id),
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: {
      kind: "visit_registered",
      text: `${firstName}, combinado! Ja registrei seu pedido de visita. O corretor vai falar com voce em instantes.`,
      lead_id: leadForMessage?.id ?? null,
    },
    flow_group: flowGroup,
    flow_step: flowGroup ? flowStep++ : null,
  });

  if (notificationBrokerPhone) {
    const ownerContact = isGeneralStockOwner
      ? await loadBrokerContact(supabase, listingOwnerBrokerId)
      : { name: null, phone: null };
    const ownerName = ownerContact.name ?? "Corretor do anuncio";
    const ownerPhone = ownerContact.phone ?? "Numero nao cadastrado";
    const notificationText = isGeneralStockOwner
      ? [
          "Alerta de novo lead para visita.",
          `Nome do lead: ${leadForMessage?.nome_completo || firstName}`,
          `Telefone do lead: ${leadPhone}`,
          `ID do imovel escolhido: ${property.public_id}`,
          `Dono do anuncio: ${ownerName}`,
          `Contato do dono do anuncio: ${ownerPhone}`,
        ].join("\n")
      : `Novo lead para visita no imovel ${property.public_id}. Cliente: ${leadPhone}. Nome: ${leadForMessage?.nome_completo || firstName}.`;

    await queueOutbound(supabase, {
      account_id: originAccountId,
      property_id: String(property.id),
      lead_phone: leadPhone,
      broker_phone: notificationBrokerPhone,
      message_type: "text",
      payload: {
        kind: "broker_notification",
        to_broker: true,
        scenario: isGeneralStockOwner ? "B" : "A",
        listing_owner_broker_id: isGeneralStockOwner ? listingOwnerBrokerId : null,
        listing_owner_name: isGeneralStockOwner ? ownerName : null,
        listing_owner_phone: isGeneralStockOwner ? ownerPhone : null,
        text: notificationText,
      },
      flow_group: flowGroup,
      flow_step: flowGroup ? flowStep++ : null,
    });
    console.log("option1_notification_sent", {
      scenario: isGeneralStockOwner ? "B" : "A",
      captador_broker_id: originBrokerId,
      listing_owner_broker_id: listingOwnerBrokerId,
      property_id: property.id,
    });
  }

  // Re-mostra o menu: cliente pode ainda escolher opção 2 ou 3
  await sendMainMenu(
    supabase,
    property,
    leadPhone,
    brokerPhone,
    firstName,
    flowGroup ?? undefined,
    flowGroup ? flowStep++ : undefined,
  );
  await supabase
    .from("conversation_sessions")
    .update({
      state: "awaiting_main_choice",
      current_property_id: String(property.id),
      last_menu: isPostListingFlow ? "main_menu_post_similar" : (lastMenu ?? "main_menu"),
      last_recommended_properties: [],
      similar_shown_property_ids: [],
      similar_page_number: 0,
      target_property_id: null,
    })
    .eq("id", sessionId);
}

async function handlePostSimilarPropertyId(
  input: {
    supabase: ReturnType<typeof createClient>;
    session: Record<string, unknown>;
    property: Record<string, unknown>;
    lead: LeadSnapshot | null;
    leadPhone: string;
    brokerPhone: string | null;
    firstName: string;
    profileName: string | null;
    text: string;
  },
): Promise<Response> {
  const {
    supabase,
    session,
    property,
    lead,
    leadPhone,
    brokerPhone,
    firstName,
    profileName,
    text,
  } = input;
  const recommended = Array.isArray(session.last_recommended_properties)
    ? (session.last_recommended_properties as string[])
    : [];
  const shown = Array.isArray(session.similar_shown_property_ids)
    ? (session.similar_shown_property_ids as string[])
    : [];

  console.log("option1_property_id_received", {
    has_typed_property_id: Boolean(text.trim()),
    recommended_count: recommended.length,
    shown_count: shown.length,
  });

  const targetProp = await resolveRecommendedProperty(supabase, text, recommended, shown);
  if (targetProp) {
    const targetId = String(targetProp.id);
    const hasName =
      lead?.nome_validado ||
      profileName != null ||
      (lead?.nome_completo && !isGenericName(lead.nome_completo));

    if (hasName) {
      await supabase
        .from("conversation_sessions")
        .update({ target_property_id: targetId, last_menu: "main_menu_post_similar" })
        .eq("id", session.id);
      await doRegisterVisit(
        supabase,
        targetProp,
        lead,
        leadPhone,
        brokerPhone,
        firstName,
        String(session.id),
        "main_menu_post_similar",
        profileName,
        `Interesse em visita ao imovel ${targetProp.public_id}`,
        { postListingFlow: true },
      );
    } else {
      const confirmName =
        profileName ??
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
          .update({
            state: "awaiting_name_confirmation",
            last_menu: "main_menu_post_similar",
            target_property_id: targetId,
          })
          .eq("id", session.id);
        return json({ ok: true, state: "awaiting_name_confirmation" });
      }

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
        .update({
          state: "awaiting_name_input",
          last_menu: "main_menu_post_similar",
          target_property_id: targetId,
        })
        .eq("id", session.id);
      return json({ ok: true, state: "awaiting_name_input" });
    }

    return json({ ok: true, state: "visit_registered" });
  }

  console.log("option1_property_not_found", {
    has_typed_property_id: Boolean(text.trim()),
  });
  await queueOutbound(supabase, {
    account_id: property.account_id,
    property_id: property.id,
    lead_phone: leadPhone,
    broker_phone: brokerPhone,
    message_type: "text",
    payload: {
      kind: "ask_property_id_retry",
      text: `Nao encontrei esse imovel. Por favor, informe novamente o ID do imovel.`,
    },
  });
  await supabase
    .from("conversation_sessions")
    .update({
      state: "awaiting_visit_property_id",
      last_menu: "main_menu_post_similar",
      last_recommended_properties: recommended,
      similar_shown_property_ids: shown,
      target_property_id: null,
    })
    .eq("id", session.id);
  return json({ ok: true, state: "awaiting_visit_property_id" });
}

function isStagingTypingTargetAllowed(leadPhone: string): boolean {
  const runtimeEnvironment = Deno.env.get("BOT_RUNTIME_ENVIRONMENT");
  if (runtimeEnvironment === "production") return true;
  if (runtimeEnvironment !== "staging") return false;

  const allowedPhones = new Set(
    String(Deno.env.get("BOT_STAGING_ALLOWED_PHONES") ?? "")
      .split(",")
      .map((phone) => normalizePhone(phone))
      .filter(Boolean),
  );
  return allowedPhones.has(normalizePhone(leadPhone));
}

async function sendTypingPresenceNow(
  leadPhone: string,
  presence: "composing" | "paused",
): Promise<void> {
  if (!isStagingTypingTargetAllowed(leadPhone)) {
    console.warn("[typing] skipped - staging target not allowlisted", { presence });
    return;
  }

  const baseUrl = Deno.env.get("UAZAPI_BASE_URL") ?? "";
  const token = Deno.env.get("UAZAPI_TOKEN") ?? Deno.env.get("UAZAPI_INSTANCE_TOKEN") ?? null;
  const endpoint = Deno.env.get("UAZAPI_TYPING_ENDPOINT") ?? "";
  if (!baseUrl || !endpoint) {
    console.warn("[typing] skipped - baseUrl or endpoint not configured", { presence });
    return;
  }

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["token"] = token;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ number: leadPhone, presence }),
    });
    console.log("[typing]", presence, {
      status: res.status,
    });
  } catch (err) {
    console.error("[typing] error", {
      presence,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

async function sendTypingNow(leadPhone: string): Promise<void> {
  return sendTypingPresenceNow(leadPhone, "composing");
}

async function cancelTypingNow(leadPhone: string): Promise<void> {
  return sendTypingPresenceNow(leadPhone, "paused");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Tracks whether "composing" was sent so we can cancel on errors
  let _typingPhone: string | null = null;
  // Rastreamento de etapa para bot_interactions (observabilidade)
  let _supabase: ReturnType<typeof createClient> | null = null;
  let _interactionId: string | null = null;
  let _interactionStep = "session_loaded";
  let _interactionError: string | undefined;
  let _startingStepId: string | null = null; // step_id de conversation_starting (vem do webhook-inbound)
  let _currentStepId: string | null = null; // step_id da etapa em curso

  try {
    const body = (await req.json()) as InboundInput;
    const leadPhone = normalizePhone(String(body.lead_phone ?? ""));
    const text = String(body.text ?? "").trim();
    const customerResponseStartedAt = new Date().toISOString();
    _interactionId = body.interaction_id ?? null;
    _startingStepId = body.starting_step_id ?? null;

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
    _supabase = supabase;

    // Fechar conversation_starting → complete (chegamos ao handler com sucesso)
    completeStep(supabase, _startingStepId, "complete");
    _startingStepId = null; // já fechado, não fechar de novo no finally

    // Iniciar session_loaded → pending
    _currentStepId = await logStep(supabase, _interactionId, "session_loaded");

    const parsedQrToken = parseQrToken(text);

    const { data: session } = await supabase
      .from("conversation_sessions")
      .select(
        "id, state, origin_property_id, current_property_id, last_menu, last_recommended_properties, similar_shown_property_ids, similar_page_number, target_property_id, updated_at",
      )
      .eq("lead_phone", leadPhone)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const conversationIntent = classifyConversationIntent(
      session?.state ? String(session.state) : null,
      text,
      parsedQrToken,
    );
    const qrToken =
      conversationIntent === "visit_property_id" ||
      conversationIntent === "post_similar_property_id"
        ? null
        : parsedQrToken;

    // Para mensagens sem QR: verificar sessão antes de disparar "digitando"
    if (!qrToken) {
      if (!session?.id || !session.origin_property_id) {
        await queuePropertyCodePrompt(supabase, leadPhone);
        return json({ ok: true, state: "awaiting_property_code" });
      }
      if (session.state === "closed") {
        await queuePropertyCodePrompt(supabase, leadPhone);
        return json({ ok: true, state: "awaiting_property_code" });
      }
      const lastUpdate = session.updated_at ? new Date(String(session.updated_at)).getTime() : 0;
      if (Date.now() - lastUpdate > ACTIVE_SESSION_TIMEOUT_MS) {
        await queuePropertyCodePrompt(supabase, leadPhone);
        return json({ ok: true, state: "awaiting_property_code" });
      }
    }

    // Dispara "digitando" apenas para sessões ativas ou novo scan de QR
    console.log("[bot] processing message", {
      leadPhone,
      hasQrToken: Boolean(qrToken),
      conversationIntent,
    });
    await sendTypingNow(leadPhone);
    _typingPhone = leadPhone;
    if (qrToken) {
      // session_loaded → complete; property_resolving → pending
      completeStep(supabase, _currentStepId, "complete");
      _currentStepId = await logStep(supabase, _interactionId, "property_resolving");

      const property =
        (await loadPropertyByQr(supabase, qrToken)) ??
        (await loadPropertyByPublicId(supabase, qrToken));
      if (!property) {
        console.log("[bot] qr_not_found - canceling typing", { qrToken });
        _interactionStep = "error_no_property";
        completeStep(supabase, _currentStepId, "failed", "property_not_found");
        _currentStepId = null;
        await cancelTypingNow(leadPhone);
        await queuePropertyCodePrompt(supabase, leadPhone);
        return json({ ok: true, state: "property_code_not_found" });
      }

      const propertyId = String(property.id);
      const brokerId = String(property.broker_id);

      // Fix A - Session dedup: se a sessão já está em awaiting_main_choice para este imóvel
      // e foi atualizada nos últimos 5 min, o pack já foi enviado - evita duplicatas por webhook retry
      if (
        session?.id &&
        session.state === "awaiting_main_choice" &&
        String(session.current_property_id) === propertyId
      ) {
        const sessionAgeMs = session.updated_at
          ? Date.now() - new Date(String(session.updated_at)).getTime()
          : Infinity;
        if (sessionAgeMs < 5 * 60_000) {
          console.log("[bot] session dedup - pack já enviado recentemente", {
            leadPhone,
            propertyId,
            sessionAgeMs: Math.round(sessionAgeMs / 1000) + "s",
          });
          await cancelTypingNow(leadPhone);
          const activeOutbound = await countVisibleCustomerOutboundMessages(
            supabase,
            leadPhone,
            new Date(Date.now() - CUSTOMER_RESPONSE_WINDOW_MS).toISOString(),
            true,
          );
          if (activeOutbound > 0) {
            return json({ ok: true, state: "pack_already_queued" });
          }

          const firstName = pickGreetingName(null, profileName) ?? "Olá";
          await sendMainMenu(supabase, property, leadPhone, null, firstName);
          await ensureCustomerResponseQueued(supabase, {
            leadPhone,
            sinceIso: customerResponseStartedAt,
            propertyId,
            accountId: String(property.account_id),
            brokerPhone: null,
            context: "qr_session_dedup_menu_resent",
          });
          return json({ ok: true, state: "main_menu_resent_session_dedup" });
        }
      }

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
            last_recommended_properties: [],
            similar_shown_property_ids: [],
            similar_page_number: 0,
            target_property_id: null,
          })
          .eq("id", session.id);
      } else {
        await supabase.from("conversation_sessions").insert({
          lead_phone: leadPhone,
          origin_property_id: propertyId,
          current_property_id: propertyId,
          state: "awaiting_main_choice",
          last_menu: "main_menu",
          last_recommended_properties: [],
          similar_shown_property_ids: [],
          similar_page_number: 0,
          target_property_id: null,
        });
      }

      const firstName = pickGreetingName(lead, profileName) ?? "Olá";

      // Fix B - Guard de timestamp: skip se já existe pacote visivel recente do QR
      // (belt-and-suspenders em relação ao session dedup acima)
      const recentOutbound = await countRecentQrPackCustomerMessages(
        supabase,
        leadPhone,
        propertyId,
        false,
      );

      if (recentOutbound > 0) {
        const activeOutbound = await countRecentQrPackCustomerMessages(
          supabase,
          leadPhone,
          propertyId,
          true,
        );
        if (activeOutbound > 0) {
          console.log("[bot] pack_already_queued - dispatch will handle existing messages", {
            leadPhone,
            propertyId,
            activeOutbound,
          });
          return json({ ok: true, state: "pack_already_queued" });
        }

        console.log("[bot] recent pack already sent - requeueing main menu", {
          leadPhone,
          propertyId,
        });
        await sendMainMenu(supabase, property, leadPhone, null, firstName);
        await ensureCustomerResponseQueued(supabase, {
          leadPhone,
          sinceIso: customerResponseStartedAt,
          propertyId,
          accountId: String(property.account_id),
          brokerPhone: null,
          context: "qr_recent_pack_menu_resent",
        });
        return json({ ok: true, state: "main_menu_resent_recent_pack" });
      }

      _interactionStep = "property_resolved";
      // property_resolving → complete; response_queuing → pending
      completeStep(supabase, _currentStepId, "complete");
      _currentStepId = await logStep(supabase, _interactionId, "response_queuing");
      try {
        console.log("[bot] queuing property pack", { propertyId, leadPhone });
        await sendPropertyPack(supabase, property, leadPhone, lead, profileName);
        console.log("[bot] property pack queued OK", { propertyId, leadPhone });
        _interactionStep = "response_queued";
        // response_queuing → complete
        completeStep(supabase, _currentStepId, "complete");
        _currentStepId = null;
      } catch (packErr) {
        const packMsg = packErr instanceof Error ? packErr.message : String(packErr);
        console.error("[bot] sendPropertyPack failed - queuing fallback", {
          propertyId,
          leadPhone,
          error: packMsg,
        });
        const { data: broker } = await supabase
          .from("brokers")
          .select("whatsapp_number")
          .eq("id", String(property.broker_id))
          .maybeSingle();
        await supabase.from("whatsapp_messages").insert({
          direction: "outbound",
          provider: "uazapi",
          account_id: String(property.account_id),
          property_id: propertyId,
          lead_phone: leadPhone,
          broker_phone: sanitizeBrokerPhone(
            broker?.whatsapp_number ? String(broker.whatsapp_number) : null,
          ),
          message_type: "text",
          status: "queued",
          payload: {
            kind: "error_fallback",
            text: "Desculpe, tivemos um problema ao carregar os detalhes do imovel. Tente novamente em instantes.",
          },
        });
      }
      await ensureCustomerResponseQueued(supabase, {
        leadPhone,
        sinceIso: customerResponseStartedAt,
        propertyId,
        accountId: String(property.account_id),
        brokerPhone: null,
        context: "qr_entry_property_pack",
      });
      _interactionStep = "response_queued";
      return json({ ok: true, state: "started", property_id: propertyId });
    } // fim if (qrToken)

    if (!session?.id || !session.origin_property_id) {
      return json({ ok: true, state: "ignored_without_session" });
    }

    // follow-up: session_loaded → complete; property_resolving → pending
    completeStep(supabase, _currentStepId, "complete");
    _currentStepId = await logStep(supabase, _interactionId, "property_resolving");

    const sessionPropertyId = fmt(session.current_property_id) || fmt(session.origin_property_id);
    const { data: property } = await supabase
      .from("properties")
      .select("id, public_id, broker_id, account_id")
      .eq("id", sessionPropertyId)
      .maybeSingle();

    if (!property) {
      console.error("[bot] property_not_found for session", {
        sessionId: session.id,
        propertyId: sessionPropertyId,
      });
      _interactionStep = "error_no_property";
      completeStep(supabase, _currentStepId, "failed", "property_not_found_in_session");
      _currentStepId = null;
      return json({ ok: false, error: "property_not_found" }, 400);
    }
    _interactionStep = "property_resolved";
    // property_resolving → complete; response_queuing → pending
    completeStep(supabase, _currentStepId, "complete");
    _currentStepId = await logStep(supabase, _interactionId, "response_queuing");
    console.log("[bot] processing follow-up", {
      leadPhone,
      sessionState: session.state,
      propertyId: property.id,
    });

    const { data: broker } = await supabase
      .from("brokers")
      .select("whatsapp_number, display_name, profiles(whatsapp_number)")
      .eq("id", property.broker_id)
      .maybeSingle();

    const rawBrokerPhone2 =
      broker?.whatsapp_number ||
      (broker as unknown as { profiles?: { whatsapp_number?: string } })?.profiles
        ?.whatsapp_number ||
      null;
    const brokerPhone = sanitizeBrokerPhone(rawBrokerPhone2 ? String(rawBrokerPhone2) : null);
    const brokerName = broker?.display_name ? String(broker.display_name) : null;

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
          const confirmName =
            profileName ??
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
          supabase,
          property,
          lead,
          leadPhone,
          brokerPhone,
          firstName,
          session.id,
          session.last_menu,
          profileName,
          `Interesse em visita: ${text}`,
        );
        return json({ ok: true, state: "visit_registered" });
      }

      if (matchChoice2(text)) {
        return await handleShowSimilarProperties(
          supabase,
          property,
          lead,
          leadPhone,
          brokerPhone,
          firstName,
          profileName,
          informedName,
          session.id,
        );
      }

      if (matchChoice3(text)) {
        const leadOriginBroker = await loadLeadOriginBrokerContact(
          supabase,
          session.id,
          fmt(property.broker_id),
          brokerName,
          brokerPhone,
        );
        const contact = leadOriginBroker.phone ?? "Numero nao cadastrado ainda";
        const name = leadOriginBroker.name ?? "Corretor";
        const choiceGroup = crypto.randomUUID();
        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: leadOriginBroker.brokerPhone,
          message_type: "text",
          payload: {
            kind: "broker_contact",
            text: `Aqui esta o contato do corretor responsavel pelo seu atendimento:\nNome: ${name}\nWhatsApp: ${contact}`,
          },
          flow_group: choiceGroup,
          flow_step: 1,
        });
        // Mantém sessão aberta para o cliente ainda poder escolher 1 ou 2
        await sendMainMenu(
          supabase,
          property,
          leadPhone,
          leadOriginBroker.brokerPhone,
          firstName,
          choiceGroup,
          2,
        );
        return json({ ok: true, state: "broker_contact_sent" });
      }
    }

    if (session.state === "awaiting_recommendation_choice") {
      if (matchChoice1(text)) {
        return await handleShowSimilarProperties(
          supabase,
          property,
          lead,
          leadPhone,
          brokerPhone,
          firstName,
          profileName,
          informedName,
          session.id,
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
            text: `${firstName}, perfeito. Quando quiser, e so me chamar por aqui que continuamos.`,
          },
        });

        await supabase
          .from("conversation_sessions")
          .update({ state: "closed" })
          .eq("id", session.id);
        return json({ ok: true, state: "closed" });
      }
    }

    if (session.state === "awaiting_post_similar_choice") {
      if (matchChoice1(text)) {
        const recommended = Array.isArray(session.last_recommended_properties)
          ? (session.last_recommended_properties as string[])
          : [];
        const shown = Array.isArray(session.similar_shown_property_ids)
          ? (session.similar_shown_property_ids as string[])
          : recommended;
        const count = recommended.length;

        console.log("option1_selected_in_multi_property_context", {
          captador_broker_id: property.broker_id,
          source: "similar_or_general_stock",
          count,
          shown_count: shown.length,
        });

        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: brokerPhone,
          message_type: "text",
          payload: {
            kind: "ask_property_id",
            text: `Qual o ID do imovel sobre o qual voce deseja falar?`,
          },
        });
        await supabase
          .from("conversation_sessions")
          .update({
            state: "awaiting_visit_property_id",
            last_menu: "main_menu_post_similar",
            last_recommended_properties: recommended,
            similar_shown_property_ids: shown,
            target_property_id: null,
          })
          .eq("id", session.id);
        return json({ ok: true, state: "awaiting_visit_property_id" });
      }

      if (matchChoice2(text)) {
        return await handleShowSimilarProperties(
          supabase,
          property,
          lead,
          leadPhone,
          brokerPhone,
          firstName,
          profileName,
          informedName,
          session.id,
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
        await supabase
          .from("conversation_sessions")
          .update({ state: "closed" })
          .eq("id", session.id);
        return json({ ok: true, state: "closed" });
      }

      if (matchChoice3(text)) {
        const leadOriginBroker = await loadLeadOriginBrokerContact(
          supabase,
          session.id,
          fmt(property.broker_id),
          brokerName,
          brokerPhone,
        );
        const contact = leadOriginBroker.phone ?? "Numero nao cadastrado ainda";
        const name = leadOriginBroker.name ?? "Corretor";
        const choiceGroup2 = crypto.randomUUID();
        await queueOutbound(supabase, {
          account_id: property.account_id,
          property_id: property.id,
          lead_phone: leadPhone,
          broker_phone: leadOriginBroker.brokerPhone,
          message_type: "text",
          payload: {
            kind: "broker_contact",
            text: `Aqui esta o contato do corretor responsavel pelo seu atendimento:\nNome: ${name}\nWhatsApp: ${contact}`,
          },
          flow_group: choiceGroup2,
          flow_step: 1,
        });
        await sendMainMenu(
          supabase,
          property,
          leadPhone,
          leadOriginBroker.brokerPhone,
          firstName,
          choiceGroup2,
          2,
        );
        return json({ ok: true, state: "broker_contact_sent" });
      }

      console.log("option1_direct_property_id_in_multi_property_context", {
        has_typed_property_id: Boolean(text.trim()),
        conversation_intent: conversationIntent,
      });
      return await handlePostSimilarPropertyId({
        supabase,
        session,
        property,
        lead,
        leadPhone,
        brokerPhone,
        firstName,
        profileName,
        text,
      });
    }

    if (session.state === "awaiting_visit_property_id") {
      return await handlePostSimilarPropertyId({
        supabase,
        session,
        property,
        lead,
        leadPhone,
        brokerPhone,
        firstName,
        profileName,
        text,
      });
    }

    if (session.state === "awaiting_name_confirmation") {
      const visitProperty = session.target_property_id
        ? ((
            await supabase
              .from("properties")
              .select("id, public_id, broker_id, account_id")
              .eq("id", session.target_property_id)
              .maybeSingle()
          ).data ?? property)
        : property;
      const visitLastMenu = session.target_property_id
        ? "main_menu_post_similar"
        : session.last_menu;
      const visitOriginProperty = await loadOriginPropertyForSession(supabase, session.id);
      const visitBrokerId = fmt(visitOriginProperty?.broker_id) || String(visitProperty.broker_id);
      const confirmName =
        profileName ??
        (lead?.nome_completo && !isGenericName(lead.nome_completo) ? lead.nome_completo : null);

      if (matchChoice1(text)) {
        if (confirmName) {
          const updatedLead = await upsertLead(supabase, {
            propertyId: String(visitProperty.id),
            brokerId: visitBrokerId,
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
            supabase,
            visitProperty,
            updatedLead ?? lead,
            leadPhone,
            brokerPhone,
            confirmedFirstName,
            session.id,
            visitLastMenu,
            profileName,
            `Visita apos confirmacao de nome`,
            { postListingFlow: visitLastMenu === "main_menu_post_similar" },
          );
        } else {
          await doRegisterVisit(
            supabase,
            visitProperty,
            lead,
            leadPhone,
            brokerPhone,
            firstName,
            session.id,
            visitLastMenu,
            profileName,
            `Visita apos confirmacao de nome`,
            { postListingFlow: visitLastMenu === "main_menu_post_similar" },
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
        ? ((
            await supabase
              .from("properties")
              .select("id, public_id, broker_id, account_id")
              .eq("id", session.target_property_id)
              .maybeSingle()
          ).data ?? property)
        : property;
      const visitLastMenu = session.target_property_id
        ? "main_menu_post_similar"
        : session.last_menu;
      const visitOriginProperty = await loadOriginPropertyForSession(supabase, session.id);
      const visitBrokerId = fmt(visitOriginProperty?.broker_id) || String(visitProperty.broker_id);
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
        brokerId: visitBrokerId,
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
        supabase,
        visitProperty,
        updatedLead ?? lead,
        leadPhone,
        brokerPhone,
        newFirstName,
        session.id,
        visitLastMenu,
        profileName,
        `Visita apos coleta de nome`,
        { postListingFlow: visitLastMenu === "main_menu_post_similar" },
      );
      return json({ ok: true, state: "visit_registered_after_name_input" });
    }

    if (session.state === "closed") {
      return json({ ok: true, state: "ignored_closed_session" });
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
    if (e instanceof SilentResponseError) {
      console.error("[bot] anti-silence blocked silent success", {
        message,
        hadTypingPhone: Boolean(_typingPhone),
        fallbackQueued: e.fallbackQueued,
      });
      _interactionStep = "error_silent_response_blocked";
      _interactionError = message;
      if (_currentStepId && _supabase) {
        completeStep(_supabase, _currentStepId, "failed", message);
        _currentStepId = null;
      }
      if (_typingPhone) {
        await cancelTypingNow(_typingPhone).catch(() => {});
      }
      return json(
        {
          ok: false,
          error: "silent_response_blocked",
          fallback_queued: e.fallbackQueued,
          detail: message,
        },
        500,
      );
    }
    console.error("[bot] unexpected error", { message, hadTypingPhone: Boolean(_typingPhone) });
    _interactionStep = "error_conversation_failed";
    _interactionError = message;
    if (_typingPhone) {
      await cancelTypingNow(_typingPhone).catch(() => {});
    }
    return json({ ok: false, error: "unexpected", detail: message }, 500);
  } finally {
    // Fechar etapa em curso — fire-and-forget, nunca bloqueia a resposta
    if (_supabase && _currentStepId) {
      // Se não houve erro: a função completou normalmente → complete
      // Se houve erro: crash inesperado → failed
      _supabase
        .rpc("fn_complete_interaction_step", {
          p_step_id: _currentStepId,
          p_status: _interactionError ? "failed" : "complete",
          p_error: _interactionError ?? null,
        })
        .then(() => {})
        .catch(() => {});
    }
    // conversation_starting nunca foi fechado (crash antes do corpo do handler)
    if (_supabase && _startingStepId) {
      _supabase
        .rpc("fn_complete_interaction_step", {
          p_step_id: _startingStepId,
          p_status: _interactionError ? "failed" : "complete",
          p_error: _interactionError ?? null,
        })
        .then(() => {})
        .catch(() => {});
    }
    // Manter backward compat: atualizar current_step em bot_interactions
    if (_supabase && _interactionId) {
      _supabase
        .from("bot_interactions")
        .update({
          current_step: _interactionStep,
          ...(_interactionError ? { error_detail: _interactionError.slice(0, 500) } : {}),
        })
        .eq("id", _interactionId)
        .then(() => {})
        .catch(() => {});
    }
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
