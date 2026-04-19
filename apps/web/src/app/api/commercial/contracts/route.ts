import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_RENEWAL = new Set(["manual", "auto"]);

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

export async function GET() {
  const ctx = await resolveCurrentAccountId();
  if (ctx.error || !ctx.accountId) {
    return NextResponse.json({ ok: false, error: ctx.error ?? "unauthorized" }, { status: 401 });
  }

  const { data, error } = await ctx.supabase
    .from("account_commercial_contracts")
    .select(
      "id, account_id, package_id, status, starts_at, ends_at, renewal_mode, notes, created_at, updated_at, package:commercial_packages(code, name, package_type, price_cents, currency)",
    )
    .eq("account_id", ctx.accountId)
    .order("created_at", { ascending: false });

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
  const packageId = typeof o.package_id === "string" ? o.package_id.trim() : "";
  const startsAt = typeof o.starts_at === "string" && o.starts_at.trim() ? o.starts_at.trim() : null;
  const endsAt = typeof o.ends_at === "string" && o.ends_at.trim() ? o.ends_at.trim() : null;
  const renewalMode = typeof o.renewal_mode === "string" ? o.renewal_mode.trim() : "manual";
  const notes = typeof o.notes === "string" && o.notes.trim() ? o.notes.trim() : null;

  if (!packageId) {
    return NextResponse.json({ ok: false, error: "missing_package_id" }, { status: 400 });
  }
  if (!ALLOWED_RENEWAL.has(renewalMode)) {
    return NextResponse.json({ ok: false, error: "invalid_renewal_mode" }, { status: 400 });
  }
  if (startsAt && Number.isNaN(Date.parse(startsAt))) {
    return NextResponse.json({ ok: false, error: "invalid_starts_at" }, { status: 400 });
  }
  if (endsAt && Number.isNaN(Date.parse(endsAt))) {
    return NextResponse.json({ ok: false, error: "invalid_ends_at" }, { status: 400 });
  }

  const { data: pkg, error: packageError } = await ctx.supabase
    .from("commercial_packages")
    .select("id, active")
    .eq("id", packageId)
    .maybeSingle();

  if (packageError) {
    return NextResponse.json({ ok: false, error: packageError.message }, { status: 500 });
  }
  if (!pkg) {
    return NextResponse.json({ ok: false, error: "package_not_found" }, { status: 404 });
  }
  if (!pkg.active) {
    return NextResponse.json({ ok: false, error: "package_inactive" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("account_commercial_contracts")
    .insert({
      account_id: ctx.accountId,
      package_id: packageId,
      status: "draft",
      starts_at: startsAt,
      ends_at: endsAt,
      renewal_mode: renewalMode,
      notes,
    })
    .select("id, account_id, package_id, status, starts_at, ends_at, renewal_mode, notes, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: data }, { status: 201 });
}
