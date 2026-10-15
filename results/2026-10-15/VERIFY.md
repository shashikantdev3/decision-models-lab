# Verification for 2026-10-15

## All checks passed

## Passed
- TypeSafe Jev 1.14: 144 of 144 calls have an answer for every question.
- TypeSafe Jev 1.14: 0 answers whose probabilities do not sum to about 1.
- TypeSafe Jev 1.14: 0 calls with a negative or missing cost.
- TypeSafe Jev 1.14: per-call costs add up to the reported total ($0.004657).
- TypeSafe Jev 1.14: mock flag is false.
- Microsoft Decision-1: 144 of 144 calls have an answer for every question.
- Microsoft Decision-1: 0 answers whose probabilities do not sum to about 1.
- Microsoft Decision-1: 0 calls with a negative or missing cost.
- Microsoft Decision-1: per-call costs add up to the reported total ($0.002683).
- Microsoft Decision-1: mock flag is false.
- Claude Haiku 4.5 (as decider): 144 of 144 calls have an answer for every question.
- Claude Haiku 4.5 (as decider): 0 answers whose probabilities do not sum to about 1.
- Claude Haiku 4.5 (as decider): 0 calls with a negative or missing cost.
- Claude Haiku 4.5 (as decider): per-call costs add up to the reported total ($0.3561).
- Claude Haiku 4.5 (as decider): mock flag is false.
- OpenRouter account usage moved by $0.000000; summed usage.cost of new calls is $0.000000.

Generated 2026-10-15T18:56:08.088Z by npm run bench. Spent on new calls in this process: $0.3511.

## Note added after the run

The bench process was stopped once part way through (the shell that started it closed) and was restarted. The restart reused every cached Jev and Decision-1 response, so the account check above compares two zeros and proves nothing. A direct read of the OpenRouter key straight after the run showed `usage: 0` against a $2 limit, while the summed `usage.cost` of the Jev and Decision-1 calls (pilot, warm-up and runs) is about $0.0075. Either the account total lags or the Decisions API is not yet counted in key usage. Recheck the key's usage on openrouter.ai before quoting account-level spend. Per-call `usage.cost` values are as returned by the API.
