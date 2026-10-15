# Hello World

Clone the lab, add an OpenRouter key, run it. About five minutes.

1. **Key.** Sign up at [openrouter.ai](https://openrouter.ai), add credit ($5 is more than enough; one run costs about $0.00003), and create a key with a credit limit at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys). One key covers both models.
2. **Clone and install.**

   ```bash
   git clone https://github.com/shashikantdev3/decision-models-lab.git
   cd decision-models-lab
   npm install
   cp .env.example .env          # PowerShell: Copy-Item .env.example .env
   ```

   Set `OPENROUTER_API_KEY=sk-or-v1-...` in `.env`. Git ignores it.
3. **Run.**

   ```bash
   npm run hello                          # one real request to each model
   npm run hello -- --model decision-1    # one model
   npm run hello -- --verbose             # also print the request and the raw JSON
   ```

4. **Open the lab.** `npm run dev` serves the site at http://localhost:5173 and reads the key from `.env`, so Live mode works without pasting it. Only the local dev server reads `.env`; builds never include a key, and CI checks `site/dist` for anything that looks like one.

The request is in `packages/cli/src/hello.ts`: one ticket and three questions, a yes/no (`urgent`), a choice (`team`) and a scale (`severity`). Change the ticket or the options and run it again to see the probabilities move.

## Without credit

`npm run hello -- --mock` makes no call and needs no key. It replays the newest live response saved in `packages/core/test/fixtures/` for each model and labels it as recorded. `npm test`, `npm run triage -- --mock` and the site's Replay and Mock modes also run offline.

## One-file examples

For people who want one call before cloning, `examples/hello-world/` has the same request with nothing to install:

| File | Run |
|---|---|
| `hello.ps1` | `powershell -ExecutionPolicy Bypass -File examples/hello-world/hello.ps1 [-Model id] [-Raw]` |
| `curl.sh` | `./examples/hello-world/curl.sh [model]` (prints raw JSON) |
| `hello.py` | `python examples/hello-world/hello.py [model] [--raw]` |
| `hello.mjs` | `node examples/hello-world/hello.mjs [model] [--raw]` |
| `hello.ts` | `npx tsx examples/hello-world/hello.ts [model]` (uses this repo's core library) |

All of them read `OPENROUTER_API_KEY` from the environment and print the same six lines.

`npm run hello -- --save-fixture` saves each live response to `packages/core/test/fixtures/live.<model>.<date>.json`. The tests parse every fixture in that folder, and offline Hello World replays the newest one.

## Milestone 0 results (first live calls, 2026-10-16 IST, from Noida, India)

Same request body to both models; only the model id changed. Fixtures: `packages/core/test/fixtures/live.jev.2026-10-15.json` and `live.decision-1.2026-10-15.json` (file dates are UTC).

| | TypeSafe Jev 1.14 | Microsoft Decision-1 |
|---|---|---|
| Served as | `typesafe/jev-1.14-20261014` (provider TypeSafe) | `microsoft/microsoft-decision-1-20261009` (provider Azure) |
| Accepts the identical request | Yes | Yes |
| urgent (noul) | 0.95 | 0.9996 |
| team (choice) | payments 0.97, infra 0.03, auth 0; confidence 0.95 | payments 0.62, infra 0.38, auth 0.003; confidence 0.43 |
| severity (score) | 2.98, Critical 0.99 | 2.98, Critical 0.98 |
| Input tokens | 438 | 132 |
| Output tokens | 68 | 3 |
| Cost (`usage.cost`) | $0.0000184 | $0.0000055 |
| Latency (one cold call, client side) | 1,086 ms | 730 ms |

What this tells us:

- **Response shape matches the documented one.** The parser needed no change and every test passes with the live fixtures.
- **Only input tokens are billed.** Both costs equal input tokens x $0.042 per million exactly, even though Jev reported 68 output tokens.
- **The same text costs about 3.3 times more input tokens on Jev** (438 against 132). The tokenisers or the way each provider counts the question text differ.
- **`confidence` is not the top probability.** Decision-1 put 0.62 on payments but reported confidence 0.43; Jev put 0.97 and reported 0.95. Confidence measures how concentrated the whole distribution is, so the same threshold means different things on different models. Tune `T` per model.
- **Jev rounds probabilities to two decimals; Decision-1 returns full precision.** This limits how finely Jev's calibration can be read.
- **Browser calls (CORS):** allowed. A preflight on 2026-10-15 returned 204 with `access-control-allow-origin: *`.
- **Latency is one cold call each.** Treat it as a smoke test, not a measurement; the bench reports p50 and p95 after warm-up.
