// Runtime schema validation for ParsedReceipt. Guards both LLM output and API input.

import { z } from "zod";
import { CATEGORIES } from "../types";

export const lineItemSchema = z.object({
  description: z.string().min(1).max(120),
  qty: z.number().min(0).max(10000),
  unitPrice: z.number().min(0),
  total: z.number().min(0),
});

export const parsedReceiptSchema = z.object({
  id: z.string().optional(),
  merchant: z.string().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  currency: z.string().min(1).max(8),
  subtotal: z.number().min(0),
  tax: z.number().min(0),
  total: z.number().min(0),
  category: z.enum(CATEGORIES as [string, ...string[]]),
  items: z.array(lineItemSchema).max(200),
  returnWindowEnds: z.string().nullable().optional(),
  warrantyEnds: z.string().nullable().optional(),
  isSubscription: z.boolean(),
  cadence: z.enum(["monthly", "yearly", "weekly"]).nullable().optional(),
  confidence: z.number().min(0).max(1),
  source: z.enum(["llm", "heuristic"]),
  rawText: z.string().optional(),
  createdAt: z.string().optional(),
});

export type ValidatedReceipt = z.infer<typeof parsedReceiptSchema>;

/** Coerce/clamp loosely-typed LLM JSON into a valid receipt or throw. */
export function validateReceipt(input: unknown): ValidatedReceipt {
  return parsedReceiptSchema.parse(input);
}
