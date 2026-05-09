import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

async function getAdminUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseUser = createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  });
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  return user?.id ?? null;
}

export async function GET(req: NextRequest) {
  const userId = await getAdminUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const supabase = createServiceRoleClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const plan = searchParams.get("plan") ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let filtered: any[] = data ?? [];
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((s) => {
      const p = s.accounts?.profiles;
      return (
        (p?.email ?? "").toLowerCase().includes(q) ||
        (p?.full_name ?? "").toLowerCase().includes(q)
      );
    });
  }

  return NextResponse.json({ ok: true, data: filtered });
}
