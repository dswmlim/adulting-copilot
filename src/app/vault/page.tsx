"use client";

import { useEffect, useState } from "react";
import type { WarrantyReminder } from "@/lib/types";

export default function VaultPage() {
  const [reminders, setReminders] = useState<WarrantyReminder[]>([]);

  function load() {
    fetch("/api/reminders")
      .then((r) => r.json())
      .then((d) => setReminders(d.reminders || []))
      .catch(() => setReminders([]));
  }
  useEffect(load, []);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="rise">
      <div className="flex items-center justify-between">
        <h1 className="font-display" style={{ fontSize: 40, margin: "8px 0 4px" }}>
          Warranty Vault
        </h1>
        <a className="gold-btn px-5 py-2.5" href="/api/export" data-testid="export-ics">
          Export calendar (.ics)
        </a>
      </div>
      <p style={{ color: "var(--mist)", marginBottom: 24 }}>
        Warranty expirations and return windows, auto-tracked from your receipts.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {reminders.length === 0 && (
          <div className="card p-6" style={{ color: "var(--mist)" }}>
            No reminders yet. Upload receipts with warranties or return policies to fill your vault.
          </div>
        )}
        {reminders.map((r) => {
          const overdue = r.dueDate < today;
          return (
            <div key={r.id} className="card p-5" data-testid={`reminder-${r.id}`}>
              <div className="flex justify-between items-start">
                <div>
                  <span className="pill">{r.kind}</span>
                  <h3 className="font-display" style={{ fontSize: 20, margin: "10px 0 2px" }}>
                    {r.merchant}
                  </h3>
                  <p style={{ color: "var(--mist)", margin: 0, fontSize: 14 }}>{r.itemDescription}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: overdue ? "#f0a35e" : "var(--gold)", fontWeight: 700 }}>
                    {r.dueDate}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--mist)" }}>{overdue ? "passed" : "upcoming"}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
