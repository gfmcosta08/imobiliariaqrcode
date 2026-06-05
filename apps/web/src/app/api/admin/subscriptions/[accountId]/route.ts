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
    plan_code?: string;
  };
  const allowedStatuses = new Set([
    "free",
    "starter_active",
    "solo_active",
    "pro_active",
    "past_due",
    "canceled",
  ]);
  const allowedPlans = new Set(["free", "starter", "solo", "pro"]);

  if (
    body.current_period_end !== undefined &&
    body.current_period_end !== null &&
    Number.isNaN(new Date(body.current_period_end).getTime())
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid_current_period_end", detail: "Informe uma data valida." },
      { status: 400 },
    );
  }
  if (body.status !== undefined && !allowedStatuses.has(body.status)) {
    return NextResponse.json(
      { ok: false, error: "invalid_status", detail: "Status invalido para este ambiente." },
      { status: 400 },
    );
  }
  if (body.plan_code !== undefined && !allowedPlans.has(body.plan_code)) {
    return NextResponse.json(
      { ok: false, error: "invalid_plan_code", detail: "Plano invalido para este ambiente." },
      { status: 400 },
    );
  }

  const { supabase, userId } = admin;
  const { data: before } = await supabase
    .from("subscriptions")
    .select("status, plan_code, current_period_end, billing_provider")
    .eq("account_id", accountId)
    .maybeSingle();

  const targetStatus = body.status ?? before?.status;
  const targetPlan = body.plan_code ?? before?.plan_code;
  const combos: Record<string, string[]> = {
    free: ["free"],
    starter_active: ["starter"],
    solo_active: ["solo"],
    pro_active: ["pro"],
    past_due: ["starter", "solo", "pro"],
    canceled: ["free", "starter", "solo", "pro"],
  };
  if (targetStatus && targetPlan && !(combos[targetStatus] ?? []).includes(targetPlan)) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_subscription_combination",
        detail: `Combinacao invalida: status ${targetStatus} exige plano compativel.`,
      },
      { status: 400 },
    );
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.current_period_end !== undefined)
    updatePayload.current_period_end = body.current_period_end;
  if (body.status !== undefined) updatePayload.status = body.status;
  if (body.plan_code !== undefined) updatePayload.plan_code = body.plan_code;

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
