// Local-first persistence using better-sqlite3 (synchronous, zero-config, file-backed).
// All data stays on the user's machine. No telemetry, no remote writes.

import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { ParsedReceipt, WarrantyReminder } from "./types";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "adulting.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  migrate(_db);
  return _db;
}

/** Idempotent schema migration. Tracks version in a meta table. */
function migrate(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);`);
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined;
  const version = row ? parseInt(row.value, 10) : 0;

  if (version < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        merchant TEXT NOT NULL,
        date TEXT NOT NULL,
        currency TEXT NOT NULL,
        subtotal REAL NOT NULL,
        tax REAL NOT NULL,
        total REAL NOT NULL,
        category TEXT NOT NULL,
        items TEXT NOT NULL,
        returnWindowEnds TEXT,
        warrantyEnds TEXT,
        isSubscription INTEGER NOT NULL DEFAULT 0,
        cadence TEXT,
        confidence REAL NOT NULL,
        source TEXT NOT NULL,
        rawText TEXT,
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date);
      CREATE INDEX IF NOT EXISTS idx_receipts_merchant ON receipts(merchant);

      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        receiptId TEXT NOT NULL,
        merchant TEXT NOT NULL,
        itemDescription TEXT NOT NULL,
        kind TEXT NOT NULL,
        dueDate TEXT NOT NULL,
        notified INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (receiptId) REFERENCES receipts(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(dueDate);
    `);
    db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '1')`).run();
  }
}

export function insertReceipt(r: ParsedReceipt): ParsedReceipt {
  const db = getDb();
  const id = r.id || randomUUID();
  const createdAt = r.createdAt || new Date().toISOString();
  db.prepare(
    `INSERT INTO receipts
     (id, merchant, date, currency, subtotal, tax, total, category, items,
      returnWindowEnds, warrantyEnds, isSubscription, cadence, confidence, source, rawText, createdAt)
     VALUES (@id, @merchant, @date, @currency, @subtotal, @tax, @total, @category, @items,
      @returnWindowEnds, @warrantyEnds, @isSubscription, @cadence, @confidence, @source, @rawText, @createdAt)`
  ).run({
    id,
    merchant: r.merchant,
    date: r.date,
    currency: r.currency,
    subtotal: r.subtotal,
    tax: r.tax,
    total: r.total,
    category: r.category,
    items: JSON.stringify(r.items),
    returnWindowEnds: r.returnWindowEnds ?? null,
    warrantyEnds: r.warrantyEnds ?? null,
    isSubscription: r.isSubscription ? 1 : 0,
    cadence: r.cadence ?? null,
    confidence: r.confidence,
    source: r.source,
    rawText: r.rawText ?? null,
    createdAt,
  });

  // Auto-create reminders for warranty and return windows.
  if (r.warrantyEnds) {
    insertReminder({
      id: randomUUID(),
      receiptId: id,
      merchant: r.merchant,
      itemDescription: r.items[0]?.description || r.merchant,
      kind: "warranty",
      dueDate: r.warrantyEnds,
      notified: false,
    });
  }
  if (r.returnWindowEnds) {
    insertReminder({
      id: randomUUID(),
      receiptId: id,
      merchant: r.merchant,
      itemDescription: r.items[0]?.description || r.merchant,
      kind: "return",
      dueDate: r.returnWindowEnds,
      notified: false,
    });
  }

  return { ...r, id, createdAt };
}

export function insertReminder(rem: WarrantyReminder): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO reminders (id, receiptId, merchant, itemDescription, kind, dueDate, notified)
     VALUES (@id, @receiptId, @merchant, @itemDescription, @kind, @dueDate, @notified)`
  ).run({ ...rem, notified: rem.notified ? 1 : 0 });
}

function rowToReceipt(row: Record<string, unknown>): ParsedReceipt {
  return {
    id: row.id as string,
    merchant: row.merchant as string,
    date: row.date as string,
    currency: row.currency as string,
    subtotal: row.subtotal as number,
    tax: row.tax as number,
    total: row.total as number,
    category: row.category as ParsedReceipt["category"],
    items: JSON.parse((row.items as string) || "[]"),
    returnWindowEnds: (row.returnWindowEnds as string) ?? null,
    warrantyEnds: (row.warrantyEnds as string) ?? null,
    isSubscription: Boolean(row.isSubscription),
    cadence: (row.cadence as ParsedReceipt["cadence"]) ?? null,
    confidence: row.confidence as number,
    source: row.source as "llm" | "heuristic",
    rawText: (row.rawText as string) ?? undefined,
    createdAt: row.createdAt as string,
  };
}

export function listReceipts(): ParsedReceipt[] {
  const db = getDb();
  return (db.prepare(`SELECT * FROM receipts ORDER BY date DESC`).all() as Record<string, unknown>[]).map(
    rowToReceipt
  );
}

export function listReminders(onlyUpcoming = false): WarrantyReminder[] {
  const db = getDb();
  const sql = onlyUpcoming
    ? `SELECT * FROM reminders WHERE dueDate >= date('now') ORDER BY dueDate ASC`
    : `SELECT * FROM reminders ORDER BY dueDate ASC`;
  return (db.prepare(sql).all() as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    receiptId: row.receiptId as string,
    merchant: row.merchant as string,
    itemDescription: row.itemDescription as string,
    kind: row.kind as "warranty" | "return",
    dueDate: row.dueDate as string,
    notified: Boolean(row.notified),
  }));
}

export function markReminderNotified(id: string): void {
  getDb().prepare(`UPDATE reminders SET notified = 1 WHERE id = ?`).run(id);
}

/** Test/demo helper: wipe all data. */
export function resetDb(): void {
  const db = getDb();
  db.exec(`DELETE FROM reminders; DELETE FROM receipts;`);
}
