// Playwright-driven demo flow. Captures a sequence of PNG frames into /demo_frames
// as it walks through: upload → extraction → dashboard → share card → subscriptions →
// cancellation draft → warranty vault → .ics export. The orchestrator
// (make-demo-gif.ts) stitches the frames into a smooth, looping GIF.

import { chromium, Browser, Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.DEMO_BASE_URL || "http://localhost:3000";
const FRAMES_DIR = path.join(process.cwd(), "demo_frames");
const VIEWPORT = { width: 1280, height: 800 };

let frameIdx = 0;

async function shoot(page: Page, holdFrames = 6) {
  // Capture the same view multiple times to "hold" it in the final GIF.
  for (let i = 0; i < holdFrames; i++) {
    const file = path.join(FRAMES_DIR, `frame-${String(frameIdx++).padStart(4, "0")}.png`);
    await page.screenshot({ path: file });
  }
}

async function settle(page: Page, ms = 350) {
  await page.waitForTimeout(ms);
}

async function run() {
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAMES_DIR, { recursive: true });

  const browser: Browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });

  // 1) Landing / upload page
  await page.goto(BASE, { waitUntil: "networkidle" });
  await settle(page);
  await shoot(page, 8);

  // 2) Load the sample and extract — the "wow moment"
  await page.getByTestId("sample-btn").click();
  await settle(page, 250);
  await shoot(page, 4);
  await page.getByTestId("parse-btn").click();
  await page.getByTestId("result-panel").getByText("Total").first().waitFor({ timeout: 15000 });
  await settle(page, 400);
  await shoot(page, 12); // hold on the extracted result

  // 3) Dashboard (spend chart + share card)
  await page.getByTestId("nav-dashboard").click();
  await page.getByTestId("spend-chart").waitFor({ timeout: 15000 });
  await settle(page, 600);
  await shoot(page, 12);

  // 4) Subscriptions + draft cancellation
  await page.getByTestId("nav-subscriptions").click();
  await settle(page, 500);
  await shoot(page, 8);
  const cancelBtn = page.locator('[data-testid^="cancel-"]').first();
  if (await cancelBtn.count()) {
    await cancelBtn.click();
    await page.getByTestId("cancel-draft").waitFor({ timeout: 15000 });
    await settle(page, 500);
    await shoot(page, 12);
  }

  // 5) Warranty vault + .ics export highlight
  await page.getByTestId("nav-warranty-vault").click();
  await settle(page, 500);
  await shoot(page, 8);
  await page.getByTestId("export-ics").hover();
  await settle(page, 250);
  await shoot(page, 8);

  await browser.close();
  // eslint-disable-next-line no-console
  console.log(`[demo] captured ${frameIdx} frames into ${FRAMES_DIR}`);
}

run().catch((err) => {
  console.error("[demo] flow failed:", err);
  process.exit(1);
});
