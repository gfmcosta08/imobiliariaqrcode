import {
  DELETE as handleInvitationsDelete,
  PATCH as handleInvitationsPatch,
  POST as handleInvitationsPost,
} from "@/features/admin/server/invitations-route";

export async function POST(request: Request) {
  return handleInvitationsPost(request);
}

export async function PATCH(request: Request) {
  return handleInvitationsPatch(request);
}

export async function DELETE(request: Request) {
  return handleInvitationsDelete(request);
}
