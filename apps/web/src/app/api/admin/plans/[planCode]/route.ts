import type { NextRequest } from "next/server";

import { PATCH as handlePlanPatch } from "@/features/admin/server/plan-route";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ planCode: string }> },
) {
  return handlePlanPatch(request, context);
}
