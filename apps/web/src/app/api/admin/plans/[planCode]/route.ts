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
    expiration_days?: number | null;
    max_active_properties?: number | null;
    max_brokers?: number | null;
    has_auto_expiration?: boolean;
  };

  const positiveIntegerFields = ["expiration_days", "max_active_properties", "max_brokers"] as const;
  for (const field of positiveIntegerFields) {
    const value = body[field];
    if (value !== undefined && value !== null && (!Number.isInteger(value) || value < 1)) {
      return NextResponse.json(
        { ok: false, error: "invalid_plan_config", detail: `${field} deve ser nulo ou inteiro maior ou igual a 1.` },
        { status: 400 },
      );
    }
  }

  const { supabase, userId } = admin;
  const { data: before } = await supabase
    .from("plans")
    .select("expiration_days, max_active_properties, max_brokers, has_auto_expiration")
    .eq("code", planCode)
    .maybeSingle();

  const { error } = await supabase.from("plans").update(body).eq("code", planCode);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    account_id: null,
    actor_profile_id: userId,
    action: "admin_update_plan_config",
    entity_type: "plans",
    entity_id: planCode,
    metadata: { before, after: body },
  });

  return NextResponse.json({ ok: true });
}
