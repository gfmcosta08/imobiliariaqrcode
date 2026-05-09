import type { SupabaseClient } from "@supabase/supabase-js";

export const SOLO_VALIDITY_DAYS = 90;

export function soloPeriodEndFromNow() {
  return new Date(Date.now() + SOLO_VALIDITY_DAYS * 86400 * 1000).toISOString();
}

export async function countSoloActiveProperties(
  supabase: SupabaseClient,
  accountId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .in("listing_status", ["published", "printed"]);

  if (error) throw error;
  return count ?? 0;
}

export async function activateSoloProperty(
  supabase: SupabaseClient,
  params: {
    accountId: string;
    propertyId: string;
    expiresAt: string;
  },
) {
  const activeCount = await countSoloActiveProperties(supabase, params.accountId);
  if (activeCount > 0) {
    return { ok: false as const, error: "solo_active_property_exists" };
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, listing_status")
    .eq("id", params.propertyId)
    .eq("account_id", params.accountId)
    .maybeSingle();

  if (propertyError) throw propertyError;
  if (!property) return { ok: false as const, error: "property_not_found" };
  if (!["draft", "expired"].includes(property.listing_status as string)) {
    return { ok: false as const, error: "property_not_eligible" };
  }

  const { error: updateError } = await supabase
    .from("properties")
    .update({
      listing_status: "published",
      expires_at: params.expiresAt,
      origin_plan_code: "solo",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.propertyId)
    .eq("account_id", params.accountId);

  if (updateError) throw updateError;

  const { data: activeQr, error: activeQrError } = await supabase
    .from("property_qrcodes")
    .select("id")
    .eq("property_id", params.propertyId)
    .eq("is_active", true)
    .maybeSingle();

  if (activeQrError) throw activeQrError;
  if (!activeQr) {
    const { data: latestQr, error: latestQrError } = await supabase
      .from("property_qrcodes")
      .select("id")
      .eq("property_id", params.propertyId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestQrError) throw latestQrError;

    if (latestQr?.id) {
      const { error: qrUpdateError } = await supabase
        .from("property_qrcodes")
        .update({
          is_active: true,
          expired_at: null,
          invalidation_reason: null,
        })
        .eq("id", latestQr.id);
      if (qrUpdateError) throw qrUpdateError;
    } else {
      const { error: qrInsertError } = await supabase.rpc("generate_qr_token").then(
        async ({ data, error }) => {
          if (error) return { error };
          return supabase.from("property_qrcodes").insert({
            property_id: params.propertyId,
            qr_token: data,
            version: 1,
            is_active: true,
          });
        },
      );
      if (qrInsertError) throw qrInsertError;
    }
  }

  return { ok: true as const };
}
