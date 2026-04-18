import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/env.ts";
import { sendUazapiMessage } from "../_shared/uazapi.ts";

type SendPayload = {
  companyId: string;
  to: string;
  message: string;
  from?: string;
  metadata?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as SendPayload;

    if (!payload.companyId || !payload.to || !payload.message) {
      return new Response(JSON.stringify({ error: "companyId, to, message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const response = await sendUazapiMessage({ to: payload.to, message: payload.message });

    const supabase = getServiceClient();
    await supabase.from("whatsapp_messages").insert({
      company_id: payload.companyId,
      from_number: payload.from ?? "system",
      to_number: payload.to,
      message: payload.message,
      type: "outbound",
      raw_payload: {
        provider_response: response,
        metadata: payload.metadata ?? {}
      }
    });

    return new Response(JSON.stringify({ ok: true, provider: response }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
