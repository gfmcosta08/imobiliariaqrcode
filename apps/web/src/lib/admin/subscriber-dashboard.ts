import type { SupabaseClient } from "@supabase/supabase-js";

import type { PropertyQrMetrics, SubscriberDashboard } from "@/lib/admin/types";

function shouldUseFallback(error: { message?: string } | null | undefined, fnName: string) {
  const message = error?.message ?? "";
  return (
    message.includes(`function public.${fnName}`) ||
    message.includes("account_not_found") ||
    message.includes("property_not_found")
  );
}

export async function resolveSubscriberAccountId(
  supabase: SupabaseClient,
  subscriberId: string,
): Promise<string | null> {
  const { data: accountRow, error: accountError } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", subscriberId)
    .maybeSingle();

  if (!accountError && accountRow?.id) return String(accountRow.id);

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", subscriberId)
    .maybeSingle();

  if (!profileError && profileRow?.account_id) return String(profileRow.account_id);

  const { data: brokerRow, error: brokerError } = await supabase
    .from("brokers")
    .select("account_id")
    .eq("profile_id", subscriberId)
    .maybeSingle();

  if (!brokerError && brokerRow?.account_id) return String(brokerRow.account_id);

  return null;
}

export async function loadFallbackDashboard(
  supabase: SupabaseClient,
  accountId: string,
): Promise<SubscriberDashboard | null> {
  const { data: accountRow, error: accountError } = await supabase
    .from("accounts")
    .select("id, created_at")
    .eq("id", accountId)
    .maybeSingle();

  if (accountError || !accountRow) return null;

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name, email, whatsapp_number")
    .eq("account_id", accountId)
    .maybeSingle();

  const { data: brokerRow } = await supabase
    .from("brokers")
    .select("display_name, whatsapp_number")
    .eq("account_id", accountId)
    .maybeSingle();

  const { data: subscriptionRow } = await supabase
    .from("subscriptions")
    .select("plan_code, status")
    .eq("account_id", accountId)
    .maybeSingle();

  const { data: properties } = await supabase
    .from("properties")
    .select("id, public_id, title, listing_status, city, state, updated_at")
    .eq("account_id", accountId)
    .order("updated_at", { ascending: false });

  const propertyIds = (properties ?? []).map((prop) => prop.id).filter(Boolean);
  const [qrCount, leadCount] = propertyIds.length
    ? await Promise.all([
        supabase
          .from("qr_access_events")
          .select("id", { count: "exact", head: true })
          .in("property_id", propertyIds),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .in("property_id", propertyIds),
      ])
    : [{ count: 0 }, { count: 0 }];

  return {
    account: {
      account_id: accountId,
      full_name: profileRow?.full_name ?? brokerRow?.display_name ?? "Sem nome",
      email: profileRow?.email ?? "",
      whatsapp_number: brokerRow?.whatsapp_number ?? profileRow?.whatsapp_number ?? "",
      plan_code: subscriptionRow?.plan_code ?? "free",
      subscription_status: subscriptionRow?.status ?? "free",
      created_at: String(accountRow.created_at ?? ""),
      total_properties: properties?.length ?? 0,
      total_qr_reads: Number(qrCount.count ?? 0),
      total_leads: Number(leadCount.count ?? 0),
      unique_qr_visitors: 0,
    },
    properties: (properties ?? []).map((prop) => ({
      property_id: String(prop.id),
      public_id: String(prop.public_id ?? ""),
      title: String(prop.title ?? prop.public_id ?? ""),
      listing_status: String(prop.listing_status ?? ""),
      city: prop.city ?? null,
      state: prop.state ?? null,
      qr_token: null,
      qr_reads: 0,
      unique_visitors: 0,
      total_leads: 0,
      visit_interest_count: 0,
      updated_at: String(prop.updated_at ?? ""),
    })),
  };
}

export async function loadSubscriberDashboard(
  supabase: SupabaseClient,
  subscriberId: string,
): Promise<SubscriberDashboard | null> {
  const accountId = await resolveSubscriberAccountId(supabase, subscriberId);
  if (!accountId) return null;

  const { data, error } = await supabase.rpc("admin_get_subscriber_dashboard", {
    p_account_id: accountId,
  });

  if (!error && data) return data as SubscriberDashboard;

  if (shouldUseFallback(error, "admin_get_subscriber_dashboard")) {
    return loadFallbackDashboard(supabase, accountId);
  }

  if (!error) return loadFallbackDashboard(supabase, accountId);

  throw new Error(error.message);
}

