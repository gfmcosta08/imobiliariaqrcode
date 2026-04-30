"use server";

import { redirect } from "next/navigation";

import type { CreatePropertyState } from "@/app/properties/actions";
import { buildPropertyPayload, validateLocationMapUrl } from "@/lib/property-form";
import { createClient } from "@/lib/supabase/server";

export async function updateInvitationProperty(
  _prev: CreatePropertyState,
  formData: FormData,
): Promise<CreatePropertyState> {
  const propertyId = String(formData.get("property_id") ?? "").trim();
  if (!propertyId) {
    return { error: "Imóvel inválido." };
  }

  const supabase = await createClient();
  const payload = buildPropertyPayload(formData);
  payload.listing_status = "published";
  const locationError = validateLocationMapUrl(payload.listing_status, payload.location_map_url);
  if (locationError) {
    return { error: locationError };
  }

  const { error: updateError } = await supabase
    .from("properties")
    .update(payload)
    .eq("id", propertyId);

  if (updateError) {
    return { error: updateError.message };
  }

  await supabase
    .from("broker_invitations")
    .update({ status: "claimed", claimed_at: new Date().toISOString() })
    .eq("property_id", propertyId);

  redirect("/dashboard");
}
