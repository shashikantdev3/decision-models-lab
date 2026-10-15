# Dataset card: Contoso support tickets v1

## Purpose

48 fictional support tickets for Contoso, a fictional SaaS company, used to teach and test decision models on a triage task. It is a teaching set, not a benchmark.

## Files

| File                 | What it is                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| `tickets.jsonl`      | One ticket per line: `id`, `channel`, `subject`, `body`, `labels`, `difficulty`, `notes`, `labelStatus` |
| `specs.v1.json`      | The planned labels for every ticket, written before any ticket text (`npm run data:plan`)               |
| `questions.v1.json`  | The triage and verification questions, with instructions and criteria                                   |
| `rewordings.v1.json` | Three rewordings of each triage question, same answer keys, for the wording test                        |
| `review.csv`         | Tickets where the planned label and a blind label disagree, for the owner to resolve                    |
| `label-status.json`  | Written by the cross-check and merge scripts: dates, model, agreement rate                              |

## Labels

| Label                    | Values                               | Meaning                                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `team`                   | payments, auth, infra, data, account | The team that should own the first fix. Definitions in `questions.v1.json`.                                                                                                                                                                     |
| `urgency`                | Low, Normal, High, Critical          | Low: question or cosmetic. Normal: real problem for one customer or with a workaround. High: important function broken or a security concern. Critical: service or core function down for many, data at risk, or a security incident under way. |
| `customer_blocked`       | true, false                          | The customer cannot carry on with the work the ticket is about.                                                                                                                                                                                 |
| `contains_personal_data` | true, false                          | The text contains an email address, phone number, postal address, card digits, date of birth or a person's full name. A first name alone, a company name or a VAT number does not count.                                                        |
| `difficulty`             | clear, ambiguous, adversarial        | How hard the ticket is meant to be.                                                                                                                                                                                                             |

Mix: 29 clear (60%), 12 ambiguous (25%), 7 adversarial (15%). Planned: 10, 10, 10, 9, 9 tickets per team and 12 per urgency level. After review: auth 11, payments 10, infra 10, data 9, account 8; urgency Low 12, Normal 11, High 13, Critical 12; customer blocked 22 of 48; personal data 18 of 48. Ambiguous tickets could belong to two teams or have vague urgency. Adversarial tickets use sarcasm, urgent words in the subject only, another team's vocabulary, or calm wording for something serious.

## How it was made: labels by construction

1. `scripts/plan-tickets.ts` wrote a spec for each ticket (labels, difficulty, a twist for hard ones), spread evenly across teams and urgency levels, from a fixed seed.
2. Each ticket was written from its spec, so the correct answer existed before the text. The v1 tickets were written by Claude (Opus 5.5) during the build. `scripts/draft-tickets.ts` reproduces this step through the API for new datasets.
3. `scripts/crosscheck-labels.ts` asked Claude Sonnet 5.5, which never saw the specs, to label every ticket blind. Agreements were accepted.
4. The owner resolved the 12 disagreements in `review.csv` (kept out of git), and `scripts/merge-review.ts` merged them back.

| Field | Value |
|---|---|
| Cross-check date | 2026-10-16 (IST) |
| Cross-check model | `claude-sonnet-5-5` |
| Tickets where all four labels agreed | 37 of 48 (77%) |
| Fields that agreed | 180 of 192 (93.8%) |
| Disagreements reviewed by the owner | 12, across 11 tickets |
| Owner review date | 2026-10-16 (IST) |

Outcome of the review: the planned label stood in 7 cases and the blind label was taken in 5. T-040 (account owner changed overnight) moved from account to auth as an account takeover. T-043 (intermittent 502s, retries work) moved to not blocked; its text had contradicted its planned label, an authoring error. T-017, T-042 and T-046 took the blind urgency. No ticket was marked for rewriting.

T-019's first blind answer omitted two fields (see `docs/DECISIONS.md`); it was asked again and then agreed on all four. Every ticket now carries `labelStatus` `agreed` (37) or `owner-reviewed` (11).

## Known biases and limits

- **Written by Claude, checked by Claude, so possibly easier for Claude.** Claude Opus wrote the tickets and Claude Sonnet cross-checked them; Claude as a decider may find them easier than the decision models do. Keep this in mind when comparing.
- **One reviewer.** Only the disagreements were reviewed by a person, and by one person.
- **Small.** 48 tickets. A one-ticket difference is about two points of accuracy. Treat differences under five points as noise.
- **One domain, one language, one labeller's definitions.** Results do not transfer to other domains without new labelled data.
- **Short.** Every ticket is well under 4 KB, so Jev never enters its long-context mode and Decision-1's 33K limit is never hit.

## Personal data

All personal data is invented: `@example.com` addresses, `555-01xx` and `+44 7700 900xxx` phone numbers, invented names and order numbers. `npm run data:validate` fails if an email does not end in `@example.com`.

## Licence

CC BY 4.0. Credit "Decision Models Lab, Contoso support tickets v1".
