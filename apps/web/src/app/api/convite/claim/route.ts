import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NextResponse } from "next/server";
import { clampString, parseJsonObjectWithLimit, rejectUnknownKeys } from "@/lib/security/json-body";
import {
  checkSecurityRateLimit,
  clearSecurityRateLimit,
  getClientIp,
  hashedRateLimitKey,
  sha256Hex,
} from "@/lib/security/request-guards";

const INVITE_CLAIM_RATE_LIMIT = 10;
const INVITE_CLAIM_RATE_WINDOW_SECONDS = 10 * 60;
const INVITE_CLAIM_RATE_LOCK_SECONDS = 15 * 60;

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonObjectWithLimit(request, { maxBytes: 2_048 });
    if (!parsed.ok) return parsed.response;

    const unknown = rejectUnknownKeys(parsed.value, ["login_code", "access_code"]);
    if (unknown) {
      return NextResponse.json(
        { ok: false, error: "unexpected_field", field: unknown },
        { status: 400 },
      );
    }

    const login_code = clampString(parsed.value.login_code, { maxLength: 32, trim: true });
    const access_code = clampString(parsed.value.access_code, { maxLength: 64, trim: true });
    if (!login_code || !access_code) {
      return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const ip = getClientIp(request);
    const ipHash = await sha256Hex(ip);
    const rateKey = await hashedRateLimitKey(["invite_claim", ip, login_code]);
    const rate = await checkSecurityRateLimit(supabase, {
      key: rateKey,
      limit: INVITE_CLAIM_RATE_LIMIT,
      windowSeconds: INVITE_CLAIM_RATE_WINDOW_SECONDS,
      lockSeconds: INVITE_CLAIM_RATE_LOCK_SECONDS,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, error: "too_many_attempts", locked_until: rate.lockedUntil },
        { status: 429 },
      );
    }

    const { data: invitation } = await supabase
      .from("broker_invitations")
      .select("id, access_code_hash, temp_email, expires_at, status")
      .eq("login_code", login_code)
      .maybeSingle();

    if (!invitation) {
      return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
    }

    if (invitation.status === "claimed") {
      return NextResponse.json(
        { ok: false, error: "invitation_already_activated" },
        { status: 409 },
      );
    }

    if (invitation.status === "completed") {
      return NextResponse.json({ ok: false, error: "invitation_completed" }, { status: 409 });
    }

    if (invitation.status === "canceled") {
      return NextResponse.json({ ok: false, error: "invitation_canceled" }, { status: 410 });
    }

    if (invitation.status === "expired") {
      return NextResponse.json({ ok: false, error: "invitation_expired" }, { status: 410 });
    }

    if (invitation.status !== "pending") {
      return NextResponse.json({ ok: false, error: "invitation_unavailable" }, { status: 409 });
    }

    const now = new Date();
    const expiresAt = invitation.expires_at ? new Date(String(invitation.expires_at)) : null;
    if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt < now) {
      await supabase
        .from("broker_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
      return NextResponse.json({ ok: false, error: "invitation_expired" }, { status: 401 });
    }

    const inputHash = await sha256Hex(access_code);
    if (inputHash !== invitation.access_code_hash) {
      await supabase.from("audit_logs").insert({
        account_id: null,
        actor_profile_id: null,
        action: "invite_claim_invalid_attempt",
        entity_type: "broker_invitations",
        entity_id: String(invitation.id),
        metadata: { ip_hash: ipHash },
      });
      return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
    }

    if (!invitation.temp_email) {
      return NextResponse.json({ ok: false, error: "invitation_invalid_state" }, { status: 409 });
    }

    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
      email: invitation.temp_email,
      password: access_code,
    });

    if (signInError || !sessionData.session) {
      return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
    }

    await clearSecurityRateLimit(supabase, rateKey);
    await supabase.from("audit_logs").insert({
      account_id: null,
      actor_profile_id: null,
      action: "invite_claim_success",
      entity_type: "broker_invitations",
      entity_id: String(invitation.id),
      metadata: { ip_hash: ipHash },
    });

    return NextResponse.json({
      ok: true,
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    });
  } catch (error) {
    console.error("convite claim fatal error", error);
    return NextResponse.json({ ok: false, error: "claim_unexpected_error" }, { status: 500 });
  }
}
