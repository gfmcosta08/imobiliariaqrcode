import { POST as handleCustomerPortalPost } from "@/features/billing/server/customer-portal-route";

export async function POST() {
  return handleCustomerPortalPost();
}
