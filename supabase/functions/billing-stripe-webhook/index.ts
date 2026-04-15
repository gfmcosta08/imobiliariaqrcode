import { corsHeaders } from "../_shared/cors.ts";

/** Stub: validar assinatura Stripe e atualizar subscriptions. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({
      ok: true,
      stub: true,
      message: "billing-stripe-webhook — implementar Stripe",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
