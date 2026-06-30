import { NextRequest, NextResponse } from "next/server";

export async function GET(_: NextRequest) {
  // This is a simple API route - similar to Express GET route
  // File location: src/app/api/greeting/route.ts
  // Accessible at: /api/greeting

  const hour = new Date().getHours();
  let greeting = "Hello";

  if (hour < 12) {
    greeting = "Good Morning";
  } else if (hour < 18) {
    greeting = "Good Afternoon";
  } else {
    greeting = "Good Evening";
  }

  return NextResponse.json({
    message: `${greeting}! This greeting came from a Next.js API route.`,
    timestamp: new Date().toISOString(),
  });
}
