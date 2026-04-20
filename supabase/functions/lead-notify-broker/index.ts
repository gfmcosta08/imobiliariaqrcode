import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Notifica o corretor sobre um novo lead.
 * Esta função pode ser chamada manualmente via API ou por outras funções.
 * O trigger de banco em public.leads já enfileira a notificação básica de WhatsApp.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { lead_id } = await req.json();

    if (!lead_id) {
      return new Response(JSON.stringify({ ok: false, error: "missing_lead_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Busca detalhes do lead para a notificação
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(
        `
        *,
        properties (public_id),
        brokers (whatsapp_number, account_id)
      `,
      )
      .eq("id", lead_id)
      .maybeSingle();

    if (leadError || !lead) {
      return new Response(JSON.stringify({ ok: false, error: "lead_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const broker = lead.brokers as any;
    const property = lead.properties as any;

    if (!broker?.whatsapp_number) {
      return new Response(JSON.stringify({ ok: true, message: "no_broker_phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const msg_text =
      `🚨 *Aviso de Lead!* 🚨\n\n` +
      `Você tem um novo lead interessado.\n\n` +
      `📱 Cliente: ${lead.client_phone}\n` +
      (property?.public_id ? `🏠 Imóvel: ${property.public_id}\n` : "") +
      `💼 Origem: ${lead.intent}\n\n` +
      `Atenda-o agora para não perder a venda! 🚀`;

    // Enfileira mensagem de WhatsApp para o corretor
    await supabase.from("whatsapp_messages").insert({
      direction: "outbound",
      provider: "uazapi",
      account_id: broker.account_id,
      property_id: lead.property_id,
      lead_phone: lead.client_phone,
      broker_phone: broker.whatsapp_number,
      message_type: "text",
      status: "queued",
      payload: {
        kind: "lead_notify_manual",
        lead_id: lead.id,
        text: msg_text,
        to_broker: true,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Notificação enfileirada com sucesso",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, detail: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
