---
schema: backlog-handover/v1
task_id: "0023"
produced_by_phase: review-correctness
feature_phase: 2
for_next_phase: atdd
outcome: success
reason: ""
produced_at: 2026-06-24T05:25:00Z
produced_commit: ""
test_commit: 57b38dc23c39a46a0666a0736cf3466ed3cbf47e
impl_commit: cbbabc6b64d749e4eff7fde0d173b32ee1b6d304
---
## Summary

**Human resolution** (operator-directed, outside the autonomous loop) of the
`suspect-test` block recorded in `handover-14-review-correctness-p2.md`. The conflict was:
the plan invariant `LAMBDA_ZERO ⇔ lambda === 0` (`docs/plans/...md:718`) vs. the frozen
AT-5 presentation test, which seeds a λ=0 orphan-recognised-size Run
(`epicSizingDist === ['M']`) and asserted the badge `1 WARNING` — an assertion that only
holds while production carries the guard `lambda === 0 && epicSizingDist.length === 0`
(`index.html:2353`), which the correctness review proved makes `LAMBDA_ZERO` structurally
dead in any *rendered* report (the fatal stop at `index.html:5105` already throws whenever
`epicSizingDist.length === 0`, before `renderErrorReport`).

**Decision — Option 1, honor the spec (operator-approved 2026-06-24):**
1. The plan invariant `LAMBDA_ZERO ⇔ lambda === 0` is **correct and unchanged.** A completed
   λ=0 Run forecasts ~0 work (Poisson(0) draws 0 epics) and *should* WARN, even when a
   bootstrap pool exists.
2. Production must **drop the `&& epicSizingDist.length === 0` guard** so code 6 fires
   whenever `lambda === 0`. **(This is `/stage-implement`'s job — NOT done here, so the
   re-entry has a genuine RED base. See below.)**
3. The frozen test AT-5 has been **migrated by the human** (the only edit the loop may not
   make itself): `tests/acceptance/0023-phase-2-acc-presentation.test.js` badge assertion
   `'1 WARNING'` → `'2 WARNING'` (ORPHAN_EPIC + LAMBDA_ZERO), with its header/inline comments
   updated to explain the degenerate-Run reasoning. No other test touched.

## Why this re-entry is RED-coherent (and does NOT re-trip the handover-08 trap)

The earlier atdd re-run (`handover-08-atdd-p1.md`) blocked because *every* phase-1 test was
already GREEN on the post-impl base — there was no test to drive RED. **That does not recur
here.** The migrated AT-5 (`2 WARNING`) is **genuinely RED on the current HEAD** because the
LAMBDA_ZERO-correct behaviour is *absent* on HEAD (the guard is still present, so the badge
renders `1 WARNING`). Verified this session:

- `npx vitest run …0023-phase-2-acc-presentation.test.js` → **FAIL** (exit ≠ 0): "expected
  '… 1 WARNING …' to contain '2 WARNING'". This is the authentic RED for the slice.
- With the guard temporarily dropped (`if (lambda === 0)`), `npm run verify` → **308 passed,
  1 skipped** (then reverted — `git diff index.html` is empty). Proves implement's one-line
  change turns AT-5 green with **zero collateral**: AT-1 (`…acc-run-parameters.test.js`,
  λ=0 via *unrecognised* size ⇒ `epicSizingDist` empty) stays green under both guard and
  strict rule; no PBT property covers LAMBDA_ZERO (the two run-parameter properties are
  CAPACITY_COERCED / ITERATIONS_CLAMPED); the I-1 advisory property is unaffected.

## Instructions for the next phase (atdd, feature-phase 2)

1. Base = current HEAD (guard present). Confirm **stable RED** of the migrated AT-5 across
   `flakiness_reruns` (the LAMBDA_ZERO correction is the only slice being re-driven). Scope
   the committed `*-red.log` to the AT-5 command — the already-DELIVERED codes 3–22 tests
   are GREEN and are **not** part of this re-entry's RED set.
2. Cumulative PBT floor is **already satisfied** (12 committed `test.prop` ≥ 12) — author no
   new properties to clear the floor; LAMBDA_ZERO is an acceptance-level (oracle-cheap)
   behaviour, not a parametric rule.
3. Do **not** edit production; do **not** drop the guard (that is `/stage-implement`). Then
   `/stage-implement` removes `&& epicSizingDist.length === 0` from the code-6 block at
   `index.html:2353` (production-only) → AT-5 green → `npm run verify` green.
4. `/stage-review` + `/stage-review-correctness` re-run; the correctness review should now
   reach **PASS** — `LAMBDA_ZERO`'s behaviour and the AT-5 badge agree with the (unchanged)
   plan invariant `LAMBDA_ZERO ⇔ lambda === 0`.

## Files the next phase MUST read

- `docs/backlog/0023-error-report-tab/handover-14-review-correctness-p2.md` — the
  suspect-test block this resolves; the Step 5b irreconcilability proof and the two options.
- `docs/reviews/0023-error-report-tab-phase-2-correctness-01.md` — full correctness trace.
- `tests/acceptance/0023-phase-2-acc-presentation.test.js` (AT-5) — the migrated test
  (`2 WARNING`), now RED on HEAD until the guard is dropped.
- `index.html` — code-6 block at `index.html:2353` (the guard to drop) and the fatal stop
  at `index.html:5105` (why the guard made code 6 dead in rendered reports).
- `docs/plans/0023-error-report-tab.md` (Phase 2, former-Phase-3 sub-section, ~line 718) —
  the **unchanged** invariant `LAMBDA_ZERO ⇔ lambda === 0` + AC-7 + code table.

## Context the next phase needs

- **test_commit** `57b38dc` / **impl_commit** `cbbabc6` were the reviewed Phase-2 range; the
  guard was introduced by `0ea82c9` specifically to pass AT-5 (the suspect-test dynamic).
- All other detectors (codes 3–5, 7, 8–9, 10–22) are reviewed-clean and remain DELIVERED;
  this slice changes only the LAMBDA_ZERO guard + the AT-5 badge.
- Boot smoke: `smoke_command` empty ⇒ logged no-op; base is green (308 passed with the fix).

## Definition of done

`/stage-implement` drops the guard, `npm run verify` is green, and `review-correctness`
reaches PASS with `LAMBDA_ZERO` firing on every completed λ=0 Run, AT-5 asserting
`2 WARNING`, and the plan invariant `LAMBDA_ZERO ⇔ lambda === 0` honoured.
