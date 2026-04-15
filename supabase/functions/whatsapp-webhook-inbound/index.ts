import { corsHeaders } from "../_shared/cors.ts";

/** Stub: persistir em webhook_events e enfileirar — integrar Uazapi no próximo passo. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({
      ok: true,
      stub: true,
      message: "whatsapp-webhook-inbound — implementar Uazapi + fila",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
