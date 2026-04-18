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

function extractLeadPhone(payload: Record<string, unknown>): string | null {
  const direct = getStr(payload, [
    "sender_pn",
    "chatid",
    "wa_chatid",
    "from",
    "sender",
    "author",
    "remoteJid",
    "phone",
    "lead_phone",
  ]);
  if (direct) return normalizePhone(direct);

  const message = payload.message;
  if (message && typeof message === "object") {
    const m = message as Record<string, unknown>;
    const fromMessage = getStr(m, ["sender_pn", "chatid", "from", "sender", "remoteJid"]);
    if (fromMessage) return normalizePhone(fromMessage);
  }

  const chat = payload.chat;
  if (chat && typeof chat === "object") {
    const c = chat as Record<string, unknown>;
    const fromChat = getStr(c, ["wa_chatid", "phone"]);
    if (fromChat) return normalizePhone(fromChat);
  }

  const key = payload.key;
  if (key && typeof key === "object") {
    const k = key as Record<string, unknown>;
    const fromKey = getStr(k, ["remoteJid"]);
    if (fromKey) return normalizePhone(fromKey);
  }

  return null;
}

function extractText(payload: Record<string, unknown>): string {
  const direct = getStr(payload, ["text", "body", "message", "content"]);
  if (direct) return direct;

  const msg = payload.message;
  if (msg && typeof msg === "object") {
    const nested = msg as Record<string, unknown>;
    const fromContent = nested.content;
    if (fromContent && typeof fromContent === "object") {
      const c = fromContent as Record<string, unknown>;
      const nestedContentText = getStr(c, ["text", "body", "caption", "conversation"]);
      if (nestedContentText) return nestedContentText;
    }
    return getStr(nested, ["text", "body", "message", "caption", "conversation"]) ?? "";
  }
  return "";
}

function normalizeAudioTagText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isUsefulAudioTranscript(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const normalized = normalizeAudioTagText(t);
  return normalized !== "[audio]" && normalized !== "[audios]";
}

function extractAudioTranscript(payload: Record<string, unknown>, fallbackText: string): string {
  const direct = getStr(payload, [
    "transcript",
    "transcription",
    "audio_transcript",
    "audioTranscription",
    "speech_to_text",
  ]);
  if (direct && isUsefulAudioTranscript(direct)) return direct;

  const msg = payload.message;
  if (msg && typeof msg === "object") {
    const nested = msg as Record<string, unknown>;
    const nestedTranscript = getStr(nested, [
      "transcript",
      "transcription",
      "audio_transcript",
      "audioTranscription",
      "speech_to_text",
    ]);
    if (nestedTranscript && isUsefulAudioTranscript(nestedTranscript)) return nestedTranscript;

    const nestedContent = nested.content;
    if (nestedContent && typeof nestedContent === "object") {
      const contentObj = nestedContent as Record<string, unknown>;
      const contentTranscript = getStr(contentObj, [
        "transcript",
        "transcription",
        "audio_transcript",
        "audioTranscription",
        "speech_to_text",
        "text",
      ]);
      if (contentTranscript && isUsefulAudioTranscript(contentTranscript)) return contentTranscript;
    }
  }

  return isUsefulAudioTranscript(fallbackText) ? fallbackText : "";
}

function detectAudio(payload: Record<string, unknown>): boolean {
  const mediaType = getStr(payload, ["mediaType", "messageType", "type", "wa_lastMessageType"]);
  if (mediaType) {
    const mt = mediaType.toLowerCase();
    if (mt.includes("audio") || mt.includes("ptt")) return true;
  }

  const msg = payload.message;
  if (msg && typeof msg === "object") {
    const nested = msg as Record<string, unknown>;
    const nestedType = getStr(nested, ["mediaType", "messageType", "type"]);
    if (nestedType) {
      const nt = nestedType.toLowerCase();
      if (nt.includes("audio") || nt.includes("ptt")) return true;
    }
    if (nested.audioMessage && typeof nested.audioMessage === "object") return true;
    if (nested.pttMessage && typeof nested.pttMessage === "object") return true;
  }

  const chat = payload.chat;
  if (chat && typeof chat === "object") {
    const c = chat as Record<string, unknown>;
    const chatType = getStr(c, ["wa_lastMessageType"]);
    if (chatType) {
      const ct = chatType.toLowerCase();
      if (ct.includes("audio") || ct.includes("ptt")) return true;
    }
  }
  return false;
}

function collectAudioCandidateUrls(payload: Record<string, unknown>): string[] {
  const urls = new Set<string>();
  const addIfUrl = (v: unknown) => {
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) {
      urls.add(v.trim());
    }
  };

  addIfUrl(payload.url);
  addIfUrl(payload.media_url);
  addIfUrl(payload.mediaUrl);
  addIfUrl(payload.audio_url);
  addIfUrl(payload.audioUrl);

  const msg = payload.message;
  if (msg && typeof msg === "object") {
    const nested = msg as Record<string, unknown>;
    addIfUrl(nested.url);
    addIfUrl(nested.media_url);
    addIfUrl(nested.mediaUrl);
    addIfUrl(nested.audio_url);
    addIfUrl(nested.audioUrl);

    const content = nested.content;
    if (content && typeof content === "object") {
      const c = content as Record<string, unknown>;
      addIfUrl(c.url);
      addIfUrl(c.URL);
      addIfUrl(c.media_url);
      addIfUrl(c.mediaUrl);
      addIfUrl(c.audio_url);
      addIfUrl(c.audioUrl);
    }
  }

  return Array.from(urls);
}

