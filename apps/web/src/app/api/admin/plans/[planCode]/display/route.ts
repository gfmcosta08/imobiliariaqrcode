import type { NextRequest } from "next/server";

import { PATCH as handlePlanDisplayPatch } from "@/features/admin/server/plan-display-route";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ planCode: string }> },
) {
  return handlePlanDisplayPatch(request, context);
}
