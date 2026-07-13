import { NextResponse } from "next/server";

import { validateMessagesQuery } from "../lib/validate";
import type { ChatMessage } from "../lib/types";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

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

  const validated = validateMessagesQuery(params, {
    requireSessionForAnonymous: !userId,
  });
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  const { sessionId, since } = validated;

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return NextResponse.json({ ok: false, error: "server_config" }, { status: 500 });
  }

  let query = supabase
    .from("chat_messages")
    .select(
      "id, session_id, user_id, visitor_name, visitor_email, direction, kind, content, is_read_by_costa, created_at, metadata",
    )
    .order("created_at", { ascending: true });

  if (userId) {
    query = query.eq("user_id", userId);
    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }
  } else if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  if (since) {
    query = query.gte("created_at", since);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });
  }

  return NextResponse.json({ messages: (data ?? []) as ChatMessage[] });
}
