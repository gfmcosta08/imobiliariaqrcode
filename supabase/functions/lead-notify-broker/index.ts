import { corsHeaders } from "../_shared/cors.ts";

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
