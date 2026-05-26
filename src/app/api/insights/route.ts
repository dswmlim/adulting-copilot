import { NextResponse } from "next/server";
import { listReceipts } from "@/lib/db";
import { computeMonthlyInsights, detectSubscriptions, buildShareCardStats } from "@/lib/insights";

export const runtime = "nodejs";

export async function GET() {
  const receipts = listReceipts();
  const insights = computeMonthlyInsights(receipts);
  const subscriptions = detectSubscriptions(receipts);
  const shareCard = buildShareCardStats(receipts, subscriptions);
  return NextResponse.json({
    receipts,
    insights,
    subscriptions,
    shareCard,
    counts: { receipts: receipts.length, subscriptions: subscriptions.length },
  });
}
