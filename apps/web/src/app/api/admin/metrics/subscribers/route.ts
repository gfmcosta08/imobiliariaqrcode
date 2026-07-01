import { NextResponse, type NextRequest } from "next/server";

import { getAdminContext } from "@/lib/admin-auth";
import type { SubscriberRow } from "@/lib/admin/types";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  const userClient = await createClient();
  const { data, error } = await userClient.rpc("admin_search_subscribers", {
    p_query: q,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    const status = error.message.includes("forbidden") ? 403 : 500;
    return NextResponse.json({ ok: false, error: error.message }, { status });
  }

  const rows = ((data ?? []) as SubscriberRow[]).map((row) => ({
    ...row,
    total_properties: Number(row.total_properties ?? 0),
    total_qr_reads: Number(row.total_qr_reads ?? 0),
    total_leads: Number(row.total_leads ?? 0),
  }));

  return NextResponse.json({ ok: true, data: rows });
}
