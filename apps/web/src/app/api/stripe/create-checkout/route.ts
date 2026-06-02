import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { LEGAL_DOCUMENT_VERSIONS } from "@/lib/legal";
import { CHECKOUT_PLAN_CODE, STARTER_MONTHLY_BRL } from "@/lib/plans";
import { stripe, STRIPE_PRICES, type StripePlanCode } from "@/lib/stripe";
import { assertStripeTestModeAllowed } from "@/lib/stripe-guard";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type Body = {
  planCode?: StripePlanCode;
  acceptTerms?: boolean;
  acceptPrivacy?: boolean;
  acceptRefund?: boolean;
};

export async function POST(req: NextRequest) {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "checkout_not_enabled_in_production" },
      { status: 503 },
    );
  }

  try {
    assertStripeTestModeAllowed();
  } catch (err) {
    const message = err instanceof Error ? err.message : "stripe_config_invalid";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const body = (await req.json()) as Body;
  const planCode = body.planCode ?? CHECKOUT_PLAN_CODE;

  if (planCode !== CHECKOUT_PLAN_CODE) {
    return NextResponse.json({ ok: false, error: "invalid_plan" }, { status: 400 });
  }

  if (!body.acceptTerms || !body.acceptPrivacy || !body.acceptRefund) {
    return NextResponse.json(
      { ok: false, error: "legal_acceptance_required" },
      { status: 400 },
    );
  }

  const priceId = STRIPE_PRICES.starter;
  if (!priceId) {
    return NextResponse.json(
      { ok: false, error: "stripe_price_not_configured" },
      { status: 500 },
    );
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

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("account_id, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return NextResponse.json({ ok: false, error: "account_not_found" }, { status: 404 });
  }

  const accountId = profile.account_id as string;

  const { data: account } = await admin
    .from("accounts")
    .select("id, stripe_customer_id")
    .eq("id", accountId)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ ok: false, error: "account_not_found" }, { status: 404 });
  }

  const { error: acceptanceError } = await admin.from("checkout_legal_acceptance_events").insert({
    profile_id: user.id,
    account_id: accountId,
    terms_version: LEGAL_DOCUMENT_VERSIONS.terms,
    privacy_version: LEGAL_DOCUMENT_VERSIONS.privacy,
    refund_cancellation_version: LEGAL_DOCUMENT_VERSIONS.refund_cancellation,
  });
  if (acceptanceError) {
    return NextResponse.json(
      { ok: false, error: "legal_acceptance_persist_failed" },
      { status: 500 },
    );
  }

  let customerId = account.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email ?? user.email ?? undefined,
      name: profile.full_name ?? undefined,
      metadata: { account_id: accountId, profile_id: user.id },
    });
    customerId = customer.id;
    await admin.from("accounts").update({ stripe_customer_id: customerId }).eq("id", accountId);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://farollimoveis-staging.vercel.app";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?checkout=success&plan=${planCode}`,
    cancel_url: `${appUrl}/plans?checkout=canceled`,
    metadata: { account_id: accountId, plan_code: planCode },
    subscription_data: {
      metadata: { account_id: accountId, plan_code: planCode },
    },
    custom_text: {
      submit: {
        message: `Starter R$ ${STARTER_MONTHLY_BRL},00/mes com renovacao automatica. Cancele quando quiser.`,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    url: session.url,
    plan: {
      code: planCode,
      priceBrl: STARTER_MONTHLY_BRL,
      interval: "month",
      autoRenew: true,
    },
  });
}
