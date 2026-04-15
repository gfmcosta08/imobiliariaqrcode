"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export async function uploadPropertyMedia(formData: FormData) {
  const propertyId = String(formData.get("propertyId") ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sessão expirada." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.account_id) {
    return { error: "Perfil não encontrado." };
  }

  const { data: property, error: propError } = await supabase
    .from("properties")
    .select("id, account_id")
    .eq("id", propertyId)
    .maybeSingle();

  if (propError || !property || property.account_id !== profile.account_id) {
    return { error: "Imóvel não encontrado." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo de imagem." };
  }

  if (file.size > 15 * 1024 * 1024) {
    return { error: "Arquivo muito grande (máx. 15 MB)." };
  }

  const mime = file.type || "application/octet-stream";
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
    return { error: "Formato não suportado. Use JPG, PNG, WebP ou GIF." };
  }

  const safeName = sanitizeFilename(file.name || "upload.jpg");
  const objectPath = `account/${property.account_id}/property/${propertyId}/original/${Date.now()}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upError } = await supabase.storage
    .from("property-media")
    .upload(objectPath, buffer, {
      contentType: mime,
      upsert: false,
    });

  if (upError) {
    return { error: upError.message };
  }

  const { error: insError } = await supabase.from("property_media").insert({
    property_id: propertyId,
    storage_path: objectPath,
    mime_type: mime,
    file_size_bytes: file.size,
    status: "ready",
    sort_order: 0,
    is_primary: false,
  });

  if (insError) {
    await supabase.storage.from("property-media").remove([objectPath]);
    return { error: insError.message };
  }

  revalidatePath(`/properties/${propertyId}`);
  return { ok: true as const };
}

export async function deletePropertyMedia(
  propertyId: string,
  mediaId: string,
  storagePath: string,
) {
  const supabase = await createClient();
  const { error: rmError } = await supabase.storage.from("property-media").remove([storagePath]);
  if (rmError) {
    return { error: rmError.message };
  }

  const { error } = await supabase
    .from("property_media")
    .delete()
    .eq("id", mediaId)
    .eq("property_id", propertyId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/properties/${propertyId}`);
  return { ok: true as const };
}
