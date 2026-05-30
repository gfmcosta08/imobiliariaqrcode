import {
  discoverPropertyUrls,
  extractListingsFromUrls,
  extractListingWithSiteParser,
  listingFromResult,
  mapExtratorListingToPropertyPayload,
  MAX_PROPERTIES_PER_IMPORT,
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

function isBlockedListingTitle(title: string | null | undefined): boolean {
  const t = (title ?? "").trim().toLowerCase();
  if (!t) return true;
  return (
    /^olx - o maior site/.test(t) ||
    /^vivanci imobili[aá]ria - im[oó]veis em/.test(t)
  );
}

const SOURCE_URLS_SEPARATOR = "\n";

function parseJobSourceUrls(sourceUrl: string): string[] {
  if (sourceUrl.includes(SOURCE_URLS_SEPARATOR)) {
    return sourceUrl
      .split(SOURCE_URLS_SEPARATOR)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [sourceUrl.trim()].filter(Boolean);
}

function summarizeImportFailure(results: ImportJobItemResult[]): string {
  const errors = results.map((r) => r.error).filter(Boolean) as string[];
  if (errors.length === 0) return "Nenhum imóvel importado com sucesso.";

  if (errors.every((e) => e.includes("site_blocked_cloudflare"))) {
    return "site_blocked_cloudflare";
  }
  if (errors.every((e) => e === "listing_empty_or_unavailable")) {
    return "all_listings_empty_or_unavailable";
  }
  if (errors.some((e) => e.includes("site_blocked_cloudflare"))) {
    return "Alguns anúncios foram bloqueados (Cloudflare). Tente outro portal ou importe manualmente.";
  }
  return "Nenhum imóvel importado com sucesso.";
}

function looksLikeIncompleteDescription(listing: { full_description?: string | null; debug?: { expanded?: boolean } | null }): boolean {
  const text = (listing.full_description ?? "").trim();
  if (!text) return false;

  // Indicadores explícitos de truncamento
  if (text.endsWith("...") || text.endsWith("…")) return true;

  // O extrator tentou expandir mas a descrição ainda ficou curtíssima
  if (listing.debug?.expanded === true && text.length < 280) return true;

  // Descrição curta que termina sem pontuação de encerramento: provavelmente cortada
  // (ex.: "sendo um su" — texto termina no meio de uma palavra)
  const endsWithClosingChar = /[.!?;:"'\])}]$/.test(text);
  if (!endsWithClosingChar && text.length < 200) return true;

  return false;
}

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
    const sourceUrls = parseJobSourceUrls(job.source_url);
    if (sourceUrls.length === 0) {
      throw new Error("missing_url");
    }

    const discovered = new Set<string>();
    let detectedMode: "single" | "listing" | "homepage" = "single";

    for (const sourceUrl of sourceUrls) {
      const urlCheck = validateImportUrl(sourceUrl);
      if (!urlCheck.ok) {
        throw new Error(urlCheck.error);
      }

      const { urls, mode } = await discoverPropertyUrls(sourceUrl, {
        extratorBaseUrl: extratorBase,
      });
      detectedMode = mode ?? inferImportMode(urlCheck.url);
      for (const found of urls) {
        if (discovered.size >= MAX_PROPERTIES_PER_IMPORT) break;
        discovered.add(found);
      }
      if (discovered.size >= MAX_PROPERTIES_PER_IMPORT) break;
    }

    const urls = [...discovered];

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

    // Try site-specific parsers first; fall back to generic extractor for remaining URLs
    const siteParserResults = new Map<string, Awaited<ReturnType<typeof extractListingWithSiteParser>>>();
    const urlsForGenericExtractor: string[] = [];

    await Promise.allSettled(
      urls.map(async (url) => {
        const siteResult = await extractListingWithSiteParser(url, extratorBase);
        if (siteResult) {
          siteParserResults.set(url, siteResult);
        } else {
          urlsForGenericExtractor.push(url);
        }
      }),
    );

    const extractResults = urlsForGenericExtractor.length > 0
      ? await extractListingsFromUrls(urlsForGenericExtractor, {
          extratorBaseUrl: extratorBase,
          extractOptions: { downloadImages: false, maxImages: 10 },
        })
      : [];

    let processed = 0;
    for (const url of urls) {
      const sourceUrl = url;

      // Try site-specific parser result first
      let listing = siteParserResults.get(url) ?? null;

      if (!listing) {
        // Fall back to generic extractor result
        const item = extractResults.find((r) => r.url === url);
        if (!item) {
          results.push({ source_url: sourceUrl, status: "error", error: "extract_failed" });
          processed += 1;
          await admin
            .from("property_import_jobs")
            .update({ processed_count: processed, results, updated_at: new Date().toISOString() })
            .eq("id", jobId);
          continue;
        }
        if (!item.ok) {
          results.push({
            source_url: sourceUrl,
            status: "error",
            error: item.error?.message ?? "extract_failed",
          });
          processed += 1;
          await admin
            .from("property_import_jobs")
            .update({ processed_count: processed, results, updated_at: new Date().toISOString() })
            .eq("id", jobId);
          continue;
        }
        listing = listingFromResult(item);
      }

      if (!listing || !listing.title?.trim() || isBlockedListingTitle(listing.title)) {
        results.push({
          source_url: sourceUrl,
          status: "error",
          error: isBlockedListingTitle(listing?.title)
            ? "site_blocked_cloudflare"
            : "listing_empty_or_unavailable",
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

      const incompleteDescription = looksLikeIncompleteDescription(listing);

      const mapped = mapExtratorListingToPropertyPayload(listing, sourceUrl);
      const { import_image_urls, ...payloadRest } = mapped;
      const rawImageCount = listing.images.filter((img) => img.url?.trim()).length;
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

        const imageError =
          imageFailures.length > 0
            ? `imagens_parciais:${uploaded}/${import_image_urls.length}:${imageFailures.slice(0, 3).join(",")}`
            : uploaded === 0 && rawImageCount > 0 && import_image_urls.length === 0
              ? `imagens_filtradas:${rawImageCount}`
              : uploaded === 0 && import_image_urls.length > 0
                ? `imagens_falharam:${import_image_urls.length}:${imageFailures.slice(0, 3).join(",") || "unknown"}`
                : undefined;

        const warnings: string[] = [];
        if (incompleteDescription) warnings.push("descricao_incompleta");
        if (imageError) warnings.push(imageError);
        results.push({
          source_url: sourceUrl,
          status: "ok",
          property_id: property.id,
          public_id: property.public_id,
          title: property.title,
          images_uploaded: uploaded,
          ...(warnings.length > 0 ? { error: warnings.join("|") } : {}),
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
        error_message: okCount > 0 ? null : summarizeImportFailure(results),
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
