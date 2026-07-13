import { POST as handleCreateCheckoutPost } from "@/features/billing/server/create-checkout-route";

export async function POST() {
  return handleCreateCheckoutPost();
}
