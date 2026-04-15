"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildPropertyPayload } from "@/lib/property-form";
import { createClient } from "@/lib/supabase/server";
import { uploadMediaFilesForProperty } from "./media-actions";

export type CreatePropertyState = { error?: string } | null;

export async function createProperty(
  _prev: CreatePropertyState,
  formData: FormData,
): Promise<CreatePropertyState> {
  const supabase = await createClient();
  const payload = buildPropertyPayload(formData);
  const files = formData
    .getAll("media_files")
    .filter((v): v is File => v instanceof File && v.size > 0);

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
    if (files.length) {
      const upload = await uploadMediaFilesForProperty(data.id, files);
      if (upload.failed.length) {
        const msg = `Enviadas: ${upload.uploaded}. Falhas: ${upload.failed.length}.`;
        redirect(`/properties/${data.id}?mediaError=${encodeURIComponent(msg)}`);
      }
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

function parseCurrencyBRL(input: string | null | undefined): number | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/\s/g, "").replace(/[R$]/g, "").replace(/\./g, "").replace(",", ".");
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
  const confirm = String(params.confirmText ?? "").trim().toUpperCase();
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
