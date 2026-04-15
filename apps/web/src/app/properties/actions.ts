"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildPropertyPayload } from "@/lib/property-form";
import { createClient } from "@/lib/supabase/server";

export type CreatePropertyState = { error?: string } | null;

export async function createProperty(
  _prev: CreatePropertyState,
  formData: FormData,
): Promise<CreatePropertyState> {
  const supabase = await createClient();
  const payload = buildPropertyPayload(formData);

  const { data, error } = await supabase
    .from("properties")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/properties");
  if (data?.id) {
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
  const { error } = await supabase.from("properties").update({ listing_status }).eq("id", propertyId);
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
  return { ok: true as const };
}
