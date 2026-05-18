import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NextRequest, NextResponse } from "next/server";

type Body = {
  email?: string;
  password?: string;
  fullName?: string;
  whatsapp?: string;
};

export async function POST(req: NextRequest) {
  const { email, password, fullName, whatsapp } = (await req.json()) as Body;

  if (!email?.trim() || !password) {
    return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = fullName?.trim() || normalizedEmail.split("@")[0] || "Corretor";
  const normalizedWhatsapp = (whatsapp ?? "").replace(/\D/g, "");
  const triggerSafeWhatsapp = `pending-${crypto.randomUUID().replace(/-/g, "")}`.slice(0, 40);

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (existingProfile) {
    return NextResponse.json({ error: "Este e-mail ja esta cadastrado." }, { status: 409 });
  }

  const { data: createdUser, error } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: normalizedName,
      whatsapp_number: triggerSafeWhatsapp,
    },
  });

  if (error) {
    const alreadyExists = error.message.toLowerCase().includes("already") || error.message.toLowerCase().includes("exists");
    return NextResponse.json(
      { error: alreadyExists ? "Este e-mail ja esta cadastrado." : error.message },
      { status: alreadyExists ? 409 : 400 },
    );
  }

  const userId = createdUser.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Falha ao criar usuario" }, { status: 500 });
  }

  // Preview/dev hardening: provision profile/broker/subscription explicitly to avoid
  // fragile DB trigger dependencies in staging datasets.
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", userId)
    .maybeSingle();

  let accountId = profile?.account_id as string | null;
  if (!accountId) {
    const { data: accountCreated, error: accountErr } = await supabase
      .from("accounts")
      .insert({})
      .select("id")
      .single();
    if (accountErr || !accountCreated) {
      return NextResponse.json(
        { error: accountErr?.message ?? "Falha ao criar conta" },
        { status: 500 },
      );
    }
    accountId = accountCreated.id as string;
  }

  let safeWhatsapp = normalizedWhatsapp;
  if (safeWhatsapp) {
    const { data: existingWhatsapp } = await supabase
      .from("profiles")
      .select("id")
      .eq("whatsapp_number", safeWhatsapp)
      .maybeSingle();
    if (existingWhatsapp) {
      safeWhatsapp = "";
    }
  }
  if (!safeWhatsapp) {
    safeWhatsapp = `pending-${userId.replace(/-/g, "")}`.slice(0, 40);
  }

  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: userId,
      account_id: accountId,
      email: normalizedEmail,
      full_name: normalizedName,
      whatsapp_number: safeWhatsapp,
      role: "broker",
    },
    { onConflict: "id" },
  );
  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  const { error: brokerErr } = await supabase.from("brokers").upsert(
    {
      account_id: accountId,
      profile_id: userId,
      display_name: normalizedName,
      whatsapp_number: safeWhatsapp,
      status: "active",
    },
    { onConflict: "profile_id" },
  );
  if (brokerErr) {
    return NextResponse.json({ error: brokerErr.message }, { status: 500 });
  }

  await supabase.from("subscriptions").upsert(
    {
      account_id: accountId,
      plan_code: "free",
      status: "free",
    },
    { onConflict: "account_id" },
  );

  return NextResponse.json({ ok: true });
}
