import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: NextRequest) {
  try {
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

    if (invitation.status === "claimed") {
      return NextResponse.json(
        { ok: false, error: "invitation_already_activated" },
        { status: 409 },
      );
    }

    if (invitation.status === "completed") {
      return NextResponse.json({ ok: false, error: "invitation_completed" }, { status: 409 });
    }

    if (invitation.status !== "pending") {
      return NextResponse.json({ ok: false, error: "invitation_already_used" }, { status: 401 });
    }

    const now = new Date();
    const expiresAt = invitation.expires_at ? new Date(String(invitation.expires_at)) : null;
    if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt < now) {
      await supabase.from("broker_invitations").update({ status: "expired" }).eq("id", invitation.id);
      return NextResponse.json({ ok: false, error: "invitation_expired" }, { status: 401 });
    }

    const inputHash = await sha256Hex(access_code);
    if (inputHash !== invitation.access_code_hash) {
      return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
    }

    if (!invitation.temp_email) {
      return NextResponse.json({ ok: false, error: "invitation_invalid_state" }, { status: 409 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      return NextResponse.json({ ok: false, error: "server_config" }, { status: 500 });
    }

    // 🔒 SEGURANÇA/UX: estabelece sessão via cookies (SSR) para que rotas server-side reconheçam o usuário.
    let response = NextResponse.json({ ok: true });
    const supabaseUser = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Parameters<NextResponse["cookies"]["set"]>[2];
          }[],
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.json({ ok: true });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    const { data: sessionData, error: signInError } = await supabaseUser.auth.signInWithPassword({
      email: invitation.temp_email,
      password: access_code,
    });

    if (signInError || !sessionData.session) {
      return NextResponse.json(
        { ok: false, error: "invalid_credentials", detail: signInError?.message },
        { status: 401 },
      );
    }

    return response;
  } catch (error) {
    console.error("convite claim fatal error", error);
    return NextResponse.json({ ok: false, error: "claim_unexpected_error" }, { status: 500 });
  }
}
