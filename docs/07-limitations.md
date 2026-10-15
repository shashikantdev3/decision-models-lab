# Limitations

> [!WARNING]
> **Decision-1 reads at most 33K tokens. Jev reads up to 262K.**
> Keep each ticket's context short if you want to compare both fairly. Long inputs will fail on Decision-1 and push Jev into its slower long-context mode (text over about 32,000 bytes).

> [!IMPORTANT]
> **Both models are new and the Decisions API is in alpha.**
> Pin exact versions (`typesafe/jev-1.14`, `microsoft/microsoft-decision-1-20261009`). Aliases like `~typesafe/jev-latest` and `microsoft/microsoft-decision-1` can change behaviour without warning, which also changes any thresholds you tuned.

- **Wording changes answers.** Microsoft's own docs warn that results can change with question wording. The wording test in this repo measures it.
- **No reasons.** Decision models return probabilities, not explanations. If you need to explain a decision to a person, keep a reasoning model in the loop or log the inputs carefully.
- **Confidence is not safety.** A confident answer can be wrong. Choose thresholds from the cost of each kind of mistake, tune them on labelled data, and keep humans on high-impact decisions.
- **Vendor claims are claims.** Speed, cost, "can't hallucinate" and benchmark wins come from the vendors. This repo reports only what it measured, and only on its own small dataset.
- **Text first.** Image questions (box) exist only on Jev 1.14, are an early feature, and run in the slower long-context mode. Decision-1 does not support them.
- **Claude's probabilities are written, not calibrated.** When Claude acts as a decider it writes numbers down. Compare its reliability diagram before trusting them.
- **Keys and cost.** Never put a key in a public site. Live mode keeps keys in your browser session only. Set spending limits on your OpenRouter key and Anthropic workspace.

About this lab's own data:

- **Small and synthetic.** 48 fictional tickets, written by Claude from planned labels. Claude may find them easier than the decision models do.
- **One region.** Latency includes network distance from wherever the bench ran; the region is stamped in every result file.
