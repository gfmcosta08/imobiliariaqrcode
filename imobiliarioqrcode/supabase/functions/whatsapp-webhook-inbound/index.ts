import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const eventId = body.event_id ?? body.id;
    const provider = body.provider ?? "uazapi";
    const eventName = body.event ?? body.type ?? "unknown";
    const payload = body.payload ?? body;

    if (!eventId) {
      return new Response(JSON.stringify({ ok: false, error: "missing_event_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing } = await supabase
      .from("webhook_events")
      .select("id")
      .eq("provider", provider)
      .eq("external_event_id", String(eventId))
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ ok: true, status: "duplicate", event_id: eventId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: eventRecord, error: insertError } = await supabase
      .from("webhook_events")
      .insert({
        provider,
        event_name: eventName,
        external_event_id: String(eventId),
        payload,
        received_at: new Date().toISOString(),
        processing_status: "pending",
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    const conversationUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/conversation-handle`;
    let conversationError = null;

    try {
      const convResponse = await fetch(conversationUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          lead_phone: body.from ?? body.phone ?? payload.phone ?? payload.sender,
          text: body.text ?? body.message ?? payload.text ?? payload.content ?? "",
          event_id: String(eventId),
          is_audio: false,
          payload: payload,
        }),
      });

      if (!convResponse.ok) {
        conversationError = await convResponse.text();
      }
    } catch (e) {
      conversationError = e instanceof Error ? e.message : String(e);
    }

    if (conversationError) {
      await supabase
        .from("webhook_events")
        .update({
          processing_status: "failed",
          processed_at: new Date().toISOString(),
        })
        .eq("id", eventRecord.id);
      return new Response(JSON.stringify({ ok: false, error: "conversation_handle_failed", detail: conversationError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dispatchUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-dispatch`;
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (cronSecret) {
      fetch(dispatchUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${cronSecret}` },
      }).catch(() => {});
    }

    await supabase
      .from("webhook_events")
      .update({
        processing_status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", eventRecord.id);

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