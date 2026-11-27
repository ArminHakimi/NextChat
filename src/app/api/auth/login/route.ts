import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  createSessionToken,
  getAuthConfig,
  isAuthRequired,
  SESSION_MAX_AGE_SECONDS,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isAuthRequired()) {
    return NextResponse.json(
      { error: "Password access is not enabled." },
      { status: 404 },
    );
  }

  const config = getAuthConfig();
  if (!config) {
    return NextResponse.json(
      {
        error:
          "Password access is not configured. Set APP_PASSWORD and APP_AUTH_SECRET (at least 32 characters).",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const password =
    typeof payload === "object" &&
    payload !== null &&
    "password" in payload &&
    typeof payload.password === "string"
      ? payload.password
      : "";

  if (!verifyPassword(password, config)) {
    return NextResponse.json(
      { error: "Incorrect password." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const response = NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(AUTH_COOKIE_NAME, createSessionToken(config), {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
