import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_STUN_URLS = ["stun:stun.l.google.com:19302"];

const splitUrls = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

export function GET() {
  const stunUrls = splitUrls(process.env.STUN_URLS);
  const turnUrls = splitUrls(process.env.TURN_URLS);

  const iceServers: RTCIceServer[] = [
    { urls: stunUrls.length > 0 ? stunUrls : DEFAULT_STUN_URLS },
  ];

  if (turnUrls.length > 0) {
    iceServers.push({
      urls: turnUrls,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  return NextResponse.json(
    { iceServers },
    { headers: { "Cache-Control": "no-store" } },
  );
}
