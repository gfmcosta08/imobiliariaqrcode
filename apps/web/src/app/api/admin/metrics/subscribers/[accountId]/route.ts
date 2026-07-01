import { NextResponse, type NextRequest } from "next/server";

import { getAdminContext } from "@/lib/admin-auth";
import type { SubscriberDashboard } from "@/lib/admin/types";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ accountId: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const { accountId } = await context.params;

  const userClient = await createClient();
  const { data, error } = await userClient.rpc("admin_get_subscriber_dashboard", {
    p_account_id: accountId,
  });

  if (error) {
    const status = error.message.includes("forbidden")
      ? 403
      : error.message.includes("account_not_found")
        ? 404
        : 500;
    return NextResponse.json({ ok: false, error: error.message }, { status });
  }

  return NextResponse.json({ ok: true, data: data as SubscriberDashboard });
}
