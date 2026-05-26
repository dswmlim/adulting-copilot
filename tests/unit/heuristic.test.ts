import { describe, it, expect } from "vitest";
import {
  heuristicParse,
  detectCurrency,
  detectDate,
  detectTotals,
  detectItems,
  detectWarrantyAndReturn,
  detectSubscription,
  addDays,
  addMonths,
} from "@/lib/parsers/heuristic";

const ELECTRONICS = `Best Buy
2026-03-01
Sony WH-1000XM5 Headphones   1 x 399.99   399.99
USB-C Cable                  2 x 9.99      19.98
Subtotal                                  419.97
Tax                                        29.40
Total                                    $449.37
1-year warranty included
15-day return policy`;

describe("detectCurrency", () => {
  it("detects USD from dollar sign", () => {
    expect(detectCurrency("Total $12.00")).toBe("USD");
  });
  it("detects SGD from S$", () => {
    expect(detectCurrency("Total S$12.00")).toBe("SGD");
  });
  it("detects explicit code", () => {
    expect(detectCurrency("Amount EUR 9.00")).toBe("EUR");
  });
});

describe("detectDate", () => {
  it("parses ISO", () => {
    expect(detectDate("date 2026-05-12 ok")).toBe("2026-05-12");
  });
  it("parses named month", () => {
    expect(detectDate("Jan 5, 2026")).toBe("2026-01-05");
  });
  it("parses DD/MM when first part > 12", () => {
    expect(detectDate("13/04/2026")).toBe("2026-04-13");
  });
});

describe("detectTotals", () => {
  it("extracts subtotal, tax, total", () => {
    const t = detectTotals(ELECTRONICS);
    expect(t.total).toBeCloseTo(449.37, 2);
    expect(t.tax).toBeCloseTo(29.4, 2);
    expect(t.subtotal).toBeCloseTo(419.97, 2);
  });
});

describe("detectItems", () => {
  it("extracts line items with qty", () => {
    const items = detectItems(ELECTRONICS);
    const headphones = items.find((i) => /Sony/.test(i.description));
    expect(headphones).toBeTruthy();
    expect(headphones!.total).toBeCloseTo(399.99, 2);
    // does not capture total/tax lines as items
    expect(items.find((i) => /Subtotal|Tax|Total/i.test(i.description))).toBeUndefined();
  });
});

describe("detectWarrantyAndReturn", () => {
  it("computes 1-year warranty and 15-day return", () => {
    const { warrantyEnds, returnWindowEnds } = detectWarrantyAndReturn(ELECTRONICS, "2026-03-01");
    expect(warrantyEnds).toBe("2027-03-01");
    expect(returnWindowEnds).toBe("2026-03-16");
  });
});

describe("detectSubscription", () => {
  it("flags monthly subscriptions", () => {
    const r = detectSubscription("Netflix", "Your monthly subscription renews", "subscriptions");
    expect(r.isSubscription).toBe(true);
    expect(r.cadence).toBe("monthly");
  });
  it("does not flag a grocery run", () => {
    const r = detectSubscription("Whole Foods", "thanks for shopping", "groceries");
    expect(r.isSubscription).toBe(false);
  });
});

describe("date helpers", () => {
  it("addDays", () => expect(addDays("2026-01-01", 31)).toBe("2026-02-01"));
  it("addMonths", () => expect(addMonths("2026-01-31", 1)).toBe("2026-03-03"));
});

describe("heuristicParse end-to-end", () => {
  it("produces a complete, valid receipt", () => {
    const r = heuristicParse(ELECTRONICS);
    expect(r.merchant.toLowerCase()).toContain("best buy");
    expect(r.category).toBe("electronics");
    expect(r.total).toBeCloseTo(449.37, 2);
    expect(r.warrantyEnds).toBe("2027-03-01");
    expect(r.source).toBe("heuristic");
    expect(r.confidence).toBeGreaterThan(0.5);
  });
});
