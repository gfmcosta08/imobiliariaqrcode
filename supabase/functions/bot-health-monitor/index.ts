import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

type Supabase = ReturnType<typeof createClient>;

type InteractionRow = {
  id: string;
  lead_phone: string | null;
  inbound_text: string | null;
  webhook_event_id: string | null;
  current_step: string;
  error_detail: string | null;
  retry_count: number;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
};

type IncidentInput = {
  interaction_id?: string | null;
  source_step_id?: string | null;
  source_message_id?: string | null;
  source_webhook_event_id?: string | null;
  lead_phone?: string | null;
  property_id?: string | null;
  broker_id?: string | null;
  incident_type: string;
  severity: "info" | "warning" | "critical";
  details: Record<string, unknown>;
};

type IncidentRow = {
  id: string;
  interaction_id: string | null;
  source_step_id: string | null;
  source_message_id: string | null;
  source_webhook_event_id: string | null;
  lead_phone: string | null;
  property_id: string | null;
  broker_id: string | null;
  incident_type: string;
  severity: "info" | "warning" | "critical";
  status: string;
  details: Record<string, unknown>;
  admin_notified_at: string | null;
  broker_notified_at: string | null;
  auto_recovery_attempted_at: string | null;
};

type Context = {
  propertyId: string | null;
  propertyPublicId: string | null;
  propertyTitle: string | null;
  accountId: string | null;
  brokerId: string | null;
  brokerName: string | null;
  brokerPhone: string | null;
};

const DEFAULT_MONITOR_WINDOW_HOURS = 24;
const DEFAULT_STUCK_MINUTES = 2;
const FALLBACK_TEXT = "Desculpe, tivemos um problema tecnico. Tente novamente em instantes.";

