import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_BATCH = Number(Deno.env.get("WHATSAPP_DISPATCH_BATCH") ?? "40");

type QueueRow = {
  id: string;
  message_type: "text" | "image" | "menu" | "system";
  payload: Record<string, unknown>;
  lead_phone: string | null;
  broker_phone: string | null;
};

function normalizePhone(v: string): string {
  return v.replace(/\D/g, "");
}

function normalizeOutgoingText(v: unknown): string {
  return String(v ?? "");
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
  const caption = normalizeOutgoingText(row.payload?.caption ?? row.payload?.text ?? "");
  form.append("caption", caption);
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
    ...buildAuthHeaders(token),
  };

  const isImage = row.message_type === "image";
  const textEndpoint = Deno.env.get("UAZAPI_TEXT_ENDPOINT") ?? "/send/text";
  const configuredImageEndpoint = Deno.env.get("UAZAPI_IMAGE_ENDPOINT") ?? "/send/image";
  const configuredInstance = (Deno.env.get("UAZAPI_INSTANCE_NAME") ?? "faroll").trim() || null;

  const caption = normalizeOutgoingText(row.payload?.caption ?? row.payload?.text ?? "");
  const imageUrl = row.payload?.image_url ?? null;

  const legacyImagePayload = {
    to,
    number: to,
    phone: to,
    file: imageUrl,
    image: imageUrl,
    imageUrl: imageUrl,
    image_url: imageUrl,
    url: imageUrl,
    caption,
  };

  if (!isImage) {
    const textPayload = {
      to,
      number: to,
      phone: to,
      text: normalizeOutgoingText(row.payload?.text ?? ""),
      message: normalizeOutgoingText(row.payload?.text ?? ""),
    };

    const url = `${baseUrl.replace(/\/$/, "")}${textEndpoint}`;
    console.log(`[whatsapp-dispatch] Sending text to Uazapi: ${url} for ${to}`);
    const { res, raw, parsed } = await postUazapi(url, headers, JSON.stringify(textPayload));
    console.log(`[whatsapp-dispatch] Uazapi text response (${res.status}): ${raw}`);

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

  const imageEndpoints = buildImageEndpoints(configuredImageEndpoint, textEndpoint, configuredInstance);
  const imagePayloadVariants: Array<Record<string, unknown>> = [
    legacyImagePayload,
    {
      number: to,
      text: caption,
      type: "image",
      file: imageUrl,
      docName: "",
      replyid: "",
      mentions: "",
      readchat: true,
      delay: 0,
    },
    {
      number: to,
      text: caption,
      type: "image",
      file: imageUrl,
    },
    {
      number: to,
      mediaMessage: {
        mediatype: "image",
        fileName: "image.jpg",
        caption,
        media: imageUrl,
      },
      options: { delay: 200 },
    },
  ];

  let lastDetail = "image_dispatch_failed";

  for (const endpoint of imageEndpoints) {
    const url = `${baseUrl.replace(/\/$/, "")}${endpoint}`;

    for (const imagePayload of imagePayloadVariants) {
      console.log(`[whatsapp-dispatch] Sending image to Uazapi: ${url} for ${to}`);

      const { res, raw, parsed } = await postUazapi(url, headers, JSON.stringify(imagePayload));
      console.log(`[whatsapp-dispatch] Uazapi image response (${res.status}): ${raw}`);

      if (res.ok) {
        if (looksLikeTextOnlyResponse(parsed)) {
          lastDetail = "provider_returned_text_for_image";
          continue;
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

      const lower = (raw || "").toLowerCase();
      lastDetail = raw || `http_${res.status}`;

      if (
        lower.includes("missing file field") ||
        lower.includes("missing text for text message") ||
        lower.includes("file")
      ) {
        const multipartResult = await sendImageViaMultipart(baseUrl, endpoint, token, to, row);
        if (multipartResult.ok) {
          return multipartResult;
        }
        lastDetail = `json:${lastDetail} | multipart:${multipartResult.detail}`;
      }
    }
  }

  return { ok: false, detail: lastDetail };
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

  const { data: rows, error } = await supabase
    .from("whatsapp_messages")
    .select("id, message_type, payload, lead_phone, broker_phone")
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

  const sent: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const row of (rows ?? []) as QueueRow[]) {
    await supabase
      .from("whatsapp_messages")
      .update({ status: "processing" })
      .eq("id", row.id)
      .eq("status", "queued");

    const result = await sendViaUazapi(baseUrl, apiToken, row);
    if (!result.ok) {
      failed.push({ id: row.id, error: result.detail });
      await supabase
        .from("whatsapp_messages")
        .update({
          status: "failed",
          payload: {
            ...(row.payload ?? {}),
            dispatch_error: result.detail,
            dispatch_failed_at: new Date().toISOString(),
          },
        })
        .eq("id", row.id);
      continue;
    }

    sent.push(row.id);
    await supabase
      .from("whatsapp_messages")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: result.provider_message_id,
        payload: {
          ...(row.payload ?? {}),
          provider_response: result.response,
        },
      })
      .eq("id", row.id);
  }

  return new Response(JSON.stringify({ ok: true, processed: sent.length + failed.length, sent, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
