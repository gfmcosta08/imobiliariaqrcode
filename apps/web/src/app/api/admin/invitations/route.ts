import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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

export async function POST() {
  // Verificar autenticação e role admin
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseUser = createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  });

  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // Gerar credenciais temporárias
  const loginCode = await generateUniqueLoginCode(supabase);
  const accessCode = randomSixDigits();
  const tempEmail = `tmp-${loginCode}-${Date.now()}@opencode.internal`;

  // Criar usuário temporário no Supabase Auth
  // O trigger handle_new_user cria automaticamente account/profile/broker/subscription
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

  // Aguardar o trigger handle_new_user processar (retry de busca do profile)
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
    return NextResponse.json(
      { ok: false, error: "broker_setup_timeout" },
      { status: 500 },
    );
  }

  // Criar imóvel fantasma com status 'reserved'
  const { data: property, error: propError } = await supabase
    .from("properties")
    .insert({
      account_id: broker.account_id,
      broker_id: broker.id,
      origin_plan_code: "free",
      listing_status: "reserved",
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

  // Buscar QR token gerado automaticamente pelo trigger after_property_insert_qr
  let qrToken: string | null = null;
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const { data } = await supabase
      .from("property_qrcodes")
      .select("qr_token")
      .eq("property_id", property.id)
      .eq("is_active", true)
      .maybeSingle();
    if (data?.qr_token) {
      qrToken = data.qr_token as string;
      break;
    }
  }

  // Hash simples do access_code para armazenar (sem bcrypt no edge — usar SHA-256 básico)
  // Em produção recomenda-se bcrypt via pgcrypto; aqui usamos hash reversível por simplicidade
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(accessCode));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const accessCodeHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // Registrar convite
  const { error: inviteError } = await supabase.from("broker_invitations").insert({
    login_code: loginCode,
    access_code_hash: accessCodeHash,
    temp_auth_user_id: authUserId,
    temp_email: tempEmail,
    property_id: property.id,
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
  const qrUrl = qrToken ? `${appUrl}/q/${qrToken}` : null;

  return NextResponse.json({
    ok: true,
    login_code: loginCode,
    access_code: accessCode,
    qr_url: qrUrl,
    property_id: property.id,
  });
}
