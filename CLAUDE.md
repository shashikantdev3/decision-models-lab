# Working on this repo

Read `BUILD_PLAN.md` (kept locally, not committed) and `docs/PROGRESS.md` before changing anything. `docs/DECISIONS.md` logs every place where reality differed from the plan.

## Ground rules

1. Fictional data only. No company, customer or employer data of any kind. The demo company is Contoso.
2. Never commit an API key. Never ship a key inside the website. Never print a key.
3. Not affiliated with TypeSafe, Microsoft or Anthropic. The README footer says so.
4. Plain, clear English that reads as written by a senior engineer. No marketing filler, no emoji walls, no em dashes.
5. Every number on the site or in the README must come from a run recorded in `results/`, with the date and model versions next to it. Vendor claims are labelled as vendor claims. Mock output never goes into `results/`.

## Stop and ask the owner before

1. The first push to GitHub (never create, rename or change the visibility of a repository).
2. The first live API call (confirm keys are in `.env` and the OpenRouter key has a credit limit).
3. Any live run that costs more than $1 by the CLI's estimate.
4. Publishing accuracy numbers (the owner must have resolved `data/review.csv`).
5. Enabling GitHub Pages.

## Always

- Build and test offline first with `--mock` and fixtures; go live only to confirm behaviour and record results.
- If a live response differs from the plan, trust the live response, update types and fixtures, and log it in `docs/DECISIONS.md`.
- Run `npm run check` before every commit. Small commits, Conventional Commit messages.
- Look at what you build: `npm run screenshots`, then review against the strip-board identity in `docs/08-architecture.md`.
- Keep `docs/PROGRESS.md` current.
- Keys live in `.env` only. Do not export `ANTHROPIC_API_KEY` in the shell profile.

## Commands

```
npm install
npm test                 # unit tests, offline
npm run triage -- --mock # whole pipeline, offline
npm run dev              # site on http://localhost:5173
npm run check            # lint, typecheck, tests, build
npm run test:e2e         # Playwright smoke + axe
npm run screenshots      # docs/screenshots/*
```
