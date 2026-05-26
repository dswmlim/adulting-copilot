// Deterministic, dependency-free receipt parser.
// Used when no LLM key is configured, and as a schema/sanity backstop for LLM output.

import { Category, LineItem, ParsedReceipt } from "../types";

const MERCHANT_CATEGORY: Array<[RegExp, Category]> = [
  [/netflix|spotify|disney\+?|hulu|youtube premium|prime video|notion|figma|adobe|dropbox|icloud|github/i, "subscriptions"],
  [/whole foods|trader joe|safeway|tesco|aldi|lidl|costco|ntuc|fairprice|cold storage|grocer/i, "groceries"],
  [/starbucks|mcdonald|kfc|burger|pizza|cafe|coffee|restaurant|bistro|diner|bar & grill/i, "dining"],
  [/apple store|best buy|newegg|currys|harvey norman|challenger|electronics|micro center/i, "electronics"],
  [/uber|lyft|grab|limosine|taxi|transit|mrt|metro|shell|esso|petrol|gas station/i, "transport"],
  [/comcast|at&t|verizon|singtel|starhub|electric|water|power|utility|broadband/i, "utilities"],
  [/pharmacy|guardian|watsons|cvs|walgreens|clinic|dental|optical|health/i, "health"],
  [/ikea|home depot|lowes|courts|furniture|hardware/i, "home"],
  [/uniqlo|zara|h&m|nike|adidas|apparel|clothing|fashion/i, "apparel"],
  [/cinema|cineplex|golden village|gv|steam|playstation|xbox|nintendo|concert|ticket/i, "entertainment"],
];

// Ordered longest-symbol-first so "S$" is matched before bare "$".
const CURRENCY_SYMBOLS: Array<[string, string]> = [
  ["S$", "SGD"],
  ["A$", "AUD"],
  ["C$", "CAD"],
  ["£", "GBP"],
  ["€", "EUR"],
  ["¥", "JPY"],
  ["₹", "INR"],
  ["$", "USD"],
];

const SUBSCRIPTION_HINTS =
  /(monthly|recurring|subscription|auto-?renew|billed monthly|billed annually|renews on|next billing|membership)/i;

export function detectCurrency(text: string): string {
  for (const [sym, code] of CURRENCY_SYMBOLS) {
    if (text.includes(sym)) return code;
  }
  const codeMatch = text.match(/\b(USD|SGD|GBP|EUR|JPY|INR|AUD|CAD)\b/);
  return codeMatch ? codeMatch[1] : "USD";
}

export function detectMerchant(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  // Merchant is typically a header line near the top: has letters, is NOT a date,
  // and is NOT a priced line item (no trailing money amount).
  const looksLikeDate = (l: string) =>
    /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(l) ||
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(l);
  const looksLikeItemOrTotal = (l: string) =>
    /[0-9]+[.,][0-9]{2}\s*$/.test(l) ||
    /sub-?total|grand total|^total|tax|gst|vat|amount due/i.test(l);

  for (const l of lines.slice(0, 6)) {
    if (!/[a-zA-Z]/.test(l)) continue;
    if (looksLikeDate(l)) continue;
    if (looksLikeItemOrTotal(l)) continue;
    const cleaned = l.replace(/[*#=_]{2,}/g, "").trim();
    if (cleaned.length >= 2) return cleaned.slice(0, 60);
  }
  // Fallback: first line with letters.
  const firstAlpha = lines.find((l) => /[a-zA-Z]/.test(l));
  return firstAlpha ? firstAlpha.slice(0, 60) : "Unknown Merchant";
}

export function detectCategory(merchant: string, text: string): Category {
  const haystack = `${merchant}\n${text}`;
  for (const [re, cat] of MERCHANT_CATEGORY) {
    if (re.test(haystack)) return cat;
  }
  return "other";
}

export function detectDate(text: string): string {
  // Try ISO first, then common DD/MM/YYYY or MM/DD/YYYY, then "Jan 5, 2026".
  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return normalize(+iso[1], +iso[2], +iso[3]);

  const slash = text.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2}|\d{2})\b/);
  if (slash) {
    let [_, a, b, y] = slash;
    let year = +y < 100 ? 2000 + +y : +y;
    // Assume DD/MM if first part > 12, else MM/DD.
    const day = +a > 12 ? +a : +b;
    const month = +a > 12 ? +b : +a;
    return normalize(year, month, day);
  }

  const named = text.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i
  );
  if (named) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const m = months.indexOf(named[1].slice(0, 3).toLowerCase()) + 1;
    return normalize(+named[3], m, +named[2]);
  }
  return new Date().toISOString().slice(0, 10);
}

