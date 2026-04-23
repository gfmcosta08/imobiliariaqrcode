import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_BATCH = 12;
const MAX_CYCLES = 20;

type QueueRow = {
  id: string;
  message_type: "text" | "image" | "menu" | "system";
  payload: Record<string, unknown>;
  lead_phone: string | null;
  broker_phone: string | null;
  scheduled_for: string | null;
  created_at: string;
};

function normalizePhone(v: string): string {
  return v.replace(/\D/g, "");
}

function normalizeOutgoingText(v: unknown): string {
  return fixMojibake(String(v ?? ""));
}

function mojibakeScore(v: string): number {
  const matches = v.match(/Ã.|Â|â.|ðŸ|�/g);
  return matches ? matches.length : 0;
}

function fixMojibake(v: string): string {
  if (!v || !/[ÃÂâð]/.test(v)) return v;
  try {
    const bytes = Uint8Array.from(v, (ch) => ch.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder("utf-8").decode(bytes);
    return mojibakeScore(decoded) < mojibakeScore(v) ? decoded : v;
  } catch {
    return v;
  }
}

function buildAuthHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!token) return headers;
  headers.Authorization = `Bearer ${token}`;
  headers.token = token;
  headers.apikey = token;
  headers["x-api-key"] = token;
  return headers;
}

function normalizeEndpoint(endpoint: string): string {
  if (!endpoint) return "";
  return endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
}

function buildImageEndpoints(
  configuredImageEndpoint: string,
  textEndpoint: string,
  instanceName: string | null,
): string[] {
  const endpoints = new Set<string>();
  const normalizedText = normalizeEndpoint(textEndpoint);
  const normalizedConfiguredImage = normalizeEndpoint(configuredImageEndpoint);

  endpoints.add(normalizedConfiguredImage);
  endpoints.add("/send/media");
  endpoints.add("/send/image");
  endpoints.add("/message/image");
  endpoints.add("/message/sendMedia");
  if (instanceName) {
    endpoints.add(`/message/sendMedia/${instanceName}`);
    endpoints.add(`/message/sendImage/${instanceName}`);
  }

  if (normalizedText.includes("/message/sendText")) {
    endpoints.add(normalizedText.replace("/message/sendText", "/message/sendMedia"));
  }
  if (normalizedText.includes("/send/text")) {
    endpoints.add(normalizedText.replace("/send/text", "/send/image"));
  }

  return Array.from(endpoints).filter(Boolean);
}

async function parseProviderResponse(res: Response) {
  const raw = await res.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    parsed = null;
  }
  return { raw, parsed };
}

async function postUazapi(url: string, headers: Record<string, string>, body: string) {
  const res = await fetch(url, {
    method: "POST",
    headers,
    body,
  });
  const { raw, parsed } = await parseProviderResponse(res);
  return { res, raw, parsed };
}

function looksLikeTextOnlyResponse(parsed: Record<string, unknown> | null): boolean {
  if (!parsed) return false;
  const messageType = String(parsed.messageType ?? "");
  if (messageType.toLowerCase().includes("extendedtextmessage")) return true;
  if (messageType.toLowerCase().includes("conversation")) return true;
  const content = parsed.content;
  if (content && typeof content === "object") {
    const c = content as Record<string, unknown>;
    if (typeof c.text === "string" && !("imageMessage" in c) && !("mediaMessage" in c)) return true;
  }
  return false;
}

