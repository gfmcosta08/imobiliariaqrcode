import { getAdminContext } from "@/lib/admin-auth";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ ok: true, data: [] });

  const { data, error } = await admin.supabase
    .from("properties")
    .select(
      `id, public_id, title, listing_status, expires_at, city, state,
       brokers (
         profiles (email, full_name)
       ),
       property_qrcodes (is_active)`,
    )
    .or(`public_id.ilike.%${q}%,title.ilike.%${q}%`)
    .limit(10);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data: data ?? [] });
}
