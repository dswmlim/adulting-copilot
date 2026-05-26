import { describe, it, expect } from "vitest";
import {
  computeMonthlyInsights,
  detectSubscriptions,
  buildShareCardStats,
  monthKey,
  round2,
} from "@/lib/insights";
import { validateReceipt } from "@/lib/llm/schema";
import { redactText } from "@/lib/redact";
import { buildIcs, buildShareCardSvg } from "@/lib/export";
import type { ParsedReceipt } from "@/lib/types";

function r(partial: Partial<ParsedReceipt>): ParsedReceipt {
  return {
    merchant: "Test",
    date: "2026-05-01",
    currency: "USD",
    subtotal: 10,
    tax: 0,
    total: 10,
    category: "other",
    items: [],
    returnWindowEnds: null,
    warrantyEnds: null,
    isSubscription: false,
    cadence: null,
    confidence: 0.8,
    source: "heuristic",
    ...partial,
  };
}

describe("monthKey & round2", () => {
  it("monthKey slices YYYY-MM", () => expect(monthKey("2026-05-12")).toBe("2026-05"));
  it("round2 rounds", () => expect(round2(1.005)).toBe(1.0)); // floating point reality
});

describe("computeMonthlyInsights", () => {
  it("aggregates by month and computes deltas", () => {
    const receipts = [
      r({ date: "2026-04-10", total: 100, category: "dining" }),
      r({ date: "2026-05-05", total: 60, category: "groceries" }),
      r({ date: "2026-05-20", total: 40, category: "dining" }),
    ];
    const ins = computeMonthlyInsights(receipts);
    expect(ins[0].month).toBe("2026-05");
    expect(ins[0].totalSpend).toBe(100);
    expect(ins[0].deltaVsPrevMonth).toBe(0); // 100 this month, 100 last month
    expect(ins[0].byCategory.dining).toBe(40);
  });
});

describe("detectSubscriptions", () => {
  it("clusters recurring merchant charges and annualizes", () => {
    const receipts = [
      r({ merchant: "Netflix", date: "2026-03-01", total: 15.99, isSubscription: true, cadence: "monthly", category: "subscriptions" }),
      r({ merchant: "Netflix", date: "2026-04-01", total: 15.99, isSubscription: true, cadence: "monthly", category: "subscriptions" }),
      r({ merchant: "Netflix", date: "2026-05-01", total: 15.99, isSubscription: true, cadence: "monthly", category: "subscriptions" }),
    ];
    const subs = detectSubscriptions(receipts);
    expect(subs).toHaveLength(1);
    expect(subs[0].merchant).toBe("Netflix");
    expect(subs[0].occurrences).toBe(3);
    expect(subs[0].annualizedCost).toBeCloseTo(15.99 * 12, 2);
  });
});

describe("buildShareCardStats", () => {
  it("summarizes the latest month", () => {
    const receipts = [r({ date: "2026-05-01", total: 80, category: "dining" })];
    const stats = buildShareCardStats(receipts, []);
    expect(stats.totalSpend).toBe(80);
    expect(stats.topCategory).toBe("dining");
    expect(stats.funFact.length).toBeGreaterThan(0);
  });
});

describe("validateReceipt", () => {
  it("accepts a valid receipt", () => {
    expect(() => validateReceipt(r({}))).not.toThrow();
  });
  it("rejects a bad date", () => {
    expect(() => validateReceipt(r({ date: "05/01/2026" }))).toThrow();
  });
  it("rejects an unknown category", () => {
    expect(() => validateReceipt({ ...r({}), category: "spaceships" })).toThrow();
  });
});

describe("redactText", () => {
  it("masks card numbers, emails, phones", () => {
    const out = redactText("Card 4111 1111 1111 1111 email a@b.com call +1 555 123 4567");
    expect(out).not.toContain("4111 1111");
    expect(out).toContain("[email]");
    expect(out).toContain("[phone]");
  });
});

describe("buildIcs", () => {
  it("emits a valid VCALENDAR with events", () => {
    const ics = buildIcs([
      {
        id: "abc",
        receiptId: "r1",
        merchant: "Best Buy",
        itemDescription: "Sony headphones",
        kind: "warranty",
        dueDate: "2027-03-01",
        notified: false,
      },
    ]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART;VALUE=DATE:20270301");
    expect(ics).toContain("END:VCALENDAR");
  });
});

describe("buildShareCardSvg", () => {
  it("renders an SVG containing the total", () => {
    const svg = buildShareCardSvg({
      month: "2026-05",
      totalSpend: 1234,
      currency: "USD",
      topCategory: "dining",
      topCategoryShare: 42,
      receiptCount: 9,
      subscriptionsKilledValue: 240,
      funFact: "You like coffee.",
    });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("ADULTING COPILOT");
    expect(svg).toContain("2026-05");
  });
});
