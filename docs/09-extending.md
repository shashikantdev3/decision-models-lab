# Extending the lab

## Add a model on an existing API

1. Add an entry to `config/models.json` under `deciders` (and `writers` for a Claude model):

```json
{
  "key": "jev-1-15",
  "id": "typesafe/jev-1.15",
  "label": "TypeSafe Jev 1.15",
  "kind": "decision",
  "adapter": "openrouter-decisions",
  "provider": "openrouter",
  "contextTokens": 262144,
  "questionTypes": ["noul", "choice", "score"],
  "color": "jev"
}
```

2. Add its price to `config/pricing.json` with `checked` and `source`.
3. `npm run hello -- --model jev-1-15 --save-fixture` and commit the fixture.
4. `npm run bench -- --models jev-1-15`.

The site picks the model up from the config automatically.

## Add a model on a new API

Write one adapter in `packages/core/src/adapters/` that implements `DecisionModel`:

```ts
export class MyDecider implements DecisionModel {
  readonly id: string;
  readonly label: string;
  readonly kind = "decision" as const;
  constructor(private opts: { apiKey: string; modelId: string }) {
    this.id = opts.modelId;
    this.label = opts.modelId;
  }
  async decide(req: DecisionRequest): Promise<DecisionResult> {
    const started = now();
    // call the API, then map each answer with noulAnswer / choiceAnswer / scoreAnswer
    return { modelId: this.id, answers, latencyMs: now() - started, usage, raw };
  }
}
```

Add a new `adapter` value to the switch in `registry.ts`, a test with a saved response in `packages/core/test/`, and a config entry.

## Add a question type

1. Extend `QuestionType` in `types.ts`.
2. Map it in `normalizeProviderAnswer()` and in `ClaudeDecider`'s schema builder.
3. Add a widget on the Learn page and a form option in the Playground.

## Add a dataset

Same JSONL shape as `data/tickets.jsonl`, plus a dataset card. Run `npm run data:validate`, then `npm run bench -- --dataset data/your-file.jsonl`. If your labels differ from the triage labels, add a question set too.

## Add a metric or chart

Pure function in `packages/core/src/metrics/` with a unit test, then add it to `summarizeBench()` and draw it in `site/src/pages/Results.tsx`.
