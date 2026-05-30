import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/security/cron-auth";

export async function GET(request: Request) {
  // 🔒 SEGURANÇA: nunca permitir "fail-open" quando CRON_SECRET está ausente.
  const auth = requireCronAuth(request);
  if (!auth.ok) return auth.response;
  const { cronSecret } = auth;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: "SUPABASE_URL not configured" }, { status: 500 });
  }

  const dispatchUrl = `${supabaseUrl}/functions/v1/whatsapp-dispatch`;
  const res = await fetch(dispatchUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${cronSecret}` },
  });

  const body = await res.text();
  return NextResponse.json({ status: res.status, body }, { status: res.ok ? 200 : 502 });
}
