import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "checkout_temporarily_unavailable",
      detail: "Checkout online via Stripe esta temporariamente desativado.",
    },
    { status: 503 },
  );
}
