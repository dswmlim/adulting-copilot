// One-command demo GIF generator.
//
//   npm run demo:gif
//
// Steps:
//   1. Seed the database from /demo_assets (idempotent reset).
//   2. Build the Next.js app (production) and start it on PORT.
//   3. Run the Playwright flow to capture frames into /demo_frames.
//   4. Encode frames → /public/demo.gif and /assets/demo.gif via ffmpeg
//      (palette-based for high quality), with a gifski fallback if present.
//
// Cross-platform: requires Node 20+, a Chromium installed via `npx playwright install chromium`,
// and ffmpeg OR gifski on PATH. See README "Create the demo GIF" for install commands.

import { spawn, spawnSync, ChildProcess } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.PORT || 3000);
const BASE = `http://localhost:${PORT}`;
const FRAMES_DIR = path.join(process.cwd(), "demo_frames");
const OUT_PUBLIC = path.join(process.cwd(), "public", "demo.gif");
const OUT_ASSETS = path.join(process.cwd(), "assets", "demo.gif");
const FPS = 12;

function sh(cmd: string, args: string[], opts: Record<string, unknown> = {}) {
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...opts });
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(" ")} exited with ${res.status}`);
}

function has(cmd: string): boolean {
  const probe = spawnSync(cmd, ["-version"], { stdio: "ignore", shell: process.platform === "win32" });
  return probe.status === 0;
}

function waitForServer(url: string, timeoutMs = 60000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) reject(new Error("Server did not start in time"));
          else setTimeout(tick, 800);
        });
    };
    tick();
  });
}

async function main() {
  // 1) Seed
  console.log("▶ Seeding demo data…");
  sh("npx", ["tsx", "scripts/seed.ts"]);

  // 2) Build + start
  console.log("▶ Building app…");
  sh("npx", ["next", "build"]);

  console.log(`▶ Starting server on ${BASE}…`);
  const server: ChildProcess = spawn("npx", ["next", "start", "-p", String(PORT)], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env },
  });

  const cleanup = () => {
    try {
      if (process.platform === "win32" && server.pid) {
        spawnSync("taskkill", ["/pid", String(server.pid), "/f", "/t"], { stdio: "ignore", shell: true });
      } else {
        server.kill("SIGTERM");
      }
    } catch {
      /* ignore */
    }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(1);
  });

  try {
    await waitForServer(BASE);

    // 3) Capture frames
    console.log("▶ Recording browser flow…");
    sh("npx", ["tsx", "scripts/demo-flow.ts"], { env: { ...process.env, DEMO_BASE_URL: BASE } });

    // 4) Encode
    fs.mkdirSync(path.dirname(OUT_PUBLIC), { recursive: true });
    fs.mkdirSync(path.dirname(OUT_ASSETS), { recursive: true });

    if (has("ffmpeg")) {
      console.log("▶ Encoding GIF with ffmpeg (palette)…");
      const palette = path.join(FRAMES_DIR, "palette.png");
      const pattern = path.join(FRAMES_DIR, "frame-%04d.png");
      const filters = `fps=${FPS},scale=900:-1:flags=lanczos`;
      sh("ffmpeg", ["-y", "-i", pattern, "-vf", `${filters},palettegen=stats_mode=diff`, palette]);
      sh("ffmpeg", [
        "-y",
        "-framerate",
        String(FPS),
        "-i",
        pattern,
        "-i",
        palette,
        "-lavfi",
        `${filters} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3`,
        "-loop",
        "0",
        OUT_PUBLIC,
      ]);
      fs.copyFileSync(OUT_PUBLIC, OUT_ASSETS);
    } else if (has("gifski")) {
      console.log("▶ Encoding GIF with gifski…");
      sh("gifski", ["--fps", String(FPS), "-o", OUT_PUBLIC, path.join(FRAMES_DIR, "frame-*.png")]);
      fs.copyFileSync(OUT_PUBLIC, OUT_ASSETS);
    } else {
      throw new Error(
        "Neither ffmpeg nor gifski found on PATH. Install one (see README → Create the demo GIF) and re-run."
      );
    }

    console.log(`✅ Demo GIF written to:\n   ${OUT_PUBLIC}\n   ${OUT_ASSETS}`);
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error("[demo:gif] failed:", err);
  process.exit(1);
});