function normalize(y: number, m: number, d: number): string {
  const mm = String(Math.min(Math.max(m, 1), 12)).padStart(2, "0");
  const dd = String(Math.min(Math.max(d, 1), 31)).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function parseMoney(raw: string): number {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function detectTotals(text: string): { subtotal: number; tax: number; total: number } {
  const money = "([0-9]+(?:[.,][0-9]{2}))";
  // Labels sit at the start of a line with the amount at the end of the SAME line.
  // [^\n0-9]* tolerates arbitrarily wide column padding without crossing lines.
  const total =
    text.match(new RegExp(`\\b(?:grand\\s+)?total[^\\n0-9]*${money}`, "i")) ||
    text.match(new RegExp(`\\bamount\\s+due[^\\n0-9]*${money}`, "i"));
  const subtotal = text.match(new RegExp(`\\bsub-?total[^\\n0-9]*${money}`, "i"));
  const tax = text.match(new RegExp(`\\b(?:tax|gst|vat)[^\\n0-9]*${money}`, "i"));

  const totalVal = total ? parseMoney(total[1]) : 0;
  const subtotalVal = subtotal ? parseMoney(subtotal[1]) : 0;
  const taxVal = tax ? parseMoney(tax[1]) : 0;

  // If no explicit total, take the largest money-looking number.
  if (!totalVal) {
    const all = [...text.matchAll(/([0-9]+[.,][0-9]{2})/g)].map((m) => parseMoney(m[1]));
    const max = all.length ? Math.max(...all) : 0;
    return { subtotal: subtotalVal || Math.max(max - taxVal, 0), tax: taxVal, total: max };
  }
  return {
    subtotal: subtotalVal || Math.max(totalVal - taxVal, 0),
    tax: taxVal,
    total: totalVal,
  };
}

export function detectItems(text: string): LineItem[] {
  const items: LineItem[] = [];
  const lines = text.split(/\r?\n/);
  const lineRe = /^(.+?)\s+(?:(\d+)\s*[xX@]\s*)?\$?\s*([0-9]+(?:[.,][0-9]{2}))\s*$/;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/sub-?total|grand total|^total|tax|gst|vat|amount due|change|cash|card|balance/i.test(t)) continue;
    const m = t.match(lineRe);
    if (m) {
      const desc = m[1].trim();
      if (desc.length < 2 || /^[0-9.\s]+$/.test(desc)) continue;
      const qty = m[2] ? parseInt(m[2], 10) : 1;
      const total = parseMoney(m[3]);
      items.push({ description: desc.slice(0, 80), qty, unitPrice: Math.round((total / qty) * 100) / 100, total });
    }
  }
  return items.slice(0, 50);
}

export function detectWarrantyAndReturn(
  text: string,
  purchaseDate: string
): { warrantyEnds: string | null; returnWindowEnds: string | null } {
  let warrantyEnds: string | null = null;
  let returnWindowEnds: string | null = null;

  const warrantyMonths = text.match(/(\d{1,2})\s*(?:-|\s)?(year|yr|month|mo)s?\s+warranty/i);
  if (warrantyMonths) {
    const n = parseInt(warrantyMonths[1], 10);
    const unit = warrantyMonths[2].toLowerCase();
    const months = unit.startsWith("y") ? n * 12 : n;
    warrantyEnds = addMonths(purchaseDate, months);
  }

  const returnDays = text.match(/(\d{1,3})[-\s]?day(?:s)?\s+(?:return|refund)/i);
  if (returnDays) {
    returnWindowEnds = addDays(purchaseDate, parseInt(returnDays[1], 10));
  } else if (/return(?:s)?\s+(?:accepted|policy)/i.test(text)) {
    returnWindowEnds = addDays(purchaseDate, 30); // sensible default
  }
  return { warrantyEnds, returnWindowEnds };
}

export function detectSubscription(
  merchant: string,
  text: string,
  category: Category
): { isSubscription: boolean; cadence: "monthly" | "yearly" | "weekly" | null } {
  const hint = SUBSCRIPTION_HINTS.test(text) || category === "subscriptions";
  if (!hint) return { isSubscription: false, cadence: null };
  let cadence: "monthly" | "yearly" | "weekly" = "monthly";
  if (/annual|year|yearly/i.test(text)) cadence = "yearly";
  else if (/week/i.test(text)) cadence = "weekly";
  return { isSubscription: true, cadence };
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Full deterministic parse pipeline. */
export function heuristicParse(text: string): ParsedReceipt {
  const merchant = detectMerchant(text);
  const currency = detectCurrency(text);
  const category = detectCategory(merchant, text);
  const date = detectDate(text);
  const { subtotal, tax, total } = detectTotals(text);
  const items = detectItems(text);
  const { warrantyEnds, returnWindowEnds } = detectWarrantyAndReturn(text, date);
  const { isSubscription, cadence } = detectSubscription(merchant, text, category);

  // Confidence reflects how much structure we recovered.
  let confidence = 0.35;
  if (total > 0) confidence += 0.2;
  if (items.length > 0) confidence += 0.2;
  if (merchant !== "Unknown Merchant") confidence += 0.15;
  confidence = Math.min(confidence, 0.9);

  return {
    merchant,
    date,
    currency,
    subtotal,
    tax,
    total,
    category,
    items,
    returnWindowEnds,
    warrantyEnds,
    isSubscription,
    cadence,
    confidence,
    source: "heuristic",
    rawText: text,
  };
}
