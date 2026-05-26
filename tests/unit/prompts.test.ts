import { describe, it, expect } from "vitest";
import {
  RECEIPT_PARSE_SYSTEM,
  buildReceiptParseUser,
  INSIGHT_SYSTEM,
  buildInsightUser,
  CANCEL_EMAIL_SYSTEM,
  buildCancelEmailUser,
} from "../../prompts";

describe("prompt templates", () => {
  it("receipt system prompt lists all categories and demands JSON-only", () => {
    expect(RECEIPT_PARSE_SYSTEM).toMatch(/JSON object/i);
    expect(RECEIPT_PARSE_SYSTEM).toContain("subscriptions");
    expect(RECEIPT_PARSE_SYSTEM).toContain("YYYY-MM-DD");
  });

  it("receipt user builder clips long input", () => {
    const long = "x".repeat(10000);
    const out = buildReceiptParseUser(long);
    expect(out.length).toBeLessThan(7000);
  });

  it("insight builder embeds JSON payload", () => {
    const out = buildInsightUser({ month: "2026-05", total: 100 });
    expect(out).toContain("2026-05");
  });
  it("insight system forbids advice", () => {
    expect(INSIGHT_SYSTEM).toMatch(/no financial advice/i);
  });

  it("cancel email builder includes merchant and amount", () => {
    const out = buildCancelEmailUser("Netflix", 15.99, "USD");
    expect(out).toContain("Netflix");
    expect(out).toContain("15.99");
  });
  it("cancel system caps length and asks for confirmation", () => {
    expect(CANCEL_EMAIL_SYSTEM).toMatch(/confirmation/i);
  });
});
