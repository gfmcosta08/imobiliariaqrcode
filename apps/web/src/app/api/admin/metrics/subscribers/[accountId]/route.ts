import type { NextRequest } from "next/server";

import { GET as handleSubscriberMetricGet } from "@/features/admin/server/subscriber-metric-route";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ accountId: string }> },
) {
  return handleSubscriberMetricGet(request, context);
}
