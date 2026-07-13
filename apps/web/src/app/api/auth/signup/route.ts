import type { NextRequest } from "next/server";

import { POST as handleAuthSignupPost } from "@/features/auth/server/signup-route";

export async function POST(request: NextRequest) {
  return handleAuthSignupPost(request);
}
