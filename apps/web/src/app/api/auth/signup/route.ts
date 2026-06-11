import { recordActivationEvent } from "@/lib/analytics/activation-events";
import { LEGAL_VERSION } from "@/lib/legal";
import { clampString, parseJsonObjectWithLimit, rejectUnknownKeys } from "@/lib/security/json-body";
import {
  checkSecurityRateLimit,
  getClientIp,
  hashedRateLimitKey,
} from "@/lib/security/request-guards";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NextRequest, NextResponse } from "next/server";

const SIGNUP_RATE_LIMIT = 5;
const SIGNUP_RATE_WINDOW_SECONDS = 10 * 60;
const SIGNUP_RATE_LOCK_SECONDS = 30 * 60;

async function verifySignupTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.SIGNUP_TURNSTILE_SECRET?.trim();
  const production = process.env.VERCEL_ENV === "production";
  if (!secret) return !production;
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

export async function POST(req: NextRequest) {
  const parsed = await parseJsonObjectWithLimit(req, { maxBytes: 6_144 });
  if (!parsed.ok) return parsed.response;

  const unknown = rejectUnknownKeys(parsed.value, [
    "email",
    "password",
    "fullName",
    "whatsapp",
    "acceptedLegal",
    "turnstileToken",
  ]);
  if (unknown) {
    return NextResponse.json(
      { ok: false, error: "unexpected_field", field: unknown },
      { status: 400 },
    );
  }

  const email = clampString(parsed.value.email, { maxLength: 160, trim: true });
  const password = clampString(parsed.value.password, { maxLength: 128, trim: false });
  const fullName = clampString(parsed.value.fullName, { maxLength: 120, trim: true });
  const whatsapp = clampString(parsed.value.whatsapp, { maxLength: 32, trim: true });
  const acceptedLegal = parsed.value.acceptedLegal === true;
  const turnstileToken = clampString(parsed.value.turnstileToken, { maxLength: 4096, trim: true });

  if (!email?.trim() || !password) {
    return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ ok: false, error: "password_too_short" }, { status: 400 });
  }

  if (acceptedLegal !== true) {
    return NextResponse.json(
      {
        error: "legal_acceptance_required",
        detail: "Aceite os Termos de Uso e a Politica de Privacidade para criar a conta.",
      },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();

  const normalizedEmail = email.trim().toLowerCase();
  const ip = getClientIp(req);
  const rateKey = await hashedRateLimitKey(["signup", ip, normalizedEmail]);
  const rate = await checkSecurityRateLimit(supabase, {
    key: rateKey,
    limit: SIGNUP_RATE_LIMIT,
    windowSeconds: SIGNUP_RATE_WINDOW_SECONDS,
    lockSeconds: SIGNUP_RATE_LOCK_SECONDS,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", locked_until: rate.lockedUntil },
      { status: 429 },
    );
  }

  const turnstileOk = await verifySignupTurnstile(turnstileToken, ip);
  if (!turnstileOk) {
    const missingSecret =
      process.env.VERCEL_ENV === "production" && !process.env.SIGNUP_TURNSTILE_SECRET;
    return NextResponse.json(
      { ok: false, error: missingSecret ? "signup_antibot_not_configured" : "antibot_failed" },
      { status: missingSecret ? 503 : 403 },
    );
  }

  const normalizedName = fullName?.trim() || normalizedEmail.split("@")[0] || "Corretor";
  const normalizedWhatsapp = (whatsapp ?? "").replace(/\D/g, "");
  const triggerSafeWhatsapp = `pending-${crypto.randomUUID().replace(/-/g, "")}`.slice(0, 40);
  const legalAcceptedAt = new Date().toISOString();

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (existingProfile) {
    return NextResponse.json({ ok: false, error: "signup_unavailable" }, { status: 409 });
  }

  const { data: createdUser, error } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: process.env.VERCEL_ENV !== "production",
    user_metadata: {
      full_name: normalizedName,
      whatsapp_number: triggerSafeWhatsapp,
      legal_terms_accepted: true,
      legal_privacy_accepted: true,
      legal_version: LEGAL_VERSION,
      legal_accepted_at: legalAcceptedAt,
    },
  });

  if (error) {
    const alreadyExists =
      error.message.toLowerCase().includes("already") ||
      error.message.toLowerCase().includes("exists");
    return NextResponse.json(
      { ok: false, error: alreadyExists ? "signup_unavailable" : "signup_failed" },
      { status: alreadyExists ? 409 : 400 },
    );
  }

  const userId = createdUser.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Falha ao criar usuario" }, { status: 500 });
  }

  // Preview/dev hardening: provision profile/broker/subscription explicitly to avoid
  // fragile DB trigger dependencies in staging datasets.
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", userId)
    .maybeSingle();

  let accountId = profile?.account_id as string | null;
  if (!accountId) {
    const { data: accountCreated, error: accountErr } = await supabase
      .from("accounts")
      .insert({})
      .select("id")
      .single();
    if (accountErr || !accountCreated) {
      return NextResponse.json(
        { error: accountErr?.message ?? "Falha ao criar conta" },
        { status: 500 },
      );
    }
    accountId = accountCreated.id as string;
  }

  let safeWhatsapp = normalizedWhatsapp;
  if (safeWhatsapp) {
    const { data: existingWhatsapp } = await supabase
      .from("profiles")
      .select("id")
      .eq("whatsapp_number", safeWhatsapp)
      .maybeSingle();
    if (existingWhatsapp) {
      safeWhatsapp = "";
    }
  }
  if (!safeWhatsapp) {
    safeWhatsapp = `pending-${userId.replace(/-/g, "")}`.slice(0, 40);
  }

  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: userId,
      account_id: accountId,
      email: normalizedEmail,
      full_name: normalizedName,
      whatsapp_number: safeWhatsapp,
      role: "broker",
    },
    { onConflict: "id" },
  );
  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  const { error: brokerErr } = await supabase.from("brokers").upsert(
    {
      account_id: accountId,
      profile_id: userId,
      display_name: normalizedName,
      whatsapp_number: safeWhatsapp,
      status: "active",
    },
    { onConflict: "profile_id" },
  );
  if (brokerErr) {
    return NextResponse.json({ error: brokerErr.message }, { status: 500 });
  }

  await supabase.from("subscriptions").upsert(
    {
      account_id: accountId,
      plan_code: "free",
      status: "free",
    },
    { onConflict: "account_id" },
  );

  await recordActivationEvent(supabase, {
    account_id: accountId,
    profile_id: userId,
    event_name: "account_created",
  });

  return NextResponse.json({ ok: true });
}