async function sendImageViaMultipart(
  baseUrl: string,
  endpoint: string,
  token: string | null,
  to: string,
  row: QueueRow,
) {
  const imageUrl = String(row.payload?.image_url ?? "");
  if (!imageUrl) {
    return { ok: false, detail: "missing_image_url" };
  }

  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(20_000) });
  if (!imgRes.ok) {
    const imageError = await imgRes.text();
    return { ok: false, detail: `image_fetch_failed:${imgRes.status}:${imageError}` };
  }

  const blob = await imgRes.blob();
  const form = new FormData();
  form.append("file", blob, "image.jpg");
  form.append("to", to);
  form.append("number", to);
  form.append("phone", to);
  form.append("caption", "");
  form.append("mediatype", "image");

  const headers = buildAuthHeaders(token);
  const url = `${baseUrl.replace(/\/$/, "")}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: form,
  });
  const { raw, parsed } = await parseProviderResponse(res);
  if (!res.ok) {
    return { ok: false, detail: raw || `http_${res.status}` };
  }
  if (looksLikeTextOnlyResponse(parsed)) {
    return { ok: false, detail: "multipart_returned_text_for_image" };
  }
  return {
    ok: true,
    provider_message_id:
      (parsed && (parsed.id as string)) || (parsed && (parsed.messageId as string)) || null,
    response: parsed ?? raw,
  };
}

function toInt(value: string | null | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sleep(ms: number) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function normalizePath(path: string): string {
  if (!path) return "";
  return path.startsWith("/") ? path : `/${path}`;
}

function resolveTargetPhone(row: QueueRow): { to: string | null; toBroker: boolean } {
  const toBroker = row.payload?.to_broker === true;
  const toRaw = toBroker ? row.broker_phone : row.lead_phone;
  if (!toRaw) return { to: null, toBroker };

  const to = normalizePhone(String(toRaw));
  if (!to) return { to: null, toBroker };
  return { to, toBroker };
}

function getPayloadDelayMs(row: QueueRow): number | null {
  const raw = row.payload?.delay_ms;
  if (raw == null) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
}

function getWaitMs(row: QueueRow, defaultDelayMinMs: number, defaultDelayMaxMs: number): number {
  const payloadDelay = getPayloadDelayMs(row);
  if (payloadDelay != null) return payloadDelay;

  if (row.scheduled_for) {
    const scheduledTs = new Date(row.scheduled_for).getTime();
    if (Number.isFinite(scheduledTs)) {
      const remaining = scheduledTs - Date.now();
      if (remaining > 0) return remaining;
    }
  }

  return randomBetween(defaultDelayMinMs, defaultDelayMaxMs);
}

async function sendTypingPresence(
  baseUrl: string,
  token: string | null,
  endpoint: string,
  to: string,
  state: "composing" | "paused",
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.token = token;

  try {
    const url = isAbsoluteUrl(endpoint)
      ? endpoint
      : `${baseUrl.replace(/\/$/, "")}${normalizePath(endpoint)}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        number: to,
        presence: state,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("typing_presence_failed", { to, state, status: res.status, detail });
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("typing_presence_error", { to, state, detail });
  }
}

async function waitWithTyping(
  row: QueueRow,
  waitMs: number,
  config: {
    baseUrl: string;
    token: string | null;
    typingEndpoint: string | null;
    typingHeartbeatMs: number;
  },
) {
  if (waitMs <= 0) return;

  const { to, toBroker } = resolveTargetPhone(row);
  const typingEnabled = !toBroker && !!to && !!config.typingEndpoint;
  if (!typingEnabled) {
    await sleep(waitMs);
    return;
  }

  const target = to as string;
  const endpoint = config.typingEndpoint as string;
  const heartbeatMs = Math.max(250, config.typingHeartbeatMs);
  const deadline = Date.now() + waitMs;

  try {
    await sendTypingPresence(config.baseUrl, config.token, endpoint, target, "composing");

    while (true) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await sleep(Math.min(heartbeatMs, remaining));
      if (deadline - Date.now() > 0) {
        await sendTypingPresence(config.baseUrl, config.token, endpoint, target, "composing");
      }
    }
  } finally {
    await sendTypingPresence(config.baseUrl, config.token, endpoint, target, "paused").catch(
      () => {},
    );
  }
}

async function sendViaUazapi(baseUrl: string, token: string | null, row: QueueRow) {
  const toRaw = row.payload?.to_broker ? row.broker_phone : row.lead_phone;
  if (!toRaw) {
    return { ok: false, detail: "missing_target_phone" };
  }
  const to = normalizePhone(String(toRaw));
  if (!to) {
    return { ok: false, detail: "invalid_target_phone" };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["token"] = token;
  }

  const isImage = row.message_type === "image";
  const endpoint = isImage
    ? (Deno.env.get("UAZAPI_IMAGE_ENDPOINT") ?? "/send/media")
    : (Deno.env.get("UAZAPI_TEXT_ENDPOINT") ?? "/send/text");

  const caption = "";
  const imageUrl = row.payload?.image_url ?? null;
  const payload = isImage
    ? {
        number: to,
        type: "image",
        file: imageUrl,
        caption,
      }
    : {
        number: to,
        text: normalizeOutgoingText(row.payload?.text ?? ""),
      };

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  const raw = await res.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    return { ok: false, detail: raw || `http_${res.status}` };
  }

  return {
    ok: true,
    provider_message_id:
      (parsed && (parsed.id as string)) || (parsed && (parsed.messageId as string)) || null,
    response: parsed ?? raw,
  };
}

