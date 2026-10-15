# Hello World

One request with a noul, a choice and a score question, sent to both decision models. Only the model id changes.

## curl

```bash
OPENROUTER_API_KEY=sk-or-... ./examples/hello-world/curl.sh typesafe/jev-1.14
OPENROUTER_API_KEY=sk-or-... ./examples/hello-world/curl.sh microsoft/microsoft-decision-1-20261009
```

## Python (standard library only)

```bash
OPENROUTER_API_KEY=sk-or-... python examples/hello-world/hello.py microsoft/microsoft-decision-1-20261009
```

## TypeScript (this repo's core library)

```bash
npm run hello -- --model jev,decision-1          # reads .env
npm run hello -- --mock                          # offline, no key
npx tsx examples/hello-world/hello.ts typesafe/jev-1.14
```

`npm run hello -- --model jev,decision-1 --save-fixture` saves each live response to `packages/core/test/fixtures/live.<model>.<date>.json`. The tests parse every fixture in that folder, so a response shape change fails the build.

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
