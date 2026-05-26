// Seeds the local database from /demo_assets so the dashboard, subscriptions,
// and vault views have realistic content. Used by `npm run seed` and the demo pipeline.

import fs from "node:fs";
import path from "node:path";
import { parseReceipt, resolveConfig } from "../src/lib/llm/client";
import { insertReceipt, resetDb } from "../src/lib/db";

async function main() {
  const dir = path.join(process.cwd(), "demo_assets");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .sort();

  resetDb();
  const cfg = resolveConfig();
  console.log(`[seed] engine: ${cfg.provider} (${cfg.model})`);

  for (const file of files) {
    const text = fs.readFileSync(path.join(dir, file), "utf-8");
    const parsed = await parseReceipt(text, cfg);
    const saved = insertReceipt(parsed);
    console.log(
      `[seed] ${file} → ${saved.merchant} | ${saved.currency} ${saved.total.toFixed(2)} | ${saved.category}`
    );
  }
  console.log(`[seed] done: ${files.length} receipts loaded.`);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
