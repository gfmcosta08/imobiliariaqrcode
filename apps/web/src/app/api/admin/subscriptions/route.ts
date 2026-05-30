import { getAdminContext } from "@/lib/admin-auth";
import { NextResponse, type NextRequest } from "next/server";

type SubscriptionRow = {
  id: string;
  account_id: string;
  plan_code: string;
  status: string;
  max_active_properties_override?: number | null;
  billing_provider: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  updated_at: string;
  accounts: unknown;
};

export async function GET(req: NextRequest) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }
  const supabase = admin.supabase;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const searchLower = search.toLowerCase();
  const status = searchParams.get("status") ?? "";
  const plan = searchParams.get("plan") ?? "";

  const baseSelect =
    `id, account_id, plan_code, status,
     max_active_properties_override,
     billing_provider, current_period_start, current_period_end,
     canceled_at, updated_at,
     accounts (
       stripe_customer_id,
       profiles (email, full_name)
     )`;

  // Note: PostgREST filtering on deep embedded relations is finicky and can cause false negatives.
  // For admin UX, correctness is more important than micro-optimizations: we fetch a larger slice
  // and filter in-memory using a stable shape normalizer.
  let q = supabase
    .from("subscriptions")
    .select(baseSelect)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (status) q = q.eq("status", status);
  if (plan) q = q.eq("plan_code", plan);

  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const normalized = (rows ?? []) as SubscriptionRow[];
  if (!search) return NextResponse.json({ ok: true, data: normalized });

  const filtered = normalized.filter((sub) => {
    const accounts = (sub as unknown as { accounts?: unknown }).accounts;
    const accountUnknown: unknown = Array.isArray(accounts) ? accounts[0] : accounts;
    const account = (accountUnknown && typeof accountUnknown === "object")
      ? (accountUnknown as Record<string, unknown>)
      : null;
    const profiles = account?.profiles as unknown;
    const profile = Array.isArray(profiles) ? profiles[0] : profiles;
    const profileObj =
      profile && typeof profile === "object" ? (profile as Record<string, unknown>) : null;
    const email = String(profileObj?.email ?? "").toLowerCase();
    const fullName = String(profileObj?.full_name ?? "").toLowerCase();
    const stripeCustomerId = String(account?.stripe_customer_id ?? "").toLowerCase();
    const accountId = String(sub.account_id ?? "").toLowerCase();
    return (
      email.includes(searchLower) ||
      fullName.includes(searchLower) ||
      stripeCustomerId.includes(searchLower) ||
      accountId.includes(searchLower)
    );
  });

  return NextResponse.json({ ok: true, data: filtered });
}
