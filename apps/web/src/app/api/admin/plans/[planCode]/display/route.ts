import { getAdminContext } from "@/lib/admin-auth";
import { NextResponse, type NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ planCode: string }> },
) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const { planCode } = await params;
  const body = (await req.json()) as {
    display_name?: string;
    display_price?: string;
    display_suffix?: string;
    display_note?: string;
    display_label?: string;
    display_featured?: boolean;
    features?: string[];
  };

  const { supabase, userId } = admin;
  const { data: before } = await supabase
    .from("plan_display_config")
    .select("*")
    .eq("plan_code", planCode)
    .maybeSingle();

  const { error } = await supabase.from("plan_display_config").upsert(
    {
      plan_code: planCode,
      ...body,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: "plan_code" },
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    account_id: null,
    actor_profile_id: userId,
    action: "admin_update_plan_display",
    entity_type: "plan_display_config",
    entity_id: planCode,
    metadata: { before, after: body },
  });

  return NextResponse.json({ ok: true });
}
