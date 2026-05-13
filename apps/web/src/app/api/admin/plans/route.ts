import { getAdminContext } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const { supabase } = admin;
  const [{ data: displayConfig, error: displayError }, { data: plansConfig, error: plansError }] =
    await Promise.all([
      supabase.from("plan_display_config").select("*").order("plan_code"),
      supabase
        .from("plans")
        .select("code, expiration_days, max_active_properties, has_auto_expiration")
        .order("code"),
    ]);

  if (displayError || plansError) {
    return NextResponse.json(
      { ok: false, error: displayError?.message ?? plansError?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    display: displayConfig ?? [],
    config: plansConfig ?? [],
  });
}
