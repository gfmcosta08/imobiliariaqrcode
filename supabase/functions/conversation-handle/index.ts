import { corsHeaders } from "../_shared/cors.ts";

/** Stub: máquina de estados da conversa WhatsApp. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({ ok: true, stub: true, message: "conversation-handle — implementar estados" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
