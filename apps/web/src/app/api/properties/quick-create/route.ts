import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const ACTIVE_SUB_STATUSES = [
  "trial_active",
  "solo_active",
  "pro_pending_activation",
  "pro_active",
  "premium_active",
];

export async function POST() {
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { data: broker } = await supabase
    .from("brokers")
    .select("id, account_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!broker) return NextResponse.json({ ok: false, error: "broker_not_found" }, { status: 403 });

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_code, status")
    .eq("account_id", broker.account_id)
    .maybeSingle();

  if (!subscription || !ACTIVE_SUB_STATUSES.includes(subscription.status)) {
    return NextResponse.json({ ok: false, error: "no_active_plan" }, { status: 403 });
  }

  const { data: plan } = await supabase
    .from("plans")
    .select("max_active_properties")
    .eq("code", subscription.plan_code)
    .maybeSingle();

  if (plan?.max_active_properties != null) {
    const { count } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("account_id", broker.account_id)
      .in("listing_status", ["published", "printed"]);

    if ((count ?? 0) >= plan.max_active_properties) {
      return NextResponse.json({ ok: false, error: "plan_limit_reached" }, { status: 422 });
    }
  }

  const { data: property, error: propError } = await supabase
    .from("properties")
    .insert({
      account_id: broker.account_id,
      broker_id: broker.id,
      origin_plan_code: subscription.plan_code,
      listing_status: "draft",
      property_type: "residential",
      property_subtype: "apartment",
      purpose: "sale",
      title: null,
      description: "",
      city: "",
      state: "",
    })
    .select("id, public_id")
    .single();

  if (propError || !property) {
    return NextResponse.json(
      { ok: false, error: "property_create_failed", detail: propError?.message },
      { status: 500 },
    );
  }

  let qrToken: string | null = null;
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const { data } = await supabase
      .from("property_qrcodes")
      .select("qr_token")
      .eq("property_id", property.id)
      .eq("is_active", true)
      .maybeSingle();
    if (data?.qr_token) {
      qrToken = data.qr_token as string;
      break;
    }
  }

  return NextResponse.json({
    ok: true,
    property_id: property.id,
    public_id: property.public_id,
    qr_token: qrToken,
    listing_status: "draft",
  });
}
