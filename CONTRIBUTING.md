# Contributing

New here? Do the [Hello World](README.md#hello-world-in-5-minutes) first; it gets the lab running in five minutes.

Thanks for helping. This lab exists so people can learn decision models by using them, so the best contributions make something clearer or let people try something new.

## Set up

You need Node 20.12 or newer and git. Python 3.10+ only if you want to run `examples/hello-world/hello.py`.

```bash
git clone https://github.com/shashikantdev3/decision-models-lab.git
cd decision-models-lab
npm install
npm run hello -- --mock     # Hello World, offline
npm test                    # unit tests, no network
npm run triage -- --mock    # the whole pipeline with offline stand-in models
npm run dev                 # the site at http://localhost:5173 (Mock mode works with no key)
```

For live calls, copy `.env.example` to `.env` and add your own keys. Use an OpenRouter key with a credit limit.

Before you open a pull request, run:

```bash
npm run check               # lint, typecheck, unit tests, site build
npm run test:e2e            # Playwright smoke and accessibility checks
```

## Branches and commits

- Branch from `main`: `feat/hindi-dataset`, `fix/score-legend`, `docs/limits`.
- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat: add HR requests dataset`, `fix(core): read score legend keys`, `docs: explain flip rate`.

## A good pull request

- Has tests for new logic. Metrics and policy code are pure functions; test them with plain arrays.
- Updates the docs it touches.
- Records a new run in `results/` if it changes behaviour that results depend on, and says so.
- Stays small. Two small pull requests review faster than one large one.

## Rules

- **No real data.** No real people, customers, companies or employer data. Personal data in tickets must be obviously fake: `@example.com` addresses, `555-01xx` phone numbers, invented names.
- **No keys.** Never commit a key, paste one in an issue, or put one in the site. CI runs gitleaks.
- **No unsourced vendor numbers.** Speed, price or accuracy figures from a vendor need a link and the word "claim".
- **Plain English.** Short sentences, no marketing words, no em dashes.

## Proposing a model or dataset

Open an issue with the **New model or adapter** or **New dataset** template. The templates ask for what we need to review it. For a model on the OpenRouter Decisions API or Claude, the change is usually one entry in `config/models.json` and one in `config/pricing.json`; see `docs/09-extending.md`.

## Review

The maintainer aims to reply to issues and pull requests within a week. Reviews check correctness first, then clarity, then style. If something is unclear, ask in the issue before writing a lot of code.

By contributing you agree that your work is released under the MIT licence, and datasets under CC BY 4.0.
