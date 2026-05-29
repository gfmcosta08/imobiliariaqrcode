import { NextResponse } from "next/server";

import { isPropertyImportEnabled } from "@/lib/property-import/enabled";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ jobId: string }> };

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function GET(_request: Request, context: RouteContext) {
  if (!isPropertyImportEnabled()) {
    return json(404, { ok: false, error: "feature_disabled" });
  }

  const { jobId } = await context.params;
  if (!jobId) {
    return json(400, { ok: false, error: "missing_job_id" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  const { data: job, error } = await supabase
    .from("property_import_jobs")
    .select(
      "id, status, mode, source_url, total_count, processed_count, results, error_message, created_at, updated_at",
    )
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    return json(500, { ok: false, error: error.message });
  }
  if (!job) {
    return json(404, { ok: false, error: "job_not_found" });
  }

  return json(200, { ok: true, job });
}
