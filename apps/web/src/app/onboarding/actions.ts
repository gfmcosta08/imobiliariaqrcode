"use server";

import { redirect } from "next/navigation";

import type { CreatePropertyState } from "@/app/properties/actions";
import { buildPropertyPayload, validateLocationMapUrl } from "@/lib/property-form";
import { assertOwnedPropertyAccess } from "@/lib/property-access";

export async function updateInvitationProperty(
  _prev: CreatePropertyState,
  formData: FormData,
): Promise<CreatePropertyState> {
  const propertyId = String(formData.get("property_id") ?? "").trim();
  if (!propertyId) {
    return { error: "Imóvel inválido." };
  }

  const payload = buildPropertyPayload(formData);
  payload.listing_status = "published";
  const locationError = validateLocationMapUrl(payload.listing_status, payload.location_map_url);
  if (locationError) {
    return { error: locationError };
  }

  const access = await assertOwnedPropertyAccess(propertyId);
  if (access.error || !access.accountId) {
    return { error: access.error ?? "Imovel nao encontrado." };
  }

  const { data, error: updateError } = await access.supabase
    .from("properties")
    .update(payload)
    .eq("id", propertyId)
    .eq("account_id", access.accountId)
    .select("id");

  if (updateError) {
    return { error: updateError.message };
  }
  if (!data?.length) {
    return { error: "Imovel nao encontrado." };
  }

  await access.supabase
    .from("broker_invitations")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("property_id", propertyId)
    .in("status", ["pending", "claimed"]);

  redirect("/dashboard");
}
