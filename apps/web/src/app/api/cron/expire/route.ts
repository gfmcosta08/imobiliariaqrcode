import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Chame periodicamente (ex.: Vercel Cron) com:
 * - Authorization: Bearer CRON_SECRET (Vercel injeta quando CRON_SECRET está definido no projeto), ou
 * - GET ?secret=CRON_SECRET (útil para testes locais; evite em produção se URLs forem logadas).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const authorized = Boolean(secret) && (auth === `Bearer ${secret}` || querySecret === secret);

  if (!authorized) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: "missing_supabase_env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("expire_free_properties");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expired_count: data ?? 0 });
}
