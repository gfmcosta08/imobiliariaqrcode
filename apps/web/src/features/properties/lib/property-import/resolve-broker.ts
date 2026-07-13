import type { SupabaseClient } from "@supabase/supabase-js";

const ACTIVE_SUB_STATUSES = ["free", "starter_active", "pro_pending_activation", "pro_active"];

export type ResolvedBroker = {
  broker: { id: string; account_id: string };
  planCode: string;
};

export async function resolveBrokerForImport(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
): Promise<ResolvedBroker | { error: string; status: number }> {
  const isProduction = process.env.VERCEL_ENV === "production";

  let { data: broker } = await supabase
    .from("brokers")
    .select("id, account_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!broker && !isProduction) {
    const fallbackName =
      (user.user_metadata?.full_name as string | undefined)?.trim() ||
      user.email?.split("@")[0] ||
      "Corretor Teste";
    const fallbackWhatsapp =
      (user.user_metadata?.whatsapp_number as string | undefined)?.trim() ||
      `pending-${user.id.replace(/-/g, "")}`;

    let accountId: string | null = null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.account_id) {
      accountId = profile.account_id as string;
    } else {
      const { data: accountCreated, error: accountErr } = await supabase
        .from("accounts")
        .insert({})
        .select("id")
        .single();
      if (accountErr || !accountCreated) {
        return { error: accountErr?.message ?? "account_create_failed", status: 500 };
      }
      accountId = accountCreated.id as string;
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          account_id: accountId,
          email: user.email ?? `${user.id}@preview.local`,
          full_name: fallbackName,
          whatsapp_number: fallbackWhatsapp,
          role: "broker",
        },
        { onConflict: "id" },
      );
    }

    const { data: brokerCreated, error: brokerErr } = await supabase
      .from("brokers")
      .upsert(
        {
          account_id: accountId,
          profile_id: user.id,
          display_name: fallbackName,
          whatsapp_number: fallbackWhatsapp,
          status: "active",
        },
        { onConflict: "profile_id" },
      )
      .select("id, account_id")
      .single();

    if (brokerErr || !brokerCreated) {
      return { error: brokerErr?.message ?? "broker_create_failed", status: 500 };
    }
    broker = brokerCreated;
    await supabase
      .from("subscriptions")
      .upsert(
        { account_id: accountId, plan_code: "free", status: "free" },
        { onConflict: "account_id" },
      );
  }

  if (!broker) {
    return { error: "broker_not_found", status: 403 };
  }

  const { data: subscriptionRow } = await supabase
    .from("subscriptions")
    .select("plan_code, status")
    .eq("account_id", broker.account_id)
    .maybeSingle();

  const subscription =
    subscriptionRow && ACTIVE_SUB_STATUSES.includes(subscriptionRow.status)
      ? subscriptionRow
      : !isProduction
        ? { plan_code: "free", status: "free" }
        : null;

  if (!subscription) {
    return { error: "no_active_plan", status: 403 };
  }

  return { broker, planCode: subscription.plan_code };
}
