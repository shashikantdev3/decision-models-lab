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

## What Milestone 0 must confirm

| Question                                      | Status                                                                                                                                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact response shape                          | Documented shape confirmed from the OpenRouter API reference on 2026-10-15 and coded in `packages/core/src/adapters/normalize.ts`. **Not yet confirmed against a live call.**                                 |
| Does Decision-1 accept the identical request? | Not yet tested live.                                                                                                                                                                                          |
| Do browser calls work (CORS)?                 | **Yes.** A preflight to `/api/alpha/decisions` on 2026-10-15 returned 204 with `access-control-allow-origin: *` and allows `Authorization`, `Content-Type`, `HTTP-Referer` and `X-Title`. No proxy is needed. |
| Error shape without a key                     | `401 {"error":{"message":"No cookie auth credentials found","code":401}}`, observed 2026-10-15.                                                                                                               |
| Observed latency                              | Not yet measured.                                                                                                                                                                                             |
| Cost per call                                 | Not yet measured. Estimate: about 200 input tokens at $0.042 per million, about $0.0000085.                                                                                                                   |

Fill in the rest after the first live run and update `docs/DECISIONS.md` if anything differs.
