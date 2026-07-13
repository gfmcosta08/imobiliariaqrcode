import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { assertStripeTestModeAllowed } from "../lib/stripe-guard";
import { stripe } from "../lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

function isQaEmail(email: string | undefined): boolean {
  return /(^|[.@_-])qa([.@_-]|$)/i.test(email ?? "") || /@teste\.com$/i.test(email ?? "");
}

export async function POST() {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ ok: false, error: "not_available" }, { status: 404 });
  }

  try {
    assertStripeTestModeAllowed();
  } catch (err) {
    const message = err instanceof Error ? err.message : "stripe_config_invalid";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  if (!isQaEmail(user.email)) {
    return NextResponse.json({ ok: false, error: "qa_user_required" }, { status: 403 });
  }

  const priceId =
    process.env.STRIPE_STARTER_PRICE_ID?.trim() || process.env.STRIPE_PRICE_STARTER?.trim();
  if (!priceId) {
    return NextResponse.json({ ok: false, error: "stripe_price_missing" }, { status: 500 });
  }

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return NextResponse.json({ ok: false, error: "account_not_found" }, { status: 404 });
  }

  const accountId = profile.account_id as string;
  const now = Math.floor(Date.now() / 1000);
  const trialEnd = now + 120;
  const testClock = await stripe.testHelpers.testClocks.create({
    frozen_time: now,
    name: `qa-payment-failed-${accountId.slice(0, 8)}`,
  });
  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    test_clock: testClock.id,
    metadata: { account_id: accountId },
  });
  const paymentMethod = await stripe.paymentMethods.attach("pm_card_chargeCustomerFail", {
    customer: customer.id,
  });
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: paymentMethod.id },
    metadata: { account_id: accountId },
  });

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId, quantity: 1 }],
    trial_end: trialEnd,
    metadata: {
      account_id: accountId,
      plan_code: "starter",
    },
  });

  await admin
    .from("subscriptions")
    .update({
      provider_customer_id: customer.id,
      provider_subscription_id: subscription.id,
      billing_provider: "stripe",
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", accountId);

  await stripe.testHelpers.testClocks.advance(testClock.id, {
    frozen_time: trialEnd + 3600,
  });

  return NextResponse.json({
    ok: true,
    account_id: accountId,
    test_clock_id: testClock.id,
    stripe_customer_id: customer.id,
    stripe_subscription_id: subscription.id,
  });
}
