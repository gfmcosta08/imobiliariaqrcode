import { NextResponse } from "next/server";

import { isPropertyImportEnabled } from "@/lib/property-import/enabled";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";

/** Jobs em `running` sem heartbeat há mais que isso foram interrompidos (timeout serverless). */
const STALE_RUNNING_MS = 5 * 60 * 1000;

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

  if (job.status === "running") {
    const updatedAt = new Date(job.updated_at).getTime();
    if (Number.isFinite(updatedAt) && Date.now() - updatedAt > STALE_RUNNING_MS) {
      const admin = createServiceRoleClient();
      const staleMessage = "job_stale_or_interrupted";
      await admin
        .from("property_import_jobs")
        .update({
          status: "failed",
          error_message: staleMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("status", "running");

      return json(200, {
        ok: true,
        job: {
          ...job,
          status: "failed",
          error_message: staleMessage,
        },
      });
    }
  }

  return json(200, { ok: true, job });
}
