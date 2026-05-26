"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [provider, setProvider] = useState<string>("…");

  useEffect(() => {
    // The server tells us which provider is active without ever exposing the key.
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setProvider(d.provider))
      .catch(() => setProvider("unknown"));
  }, []);

  return (
    <div className="rise">
      <h1 className="font-display" style={{ fontSize: 40, margin: "8px 0 4px" }}>
        Settings
      </h1>
      <p style={{ color: "var(--mist)", marginBottom: 24 }}>How your data is handled, and which engine parses receipts.</p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-6">
          <h2 className="font-display" style={{ fontSize: 22, marginTop: 0 }}>
            Parsing engine
          </h2>
          <p style={{ color: "var(--mist)" }}>
            Active provider: <span className="pill">{provider}</span>
          </p>
          <p style={{ color: "var(--mist)", fontSize: 14 }}>
            Set <code>ANTHROPIC_API_KEY</code> or <code>OPENAI_API_KEY</code> in your <code>.env</code> to enable
            AI parsing. With no key, the deterministic heuristic parser is used — fully offline.
          </p>
        </div>

        <div className="card p-6">
          <h2 className="font-display" style={{ fontSize: 22, marginTop: 0 }}>
            Privacy
          </h2>
          <ul style={{ color: "var(--mist)", fontSize: 14, lineHeight: 1.8, paddingLeft: 18 }}>
            <li>Receipts are stored locally in a SQLite file (<code>data/adulting.db</code>).</li>
            <li>Share cards are redacted and rendered on-device.</li>
            <li>No analytics, no telemetry, no third-party calls except the LLM you configure.</li>
            <li>Delete <code>data/adulting.db</code> to wipe everything instantly.</li>
          </ul>
        </div>
      </div>

      <div
        className="card p-5 mt-4"
        style={{ borderColor: "rgba(240,163,94,0.4)", color: "var(--mist)", fontSize: 13 }}
      >
        Adulting Copilot does not provide financial, legal, tax, or medical advice. Extracted dates and
        amounts are best-effort estimates — always verify against original documents.
      </div>
    </div>
  );
}
