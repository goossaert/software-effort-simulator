---
schema: backlog-handover/v1
task_id: "0023"
produced_by_phase: atdd
feature_phase: 2
for_next_phase: implement
outcome: success
reason: ""
produced_at: 2026-06-23T18:31:30Z
produced_commit: 02e99c9ea8989e18adf94e0055443185d186f815
test_commit: 36d5b1c8c94e2e40c62787d660a2354622655daa
---
## Summary
Phase-2 atdd authored the failing acceptance + property tests for **all remaining
diagnostics — codes 3-22 — plus the full DC-3 presentation contract**, in **11 new
test files** under `tests/acceptance/0023-phase-2-*.test.js`. Stable **RED** was
confirmed across 5 flakiness reruns on the pre-implementation base (HEAD `02e99c9`, a
descendant of impl_commit `79dcd45`): the acceptance command exits 1 (22/22 FAIL) on
all 5 reruns, the inner command exits 1 (9 FAIL / 2 PASS) on all 5 reruns. The 2
always-green inner tests are intentional (see *Context*). **10 new generator-based
`test.prop` properties** were committed (one per declared parametric rule in the former
Phase 2-6 PBT tables), bringing the cumulative committed property count to **12 genuine
`test.prop` invocations** (2 phase-1 + 10 phase-2) / **20 raw `pbt.import_symbol`
matches** across all `0023-` files — at or above the whole-plan `pbt-floor` of 12. No
frozen test file was edited; no production code was touched.

## Instructions for the next phase (implement, feature-phase 2)
Build detectors for codes **3-22** and wire the run-level seam, making the committed
Phase-2 tests GREEN **without editing any test** (`tests/**` is frozen). All findings
**MUST** be constructed through the existing **`makeFinding`** factory (keeps the
`[contract]` invariants I-3 severity∈enum / I-4 locators≥1 live). `renderErrorReport`
already exists (Phase 1) and is **reused unchanged** — it groups by `category` and
sorts ERROR→WARNING→INFO, so the impl only needs to *produce* findings with the exact
`category`/`severity`/locator shapes below.

**Data-level findings (codes 3-7, 10-22) — collected inside `prepareSimulationData(histQuarters, targetQuarters)`**, appended to the existing additive `findings` array (never mutate any engine input or returned engine value — I-1). Exact contract the tests assert:

| code | severity | category (EXACT label) | locator kind(s) | emit condition |
|---|---|---|---|---|
| `EPIC_OUT_OF_SCOPE` | INFO | `Scope & calibration` | `epic` (id=`_epic_key`) | epic with **non-blank** `_initiative_key` that is out of scope (`!inScope` at the λ loop). Disjoint from ORPHAN. |
| `ORPHAN_EPIC` | WARNING | `Scope & calibration` | `epic` | epic with **blank** `_initiative_key`. Disjoint from EPIC_OUT_OF_SCOPE **and** DANGLING_EPIC_LINK. |
| `QUARTER_NO_EPICS` | WARNING | `Scope & calibration` | `quarter` (id=quarter label) | one per **selected historical** quarter with ≥1 initiative and 0 tagged in-scope epics (`quartersWithEpicData` filter). `impact` must contain the excluded-initiative **count** (integer). |
| `LAMBDA_ZERO` | WARNING | `Run parameters` | `run` | iff the returned `lambda === 0`. |
| `TOTAL_K_ZERO` | WARNING | `Run parameters` | `run` | iff `sum(kPerGroup) === 0`. |
| `DUP_INITIATIVE_KEY` | WARNING | `Duplicates & overlaps` | `initiative` (id=**trimmed** key) | one per trimmed init key occurring ≥2 times; `impact` contains the **row count**. |
| `QUARTER_NORM_VARIANT` | WARNING | `Duplicates & overlaps` | (any) | one per cluster of raw quarter strings that `.trim()`-collapse to one value but differ raw; reference the normalised quarter in message/impact/locators. |
| `HIST_TARGET_OVERLAP` | WARNING | `Duplicates & overlaps` | `quarter` (id=**trimmed** quarter) | quarter-locator id set = `trim(histQuarters) ∩ trim(targetQuarters)`. |
| `INIT_MISSING_KEY` | WARNING | `Initiative integrity` | `row` | per initiatives row whose detected init-key cell is blank. |
| `INIT_BAD_QUARTER` | WARNING | `Initiative integrity` | `row` | per initiatives row whose `quarter` is blank **or** `.trim()` ∉ (hist ∪ target). |
| `INIT_MISSING_TEAM_OR_CATEGORY` | WARNING | `Initiative integrity` | `row` | per initiatives row with blank team **or** blank category cell. |
| `DANGLING_EPIC_LINK` | WARNING | `Initiative integrity` | `epic` | per epic with **non-blank** `_initiative_key` ∉ the full initiative-key set; reference the dangling key. Disjoint from ORPHAN. |
| `TARGET_QUARTER_NO_INITIATIVES` | INFO | `Initiative integrity` | `quarter` | per **selected target** quarter no initiative falls in. |
| `CONSTANT_WORK_EXCLUDED` | WARNING | `Constant work` | ≥1 (any) | **one aggregate** finding iff `getConstantWorkExcluded(targetQuarters, groupsStore).rows > 0`; `impact` must contain that helper's **exact** `pm` AND `rows` (single source — interpolate the raw `cwExcluded.pm`/`.rows`, **no re-rounding**). |
| `MQ_FORWARD_DOUBLE_COUNT` | ERROR | `Multi-quarter initiatives` | `initiative` (id=trimmed key) | per init key in ≥2 **distinct** selected target quarters; `impact` references the target-quarter count; engine math unchanged (I-1). |
| `MQ_PARTIAL_WINDOW_EXCLUSION` | WARNING | `Multi-quarter initiatives` | `initiative` | per historical initiative whose linked epics span quarters with **some out of** the selected hist window; `impact` references the count of excluded epics. |
| `MQ_MULTI_QUARTER_HISTORICAL` | INFO | `Multi-quarter initiatives` | `initiative` | per historical initiative whose **in-window** epics carry >1 distinct quarter. |
| `MQ_INIT_EPIC_QUARTER_MISMATCH` | WARNING | `Multi-quarter initiatives` | `initiative` | per initiative whose declared (row) quarter ≠ its linked epics' quarter(s); reference declared + epic quarters. |

