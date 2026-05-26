import { NextRequest, NextResponse } from "next/server";
import { listReminders } from "@/lib/db";
import { runOnce } from "@/lib/jobs/worker";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const upcoming = req.nextUrl.searchParams.get("upcoming") === "1";
  return NextResponse.json({ reminders: listReminders(upcoming) });
}

// Manually trigger a worker scan (used by the demo + UI "check now" button).
export async function POST() {
  const events = runOnce();
  return NextResponse.json({ notified: events });
}
