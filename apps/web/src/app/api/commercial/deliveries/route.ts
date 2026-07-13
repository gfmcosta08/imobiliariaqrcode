import {
  GET as handleDeliveriesGet,
  POST as handleDeliveriesPost,
} from "@/features/partner/server/deliveries-route";

export async function GET(request: Request) {
  return handleDeliveriesGet(request);
}

export async function POST(request: Request) {
  return handleDeliveriesPost(request);
}
