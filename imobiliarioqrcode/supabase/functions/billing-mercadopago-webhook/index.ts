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
    const eventId = body.id ?? body.event_id ?? body.action;
    const eventType = body.type ?? body.topic ?? body.action ?? "unknown";
    const provider = "mercadopago";

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
      return new Response(JSON.stringify({ ok: true, status: "duplicate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase
      .from("webhook_events")
      .insert({
        provider,
        event_name: eventType,
        external_event_id: String(eventId),
        payload: body,
        received_at: new Date().toISOString(),
        processing_status: "processed",
      });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
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