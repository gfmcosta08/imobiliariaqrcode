import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

function getStr(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const value = obj[k];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizePhone(v: string | null): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  return d || null;
}

function extractText(payload: Record<string, unknown>): string {
  const direct = getStr(payload, ["text", "body", "content"]);
  if (direct) return direct;

  const msg = payload.message;
  if (msg && typeof msg === "object") {
    const nested = msg as Record<string, unknown>;
    return (
      getStr(nested, ["text", "body", "content", "caption", "conversation"]) ??
      ""
    );
  }
  return "";
}

function extractPhone(payload: Record<string, unknown>): string | null {
  // campos top-level genéricos
  const top = getStr(payload, ["from", "sender", "author", "remoteJid", "phone", "lead_phone"]);
  if (top) return top;

  // Uazapi: payload.message.sender_pn ou payload.message.chatid
  const msg = payload.message;
  if (msg && typeof msg === "object") {
    const m = msg as Record<string, unknown>;
    // ignorar mensagens enviadas pelo próprio bot
    if (m.fromMe === true) return null;
    const v = getStr(m, ["sender_pn", "chatid", "from", "phone"]);
    if (v) return v.split("@")[0]; // remove "@s.whatsapp.net" se presente
  }

  // Uazapi: payload.chat.wa_chatid ou payload.chat.phone
  const chat = payload.chat;
  if (chat && typeof chat === "object") {
    const c = chat as Record<string, unknown>;
    const v = getStr(c, ["wa_chatid", "phone"]);
    if (v) return v.split("@")[0];
  }

  return null;
}

function extractExternalId(payload: Record<string, unknown>): string | null {
  // top-level
  const top = getStr(payload, ["id", "messageId", "message_id", "eventId", "event_id"]);
  if (top) return top;
  // Uazapi: payload.message.messageid
  const msg = payload.message;
  if (msg && typeof msg === "object") {
    return getStr(msg as Record<string, unknown>, ["messageid", "id", "messageId"]);
  }
  return null;
}

function extractAudioUrl(payload: Record<string, unknown>): string | null {
  const msg = payload.message;
  if (!msg || typeof msg !== "object") return null;
  const m = msg as Record<string, unknown>;
  const msgType = getStr(m, ["messageType", "type"]) ?? "";
  if (!/^(audio|ptt|AudioMessage|PttMessage|voice)/i.test(msgType)) return null;
  // Direct URL field on message
  const direct = getStr(m, ["mediaUrl", "media_url", "url", "audioUrl"]);
  if (direct) return direct;
  // Nested audio/ptt object
  for (const key of ["audio", "ptt", "voice"]) {
    const nested = m[key];
    if (nested && typeof nested === "object") {
      const n = nested as Record<string, unknown>;
      const url = getStr(n, ["url", "mediaUrl", "media_url"]);
      if (url) return url;
    }
  }
  return null;
}

async function transcribeAudio(audioUrl: string): Promise<string | null> {
  const apiKey = Deno.env.get("MINIMAX_API_KEY") ?? Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;
  const isMinimax = !!Deno.env.get("MINIMAX_API_KEY");
  const apiBase = isMinimax ? "https://api.minimax.chat" : "https://api.openai.com";
  const model = isMinimax
    ? (Deno.env.get("MINIMAX_STT_MODEL") ?? "speech-01")
    : "whisper-1";
  try {
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) return null;
    const audioBlob = await audioRes.blob();
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.ogg");
    formData.append("model", model);
    formData.append("language", "pt");
    const res = await fetch(`${apiBase}/v1/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const transcribed = typeof data.text === "string" ? data.text.trim() : null;
    return transcribed || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const raw = await req.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      payload = { raw };
    }

    // ignorar eventos que não sejam mensagens recebidas (ex: status de entrega)
    const eventType = getStr(payload, ["EventType", "event_type", "event"]);
    if (eventType && eventType !== "messages" && eventType !== "message") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const externalId = extractExternalId(payload);

    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw || "empty"));
    const hashHex = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const dedupeKey = externalId ?? `sha256:${hashHex.slice(0, 40)}`;

    const leadPhone = normalizePhone(extractPhone(payload));
    let text = extractText(payload);

    // Transcribe audio messages via Whisper if text is empty
    if (leadPhone && !text) {
      const audioUrl = extractAudioUrl(payload);
      if (audioUrl) {
        const transcribed = await transcribeAudio(audioUrl);
        if (transcribed) text = transcribed;
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: insertedEvent, error: eventError } = await supabase
      .from("webhook_events")
      .insert({
        provider: "uazapi",
        event_name: "inbound",
        external_event_id: dedupeKey,
        payload,
        processing_status: "pending",
      })
      .select("id")
      .maybeSingle();

    if (eventError) {
      if (eventError.code === "23505") {
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: false, detail: eventError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (leadPhone && text) {
      await supabase.from("whatsapp_messages").insert({
        direction: "inbound",
        provider: "uazapi",
        lead_phone: leadPhone,
        message_type: "text",
        provider_message_id: externalId,
        payload: {
          text,
          raw: payload,
          dedupe_key: dedupeKey,
        },
        status: "sent",
        sent_at: new Date().toISOString(),
      });

      const conversationUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/conversation-handle`;
      console.log(`Calling conversation-handle at: ${conversationUrl}`);
      
      const response = await fetch(conversationUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          event_id: insertedEvent?.id ?? null,
          lead_phone: leadPhone,
          text,
          payload,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`conversation-handle failed: ${response.status} - ${errorText}`);
        
        await supabase
          .from("webhook_events")
          .update({
            processing_status: "failed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", insertedEvent?.id ?? "");
        return new Response(JSON.stringify({ ok: false, error: "conversation_handle_failed", detail: errorText }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

// NOVO: Disparar o dispatch automaticamente após processar a conversa para resposta rápida
      const dispatchUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-dispatch`;
      console.log(`Triggering dispatch at: ${dispatchUrl}`);
      
      // Chamada assíncrona (não espera o dispatch terminar para responder o webhook)
      fetch(dispatchUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("CRON_SECRET")}`,
        },
      }).catch(err => console.error("Auto-dispatch trigger failed:", err));
    }

    await supabase
      .from("webhook_events")
      .update({
        processing_status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", insertedEvent?.id ?? "");

    return new Response(JSON.stringify({ ok: true, stored: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, detail: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
