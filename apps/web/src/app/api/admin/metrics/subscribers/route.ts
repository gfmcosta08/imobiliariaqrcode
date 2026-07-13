import type { NextRequest } from "next/server";

import { GET as handleSubscriberMetricsGet } from "@/features/admin/server/subscriber-metrics-route";

export async function GET(request: NextRequest) {
  return handleSubscriberMetricsGet(request);
}
