import { NextResponse, type NextRequest } from "next/server";

import { getAdminContext } from "@/lib/admin-auth";
import type { PropertyQrMetrics } from "../lib/types";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ propertyId: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const { propertyId } = await context.params;

  const userClient = await createClient();
  const { data, error } = await userClient.rpc("admin_get_property_qr_metrics", {
    p_property_id: propertyId,
  });

  if (error) {
    const status = error.message.includes("forbidden")
      ? 403
      : error.message.includes("property_not_found")
        ? 404
        : 500;
    return NextResponse.json({ ok: false, error: error.message }, { status });
  }

  return NextResponse.json({ ok: true, data: data as PropertyQrMetrics });
}
