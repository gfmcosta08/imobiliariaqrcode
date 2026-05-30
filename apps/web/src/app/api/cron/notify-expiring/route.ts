import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/security/cron-auth";

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

  // Notifica com 7 dias de antecedência e com 1 dia de antecedência
  const [res7, res1] = await Promise.all([
    supabase.rpc("notify_expiring_properties", { p_days_ahead: 7 }),
    supabase.rpc("notify_expiring_properties", { p_days_ahead: 1 }),
  ]);

  if (res7.error || res1.error) {
    return NextResponse.json(
      { ok: false, error: res7.error?.message ?? res1.error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    notified_7d: res7.data ?? 0,
    notified_1d: res1.data ?? 0,
  });
}
