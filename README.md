<div align="center">

# 🧾 Adulting Copilot

### Receipt-to-Budget · Warranty Vault · Subscription Killer

**Drop a receipt. Get your money story.** A privacy-first "adulting assistant" that turns
the pile of receipts, invoices, and confirmation emails in your life into a clean spend
dashboard, a redacted shareable money card, auto-tracked warranty/return reminders, and
ready-to-send subscription cancellation emails — all running **locally on your machine**.

[![CI](https://github.com/USER/adulting-copilot/actions/workflows/ci.yml/badge.svg)](https://github.com/USER/adulting-copilot/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%3E%3D20-0b3d2e)
![License](https://img.shields.io/badge/license-MIT-f4c95d)
![Privacy](https://img.shields.io/badge/storage-local--first-0e4a37)

![Adulting Copilot demo](./public/demo.gif)

</div>

---

## ✨ Why this exists

Being a functional adult means quietly losing money to forgotten subscriptions, missed return
windows, and warranties you can never find when something breaks. Adulting Copilot fixes the
boring-but-expensive parts of life in **60 seconds**, without shipping your financial data to
anyone's cloud.

| Feature | What it does |
| --- | --- |
| 🧠 **Smart extraction** | Pulls merchant, line items, totals, category, dates from any receipt/invoice/email text. Uses your LLM if configured, falls back to a fully offline deterministic parser otherwise. |
| 📊 **Spend dashboard** | Monthly totals, category breakdown bars, and a plain-English *"what changed vs last month"* narrative. |
| 🖼️ **Shareable money card** | A redacted, on-device SVG card with your stats + a funny stat. The viral hook — no PII leaves your machine. |
| 🔪 **Subscription Killer** | Clusters recurring charges, annualizes the cost, and drafts a polite-but-firm cancellation email per subscription. |
| 🔐 **Warranty Vault** | Auto-creates warranty-expiry and return-window reminders and exports them to a `.ics` calendar. |
| ⚙️ **Background worker** | Periodically scans for reminders due soon and notifies you. |

> [!IMPORTANT]
> Adulting Copilot is **not** financial, legal, tax, or medical advice. Extracted amounts and
> dates are best-effort estimates - always verify against your original documents.

---

## 🚀 Quickstart (one command to run)

> Requires **Node.js 20+**. Everything is local; no account, no cloud.

```bash
# 1. Clone and install
git clone https://github.com/USER/adulting-copilot.git
cd adulting-copilot
npm install

# 2. (Optional) configure an LLM — skip this to run 100% offline
cp .env.example .env        # then paste a key into .env if you have one

# 3. Seed sample data + run the app
npm run seed                # loads /demo_assets into a local SQLite db
npm run dev                 # http://localhost:3000
```

Open **http://localhost:3000**, hit **"Use sample" → "Extract receipt"**, and watch the money
story appear. That's the whole loop.

### Running fully offline (no API key)

If you don't set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`, the app automatically uses the
built-in **deterministic parser** (regex + heuristics). No network calls, no keys, no problem.
The Settings page shows which engine is active.

---

## 🎬 Create the demo GIF (fully automated)

No manual screen recording. One command seeds data, builds the app, drives a real browser with
Playwright through the entire flow, and encodes a smooth looping GIF to `public/demo.gif`.

### 1. Install the recording prerequisites

```bash
# Chromium for Playwright (one-time)
npx playwright install chromium

# A GIF encoder — install ONE of these:
#   macOS:   brew install ffmpeg        (or: brew install gifski)
#   Ubuntu:  sudo apt-get install -y ffmpeg
#   Windows: winget install Gyan.FFmpeg (or: choco install ffmpeg)
```

### 2. Generate it

```bash
npm run demo:gif
```

This produces `public/demo.gif` **and** `assets/demo.gif`. The captured flow is ~15 seconds:
upload → extraction → dashboard → share card → subscription detection → cancellation draft →
warranty vault → `.ics` export.

> **Encoder notes.** The pipeline prefers `ffmpeg` (palette-based, highest quality) and falls
> back to `gifski` if `ffmpeg` isn't found. On Windows, commands run through the shell
> automatically. If neither encoder is on your `PATH`, the script tells you exactly what to install.

---

## 🧩 How it works

```
                 ┌──────────────────────────────────────────────┐
   receipt text  │  /api/upload                                  │
  ───────────────▶  parseReceipt()                               │
                 │   ├─ LLM adapter (Anthropic | OpenAI)         │
                 │   │    timeout + retries + JSON-schema check  │
                 │   └─ deterministic fallback (regex/heuristics)│
                 │  insertReceipt() ──▶ SQLite (local file)      │
                 │        └─ auto-creates warranty/return        │
                 │           reminders                            │
                 └───────────────┬──────────────────────────────┘
                                 │
        ┌────────────────────────┼─────────────────────────┐
        ▼                        ▼                          ▼
  /api/insights           /api/share-card             /api/export
  monthly spend,          redacted SVG card           .ics calendar
  subscriptions           (no PII, on-device)         (warranty + return)
```

**Stack:** Next.js 14 (App Router) · TypeScript · React 18 · better-sqlite3 · Zod ·
Playwright + ffmpeg (demo) · Vitest (tests) · Tailwind (theme tokens).

### Project layout

```
adulting-copilot/
├─ prompts/                 # versioned LLM prompt templates (+ tests)
│  └─ index.ts
├─ src/
│  ├─ app/
│  │  ├─ api/               # route handlers (upload, parse, insights, reminders,
│  │  │                     #   export, share-card, cancel-email, settings)
│  │  ├─ dashboard/         # spend dashboard + share card
│  │  ├─ subscriptions/     # subscription killer + cancellation drafts
│  │  ├─ vault/             # warranty vault + .ics export
│  │  ├─ settings/          # engine status + privacy
│  │  ├─ layout.tsx         # nav + theme
│  │  ├─ page.tsx           # upload (the "wow moment")
│  │  └─ globals.css        # forest + gold treasury theme
│  └─ lib/
│     ├─ parsers/heuristic.ts   # deterministic, offline parser
│     ├─ llm/{client,schema}.ts # adapters, timeout/retry, validation
│     ├─ db/index.ts            # SQLite + migrations
│     ├─ insights.ts            # monthly aggregation, subscription clustering
│     ├─ export.ts              # .ics + SVG share card (no network)
│     ├─ redact/index.ts        # PII redaction
│     ├─ jobs/worker.ts         # background reminder scanner
│     └─ types.ts               # shared domain types
├─ scripts/
│  ├─ seed.ts               # load demo_assets → db
│  ├─ demo-flow.ts          # Playwright capture flow
│  └─ make-demo-gif.ts      # seed → build → serve → record → encode GIF
├─ demo_assets/             # sample receipts/invoices/emails
├─ tests/                   # unit + integration (Vitest)
└─ .github/workflows/ci.yml # lint + typecheck + test
```

---

## 🔌 Configuration

Copy `.env.example` → `.env`. **All values are optional** — with none set, the app runs offline.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Enables Claude parsing (takes priority if set). |
| `OPENAI_API_KEY` | — | Enables OpenAI parsing (used if no Anthropic key). |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Override the Anthropic model. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Override the OpenAI model. |
| `LLM_TIMEOUT_MS` | `20000` | Per-call timeout. |
| `LLM_MAX_RETRIES` | `2` | Bounded retries with exponential backoff. |
| `DB_PATH` | `./data/adulting.db` | SQLite file location. |
| `NOTIFY_WINDOW_DAYS` | `7` | How far ahead the worker looks for due reminders. |

> [!WARNING]
> Never commit your `.env`. It's already in `.gitignore`. For CI/deployment, use repository
> secrets (see [Adding secrets](#3-add-llm-keys-as-repository-secrets-web-ui) below).

---

## 🧪 Quality

```bash
npm test          # Vitest unit + integration tests
npm run typecheck # tsc --noEmit
npm run lint      # eslint (next/core-web-vitals)
npm run format    # prettier --write
```

- **Unit tests** cover the deterministic parser, insights/subscription math, schema
  validation, redaction, and `.ics`/share-card generators.
- **Integration test** exercises the real parse → persist → analyze pipeline end-to-end
  against a temporary SQLite database, including auto-reminder creation.
- **CI** runs lint + typecheck + tests on every push and PR.

### Security basics

- File uploads are capped at **5 MB** and content-type checked.
- All LLM output is validated against a **Zod schema** before it touches the database.
- The deterministic fallback means a hostile/garbled LLM response can never crash a request.
- The share-card and `.ics` generators make **zero** network calls.
- PII (card numbers, emails, phones, order refs) is redacted before any share artifact.

---

## 📤 Push to GitHub

### Option A — Command line (recommended)

```bash
git init
git branch -M main
git add .
git commit -m "feat: Adulting Copilot — receipts, warranties, subscription killer"

# Create an EMPTY repo on github.com first (see Option B step 1), then:
git remote add origin https://github.com/USER/adulting-copilot.git
git push -u origin main
```

### Option B — GitHub website (UI)

**1. Create the repository**
   - Go to <https://github.com/new>.
   - **Repository name:** `adulting-copilot`.
   - Choose **Public** (for stars) or **Private**.
   - ❗ Leave **"Add a README file" OFF**, **".gitignore" None**, **"License" None** — this repo
     already includes all three, and adding them on the web creates a conflicting first commit.
   - Click **Create repository**.

**2. Connect your local repo and push**
   - On the new repo's page, copy the HTTPS URL under **"…or push an existing repository from the
     command line"**, then run the `git remote add` + `git push` commands from Option A.

   *Fallback (not ideal): upload via the web UI* — on the empty repo page click
   **"uploading an existing file"**, drag the project folder in, and commit. This loses commit
   history and can choke on large folders like `node_modules`, so prefer the CLI push.

### 3. Add LLM keys as repository secrets (Web UI)

So CI (and any future deployment) can use your keys without ever committing them:

   1. In your repo, go to **Settings → Secrets and variables → Actions**.
   2. Click **New repository secret**.
   3. Add each of these (names must match **exactly**):
      - **Name:** `ANTHROPIC_API_KEY` · **Secret:** your Anthropic key
      - **Name:** `OPENAI_API_KEY` · **Secret:** your OpenAI key
   4. Click **Add secret** for each.

   Locally, keep these in `.env` (never committed). The app reads `process.env` in both places.

---

## 🗺️ Roadmap ideas

- OCR for image/PDF receipts (currently text-based to stay dependency-light).
- iCloud/Google Calendar push instead of `.ics` download.
- "Negotiate this bill" drafts for utilities and insurance.

---

## 🤝 Contributing

PRs welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) and our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## 📄 License

[MIT](./LICENSE) © Contributors
