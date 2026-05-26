// Redaction utilities. Used before any receipt text leaves the device boundary
// (e.g. baked into a shareable card image). Conservative by design.

const PATTERNS: Array<[RegExp, string]> = [
  // Credit-card-like 13-19 digit groups
  [/\b(?:\d[ -]*?){13,19}\b/g, "•••• •••• •••• ••••"],
  // Emails
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]"],
  // Phone numbers (loose international)
  [/\+?\d[\d ()-]{7,}\d/g, "[phone]"],
  // Long account/order numbers
  [/\b(?:acct|account|order|ref|invoice)\s*#?\s*[:.]?\s*[A-Z0-9-]{6,}\b/gi, "[ref]"],
];

export function redactText(text: string): string {
  let out = text;
  for (const [re, repl] of PATTERNS) out = out.replace(re, repl);
  return out;
}

/** Mask all but the merchant + amounts for a safe public share card. */
export function redactForShare(merchant: string): string {
  // Keep merchant but strip anything that looks like a location/address suffix.
  return merchant.replace(/\d{1,5}\s+[\w .]+(street|st|ave|road|rd|blvd).*/i, "").trim();
}
