import { NextRequest, NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "property-media";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type RouteContext = {
  params: Promise<{ propertyId: string }>;
};

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function extensionFor(file: File): string {
  const byName = file.name.split(".").pop()?.toLowerCase();
  if (byName && /^[a-z0-9]+$/.test(byName)) return byName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { propertyId } = await context.params;
  if (!propertyId) return json(400, { error: "Imovel invalido." });

  const supabase = await createClient();
  const admin = createServiceRoleClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json(401, { error: "Sessao expirada. Faca login novamente." });

  const formData = await request.formData();
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (!files.length) return json(400, { error: "Selecione pelo menos uma imagem." });

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.account_id) return json(403, { error: "Perfil nao encontrado." });

  const { data: property } = await admin
    .from("properties")
    .select("id, account_id, origin_plan_code")
    .eq("id", propertyId)
    .eq("account_id", profile.account_id)
    .maybeSingle();
  if (!property) return json(404, { error: "Imovel nao encontrado." });

  const { data: planRow } = await admin
    .from("plans")
    .select("max_images_per_property")
    .eq("code", property.origin_plan_code ?? "free")
    .maybeSingle();
  const maxImages = planRow?.max_images_per_property ?? 10;

  const { count: currentImages } = await admin
    .from("property_media")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .neq("status", "deleted");

  const availableSlots = Math.max(0, maxImages - (currentImages ?? 0));
  if (availableSlots <= 0) {
    return json(400, { error: "Limite de imagens atingido para este plano.", maxImages });
  }

  const uploaded: Array<{ id: string; storage_path: string; signedUrl: string | null }> = [];
  const failed: Array<{ name: string; error: string }> = [];

  for (const file of files.slice(0, availableSlots)) {
    if (!ALLOWED_TYPES.has(file.type)) {
      failed.push({ name: file.name, error: "Formato nao permitido." });
      continue;
    }
    if (file.size > MAX_FILE_SIZE) {
      failed.push({ name: file.name, error: "Imagem acima de 15 MB." });
      continue;
    }

    const objectPath = `${propertyId}/${crypto.randomUUID()}.${extensionFor(file)}`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(objectPath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      failed.push({ name: file.name, error: uploadError.message });
      continue;
    }

    const { data: mediaRow, error: insertError } = await admin
      .from("property_media")
      .insert({
        property_id: propertyId,
        storage_path: objectPath,
        mime_type: file.type,
        status: "ready",
      })
      .select("id, storage_path")
      .single();

    if (insertError || !mediaRow) {
      await admin.storage.from(BUCKET).remove([objectPath]);
      failed.push({ name: file.name, error: insertError?.message ?? "Falha ao registrar imagem." });
      continue;
    }

    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(objectPath, 3600);
    uploaded.push({
      id: mediaRow.id,
      storage_path: mediaRow.storage_path,
      signedUrl: signed?.signedUrl ?? null,
    });
  }

  if (files.length > availableSlots) {
    failed.push({
      name: "limite-do-plano",
      error: `${files.length - availableSlots} imagem(ns) ficaram fora do limite.`,
    });
  }

  const finalCount = (currentImages ?? 0) + uploaded.length;
  return json(uploaded.length ? 200 : 400, {
    uploaded,
    failed,
    count: finalCount,
    maxImages,
  });
}
