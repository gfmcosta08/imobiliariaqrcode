import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { buildLegalAcceptanceRecord } from "@/lib/legal";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabaseUser = createServerClient(url, anon, {
    cookies: { getAll: () => cookieStore.getAll() },
  });
  const {
    data: { user },
    error: authError,
  } = await supabaseUser.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const { fullName, email, whatsapp, password, acceptedTerms, acceptedPrivacy } = await req.json();
  const normalizedName = String(fullName ?? "").trim();
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();
  const normalizedWhatsapp = String(whatsapp ?? "").replace(/\D/g, "");
  const safeWhatsapp = normalizedWhatsapp || `pending-${user.id.replace(/-/g, "")}`.slice(0, 40);

  if (!normalizedName || !normalizedEmail || !password) {
    return NextResponse.json({ error: "Dados obrigatorios ausentes" }, { status: 400 });
  }

  const legalAcceptance = buildLegalAcceptanceRecord({
    acceptedTerms,
    acceptedPrivacy,
    legalSource: "invitation_onboarding",
  });
  if (!legalAcceptance) {
    return NextResponse.json(
      { error: "Voce precisa aceitar os Termos de Uso e a Politica de Privacidade." },
      { status: 400 },
    );
  }

  const admin = createServiceRoleClient();
  const friendlyDatabaseError = (message: string) => {
    if (message.includes("profiles_whatsapp_number_key")) {
      return "Este WhatsApp ja esta cadastrado em outra conta. Informe outro numero ou deixe em branco.";
    }
    if (message.includes("profiles_email_key")) {
      return "Este e-mail ja esta cadastrado em outra conta.";
    }
    return message;
  };

  const { data: duplicatedEmail } = await admin
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .neq("id", user.id)
    .maybeSingle();
  if (duplicatedEmail) {
    return NextResponse.json(
      { error: "Este e-mail ja esta cadastrado em outra conta." },
      { status: 400 },
    );
  }

  if (normalizedWhatsapp) {
    const { data: duplicatedWhatsapp } = await admin
      .from("profiles")
      .select("id")
      .eq("whatsapp_number", normalizedWhatsapp)
      .neq("id", user.id)
      .maybeSingle();
    if (duplicatedWhatsapp) {
      return NextResponse.json(
        {
          error:
            "Este WhatsApp ja esta cadastrado em outra conta. Informe outro numero ou deixe em branco.",
        },
        { status: 400 },
      );
    }
  }

  const { error: updateAuthError } = await admin.auth.admin.updateUserById(user.id, {
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: normalizedName,
      whatsapp_number: safeWhatsapp,
      must_complete_profile: false,
    },
  });

  if (updateAuthError) {
    const msg = updateAuthError.message.toLowerCase().includes("already registered")
      ? "Este e-mail ja esta cadastrado em outra conta."
      : `Falha ao atualizar usuario: ${updateAuthError.message}`;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: normalizedName,
      email: normalizedEmail,
      whatsapp_number: safeWhatsapp,
      ...legalAcceptance,
    })
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json(
      { error: friendlyDatabaseError(profileError.message) },
      { status: 400 },
    );
  }

  const { error: brokerError } = await admin
    .from("brokers")
    .update({
      display_name: normalizedName,
      whatsapp_number: safeWhatsapp,
    })
    .eq("profile_id", user.id);

  if (brokerError) {
    return NextResponse.json(
      { error: friendlyDatabaseError(brokerError.message) },
      { status: 400 },
    );
  }

  const { error: invitationError } = await admin
    .from("broker_invitations")
    .update({
      status: "claimed",
      claimed_at: new Date().toISOString(),
      claimed_by_profile_id: user.id,
    })
    .eq("temp_auth_user_id", user.id)
    .eq("status", "pending");

  if (invitationError) {
    return NextResponse.json({ error: invitationError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
