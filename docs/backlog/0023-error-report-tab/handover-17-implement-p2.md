---
schema: backlog-handover/v1
task_id: "0023"
produced_by_phase: implement
feature_phase: 2
for_next_phase: review
outcome: success
reason: ""
produced_at: 2026-06-24T08:01:00Z
produced_commit: ""
test_commit: "056c7b3a9267d26980019e72b402405503ecadc1"
---
## Summary

Feature-phase 2 implement: single production change to make `LAMBDA_ZERO ⇔ lambda === 0`
(plan invariant, `[test-only]` I-2) by dropping the spurious `&& epicSizingDist.length === 0`
guard from the code-6 detector block at `index.html:2353`.

The guard made LAMBDA_ZERO **structurally unreachable** in any rendered report because the run
handler's fatal stop at `index.html:5105` throws `if (epicSizingDist.length === 0)` before
the report is ever rendered — so the old conjunctive guard could only fire when
`epicSizingDist` was **non-empty**, yet it required `epicSizingDist.length === 0`. Dropping
the extra clause restores the strict biconditional: any completed Run with `lambda === 0`
emits the WARNING finding, regardless of whether sizing data was collected.

## Change

**`index.html` line 2353** — single clause deletion in the code-6 LAMBDA_ZERO block:

```diff
-  if (lambda === 0 && epicSizingDist.length === 0) {
+  if (lambda === 0) {
```

No other production files changed. No test files changed or touched.

## Verification

- **Targeted AT-5** (`npx vitest run tests/acceptance/0023-phase-2-acc-presentation.test.js`):
  exited 0, 1 test passed — badge now correctly renders `2 WARNING` (ORPHAN_EPIC + LAMBDA_ZERO).
- **Full `npm run verify`**: exited 0 — 308 passed, 1 skipped (all phases, all correctness layers).
- **Stability reruns**: 3/3 consecutive passes + 1 randomized-order pass — no flakiness.
- **Hermetic verify**: fresh worktree + `npm ci --prefer-offline` + `npm run verify` — exited 0,
  308 passed, 1 skipped.
- **Test drift**: `git diff --name-only 056c7b3..HEAD -- tests features e2e acceptance` = empty.
- **Forbidden patterns**: production change is a single guard deletion; no fixture literals,
  no NODE_ENV/TEST branches, no test-file imports, no nondeterministic constructs.

## Files the next phase (review) MUST read

- `docs/plans/0023-error-report-tab.md` — Phase 2, former-Phase-3 sub-section (line ~718):
  `[test-only]` invariant `LAMBDA_ZERO ⇔ lambda === 0` (I-2), AC-7 behavioral rule, code table.
- `tests/acceptance/0023-phase-2-acc-presentation.test.js` — the migrated AT-5 (`2 WARNING`),
  now GREEN; the seed and reasoning are in the test header comment.
- `index.html` — code-6 block (now `if (lambda === 0) {`) and fatal stop at line 5105 (correct,
  unchanged).
- `docs/atdd-logs/0023-error-report-tab-phase-2-acceptance-red.log` — the RED gate evidence
  (AT-5 command) that this implement satisfies.
- `docs/reviews/0023-error-report-tab-phase-2-correctness-01.md` — the suspect-test
  adjudication (LAMBDA_ZERO guard analysis) this implement resolves.

## Diff range for review

Review should examine `git diff 056c7b3a9267d26980019e72b402405503ecadc1..<impl_commit_sha>`
(test commit to impl commit). The diff is **production-only**: exactly one line changed in
`index.html`; no test-file changes.

## Context for review

- The `makeFinding` factory asserting I-3 (severity ∈ enum) and I-4 (`locators.length >= 1`)
  was introduced in Phase 1 (commit `79dcd45`) and is unchanged. All detectors including
  code-6 route through it.
- The run handler fatal stop at `index.html:5105` (`if (epicSizingDist.length === 0) throw …`)
  is correct and untouched — it fires pre-report for truly degenerate runs, but that path
  never reaches the report renderer, so LAMBDA_ZERO can never appear in a rendered report for
  that case. The fix is only needed for the "orphan Epic with recognised size ⇒ λ=0 with
  non-empty `epicSizingDist`" boundary case AT-5 exercises.
- Correctness review should now reach PASS: `LAMBDA_ZERO ⇔ lambda === 0` holds in production,
  AT-5's `2 WARNING` badge agrees with the plan invariant, and all other detectors (codes
  3-5, 7, 8-9, 10-22) were reviewed clean in the prior cycle.
