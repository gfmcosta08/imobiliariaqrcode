import { GET as handlePackagesGet } from "@/features/partner/server/packages-route";

export async function GET(request: Request) {
  return handlePackagesGet(request);
}
