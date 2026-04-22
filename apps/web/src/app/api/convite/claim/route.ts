import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NextResponse } from "next/server";

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  let body: { login_code?: string; access_code?: string };
  try {
    body = (await request.json()) as { login_code?: string; access_code?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const { login_code, access_code } = body;
  if (!login_code || !access_code) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: invitation } = await supabase
    .from("broker_invitations")
    .select("id, access_code_hash, temp_email, expires_at, status")
    .eq("login_code", login_code)
    .maybeSingle();

  if (!invitation) {
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  if (invitation.status !== "pending") {
    return NextResponse.json({ ok: false, error: "invitation_already_used" }, { status: 401 });
  }

  const now = new Date();
  if (new Date(invitation.expires_at as string) < now) {
    await supabase
      .from("broker_invitations")
      .update({ status: "expired" })
      .eq("id", invitation.id);
    return NextResponse.json({ ok: false, error: "invitation_expired" }, { status: 401 });
  }

  const inputHash = await sha256Hex(access_code);
  if (inputHash !== invitation.access_code_hash) {
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  // Autenticar o usuário temporário para obter a session
  const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
    email: invitation.temp_email as string,
    password: access_code,
  });

  if (signInError || !sessionData.session) {
    return NextResponse.json(
      { ok: false, error: "auth_failed", detail: signInError?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
  });
}
