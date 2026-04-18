import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

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
    const token = searchParams.get("token") ?? searchParams.get("qr_token");

    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: "missing_token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("property_qrcodes")
      .select("qr_token, is_active, properties(id, public_id, broker_id, account_id, listing_status, origin_plan_code, title, description, highlights, property_type, property_subtype, purpose, city, state, neighborhood, city_region, full_address, bedrooms, suites, bathrooms, parking_spaces, living_rooms, floors_count, area_m2, built_area_m2, total_area_m2, land_area_m2, price, sale_price, rent_price, condo_fee, iptu_amount, other_fees, accepts_financing, accepts_trade, is_furnished, furnishing_status, floor_type, sun_position, construction_type, finish_standard, property_age_years, features, infrastructure, security_items, nearby_points, distance_to_center_km, documentation_status, has_deed, has_registration, technical_details, documentation)")
      .eq("qr_token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    if (!data?.properties) {
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const p = Array.isArray(data.properties) ? data.properties[0] : data.properties;
    if (!p || p.listing_status === "removed" || p.listing_status === "blocked" || p.listing_status === "expired") {
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: broker } = await supabase
      .from("brokers")
      .select("whatsapp_number, name")
      .eq("id", p.broker_id)
      .maybeSingle();

    const brokerPhone = broker?.whatsapp_number ? String(broker.whatsapp_number).replace(/\D/g, "") : null;
    const waLink = brokerPhone ? `https://wa.me/55${brokerPhone}` : null;

    return new Response(JSON.stringify({
      ok: true,
      property: p,
      broker: broker ? { name: broker.name, wa_link: waLink } : null,
    }), {
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