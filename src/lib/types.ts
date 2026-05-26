// Core domain types shared across parsers, API, and UI.

export type Category =
  | "groceries"
  | "dining"
  | "electronics"
  | "subscriptions"
  | "transport"
  | "utilities"
  | "health"
  | "home"
  | "apparel"
  | "entertainment"
  | "other";

export const CATEGORIES: Category[] = [
  "groceries",
  "dining",
  "electronics",
  "subscriptions",
  "transport",
  "utilities",
  "health",
  "home",
  "apparel",
  "entertainment",
  "other",
];

export interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface ParsedReceipt {
  /** Stable id assigned at persistence time. */
  id?: string;
  merchant: string;
  /** ISO 8601 date string (YYYY-MM-DD). */
  date: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  category: Category;
  items: LineItem[];
  /** ISO date the return window closes, if detected. */
  returnWindowEnds?: string | null;
  /** ISO date the warranty expires, if detected. */
  warrantyEnds?: string | null;
  /** Whether this looks like a recurring subscription charge. */
  isSubscription: boolean;
  /** Detected billing cadence for subscriptions. */
  cadence?: "monthly" | "yearly" | "weekly" | null;
  /** Confidence 0..1 of the extraction. */
  confidence: number;
  /** "llm" | "heuristic" — which engine produced this. */
  source: "llm" | "heuristic";
  /** Original raw text used for parsing (redacted before sharing). */
  rawText?: string;
  createdAt?: string;
}

export interface Subscription {
  merchant: string;
  amount: number;
  currency: string;
  cadence: "monthly" | "yearly" | "weekly";
  lastChargedDate: string;
  occurrences: number;
  /** Estimated annualized cost. */
  annualizedCost: number;
}

export interface WarrantyReminder {
  id: string;
  receiptId: string;
  merchant: string;
  itemDescription: string;
  kind: "warranty" | "return";
  dueDate: string;
  notified: boolean;
}

export interface MonthlyInsight {
  month: string; // YYYY-MM
  totalSpend: number;
  byCategory: Record<string, number>;
  topMerchant: string;
  receiptCount: number;
  /** Natural-language "what changed" vs previous month. */
  narrative: string;
  deltaVsPrevMonth: number;
}

export interface ShareCardStats {
  month: string;
  totalSpend: number;
  currency: string;
  topCategory: string;
  topCategoryShare: number;
  receiptCount: number;
  subscriptionsKilledValue: number;
  funFact: string;
}
