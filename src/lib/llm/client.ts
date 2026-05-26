// LLM abstraction layer.
// - Two adapters: Anthropic and OpenAI, selected by env.
// - Every call is wrapped with timeout + bounded retries.
// - Output is validated against the receipt schema; on any failure we fall back
//   to the deterministic heuristic parser so the app NEVER hard-fails.

import { ParsedReceipt } from "../types";
import { heuristicParse } from "../parsers/heuristic";
import { validateReceipt } from "./schema";
import { RECEIPT_PARSE_SYSTEM, buildReceiptParseUser } from "../../../prompts";

export type Provider = "anthropic" | "openai" | "none";

export interface LLMConfig {
  provider: Provider;
  apiKey?: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
}

export function resolveConfig(env: NodeJS.ProcessEnv = process.env): LLMConfig {
  if (env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
      timeoutMs: Number(env.LLM_TIMEOUT_MS || 20000),
      maxRetries: Number(env.LLM_MAX_RETRIES || 2),
    };
  }
  if (env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || "gpt-4o-mini",
      timeoutMs: Number(env.LLM_TIMEOUT_MS || 20000),
      maxRetries: Number(env.LLM_MAX_RETRIES || 2),
    };
  }
  return { provider: "none", model: "heuristic", timeoutMs: 0, maxRetries: 0 };
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) return p;
  const controller = new Promise<never>((_, reject) => {
    const t = setTimeout(() => reject(new Error(`LLM timeout after ${ms}ms`)), ms);
    // Prevent the timer from keeping the event loop alive.
    if (typeof t === "object" && "unref" in t) (t as { unref: () => void }).unref();
  });
  return Promise.race([p, controller]);
}

async function retry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts) {
        const backoff = 300 * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }
  throw lastErr;
}

/** Extract the first JSON object from a possibly-fenced model response. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in LLM response");
  return JSON.parse(candidate.slice(start, end + 1));
}

async function callAnthropic(cfg: LLMConfig, text: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 1500,
      system: RECEIPT_PARSE_SYSTEM,
      messages: [{ role: "user", content: buildReceiptParseUser(text) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.content || [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n");
}

async function callOpenAI(cfg: LLMConfig, text: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: RECEIPT_PARSE_SYSTEM },
        { role: "user", content: buildReceiptParseUser(text) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Parse a receipt from raw text. Always resolves to a valid ParsedReceipt.
 * Falls back to the heuristic parser on missing key, timeout, HTTP error,
 * invalid JSON, or schema violation.
 */
export async function parseReceipt(
  text: string,
  cfg: LLMConfig = resolveConfig()
): Promise<ParsedReceipt> {
  const fallback = heuristicParse(text);
  if (cfg.provider === "none") return fallback;

  try {
    const raw = await retry(
      () =>
        withTimeout(
          cfg.provider === "anthropic" ? callAnthropic(cfg, text) : callOpenAI(cfg, text),
          cfg.timeoutMs
        ),
      cfg.maxRetries
    );
    const json = extractJson(raw);
    // Merge: keep heuristic-derived fields the LLM may omit, then validate.
    const merged = { ...fallback, ...(json as object), source: "llm", rawText: text };
    const validated = validateReceipt(merged);
    return validated as ParsedReceipt;
  } catch (err) {
    // Never surface a hard failure to the user; degrade gracefully.
    // eslint-disable-next-line no-console
    console.warn(`[llm] falling back to heuristic parser: ${(err as Error).message}`);
    return fallback;
  }
}
