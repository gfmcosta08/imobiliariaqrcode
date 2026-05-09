import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

export async function GET() {
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

  const [{ data: displayConfig, error: e1 }, { data: plansConfig, error: e2 }] = await Promise.all([
    supabase.from("plan_display_config").select("*").order("plan_code"),
    supabase
      .from("plans")
      .select("code, expiration_days, max_active_properties, max_brokers, has_auto_expiration")
      .order("code"),
  ]);

  if (e1 || e2) {
    return NextResponse.json(
      { ok: false, error: e1?.message ?? e2?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    display: displayConfig ?? [],
    config: plansConfig ?? [],
  });
}
