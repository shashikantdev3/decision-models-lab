# Progress

Updated 2026-10-15.

| Milestone             | Status            | Notes                                                                                                                                                                                             |
| --------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Spike              | Partly done       | Model ids, context sizes, prices, response shape (from docs) and CORS checked without a key. **Waiting for the owner's go for the first live call.**                                              |
| M1 Core and Mock mode | Done              | 41 unit tests pass offline. `npm run triage -- --mock` runs the whole pipeline. Live contract tests exist behind `LIVE=1`.                                                                        |
| M2 Dataset            | Waiting on owner  | 48 tickets, question set v1, rewordings v1 and the dataset card are in. Cross-check (`npm run data:crosscheck`, about $0.20 with Sonnet) and the owner's review of `data/review.csv` are pending. |
| M3 Bench and results  | Code done         | `bench`, `triage`, `wording` with pilot, cache, resume, budget cap and VERIFY.md, tested in Mock mode. No live results yet.                                                                       |
| M4 Site               | Done in Mock mode | Six pages, both themes, phone layout, axe smoke tests pass. Replay mode lights up once `results/` has a run. Pages deploy is manual until the owner enables it.                                   |
| M5 Docs               | Mostly done       | README, docs 01 to 11, CONTRIBUTING, templates. Demo GIF and social preview image need a recorded run.                                                                                            |
| M6 Share              | Not started       | Owner's video and LinkedIn post.                                                                                                                                                                  |

## Next steps for the owner

1. Check `.env` has both keys and the OpenRouter key has a credit limit, then say go for the first live call.
2. `npm run hello -- --model jev,decision-1 --save-fixture` (about $0.00002). Fill in `docs/03-hello-world.md`.
3. `npm run data:crosscheck -- --model claude-sonnet`, then resolve `data/review.csv` and `npm run data:merge`.
4. `npm run bench -- --models jev,decision-1,claude-haiku --region "India (Noida)"` (estimate printed first; about $0.25 for the Claude part).
5. `npm run triage -- --decider decision-1 --writer claude-sonnet --draft-all` and `npm run wording -- --model jev` and `-- --model decision-1`.
6. Turn on Pages (Settings > Pages > Source: GitHub Actions), then run the Pages workflow.

## Open questions

- Does Decision-1 accept the identical request body as Jev? Expected yes; confirm in M0.
- Region string for result files.
