import type { NextRequest } from "next/server";

import { GET as handleSubscriptionsGet } from "@/features/admin/server/subscriptions-route";

export async function GET(request: NextRequest) {
  return handleSubscriptionsGet(request);
}
