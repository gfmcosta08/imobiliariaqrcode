import { after, NextResponse } from "next/server";

import {
  inferImportMode,
  MAX_PROPERTIES_PER_IMPORT,
  validateImportUrl,
} from "@imobiliariaqrcode/property-importer";

import {
  getPropertyExtractorBaseUrl,
  isPropertyImportEnabled,
} from "@/lib/property-import/enabled";
import { resolveBrokerForImport } from "@/lib/property-import/resolve-broker";
import { runPropertyImportJob } from "@/lib/property-import/run-job";
import { clampString, parseJsonObjectWithLimit, rejectUnknownKeys } from "@/lib/security/json-body";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const SOURCE_URLS_SEPARATOR = "\n";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function parseUrlList(raw: unknown): string[] | null {
  if (Array.isArray(raw)) {
    const items = raw
      .filter((item): item is string => typeof item === "string")
      .map((item) => clampString(item, { maxLength: 2048, trim: true }))
      .filter(Boolean);
    return items.length > 0 ? items : null;
  }
  const single = clampString(raw, { maxLength: 2048, trim: true });
  return single ? [single] : null;
}

function inferCombinedImportMode(
  validatedUrls: URL[],
): "single" | "listing" | "homepage" {
  const modes = validatedUrls.map((url) => inferImportMode(url));
  if (modes.includes("homepage")) return "homepage";
  if (modes.includes("listing")) return "listing";
  return "single";
}

export async function POST(request: Request) {
  if (!isPropertyImportEnabled()) {
    return json(404, { ok: false, error: "feature_disabled" });
  }

  if (!getPropertyExtractorBaseUrl()) {
    return json(503, {
      ok: false,
      error: "extrator_not_configured",
      detail: "Defina PROPERTY_EXTRACTOR_URL no ambiente Preview/staging.",
    });
  }

  const parsed = await parseJsonObjectWithLimit(request, { maxBytes: 24_576 });
  if (!parsed.ok) return parsed.response;

  const unknown = rejectUnknownKeys(parsed.value, ["url", "urls"]);
  if (unknown) {
    return json(400, { ok: false, error: "unexpected_field", field: unknown });
  }

  const hasUrl = parsed.value.url !== undefined;
  const hasUrls = parsed.value.urls !== undefined;
  if (hasUrl && hasUrls) {
    return json(400, { ok: false, error: "ambiguous_url_fields" });
  }

  const urlList = parseUrlList(hasUrls ? parsed.value.urls : parsed.value.url);
  if (!urlList) {
    return json(400, { ok: false, error: "missing_url" });
  }
  if (urlList.length > MAX_PROPERTIES_PER_IMPORT) {
    return json(400, { ok: false, error: "too_many_urls", max: MAX_PROPERTIES_PER_IMPORT });
  }

  const validatedUrls: URL[] = [];
  const seen = new Set<string>();
  for (const raw of urlList) {
    const urlCheck = validateImportUrl(raw);
    if (!urlCheck.ok) {
      return json(400, { ok: false, error: urlCheck.error, url: raw });
    }
    const key = urlCheck.url.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    validatedUrls.push(urlCheck.url);
  }

  if (validatedUrls.length === 0) {
    return json(400, { ok: false, error: "missing_url" });
  }

  const storedSourceUrl = validatedUrls.map((u) => u.toString()).join(SOURCE_URLS_SEPARATOR);

  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  const admin = createServiceRoleClient();
  const resolved = await resolveBrokerForImport(admin, user);
  if ("error" in resolved) {
    return json(resolved.status, { ok: false, error: resolved.error });
  }

  const mode = inferCombinedImportMode(validatedUrls);

  const { data: job, error: insertErr } = await admin
    .from("property_import_jobs")
    .insert({
      account_id: resolved.broker.account_id,
      broker_id: resolved.broker.id,
      origin_plan_code: resolved.planCode,
      created_by: user.id,
      source_url: storedSourceUrl,
      mode,
      status: "pending",
    })
    .select("id, status, mode, source_url, created_at")
    .single();

  if (insertErr || !job) {
    return json(500, { ok: false, error: insertErr?.message ?? "job_create_failed" });
  }

  after(async () => {
    await runPropertyImportJob(job.id);
  });

  return json(202, {
    ok: true,
    job_id: job.id,
    status: job.status,
    mode: job.mode,
    poll_url: `/api/properties/import/${job.id}`,
  });
}
