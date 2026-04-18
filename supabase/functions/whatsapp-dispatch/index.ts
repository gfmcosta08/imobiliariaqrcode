import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_BATCH = 12;

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

  const payload = isImage
    ? {
        number: to,
        type: "image",
        file: row.payload?.image_url ?? null,
        caption: String(row.payload?.caption ?? row.payload?.text ?? ""),
      }
    : {
        number: to,
        text: String(row.payload?.text ?? ""),
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
    // pular mensagens de sistema sem conteúdo enviável
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

  return new Response(JSON.stringify({ ok: true, processed: sent.length + failed.length, sent, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
