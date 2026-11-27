import { NextRequest, NextResponse } from "next/server";
import { getAuthConfig, hasValidSession, isAuthRequired } from "@/lib/auth";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
]);

export function proxy(request: NextRequest) {
  if (!isAuthRequired() || PUBLIC_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (getAuthConfig() && hasValidSession(request.headers.get("cookie"))) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const status = getAuthConfig() ? 401 : 503;
    const message = getAuthConfig()
      ? "Authentication required."
      : "Set APP_PASSWORD and APP_AUTH_SECRET to enable app access.";

    return NextResponse.json(
      { error: message },
      {
        status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|pwa-icons/|sw.js|manifest.webmanifest).*)",
  ],
};
