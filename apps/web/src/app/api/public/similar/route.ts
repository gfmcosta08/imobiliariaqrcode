import { GET as handlePublicSimilarGet } from "@/features/public-listings/server/similar-route";

export async function GET(request: Request) {
  return handlePublicSimilarGet(request);
}
