import { corsHeaders } from "../_shared/cors.ts";

function unauthorized(): Response {
  return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, reason: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const workerEnabled = Deno.env.get("ENABLE_MEDIA_PROCESS_WORKER") === "1";
  if (!workerEnabled) {
    return new Response(
      JSON.stringify({
        ok: false,
        reason: "media_process_disabled",
        note: "Web upload currently stores property_media.status as ready.",
      }),
      {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const authToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!cronSecret || authToken !== cronSecret) {
    return unauthorized();
  }

  return new Response(
    JSON.stringify({
      ok: false,
      reason: "media-process placeholder",
      note: "Implement queue processing before enabling this worker.",
    }),
    {
      status: 501,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
