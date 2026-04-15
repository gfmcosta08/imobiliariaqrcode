import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

type Body = { property_id?: string; event_type?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, reason: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ ok: false, reason: "unauthorized" }, 401);
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      return json({ ok: false, reason: "invalid_session" }, 401);
    }

    const { data: partnerRow } = await supabaseUser
      .from("partner_users")
      .select("partner_id")
      .eq("profile_id", userData.user.id)
      .maybeSingle();

    if (!partnerRow?.partner_id) {
      return json({ ok: false, reason: "forbidden_partner" }, 403);
    }

    const body = (await req.json()) as Body;
    const property_id = body.property_id;
    if (!property_id) {
      return json({ ok: false, reason: "missing_property_id" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await supabaseAdmin.rpc("register_print_event", {
      p_property_id: property_id,
      p_partner_id: partnerRow.partner_id,
      p_partner_user_profile_id: userData.user.id,
      p_event_type: body.event_type ?? "print_registered",
    });

    if (error) {
      return json({ ok: false, reason: "rpc_error", detail: error.message }, 400);
    }

    return new Response(JSON.stringify(data ?? { ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ ok: false, reason: "unexpected", detail: message }, 500);
  }
});

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
