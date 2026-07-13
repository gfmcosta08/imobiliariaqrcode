import { POST as handleInvitationClaimPost } from "@/features/auth/server/claim-route";

export async function POST(request: Request) {
  return handleInvitationClaimPost(request);
}
