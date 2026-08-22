import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const MAINTENANCE_PATH = "/manutencao";

function isMaintenanceModeEnabled() {
  return process.env.MAINTENANCE_MODE === "true";
}

function shouldShowMaintenancePage(pathname: string) {
  if (!isMaintenanceModeEnabled()) {
    return false;
  }

  if (pathname === MAINTENANCE_PATH || pathname.startsWith("/api")) {
    return false;
  }

  return true;
}

export async function middleware(request: NextRequest) {
  if (shouldShowMaintenancePage(request.nextUrl.pathname)) {
    const maintenanceUrl = request.nextUrl.clone();
    maintenanceUrl.pathname = MAINTENANCE_PATH;
    maintenanceUrl.search = "";

    return NextResponse.rewrite(maintenanceUrl, {
      status: 503,
      headers: {
        "Retry-After": "3600",
        "X-Maintenance-Mode": "true",
      },
    });
  }

  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
