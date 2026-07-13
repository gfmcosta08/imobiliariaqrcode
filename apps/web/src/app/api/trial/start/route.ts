import { POST as handleTrialStartPost } from "@/features/billing/server/trial-start-route";

export async function POST() {
  return handleTrialStartPost();
}
