import { getAdminContext } from "@/lib/admin-auth";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.toLowerCase() ?? "";
  const status = searchParams.get("status") ?? "";
  const plan = searchParams.get("plan") ?? "";

  let query = admin.supabase
    .from("subscriptions")
    .select(
      `id, account_id, plan_code, status,
       billing_provider, current_period_start, current_period_end,
       canceled_at, updated_at,
       accounts!inner (
         stripe_customer_id,
         profiles (email, full_name)
       )`,
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status", status);
  if (plan) query = query.eq("plan_code", plan);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const filtered = search
    ? (data ?? []).filter((subscription) => {
        const accounts = Array.isArray(subscription.accounts)
          ? subscription.accounts[0]
          : subscription.accounts;
        const profiles = accounts?.profiles;
        const profile = Array.isArray(profiles) ? profiles[0] : profiles;
        return (
          String(profile?.email ?? "")
            .toLowerCase()
            .includes(search) ||
          String(profile?.full_name ?? "")
            .toLowerCase()
            .includes(search)
        );
      })
    : (data ?? []);

  return NextResponse.json({ ok: true, data: filtered });
}
