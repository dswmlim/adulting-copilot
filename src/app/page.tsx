"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { ParsedReceipt } from "@/lib/types";

const SAMPLE = `WHOLE FOODS MARKET
123 Market St
2026-05-12
Organic Bananas       2 x 0.79      1.58
Oat Milk Barista      1 x 4.49      4.49
Free Range Eggs       1 x 6.99      6.99
Dark Roast Coffee     1 x 12.50    12.50
Subtotal                            25.56
Tax                                  1.79
Total                              $27.35
30-day return policy on grocery items`;

export default function UploadPage() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ParsedReceipt | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submitText = useCallback(async (payload: string) => {
    if (!payload.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: payload }),
      });
      const data = await res.json();
      if (data.receipt) setResult(data.receipt as ParsedReceipt);
    } finally {
      setBusy(false);
    }
  }, []);

  const onFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const f = files[0];
      const content = await f.text();
      setText(content);
      await submitText(content);
    },
    [submitText]
  );

  return (
    <div className="rise">
      <section className="text-center py-10">
        <p className="pill inline-block mb-4">Receipt → Budget · Warranty Vault · Subscription Killer</p>
        <h1 className="font-display" style={{ fontSize: 52, lineHeight: 1.05, margin: 0 }}>
          Drop a receipt.
          <br />
          <span style={{ color: "var(--gold)" }}>Get your money story.</span>
        </h1>
        <p style={{ color: "var(--mist)", maxWidth: 620, margin: "18px auto 0" }}>
          Extract merchants, totals, warranty dates, and return windows — then watch subscriptions and
          a shareable money card appear. Everything runs locally on your machine.
        </p>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <div
          className={`dropzone p-6 flex flex-col ${drag ? "drag" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void onFiles(e.dataTransfer.files);
          }}
          data-testid="dropzone"
        >
          <textarea
            data-testid="receipt-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste receipt / invoice / email text here, or drop a .txt file…"
            className="bg-transparent w-full resize-none outline-none"
            style={{ minHeight: 220, color: "var(--cream)" }}
          />
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              data-testid="parse-btn"
              className="gold-btn px-5 py-2.5"
              disabled={busy}
              onClick={() => void submitText(text)}
            >
              {busy ? "Reading…" : "Extract receipt"}
            </button>
            <button
              data-testid="sample-btn"
              className="ghost-btn px-5 py-2.5"
              onClick={() => setText(SAMPLE)}
            >
              Use sample
            </button>
            <button className="ghost-btn px-5 py-2.5" onClick={() => fileRef.current?.click()}>
              Upload file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.json,text/plain"
              hidden
              onChange={(e) => void onFiles(e.target.files)}
            />
          </div>
        </div>

        <div className="card p-6" data-testid="result-panel">
          {!result && (
            <div style={{ color: "var(--mist)" }} className="h-full flex items-center justify-center text-center">
              Extraction results will appear here.
            </div>
          )}
          {result && (
            <div className="rise">
              <div className="flex items-center justify-between">
                <h2 className="font-display" style={{ fontSize: 26, margin: 0 }}>
                  {result.merchant}
                </h2>
                <span className="pill">{result.source === "llm" ? "AI parsed" : "heuristic"}</span>
              </div>
              <p style={{ color: "var(--mist)", marginTop: 4 }}>
                {result.date} · <span className="capitalize">{result.category}</span>
              </p>

              <div className="grid grid-cols-3 gap-3 my-5">
                <Stat label="Subtotal" value={`${result.currency} ${result.subtotal.toFixed(2)}`} />
                <Stat label="Tax" value={`${result.currency} ${result.tax.toFixed(2)}`} />
                <Stat label="Total" value={`${result.currency} ${result.total.toFixed(2)}`} highlight />
              </div>

              {result.items.length > 0 && (
                <div className="mb-4">
                  {result.items.slice(0, 6).map((it, i) => (
                    <div
                      key={i}
                      className="flex justify-between py-1.5 text-sm"
                      style={{ borderBottom: "1px solid rgba(155,191,174,0.12)" }}
                    >
                      <span>
                        {it.qty}× {it.description}
                      </span>
                      <span style={{ color: "var(--gold)" }}>{it.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {result.warrantyEnds && (
                  <span className="pill">Warranty → {result.warrantyEnds}</span>
                )}
                {result.returnWindowEnds && (
                  <span className="pill">Return by {result.returnWindowEnds}</span>
                )}
                {result.isSubscription && <span className="pill">Subscription · {result.cadence}</span>}
              </div>

              <div className="flex gap-3 mt-6">
                <Link href="/dashboard" className="gold-btn px-5 py-2.5" style={{ textDecoration: "none" }}>
                  See dashboard →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="card p-3 text-center">
      <div style={{ color: "var(--mist)", fontSize: 12 }}>{label}</div>
      <div
        className="font-display"
        style={{ fontSize: 20, color: highlight ? "var(--gold)" : "var(--cream)", marginTop: 2 }}
      >
        {value}
      </div>
    </div>
  );
}