**Run-level findings (codes 8-9) — new pure seam `collectRunLevelFindings({ enteredCapacity, usedCapacity, enteredIterations, usedIterations })` returning `Finding[]`:**
- `CAPACITY_COERCED` (WARNING, `Run parameters`, `run` locator) emitted **iff `enteredCapacity !== usedCapacity`**; message names both values (the tests pass the used `120` and assert it appears).
- `ITERATIONS_CLAMPED` (WARNING, `Run parameters`, `run` locator) emitted **iff `enteredIterations !== usedIterations`**; message names the used value.
- The seam **must not re-read** `#capacity`/`#iterations` — it receives the already-computed entered/used pair (single source, ADR-0037). It must **not** re-derive the coerce/clamp formula.

**Wire it into the run-button handler** (currently calls `renderErrorReport(findings)` with only `prepareSimulationData`'s findings): concatenate the run-level findings, e.g.
```
const runLevel = collectRunLevelFindings({
  enteredCapacity:   parseFloat(document.getElementById('capacity').value),
  usedCapacity:      capacity,            // = parseFloat(...) || 120  (already computed)
  enteredIterations: parseInt(document.getElementById('iterations').value, 10),
  usedIterations:    iters,               // = min(1e7, max(1000, parseInt(...) || 1e6))
});
renderErrorReport(findings.concat(runLevel));
```
(The Phase-1 handler already resets to the org tab and hides `#tab-error-report`; keep that.)

## Files the next phase MUST read
- `docs/plans/0023-error-report-tab.md` — **`## Phase 2`** (codes 3-22 + the `### (former Phase 2-6)` sub-sections: scenarios, behavioral rules, invariants, properties, counterexamples, forbidden shortcuts) and *Data models → Finding / Finding codes / Collection seams*.
- `docs/atdd-logs/0023-error-report-tab-phase-2-acceptance-red.log` — acceptance command + RED proof.
- `docs/atdd-logs/0023-error-report-tab-phase-2-inner-red.log` — property command + the 9 shrunk counterexamples (the highest-signal targets) + which 2 tests are intentionally green.
- `docs/atdd-logs/0023-error-report-tab-phase-2-flakiness.log` — the stable-RED 5× rerun proof.
- The 11 committed test files (the contract — **do not edit**):
  `tests/acceptance/0023-phase-2-acc-{scope-exclusions,run-parameters,duplicates-overlaps,integrity,multi-quarter,presentation}.test.js` and
  `tests/acceptance/0023-phase-2-prop-{scope,coercion,duplicates,integrity,presentation}.test.js`.
- `tests/acceptance/0023-phase-1-*.test.js` — the FROZEN, GREEN phase-1 tests (must stay green) + the seam-usage pattern mirrored here.
- `index.html` — `prepareSimulationData` (~2135), `makeFinding` (~2118), `renderErrorReport` (~2277), `getConstantWorkExcluded` (~1981), `bucketRowsByGroups` (~2070), the run-button handler (~4755, capacity `4762` / iters `4763-4764`).
- The **test commit SHA** = `git log -1 --format=%H -- docs/backlog/0023-error-report-tab/handover-10-atdd-p2.md` (this handover's commit, per LOOP-MODE.md).

## Context the next phase needs
**Autonomous decisions taken (no user in loop):**
1. **Seams (committed contract).** Used exactly the plan's named seams — `prepareSimulationData(...).findings` (codes 3-7, 10-22), the new pure `collectRunLevelFindings({enteredCapacity,usedCapacity,enteredIterations,usedIterations})` (codes 8-9), `renderErrorReport(findings)`, and the rendered `#tab-error-report` DOM. **No private detector helper name is asserted** — tests assert only `code/severity/category/locators/impact/message` and panel text, so the impl is free to structure helpers however it likes.
2. **File/command split.** 11 files under one consolidated Phase 2; acceptance files prefixed `0023-phase-2-acc-`, property files `0023-phase-2-prop-`. The two RED commands are vitest substring filters — **`npx vitest run 0023-phase-2-acc`** and **`npx vitest run 0023-phase-2-prop`** — which the gate's RED re-check (c) re-runs verbatim. Both exit 1 on the pre-impl tree.
3. **Normalisation = `.trim()` only (NO lowercase)** for init keys and quarters, mirroring the engine (`(r[initKeyCol]||'').trim()`, `(r.quarter||'').trim()`). So only **whitespace** variants collapse; case variants do **not**. The harness Papa stub trims every CSV cell, so raw whitespace-variant tests set `editedInitiatives` directly after a baseline load (see the `*-prop-duplicates` / `*-acc-duplicates-overlaps` / `*-prop-presentation` files).
4. **`EPIC_OUT_OF_SCOPE` vs `DANGLING_EPIC_LINK` may co-occur** on a truly-unknown-key out-of-scope epic — the plan only mandates ORPHAN⊥OUT_OF_SCOPE and ORPHAN⊥DANGLING, so the scope-partition property (`prop-scope`) treats unknown-key-out-of-scope epics as OUT_OF_SCOPE and the integrity-partition property (`prop-integrity`) treats them as DANGLING; both must hold simultaneously.
5. **`CONSTANT_WORK_EXCLUDED` single-source.** `prop-integrity` asserts the finding's `impact` contains the **exact** `getConstantWorkExcluded(...)` `pm` and `rows` (via numeric-token extraction, `===`). Interpolate the raw `cwExcluded.pm`/`.rows` the run path already computes — do **not** re-sum or `toFixed` (that violates ADR-0037 single source and fails the property).
6. **Two intentionally-green inner tests.** `prop-presentation` property 1 (renderErrorReport ordering + badge) and the `prop-scope` "no Epics ⇒ no findings" example are **green on the current base** (renderErrorReport shipped in Phase 1). They are regression guards the impl must keep green; the inner command is RED via the other 9 properties (`prop-coercion` fails for every input since the seam is absent), so the RED is seed-independent and stable.
7. **Boot smoke = PASS.** `smoke_command` is empty; the minimal check (run the frozen phase-1 suite) was GREEN (13/13) on the inherited base — built Phase-2 tests on a healthy tree.

**Counterexamples / forbidden shortcuts** (from the plan, enforced by the tests): no epic/row/key identity special-casing; read-only collection (no mutation of `editedInitiatives`/`parsedEpics`/`editedConstantWork` or any engine value); no clock/RNG; explicit sort (renderErrorReport already does); detectors must agree with the engine's actual `.trim()` normalisation and reuse `getConstantWorkExcluded`; **do not** alter `kPerGroup`/`targetInits` to "fix" the multi-quarter double-count (DC-5 — report at ERROR only).

## Definition of done (for implement, feature-phase 2)
- All 11 Phase-2 test files GREEN, and the frozen phase-1 tests still GREEN, under `npm run verify` on a hermetic, network-disabled fresh checkout (`npm ci`); stable across `stability.green_reruns` + randomized order.
- Every new finding is built via `makeFinding` (I-3/I-4 live); the gate's PBT floor (f) and the contract floor remain satisfied.
- `npm run verify` static layers green (lint/SAST/dep/secret/forbidden-pattern; typecheck/sanitizer/mutation N/A for this repo).
- Production-only diff (no `tests/**` edits — gate sub-check (a)); the run never changes the engine output (I-1) and a fatal Run still renders no report.
