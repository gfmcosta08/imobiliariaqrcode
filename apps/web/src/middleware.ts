import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Legacy redirects for /imoveis/* while keeping the public detail page working at
  // /imoveis/{public_id} (served by App Router).
  if (pathname === "/imoveis") {
    const url = request.nextUrl.clone();
    url.pathname = "/properties";
    return NextResponse.redirect(url, 308);
  }

  if (pathname === "/imoveis/novo") {
    const url = request.nextUrl.clone();
    url.pathname = "/properties/new";
    return NextResponse.redirect(url, 308);
  }

  if (pathname.startsWith("/imoveis/")) {
    const rest = pathname.slice("/imoveis/".length);

    // Allow public detail page at /imoveis/{public_id} (single segment, no extra slashes).
    const isSingleSegment = rest.length > 0 && !rest.includes("/");
    if (!isSingleSegment) {
      const url = request.nextUrl.clone();
      url.pathname = `/properties/${rest}`;
      url.search = search;
      return NextResponse.redirect(url, 308);
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
