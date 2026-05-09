import { getAdminContext } from "@/lib/admin-auth";
import { NextResponse, type NextRequest } from "next/server";

const ACTIVE_STATUSES = ["published", "printed"];
const INACTIVE_STATUSES = ["expired", "removed", "blocked"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const admin = await getAdminContext();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const { propertyId } = await params;
  const body = (await req.json()) as {
    expires_at?: string | null;
    listing_status?: string;
  };

  if (
    body.expires_at !== undefined &&
    body.expires_at !== null &&
    Number.isNaN(new Date(body.expires_at).getTime())
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid_expires_at", detail: "Informe uma data valida." },
      { status: 400 },
    );
  }

  const { supabase, userId } = admin;
  const { data: before } = await supabase
    .from("properties")
    .select("listing_status, expires_at, public_id")
    .eq("id", propertyId)
    .maybeSingle();

  if (!before) {
    return NextResponse.json({ ok: false, error: "property_not_found" }, { status: 404 });
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.expires_at !== undefined) updatePayload.expires_at = body.expires_at;
  if (body.listing_status !== undefined) updatePayload.listing_status = body.listing_status;

  const { error } = await supabase.from("properties").update(updatePayload).eq("id", propertyId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (body.listing_status) {
    const isActive = ACTIVE_STATUSES.includes(body.listing_status);
    const isInactive = INACTIVE_STATUSES.includes(body.listing_status);
    if (isActive || isInactive) {
      await supabase
        .from("property_qrcodes")
        .update({ is_active: isActive })
        .eq("property_id", propertyId);
    }
  }

  await supabase.from("audit_logs").insert({
    account_id: null,
    actor_profile_id: userId,
    action: "admin_update_property",
    entity_type: "properties",
    entity_id: propertyId,
    metadata: { before, after: body, public_id: before.public_id },
  });

  return NextResponse.json({ ok: true });
}
