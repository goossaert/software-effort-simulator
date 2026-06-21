# Mutation adequacy recorded N/A for the single-file multi-`<script>` HTML app

The simulator's **mutation-adequacy toolchain layer is recorded N/A** (`backlog.config.json` →
`toolchain.layers.mutation.status: "n/a"`, `mutation.enabled: false`). StrykerJS stays installed as a
devDependency and `stryker.conf.json` is left runnable (`vitest.related: false` + whole-file `mutate`)
for ad-hoc, exploratory mutation runs, but **no backlog phase gates on a mutation score**. The
behavioural-adequacy signal that the scored gate was meant to provide is carried instead by the
per-phase **negative-control mutation** (the `/stage-review` Step-6 smoke check — revert the headline
rule, confirm the suite goes red) plus the **property-based tests** the plan requires. This decision
was taken by a human (2026-06-21) while resolving task **0022**, whose integrity review was `blocked`
because the configured `npx stryker run` produced no score; it supersedes that task plan's
"scoped mutation score ≥ 70%" Definition-of-Done bullet (now marked N/A).

We chose to **record mutation N/A rather than (a) keep a scoped line-range gate, (b) run whole-file
mutation, or (c) extract the engine into a separately-mutatable module**, because StrykerJS 9.x simply
**cannot scope mutation to one inline `<script>` block** in this architecture, and the change that
prompted the gate has no mutable surface to score. The mechanism, confirmed by reading the
`@stryker-mutator/instrumenter` 9.6.1 source and reproducing it against the committed `index.html`:
Stryker's HTML parser extracts each `<script>`'s content and parses it **independently**, so the babel
node positions it records are **script-relative** (line 1 = the first line of each block) and reset for
every one of the **ten** inline `<script>` blocks in `index.html`. The `mutate` line-range filter
(`locationIncluded`) compares the user's range against those script-relative positions, while the
*reported* mutant location is later offset back to file-relative coordinates. The consequence is that a
file-relative range never matches: the planned `index.html:4522-4531` (the param-mode `change` handler,
file lines 4524–4528) instruments **0 mutants**, and the script-relative equivalent `index.html:28-30`
captures lines 28–30 of *several* blocks at once (file lines 1169, 3307, 3308, **and** 4525–4527) — there
is **no file-line range that isolates a single block**. Independently, the line task 0022 actually changed,
`let activeParams = T_SHIRT_PARAMS_EMPIRICAL;`, yields **0 mutants** (no Stryker mutator applies to an
identifier-to-identifier assignment), the empirical/synthetic value of the default lives in an HTML
`checked` attribute that Stryker's JS mutators do not touch, and the `change` handler the plan intended to
score was **unchanged** by the task — so even a working scope would have scored code the change never
touched. Keeping a scoped gate (option a) is therefore impossible as specified; whole-file mutation
(option b) instruments **3589 mutants** (~20 min/run) dominated by UI/template code the engine-focused
suite never exercises, so its score would fail any meaningful threshold for reasons unrelated to any one
change, making it a misleading gate; extracting the engine into its own importable module (option c) is the
only way to get clean per-function mutation but **re-opens [ADR-0001](./0001-single-file-html-app.md)**'s
single-file constraint and is a separate, larger effort.

We chose to **leave `stryker.conf.json` runnable (whole-file `mutate` + `vitest.related: false`) rather
than delete it or leave the broken scoped ranges**, because the second blocker the review hit — Stryker's
vitest-runner finding *no* tests — is a real, cleanly-fixable defect worth preserving the fix for: the
runner defaults to `vitest --related <mutatedFile>`, which walks Vitest's **import graph**, but the
[ADR-0031](./0031-vitest-jsdom-test-harness.md) harness loads `index.html` via `fs.readFileSync` +
JSDOM `runScripts: 'dangerously'` with **no `import` edge**, so `--related index.html` discovers nothing
and Stryker aborts at the dry run. Setting `vitest: { related: false }` makes the full suite the kill set
and was verified to let `npx stryker run` execute all 234 tests. Leaving the original scoped ranges in
place would have left a config that errors out (0 mutants → "No tests were executed"); deleting the file
would have lost the discovered `related` fix and the only viable (whole-file) mutate form. The runnable
config is explicitly **not** wired to any gate — anyone wanting a broad mutation sweep can run it and read
the score as exploratory, accepting the ~20 min cost and the low score that the untested UI surface implies.

This decision pairs with [ADR-0031](./0031-vitest-jsdom-test-harness.md) (the fs-load / no-`import`-edge
harness design is exactly why Stryker's `vitest.related` discovery fails) and
[ADR-0001](./0001-single-file-html-app.md) (the single-file constraint is the root reason mutation cannot
be cleanly scoped — all production JS lives in inline `<script>` blocks of one file). It applies
**repo-wide**, not just to task 0022: the limitation is architectural, so every future task in this repo
inherits the N/A until the architecture changes.

A future revision could **re-enable mutation** if any of these change: StrykerJS gains file-relative
mutation ranges for inline-HTML scripts (or a per-block scoping mechanism); the engine is extracted into a
standalone ES module (re-opening [ADR-0001](./0001-single-file-html-app.md)) so it can be mutated and
imported directly with clean per-function scope; or the team decides a slow whole-file mutation sweep with
a deliberately low, UI-aware threshold is worth wiring as an advisory (non-blocking) signal. Re-enabling
means flipping `mutation.enabled: true`, restoring `toolchain.layers.mutation.status: "selected"`, and —
because the N/A escape hatch is honoured trusted-only when an enforcement-config overlay is active —
ensuring the trusted overlay agrees.
