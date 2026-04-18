import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const allowedFields = ["client_name", "notes", "broker_notes", "status"];
  const updates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in o) {
      updates[field] = o[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: "no_fields_to_update" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ ok: false, error: "lead_not_found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("leads")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lead, error } = await supabase
    .from("leads")
    .select("id, client_name, client_phone, notes, broker_notes, status, intent, source, created_at, property:properties (id, public_id, city, state)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!lead) {
    return NextResponse.json({ ok: false, error: "lead_not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lead });
}