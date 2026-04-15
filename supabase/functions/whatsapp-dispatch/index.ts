import { corsHeaders } from "../_shared/cors.ts";

/** Stub: consumidor de fila outbound — throttling + Uazapi. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({
      ok: true,
      stub: true,
      message: "whatsapp-dispatch — implementar fila pgmq + provider",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
