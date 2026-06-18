import { NextResponse } from "next/server";

import { validateChatPostBody } from "@/lib/chat/validate";
import { parseJsonObjectWithLimit, rejectUnknownKeys } from "@/lib/security/json-body";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const ALLOWED_KEYS = [
  "session_id",
  "content",
  "kind",
  "visitor_name",
  "visitor_email",
  "visitor_phone",
  "page_url",
] as const;

export async function POST(request: Request) {
  const parsed = await parseJsonObjectWithLimit(request, { maxBytes: 16_384 });
  if (!parsed.ok) return parsed.response;

  const unknown = rejectUnknownKeys(parsed.value, ALLOWED_KEYS);
  if (unknown) {
    return NextResponse.json(
      { ok: false, error: "unexpected_field", field: unknown },
      { status: 400 },
    );
  }

  const validated = validateChatPostBody(parsed.value);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  const { body, kindDetected } = validated;

  let userId: string | null = null;
  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return NextResponse.json({ ok: false, error: "server_config" }, { status: 500 });
  }

  const metadata: Record<string, unknown> = {};
  if (body.page_url) metadata.page_url = body.page_url;
  if (body.visitor_phone) metadata.visitor_phone = body.visitor_phone;
  metadata.user_agent = request.headers.get("user-agent")?.slice(0, 256) ?? null;

  const insertRow = {
    session_id: body.session_id,
    user_id: userId,
    visitor_name: body.visitor_name ?? null,
    visitor_email: body.visitor_email ?? null,
    direction: "visitor" as const,
    kind: kindDetected,
    content: body.content,
    metadata: Object.keys(metadata).length ? metadata : null,
  };

  const { data: inserted, error } = await supabase
    .from("chat_messages")
    .insert(insertRow)
    .select("id")
    .single();

  if (error || !inserted?.id) {
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  }

  const bridgeUrl = process.env.CONTATO_BRIDGE_URL;
  if (bridgeUrl) {
    try {
      await fetch(bridgeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          id: inserted.id,
          direction: "visitor",
          kind: kindDetected,
          user_id: userId,
        }),
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      // Ponte VPS offline — mensagem já persistida; retorno 200 abaixo.
    }
  }

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    kind_detected: kindDetected,
  });
}
