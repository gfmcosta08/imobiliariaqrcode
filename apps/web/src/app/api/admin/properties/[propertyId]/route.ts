import type { NextRequest } from "next/server";

import { PATCH as handlePropertyPatch } from "@/features/admin/server/property-route";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ propertyId: string }> },
) {
  return handlePropertyPatch(request, context);
}
