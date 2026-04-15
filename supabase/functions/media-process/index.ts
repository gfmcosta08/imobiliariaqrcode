import { corsHeaders } from "../_shared/cors.ts";

/** Stub: pipeline de imagens (variantes + atualização property_media). */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({ ok: true, stub: true, message: "media-process — implementar fila + sharp" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
