# Thresholds and escalation

## The policy

Defaults live in `config/policy.json`; the site and CLI let you change each one.

| Rule                                                           | Default   | Why                                                                                      |
| -------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| Escalate when `team.confidence` is below `T`                   | `T = 0.8` | The model is not sure who owns it                                                        |
| Escalate when P(urgency = Critical) is above a value           | 0.35      | A likely critical ticket should always get a careful look, even when the team is obvious |
| Escalate when P(contains personal data) is between 0.2 and 0.8 | band      | Unclear personal data needs a careful reply                                              |
| Otherwise auto-route                                           |           |                                                                                          |

`route()` is a pure function with no I/O, unit tested in `packages/core/test/policy.test.ts`.

## What confidence means

`confidence` describes how concentrated the answer distribution is. It does not say the answer is right. A model can be confidently wrong, and two models can mean different things by 0.9.

It becomes useful only after you check it on labelled data: of the answers given at about 0.9, how many were right? That is the reliability diagram on the Results page and the ECE number in every result file.

## Choosing T

Do not pick a round number. Pick from costs:

- A wrong auto-route costs a misrouted ticket, a delay, an annoyed customer.
- An escalation costs a Claude call (about 100 times a decision call) and some seconds.

The coverage-versus-accuracy curve in each bench result shows, for every T from 0.50 to 0.99, the share of tickets handled automatically and the accuracy on those. Pick the lowest T whose accuracy you can live with. Re-tune it whenever the model version changes; that is why the ids are pinned.

## Moving the slider without new calls

`rerouteQueue()` re-applies a policy to recorded decisions. The probabilities do not change, only where the line sits, so the Triage Desk slider is instant and free. A ticket that newly crosses into escalation but has no recorded Claude draft is counted at the average recorded Claude cost; record with `npm run triage -- --draft-all` to have a draft for every ticket.
