const REPO = "https://github.com/shashikantdev3/decision-models-lab";
const doc = (f: string) => `${REPO}/blob/main/docs/${f}`;

export function Extend() {
  return (
    <article>
      <h1>Extend the lab</h1>
      <p>
        The lab is built to be added to. Each task below takes a handful of steps; the linked docs have the
        details and a template. Open a pull request when you are done;{" "}
        <a href={`${REPO}/blob/main/CONTRIBUTING.md`}>CONTRIBUTING.md</a> says what a good one includes.
      </p>

      <h2>Add a model</h2>
      <ol>
        <li>
          Add an entry to <code>config/models.json</code> with its id, label, kind and adapter.
        </li>
        <li>
          Add its price to <code>config/pricing.json</code> with the date and a source link.
        </li>
        <li>
          If it uses the OpenRouter Decisions API or Claude, you are done. Otherwise write one adapter in{" "}
          <code>packages/core/src/adapters/</code> that implements <code>DecisionModel</code>.
        </li>
        <li>
          Run <code>npm run hello -- --model your-key --save-fixture</code> and commit the fixture.
        </li>
        <li>
          Run <code>npm run bench -- --models your-key</code> to record results.
        </li>
      </ol>
      <p>
        <a href={doc("09-extending.md")}>docs/09-extending.md</a>
      </p>

      <h2>Add a dataset</h2>
      <ol>
        <li>
          Write tickets in the same JSONL shape as <code>data/tickets.jsonl</code>, with fictional data only.
        </li>
        <li>Add a dataset card: purpose, how it was made, label definitions, known biases, licence.</li>
        <li>
          Run <code>npm run data:validate</code>, then <code>npm run bench -- --dataset your-file.jsonl</code>
          .
        </li>
      </ol>
      <p>
        Ideas: HR requests, IT access requests, content moderation, invoice exceptions, pull-request triage on
        public repos, tickets in Hindi.
      </p>

      <h2>Add a question set</h2>
      <ol>
        <li>
          Copy <code>data/questions.v1.json</code> to <code>questions.v2.json</code> and change it.
        </li>
        <li>
          Run with <code>--questions v2</code>. Results record the question set version, so old and new runs
          never mix.
        </li>
      </ol>

      <h2>Add a chart or metric</h2>
      <ol>
        <li>
          Write a pure function in <code>packages/core/src/metrics/</code> with a unit test.
        </li>
        <li>
          Add it to <code>summarizeBench</code> so it lands in every result file.
        </li>
        <li>
          Add one Recharts figure to <code>site/src/pages/Results.tsx</code>.
        </li>
      </ol>

      <h2>Good first issues</h2>
      <ol>
        <li>Add an adapter for Jev box questions with an image example.</li>
        <li>Add an HR requests dataset with a dataset card.</li>
        <li>Add a Hindi ticket set and compare results.</li>
        <li>
          Add a confusion-matrix chart for <code>team</code>.
        </li>
        <li>
          Add a "cost of mistakes" threshold picker: set the cost of a false auto-route, get a suggested
          threshold.
        </li>
        <li>Add an export of a run as CSV.</li>
        <li>Add a TypeSafe SDK adapter (System One API) and compare it with the Decisions API.</li>
        <li>Add a clear error panel for rate limits in Live mode.</li>
        <li>Add keyboard shortcuts to the Triage Desk.</li>
        <li>Translate the Learn page.</li>
      </ol>
      <p>
        <a href={`${REPO}/issues?q=is%3Aopen+label%3A%22good+first+issue%22`}>
          Open good first issues on GitHub
        </a>
      </p>
    </article>
  );
}
