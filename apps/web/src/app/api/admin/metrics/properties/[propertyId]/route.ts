import type { NextRequest } from "next/server";

import { GET as handlePropertyMetricsGet } from "@/features/admin/server/property-metrics-route";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ propertyId: string }> },
) {
  return handlePropertyMetricsGet(request, context);
}
