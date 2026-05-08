import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { normalizeBrazilPhone } from "@/lib/phone";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type RecipientInput = {
  name?: unknown;
  whatsapp?: unknown;
};

async function getAccountContext() {
  const cookieStore = await cookies();
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );

  const {
    data: { user },
  } = await supabaseUser.auth.getUser();

  if (!user) return { error: NextResponse.json({ error: "Nao autenticado." }, { status: 401 }) };

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return { error: NextResponse.json({ error: "Conta nao encontrada." }, { status: 404 }) };
  }

  return { admin, accountId: String(profile.account_id) };
}

async function isPremiumActive(
  admin: ReturnType<typeof createServiceRoleClient>,
  accountId: string,
) {
  const { data } = await admin
    .from("subscriptions")
    .select("plan_code, status")
    .eq("account_id", accountId)
    .maybeSingle();

  return data?.plan_code === "premium" && data?.status === "pro_active";
}

export async function GET() {
  const context = await getAccountContext();
  if ("error" in context) return context.error;

  const { admin, accountId } = context;
  const premium = await isPremiumActive(admin, accountId);

  const { data: broker } = await admin
    .from("brokers")
    .select("display_name, whatsapp_number")
    .eq("account_id", accountId)
    .maybeSingle();

  const { data: recipients, error } = await admin
    .from("lead_routing_recipients")
    .select("id, display_name, whatsapp_number, position, status, is_primary")
    .eq("account_id", accountId)
    .order("position", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    premium_active: premium,
    max_brokers: premium ? 5 : 1,
    primary: {
      position: 1,
      display_name: broker?.display_name ?? "Corretor",
      whatsapp_number: broker?.whatsapp_number ?? null,
      is_primary: true,
      status: "active",
    },
    recipients: recipients ?? [],
  });
}

export async function PUT(request: Request) {
  const context = await getAccountContext();
  if ("error" in context) return context.error;

  const { admin, accountId } = context;
  const premium = await isPremiumActive(admin, accountId);
  if (!premium) {
    return NextResponse.json({ error: "Disponivel apenas para Premium ativo." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const input = Array.isArray(raw.recipients) ? (raw.recipients as RecipientInput[]) : [];
  if (input.length > 4) {
    return NextResponse.json(
      { error: "Premium permite ate 4 corretores adicionais." },
      { status: 400 },
    );
  }

  const normalized = input.map((item, index) => {
    const displayName = typeof item.name === "string" ? item.name.trim() : "";
    const whatsapp = typeof item.whatsapp === "string" ? normalizeBrazilPhone(item.whatsapp) : null;
    return {
      account_id: accountId,
      display_name: displayName,
      whatsapp_number: whatsapp,
      position: index + 2,
      is_primary: false,
      status: "active",
    };
  });

  if (normalized.some((item) => !item.display_name || !item.whatsapp_number)) {
    return NextResponse.json(
      { error: "Informe nome e WhatsApp valido para todos os corretores." },
      { status: 400 },
    );
  }

  const phones = normalized.map((item) => item.whatsapp_number);
  if (new Set(phones).size !== phones.length) {
    return NextResponse.json({ error: "WhatsApps duplicados na mesma conta." }, { status: 400 });
  }

  const { data: broker } = await admin
    .from("brokers")
    .select("whatsapp_number")
    .eq("account_id", accountId)
    .maybeSingle();
  const primaryPhone = broker?.whatsapp_number
    ? normalizeBrazilPhone(String(broker.whatsapp_number))
    : null;
  if (primaryPhone && phones.includes(primaryPhone)) {
    return NextResponse.json(
      { error: "WhatsApp ja usado pelo corretor principal." },
      { status: 400 },
    );
  }

  const { error: deactivateError } = await admin
    .from("lead_routing_recipients")
    .update({ status: "inactive" })
    .eq("account_id", accountId)
    .eq("is_primary", false);

  if (deactivateError) {
    return NextResponse.json({ error: deactivateError.message }, { status: 500 });
  }

  if (normalized.length > 0) {
    const { error: upsertError } = await admin.from("lead_routing_recipients").upsert(normalized, {
      onConflict: "account_id,position",
    });
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
  }

  const { data: recipients } = await admin
    .from("lead_routing_recipients")
    .select("id, display_name, whatsapp_number, position, status, is_primary")
    .eq("account_id", accountId)
    .eq("status", "active")
    .order("position", { ascending: true });

  return NextResponse.json({ ok: true, recipients: recipients ?? [] });
}
