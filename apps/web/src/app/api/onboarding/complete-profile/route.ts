import type { NextRequest } from "next/server";

import { POST as handleCompleteProfilePost } from "@/features/onboarding/server/complete-profile-route";

export async function POST(request: NextRequest) {
  return handleCompleteProfilePost(request);
}
