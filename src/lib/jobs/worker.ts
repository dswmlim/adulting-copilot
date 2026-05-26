// Background worker: periodically scans reminders that are due soon and "notifies"
// (here: logs to console / writes a notifications file). Designed to be run either
// as a standalone process (`npm run worker`) or invoked once for tests.
//
// In a real deployment you'd swap the notify() sink for email/push. Kept local-first
// and side-effect-light by default.

import fs from "node:fs";
import path from "node:path";
import { listReminders, markReminderNotified } from "../db";

const NOTIFY_WINDOW_DAYS = Number(process.env.NOTIFY_WINDOW_DAYS || 7);
const NOTIFICATIONS_FILE =
  process.env.NOTIFICATIONS_FILE || path.join(process.cwd(), "data", "notifications.log");

export interface NotificationEvent {
  reminderId: string;
  message: string;
  at: string;
}

export function dueSoon(today = new Date()): NotificationEvent[] {
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + NOTIFY_WINDOW_DAYS);
  const events: NotificationEvent[] = [];

  for (const r of listReminders()) {
    if (r.notified) continue;
    const due = new Date(r.dueDate + "T00:00:00Z");
    if (due >= today && due <= horizon) {
      const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
      const verb = r.kind === "warranty" ? "Warranty expires" : "Return window closes";
      events.push({
        reminderId: r.id,
        message: `${verb} for ${r.merchant} in ${days} day(s) — ${r.itemDescription}`,
        at: new Date().toISOString(),
      });
    }
  }
  return events;
}

export function notify(events: NotificationEvent[]): void {
  if (events.length === 0) return;
  fs.mkdirSync(path.dirname(NOTIFICATIONS_FILE), { recursive: true });
  for (const e of events) {
    // eslint-disable-next-line no-console
    console.log(`[reminder] ${e.message}`);
    fs.appendFileSync(NOTIFICATIONS_FILE, JSON.stringify(e) + "\n");
    markReminderNotified(e.reminderId);
  }
}

export function runOnce(): NotificationEvent[] {
  const events = dueSoon();
  notify(events);
  return events;
}

// When executed directly: poll on an interval.
if (require.main === module) {
  const intervalMs = Number(process.env.WORKER_INTERVAL_MS || 60_000);
  // eslint-disable-next-line no-console
  console.log(`[worker] started; scanning every ${intervalMs}ms`);
  runOnce();
  setInterval(runOnce, intervalMs);
}
