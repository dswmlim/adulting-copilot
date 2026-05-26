import { NextResponse } from "next/server";
import { listReceipts } from "@/lib/db";
import { detectSubscriptions, buildShareCardStats } from "@/lib/insights";
import { buildShareCardSvg } from "@/lib/export";

export const runtime = "nodejs";

// Returns a redacted SVG share card built entirely locally.
export async function GET() {
  const receipts = listReceipts();
  const subs = detectSubscriptions(receipts);
  const stats = buildShareCardStats(receipts, subs);
  const svg = buildShareCardSvg(stats);
  return new NextResponse(svg, {
    status: 200,
    headers: { "content-type": "image/svg+xml; charset=utf-8" },
  });
}
