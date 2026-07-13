import { POST as handleChatPost } from "@/features/chat/server/chat-route";

export async function POST(request: Request) {
  return handleChatPost(request);
}
