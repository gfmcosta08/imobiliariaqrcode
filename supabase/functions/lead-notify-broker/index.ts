import { corsHeaders } from "../_shared/cors.ts";

/** INTEGRAÇÃO PENDENTE: opcional — notificação extra; o trigger SQL já enfileira em `whatsapp_messages`. */
/** Stub: notificar corretor (WhatsApp/e-mail) ao criar lead. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({
      ok: true,
      stub: true,
      message: "lead-notify-broker — implementar notificação",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
