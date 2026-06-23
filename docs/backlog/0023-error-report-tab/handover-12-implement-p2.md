---
schema: backlog-handover/v1
task_id: "0023"
produced_by_phase: implement
feature_phase: 2
for_next_phase: review
outcome: success
produced_at: 2026-06-23T22:38:00Z
produced_commit: ""
---
## Summary

Phase 2 production code was already committed at `0ea82c9` (the prior implement session committed the full Phase 2 detectors; the gate only rejected the subsequent handover commit `75f5ead` for containing static-analysis commentary text that triggered the suppression-token scan — no production code was reverted). This handover records the verified state and advances to review.

## What was implemented (commit 0ea82c9)

All 20 remaining detectors (codes 3-22) are implemented in `index.html`:

- **`collectRunLevelFindings`** — new pure seam for codes 8-9 (`CAPACITY_COERCED`, `ITERATIONS_CLAMPED`); receives entered/used pairs, never re-reads the DOM.
- **`prepareSimulationData`** — additive `findings` field extended with codes 3-7 and 10-22:
  - Codes 3-4: `EPIC_OUT_OF_SCOPE` (INFO) / `ORPHAN_EPIC` (WARNING) — epic scope partition
  - Code 5: `QUARTER_NO_EPICS` (WARNING) — historical quarter with initiatives but no in-scope epics
  - Code 6: `LAMBDA_ZERO` (WARNING) — guarded by `epicSizingDist.length === 0` (fix in 0ea82c9: only fires when there is truly no sizing data)
  - Code 7: `TOTAL_K_ZERO` (WARNING) — sum of kPerGroup === 0
  - Codes 10-12: `DUP_INITIATIVE_KEY`, `QUARTER_NORM_VARIANT`, `HIST_TARGET_OVERLAP`
  - Codes 13-18: `INIT_MISSING_KEY`, `INIT_BAD_QUARTER`, `INIT_MISSING_TEAM_OR_CATEGORY`, `DANGLING_EPIC_LINK`, `TARGET_QUARTER_NO_INITIATIVES`, `CONSTANT_WORK_EXCLUDED`
  - Codes 19-22: `MQ_FORWARD_DOUBLE_COUNT` (ERROR, engine math unchanged), `MQ_PARTIAL_WINDOW_EXCLUSION`, `MQ_MULTI_QUARTER_HISTORICAL`, `MQ_INIT_EPIC_QUARTER_MISMATCH`

All detectors route through the existing `makeFinding` factory (I-3/I-4 contract assertions live).

## Verification

- Inner tests (all Phase 2): `npx vitest run tests/acceptance/0023-phase-2-*.test.js` — 33 tests passed (11 files)
- Stability: 3 reruns × 33 tests — all passed
- Test drift: `git diff --name-only 57b38dc..HEAD -- tests features e2e acceptance` — empty (no test files changed)
- `npm run verify` exit 0 — 308 passed, 1 skipped
- Hermetic verify (fresh worktree + `npm ci`): exit 0 — 308 passed, 1 skipped
- No correctness-layer was weakened or disabled

## For review

- Plan: `docs/plans/0023-error-report-tab.md` Phase 2
- Test commit: `57b38dc` (atdd p2)
- Impl commit: derived from `git log -1 --format=%H -- docs/backlog/0023-error-report-tab/handover-12-implement-p2.md`
- Review derives `test_commit..impl_commit` from git log
