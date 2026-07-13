import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_STATUS = new Set(["open", "in_production", "delivered", "installed", "canceled"]);

async function resolveCurrentAccountId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, accountId: null as string | null, error: "unauthorized" };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile?.account_id) {
    return { supabase, accountId: null as string | null, error: "account_not_found" };
  }

  return { supabase, accountId: profile.account_id as string, error: null as string | null };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await resolveCurrentAccountId();
  if (ctx.error || !ctx.accountId) {
    return NextResponse.json({ ok: false, error: ctx.error ?? "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const patch: Record<string, unknown> = {};

  if (typeof o.status === "string" && o.status.trim()) {
    const status = o.status.trim();
    if (!ALLOWED_STATUS.has(status)) {
      return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
    }
    patch.status = status;
  }

  if (typeof o.scheduled_at === "string") {
    const value = o.scheduled_at.trim();
    if (value && Number.isNaN(Date.parse(value))) {
      return NextResponse.json({ ok: false, error: "invalid_scheduled_at" }, { status: 400 });
    }
    patch.scheduled_at = value || null;
  }

  if (typeof o.completed_at === "string") {
    const value = o.completed_at.trim();
    if (value && Number.isNaN(Date.parse(value))) {
      return NextResponse.json({ ok: false, error: "invalid_completed_at" }, { status: 400 });
    }
    patch.completed_at = value || null;
  }

  if (typeof o.notes === "string") {
    patch.notes = o.notes.trim() || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "empty_patch" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("delivery_orders")
    .update(patch)
    .eq("id", id)
    .eq("account_id", ctx.accountId)
    .select(
      "id, account_id, contract_id, property_id, delivery_model, layout_mode, status, scheduled_at, completed_at, notes, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "delivery_not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item: data });
}
