import { GET as handlePlansGet } from "@/features/admin/server/plans-route";

export async function GET() {
  return handlePlansGet();
}
