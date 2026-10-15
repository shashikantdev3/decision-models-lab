/** The same limits block as the README. Keep the two in step. */
export function Limits() {
  return (
    <section aria-labelledby="limits">
      <h2 id="limits">Limits</h2>
      <div className="alert warning">
        <p>
          <strong>Decision-1 reads at most 33K tokens. Jev reads up to 262K.</strong> Keep each ticket's
          context short if you want to compare both fairly. Long inputs will fail on Decision-1 and push Jev
          into its slower long-context mode (text over about 32,000 bytes).
        </p>
      </div>
      <div className="alert">
        <p>
          <strong>Both models are new and the Decisions API is in alpha.</strong> Pin exact versions (
          <code>typesafe/jev-1.14</code>, <code>microsoft/microsoft-decision-1-20261009</code>). Aliases like{" "}
          <code>~typesafe/jev-latest</code> and <code>microsoft/microsoft-decision-1</code> can change
          behaviour without warning, which also changes any thresholds you tuned.
        </p>
      </div>
      <ul>
        <li>
          <strong>Wording changes answers.</strong> Microsoft's own docs warn that results can change with
          question wording. The wording test in this repo measures it.
        </li>
        <li>
          <strong>No reasons.</strong> Decision models return probabilities, not explanations. If you need to
          explain a decision to a person, keep a reasoning model in the loop or log the inputs carefully.
        </li>
        <li>
          <strong>Confidence is not safety.</strong> A confident answer can be wrong. Choose thresholds from
          the cost of each kind of mistake, tune them on labelled data, and keep humans on high-impact
          decisions.
        </li>
        <li>
          <strong>Vendor claims are claims.</strong> Speed, cost, "can't hallucinate" and benchmark wins come
          from the vendors. This lab reports only what it measured, and only on its own small dataset.
        </li>
        <li>
          <strong>Text first.</strong> Image questions (box) exist only on Jev 1.14, are an early feature, and
          run in the slower long-context mode. Decision-1 does not support them.
        </li>
        <li>
          <strong>Claude's probabilities are written, not calibrated.</strong> When Claude acts as a decider
          it writes numbers down. Compare its reliability diagram before trusting them.
        </li>
        <li>
          <strong>Keys and cost.</strong> Never put a key in a public site. Live mode keeps keys in your
          browser tab only. Set spending limits on your OpenRouter key and Anthropic workspace.
        </li>
      </ul>
    </section>
  );
}
