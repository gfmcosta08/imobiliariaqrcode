import { NextResponse } from "next/server";

import { parsePastedListing } from "../lib/property-import/pasted-listing";
import { clampString, parseJsonObjectWithLimit, rejectUnknownKeys } from "@/lib/security/json-body";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const parsed = await parseJsonObjectWithLimit(request, { maxBytes: 32_768 });
  if (!parsed.ok) return parsed.response;

  const unknown = rejectUnknownKeys(parsed.value, ["text"]);
  if (unknown) {
    return NextResponse.json(
      { ok: false, error: "unexpected_field", field: unknown },
      { status: 400 },
    );
  }

  const text = clampString(parsed.value.text, { maxLength: 20_000, trim: true });
  if (!text) {
    return NextResponse.json({ ok: false, error: "missing_text" }, { status: 400 });
  }

  const draft = parsePastedListing(text);
  return NextResponse.json({ ok: true, draft });
}
