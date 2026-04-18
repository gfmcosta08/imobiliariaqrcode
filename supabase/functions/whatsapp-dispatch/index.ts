﻿﻿import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_BATCH = 12;
const MAX_CYCLES = 20;

type QueueRow = {
  id: string;
  message_type: "text" | "image" | "menu" | "system";
  payload: Record<string, unknown>;
  lead_phone: string | null;
  broker_phone: string | null;
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

  const imgRes = await fetch(imageUrl);
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
      (parsed && (parsed.id as string)) ||
      (parsed && (parsed.messageId as string)) ||
      null,
    response: parsed ?? raw,
  };
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
    ? Deno.env.get("UAZAPI_IMAGE_ENDPOINT") ?? "/send/media"
    : Deno.env.get("UAZAPI_TEXT_ENDPOINT") ?? "/send/text";

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
      (parsed && (parsed.id as string)) ||
      (parsed && (parsed.messageId as string)) ||
      null,
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

  const sent: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  let cycles = 0;
  while (cycles < MAX_CYCLES) {
    cycles += 1;

    const { data: rows, error } = await supabase
      .from("whatsapp_messages")
      .select("id, message_type, payload, lead_phone, broker_phone, created_at")
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
        await supabase.from("whatsapp_messages").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id);
        sent.push(row.id);
        continue;
      }
      if (row.message_type === "text" && !row.payload?.text) {
        await supabase.from("whatsapp_messages").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id);
        sent.push(row.id);
        continue;
      }

      try {
        await supabase
          .from("whatsapp_messages")
          .update({ status: "processing" })
          .eq("id", row.id)
          .eq("status", "queued");

        const result = await sendViaUazapi(baseUrl, apiToken, row);
        if (!result.ok) {
          const errDetail = (result as { ok: false; detail: string }).detail;
          failed.push({ id: row.id, error: errDetail });
          await supabase
            .from("whatsapp_messages")
            .update({
              status: "failed",
              payload: {
                ...(row.payload ?? {}),
                dispatch_error: errDetail,
                dispatch_failed_at: new Date().toISOString(),
              },
            })
            .eq("id", row.id);
          continue;
        }

        const okResult = result as { ok: true; provider_message_id: string | null; response: unknown };
        sent.push(row.id);
        await supabase
          .from("whatsapp_messages")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: okResult.provider_message_id,
            payload: {
              ...(row.payload ?? {}),
              provider_response: okResult.response,
            },
          })
          .eq("id", row.id);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        failed.push({ id: row.id, error: errMsg });
        await supabase
          .from("whatsapp_messages")
          .update({
            status: "failed",
            payload: { ...(row.payload ?? {}), dispatch_error: errMsg, dispatch_failed_at: new Date().toISOString() },
          })
          .eq("id", row.id);
      }
    }

    if (batch.length < MAX_BATCH) break;
  }

  return new Response(JSON.stringify({ ok: true, processed: sent.length + failed.length, sent, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
