import { probeExtratorConnectivity } from "@imobiliariaqrcode/property-importer";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getPropertyExtractorBaseUrl } from "@/lib/property-import/enabled";

/**
 * `GET /api/health` — processo vivo.
 * `GET /api/health?deep=1` — opcionalmente verifica leitura anônima em `plans` (requer env público do Supabase).
 * `GET /api/health?deep=2` — Preview/staging: probe Vercel → PROPERTY_EXTRACTOR_URL.
 */
export async function GET(request: Request) {
  const ts = new Date().toISOString();
  const base = { ok: true as const, service: "web", ts };

  const url = new URL(request.url);
  const deep = url.searchParams.get("deep");

  if (deep === "2") {
    if (process.env.VERCEL_ENV === "production") {
      return NextResponse.json({ ...base, extrator: "skipped", detail: "deep=2 disabled in production" });
    }

    const extratorBase = getPropertyExtractorBaseUrl();
    if (!extratorBase) {
      return NextResponse.json({
        ...base,
        extrator: "skipped",
        detail: "PROPERTY_EXTRACTOR_URL not configured",
      });
    }

    const probe = await probeExtratorConnectivity(extratorBase);
    return NextResponse.json({ ...base, ...probe });
  }

  if (deep !== "1") {
    return NextResponse.json(base);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anon) {
    return NextResponse.json({ ...base, supabase: "skipped_no_public_env" });
  }

  const supabase = createClient(supabaseUrl, anon, { auth: { persistSession: false } });
  const { error } = await supabase.from("plans").select("code").limit(1);
  if (error) {
    return NextResponse.json({ ...base, supabase: "error", detail: error.message });
  }

  return NextResponse.json({ ...base, supabase: "ok" });
}
