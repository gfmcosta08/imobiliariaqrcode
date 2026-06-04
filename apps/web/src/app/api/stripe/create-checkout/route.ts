import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { recordActivationEvent } from "@/lib/analytics/activation-events";
import { stripe } from "@/lib/stripe";
import { assertStripeTestModeAllowed } from "@/lib/stripe-guard";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST() {
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

  try {
    assertStripeTestModeAllowed();
  } catch (err) {
    const message = err instanceof Error ? err.message : "stripe_config_invalid";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
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
  const customerEmail = user.email?.trim() || undefined;
  const { data: account } = await admin
    .from("accounts")
    .select("stripe_customer_id")
    .eq("id", accountId)
    .maybeSingle();

  async function createCustomer() {
    const customer = await stripe.customers.create({
      email: customerEmail,
      metadata: { account_id: accountId },
    });
    await admin
      .from("accounts")
      .update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
      .eq("id", accountId);
    return customer.id;
  }

  let customerId = (account?.stripe_customer_id as string | null) ?? null;
  if (!customerId) {
    customerId = await createCustomer();
  } else if (customerEmail) {
    try {
      await stripe.customers.update(customerId, {
        email: customerEmail,
        metadata: { account_id: accountId },
      });
    } catch (err) {
      console.warn("stripe customer email repair failed; creating replacement customer", {
        accountId,
        customerId,
        error: err instanceof Error ? err.message : "unknown_error",
      });
      customerId = await createCustomer();
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://farollimoveis-staging.vercel.app";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/plans?checkout=canceled`,
    metadata: {
      account_id: accountId,
      plan_code: "starter",
    },
    subscription_data: {
      metadata: {
        account_id: accountId,
        plan_code: "starter",
      },
    },
  });

  if (!session.url) {
    return NextResponse.json({ ok: false, error: "checkout_url_missing" }, { status: 500 });
  }

  await recordActivationEvent(admin, {
    account_id: accountId,
    profile_id: user.id,
    event_name: "checkout_started",
    entity_type: "checkout_session",
  });

  return NextResponse.json({ ok: true, url: session.url });
}
