import { NextResponse } from "next/server";
import { resolveConfig } from "@/lib/llm/client";

export const runtime = "nodejs";

// Reports which engine is active. NEVER returns the API key itself.
export async function GET() {
  const cfg = resolveConfig();
  return NextResponse.json({
    provider: cfg.provider,
    model: cfg.provider === "none" ? "heuristic (offline)" : cfg.model,
  });
}
