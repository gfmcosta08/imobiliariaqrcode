import { activateSoloProperty, soloPeriodEndFromNow } from "@/lib/solo-activation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: propertyId } = await params;
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  const { data: broker, error: brokerError } = await admin
    .from("brokers")
    .select("account_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (brokerError) {
    return NextResponse.json({ ok: false, error: brokerError.message }, { status: 500 });
  }
  if (!broker?.account_id) {
    return NextResponse.json({ ok: false, error: "broker_not_found" }, { status: 403 });
  }

  const { data: subscription, error: subscriptionError } = await admin
    .from("subscriptions")
    .select("plan_code, status, current_period_end")
    .eq("account_id", broker.account_id)
    .maybeSingle();

  if (subscriptionError) {
    return NextResponse.json({ ok: false, error: subscriptionError.message }, { status: 500 });
  }
  if (subscription?.plan_code !== "solo" || subscription.status !== "solo_active") {
    return NextResponse.json({ ok: false, error: "not_solo_active" }, { status: 403 });
  }

  const expiresAt =
    subscription.current_period_end && new Date(subscription.current_period_end).getTime() > Date.now()
      ? (subscription.current_period_end as string)
      : soloPeriodEndFromNow();

  try {
    const result = await activateSoloProperty(admin, {
      accountId: broker.account_id as string,
      propertyId,
      expiresAt,
    });

    if (!result.ok) {
      const status = result.error === "property_not_found" ? 404 : 422;
      return NextResponse.json({ ok: false, error: result.error }, { status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "activate_solo_failed" },
      { status: 500 },
    );
  }
}
