import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { stripe } from "@/lib/stripe";
import { assertStripeTestModeAllowed } from "@/lib/stripe-guard";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST() {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "portal_not_enabled_in_production" },
      { status: 503 },
    );
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

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return NextResponse.json({ ok: false, error: "account_not_found" }, { status: 404 });
  }

  const { data: account } = await admin
    .from("accounts")
    .select("stripe_customer_id")
    .eq("id", profile.account_id)
    .maybeSingle();

  const customerId = account?.stripe_customer_id as string | null;
  if (!customerId) {
    return NextResponse.json({ ok: false, error: "no_stripe_customer" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://farollimoveis-staging.vercel.app";
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/dashboard`,
  });

  return NextResponse.json({ ok: true, url: portal.url });
}
