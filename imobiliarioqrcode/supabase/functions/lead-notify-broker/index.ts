import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

const ALLOWED_INTENTS = ["visit_interest", "similar_property_interest"];
const ALLOWED_STATUSES = ["new", "contacted", "scheduled", "closed", "invalid"];

interface LeadUpdate {
  id: string;
  client_name?: string;
  notes?: string;
  broker_notes?: string;
  status?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (req.method === "GET" && id) {
      const { data: lead, error } = await supabase
        .from("leads")
        .select("id, client_name, client_phone, notes, broker_notes, status, intent, source, created_at, property:properties(id, public_id, city, state)")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!lead) {
        return new Response(JSON.stringify({ ok: false, error: "lead_not_found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true, lead }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "PATCH" && id) {
      const body = await req.json();
      const updateData: Record<string, unknown> = {};

      if (typeof body.client_name === "string") {
        updateData.client_name = body.client_name.trim() || null;
      }
      if (typeof body.notes === "string") {
        updateData.notes = body.notes.trim() || null;
      }
      if (typeof body.broker_notes === "string") {
        updateData.broker_notes = body.broker_notes.trim() || null;
      }
      if (typeof body.status === "string" && ALLOWED_STATUSES.includes(body.status)) {
        updateData.status = body.status;
      }

      if (Object.keys(updateData).length === 0) {
        return new Response(JSON.stringify({ ok: false, error: "no_valid_fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      updateData.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});