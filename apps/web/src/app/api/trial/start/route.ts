import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return NextResponse.json({ error: "Conta nao encontrada." }, { status: 404 });
  }

  const { data: account } = await admin
    .from("accounts")
    .select("id, trial_used_at")
    .eq("id", profile.account_id)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ error: "Conta nao encontrada." }, { status: 404 });
  }

  if (account.trial_used_at) {
    return NextResponse.json({ error: "Teste de 30 dias ja utilizado." }, { status: 409 });
  }

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("plan_code, status")
    .eq("account_id", account.id)
    .maybeSingle();

  if (subscription?.status === "solo_active" || subscription?.status === "pro_active") {
    return NextResponse.json(
      { error: "Conta ja possui um plano pago ativo." },
      { status: 409 },
    );
  }

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 86400 * 1000);

  const { error: upsertError } = await admin.from("subscriptions").upsert(
    {
      account_id: account.id,
      plan_code: "free",
      status: "free",
      billing_provider: null,
      provider_customer_id: null,
      provider_subscription_id: null,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      canceled_at: null,
      updated_at: now.toISOString(),
    },
    { onConflict: "account_id" },
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const { error: accountError } = await admin
    .from("accounts")
    .update({
      trial_started_at: now.toISOString(),
      trial_used_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", account.id);

  if (accountError) {
    return NextResponse.json({ error: accountError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    plan_code: "free",
    status: "free",
    current_period_end: periodEnd.toISOString(),
  });
}
