import {
  discoverPropertyUrls,
  extractListingsFromUrls,
  listingFromResult,
  mapExtratorListingToPropertyPayload,
  validateImportUrl,
  inferImportMode,
} from "@imobiliariaqrcode/property-importer";

import { getPropertyExtractorBaseUrl } from "@/lib/property-import/enabled";
import { uploadImportedImages } from "@/lib/property-import/upload-images";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type ImportJobItemResult = {
  source_url: string;
  status: "ok" | "error";
  property_id?: string;
  public_id?: string;
  title?: string | null;
  error?: string;
  images_uploaded?: number;
};

export async function runPropertyImportJob(jobId: string): Promise<void> {
  const admin = createServiceRoleClient();
  const extratorBase = getPropertyExtractorBaseUrl();
  if (!extratorBase) {
    await admin
      .from("property_import_jobs")
      .update({
        status: "failed",
        error_message: "PROPERTY_EXTRACTOR_URL não configurada no Preview/staging.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    return;
  }

  const { data: job, error: jobErr } = await admin
    .from("property_import_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr || !job) return;

  await admin
    .from("property_import_jobs")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", jobId);

  const results: ImportJobItemResult[] = [];

  try {
    const urlCheck = validateImportUrl(job.source_url);
    if (!urlCheck.ok) {
      throw new Error(urlCheck.error);
    }

    const { urls, mode } = await discoverPropertyUrls(job.source_url, {
      extratorBaseUrl: extratorBase,
    });
    const detectedMode = mode ?? inferImportMode(urlCheck.url);

    if (urls.length === 0) {
      throw new Error("no_properties_found");
    }

    await admin
      .from("property_import_jobs")
      .update({
        mode: detectedMode,
        total_count: urls.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    const { data: planRow } = await admin
      .from("plans")
      .select("max_images_per_property")
      .eq("code", job.origin_plan_code ?? "free")
      .maybeSingle();
    const maxImages = planRow?.max_images_per_property ?? 10;

    const extractResults = await extractListingsFromUrls(urls, {
      extratorBaseUrl: extratorBase,
      extractOptions: { downloadImages: false, maxImages: 10 },
    });

    let processed = 0;
    for (const item of extractResults) {
      const sourceUrl = item.url;
      if (!item.ok) {
        results.push({
          source_url: sourceUrl,
          status: "error",
          error: item.error?.message ?? "extract_failed",
        });
        processed += 1;
        await admin
          .from("property_import_jobs")
          .update({
            processed_count: processed,
            results,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
        continue;
      }

      const listing = listingFromResult(item);
      if (!listing || !listing.title?.trim()) {
        results.push({
          source_url: sourceUrl,
          status: "error",
          error: "listing_empty_or_unavailable",
        });
        processed += 1;
        await admin
          .from("property_import_jobs")
          .update({
            processed_count: processed,
            results,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
        continue;
      }

      const mapped = mapExtratorListingToPropertyPayload(listing, sourceUrl);
      const { import_image_urls, ...payloadRest } = mapped;
      const { import_source_url, ...payload } = payloadRest;
      void import_source_url;

      const { data: property, error: insertErr } = await admin
        .from("properties")
        .insert({
          ...payload,
          account_id: job.account_id,
          broker_id: job.broker_id,
          origin_plan_code: job.origin_plan_code,
        })
        .select("id, public_id, title")
        .single();

      if (insertErr || !property) {
        results.push({
          source_url: sourceUrl,
          status: "error",
          error: insertErr?.message ?? "insert_failed",
        });
      } else {
        await admin.from("property_qrcodes").insert({
          property_id: property.id,
          qr_token: crypto.randomUUID(),
          is_active: true,
        });

        const { uploaded, failed: imageFailures } = await uploadImportedImages(
          admin,
          property.id,
          import_image_urls,
          maxImages,
          sourceUrl,
        );

        results.push({
          source_url: sourceUrl,
          status: "ok",
          property_id: property.id,
          public_id: property.public_id,
          title: property.title,
          images_uploaded: uploaded,
          ...(imageFailures.length > 0
            ? { error: `imagens_parciais:${uploaded}/${import_image_urls.length}` }
            : {}),
        });
      }

      processed += 1;
      await admin
        .from("property_import_jobs")
        .update({
          processed_count: processed,
          results,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    }

    const okCount = results.filter((r) => r.status === "ok").length;
    await admin
      .from("property_import_jobs")
      .update({
        status: okCount > 0 ? "completed" : "failed",
        error_message: okCount > 0 ? null : "Nenhum imóvel importado com sucesso.",
        processed_count: processed,
        results,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "import_job_failed";
    await admin
      .from("property_import_jobs")
      .update({
        status: "failed",
        error_message: message,
        results,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }
}
