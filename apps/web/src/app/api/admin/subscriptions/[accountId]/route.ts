import { getAdminContext } from "@/lib/admin-auth";
import { NextResponse, type NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const { accountId } = await params;
  const body = (await req.json()) as {
    current_period_end?: string | null;
    status?: string;
  };

  const { supabase, userId } = admin;
  const { data: before } = await supabase
    .from("subscriptions")
    .select("status, plan_code, current_period_end, billing_provider")
    .eq("account_id", accountId)
    .maybeSingle();

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.current_period_end !== undefined) updatePayload.current_period_end = body.current_period_end;
  if (body.status !== undefined) updatePayload.status = body.status;

  const { error } = await supabase
    .from("subscriptions")
    .update(updatePayload)
    .eq("account_id", accountId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    account_id: accountId,
    actor_profile_id: userId,
    action: "admin_update_subscription",
    entity_type: "subscriptions",
    entity_id: accountId,
    metadata: { before, after: body },
  });

  return NextResponse.json({ ok: true });
}
