"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CreatePropertyState = { error?: string } | null;

export async function createProperty(
  _prev: CreatePropertyState,
  formData: FormData,
): Promise<CreatePropertyState> {
  const supabase = await createClient();
  const description = String(formData.get("description") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const property_type = String(formData.get("property_type") ?? "").trim();
  const property_subtype = String(formData.get("property_subtype") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "sale") as "sale" | "rent";
  const title = String(formData.get("title") ?? "").trim() || null;

  if (!description || !city || !state || !property_type || !property_subtype) {
    return { error: "Preencha os campos obrigatórios." };
  }

  const { data, error } = await supabase
    .from("properties")
    .insert({
      description,
      city,
      state,
      property_type,
      property_subtype,
      purpose,
      title,
      listing_status: "draft",
    })
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

export async function updatePropertyStatus(propertyId: string, listing_status: string) {
  const supabase = await createClient();
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
