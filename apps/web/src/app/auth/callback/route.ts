import { GET as handleAuthCallbackGet } from "@/features/auth/server/callback-route";

export async function GET(request: Request) {
  return handleAuthCallbackGet(request);
}
