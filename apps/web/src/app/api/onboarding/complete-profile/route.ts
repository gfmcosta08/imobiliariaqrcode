import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Identificar o usuário autenticado
  const supabaseUser = createServerClient(url, anon, {
    cookies: { getAll: () => cookieStore.getAll() },
  });
  const {
    data: { user },
    error: authError,
  } = await supabaseUser.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { fullName, email, whatsapp, password } = await req.json();

  if (!fullName?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "Dados obrigatórios ausentes" }, { status: 400 });
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

  // Atualizar email e senha via Admin API (sem confirmação do email antigo)
  const { error: updateAuthError } = await admin.auth.admin.updateUserById(user.id, {
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName.trim(),
      whatsapp_number: whatsapp?.replace(/\D/g, "") || undefined,
      must_complete_profile: false,
    },
  });

  if (updateAuthError) {
    return NextResponse.json({ error: updateAuthError.message }, { status: 400 });
  }

  // Atualizar profile e broker no banco
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: fullName.trim(),
      email: email.trim(),
      whatsapp_number: whatsapp?.replace(/\D/g, "") || null,
    })
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json({ error: friendlyDatabaseError(profileError.message) }, { status: 400 });
  }

  const cleanPhone = whatsapp?.replace(/\D/g, "") || null;
  const { error: brokerError } = await admin
    .from("brokers")
    .update({
      display_name: fullName.trim(),
      whatsapp_number: cleanPhone,
    })
    .eq("profile_id", user.id);

  if (brokerError) {
    return NextResponse.json({ error: friendlyDatabaseError(brokerError.message) }, { status: 400 });
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
