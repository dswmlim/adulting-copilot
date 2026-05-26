import { NextRequest, NextResponse } from "next/server";
import { parseReceipt } from "@/lib/llm/client";
import { insertReceipt } from "@/lib/db";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB hard limit
const ALLOWED_TEXT_TYPES = ["text/plain", "application/json", ""];

/**
 * Accepts either:
 *  - multipart/form-data with a `file` field (text-based receipts), or
 *  - application/json with { text: string }.
 * Images/PDFs are accepted but only their embedded text is read here; OCR is out of
 * scope for the local-first core (documented in README).
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let text = "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (typeof body.text !== "string" || body.text.trim().length === 0) {
        return NextResponse.json({ error: "Field 'text' is required." }, { status: 400 });
      }
      if (body.text.length > MAX_BYTES) {
        return NextResponse.json({ error: "Payload too large." }, { status: 413 });
      }
      text = body.text;
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "File exceeds 5 MB limit." }, { status: 413 });
      }
      if (!ALLOWED_TEXT_TYPES.includes(file.type) && !file.type.startsWith("text/")) {
        // For non-text files we still attempt a best-effort text decode.
        // (PDF/image OCR is intentionally not bundled to stay dependency-light.)
      }
      const buf = Buffer.from(await file.arrayBuffer());
      text = buf.toString("utf-8").replace(/\u0000/g, "");
    } else {
      return NextResponse.json({ error: "Unsupported content type." }, { status: 415 });
    }

    const parsed = await parseReceipt(text);
    const saved = insertReceipt(parsed);
    return NextResponse.json({ receipt: saved }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to process upload.", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
