import type { NextRequest } from "next/server";

import { PATCH as handleSubscriptionPatch } from "@/features/admin/server/subscription-route";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ accountId: string }> },
) {
  return handleSubscriptionPatch(request, context);
}
