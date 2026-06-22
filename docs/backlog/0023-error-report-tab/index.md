---
schema: backlog-index/v1
id: "0023"
slug: error-report-tab
title: Error Report tab
stage: review
status: ready
priority: normal
flagged_for_human: false
total_phases: 6
current_phase: 1
retry_count: 0
max_retries: 3
next_handover: handover-05-implement-p1.md
updated_at: 2026-06-22T20:42:02Z
created_at: 2026-06-22T18:49:16Z
blocked_reason: ""
artifacts:
  plan: docs/plans/0023-error-report-tab.md
  test_commit: 36d5b1c8c94e2e40c62787d660a2354622655daa
  impl_commit: d77e0abc6f340e4915560b91bf4fad942839c8ee
---
# 0023 — Error Report tab

Add a new advisory **Error Report** results tab (slug `error-report`, last in the
tab bar; org stays the resting tab) that, after a Run **completes**, lists
data-quality findings the simulator otherwise handles silently — unrecognized
t-shirt sizes, out-of-scope/orphan epics, historical quarters with no loaded
epics, duplicate initiative keys and quarter-label variants, degenerate λ=0 /
total-K=0 runs, capacity/iterations coercion, constant-work categories matching no
Group, and the four multi-quarter-initiative conditions.

Findings are collected by **instrumenting the actual Run path** (so the report can
never disagree with what the simulation computed) and are **advisory only**: the
report never aborts or alters a Run, and the two existing hard stops are unchanged.
The known multi-quarter forward double-count is **reported at ERROR but not fixed**
here — the underlying per-key-vs-per-row unit-consistency fix is a separate future
task. See [ADR-0037](../../adr/0037-error-report-advisory-diagnostics.md).

> **apply-docs done (2026-06-22):** the five glossary terms are in `CONTEXT.md`
> (four new + the pre-existing **Recognised t-shirt size** augmented in place) and
> ADR-0037 is created; toolchain was already selected (no-op). Next stage: **plan**.
>
> **plan done (2026-06-22):** `docs/plans/0023-error-report-tab.md` written with
> **`total_phases: 6`** thin vertical slices — (1) tab + finding model + render +
> empty state + unrecognised-size; (2) scope/calibration exclusions; (3)
> run-parameter / degenerate-run findings; (4) duplicates & overlaps; (5) initiative
> & cross-ref integrity + constant-work exclusion; (6) multi-quarter section + full
> presentation contract. AC-1…AC-13, I-1…I-5, and DC-1…DC-5 are formalised (not
> re-decided); the 22 test-facing `code`s + per-code severities are pinned in the
> plan's Data models. Next stage: **atdd** (feature-phase 1).
>
> **atdd p1 done (2026-06-22):** Phase-1 acceptance + property tests committed
> under `tests/acceptance/0023-phase-1-*.test.js` (6 acceptance AT-1…AT-5 + 7
> inner/property tests incl. 2 `fast-check` properties). **Stable RED** confirmed
> across 5 flakiness reruns (acceptance 5/5 exit 1, inner 5/5 exit 1); RED logs in
> `docs/atdd-logs/0023-error-report-tab-phase-1-*.log`. Tests target only the named
> seams (`prepareSimulationData(...).findings`, `renderErrorReport(findings)`, the
> rendered `#tab-error-report` DOM). Next stage: **implement** (feature-phase 1).
>
> **human fix — UNBLOCKED (2026-06-22):** the implement-phase block is resolved. A
> human (operator-approved) **migrated** the two conflicting frozen tab-bar
> assertions to the 7-tab reality — exactly the precedent set when feature 0021
> Phase 6 migrated 0020-AT-1 for the Constant work tab:
> - `0020-phase-2-groups-tab.test.js` AT-1 → `toHaveLength(7)`, slug array now ends
>   `…, 'groups', 'error-report'`; Groups asserted sixth, **Error Report** last.
> - `0021-phase-6-constant-work-tab.test.js` AT-1 → same array; Constant work fifth,
>   Groups sixth (its invariant — Constant work immediately before Groups — unchanged).
>
> The 0023 Phase-1 tests are **unchanged**. `npm run verify` now exits **0** (247
> passed, 1 skipped). The migration lands in a **separate chore commit that is a
> descendant of the implement commit `d77e0ab`**, so the integrity review's diff
> range `test_commit (36d5b1c) .. impl_commit (d77e0ab)` stays **production-only with
> zero test-file changes** (stage-review immutability rule satisfied). The implement
> production code is complete and committed at `d77e0ab`; advanced to **review**
> (feature-phase 1) reading `handover-05-implement-p1.md`.
>
> **implement p1 BLOCKED (2026-06-22):** Phase-1 production code is complete (13/13
> Phase-1 tests pass stably) but `npm run verify` exits 1 because frozen tests
> `0020-AT-1` and `0021-AT-1` assert `toHaveLength(6)` + exact slug array ending in
> `groups` — both break with the 7th `error-report` tab button required by 0023-AT-1.
> Human test-fix needed: loosen 0020/0021 AT-1 to check positional relationships
> (constant-work=5th, groups=6th) rather than total count. See
> `handover-05-implement-p1.md` for proposed fix. **`flagged_for_human: true`.**
