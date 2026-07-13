import { PATCH as handleDeliveryPatch } from "@/features/partner/server/delivery-route";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleDeliveryPatch(request, context);
}
