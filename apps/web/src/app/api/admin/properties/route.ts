import type { NextRequest } from "next/server";

import { GET as handlePropertiesGet } from "@/features/admin/server/properties-route";

export async function GET(request: NextRequest) {
  return handlePropertiesGet(request);
}
