import { NextRequest, NextResponse } from "next/server";

import { stripe, STRIPE_PRICES, type StripePlanCode } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(req: NextRequest) {
  const supabaseUser = await createClient();

  const {
    data: { user },
  } = await supabaseUser.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { planCode } = (await req.json()) as { planCode: StripePlanCode };
  const priceId = STRIPE_PRICES[planCode];

  if (!priceId) {
    return NextResponse.json(
      { error: "Plano inválido ou preço Stripe não configurado." },
      { status: 400 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL não configurada." }, { status: 500 });
  }

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("account_id, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  }

  const { data: account } = await admin
    .from("accounts")
    .select("id, stripe_customer_id")
    .eq("id", profile.account_id)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  }

  let customerId = account.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email ?? user.email ?? undefined,
      name: profile.full_name ?? undefined,
      metadata: { account_id: account.id, profile_id: user.id },
    });
    customerId = customer.id;

    await admin.from("accounts").update({ stripe_customer_id: customerId }).eq("id", account.id);
  }

  const isSolo = planCode === "solo";
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: isSolo ? "payment" : "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?checkout=success&plan=${planCode}`,
    cancel_url: `${appUrl}/plans?checkout=canceled`,
    metadata: { account_id: account.id, plan_code: planCode },
    ...(isSolo
      ? {}
      : {
          subscription_data: {
            metadata: { account_id: account.id, plan_code: planCode },
          },
        }),
  });

  return NextResponse.json({ url: session.url });
}
