import { NextResponse, type NextRequest } from "next/server";

import { getAdminContext } from "@/lib/admin-auth";
import { loadSubscriberDashboard } from "@/lib/admin/subscriber-dashboard";

type RouteContext = { params: Promise<{ accountId: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const { accountId } = await context.params;
  const dashboard = await loadSubscriberDashboard(admin.supabase, accountId);

  if (!dashboard) {
    return NextResponse.json({ ok: false, error: "account_not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: dashboard });
}
