import { NextResponse } from "next/server";

import { validateCronAuthorization } from "@/lib/security/cron-auth";

export async function GET(request: Request) {
  const auth = validateCronAuthorization(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: "SUPABASE_URL not configured" }, { status: 500 });
  }

  const monitorUrl = `${supabaseUrl}/functions/v1/bot-health-monitor`;
  const res = await fetch(monitorUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.secret}` },
  });

  const body = await res.text();
  return NextResponse.json({ status: res.status, body }, { status: res.ok ? 200 : 502 });
}
