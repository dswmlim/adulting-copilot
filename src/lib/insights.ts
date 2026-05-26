// Pure analytics over receipts: monthly insights, subscription detection, share-card stats.
// All functions are pure and deterministic for easy unit testing.

import { ParsedReceipt, Subscription, MonthlyInsight, ShareCardStats } from "./types";

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7); // YYYY-MM
}

export function computeMonthlyInsights(receipts: ParsedReceipt[]): MonthlyInsight[] {
  const byMonth = new Map<string, ParsedReceipt[]>();
  for (const r of receipts) {
    const k = monthKey(r.date);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k)!.push(r);
  }

  const months = [...byMonth.keys()].sort();
  const insights: MonthlyInsight[] = [];

  months.forEach((month, idx) => {
    const list = byMonth.get(month)!;
    const totalSpend = round2(list.reduce((s, r) => s + r.total, 0));
    const byCategory: Record<string, number> = {};
    const merchantTotals: Record<string, number> = {};
    for (const r of list) {
      byCategory[r.category] = round2((byCategory[r.category] || 0) + r.total);
      merchantTotals[r.merchant] = (merchantTotals[r.merchant] || 0) + r.total;
    }
    const topMerchant =
      Object.entries(merchantTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

    const prevMonth = idx > 0 ? byMonth.get(months[idx - 1])! : null;
    const prevTotal = prevMonth ? prevMonth.reduce((s, r) => s + r.total, 0) : 0;
    const delta = round2(totalSpend - prevTotal);

    insights.push({
      month,
      totalSpend,
      byCategory,
      topMerchant,
      receiptCount: list.length,
      deltaVsPrevMonth: delta,
      narrative: buildNarrative(month, totalSpend, byCategory, delta, prevTotal),
    });
  });

  return insights.reverse(); // newest first
}

function buildNarrative(
  month: string,
  total: number,
  byCategory: Record<string, number>,
  delta: number,
  prevTotal: number
): string {
  const topCat = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
  const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const pct = prevTotal > 0 ? Math.round((Math.abs(delta) / prevTotal) * 100) : 0;
  const catPart = topCat ? ` Biggest bucket: ${topCat[0]} (${total ? Math.round((topCat[1] / total) * 100) : 0}%).` : "";
  if (prevTotal === 0) return `First tracked month. You logged ${formatMoney(total)} in spend.${catPart}`;
  if (dir === "flat") return `Spending held steady at ${formatMoney(total)}.${catPart}`;
  return `Spending is ${dir} ${pct}% vs last month (${formatMoney(total)} total).${catPart}`;
}

/** Detect subscriptions by clustering recurring charges from the same merchant. */
export function detectSubscriptions(receipts: ParsedReceipt[]): Subscription[] {
  const groups = new Map<string, ParsedReceipt[]>();
  for (const r of receipts) {
    if (!r.isSubscription && r.category !== "subscriptions") continue;
    const key = r.merchant.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const subs: Subscription[] = [];
  for (const [, list] of groups) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    const last = list[list.length - 1];
    const cadence = last.cadence || inferCadence(list) || "monthly";
    const amount = round2(median(list.map((r) => r.total)));
    const multiplier = cadence === "yearly" ? 1 : cadence === "weekly" ? 52 : 12;
    subs.push({
      merchant: last.merchant,
      amount,
      currency: last.currency,
      cadence,
      lastChargedDate: last.date,
      occurrences: list.length,
      annualizedCost: round2(amount * multiplier),
    });
  }
  return subs.sort((a, b) => b.annualizedCost - a.annualizedCost);
}

function inferCadence(list: ParsedReceipt[]): "monthly" | "yearly" | "weekly" | null {
  if (list.length < 2) return null;
  const days =
    (new Date(list[list.length - 1].date).getTime() - new Date(list[0].date).getTime()) /
    86400000 /
    (list.length - 1);
  if (days >= 300) return "yearly";
  if (days <= 10) return "weekly";
  return "monthly";
}

export function buildShareCardStats(receipts: ParsedReceipt[], subs: Subscription[]): ShareCardStats {
  const insights = computeMonthlyInsights(receipts);
  const latest = insights[0];
  if (!latest) {
    return {
      month: new Date().toISOString().slice(0, 7),
      totalSpend: 0,
      currency: "USD",
      topCategory: "—",
      topCategoryShare: 0,
      receiptCount: 0,
      subscriptionsKilledValue: 0,
      funFact: "No receipts yet — drop one in to start your money story.",
    };
  }
  const topCat = Object.entries(latest.byCategory).sort((a, b) => b[1] - a[1])[0];
  const topCategory = topCat?.[0] || "—";
  const topShare = topCat && latest.totalSpend ? Math.round((topCat[1] / latest.totalSpend) * 100) : 0;
  const subsValue = round2(subs.reduce((s, x) => s + x.annualizedCost, 0));
  const currency = receipts[0]?.currency || "USD";

  return {
    month: latest.month,
    totalSpend: latest.totalSpend,
    currency,
    topCategory,
    topCategoryShare: topShare,
    receiptCount: latest.receiptCount,
    subscriptionsKilledValue: subsValue,
    funFact: buildFunFact(topCategory, topShare, subsValue, currency),
  };
}

function buildFunFact(cat: string, share: number, subsValue: number, currency: string): string {
  if (subsValue > 0)
    return `You're sitting on ${currency} ${subsValue.toFixed(0)}/yr in subscriptions. That's a lot of "free trials".`;
  if (share >= 40) return `${share}% of your money went to ${cat}. We see you.`;
  return `Your spending is impressively balanced. Suspiciously responsible.`;
}

// --- small numeric helpers ---
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
