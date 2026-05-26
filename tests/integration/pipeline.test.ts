import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Point the DB at a temp file BEFORE importing db-dependent modules.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "adulting-test-"));
process.env.DB_PATH = path.join(tmpDir, "test.db");
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;

import { parseReceipt, resolveConfig, extractJson } from "@/lib/llm/client";
import { insertReceipt, listReceipts, listReminders, resetDb } from "@/lib/db";
import { computeMonthlyInsights, detectSubscriptions } from "@/lib/insights";

const RECEIPT = `Apple Store
2026-02-14
iPad Air            1 x 599.00   599.00
Subtotal                         599.00
Tax                               47.92
Total                           $646.92
1-year warranty
14-day return policy`;

describe("integration: parse → persist → analyze", () => {
  beforeAll(() => resetDb());
  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("falls back to heuristic when no key is set", () => {
    const cfg = resolveConfig({} as NodeJS.ProcessEnv);
    expect(cfg.provider).toBe("none");
  });

  it("parses without a key and persists with auto reminders", async () => {
    const parsed = await parseReceipt(RECEIPT, resolveConfig({} as NodeJS.ProcessEnv));
    expect(parsed.source).toBe("heuristic");
    expect(parsed.total).toBeCloseTo(646.92, 2);

    const saved = insertReceipt(parsed);
    expect(saved.id).toBeTruthy();

    const all = listReceipts();
    expect(all).toHaveLength(1);

    // 1-year warranty + 14-day return should create 2 reminders.
    const reminders = listReminders();
    expect(reminders.length).toBe(2);
    expect(reminders.some((r) => r.kind === "warranty")).toBe(true);
    expect(reminders.some((r) => r.kind === "return")).toBe(true);
  });

  it("computes insights over persisted data", () => {
    const insights = computeMonthlyInsights(listReceipts());
    expect(insights[0].month).toBe("2026-02");
    expect(insights[0].byCategory.electronics).toBeCloseTo(646.92, 2);
  });

  it("detects no subscriptions for a one-off purchase", () => {
    expect(detectSubscriptions(listReceipts())).toHaveLength(0);
  });
});

describe("extractJson", () => {
  it("pulls JSON out of a fenced block", () => {
    const obj = extractJson('Here you go:\n```json\n{"a":1}\n```') as { a: number };
    expect(obj.a).toBe(1);
  });
  it("pulls bare JSON", () => {
    const obj = extractJson('prefix {"b":2} suffix') as { b: number };
    expect(obj.b).toBe(2);
  });
});
