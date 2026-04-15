import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_BATCH = 8;

/**
 * INTEGRAÇÃO PENDENTE (por último): envio real via Uazapi (UAZAPI_BASE_URL, UAZAPI_TOKEN).
 *
 * Processa fila outbound: marca mensagens como enviadas (stub).
 */
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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: rows, error } = await supabase
    .from("whatsapp_messages")
    .select("id, payload, lead_phone, broker_phone, property_id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH);

  if (error) {
    return new Response(JSON.stringify({ ok: false, detail: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const processed: string[] = [];
  for (const row of rows ?? []) {
    const { error: upErr } = await supabase
      .from("whatsapp_messages")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        payload: {
          ...(typeof row.payload === "object" && row.payload ? row.payload : {}),
          _dispatch_stub: true,
          _at: new Date().toISOString(),
        },
      })
      .eq("id", row.id);

    if (!upErr) {
      processed.push(row.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: processed.length, ids: processed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
