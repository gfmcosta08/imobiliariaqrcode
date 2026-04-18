import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

type InboundInput = {
  lead_phone?: string;
  text?: string;
  event_id?: string;
  is_audio?: boolean;
  payload?: Record<string, unknown>;
};

const YES = /^(sim|s|yes|y|1|quero)$/i;
const NO = /^(nao|não|n|no|0)$/i;

function isOption(text: string, option: string): boolean {
  const t = text.trim();
  return t === option || new RegExp(`^${option}\\s*[-–—:]`, "i").test(t);
}

function matchChoice1(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (/^(1|s|sim|yes|y|quero)$/.test(t)) return true;
  if (/\b(agendar|visita|visitar|marcar)\b/.test(t)) return true;
  return false;
}

function matchChoice2(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (/^2$/.test(t)) return true;
  return false;
}

function matchChoice3(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (/^3$/.test(t)) return true;
  return false;
}

function matchNo(text: string): boolean {
  const t = text.toLowerCase().trim();
  return /^(n[aã]o|n|no|0)$/.test(t);
}

function normalizePhone(v: string): string {
  return v.replace(/\D/g, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: InboundInput = await req.json();
    const leadPhone = normalizePhone(input.lead_phone ?? "");
    const text = (input.text ?? "").trim();

    if (!leadPhone) {
      return new Response(JSON.stringify({ ok: false, error: "missing_lead_phone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await supabase.from("whatsapp_messages").insert({
      direction: "inbound",
      provider: "uazapi",
      lead_phone: leadPhone,
      message_type: input.is_audio ? "audio" : "text",
      status: "received",
      payload: input.payload ?? {},
    });

    let session = await supabase
      .from("conversation_sessions")
      .select("*")
      .eq("lead_phone", leadPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) {
      const { data: newSession } = await supabase
        .from("conversation_sessions")
        .insert({
          lead_phone: leadPhone,
          state: "started",
          last_menu: "welcome",
        })
        .select()
        .single();
      session = newSession;
    }

    return new Response(JSON.stringify({ ok: true, state: session?.state ?? "started" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: "unexpected", detail: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});