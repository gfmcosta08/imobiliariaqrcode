import { getAdminContext } from "@/lib/admin-auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NextResponse } from "next/server";

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
      { ok: false, error: "invalid_property_count", detail: "Informe um inteiro maior ou igual a 1." },
      { status: 400 },
    );
  }

  if (!Number.isInteger(expirationDays) || expirationDays < 1) {
    return NextResponse.json(
      { ok: false, error: "invalid_expiration_days", detail: "Informe um inteiro maior ou igual a 1." },
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
  let broker: { id: string; account_id: string } | null = null;

  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const { data } = await supabase
      .from("brokers")
      .select("id, account_id")
      .eq("profile_id", authUserId)
      .maybeSingle();
    if (data) {
      broker = data as { id: string; account_id: string };
      break;
    }
  }

  if (!broker) {
    await supabase.auth.admin.deleteUser(authUserId);
    return NextResponse.json({ ok: false, error: "broker_setup_timeout" }, { status: 500 });
  }

  const now = new Date();
  const trialEnd = new Date(now.getTime() + expirationDays * 86400 * 1000);

  const { error: trialError } = await supabase.from("subscriptions").upsert(
    {
      account_id: broker.account_id,
      plan_code: "trial",
      status: "trial_active",
      billing_provider: null,
      provider_customer_id: null,
      provider_subscription_id: null,
      current_period_start: now.toISOString(),
      current_period_end: trialEnd.toISOString(),
      canceled_at: null,
      updated_at: now.toISOString(),
    },
    { onConflict: "account_id" },
  );

  if (trialError) {
    await supabase.auth.admin.deleteUser(authUserId);
    return NextResponse.json(
      { ok: false, error: "trial_create_failed", detail: trialError.message },
      { status: 500 },
    );
  }

  const { error: accountTrialError } = await supabase
    .from("accounts")
    .update({
      trial_started_at: now.toISOString(),
      trial_used_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", broker.account_id);

  if (accountTrialError) {
    await supabase.auth.admin.deleteUser(authUserId);
    return NextResponse.json(
      { ok: false, error: "trial_account_update_failed", detail: accountTrialError.message },
      { status: 500 },
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
        origin_plan_code: "trial",
        listing_status: "draft",
        property_type: "residential",
        property_subtype: "apartment",
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
