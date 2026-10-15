# Results methodology

The site and README may only show numbers produced this way. Every result file stamps the date, model ids, the model string each provider says it served, question set version, dataset version and hash, label status, run count, region and git commit.

Result folders and `date` fields use the UTC date; `createdAt` is a full UTC timestamp.

## Protocol

- **Calls.** 48 tickets x 4 questions, one decision call per ticket. Each model runs the full set 3 times (144 calls per model).
- **Pilot.** The first 5 tickets on every model, checking that responses parse, probabilities sum to 1 and the cost per call is close to the estimate. Pilot calls are cached and reused by run 1.
- **Warm-up.** 3 calls per model before the measured runs, excluded from all metrics.
- **Accuracy.** Each answer's top option against the label in `data/tickets.jsonl`. Accuracy per question, macro-F1 for `team`, mean absolute error for `urgency` (score position against the label's index). Mean across the 3 runs, with min and max.
- **Cost.** Sum of `usage.cost` (for Claude: tokens x `config/pricing.json`), divided by calls, reported per call, per 100 and per 1,000 decisions. One decision = one call answering four questions.
- **Latency.** Measured in the client from request sent to response parsed. p50 and p95 (nearest rank). Cached calls keep their original measurement.
- **Calibration.** Every top answer's stated probability against whether it was right: Brier (yes/no questions, and multi-class for team), ECE over 10 bins, and the reliability bins.
- **Escalation curve.** For thresholds 0.50 to 0.99, the share of tickets whose team confidence is at or above the threshold, and team accuracy on those.
- **Wording.** Each question in its original wording and 3 rewordings; flip rate and mean probability shift.
- **Claude as decider.** Same questions and tickets through `ClaudeDecider` at temperature 0 (or the model default if a model rejects the temperature parameter; the adapter retries without it).

## Safeguards

- **Cache.** Every live response is stored in `.cache/responses/`, keyed by a hash of model, run and request. A rerun after a crash never pays twice. `--fresh` ignores it.
- **Budget.** `--max-usd` (default 2.00) stops a run before it can spend more. The CLI prints the estimate and asks before any run over 10 tickets unless `--yes` is passed.
- **Retries.** Rate limits and provider errors back off exponentially, up to 4 retries.
- **VERIFY.md.** Written next to every run: every call answered, probabilities sum to about 1, costs non-negative and add up, the OpenRouter account's usage moved by about the summed `usage.cost`, no mock data, and the dataset's label status. Problems are listed at the top.

## Labels

Accuracy means something only if the labels are right. See `data/README.md`. Until the cross-check and the owner's review are done, every page that shows accuracy says "labels machine-made, not cross-checked or human-reviewed yet".

## What these results are not

One dataset of 48 fictional tickets, measured from one region. They teach how the models behave on this task. They are not a general benchmark, and a difference of a few points is within the noise of a dataset this small.
