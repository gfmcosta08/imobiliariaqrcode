import { GET as handleChatMessagesGet } from "@/features/chat/server/messages-route";

export async function GET(request: Request) {
  return handleChatMessagesGet(request);
}
