import { POST as handlePublicLeadPost } from "@/features/public-listings/server/lead-route";

export async function POST(request: Request) {
  return handlePublicLeadPost(request);
}
