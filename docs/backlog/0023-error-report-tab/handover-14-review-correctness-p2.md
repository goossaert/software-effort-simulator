---
schema: backlog-handover/v1
task_id: "0023"
produced_by_phase: review-correctness
feature_phase: 2
for_next_phase: atdd
outcome: blocked
reason: "suspect-test: 0023-phase-2-acc-presentation.test.js (AT-5) asserts '1 WARNING' in a λ=0 orphan-recognised-size Run, requiring the LAMBDA_ZERO guard that contradicts the plan invariant 'LAMBDA_ZERO ⇔ lambda === 0' — production cannot satisfy both spec and frozen test."
produced_at: 2026-06-23T21:08:01Z
produced_commit: ""
test_commit: 57b38dc23c39a46a0666a0736cf3466ed3cbf47e
impl_commit: cbbabc6b64d749e4eff7fde0d173b32ee1b6d304
review_path: docs/reviews/0023-error-report-tab-phase-2-correctness-01.md
blocked_subtype: suspect-test
suspect_test:
  test_file: tests/acceptance/0023-phase-2-acc-presentation.test.js
  test_assertion: "expect(text).toContain('1 WARNING') — AT-5, in a Run seeding an orphan Epic {_initiative_key:'', _tshirt_size:'M', _quarter:'Q1 2026'} where lambda === 0 and epicSizingDist === ['M']; the single WARNING is ORPHAN_EPIC, so the test requires LAMBDA_ZERO to be suppressed despite lambda === 0."
  contradicted_requirement: "docs/plans/0023-error-report-tab.md Phase 2 (former Phase 3): [test-only] invariant 'LAMBDA_ZERO ⇔ lambda === 0' + behavioral rule 'When Poisson λ = 0 … a WARNING finding is emitted'."
---
## Summary

Independent correctness review of feature-phase 2 (codes 3–22 + presentation contract),
reasoning from the spec (plan + production `index.html` diff), not the tests. All
detectors except `LAMBDA_ZERO` are faithful to the plan. **`LAMBDA_ZERO` (code 6) is
guarded with `lambda === 0 && epicSizingDist.length === 0`**, which contradicts the plan's
`[test-only]` invariant `LAMBDA_ZERO ⇔ lambda === 0` and behavioral rule, and — because the
only fatal stop fires when `epicSizingDist.length === 0`, *before* the report renders —
makes `LAMBDA_ZERO` **structurally unreachable** in any rendered Error Report. The guard is
wrong (a completed λ=0 run with an in-window orphan Epic carrying a recognised size is a
genuinely degenerate forecast that *should* WARN). **But** the committed, GREEN AT-5 test
`0023-phase-2-acc-presentation.test.js` seeds exactly that orphan scenario and asserts the
badge `1 WARNING` (ORPHAN_EPIC only) — which *requires* the guard. Production cannot satisfy
both the spec and the frozen test, so per `stage-review-correctness` **Step 5b** this is a
**`blocked: suspect-test`**, not a production FAIL. **Stage left unchanged; a human is
flagged.** Full reasoning: `docs/reviews/0023-error-report-tab-phase-2-correctness-01.md`.

## Gated decisions taken autonomously (no user)

- **Outcome = BLOCKED, subtype `suspect-test`** (not FAIL, not PASS). The one surviving
  finding is irreconcilable: `LAMBDA_ZERO`'s severity is fixed at `WARNING`, the spec
  requires it present whenever λ = 0, AT-5's scenario has λ = 0 — so emitting it forces a
  2nd WARNING and breaks AT-5's `1 WARNING`. No production-only change satisfies both. Step
  5b's high bar (a quotable test assertion directly contradicting a quotable spec clause) is
  met, so it is **not** routed to `implement` (a fix there would have to break a frozen
  test the gate's hermetic re-run rejects).
- **`LAMBDA_ZERO` adjudicated as a real spec deviation** (the question the integrity review
  handed over). The guard makes code 6 dead code in any rendered report; the orphan-epic
  path proves λ=0-with-sizing is reachable and degenerate (Poisson(0) ⇒ 0 epics drawn).
- **Boot smoke = passed.** No `smoke_command` configured (empty) ⇒ minimal build/boot check
  on `index.html` (parses, has `<script>`); base is green (integrity review's GREEN
  baseline holds; 6/6 on the two relevant test files re-run this session).
- **No test edited, no production edited.** This stage only reviews; the suspect-test path
  flags a human and never touches a frozen test.

## Human action required (the actionable decision)

The plan invariant and the frozen AT-5 test disagree about a λ=0 run that still has a
non-empty bootstrap pool. Pick one; either re-enters the slice via `/stage-atdd`:

1. **Honor the spec (recommended).** Drop the `&& epicSizingDist.length === 0` guard so
   `LAMBDA_ZERO ⇔ lambda === 0`, and **migrate AT-5** to expect `2 WARNING` (or re-seed
   AT-5 so λ > 0, decoupling the presentation contract from the degenerate-run signal).
   This restores the only λ=0 warning a *completed* run can ever surface.
2. **Honor the test.** If a λ=0 run with a non-empty bootstrap pool should NOT warn, amend
   the plan's `[test-only]` invariant away from the strict biconditional and record/justify
   in ADR-0037 that code 6 never renders (dead). This is a plan/spec change.

## Files the next phase / human MUST read

- `docs/reviews/0023-error-report-tab-phase-2-correctness-01.md` — this review: the trace,
  the Step 5b irreconcilability proof, the `judge_dropped` audit, the two resolutions.
- `docs/plans/0023-error-report-tab.md` (Phase 2, former-Phase-3 sub-section) — the
  `LAMBDA_ZERO ⇔ lambda === 0` invariant + behavioral rule + AC-7 + code table.
- `tests/acceptance/0023-phase-2-acc-presentation.test.js` (AT-5) — the suspect test (the
  `1 WARNING` badge assertion in the orphan-recognised-size λ=0 Run).
- `tests/acceptance/0023-phase-2-acc-run-parameters.test.js` (AT-1) — the *consistent*
  LAMBDA_ZERO test (λ=0 via an unrecognised-size epic ⇒ `epicSizingDist` empty ⇒ guard
  satisfied ⇒ fires); passes under both guard and strict rule.
- `index.html` — `prepareSimulationData` code-6 block (the guard) and the run handler
  (`epicSizingDist.length === 0` fatal throw at ~5105, before `renderErrorReport` ~5171).
- `CONTEXT.md` → **Severity** (λ=0 degenerate run is a WARNING); `docs/adr/0037-…` (report
  is advisory, for completed Runs).
- The integrity PASS handover `handover-13-review-p2.md` — its "Carry-forward" section
  raised exactly this for adjudication.

## Context the next phase needs

- **test_commit** = `57b38dc` (atdd-p2), **impl_commit** = `cbbabc6` (implement-p2);
  reviewed diff = `git diff 57b38dc..cbbabc6 -- index.html`.
- The guard was introduced by commit `0ea82c9` ("suppress LAMBDA_ZERO when epicSizingDist
  is non-empty") — added to make AT-5 pass; that is the suspect-test dynamic.
- All other detectors (codes 3–5, 7, 8–9, 10–22) reviewed clean against their AT scenarios,
  properties, and the I-5 normalisation rule; I-1 (engine output unchanged) holds.

## Definition of done (for the consuming work)

A human resolves the spec↔test conflict (option 1 or 2 above), then the slice re-enters via
`/stage-atdd` with a coherent test set; the re-run reaches a `review-correctness` PASS where
`LAMBDA_ZERO`'s behavior and the AT-5 badge agree with the (possibly amended) plan invariant.