export async function loadFallbackPropertyMetrics(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<PropertyQrMetrics | null> {
  const { data: propertyRow, error: propertyError } = await supabase
    .from("properties")
    .select(
      "id, account_id, public_id, title, listing_status, city, state, neighborhood, full_address, latitude, longitude, updated_at",
    )
    .eq("id", propertyId)
    .maybeSingle();

  if (propertyError || !propertyRow) return null;

  const { data: qrRows } = await supabase
    .from("qr_access_events")
    .select("id, created_at, source, user_agent, ip_hash")
    .eq("property_id", propertyId);

  const { data: leadRows } = await supabase
    .from("leads")
    .select("id, nome_completo, telefone, intent, status, origem, created_at, updated_at")
    .eq("property_id", propertyId);

  const totalScans = qrRows?.length ?? 0;
  const visitInterestCount =
    leadRows?.filter((lead) => lead.intent === "visit_interest").length ?? 0;

  return {
    property: {
      property_id: String(propertyRow.id),
      account_id: String(propertyRow.account_id),
      public_id: String(propertyRow.public_id ?? ""),
      title: String(propertyRow.title ?? propertyRow.public_id ?? ""),
      listing_status: String(propertyRow.listing_status ?? ""),
      city: propertyRow.city ?? null,
      state: propertyRow.state ?? null,
      neighborhood: propertyRow.neighborhood ?? null,
      full_address: propertyRow.full_address ?? null,
      latitude: propertyRow.latitude ?? null,
      longitude: propertyRow.longitude ?? null,
      qr_token: null,
    },
    summary: {
      total_scans: totalScans,
      unique_visitors: new Set(
        (qrRows ?? [])
          .map((row) => String((row as { ip_hash?: string | null }).ip_hash ?? ""))
          .filter(Boolean),
      ).size,
      total_leads: leadRows?.length ?? 0,
      visit_interest_count: visitInterestCount,
      qr_entry_count: 0,
      similar_interest_count: 0,
      public_qr_interest_count: 0,
      conversion_scan_to_lead:
        totalScans > 0 ? Number((((leadRows?.length ?? 0) / totalScans) * 100).toFixed(2)) : 0,
      conversion_scan_to_visit:
        totalScans > 0 ? Number(((visitInterestCount / totalScans) * 100).toFixed(2)) : 0,
      first_scan_at: qrRows?.[0]?.created_at ?? null,
      last_scan_at: qrRows?.[0]?.created_at ?? null,
    },
    scans_by_day: [],
    scans_by_hour: [],
    device_breakdown: [],
    recent_scans: (qrRows ?? []).slice(0, 50).map((row) => ({
      id: String(row.id),
      created_at: String(row.created_at),
      source: String(row.source ?? "unknown"),
      device: "unknown",
      user_agent: String((row as { user_agent?: string | null }).user_agent ?? ""),
      has_ip_hash: Boolean((row as { ip_hash?: string | null }).ip_hash),
    })),
    leads: (leadRows ?? []).map((lead) => ({
      id: String(lead.id),
      nome_completo: String(lead.nome_completo ?? ""),
      telefone: String(lead.telefone ?? ""),
      intent: String(lead.intent ?? ""),
      status: String(lead.status ?? ""),
      origem: String(lead.origem ?? ""),
      created_at: String(lead.created_at ?? ""),
      updated_at: String(lead.updated_at ?? ""),
    })),
    interactions: [],
    location_note:
      "Fallback local: algumas métricas detalhadas podem estar zeradas enquanto a RPC não estiver disponível.",
  };
}

export async function loadPropertyMetrics(
  supabase: SupabaseClient,
  propertyId: string,
): Promise<PropertyQrMetrics | null> {
  const { data, error } = await supabase.rpc("admin_get_property_qr_metrics", {
    p_property_id: propertyId,
  });

  if (!error) return data as PropertyQrMetrics;

  if (shouldUseFallback(error, "admin_get_property_qr_metrics")) {
    return loadFallbackPropertyMetrics(supabase, propertyId);
  }

  throw new Error(error.message);
}
