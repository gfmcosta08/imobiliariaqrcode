import { after, NextResponse } from "next/server";

import {
  inferImportMode,
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

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
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

  const parsed = await parseJsonObjectWithLimit(request, { maxBytes: 4_096 });
  if (!parsed.ok) return parsed.response;

  const unknown = rejectUnknownKeys(parsed.value, ["url"]);
  if (unknown) {
    return json(400, { ok: false, error: "unexpected_field", field: unknown });
  }

  const url = clampString(parsed.value.url, { maxLength: 2048, trim: true });
  if (!url) {
    return json(400, { ok: false, error: "missing_url" });
  }

  const urlCheck = validateImportUrl(url);
  if (!urlCheck.ok) {
    return json(400, { ok: false, error: urlCheck.error });
  }

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

  const mode = inferImportMode(urlCheck.url);

  const { data: job, error: insertErr } = await admin
    .from("property_import_jobs")
    .insert({
      account_id: resolved.broker.account_id,
      broker_id: resolved.broker.id,
      origin_plan_code: resolved.planCode,
      created_by: user.id,
      source_url: url,
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
