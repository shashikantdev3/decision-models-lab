# Question types

Every question has a `type`, `instructions` and `criteria`. All questions in one request are answered in parallel and cannot see each other's answers.

## noul: yes or no

```json
"customer_blocked": {
  "type": "noul",
  "instructions": "Is the customer unable to carry on with the work this ticket is about?",
  "criteria": { "true": "They cannot do the task at all and have no workaround", "false": "They can still work or are only asking" }
}
```

Response: `{ "type": "noul", "noul": 0.93 }`, the probability of yes. A value near 0.5 means a coin flip, not "medium".

## choice: pick one option

```json
"team": {
  "type": "choice",
  "instructions": "Which Contoso team should own the first fix for this ticket?",
  "criteria": { "payments": "Checkout, invoices...", "auth": "Signing in, MFA...", "infra": "Outages..." }
}
```

Response: `{ "type": "choice", "choice": "payments", "confidence": 0.91, "probabilities": { "payments": 0.94, "auth": 0.01, "infra": 0.05 } }`. `confidence` summarises how concentrated the distribution is.

## score: a place on an ordered scale

```json
"urgency": {
  "type": "score",
  "instructions": "How urgent is this ticket?",
  "criteria": ["Low", "Normal", "High", "Critical"]
}
```

Response: `{ "type": "score", "score": 2.87, "confidence": 0.84, "probabilities": { "0": 0.0, "1": 0.02, "2": 0.09, "3": 0.89 }, "legend": { "0": "Low", ... } }`. Keys are 0-based positions in your criteria list; `score` is the probability-weighted position. The core library re-keys the probabilities by label for you.

## box: locate something in an image

Jev 1.14 only, an early feature, and it runs in the slower long-context mode. Out of scope for this lab today; adding it is a good first issue.

## Writing good questions

- Make the options cover every case, or add an "other" option.
- Put the definition in the criteria, not just a label. "auth: Signing in, MFA, SSO, API keys" beats "auth".
- Do not write a question that depends on another question's answer; they cannot see each other.
- Test the wording. Three rewordings of each triage question live in `data/rewordings.v1.json`.

Next: [03-hello-world.md](03-hello-world.md).
