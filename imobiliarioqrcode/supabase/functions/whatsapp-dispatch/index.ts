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

    const { data: messages, error } = await supabase
      .from("whatsapp_messages")
      .select("id, lead_phone, broker_phone, message_type, payload")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) throw error;

    const processedIds: string[] = [];

    for (const msg of messages ?? []) {
      console.log(`Processing message ${msg.id} to ${msg.lead_phone}`);
      processedIds.push(msg.id);
    }

    if (processedIds.length > 0) {
      await supabase
        .from("whatsapp_messages")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .in("id", processedIds);
    }

    return new Response(JSON.stringify({
      ok: true,
      processed: processedIds.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});