import { NextResponse } from "next/server";

import { resolveImportSite, validateImportUrl } from "@imobiliariaqrcode/property-importer";

import { isPropertyImportEnabled } from "@/lib/property-import/enabled";

export async function GET(request: Request) {
  if (!isPropertyImportEnabled()) {
    return NextResponse.json({ ok: false, error: "feature_disabled" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url")?.trim() ?? "";
  if (!rawUrl) {
    return NextResponse.json({ ok: false, error: "missing_url" }, { status: 400 });
  }

  const urlCheck = validateImportUrl(rawUrl);
  if (!urlCheck.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: urlCheck.error,
        resolve: resolveImportSite(rawUrl),
      },
      { status: 400 },
    );
  }

  const resolve = resolveImportSite(urlCheck.url.toString());
  return NextResponse.json({ ok: true, resolve });
}
