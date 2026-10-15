# Fixtures

`documented-shape.*.json` files are built from the response shape in the OpenRouter Decisions API reference
(checked 2026-10-15). They are not live captures.

Milestone 0 replaces them with real responses saved by `npm run hello -- --save-fixture`, named
`live.<model>.<date>.json`. Tests run against every fixture in this folder, so a live capture that
breaks the parser fails the build.
