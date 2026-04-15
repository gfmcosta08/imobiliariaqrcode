import { corsHeaders } from "../_shared/cors.ts";

/** Stub: webhook Mercado Pago — atualizar subscriptions. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({
      ok: true,
      stub: true,
      message: "billing-mercadopago-webhook — implementar MP",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
