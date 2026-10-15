# Calibration and wording

## Calibration

A model is calibrated if, of all the answers it gives at 0.8, about 80% are right.

The bench pools every top answer across the four triage questions, records its stated probability and whether it was right, and reports:

- **Reliability diagram**: 10 equal-width bins of stated confidence; for each, the mean confidence and the share right. Points on the diagonal are well calibrated; points below it are overconfident.
- **Expected calibration error (ECE)**: the weighted mean gap between confidence and accuracy across the bins. Lower is better.
- **Brier score**: for yes/no questions, the mean of (p - outcome)^2 (0 is perfect, 0.25 is always saying 0.5). For `team`, the multi-class version (0 to 2).

With 48 tickets x 4 questions x 3 runs = 576 answers per model, sparse bins are noisy. Read the diagram together with the bin counts in the result file.

### Claude as a decider

`ClaudeDecider` asks Claude the same questions and forces it to write a probability for every option. These are numbers Claude writes down, not probabilities from the model's output distribution. They may be well calibrated or not; the reliability diagram is how you find out.

## Wording sensitivity

Microsoft's docs warn that results can change with question wording. `npm run wording -- --model jev` measures it:

- Each triage question has three rewordings in `data/rewordings.v1.json`, with the same answer keys.
- Every ticket is asked all four questions in the original wording and in each rewording (4 calls per ticket).
- **Flip rate**: the share of (ticket, question, rewording) cases where the top answer differs from the original.
- **Mean probability shift**: the average total-variation distance between the original and reworded distributions (0 identical, 1 completely different).

One rewording of `customer_blocked` asks the question in reverse ("Does the customer have a workaround?") while keeping `true` as "blocked". It is there on purpose: it shows how much the model leans on the criteria versus the instructions.
