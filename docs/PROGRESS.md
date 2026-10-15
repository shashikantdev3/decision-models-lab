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

1. Done: keys confirmed, first live calls made, fixtures saved.
2. Done: `docs/03-hello-world.md` filled in.
3. Done: cross-check run and disagreements resolved.
4. Done: bench recorded, about $0.37 in total.
5. Done: triage and wording recorded. Total live spend so far about $1.02 (cross-check $0.17, bench $0.37, triage $0.31 plus an estimated $0.16 for the first attempt that stopped on a token limit after about 25 tickets, wording $0.01).
6. Turn on Pages (Settings > Pages > Source: GitHub Actions), then run the Pages workflow.

## Open questions


- Region string for result files.
