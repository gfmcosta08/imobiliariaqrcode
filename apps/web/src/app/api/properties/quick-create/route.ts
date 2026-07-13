import { POST as handlePropertyQuickCreatePost } from "@/features/properties/server/quick-create-route";

export async function POST(request: Request) {
  return handlePropertyQuickCreatePost(request);
}