function extractTranscriptFromProviderResponse(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    return isUsefulAudioTranscript(value) ? value.trim() : null;
  }
  if (typeof value !== "object") return null;

  const obj = value as Record<string, unknown>;
  const direct = getStr(obj, [
    "transcript",
    "transcription",
    "text",
    "message",
    "result",
    "content",
    "audio_transcript",
    "audioTranscription",
    "speech_to_text",
  ]);
  if (direct && isUsefulAudioTranscript(direct)) return direct;

  const data = obj.data;
  if (data && typeof data === "object") {
    const nested = extractTranscriptFromProviderResponse(data);
    if (nested) return nested;
  }

  return null;
}

async function transcribeWithUazapi(
  payload: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<{ transcript: string | null; source: string | null }> {
  const baseUrlRaw =
    getStr(data, ["baseUrl", "base_url"]) ??
    getStr(payload, ["baseUrl", "base_url"]) ??
    Deno.env.get("UAZAPI_BASE_URL") ??
    null;
  const token =
    getStr(data, ["token", "apiKey", "apikey"]) ??
    getStr(payload, ["token", "apiKey", "apikey"]) ??
    Deno.env.get("UAZAPI_TOKEN") ??
    Deno.env.get("UAZAPI_INSTANCE_TOKEN") ??
    null;

  if (!baseUrlRaw || !token) return { transcript: null, source: null };

  const baseUrl = baseUrlRaw.replace(/\/$/, "");
  const audioUrls = Array.from(new Set([...collectAudioCandidateUrls(data), ...collectAudioCandidateUrls(payload)]));
  if (!audioUrls.length) return { transcript: null, source: null };

  const candidates = [
    "/chat/audio/transcribe",
    "/message/transcribe",
    "/transcribe",
    "/send/audio",
  ];

  const headers: Record<string, string> = {
    token,
    Authorization: `Bearer ${token}`,
    apikey: token,
    "x-api-key": token,
  };

  for (const audioUrl of audioUrls) {
    for (const endpoint of candidates) {
      const queryVariants = [
        `url=${encodeURIComponent(audioUrl)}`,
        `audio=${encodeURIComponent(audioUrl)}`,
        `audioUrl=${encodeURIComponent(audioUrl)}`,
        `mediaUrl=${encodeURIComponent(audioUrl)}`,
      ];

      for (const q of queryVariants) {
        const url = `${baseUrl}${endpoint}?${q}`;
        try {
          const res = await fetch(url, { method: "GET", headers });
          const raw = await res.text();
          if (!res.ok) continue;
          let parsed: unknown = raw;
          try {
            parsed = raw ? JSON.parse(raw) : raw;
          } catch {
            parsed = raw;
          }
          const transcript = extractTranscriptFromProviderResponse(parsed);
          if (transcript) {
            return { transcript, source: `uazapi:${endpoint}:GET` };
          }
        } catch {
          // ignore and continue trying other endpoint variations
        }
      }

      const bodyVariants = [
        { url: audioUrl },
        { audio: audioUrl },
        { audioUrl },
        { mediaUrl: audioUrl },
      ];

      for (const body of bodyVariants) {
        try {
          const res = await fetch(`${baseUrl}${endpoint}`, {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });
          const raw = await res.text();
          if (!res.ok) continue;
          let parsed: unknown = raw;
          try {
            parsed = raw ? JSON.parse(raw) : raw;
          } catch {
            parsed = raw;
          }
          const transcript = extractTranscriptFromProviderResponse(parsed);
          if (transcript) {
            return { transcript, source: `uazapi:${endpoint}:POST` };
          }
        } catch {
          // ignore and continue trying other endpoint variations
        }
      }
    }
  }

  return { transcript: null, source: null };
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

    const externalId =
      getStr(payload, ["id", "messageId", "message_id", "eventId", "event_id"]) ?? null;

    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw || "empty"));
    const hashHex = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const dedupeKey = externalId ?? `sha256:${hashHex.slice(0, 40)}`;

    let data = payload;
    if (payload.data && typeof payload.data === "object") {
      data = payload.data as Record<string, unknown>;
    }

    const leadPhone = extractLeadPhone(data);
    const text = extractText(data);
    const isAudio = detectAudio(data);
    let transcript = isAudio ? extractAudioTranscript(data, text) : text;
    let transcriptionSource: string | null = null;

    if (isAudio && !isUsefulAudioTranscript(transcript)) {
      const native = await transcribeWithUazapi(payload, data);
      if (native.transcript && isUsefulAudioTranscript(native.transcript)) {
        transcript = native.transcript;
        transcriptionSource = native.source;
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

    if (leadPhone && (text || isAudio)) {
      await supabase.from("whatsapp_messages").insert({
        direction: "inbound",
        provider: "uazapi",
        lead_phone: leadPhone,
        message_type: isAudio ? "system" : "text",
        provider_message_id: externalId,
        payload: {
          text: isAudio ? (transcript || "[Audio]") : text,
          is_audio: isAudio,
          transcription_source: transcriptionSource,
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
          text: isAudio ? transcript : text,
          is_audio: isAudio,
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

      const dispatchUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-dispatch`;
      console.log(`Triggering dispatch at: ${dispatchUrl}`);

      fetch(dispatchUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("CRON_SECRET")}`,
        },
      }).catch((err) => console.error("Auto-dispatch trigger failed:", err));
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
