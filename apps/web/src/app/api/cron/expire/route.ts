import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/security/cron-auth";

/**
 * Chame periodicamente (ex.: Vercel Cron) com:
 * - Authorization: Bearer CRON_SECRET (Vercel injeta quando CRON_SECRET está definido no projeto), ou
 * - GET ?secret=CRON_SECRET (útil para testes locais; evite em produção se URLs forem logadas).
 */
export async function GET(request: Request) {
  // 🔒 SEGURANÇA: falha-seguro + compat local via `?secret=`.
  const auth = requireCronAuth(request, { allowQuerySecret: true });
  if (!auth.ok) return auth.response;

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
