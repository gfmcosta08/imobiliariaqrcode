import type { NextRequest } from "next/server";

import { POST as handleStripeWebhookPost } from "@/features/billing/server/stripe-webhook-route";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleStripeWebhookPost(request);
}
