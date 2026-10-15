# Reusing the core library

`packages/core` has no dependencies and runs in Node 20+ and modern browsers.

```ts
import {
  OpenRouterDecisions,
  ClaudeWriter,
  route,
  defaultPolicy,
  runTriage,
  summarizeBench,
} from "@decision-models-lab/core";

const decider = new OpenRouterDecisions({
  apiKey: process.env.OPENROUTER_API_KEY!,
  modelId: "microsoft/microsoft-decision-1-20261009",
});

const result = await decider.decide({
  context: ["Subject: Refund not received", "Message: I was charged twice for order 1042."],
  questions: {
    team: {
      type: "choice",
      instructions: "Which team owns this?",
      criteria: { billing: "Charges and refunds", shipping: "Delivery" },
    },
  },
});

const decision = route(result, { ...defaultPolicy, teamConfidenceThreshold: 0.85 });
if (decision.action === "escalate") {
  // hand it to a person or an LLM
}
```

## Patterns worth copying

- **Decision model first, LLM on low confidence, decision model to check the LLM.** `runTriage()` is about 40 lines; read it and adapt it.
- **Re-route without new calls.** Store the probabilities and re-apply the policy when you change a threshold (`rerouteQueue()`).
- **Measure before you trust a threshold.** Put your labelled data in the ticket JSONL shape and run `npm run bench`; the coverage curve tells you what each threshold buys.

The package is not published to npm yet. Until it is, copy `packages/core/src` or add this repo as a git dependency.