function toInt(value: string | undefined | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

function maskPhone(value: string | null | undefined): string {
  const digits = normalizePhone(value) ?? "";
  if (digits.length <= 4) return "****";
  return `${"*".repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
}

function sanitizeBrokerPhone(value: string | null | undefined): string | null {
  if (!value || value.startsWith("pending-")) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

function authOk(req: Request): boolean {
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const authToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  return (
    (cronSecret.length > 0 && authToken === cronSecret) ||
    (serviceRoleKey.length > 0 && authToken === serviceRoleKey)
  );
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hasVisibleCustomerOutbound(
  supabase: Supabase,
  leadPhone: string,
  sinceIso: string,
  statuses = ["queued", "processing", "sent", "delivered"],
): Promise<boolean> {
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id, message_type, payload")
    .eq("lead_phone", leadPhone)
    .eq("direction", "outbound")
    .in("status", statuses)
    .gte("created_at", sinceIso)
    .limit(100);

  if (error) {
    console.error("[bot-health-monitor] visible outbound query failed", error.message);
    return false;
  }

  return (data ?? []).some((row: Record<string, unknown>) => {
    const payload = asRecord(row.payload) ?? {};
    return row.message_type !== "system" && payload.to_broker !== true;
  });
}

async function hasRecentFallback(
  supabase: Supabase,
  leadPhone: string,
  sinceIso: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("lead_phone", leadPhone)
    .eq("direction", "outbound")
    .in("status", ["queued", "processing", "sent", "delivered"])
    .eq("payload->>kind", "error_fallback")
    .gte("created_at", sinceIso)
    .limit(1);

  if (error) return false;
  return Boolean(data?.length);
}

async function resolveContext(supabase: Supabase, interaction: InteractionRow): Promise<Context> {
  const empty: Context = {
    propertyId: null,
    propertyPublicId: null,
    propertyTitle: null,
    accountId: null,
    brokerId: null,
    brokerName: null,
    brokerPhone: null,
  };
  if (!interaction.lead_phone) return empty;

  const { data: lead } = await supabase
    .from("leads")
    .select("property_id, broker_id")
    .eq("client_phone", interaction.lead_phone)
    .gte(
      "created_at",
      new Date(new Date(interaction.created_at).getTime() - 10 * 60_000).toISOString(),
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let propertyId = lead?.property_id ? String(lead.property_id) : null;
  let brokerId = lead?.broker_id ? String(lead.broker_id) : null;

  if (!propertyId) {
    const { data: session } = await supabase
      .from("conversation_sessions")
      .select("origin_property_id, current_property_id")
      .eq("lead_phone", interaction.lead_phone)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    propertyId = session?.current_property_id
      ? String(session.current_property_id)
      : session?.origin_property_id
        ? String(session.origin_property_id)
        : null;
  }

  let propertyPublicId: string | null = null;
  let propertyTitle: string | null = null;
  let accountId: string | null = null;

  if (propertyId) {
    const { data: property } = await supabase
      .from("properties")
      .select("id, public_id, title, broker_id, account_id")
      .eq("id", propertyId)
      .maybeSingle();
    propertyPublicId = property?.public_id ? String(property.public_id) : null;
    propertyTitle = property?.title ? String(property.title) : null;
    accountId = property?.account_id ? String(property.account_id) : null;
    brokerId = brokerId ?? (property?.broker_id ? String(property.broker_id) : null);
  }

  let brokerName: string | null = null;
  let brokerPhone: string | null = null;

  if (brokerId) {
    const { data: broker } = await supabase
      .from("brokers")
      .select("display_name, whatsapp_number, account_id")
      .eq("id", brokerId)
      .maybeSingle();
    brokerName = broker?.display_name ? String(broker.display_name) : null;
    brokerPhone = sanitizeBrokerPhone(
      broker?.whatsapp_number ? String(broker.whatsapp_number) : null,
    );
    accountId = accountId ?? (broker?.account_id ? String(broker.account_id) : null);
  }

  return {
    propertyId,
    propertyPublicId,
    propertyTitle,
    accountId,
    brokerId,
    brokerName,
    brokerPhone,
  };
}

async function findOpenIncident(
  supabase: Supabase,
  input: IncidentInput,
): Promise<IncidentRow | null> {
  let query = supabase
    .from("bot_incidents")
    .select("*")
    .eq("incident_type", input.incident_type)
    .eq("status", "open")
    .limit(1);

  if (input.interaction_id) {
    query = query.eq("interaction_id", input.interaction_id);
  } else if (input.source_step_id) {
    query = query.eq("source_step_id", input.source_step_id);
  } else if (input.source_message_id) {
    query = query.eq("source_message_id", input.source_message_id);
  } else if (input.source_webhook_event_id) {
    query = query.eq("source_webhook_event_id", input.source_webhook_event_id);
  } else if (input.lead_phone) {
    query = query.eq("lead_phone", input.lead_phone);
  } else {
    const { data } = await query
      .is("interaction_id", null)
      .is("source_step_id", null)
      .is("source_message_id", null)
      .is("source_webhook_event_id", null)
      .is("lead_phone", null)
      .maybeSingle();
    return (data as IncidentRow | null) ?? null;
  }

  const { data } = await query.maybeSingle();
  return (data as IncidentRow | null) ?? null;
}

async function createOrGetIncident(
  supabase: Supabase,
  input: IncidentInput,
): Promise<{ incident: IncidentRow | null; created: boolean }> {
  const existing = await findOpenIncident(supabase, input);
  if (existing) return { incident: existing, created: false };

  const { data, error } = await supabase
    .from("bot_incidents")
    .insert({
      interaction_id: input.interaction_id ?? null,
      source_step_id: input.source_step_id ?? null,
      source_message_id: input.source_message_id ?? null,
      source_webhook_event_id: input.source_webhook_event_id ?? null,
      lead_phone: input.lead_phone ?? null,
      property_id: input.property_id ?? null,
      broker_id: input.broker_id ?? null,
      incident_type: input.incident_type,
      severity: input.severity,
      status: "open",
      details: input.details,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[bot-health-monitor] incident insert failed", {
      type: input.incident_type,
      error: error.message,
    });
    return { incident: null, created: false };
  }

  return { incident: data as IncidentRow, created: true };
}

function buildAdminText(incident: IncidentRow, context: Context): string {
  return [
    "Alerta do monitor do bot.",
    `Severidade: ${incident.severity}`,
    `Tipo: ${incident.incident_type}`,
    `Cliente: ${maskPhone(incident.lead_phone)}`,
    `Imovel: ${context.propertyPublicId ?? "nao identificado"}`,
    `Etapa: ${String(incident.details?.current_step ?? "nao identificada")}`,
    `Erro: ${String(incident.details?.error_detail ?? "sem detalhe")}`,
    `Acao: ${String(incident.details?.auto_recovery ?? "registrado para acompanhamento")}`,
  ].join("\n");
}

function buildBrokerText(incident: IncidentRow, context: Context): string {
  return [
    "Aviso de interesse em imovel.",
    `Cliente: ${maskPhone(incident.lead_phone)}`,
    `Imovel: ${context.propertyPublicId ?? "nao identificado"}`,
    context.propertyTitle ? `Titulo: ${context.propertyTitle}` : null,
    "O sistema detectou risco ou falha no atendimento automatico.",
    "Entre em contato com o cliente para garantir o atendimento.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function notifyAdmin(supabase: Supabase, incident: IncidentRow, context: Context) {
  if (incident.admin_notified_at) return;
  const phones = (Deno.env.get("BOT_ADMIN_WHATSAPP_NUMBERS") ?? "")
    .split(",")
    .map((phone) => normalizePhone(phone))
    .filter((phone): phone is string => Boolean(phone));
  if (!phones.length) return;

  const text = buildAdminText(incident, context);
  for (const phone of phones) {
    await supabase.from("whatsapp_messages").insert({
      direction: "outbound",
      provider: "uazapi",
      account_id: context.accountId,
      property_id: context.propertyId,
      lead_phone: phone,
      broker_phone: null,
      message_type: "text",
      status: "queued",
      payload: {
        kind: "bot_incident_admin_alert",
        incident_id: incident.id,
        admin_alert: true,
        text,
      },
    });
  }

  await supabase
    .from("bot_incidents")
    .update({ admin_notified_at: new Date().toISOString() })
    .eq("id", incident.id);
}

async function notifyBroker(supabase: Supabase, incident: IncidentRow, context: Context) {
  if (incident.broker_notified_at || !context.brokerPhone || !incident.lead_phone) return;

  await supabase.from("whatsapp_messages").insert({
    direction: "outbound",
    provider: "uazapi",
    account_id: context.accountId,
    property_id: context.propertyId,
    lead_phone: incident.lead_phone,
    broker_phone: context.brokerPhone,
    message_type: "text",
    status: "queued",
    payload: {
      kind: "bot_incident_broker_alert",
      incident_id: incident.id,
      to_broker: true,
      text: buildBrokerText(incident, context),
    },
  });

  await supabase
    .from("bot_incidents")
    .update({ broker_notified_at: new Date().toISOString() })
    .eq("id", incident.id);
}

async function queueFallbackIfNeeded(
  supabase: Supabase,
  incident: IncidentRow,
  context: Context,
): Promise<Record<string, unknown>> {
  if (!incident.lead_phone) return { fallback: "skipped_missing_phone" };
  const recentSince = new Date(Date.now() - 30 * 60_000).toISOString();
  if (await hasRecentFallback(supabase, incident.lead_phone, recentSince)) {
    return { fallback: "already_exists" };
  }

  await supabase.from("whatsapp_messages").insert({
    direction: "outbound",
    provider: "uazapi",
    account_id: context.accountId,
    property_id: context.propertyId,
    lead_phone: incident.lead_phone,
    broker_phone: context.brokerPhone,
    message_type: "text",
    status: "queued",
    payload: {
      kind: "error_fallback",
      text: FALLBACK_TEXT,
      bot_incident_id: incident.id,
      monitor_recovery: true,
    },
  });
  return { fallback: "queued" };
}

async function triggerDispatch(): Promise<Record<string, unknown>> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const cronSecret = Deno.env.get("CRON_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !cronSecret) return { dispatch: "skipped_missing_config" };

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-dispatch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    return { dispatch: res.ok ? "triggered" : `failed_${res.status}` };
  } catch (err) {
    return { dispatch: err instanceof Error ? err.message : String(err) };
  }
}

async function recoverAndNotify(
  supabase: Supabase,
  incident: IncidentRow | null,
  context: Context,
  options: { fallback?: boolean; dispatch?: boolean; broker?: boolean },
) {
  if (!incident) return { updated: false };

  const recovery: Record<string, unknown> = {};
  if (options.fallback)
    Object.assign(recovery, await queueFallbackIfNeeded(supabase, incident, context));
  if (options.dispatch) Object.assign(recovery, await triggerDispatch());

  if (Object.keys(recovery).length) {
    await supabase
      .from("bot_incidents")
      .update({
        auto_recovery_attempted_at: new Date().toISOString(),
        auto_recovery_result: recovery,
      })
      .eq("id", incident.id);
    incident.auto_recovery_attempted_at = new Date().toISOString();
    incident.auto_recovery_result = recovery;
    incident.details = { ...(incident.details ?? {}), auto_recovery: JSON.stringify(recovery) };
  }

  await notifyAdmin(supabase, incident, context);
  if (options.broker) await notifyBroker(supabase, incident, context);
  return { updated: true, recovery };
}

async function markRecoverableIncidentsResolved(supabase: Supabase): Promise<number> {
  const { data } = await supabase
    .from("bot_incidents")
    .select("id, lead_phone, detected_at")
    .eq("status", "open")
    .in("incident_type", [
      "silent_customer_response",
      "processed_webhook_without_customer_response",
      "response_queued_without_dispatch",
    ])
    .limit(100);

  let resolved = 0;
  for (const incident of data ?? []) {
    const phone = incident.lead_phone ? String(incident.lead_phone) : null;
    if (!phone) continue;
    const visible = await hasVisibleCustomerOutbound(
      supabase,
      phone,
      String(incident.detected_at),
      ["sent", "delivered"],
    );
    if (!visible) continue;
    await supabase
      .from("bot_incidents")
      .update({ status: "auto_recovered", resolved_at: new Date().toISOString() })
      .eq("id", incident.id);
    resolved += 1;
  }
  return resolved;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!authOk(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const stuckMinutes = toInt(Deno.env.get("BOT_MONITOR_STUCK_MINUTES"), DEFAULT_STUCK_MINUTES);
  const monitorWindowHours = toInt(
    Deno.env.get("BOT_MONITOR_WINDOW_HOURS"),
    DEFAULT_MONITOR_WINDOW_HOURS,
  );
  const cutoffIso = new Date(Date.now() - stuckMinutes * 60_000).toISOString();
  const windowIso = new Date(Date.now() - monitorWindowHours * 60 * 60_000).toISOString();

  const createdIncidentIds = new Set<string>();
  let checked = 0;

  const resolved = await markRecoverableIncidentsResolved(supabase);

  const { data: interactions } = await supabase
    .from("bot_interactions")
    .select("*")
    .gte("created_at", windowIso)
    .or(`is_resolved.eq.false,current_step.like.error_%`)
    .limit(300);

  for (const interaction of (interactions ?? []) as InteractionRow[]) {
    checked += 1;
    const context = await resolveContext(supabase, interaction);
    const leadPhone = interaction.lead_phone;
    if (!leadPhone) continue;

    const isOld = new Date(interaction.updated_at).getTime() < new Date(cutoffIso).getTime();
    const visibleSinceStart = await hasVisibleCustomerOutbound(
      supabase,
      leadPhone,
      interaction.created_at,
    );

    if (
      isOld &&
      !visibleSinceStart &&
      !["completed", "error_no_property"].includes(interaction.current_step)
    ) {
      let incidentType =
        interaction.current_step === "error_silent_response_blocked"
          ? "silent_guard_triggered"
          : "silent_customer_response";
      if (incidentType === "silent_customer_response" && interaction.webhook_event_id) {
        const { data: webhook } = await supabase
          .from("webhook_events")
          .select("processing_status")
          .eq("id", interaction.webhook_event_id)
          .maybeSingle();
        if (webhook?.processing_status === "processed") {
          incidentType = "processed_webhook_without_customer_response";
        }
      }

      const { incident, created } = await createOrGetIncident(supabase, {
        interaction_id: interaction.id,
        source_webhook_event_id: interaction.webhook_event_id,
        lead_phone: leadPhone,
        property_id: context.propertyId,
        broker_id: context.brokerId,
        incident_type: incidentType,
        severity: "critical",
        details: {
          current_step: interaction.current_step,
          error_detail: interaction.error_detail,
          retry_count: interaction.retry_count,
          created_at: interaction.created_at,
          updated_at: interaction.updated_at,
        },
      });
      if (created && incident?.id) createdIncidentIds.add(incident.id);
      await recoverAndNotify(supabase, incident, context, {
        fallback: true,
        dispatch: true,
        broker: true,
      });
    }

    if (interaction.current_step === "response_queued" && isOld) {
      const delivered = await hasVisibleCustomerOutbound(
        supabase,
        leadPhone,
        interaction.created_at,
        ["sent", "delivered"],
      );
      if (!delivered) {
        const { incident, created } = await createOrGetIncident(supabase, {
          interaction_id: interaction.id,
          source_webhook_event_id: interaction.webhook_event_id,
          lead_phone: leadPhone,
          property_id: context.propertyId,
          broker_id: context.brokerId,
          incident_type: "response_queued_without_dispatch",
          severity: "warning",
          details: {
            current_step: interaction.current_step,
            retry_count: interaction.retry_count,
          },
        });
        if (created && incident?.id) createdIncidentIds.add(incident.id);
        await recoverAndNotify(supabase, incident, context, { dispatch: true, broker: true });
      }
    }

    if (interaction.current_step === "error_max_retries") {
      const { incident, created } = await createOrGetIncident(supabase, {
        interaction_id: interaction.id,
        source_webhook_event_id: interaction.webhook_event_id,
        lead_phone: leadPhone,
        property_id: context.propertyId,
        broker_id: context.brokerId,
        incident_type: "error_max_retries",
        severity: "critical",
        details: {
          current_step: interaction.current_step,
          error_detail: interaction.error_detail,
          retry_count: interaction.retry_count,
        },
      });
      if (created && incident?.id) createdIncidentIds.add(incident.id);
      await recoverAndNotify(supabase, incident, context, { broker: true });
    }
  }

  const { data: pendingSteps } = await supabase
    .from("bot_interaction_steps")
    .select("id, interaction_id, step_name, started_at, error_detail")
    .eq("status", "pending")
    .lt("started_at", cutoffIso)
    .limit(100);

  for (const step of pendingSteps ?? []) {
    const { data: interaction } = await supabase
      .from("bot_interactions")
      .select("*")
      .eq("id", step.interaction_id)
      .maybeSingle();
    if (!interaction) continue;
    const context = await resolveContext(supabase, interaction as InteractionRow);
    const { incident, created } = await createOrGetIncident(supabase, {
      interaction_id: String(step.interaction_id),
      source_step_id: String(step.id),
      source_webhook_event_id: interaction.webhook_event_id,
      lead_phone: interaction.lead_phone,
      property_id: context.propertyId,
      broker_id: context.brokerId,
      incident_type: "pending_step_timeout",
      severity: "warning",
      details: {
        step_name: step.step_name,
        started_at: step.started_at,
        current_step: interaction.current_step,
        error_detail: step.error_detail,
      },
    });
    if (created && incident?.id) createdIncidentIds.add(incident.id);
    await recoverAndNotify(supabase, incident, context, {
      fallback: !interaction.is_resolved,
      dispatch: true,
      broker: true,
    });
  }

  const { data: stuckMessages } = await supabase
    .from("whatsapp_messages")
    .select(
      "id, lead_phone, broker_phone, property_id, status, message_type, payload, created_at, updated_at",
    )
    .eq("direction", "outbound")
    .in("status", ["queued", "processing"])
    .lt("updated_at", cutoffIso)
    .limit(100);

  for (const message of stuckMessages ?? []) {
    const payload = asRecord(message.payload) ?? {};
    const isBrokerMessage = payload.to_broker === true;
    const phone = message.lead_phone ? String(message.lead_phone) : null;
    const context: Context = {
      propertyId: message.property_id ? String(message.property_id) : null,
      propertyPublicId: null,
      propertyTitle: null,
      accountId: null,
      brokerId: null,
      brokerName: null,
      brokerPhone: message.broker_phone ? String(message.broker_phone) : null,
    };
    const { incident, created } = await createOrGetIncident(supabase, {
      source_message_id: String(message.id),
      lead_phone: phone,
      property_id: context.propertyId,
      incident_type: "outbound_message_stuck",
      severity: message.status === "processing" ? "critical" : "warning",
      details: {
        status: message.status,
        message_type: message.message_type,
        to_broker: isBrokerMessage,
        kind: payload.kind ?? null,
        created_at: message.created_at,
        updated_at: message.updated_at,
      },
    });
    if (created && incident?.id) createdIncidentIds.add(incident.id);
    await recoverAndNotify(supabase, incident, context, { dispatch: true, broker: false });
  }

  const { data: fallbackMessages } = await supabase
    .from("whatsapp_messages")
    .select("id, lead_phone, property_id, payload, created_at")
    .eq("direction", "outbound")
    .eq("payload->>kind", "error_fallback")
    .gte("created_at", windowIso)
    .limit(100);

  for (const message of fallbackMessages ?? []) {
    const phone = message.lead_phone ? String(message.lead_phone) : null;
    if (!phone) continue;
    const { data: interaction } = await supabase
      .from("bot_interactions")
      .select("*")
      .eq("lead_phone", phone)
      .gte("created_at", windowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const context = interaction
      ? await resolveContext(supabase, interaction as InteractionRow)
      : {
          propertyId: message.property_id ? String(message.property_id) : null,
          propertyPublicId: null,
          propertyTitle: null,
          accountId: null,
          brokerId: null,
          brokerName: null,
          brokerPhone: null,
        };
    const { incident, created } = await createOrGetIncident(supabase, {
      interaction_id: interaction?.id ?? null,
      source_message_id: String(message.id),
      lead_phone: phone,
      property_id: context.propertyId,
      broker_id: context.brokerId,
      incident_type: "customer_fallback_sent",
      severity: "warning",
      details: {
        kind: "error_fallback",
        created_at: message.created_at,
        payload: message.payload,
      },
    });
    if (created && incident?.id) createdIncidentIds.add(incident.id);
    await recoverAndNotify(supabase, incident, context, { broker: true });
  }

  const { data: hourlyRows } = await supabase
    .from("v_bot_hourly_success")
    .select("hora, total, sucesso, erros, taxa_sucesso_pct")
    .order("hora", { ascending: false })
    .limit(1);
  const latestHour = hourlyRows?.[0] as Record<string, unknown> | undefined;
  const total = Number(latestHour?.total ?? 0);
  const successRate = Number(latestHour?.taxa_sucesso_pct ?? 100);
  const minHourlyTotal = toInt(Deno.env.get("BOT_MONITOR_MIN_HOURLY_TOTAL"), 5);
  const minSuccessRate = toInt(Deno.env.get("BOT_MONITOR_MIN_SUCCESS_RATE_PCT"), 80);

  if (total >= minHourlyTotal && successRate < minSuccessRate) {
    const { incident, created } = await createOrGetIncident(supabase, {
      incident_type: "hourly_success_rate_drop",
      severity: "warning",
      details: {
        hour: latestHour?.hora ?? null,
        total,
        success: latestHour?.sucesso ?? null,
        errors: latestHour?.erros ?? null,
        success_rate_pct: successRate,
        min_success_rate_pct: minSuccessRate,
      },
    });
    if (created && incident?.id) createdIncidentIds.add(incident.id);
    await recoverAndNotify(
      supabase,
      incident,
      {
        propertyId: null,
        propertyPublicId: null,
        propertyTitle: null,
        accountId: null,
        brokerId: null,
        brokerName: null,
        brokerPhone: null,
      },
      {},
    );
  }

  return json({
    ok: true,
    checked,
    created_incidents: createdIncidentIds.size,
    auto_resolved_incidents: resolved,
  });
});
