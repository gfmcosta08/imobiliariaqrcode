import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

type ResolveBody = { qr_token?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let qr_token = url.searchParams.get("token") ?? undefined;

    if (!qr_token && (req.method === "POST" || req.method === "PUT")) {
      const body = (await req.json()) as ResolveBody;
      qr_token = body.qr_token;
    }

    if (!qr_token) {
      return json({ ok: false, reason: "missing_token" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: row, error } = await supabase
      .from("property_qrcodes")
      .select(
        `
        qr_token,
        is_active,
        properties (
          id,
          public_id,
          listing_status,
          expires_at,
          origin_plan_code,
          broker_id,
          title,
          city,
          state,
          purpose,
          price
        )
      `,
      )
      .eq("qr_token", qr_token)
      .maybeSingle();

    if (error) {
      return json({ ok: false, reason: "db_error", detail: error.message }, 500);
    }

    const nested = row?.properties as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | null
      | undefined;
    const p = Array.isArray(nested) ? nested[0] : nested;

    if (!row || !p) {
      return json({ ok: true, state: "not_found" });
    }
    const listingStatus = String(p.listing_status);
    const originPlan = String(p.origin_plan_code);
    const expiresAt = p.expires_at ? new Date(String(p.expires_at)) : null;

    if (!row.is_active || listingStatus === "removed" || listingStatus === "blocked") {
      return json({
        ok: true,
        state: "unavailable",
        message: "Este anúncio não está mais disponível.",
      });
    }

    if (listingStatus === "expired") {
      return json({
        ok: true,
        state: "expired",
        message: "Este anúncio não está mais disponível.",
      });
    }

    if (originPlan === "free" && expiresAt && expiresAt < new Date()) {
      return json({
        ok: true,
        state: "expired",
        message: "Este anúncio não está mais disponível.",
      });
    }

    const brokerId = String(p.broker_id);
    const { data: broker } = await supabase
      .from("brokers")
      .select("whatsapp_number")
      .eq("id", brokerId)
      .maybeSingle();

    const leadStartText = encodeURIComponent(
      `IMOVEL ${row.qr_token} - Tenho interesse no imóvel ${String(p.public_id ?? "")}.`,
    );
    const wa = broker?.whatsapp_number
      ? `https://wa.me/${String(broker.whatsapp_number).replace(/\D/g, "")}?text=${leadStartText}`
      : null;

    return json({
      ok: true,
      state: "active",
      property_id: p.id,
      public_id: p.public_id,
      broker_id: brokerId,
      broker_whatsapp: broker?.whatsapp_number ?? null,
      whatsapp_link: wa,
      listing: {
        title: p.title ?? null,
        city: p.city ?? null,
        state: p.state ?? null,
        purpose: p.purpose ?? null,
        price: p.price != null ? Number(p.price) : null,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ ok: false, reason: "unexpected", detail: message }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
