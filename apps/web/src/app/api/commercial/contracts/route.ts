import {
  GET as handleContractsGet,
  POST as handleContractsPost,
} from "@/features/partner/server/contracts-route";

export async function GET() {
  return handleContractsGet();
}

export async function POST(request: Request) {
  return handleContractsPost(request);
}
