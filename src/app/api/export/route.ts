import { NextResponse } from "next/server";
import { listReminders } from "@/lib/db";
import { buildIcs } from "@/lib/export";

export const runtime = "nodejs";

// Returns an .ics calendar of all warranty/return reminders.
export async function GET() {
  const ics = buildIcs(listReminders());
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="adulting-copilot.ics"',
    },
  });
}
