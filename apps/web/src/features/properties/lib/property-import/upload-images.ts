import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isAllowedImportImageUrl,
  isPropertyImportImageUrl,
} from "@imobiliariaqrcode/property-importer";

const BUCKET = "property-media";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extensionFor(contentType: string | null, url: string): string {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("image/png")) return "png";
  if (ct.includes("image/webp")) return "webp";
  if (ct.includes("image/gif")) return "gif";
  const fromUrl = url.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (fromUrl && /^[a-z0-9]+$/.test(fromUrl)) return fromUrl;
  return "jpg";
}

function sourceHostnameFrom(sourceUrl: string): string | undefined {
  try {
    return new URL(sourceUrl).hostname;
  } catch {
    return undefined;
  }
}

export async function uploadImportedImages(
  admin: SupabaseClient,
  propertyId: string,
  imageUrls: string[],
  maxImages: number,
  sourceUrl?: string,
): Promise<{ uploaded: number; failed: string[] }> {
  const sourceHostname = sourceUrl ? sourceHostnameFrom(sourceUrl) : undefined;
  const { count: currentImages } = await admin
    .from("property_media")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .neq("status", "deleted");

  let slots = Math.max(0, maxImages - (currentImages ?? 0));
  let uploaded = 0;
  const failed: string[] = [];

  for (const rawUrl of imageUrls) {
    if (slots <= 0) break;
    const trimmed = rawUrl.trim();
    if (!trimmed) continue;
    if (!isPropertyImportImageUrl(trimmed, sourceHostname)) {
      failed.push(
        isAllowedImportImageUrl(trimmed, sourceHostname)
          ? `url_filtered:${trimmed.slice(0, 80)}`
          : `url_not_allowed:${trimmed.slice(0, 80)}`,
      );
      continue;
    }

    try {
      const res = await fetch(trimmed, {
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; ImoveisQR-Import/1.0; +https://farollimoveis-staging.vercel.app)",
          accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          ...(sourceHostname ? { referer: `https://${sourceHostname}/` } : {}),
        },
      });
      if (!res.ok) {
        failed.push(`fetch_${res.status}`);
        continue;
      }
      const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
      if (!ALLOWED_TYPES.has(contentType)) {
        failed.push(`type_${contentType}`);
        continue;
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_FILE_SIZE) {
        failed.push("too_large");
        continue;
      }

      const objectPath = `${propertyId}/${crypto.randomUUID()}.${extensionFor(contentType, trimmed)}`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(objectPath, buf, { contentType, upsert: false });

      if (uploadError) {
        failed.push(uploadError.message);
        continue;
      }

      const { error: insertError } = await admin.from("property_media").insert({
        property_id: propertyId,
        storage_path: objectPath,
        mime_type: contentType,
        status: "ready",
      });

      if (insertError) {
        await admin.storage.from(BUCKET).remove([objectPath]);
        failed.push(insertError.message);
        continue;
      }

      uploaded += 1;
      slots -= 1;
    } catch (e) {
      failed.push(e instanceof Error ? e.message : "download_failed");
    }
  }

  return { uploaded, failed };
}