function sortRows(rows: QueueRow[]): QueueRow[] {
  return rows.sort((a, b) => {
    const createdCmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (createdCmp !== 0) return createdCmp;

    const flowGroupA = typeof a.payload?.flow_group === "string" ? a.payload.flow_group : "";
    const flowGroupB = typeof b.payload?.flow_group === "string" ? b.payload.flow_group : "";
    if (flowGroupA !== flowGroupB) return flowGroupA.localeCompare(flowGroupB);

    const flowStepA =
      typeof a.payload?.flow_step === "number"
        ? a.payload.flow_step
        : Number.parseInt(String(a.payload?.flow_step ?? "0"), 10) || 0;
    const flowStepB =
      typeof b.payload?.flow_step === "number"
        ? b.payload.flow_step
        : Number.parseInt(String(b.payload?.flow_step ?? "0"), 10) || 0;
    return flowStepA - flowStepB;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const baseUrl = Deno.env.get("UAZAPI_BASE_URL");
  const apiToken = Deno.env.get("UAZAPI_TOKEN") ?? Deno.env.get("UAZAPI_INSTANCE_TOKEN") ?? null;
  if (!baseUrl) {
    return new Response(JSON.stringify({ ok: false, error: "missing_uazapi_base_url" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const typingEndpoint = Deno.env.get("UAZAPI_TYPING_ENDPOINT");
  const typingHeartbeatMs = toInt(Deno.env.get("UAZAPI_TYPING_HEARTBEAT_MS"), 3500);
  const defaultDelayMinMs = Math.max(0, toInt(Deno.env.get("UAZAPI_REPLY_DELAY_MIN_MS"), 2000));
  const defaultDelayMaxMs = Math.max(
    defaultDelayMinMs,
    toInt(Deno.env.get("UAZAPI_REPLY_DELAY_MAX_MS"), 5000),
  );

  const sent: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  // Resetar mensagens travadas em "processing" há mais de 60s (edge function morreu no meio)
  await supabase
    .from("whatsapp_messages")
    .update({ status: "queued" })
    .eq("direction", "outbound")
    .eq("status", "processing")
    .lt("updated_at", new Date(Date.now() - 60_000).toISOString());


  let cycles = 0;
  while (cycles < MAX_CYCLES) {
    cycles += 1;

    const { data: rows, error } = await supabase
      .from("whatsapp_messages")
      .select("id, message_type, payload, lead_phone, broker_phone, scheduled_for, created_at")
      .eq("direction", "outbound")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(MAX_BATCH);

    if (error) {
      return new Response(JSON.stringify({ ok: false, detail: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const batch = (rows ?? []) as QueueRow[];
    if (!batch.length) break;

    const orderedRows = sortRows(batch);

    for (const row of orderedRows) {
      // Skip unsendable system records.
      if (row.message_type === "system" || row.message_type === "menu") {
        await supabase
          .from("whatsapp_messages")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", row.id);
        sent.push(row.id);
        continue;
      }
      if (row.message_type === "text" && !row.payload?.text) {
        await supabase
          .from("whatsapp_messages")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", row.id);
        sent.push(row.id);
        continue;
      }

      try {
        let rowToSend = row;
        if (row.message_type === "text") {
          const rawText = normalizeOutgoingText(row.payload?.text ?? "");
          rowToSend = { ...row, payload: { ...(row.payload ?? {}), text: rawText } };
        }
        await supabase
          .from("whatsapp_messages")
          .update({ status: "processing" })
          .eq("id", row.id)
          .eq("status", "queued");

        const { toBroker } = resolveTargetPhone(row);
        const waitMs = toBroker ? 0 : getWaitMs(row, defaultDelayMinMs, defaultDelayMaxMs);
        await waitWithTyping(row, waitMs, {
          baseUrl,
          token: apiToken,
          typingEndpoint,
          typingHeartbeatMs,
        });

        const result = await sendViaUazapi(baseUrl, apiToken, rowToSend);
        if (!result.ok) {
          const errDetail = (result as { ok: false; detail: string }).detail;
          failed.push({ id: row.id, error: errDetail });
          await supabase
            .from("whatsapp_messages")
            .update({
              status: "failed",
              payload: {
                ...(rowToSend.payload ?? {}),
                dispatch_error: errDetail,
                dispatch_failed_at: new Date().toISOString(),
              },
            })
            .eq("id", row.id);
          continue;
        }

        const okResult = result as {
          ok: true;
          provider_message_id: string | null;
          response: unknown;
        };
        sent.push(row.id);
        await supabase
          .from("whatsapp_messages")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: okResult.provider_message_id,
            payload: {
              ...(rowToSend.payload ?? {}),
              provider_response: okResult.response,
            },
          })
          .eq("id", row.id);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        // Garantir que o "digitando" seja removido mesmo em caso de exceção
        const { to: errTo, toBroker: errToBroker } = resolveTargetPhone(row);
        if (!errToBroker && errTo && typingEndpoint) {
          await sendTypingPresence(baseUrl, apiToken, typingEndpoint, String(errTo), "paused").catch(
            () => {},
          );
        }
        failed.push({ id: row.id, error: errMsg });
        await supabase
          .from("whatsapp_messages")
          .update({
            status: "failed",
            payload: {
              ...(row.payload ?? {}),
              dispatch_error: errMsg,
              dispatch_failed_at: new Date().toISOString(),
            },
          })
          .eq("id", row.id);
      }
    }

    if (batch.length < MAX_BATCH) break;
  }

  return new Response(
    JSON.stringify({ ok: true, processed: sent.length + failed.length, sent, failed }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
