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

export async function POST(req: Request) {
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

  const body = await req.json().catch(() => ({})) as {
    property_count?: number;
    expiration_days?: number;
  };
  const propertyCount = Math.min(Math.max(1, body.property_count ?? 1), 10);
  const expirationDays = Math.min(Math.max(1, body.expiration_days ?? 30), 365);

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
    return NextResponse.json({ ok: false, error: "broker_setup_timeout" }, { status: 500 });
  }

  // Criar imóveis fantasmas (propertyCount vezes)
  const propertyIds: string[] = [];
  let firstPropertyId: string | null = null;
  let firstQrToken: string | null = null;

  for (let pi = 0; pi < propertyCount; pi++) {
    const { data: property, error: propError } = await supabase
      .from("properties")
      .insert({
        account_id: broker.account_id,
        broker_id: broker.id,
        origin_plan_code: "free",
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
    if (pi === 0) firstPropertyId = property.id as string;
  }

  // Buscar QR token do primeiro imóvel
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const { data } = await supabase
      .from("property_qrcodes")
      .select("qr_token")
      .eq("property_id", firstPropertyId!)
      .eq("is_active", true)
      .maybeSingle();
    if (data?.qr_token) {
      firstQrToken = data.qr_token as string;
      break;
    }
  }

  // Atualizar validade da assinatura se customizada
  if (expirationDays !== 30) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + expirationDays);
    await supabase
      .from("subscriptions")
      .update({ current_period_end: endDate.toISOString() })
      .eq("account_id", broker.account_id);
  }

  // Hash simples do access_code para armazenar (sem bcrypt no edge — usar SHA-256 básico)
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
