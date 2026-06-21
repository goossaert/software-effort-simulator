# Mutation report — 0022 empirical-lognormal-default — Phase 1 — run 01

- **Date:** 2026-06-21T18:59:41Z
- **Engine:** StrykerJS (`mutation.command = "npx stryker run"`) — @stryker-mutator/core 9.6.1, @stryker-mutator/vitest-runner 9.6.1
- **Config:** `stryker.conf.json` — `mutate: ["index.html:1333", "index.html:4522-4531"]`, `testRunner: "vitest"`, `coverageAnalysis: "perTest"`
- **Threshold (plan DoD / `mutation.min_score`):** 70%
- **Scope:** `changed-files` — the changed initializer (`index.html:1333`) + the `param-mode` `change` handler (`index.html:4522-4531`)
- **Result: NO SCORE PRODUCED — `npx stryker run` exited 1 at the dry-run.** killed/total = **n/a** (Stryker aborted before mutation testing began).

## Verbatim Stryker output (the configured run — ANSI stripped)

```
WARN  ProjectReader Glob pattern "index.html:1333" did not result in any files.
INFO  ProjectReader Found 1 of 227 file(s) to be mutated.
INFO  Instrumenter  Instrumented 1 source file(s) with 0 mutant(s)
INFO  ConcurrencyTokenProvider Creating 13 test runner process(es).
INFO  BroadcastReporter Detected that current console does not support the "progress" reporter, downgrading to "progress-append-only" reporter
INFO  DryRunExecutor Starting initial test run (vitest test runner with "perTest" coverage analysis). This may take a while.
WARN  VitestTestRunner Vitest failed to find test files related to mutated files. Either disable `vitest.related` or
      import your source files directly from your test files.
      (https://stryker-mutator.io/docs/stryker-js/troubleshooting/#vitest-failed-to-find-test-files-related-to-mutated-files)
INFO  DryRunExecutor No tests were found
ERROR Stryker No tests were executed. Stryker will exit prematurely. Please check your configuration.
ConfigError: No tests were executed. Stryker will exit prematurely. Please check your configuration.
```

Exit code: **1**. No `reports/mutation/mutation.json` was produced (the run never reached mutation testing).

## Root-cause diagnosis (two independent, config-level blockers)

The review ran the human-selected `mutation.command` **verbatim** (`npx stryker run`) — no tool
substituted, no flag added. It produces **no mutation score**. Two separate defects, both at the
toolchain/config layer (neither is a production bug nor a missing test):

1. **Scoped `mutate` ranges instrument 0 mutants.**
   - `"index.html:1333"` is **invalid Stryker mutation-range syntax** (a single line with no
     `-end`), so Stryker treats it as a plain file glob → *"did not result in any files."*
   - `"index.html:4522-4531"` is valid range syntax but yielded **0 mutants** for the inline-HTML
     `<script>` content (`Instrumented 1 source file(s) with 0 mutant(s)`).
   - **This is NOT a Stryker-can't-mutate-HTML limitation.** A diagnostic whole-file run
     (`mutate: ["index.html"]`) on the same committed tree instrumented **3589 mutants** — proof
     Stryker's HTML inline-script instrumentation works here. The scoped **line-range** form is the
     defect: in @stryker 9.6.1 the `file:line` / `file:start-end` mutation-range filter does not
     intersect the inline-HTML script's mapped positions as the plan assumed, so the param-mode
     region is not mutated.

2. **The vitest runner cannot discover the tests (`vitest.related`).**
   - Stryker's vitest-runner defaults to `vitest --related <mutatedFile>`, which walks Vitest's
     module graph for tests that **import** the mutated file. This repo's suite loads `index.html`
     through the JSDOM harness via `fs.readFileSync` + `runScripts:'dangerously'`
     (`tests/harness.js`) — there is **no `import` edge** from any test to `index.html`. So
     `--related index.html` finds nothing → *"No tests were found"* → dry-run abort.

## What this is NOT

- **Not a missing-test gap.** The committed suite exists, passes, and (Step 6 negative control)
  kills a deliberate regression of the headline rule. Re-running `/stage-atdd` to "write kill
  tests" cannot fix either blocker: more tests will not make `--related index.html` discover them
  (no import edge), nor make the line-range filter emit mutants.
- **Not a production bug.** The production diff is correct and minimal; no re-implement of
  `index.html` changes Stryker's scoping/runner integration.
- **Not gaming.** No config was weakened to reach a score (no score was reached); the review did
  not alter `stryker.conf.json` (review may not).

## Human-actionable fix (toolchain/config — outside review/atdd/implement immutability)

A human owning the grill→apply-docs toolchain selection must make the mutation gate runnable, e.g.:

1. Set `vitest: { related: false }` in `stryker.conf.json` (the documented fix for fs-loaded /
   non-imported sources), so the full suite is the kill set.
2. Replace the non-working scoped `mutate` ranges with a form that emits mutants for the inline-HTML
   param-mode region — e.g. validated `index.html:1333-1333` + `index.html:4522-4531` *confirmed to
   instrument >0 mutants*, or a different scoping strategy — since the current `["index.html:1333",
   "index.html:4522-4531"]` yields 0. (Whole-file mutate = 3589 mutants is impractical and out of
   the plan's intended scope.)
3. Or, if no workable scoped-HTML mutation form exists in this Stryker version for a single-file
   HTML app, deliberately record the mutation layer **N/A** (`toolchain.layers.mutation.status:
   "n/a"` + `mutation.enabled:false`) with rationale — a human toolchain decision, not an autonomous one.

Until one of these is done, the scoped mutation adequacy score required by the plan's Definition of
Done **cannot be measured**, so the integrity review is **BLOCKED** (see the review file,
`0022-empirical-lognormal-default-phase-1-review-01.md`).
