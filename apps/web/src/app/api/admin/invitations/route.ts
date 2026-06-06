import { getAdminContext } from "@/lib/admin-auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NextResponse } from "next/server";

type PostgrestLikeError = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message: string;
};

type PendingInvitationRow = {
  id: string;
  status: string;
  temp_auth_user_id: string | null;
  property_id: string | null;
  property_ids: string[] | null;
  property_count: number | null;
  expiration_days_configured: number | null;
};

function randomSixDigits(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function generateUniqueLoginCode(
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomSixDigits();
    const { data } = await supabase
      .from("broker_invitations")
      .select("id")
      .eq("login_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Nao foi possivel gerar um login_code unico");
}

function isMissingTrialColumn(error: PostgrestLikeError | null): boolean {
  if (!error) return false;
  const haystack =
    `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    haystack.includes("trial_started_at") ||
    haystack.includes("trial_used_at") ||
    (haystack.includes("column") && haystack.includes("accounts"))
  );
}

async function ensureBrokerForInvitation(
  supabase: ReturnType<typeof createServiceRoleClient>,
  authUserId: string,
  tempEmail: string,
): Promise<{ id: string; account_id: string } | null> {
  const { data: existing } = await supabase
    .from("brokers")
    .select("id, account_id")
    .eq("profile_id", authUserId)
    .maybeSingle();
  if (existing) return existing as { id: string; account_id: string };

  const { data: accountCreated, error: accountErr } = await supabase
    .from("accounts")
    .insert({})
    .select("id")
    .single();
  if (accountErr || !accountCreated) return null;

  const pendingWhatsapp = `pending-${authUserId.replace(/-/g, "")}`.slice(0, 40);
  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: authUserId,
      account_id: accountCreated.id,
      email: tempEmail,
      full_name: "Corretor Cortesia",
      whatsapp_number: pendingWhatsapp,
      role: "broker",
    },
    { onConflict: "id" },
  );
  if (profileErr) return null;

  const { data: brokerCreated, error: brokerErr } = await supabase
    .from("brokers")
    .upsert(
      {
        account_id: accountCreated.id,
        profile_id: authUserId,
        display_name: "Corretor Cortesia",
        whatsapp_number: pendingWhatsapp,
        status: "active",
      },
      { onConflict: "profile_id" },
    )
    .select("id, account_id")
    .single();
  if (brokerErr || !brokerCreated) return null;
  return brokerCreated as { id: string; account_id: string };
}

async function createDraftPropertyForBroker(
  supabase: ReturnType<typeof createServiceRoleClient>,
  broker: { id: string; account_id: string },
): Promise<string | null> {
  const { data: property, error } = await supabase
    .from("properties")
    .insert({
      account_id: broker.account_id,
      broker_id: broker.id,
      origin_plan_code: "free",
      listing_status: "draft",
      property_type: "Residencial",
      property_subtype: "Apartamento",
      purpose: "sale",
      title: null,
      description: "",
      city: "A preencher",
      state: "A preencher",
    })
    .select("id")
    .single();

  if (error || !property?.id) return null;
  return property.id as string;
}

async function updateAccountTrialState(
  supabase: ReturnType<typeof createServiceRoleClient>,
  accountId: string,
  nowIso: string,
): Promise<{ ok: true; degraded: boolean } | { ok: false; error: PostgrestLikeError }> {
  const firstTry = await supabase
    .from("accounts")
    .update({
      trial_started_at: nowIso,
      trial_used_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", accountId);

  if (!firstTry.error) {
    return { ok: true, degraded: false };
  }

  const firstError = firstTry.error as PostgrestLikeError;
  if (!isMissingTrialColumn(firstError)) {
    return { ok: false, error: firstError };
  }

  const fallbackTry = await supabase
    .from("accounts")
    .update({ updated_at: nowIso })
    .eq("id", accountId);

  if (fallbackTry.error) {
    return { ok: false, error: fallbackTry.error as PostgrestLikeError };
  }

  return { ok: true, degraded: true };
}

export async function POST(req: Request) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const { supabase } = admin;
  const body = (await req.json().catch(() => ({}))) as {
    property_count?: number;
    expiration_days?: number;
  };
  const propertyCount = Number(body.property_count ?? 1);
  const expirationDays = Number(body.expiration_days ?? 30);

  if (!Number.isInteger(propertyCount) || propertyCount < 1) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_property_count",
        detail: "Informe um inteiro maior ou igual a 1.",
      },
      { status: 400 },
    );
  }

  if (!Number.isInteger(expirationDays) || expirationDays < 1) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_expiration_days",
        detail: "Informe um inteiro maior ou igual a 1.",
      },
      { status: 400 },
    );
  }

  const loginCode = await generateUniqueLoginCode(supabase);
  const accessCode = randomSixDigits();
  const tempEmail = `tmp-${loginCode}-${Date.now()}@opencode.internal`;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: tempEmail,
    password: accessCode,
    email_confirm: true,
    user_metadata: {
      must_complete_profile: true,
      full_name: "Corretor Cortesia",
    },
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { ok: false, error: "auth_create_failed", detail: authError?.message },
      { status: 500 },
    );
  }

  const authUserId = authData.user.id;
  const broker = await ensureBrokerForInvitation(supabase, authUserId, tempEmail);

  if (!broker) {
    await supabase.auth.admin.deleteUser(authUserId);
    return NextResponse.json({ ok: false, error: "broker_setup_timeout" }, { status: 500 });
  }

  const now = new Date();
  const freePeriodEnd = new Date(now.getTime() + expirationDays * 86400 * 1000);

  const { error: subscriptionError } = await supabase.from("subscriptions").upsert(
    {
      account_id: broker.account_id,
      plan_code: "free",
      status: "free",
      billing_provider: null,
      provider_customer_id: null,
      provider_subscription_id: null,
      current_period_start: now.toISOString(),
      current_period_end: freePeriodEnd.toISOString(),
      canceled_at: null,
      max_active_properties_override: propertyCount,
      updated_at: now.toISOString(),
    },
    { onConflict: "account_id" },
  );

  if (subscriptionError) {
    await supabase.auth.admin.deleteUser(authUserId);
    return NextResponse.json(
      { ok: false, error: "subscription_create_failed", detail: subscriptionError.message },
      { status: 500 },
    );
  }

  const accountState = await updateAccountTrialState(
    supabase,
    broker.account_id,
    now.toISOString(),
  );
  if (!accountState.ok) {
    await supabase.auth.admin.deleteUser(authUserId);
    return NextResponse.json(
      { ok: false, error: "account_state_update_failed", detail: accountState.error.message },
      { status: 500 },
    );
  }
  if (accountState.degraded) {
    console.warn(
      "[admin/invitations] accounts trial columns ausentes; fallback aplicado para continuar geracao de cortesia",
      { accountId: broker.account_id },
    );
  }

  const propertyIds: string[] = [];
  let firstPropertyId: string | null = null;
  let firstQrToken: string | null = null;

  for (let index = 0; index < propertyCount; index++) {
    const { data: property, error: propError } = await supabase
      .from("properties")
      .insert({
        account_id: broker.account_id,
        broker_id: broker.id,
        origin_plan_code: "free",
        listing_status: "draft",
        property_type: "Residencial",
        property_subtype: "Apartamento",
        purpose: "sale",
        title: null,
        description: "",
        city: "A preencher",
        state: "A preencher",
      })
      .select("id")
      .single();

    if (propError || !property) {
      await supabase.auth.admin.deleteUser(authUserId);
      return NextResponse.json(
        { ok: false, error: "property_create_failed", detail: propError?.message },
        { status: 500 },
      );
    }

    propertyIds.push(property.id as string);
    if (index === 0) firstPropertyId = property.id as string;
  }

  for (let i = 0; i < 5 && firstPropertyId; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const { data } = await supabase
      .from("property_qrcodes")
      .select("qr_token")
      .eq("property_id", firstPropertyId)
      .eq("is_active", true)
      .maybeSingle();
    if (data?.qr_token) {
      firstQrToken = data.qr_token as string;
      break;
    }
  }

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(accessCode));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const accessCodeHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const { error: inviteError } = await supabase.from("broker_invitations").insert({
    login_code: loginCode,
    access_code_hash: accessCodeHash,
    temp_auth_user_id: authUserId,
    temp_email: tempEmail,
    property_id: firstPropertyId,
    property_ids: propertyIds,
    property_count: propertyCount,
    expiration_days_configured: expirationDays,
    status: "pending",
  });

  if (inviteError) {
    await supabase.auth.admin.deleteUser(authUserId);
    return NextResponse.json(
      { ok: false, error: "invitation_create_failed", detail: inviteError.message },
      { status: 500 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const qrUrl = firstQrToken ? `${appUrl}/q/${firstQrToken}` : null;

  return NextResponse.json({
    ok: true,
    login_code: loginCode,
    access_code: accessCode,
    qr_url: qrUrl,
    property_id: firstPropertyId,
    property_count: propertyCount,
  });
}

export async function PATCH(req: Request) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    property_count?: number | string;
    expires_at?: string | null;
  };
  const invitationId = body.id?.trim();
  if (!invitationId) {
    return NextResponse.json({ ok: false, error: "missing_invitation_id" }, { status: 400 });
  }

  const propertyCount = body.property_count === undefined ? undefined : Number(body.property_count);
  if (
    propertyCount !== undefined &&
    (!Number.isInteger(propertyCount) || propertyCount < 1 || propertyCount > 50)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_property_count",
        detail: "Informe um inteiro entre 1 e 50.",
      },
      { status: 400 },
    );
  }

  let expiresAtIso: string | undefined;
  let expirationDaysConfigured: number | undefined;
  if (body.expires_at !== undefined) {
    if (!body.expires_at) {
      return NextResponse.json({ ok: false, error: "invalid_expires_at" }, { status: 400 });
    }
    const parsed = new Date(body.expires_at);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ ok: false, error: "invalid_expires_at" }, { status: 400 });
    }
    expiresAtIso = parsed.toISOString();
    expirationDaysConfigured = Math.max(1, Math.ceil((parsed.getTime() - Date.now()) / 86400000));
  }

  const { supabase } = admin;
  const { data: invitation, error: loadError } = await supabase
    .from("broker_invitations")
    .select(
      "id, status, temp_auth_user_id, property_id, property_ids, property_count, expiration_days_configured",
    )
    .eq("id", invitationId)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json(
      { ok: false, error: "invitation_load_failed", detail: loadError.message },
      { status: 500 },
    );
  }
  if (!invitation) {
    return NextResponse.json({ ok: false, error: "invitation_not_found" }, { status: 404 });
  }

  const pendingInvitation = invitation as PendingInvitationRow;
  if (pendingInvitation.status !== "pending") {
    return NextResponse.json({ ok: false, error: "invitation_not_pending" }, { status: 409 });
  }

  const currentPropertyIds = Array.isArray(pendingInvitation.property_ids)
    ? [...pendingInvitation.property_ids]
    : pendingInvitation.property_id
      ? [pendingInvitation.property_id]
      : [];
  const nextPropertyIds = [...currentPropertyIds];
  let broker: { id: string; account_id: string } | null = null;

  if (pendingInvitation.temp_auth_user_id) {
    const { data: brokerData } = await supabase
      .from("brokers")
      .select("id, account_id")
      .eq("profile_id", pendingInvitation.temp_auth_user_id)
      .maybeSingle();
    broker = brokerData as { id: string; account_id: string } | null;
  }

  if (propertyCount !== undefined && propertyCount > nextPropertyIds.length) {
    if (!broker) {
      return NextResponse.json(
        { ok: false, error: "invitation_broker_not_found" },
        { status: 409 },
      );
    }

    while (nextPropertyIds.length < propertyCount) {
      const propertyId = await createDraftPropertyForBroker(supabase, broker);
      if (!propertyId) {
        return NextResponse.json({ ok: false, error: "property_create_failed" }, { status: 500 });
      }
      nextPropertyIds.push(propertyId);
    }
  }

  const updatePayload: Record<string, unknown> = {};
  if (propertyCount !== undefined) updatePayload.property_count = propertyCount;
  if (expiresAtIso !== undefined) {
    updatePayload.expires_at = expiresAtIso;
    updatePayload.expiration_days_configured = expirationDaysConfigured;
  }
  if (nextPropertyIds.length !== currentPropertyIds.length) {
    updatePayload.property_ids = nextPropertyIds;
    updatePayload.property_id = nextPropertyIds[0] ?? null;
  }

  const { data: updated, error: updateError } = await supabase
    .from("broker_invitations")
    .update(updatePayload)
    .eq("id", invitationId)
    .eq("status", "pending")
    .select(
      "id, login_code, status, generated_at, expires_at, claimed_at, completed_at, property_count, expiration_days_configured",
    )
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { ok: false, error: "invitation_update_failed", detail: updateError?.message },
      { status: 500 },
    );
  }

  if (broker && expiresAtIso) {
    await supabase
      .from("subscriptions")
      .update({ current_period_end: expiresAtIso, updated_at: new Date().toISOString() })
      .eq("account_id", broker.account_id)
      .eq("status", "free");
  }
  if (broker && propertyCount !== undefined) {
    await supabase
      .from("subscriptions")
      .update({
        max_active_properties_override: propertyCount,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", broker.account_id)
      .eq("status", "free");
  }

  return NextResponse.json({ ok: true, invitation: updated });
}

export async function DELETE(req: Request) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const invitationId = new URL(req.url).searchParams.get("id")?.trim();
  if (!invitationId) {
    return NextResponse.json({ ok: false, error: "missing_invitation_id" }, { status: 400 });
  }

  const { supabase } = admin;
  const { data: invitation, error: loadError } = await supabase
    .from("broker_invitations")
    .select("id, status")
    .eq("id", invitationId)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json(
      { ok: false, error: "invitation_load_failed", detail: loadError.message },
      { status: 500 },
    );
  }

  if (!invitation) {
    return NextResponse.json({ ok: false, error: "invitation_not_found" }, { status: 404 });
  }

  if (invitation.status !== "pending") {
    return NextResponse.json({ ok: false, error: "invitation_not_pending" }, { status: 409 });
  }

  const tryCancel = async (status: "canceled" | "expired") =>
    supabase
      .from("broker_invitations")
      .update({ status })
      .eq("id", invitationId)
      .eq("status", "pending");

  let finalStatus: "canceled" | "expired" = "canceled";
  let { error: updateError } = await tryCancel("canceled");

  // Fallback de compatibilidade: ambientes sem a migration de "canceled"
  // continuam funcionais usando "expired", sem quebrar o painel.
  if (updateError && updateError.code === "23514") {
    finalStatus = "expired";
    ({ error: updateError } = await tryCancel("expired"));
  }

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: "invitation_cancel_failed", detail: updateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: invitationId, status: finalStatus });
}
