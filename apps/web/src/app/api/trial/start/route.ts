import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

type PostgrestLikeError = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message: string;
};

function isMissingTrialColumn(error: PostgrestLikeError | null): boolean {
  if (!error) return false;
  const haystack =
    `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    haystack.includes("trial_started_at") ||
    haystack.includes("trial_used_at") ||
    (haystack.includes("column") && haystack.includes("accounts"))
  );
}

async function updateAccountTrialState(
  admin: ReturnType<typeof createServiceRoleClient>,
  accountId: string,
  nowIso: string,
): Promise<{ ok: true; degraded: boolean } | { ok: false; error: PostgrestLikeError }> {
  const firstTry = await admin
    .from("accounts")
    .update({
      trial_started_at: nowIso,
      trial_used_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", accountId);

  if (!firstTry.error) {
    return { ok: true, degraded: false };
  }

  const firstError = firstTry.error as PostgrestLikeError;
  if (!isMissingTrialColumn(firstError)) {
    return { ok: false, error: firstError };
  }

  const fallbackTry = await admin
    .from("accounts")
    .update({ updated_at: nowIso })
    .eq("id", accountId);

  if (fallbackTry.error) {
    return { ok: false, error: fallbackTry.error as PostgrestLikeError };
  }

  return { ok: true, degraded: true };
}

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
    .select("id")
    .eq("id", profile.account_id)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ error: "Conta nao encontrada." }, { status: 404 });
  }

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("plan_code, status, current_period_start, current_period_end")
    .eq("account_id", account.id)
    .maybeSingle();

  if (subscription?.status === "starter_active" || subscription?.status === "pro_active") {
    return NextResponse.json({ error: "Conta ja possui um plano pago ativo." }, { status: 409 });
  }

  const trialAlreadyUsed = Boolean(
    subscription?.current_period_start || subscription?.current_period_end,
  );
  if (trialAlreadyUsed) {
    return NextResponse.json({ error: "Teste de 30 dias ja utilizado." }, { status: 409 });
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

  const accountState = await updateAccountTrialState(admin, account.id, now.toISOString());
  if (!accountState.ok) {
    return NextResponse.json({ error: accountState.error.message }, { status: 500 });
  }
  if (accountState.degraded) {
    console.warn(
      "[trial/start] accounts trial columns ausentes; fallback aplicado para manter fluxo operacional",
      { accountId: account.id },
    );
  }

  return NextResponse.json({
    ok: true,
    plan_code: "free",
    status: "free",
    current_period_end: periodEnd.toISOString(),
  });
}
