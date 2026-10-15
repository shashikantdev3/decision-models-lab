# What are decision models?

A decision model does not write text. You give it some context and a set of typed questions, and it returns a probability for every allowed answer, in one pass.

Two are available through OpenRouter's Decisions API as of October 2026:

| Model                | Pinned id                                 | Context        | Notes                                                                                                                                                                |
| -------------------- | ----------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeSafe Jev 1.14    | `typesafe/jev-1.14`                       | 262,144 tokens | Text over about 32,000 bytes, and all image requests, run in a long-context mode TypeSafe says is slower and less accurate. Also supports `box` questions on images. |
| Microsoft Decision-1 | `microsoft/microsoft-decision-1-20261009` | 32,768 tokens  | Post-trained from Qwen3.5-9B, released 9 October 2026, served by Azure through OpenRouter. Text only.                                                                |

Both were listed at $0.042 per million input tokens on 15 October 2026, with output free. See `config/pricing.json` for the source links.

## How it differs from a chat model

|                              | Chat model       | Decision model                                    |
| ---------------------------- | ---------------- | ------------------------------------------------- |
| Output                       | Prose you parse  | A probability per allowed answer                  |
| Output tokens                | Tens to hundreds | About 0 to 2                                      |
| Cost                         | Input and output | Input only                                        |
| Answers outside your options | Possible         | Not possible: it only scores the options you gave |
| Explains itself              | Yes              | No                                                |

## When to use one

Use a decision model when the question has a fixed set of answers and you need the answer quickly, cheaply and often: routing, prioritising, flagging, checking another model's output. Keep a reasoning model for the cases where you need an explanation, a draft, or judgement on something the fixed answers do not cover.

## Where they break

- They only answer what you ask. A badly worded question gets a confident answer to the wrong question.
- Wording matters. Microsoft's own docs warn that results can change with question wording; run `npm run wording` to measure it on your data.
- Confidence is not correctness. Check calibration on labelled data before you trust a threshold.

Vendors describe these models as fast and unable to hallucinate an answer outside the options. Those are vendor claims. This repo reports only what it measured.

Next: [02-question-types.md](02-question-types.md).
