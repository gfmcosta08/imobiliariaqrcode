import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_DELIVERY_MODE = new Set(["A", "B", "C"]);
const ALLOWED_LAYOUT_MODE = new Set(["standard", "client_custom"]);

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

export async function GET(request: Request) {
  const ctx = await resolveCurrentAccountId();
  if (ctx.error || !ctx.accountId) {
    return NextResponse.json({ ok: false, error: ctx.error ?? "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const contractId = url.searchParams.get("contract_id")?.trim();

  let query = ctx.supabase
    .from("delivery_orders")
    .select("id, account_id, contract_id, property_id, delivery_model, layout_mode, status, scheduled_at, completed_at, notes, created_at, updated_at")
    .eq("account_id", ctx.accountId)
    .order("created_at", { ascending: false });

  if (contractId) {
    query = query.eq("contract_id", contractId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
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
  const contractId = typeof o.contract_id === "string" ? o.contract_id.trim() : "";
  const propertyId = typeof o.property_id === "string" && o.property_id.trim() ? o.property_id.trim() : null;
  const deliveryModel = typeof o.delivery_model === "string" ? o.delivery_model.trim() : "";
  const layoutMode = typeof o.layout_mode === "string" ? o.layout_mode.trim() : "";
  const scheduledAt =
    typeof o.scheduled_at === "string" && o.scheduled_at.trim() ? o.scheduled_at.trim() : null;
  const notes = typeof o.notes === "string" && o.notes.trim() ? o.notes.trim() : null;

  if (!contractId) {
    return NextResponse.json({ ok: false, error: "missing_contract_id" }, { status: 400 });
  }
  if (!ALLOWED_DELIVERY_MODE.has(deliveryModel)) {
    return NextResponse.json({ ok: false, error: "invalid_delivery_model" }, { status: 400 });
  }
  if (!ALLOWED_LAYOUT_MODE.has(layoutMode)) {
    return NextResponse.json({ ok: false, error: "invalid_layout_mode" }, { status: 400 });
  }
  if (scheduledAt && Number.isNaN(Date.parse(scheduledAt))) {
    return NextResponse.json({ ok: false, error: "invalid_scheduled_at" }, { status: 400 });
  }

  const { data: contract, error: contractError } = await ctx.supabase
    .from("account_commercial_contracts")
    .select("id")
    .eq("id", contractId)
    .eq("account_id", ctx.accountId)
    .maybeSingle();

  if (contractError) {
    return NextResponse.json({ ok: false, error: contractError.message }, { status: 500 });
  }
  if (!contract) {
    return NextResponse.json({ ok: false, error: "contract_not_found" }, { status: 404 });
  }

  if (propertyId) {
    const { data: property, error: propertyError } = await ctx.supabase
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .eq("account_id", ctx.accountId)
      .maybeSingle();
    if (propertyError) {
      return NextResponse.json({ ok: false, error: propertyError.message }, { status: 500 });
    }
    if (!property) {
      return NextResponse.json({ ok: false, error: "property_not_found" }, { status: 404 });
    }
  }

  const { data, error } = await ctx.supabase
    .from("delivery_orders")
    .insert({
      account_id: ctx.accountId,
      contract_id: contractId,
      property_id: propertyId,
      delivery_model: deliveryModel,
      layout_mode: layoutMode,
      status: "open",
      scheduled_at: scheduledAt,
      notes,
    })
    .select("id, account_id, contract_id, property_id, delivery_model, layout_mode, status, scheduled_at, completed_at, notes, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: data }, { status: 201 });
}
