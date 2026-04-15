import { corsHeaders } from "../_shared/cors.ts";

/**
 * Reservado para variantes (thumb/WebP) + fila. No app web, o upload já grava `property_media.status = ready`.
 * Só é necessário reativar esta função se quiser processamento assíncrono ou múltiplos tamanhos.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({ ok: true, stub: true, message: "media-process — implementar fila + sharp" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
