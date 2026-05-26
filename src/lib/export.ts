// Pure generators: .ics calendar feed and an SVG share card.
// Neither makes any network calls — everything is rendered locally.

import { WarrantyReminder, ShareCardStats } from "./types";
import { redactForShare } from "./redact";

function icsDate(iso: string): string {
  return iso.replace(/-/g, "") ; // YYYYMMDD (all-day VALUE=DATE)
}

function escapeIcs(s: string): string {
  return s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

/** Build an RFC-5545 VCALENDAR string with one all-day VEVENT per reminder. */
export function buildIcs(reminders: WarrantyReminder[]): string {
  const now =
    new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Adulting Copilot//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const r of reminders) {
    const title =
      r.kind === "warranty"
        ? `Warranty ends: ${r.merchant}`
        : `Return window closes: ${r.merchant}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.id}@adulting-copilot`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${icsDate(r.dueDate)}`,
      `SUMMARY:${escapeIcs(title)}`,
      `DESCRIPTION:${escapeIcs(`${r.itemDescription} — tracked by Adulting Copilot`)}`,
      "BEGIN:VALARM",
      "TRIGGER:-P3D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcs(title)}`,
      "END:VALARM",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** Render a self-contained, redacted SVG share card. */
export function buildShareCardSvg(stats: ShareCardStats): string {
  const merchantSafe = redactForShare(stats.topCategory);
  const money = (n: number) =>
    `${stats.currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b3d2e"/>
      <stop offset="100%" stop-color="#06231a"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#f4c95d"/>
      <stop offset="100%" stop-color="#e8a13a"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <text x="80" y="140" fill="#f4c95d" font-family="Georgia, serif" font-size="40" font-weight="bold">ADULTING COPILOT</text>
  <text x="80" y="200" fill="#9bbfae" font-family="Arial, sans-serif" font-size="32">Money story · ${stats.month}</text>
  <line x1="80" y1="240" x2="1000" y2="240" stroke="#1d5a45" stroke-width="2"/>

  <text x="80" y="380" fill="#ffffff" font-family="Arial, sans-serif" font-size="36">Total tracked</text>
  <text x="80" y="470" fill="url(#accent)" font-family="Georgia, serif" font-size="110" font-weight="bold">${money(
    stats.totalSpend
  )}</text>

  <text x="80" y="600" fill="#ffffff" font-family="Arial, sans-serif" font-size="36">Top category</text>
  <text x="80" y="660" fill="#f4c95d" font-family="Georgia, serif" font-size="56" font-weight="bold">${escapeXml(
    merchantSafe
  )} · ${stats.topCategoryShare}%</text>

  <text x="80" y="780" fill="#ffffff" font-family="Arial, sans-serif" font-size="36">Subscriptions on the chopping block</text>
  <text x="80" y="840" fill="#f4c95d" font-family="Georgia, serif" font-size="56" font-weight="bold">${money(
    stats.subscriptionsKilledValue
  )}/yr</text>

  <rect x="80" y="920" width="920" height="90" rx="16" fill="#0e4a37"/>
  <text x="110" y="975" fill="#d9efe5" font-family="Arial, sans-serif" font-size="30">${escapeXml(
    clip(stats.funFact, 64)
  )}</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
