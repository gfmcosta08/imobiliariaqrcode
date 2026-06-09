const allowOrigin = Deno.env.get("CORS_ALLOW_ORIGIN")?.trim() || "*";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": allowOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
