"use client";

import { useEffect, useState } from "react";
import type { MonthlyInsight, Subscription, ShareCardStats, ParsedReceipt } from "@/lib/types";

interface InsightsResponse {
  receipts: ParsedReceipt[];
  insights: MonthlyInsight[];
  subscriptions: Subscription[];
  shareCard: ShareCardStats;
  counts: { receipts: number; subscriptions: number };
}

export default function DashboardPage() {
  const [data, setData] = useState<InsightsResponse | null>(null);

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return <div style={{ color: "var(--mist)" }} className="py-16 text-center">Loading your money story…</div>;
  }

  const latest = data.insights[0];
  const maxCat = latest ? Math.max(...Object.values(latest.byCategory), 1) : 1;

  return (
    <div className="rise">
      <h1 className="font-display" style={{ fontSize: 40, margin: "8px 0 4px" }}>
        Dashboard
      </h1>
      <p style={{ color: "var(--mist)", marginBottom: 24 }}>
        {data.counts.receipts} receipts tracked · {data.counts.subscriptions} subscriptions detected
      </p>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Metric label="This month" value={latest ? `${currency(data)} ${latest.totalSpend.toFixed(2)}` : "—"} />
        <Metric
          label="vs last month"
          value={latest ? signed(latest.deltaVsPrevMonth, currency(data)) : "—"}
          tone={latest && latest.deltaVsPrevMonth > 0 ? "warn" : "good"}
        />
        <Metric label="Top merchant" value={latest?.topMerchant || "—"} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6" data-testid="spend-chart">
          <h2 className="font-display" style={{ fontSize: 22, marginTop: 0 }}>
            Spend by category
          </h2>
          {latest &&
            Object.entries(latest.byCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amt]) => (
                <div key={cat} className="my-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize">{cat}</span>
                    <span style={{ color: "var(--gold)" }}>
                      {currency(data)} {amt.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ height: 10, background: "rgba(155,191,174,0.12)", borderRadius: 999 }}>
                    <div
                      style={{
                        height: 10,
                        width: `${(amt / maxCat) * 100}%`,
                        borderRadius: 999,
                        background: "linear-gradient(90deg, var(--gold), var(--amber))",
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                </div>
              ))}
        </div>

        <div className="card p-6" data-testid="share-card-panel">
          <div className="flex items-center justify-between">
            <h2 className="font-display" style={{ fontSize: 22, marginTop: 0 }}>
              Shareable money card
            </h2>
            <a className="ghost-btn px-3 py-1.5 text-sm" href="/api/share-card" target="_blank" rel="noreferrer">
              Open SVG
            </a>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/share-card"
            alt="Your redacted money story card"
            style={{ width: "100%", borderRadius: 14, marginTop: 12, border: "1px solid rgba(155,191,174,0.2)" }}
          />
        </div>
      </div>

      <div className="card p-6 mt-6">
        <h2 className="font-display" style={{ fontSize: 22, marginTop: 0 }}>
          What changed
        </h2>
        {data.insights.map((ins) => (
          <div
            key={ins.month}
            className="py-3"
            style={{ borderBottom: "1px solid rgba(155,191,174,0.12)" }}
            data-testid={`insight-${ins.month}`}
          >
            <div className="flex justify-between">
              <strong className="font-display">{ins.month}</strong>
              <span style={{ color: "var(--gold)" }}>
                {currency(data)} {ins.totalSpend.toFixed(2)}
              </span>
            </div>
            <p style={{ color: "var(--mist)", margin: "4px 0 0" }}>{ins.narrative}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function currency(data: InsightsResponse): string {
  return data.receipts[0]?.currency || "USD";
}
function signed(n: number, ccy: string): string {
  const s = n >= 0 ? "+" : "−";
  return `${s}${ccy} ${Math.abs(n).toFixed(2)}`;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  const color = tone === "warn" ? "#f0a35e" : tone === "good" ? "#8fe0b8" : "var(--cream)";
  return (
    <div className="card p-5">
      <div style={{ color: "var(--mist)", fontSize: 13 }}>{label}</div>
      <div className="font-display" style={{ fontSize: 26, marginTop: 4, color }}>
        {value}
      </div>
    </div>
  );
}
