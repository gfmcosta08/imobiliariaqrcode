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
    plan_code?: string;
    status?: string;
    max_active_properties_override?: number | null;
  };

  const allowedPlans = new Set(["free", "solo", "pro", "premium"]);
  if (body.plan_code !== undefined && !allowedPlans.has(body.plan_code)) {
    return NextResponse.json(
      { ok: false, error: "invalid_plan_code", detail: "Informe um plan_code valido." },
      { status: 400 },
    );
  }

  if (body.max_active_properties_override !== undefined && body.max_active_properties_override !== null) {
    const v = Number(body.max_active_properties_override);
    if (!Number.isInteger(v) || v < 1) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_max_active_properties_override",
          detail: "Informe um inteiro >= 1, ou null para remover override.",
        },
        { status: 400 },
      );
    }
  }

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

  const { supabase, userId } = admin;
  const { data: before } = await supabase
    .from("subscriptions")
    .select("status, plan_code, current_period_end, billing_provider, max_active_properties_override")
    .eq("account_id", accountId)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const updatePayload: Record<string, unknown> = { updated_at: nowIso };

  const planCode = body.plan_code ?? before?.plan_code ?? "free";
  const forceNoExpiry = planCode === "pro" || planCode === "premium";
  const defaultMaxActiveByPlan: Record<string, number> = {
    free: 1,
    solo: 1,
    pro: 999999,
    premium: 999999,
  };

  if (body.plan_code !== undefined) updatePayload.plan_code = body.plan_code;
  if (body.status !== undefined) {
    updatePayload.status = body.status;
  } else if (body.plan_code !== undefined) {
    // If admin changes the plan but does not explicitly override status, keep status coherent.
    const defaultStatusByPlan: Record<string, string> = {
      free: "free",
      solo: "solo_active",
      pro: "pro_active",
      premium: "pro_active",
    };
    updatePayload.status = defaultStatusByPlan[planCode] ?? "free";
  }
  if (body.max_active_properties_override !== undefined) {
    // PRO/PREMIUM: sempre manter um limite salvo automaticamente (default alto), mas admin pode reduzir.
    if (forceNoExpiry) {
      const incoming = body.max_active_properties_override;
      updatePayload.max_active_properties_override =
        incoming == null ? defaultMaxActiveByPlan[planCode] ?? 999999 : incoming;
    } else {
      updatePayload.max_active_properties_override = body.max_active_properties_override;
    }
  } else if (forceNoExpiry) {
    // Se o client não enviar, mantém coerente com regra: sempre ter o máximo salvo.
    updatePayload.max_active_properties_override =
      before?.max_active_properties_override ?? defaultMaxActiveByPlan[planCode] ?? 999999;
  }

  if (forceNoExpiry) {
    // Pro/Premium: sem validade por regra de negócio
    updatePayload.current_period_end = null;
  } else if (body.current_period_end !== undefined) {
    updatePayload.current_period_end = body.current_period_end;
  }

  const { error } = await supabase
    .from("subscriptions")
    .update(updatePayload)
    .eq("account_id", accountId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Propaga plano/validade para anúncios da conta (quando a validade ou plano forem ajustados).
  // Regras:
  // - free/solo: expires_at = current_period_end (ou null se remover validade).
  // - pro/premium: origin_plan_code acompanha o plano e expires_at = null (sem expiração).
  if (body.current_period_end !== undefined || body.plan_code !== undefined) {
    const expireByPlan = planCode === "free" || planCode === "solo";
    const effectivePeriodEnd =
      forceNoExpiry ? null : (body.current_period_end !== undefined ? body.current_period_end : before?.current_period_end ?? null);
    const expiresAt = expireByPlan && effectivePeriodEnd !== null ? effectivePeriodEnd : null;
    const propertyUpdatePayload: Record<string, unknown> = { expires_at: expiresAt };
    if (body.plan_code !== undefined) propertyUpdatePayload.origin_plan_code = planCode;

    const { error: propError } = await supabase
      .from("properties")
      .update(propertyUpdatePayload)
      .eq("account_id", accountId);

    if (propError) {
      return NextResponse.json(
        { ok: false, error: "properties_expiry_update_failed", detail: propError.message },
        { status: 500 },
      );
    }
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
