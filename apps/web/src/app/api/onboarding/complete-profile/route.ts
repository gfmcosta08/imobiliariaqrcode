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
  await admin
    .from("profiles")
    .update({
      full_name: fullName.trim(),
      email: email.trim(),
      whatsapp_number: whatsapp?.replace(/\D/g, "") || null,
    })
    .eq("id", user.id);

  const cleanPhone = whatsapp?.replace(/\D/g, "") || null;
  await admin
    .from("brokers")
    .update({
      display_name: fullName.trim(),
      whatsapp_number: cleanPhone,
    })
    .eq("profile_id", user.id);

  return NextResponse.json({ ok: true });
}
