import { NextRequest, NextResponse } from "next/server";
import { resolveConfig } from "@/lib/llm/client";
import { CANCEL_EMAIL_SYSTEM, buildCancelEmailUser } from "../../../../prompts";

export const runtime = "nodejs";

function deterministicDraft(merchant: string, amount: number, currency: string): string {
  return `Subject: Cancellation of my ${merchant} subscription

Hello ${merchant} Support,

I am writing to cancel my subscription effective immediately. Please stop all future charges (currently ${currency} ${amount.toFixed(
    2
  )}) to my payment method.

Kindly confirm in writing that the subscription has been cancelled and that no further billing will occur. If any pro-rated refund applies, please process it to the original payment method.

Thank you,
[Your Name]
[Account Email]`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.merchant !== "string") {
    return NextResponse.json({ error: "Field 'merchant' is required." }, { status: 400 });
  }
  const merchant: string = body.merchant;
  const amount: number = Number(body.amount) || 0;
  const currency: string = body.currency || "USD";

  const cfg = resolveConfig();
  if (cfg.provider === "none") {
    return NextResponse.json({ draft: deterministicDraft(merchant, amount, currency), source: "heuristic" });
  }

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), cfg.timeoutMs);
    let draft = "";

    if (cfg.provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": cfg.apiKey!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: 400,
          system: CANCEL_EMAIL_SYSTEM,
          messages: [{ role: "user", content: buildCancelEmailUser(merchant, amount, currency) }],
        }),
      });
      const data = await res.json();
      draft = (data.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: "system", content: CANCEL_EMAIL_SYSTEM },
            { role: "user", content: buildCancelEmailUser(merchant, amount, currency) },
          ],
        }),
      });
      const data = await res.json();
      draft = data.choices?.[0]?.message?.content ?? "";
    }
    clearTimeout(t);
    if (!draft.trim()) throw new Error("empty draft");
    return NextResponse.json({ draft, source: "llm" });
  } catch {
    return NextResponse.json({ draft: deterministicDraft(merchant, amount, currency), source: "heuristic" });
  }
}
