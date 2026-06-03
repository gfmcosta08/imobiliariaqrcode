"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildPropertyPayload, validateLocationMapUrl } from "@/lib/property-form";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";

export type CreatePropertyState = { error?: string } | null;

export async function createProperty(
  _prev: CreatePropertyState,
  formData: FormData,
): Promise<CreatePropertyState> {
  const supabase = await createClient();
  const isProduction = process.env.VERCEL_ENV === "production";
  const payload = buildPropertyPayload(formData);
  const locationError = validateLocationMapUrl(payload.listing_status, payload.location_map_url);
  if (locationError) {
    return { error: locationError };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessao expirada. Faca login novamente." };

  const admin = createServiceRoleClient();
  let { data: broker } = await admin
    .from("brokers")
    .select("id, account_id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!broker && !isProduction) {
    const fallbackName =
      (user.user_metadata?.full_name as string | undefined)?.trim() ||
      user.email?.split("@")[0] ||
      "Corretor Teste";
    const fallbackWhatsapp =
      (user.user_metadata?.whatsapp_number as string | undefined)?.trim() ||
      `pending-${user.id.replace(/-/g, "")}`;

    let accountId: string | null = null;
    const { data: profile } = await admin
      .from("profiles")
      .select("account_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.account_id) {
      accountId = profile.account_id as string;
    } else {
      const { data: accountCreated, error: accountErr } = await admin
        .from("accounts")
        .insert({})
        .select("id")
        .single();
      if (accountErr || !accountCreated) {
        return { error: accountErr?.message ?? "Falha ao criar conta de teste." };
      }
      accountId = accountCreated.id as string;
      const { error: profileErr } = await admin.from("profiles").upsert(
        {
          id: user.id,
          account_id: accountId,
          email: user.email ?? `${user.id}@preview.local`,
          full_name: fallbackName,
          whatsapp_number: fallbackWhatsapp,
          role: "broker",
        },
        { onConflict: "id" },
      );
      if (profileErr) return { error: profileErr.message };
    }

    const { data: brokerCreated, error: brokerErr } = await admin
      .from("brokers")
      .upsert(
        {
          account_id: accountId,
          profile_id: user.id,
          display_name: fallbackName,
          whatsapp_number: fallbackWhatsapp,
          status: "active",
        },
        { onConflict: "profile_id" },
      )
      .select("id, account_id")
      .single();
    if (brokerErr || !brokerCreated)
      return { error: brokerErr?.message ?? "Falha ao criar corretor de teste." };
    broker = brokerCreated;
    await admin.from("subscriptions").upsert(
      {
        account_id: accountId,
        plan_code: "free",
        status: "free",
      },
      { onConflict: "account_id" },
    );
  }
  if (!broker) return { error: "Corretor nao encontrado." };

  const { data: subscriptionRow } = await admin
    .from("subscriptions")
    .select("plan_code, status")
    .eq("account_id", broker.account_id)
    .maybeSingle();

  const activeStatuses = [
    "free",
    "starter_active",
    "solo_active",
    "pro_pending_activation",
    "pro_active",
  ];
  const subscription =
    subscriptionRow && activeStatuses.includes(subscriptionRow.status)
      ? subscriptionRow
      : !isProduction
        ? { plan_code: "free", status: "free" }
        : null;

  let ensuredSubscription = subscription;
  if (!ensuredSubscription) {
    // In preview/dev, ensure a default FREE subscription exists so QA can create listings.
    if (!isProduction) {
      await admin.from("subscriptions").upsert(
        {
          account_id: broker.account_id,
          plan_code: "free",
          status: "free",
        },
        { onConflict: "account_id" },
      );
      ensuredSubscription = { plan_code: "free", status: "free" };
    } else {
      return { error: "Escolha um plano antes de cadastrar imoveis." };
    }
  }

  const { data, error } = await admin
    .from("properties")
    .insert({
      ...payload,
      account_id: broker.account_id,
      broker_id: broker.id,
      origin_plan_code: ensuredSubscription.plan_code,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/properties");
  if (data?.id) {
    // Guarantee a readable /q/{token} even when DB trigger lags in preview/test.
    const { data: activeQr } = await admin
      .from("property_qrcodes")
      .select("id")
      .eq("property_id", data.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!activeQr) {
      await admin.from("property_qrcodes").insert({
        property_id: data.id,
        qr_token: crypto.randomUUID(),
        is_active: true,
      });
    }

    redirect(`/properties/${data.id}`);
  }
  return null;
}

export async function updatePropertyDetails(
  _prev: CreatePropertyState,
  formData: FormData,
): Promise<CreatePropertyState> {
  const propertyId = String(formData.get("property_id") ?? "").trim();
  if (!propertyId) {
    return { error: "Imóvel inválido." };
  }

  const supabase = await createClient();
  const payload = buildPropertyPayload(formData);
  const locationError = validateLocationMapUrl(payload.listing_status, payload.location_map_url);
  if (locationError) {
    return { error: locationError };
  }
  const { error } = await supabase.from("properties").update(payload).eq("id", propertyId);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
  return null;
}

export async function updatePropertyStatus(propertyId: string, listing_status: string) {
  const supabase = await createClient();
  if (listing_status === "published" || listing_status === "printed") {
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("location_map_url")
      .eq("id", propertyId)
      .maybeSingle();
    if (propertyError) {
      return { error: propertyError.message };
    }

    const locationError = validateLocationMapUrl(
      listing_status,
      property?.location_map_url ?? null,
    );
    if (locationError) {
      return { error: locationError };
    }
  }

  const { error } = await supabase
    .from("properties")
    .update({ listing_status })
    .eq("id", propertyId);
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
  return { ok: true as const };
}

function parseCurrencyBRL(input: string | null | undefined): number | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/\s/g, "")
    .replace(/[R$]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseDateBR(input: string | null | undefined): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm}-${dd}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return iso;
}

export async function markPropertyAsSold(params: {
  propertyId: string;
  confirmText: string;
  soldDate: string;
  soldCommission: string;
  soldNotes?: string;
}) {
  const confirm = String(params.confirmText ?? "")
    .trim()
    .toUpperCase();
  if (confirm !== "VENDIDO") {
    return { error: "Digite VENDIDO para confirmar." };
  }

  const sold_at = parseDateBR(params.soldDate);
  if (!sold_at) {
    return { error: "Data da venda inválida. Use dd/mm/aaaa." };
  }

  const sold_commission_amount = parseCurrencyBRL(params.soldCommission);
  if (sold_commission_amount == null || sold_commission_amount < 0) {
    return { error: "Comissão inválida." };
  }

  const sold_notes = String(params.soldNotes ?? "").trim() || null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("properties")
    .update({
      listing_status: "removed",
      sold_at,
      sold_commission_amount,
      sold_confirmed_at: new Date().toISOString(),
      sold_notes,
    })
    .eq("id", params.propertyId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/properties");
  revalidatePath(`/properties/${params.propertyId}`);
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { ok: true as const };
}
