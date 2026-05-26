import { NextRequest, NextResponse } from "next/server";
import { parseReceipt } from "@/lib/llm/client";

export const runtime = "nodejs";

// Stateless parse endpoint (no persistence) — useful for previews and tests.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.text !== "string") {
    return NextResponse.json({ error: "Field 'text' is required." }, { status: 400 });
  }
  const parsed = await parseReceipt(body.text);
  return NextResponse.json({ receipt: parsed });
}
