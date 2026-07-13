import { POST as handleQaPaymentFailedPost } from "@/features/billing/server/qa-payment-failed-route";

export const runtime = "nodejs";

export async function POST() {
  return handleQaPaymentFailedPost();
}
