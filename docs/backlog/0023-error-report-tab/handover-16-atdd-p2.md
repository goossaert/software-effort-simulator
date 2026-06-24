---
schema: backlog-handover/v1
task_id: "0023"
produced_by_phase: atdd
feature_phase: 2
for_next_phase: implement
outcome: success
reason: ""
produced_at: 2026-06-24T05:55:00Z
produced_commit: ""
test_commit: ""
---
## Summary

Feature-phase 2 atdd **re-run** for the LAMBDA_ZERO (code 6) suspect-test resolution.
The human (handover-15, Option 1 — honor the spec) had already **migrated the one frozen
test** AT-5 (`tests/acceptance/0023-phase-2-acc-presentation.test.js`) from badge
`'1 WARNING'` → `'2 WARNING'` and left production untouched. This atdd session therefore
authored **no new test and no production code**; its job was to **confirm the migrated
AT-5 is a stable RED base** and persist a coherent, correctly-scoped RED log set for the
implement phase and the orchestrator gate. AT-5 is **stable RED on HEAD `4d57d35`**:
5/5 reruns exit 1, all for the same reason — the badge renders `1 WARNING` because the
guard `lambda === 0 && epicSizingDist.length === 0` at `index.html:2353` still suppresses
LAMBDA_ZERO in this λ=0 orphan-recognised-size Run (`epicSizingDist === ['M']`).

## Instructions for the next phase (implement, feature-phase 2)

1. **One production-only change.** In the **code-6 LAMBDA_ZERO block at `index.html:2353`**
   drop the `&& epicSizingDist.length === 0` clause so the guard becomes `if (lambda === 0)`.
   This makes `LAMBDA_ZERO ⇔ lambda === 0` (the unchanged plan invariant) and flips AT-5's
   badge from `1 WARNING` to `2 WARNING` (ORPHAN_EPIC + LAMBDA_ZERO).
2. **Do not edit any test.** AT-5 (and every other phase-2 test) is frozen. The change is
   a single clause deletion in production.
3. **Leave the run handler's fatal stop alone** (`index.html:5105`,
   `if (epicSizingDist.length === 0) throw …`). It is unrelated and correct; it is *why*
   the old guard made code 6 structurally dead in rendered reports, but the fix is at 2353,
   not 5105.
4. **Verify.** `npm run verify` must be green on a hermetic, network-disabled fresh
   checkout (`npm ci`). The human already verified this session that dropping the guard
   yields **308 passed, 1 skipped** with zero collateral (AT-1 in
   `0023-phase-2-acc-run-parameters.test.js` — λ=0 via an *unrecognised* size, so
   `epicSizingDist` is empty — stays green under both the old guard and the strict rule).
5. The integrity `review` and `review-correctness` re-run next; correctness should now reach
   **PASS** — LAMBDA_ZERO's behaviour and AT-5's badge agree with `LAMBDA_ZERO ⇔ lambda === 0`.

## Files the next phase MUST read

- `docs/plans/0023-error-report-tab.md` — Phase 2, former-Phase-3 sub-section (~line 718):
  the **unchanged** `[test-only]` invariant `LAMBDA_ZERO ⇔ lambda === 0` + AC-7 + behavioral
  rule "When Poisson λ = 0 … a WARNING finding is emitted" + the code table (code 6 = WARNING).
- `tests/acceptance/0023-phase-2-acc-presentation.test.js` — the migrated AT-5 (`2 WARNING`),
  RED on HEAD until the guard is dropped; the seed (`{_initiative_key:'', _tshirt_size:'M', …}`)
  and the degenerate-run reasoning are documented in the test's header comment.
- `index.html` — the code-6 block at `index.html:2353` (the guard to drop) and the fatal
  stop at `index.html:5105` (why the old guard made code 6 dead in rendered reports — do NOT
  touch it).
- `docs/atdd-logs/0023-error-report-tab-phase-2-acceptance-red.log` — the RED gate evidence,
  scoped to the AT-5 command; the `command:` header is what the gate re-runs.
- `docs/atdd-logs/0023-error-report-tab-phase-2-flakiness.log` — proof the AT-5 RED is stable
  across 5 reruns (not flaky / order-dependent).
- `docs/backlog/0023-error-report-tab/handover-15-human-fix-p2.md` and
  `handover-14-review-correctness-p2.md` — the suspect-test adjudication and the
  human-approved Option 1 resolution this implement satisfies.

## Context the next phase needs

- **Boot smoke = PASS.** `smoke_command` is empty (logged no-op), so a minimal check was run:
  `index.html` parses (210496 bytes) and contains `<script>`. Base is healthy — green except
  the deliberately-RED AT-5, which is the intended pre-implementation state for this slice.
- **No new test authored — by design.** This is a suspect-test re-entry: per handover-15 the
  human migrated the single frozen test, and LAMBDA_ZERO is an acceptance-level (oracle-cheap)
  behaviour, not a parametric rule, so no new `test.prop` is required. The whole-plan PBT floor
  is **already satisfied (12 ≥ 12)** and the 12 committed property tests are unchanged — gate
  (f) reads the test files, which were not touched.
- **Seam decision (taken autonomously, no user):** the existing AT-5 acceptance seam
  (`prepareSimulationData(...).findings` → `renderErrorReport` → `#tab-error-report` DOM badge)
  is the stable contract for this slice; no new seam was introduced. Triangulation for
  LAMBDA_ZERO already spans the frozen set: AT-1 (`…acc-run-parameters.test.js`) covers λ=0 with
  `epicSizingDist` **empty** (green under both guard and strict rule); AT-5 covers λ=0 with
  `epicSizingDist` **non-empty** (the boundary the guard wrongly suppressed — now RED); λ>0 Runs
  across the suite are the negative case (no LAMBDA_ZERO).
- **RED-log re-scoping (taken autonomously):** the former phase-2 RED logs targeted the broad
  `0023-phase-2-acc` / `0023-phase-2-prop` commands for the original codes-3-22 cycle. Codes
  3-22 are now DELIVERED and GREEN, so:
  - `…-phase-2-acceptance-red.log` was **re-scoped** to `npx vitest run
    tests/acceptance/0023-phase-2-acc-presentation.test.js` (the only acceptance RED).
  - `…-phase-2-inner-red.log` (command `npx vitest run 0023-phase-2-prop`, now **exit 0 /
    11 passed**) was **removed** — leaving it would make the gate's RED re-check (c) re-run a
    now-green command and reject the atdd commit. There is no inner/property RED for this slice.
  - `…-phase-2-flakiness.log` was rewritten to the single AT-5 command (5/5 FAIL).
  The only remaining phase-2 `*-red.log` is the AT-5-scoped acceptance log, so gate (c) re-runs
  exactly AT-5 and gets RED.
- **Test commit SHA:** derive via `git log -1 --format=%H -- docs/backlog/0023-error-report-tab/handover-16-atdd-p2.md`.

## Definition of done

`/stage-implement` drops `&& epicSizingDist.length === 0` at `index.html:2353` (production-only,
no test edit), AT-5 flips to GREEN (`2 WARNING`), `npm run verify` is green on a hermetic
checkout, and the subsequent `review-correctness` reaches PASS with LAMBDA_ZERO firing on every
completed λ=0 Run and the AT-5 badge agreeing with the plan invariant `LAMBDA_ZERO ⇔ lambda === 0`.
