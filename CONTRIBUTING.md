# Contributing to Adulting Copilot

Thanks for your interest in improving Adulting Copilot! This project aims to make the boring
parts of adulting effortless while keeping everything **local-first and private**.

## Getting started

```bash
git clone https://github.com/USER/adulting-copilot.git
cd adulting-copilot
npm install
cp .env.example .env     # optional — runs offline without keys
npm run seed
npm run dev
```

## Before you open a PR

Please make sure all checks pass locally:

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm test            # vitest unit + integration
```

CI runs these on every push and pull request; PRs must be green to merge.

## Project principles

1. **Local-first & private.** No telemetry. The only outbound network call is to the LLM the
   user explicitly configures. Never add analytics, trackers, or "phone home" behavior.
2. **Graceful degradation.** Every LLM path must have a deterministic fallback. A bad or slow
   model response should never crash a request — validate with Zod, then fall back.
3. **No guarantees.** This is not financial/legal/medical advice. Keep disclaimers intact.
4. **Tests for logic.** New parsing rules, insights, or generators need unit tests. Pure
   functions are preferred precisely because they're easy to test.

## Good first issues

- Add a new merchant → category mapping in `src/lib/parsers/heuristic.ts`.
- Add a new sample receipt in `demo_assets/` for a category we don't cover yet.
- Improve a prompt template in `prompts/index.ts` (and update `tests/unit/prompts.test.ts`).

## Commit style

Conventional commits are appreciated but not required:
`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.

## Code style

Prettier + ESLint enforce formatting. Run `npm run format` before committing.

By contributing, you agree your contributions are licensed under the project's MIT license.
