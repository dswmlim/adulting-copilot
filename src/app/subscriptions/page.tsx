"use client";

import { useEffect, useState } from "react";
import type { Subscription } from "@/lib/types";

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [draft, setDraft] = useState<{ merchant: string; body: string } | null>(null);
  const [drafting, setDrafting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then((d) => setSubs(d.subscriptions || []))
      .catch(() => setSubs([]));
  }, []);

  const totalAnnual = subs.reduce((s, x) => s + x.annualizedCost, 0);
  const ccy = subs[0]?.currency || "USD";

  async function makeDraft(sub: Subscription) {
    setDrafting(sub.merchant);
    try {
      const res = await fetch("/api/cancel-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ merchant: sub.merchant, amount: sub.amount, currency: sub.currency }),
      });
      const data = await res.json();
      setDraft({ merchant: sub.merchant, body: data.draft });
    } finally {
      setDrafting(null);
    }
  }

  return (
    <div className="rise">
      <h1 className="font-display" style={{ fontSize: 40, margin: "8px 0 4px" }}>
        Subscription Killer
      </h1>
      <p style={{ color: "var(--mist)", marginBottom: 8 }}>
        Recurring charges we found across your receipts.
      </p>
      <p className="font-display" style={{ fontSize: 28, color: "var(--gold)", marginBottom: 24 }}>
        {ccy} {totalAnnual.toFixed(2)} <span style={{ fontSize: 16, color: "var(--mist)" }}>/year at stake</span>
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {subs.length === 0 && (
          <div className="card p-6" style={{ color: "var(--mist)" }}>
            No subscriptions detected yet. Upload a few recurring charges to populate this view.
          </div>
        )}
        {subs.map((s) => (
          <div key={s.merchant} className="card p-5" data-testid={`sub-${s.merchant.replace(/\s/g, "-")}`}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-display" style={{ fontSize: 22, margin: 0 }}>
                  {s.merchant}
                </h3>
                <p style={{ color: "var(--mist)", margin: "2px 0 0", fontSize: 14 }}>
                  {s.currency} {s.amount.toFixed(2)} · {s.cadence} · {s.occurrences} charges
                </p>
              </div>
              <span className="pill">{s.currency} {s.annualizedCost.toFixed(0)}/yr</span>
            </div>
            <button
              className="gold-btn px-4 py-2 mt-4 text-sm"
              data-testid={`cancel-${s.merchant.replace(/\s/g, "-")}`}
              onClick={() => void makeDraft(s)}
              disabled={drafting === s.merchant}
            >
              {drafting === s.merchant ? "Drafting…" : "Draft cancellation email"}
            </button>
          </div>
        ))}
      </div>

      {draft && (
        <div className="card p-6 mt-6 rise" data-testid="cancel-draft">
          <div className="flex justify-between items-center">
            <h2 className="font-display" style={{ fontSize: 22, margin: 0 }}>
              Cancellation draft · {draft.merchant}
            </h2>
            <button
              className="ghost-btn px-3 py-1.5 text-sm"
              onClick={() => navigator.clipboard?.writeText(draft.body)}
            >
              Copy
            </button>
          </div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "ui-monospace, monospace",
              marginTop: 14,
              color: "var(--cream)",
              fontSize: 14,
            }}
          >
            {draft.body}
          </pre>
        </div>
      )}
    </div>
  );
}
