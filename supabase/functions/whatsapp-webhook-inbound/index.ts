import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

/** INTEGRAÇÃO PENDENTE (por último): Uazapi — parsear eventos e alimentar conversas/leads. */
/** Recebe webhook Uazapi (formato genérico), persiste em webhook_events para idempotência e processamento futuro. */
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
      (typeof payload.id === "string" && payload.id) ||
      (typeof payload.messageId === "string" && payload.messageId) ||
      null;

    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw || "empty"));
    const hashHex = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const dedupeKey = externalId ?? `sha256:${hashHex.slice(0, 40)}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { error } = await supabase.from("webhook_events").insert({
      provider: "uazapi",
      event_name: "inbound",
      external_event_id: dedupeKey,
      payload,
      processing_status: "pending",
    });

    if (error) {
      if (error.code === "23505") {
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: false, detail: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
