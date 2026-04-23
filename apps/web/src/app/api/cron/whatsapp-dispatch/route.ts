import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET ?? "";
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
