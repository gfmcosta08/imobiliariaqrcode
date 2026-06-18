"use server";

import { revalidatePath } from "next/cache";

import { resolveCurrentAccountContext } from "@/lib/account-context";
import { assertOwnedPropertyAccess } from "@/lib/property-access";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

type UploadFailed = { name: string; error: string };
type UploadOutcome = { uploaded: number; failed: UploadFailed[] };

async function resolveUserAccountId() {
  const ctx = await resolveCurrentAccountContext();
  if (ctx.error === "unauthenticated") {
    return { supabase: ctx.supabase, accountId: null as string | null, error: "Sessao expirada." };
  }
  if (ctx.error || !ctx.accountId) {
    return { supabase: ctx.supabase, accountId: null as string | null, error: "Perfil nao encontrado." };
  }
  return { supabase: ctx.supabase, accountId: ctx.accountId, error: null as string | null };
}

export async function uploadMediaFilesForProperty(
  propertyId: string,
  files: File[],
): Promise<UploadOutcome> {
  const base = await resolveUserAccountId();
  if (base.error || !base.accountId) {
    return {
      uploaded: 0,
      failed: files.map((f) => ({
        name: f.name || "arquivo",
        error: base.error ?? "Erro de sessao.",
      })),
    };
  }

  const { supabase, accountId } = base;
  const { data: property, error: propError } = await supabase
    .from("properties")
    .select("id, account_id")
    .eq("id", propertyId)
    .maybeSingle();

  if (propError || !property || property.account_id !== accountId) {
    return {
      uploaded: 0,
      failed: files.map((f) => ({ name: f.name || "arquivo", error: "Imovel nao encontrado." })),
    };
  }

  const failed: UploadFailed[] = [];
  let uploaded = 0;

  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) {
      failed.push({ name: "arquivo", error: "Selecione um arquivo de imagem." });
      continue;
    }

    if (file.size > 15 * 1024 * 1024) {
      failed.push({ name: file.name, error: "Arquivo muito grande (max. 15 MB)." });
      continue;
    }

    const mime = file.type || "application/octet-stream";
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
      failed.push({ name: file.name, error: "Formato nao suportado. Use JPG, PNG, WebP ou GIF." });
      continue;
    }

    const safeName = sanitizeFilename(file.name || "upload.jpg");
    const objectPath = `account/${accountId}/property/${propertyId}/original/${Date.now()}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upError } = await supabase.storage
      .from("property-media")
      .upload(objectPath, buffer, {
        contentType: mime,
        upsert: false,
      });

    if (upError) {
      failed.push({ name: file.name, error: upError.message });
      continue;
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
      failed.push({ name: file.name, error: insError.message });
      continue;
    }

    uploaded += 1;
  }

  return { uploaded, failed };
}

export async function uploadPropertyMedia(formData: FormData) {
  const propertyId = String(formData.get("propertyId") ?? "").trim();
  if (!propertyId) {
    return { error: "Imovel invalido." };
  }

  const files = formData.getAll("files").filter((v): v is File => v instanceof File && v.size > 0);

  if (!files.length) {
    return { error: "Selecione ao menos uma imagem." };
  }

  const result = await uploadMediaFilesForProperty(propertyId, files);
  revalidatePath(`/properties/${propertyId}`);

  if (!result.uploaded && result.failed.length) {
    return { error: result.failed.map((f) => `${f.name}: ${f.error}`).join(" | ") };
  }

  return {
    ok: true as const,
    uploaded: result.uploaded,
    failed: result.failed,
  };
}

export async function deletePropertyMedia(
  propertyId: string,
  mediaId: string,
  storagePath: string,
) {
  const access = await assertOwnedPropertyAccess(propertyId);
  if (access.error || !access.accountId) {
    return { error: access.error ?? "Imovel nao encontrado." };
  }

  const { data: mediaRow } = await access.supabase
    .from("property_media")
    .select("id, storage_path")
    .eq("id", mediaId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (!mediaRow) {
    return { error: "Midia nao encontrada." };
  }

  const pathToRemove = mediaRow.storage_path ?? storagePath;
  const { error: rmError } = await access.supabase.storage
    .from("property-media")
    .remove([pathToRemove]);
  if (rmError) {
    return { error: rmError.message };
  }

  const { data, error } = await access.supabase
    .from("property_media")
    .delete()
    .eq("id", mediaId)
    .eq("property_id", propertyId)
    .select("id");

  if (error) {
    return { error: error.message };
  }
  if (!data?.length) {
    return { error: "Midia nao encontrada." };
  }

  revalidatePath(`/properties/${propertyId}`);
  return { ok: true as const };
}
