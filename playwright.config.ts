import { defineConfig } from "@playwright/test";

// The demo capture flow is orchestrated by scripts/make-demo-gif.ts, which starts
// the server itself. This config exists so `npx playwright` resolves cleanly and
// for anyone who wants to run the flow against an already-running dev server.
export default defineConfig({
  testDir: "./scripts",
  timeout: 60_000,
  use: {
    baseURL: process.env.DEMO_BASE_URL || "http://localhost:3000",
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
});
