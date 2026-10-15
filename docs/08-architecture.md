# Architecture

## Folders

```
config/            models.json (selectable models), pricing.json (dated prices), policy.json (default thresholds)
data/              tickets, question set, rewordings, dataset card
packages/core/     types, adapters, escalation policy, pipeline, metrics. Runs in Node and the browser.
packages/cli/      hello, bench, triage, wording
scripts/           dataset plan, draft, cross-check, merge, validate
site/              Vite + React site, deployed to GitHub Pages
results/<date>/    recorded runs (committed; they power Replay mode)
examples/          Hello World in curl, Python and TypeScript
```

## Core library

- `types.ts`: `Question`, `DecisionRequest`, `Answer`, `DecisionResult`, `DecisionModel`, `Writer`, `Ticket`, `TriageRecord`.
- `adapters/openrouter.ts`: `OpenRouterDecisions`, one class for Jev and Decision-1. Posts to `/api/alpha/decisions`, measures latency client side, normalises answers.
- `adapters/normalize.ts`: turns the provider's answer shapes into one `Answer` shape with probabilities keyed by option label.
- `adapters/claudeDecider.ts`: Claude answering the same typed questions with written probabilities, for comparison.
- `adapters/claudeWriter.ts`: the System Two step.
- `adapters/mock.ts`: `MockDecider` and `MockWriter`, offline stand-ins with seeded noise. Mock output is always flagged and never written to `results/`.
- `registry.ts`: builds models from `config/models.json`.
- `policy/escalation.ts`: `route()` and `checkDraft()`, pure functions.
- `pipeline/triage.ts`: `runTriage()` and `rerouteQueue()`.
- `metrics/`: accuracy, macro-F1, MAE, percentiles, Brier, ECE, reliability bins, coverage curve, flip rate, probability shift, and `summarizeBench()`.

The core uses only `fetch` and `performance.now()`, so the same adapters run in the CLI and the site.

## Run modes on the site

| Mode                                    | Data                                                                        | Cost         |
| --------------------------------------- | --------------------------------------------------------------------------- | ------------ |
| Replay (default once a run is recorded) | Files in `results/`, bundled at build time                                  | Free, no key |
| Live                                    | The visitor's own keys, held in React state only, sent only to the provider | Visitor pays |
| Mock                                    | Mock models running in the browser, with a Mock badge everywhere            | Free         |

OpenRouter's Decisions API allows direct browser calls (CORS checked on 2026-10-15), and Anthropic allows them with the `anthropic-dangerous-direct-browser-access` header, so no proxy is needed.

## Visual identity: the strip board

Air traffic controllers track each flight on a paper strip. Printed fields carry the facts, strips move between bays as the flight is handed on, and a senior controller writes notes in pencil. Here each ticket is a strip, the decision model prints its calls into the fields, confident strips drop into a team's bay, unsure strips go to Claude's desk, and Claude's reasoning appears as a pencil note.

| Token               | Light     | Dark      | Use                              |
| ------------------- | --------- | --------- | -------------------------------- |
| `--console`         | `#D6DCD4` | `#222B28` | Page background                  |
| `--manila`          | `#EEE0B2` | `#4E4730` | Incoming strip                   |
| `--routed`          | `#CADCE7` | `#34444F` | Auto-routed strip                |
| `--escalated`       | `#EDC6BC` | `#54393A` | Strip on Claude's desk           |
| `--ink`             | `#1D2A3F` | `#ECE6D3` | Text and rules                   |
| `--pencil-red`      | `#A3312A` | `#E0796F` | Bands, borders, warnings         |
| `--pencil-red-text` | `#8E2A24` | `#F3A39B` | Red text on strips (AA contrast) |

Type: B612 for the interface, B612 Mono for every number and printed field, Kalam only for Claude's pencil notes. All tokens are in `site/src/styles/tokens.css`.

Motion: one orchestrated moment on the home page (six strips at their recorded speeds, one pulled to Claude's desk), then motion only in answer to the visitor (the threshold slider slides strips between bays). Reduced motion shows the final state.
