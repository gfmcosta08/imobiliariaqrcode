import type { NextRequest } from "next/server";

import { POST as handlePropertyMediaPost } from "@/features/properties/server/media-route";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ propertyId: string }> },
) {
  return handlePropertyMediaPost(request, context);
}
