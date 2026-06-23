---
schema: backlog-handover/v1
task_id: "0023"
produced_by_phase: plan
feature_phase: 2
for_next_phase: atdd
outcome: success
reason: ""
produced_at: 2026-06-23T08:00:00Z
produced_commit: 79dcd45d80f09efb7b13c44738deb98e4373a441
test_commit: 36d5b1c8c94e2e40c62787d660a2354622655daa
---
## Summary
**Operator re-plan** (human-directed, outside the autonomous loop) that unblocks the
atdd deadlock recorded in `handover-08-atdd-p1.md`. Two root causes were fixed:

1. **Orphaned review fix recovered.** The integrity review (`0f1db56`) FAILed phase 1 on
   dead `[contract]` invariants I-3/I-4. The implement re-run that fixed them — `d9a720d`
   (a `makeFinding` factory asserting severity∈enum and locators≥1) — was orphaned by the
   auth-failure recovery `01d8397` (which reset `stage→atdd` but left the OLDER impl
   `d77e0ab` in HEAD and dropped `d9a720d` from ancestry). Its `index.html` delta has been
   **re-applied** on top of the now-shipped 0024 work at commit
   **`79dcd45`** — `npm run verify` green (275 passed, 1 skipped). Phase 1's `[contract]`
   invariants are LIVE again.

2. **Thin-slice ↔ whole-plan `pbt-floor` mismatch resolved.** The gate's `pbt-floor`
   (`gate_pbt_required_props`) counts the **whole plan's** parametric rules (**12**) but
   the plan was 6 thin slices of ~2 properties each — so no intermediate phase could ever
   reach a 12-floor, and every one would rewind to atdd. The plan
   (`docs/plans/0023-error-report-tab.md`) has been **re-structured**: Phase 1 (codes 1-2)
   is marked **DELIVERED**; former Phases 2-6 are **consolidated into a single Phase 2**
   (codes 3-22 + full presentation contract). The former phase bodies are preserved
   **verbatim** as `###` sub-sections; the **12** PBT property rows are unchanged. State is
   now `stage: atdd`, `current_phase: 2`, `total_phases: 2`, `status: ready`.

This handover is the input to the **Phase-2 atdd** run.

## Instructions for the next phase (atdd, feature-phase 2)
You operate on **`## Phase 2`** of the plan (codes 3-22 + the full DC-3 presentation
contract). The base commit is **`79dcd45`** — a **post-Phase-1** tree (the tab, the
finding model, `makeFinding`, `renderErrorReport` mechanics, and codes 1-2 already exist
and are GREEN), but **codes 3-22 are unimplemented**, so tests targeting them are
genuinely RED on this base. Your RED gate is therefore satisfiable here (unlike the
deadlocked phase-1 re-run, which inherited an impl that made its committed RED commands
GREEN).

1. **Author NEW test files only** — `tests/acceptance/0023-phase-2-*.test.js` (acceptance
   + property). **Do NOT edit the frozen `tests/acceptance/0023-phase-1-*.test.js`** (they
   are committed, GREEN, and stay).
2. **Cover every `## Phase 2` scenario** — all the `### (former Phase N)` sub-sections:
   scope/calibration (codes 3-5), run-parameters (6-9), duplicates/overlaps (10-12),
   initiative integrity + constant-work (13-18), multi-quarter + presentation (19-22 +
   AT-5 full-presentation). Use ONLY the plan's named seams —
   `prepareSimulationData(histQs, targetQs).findings`,
   `collectRunLevelFindings({...})`, `renderErrorReport(findings)`, and the rendered
   `#tab-error-report` DOM — never private detector helper names.
3. **PBT floor — front-load ALL remaining properties.** The whole-plan floor is **12**
   committed `fc.property|test.prop|it.prop` invocations; phase 1 committed **4**. Author a
   property test for **each of the 10** property rows in the `### Properties / invariants to
   PBT` tables of former Phases 2-6, so the cumulative committed count reaches **≥14 ≥ 12**.
   (If fewer are authored, the Phase-2 implement gate will rewind here again on `pbt-floor`.)
4. **RED evidence.** Confirm a **stable RED** across `test_immutability.flakiness_reruns`
   (5) — both the acceptance and the property command exit non-zero on all 5 reruns —
   and write the `*-phase-2-*-red.log` artifacts under `docs/atdd-logs/`. The gate's RED
   re-check (sub-check c) re-runs these exact command headers against your atdd commit and
   requires a non-zero exit; on the `79dcd45` base they fail (RED) because codes 3-22 are
   absent.
5. Implementation (a later phase) will build codes 3-22 routing every finding through the
   existing **`makeFinding`** factory (keeping I-3/I-4 live) and complete the
   `renderErrorReport` cross-category presentation; do not touch production code now.

## Files the next phase MUST read
- `docs/plans/0023-error-report-tab.md` — the re-structured plan. Read **`## Phase 2`**
   end-to-end (it runs to EOF and contains all `### (former Phase 2-6)` sub-sections), plus
   *Data models → Finding / Finding codes / Collection seams* and the Phase-1 DELIVERED note.
- `docs/backlog/0023-error-report-tab/index.md` — scheduling state (stage atdd,
   current_phase 2, total_phases 2, impl_commit `79dcd45`, test_commit `36d5b1c`).
- `tests/acceptance/0023-phase-1-*.test.js` — the FROZEN phase-1 tests (the seam-usage
   pattern to mirror; do not edit).
- `tests/harness.js` and a 0020/0021 acceptance test — the `loadSimulator`/`evalIn`/
   `execIn`/`read`/`csv` harness pattern.
- `backlog.config.json` — `pbt` block (framework fast-check, import_symbol
   `fc.property|test.prop|it.prop`, min_per_rule 1), `test_immutability.flakiness_reruns` 5.

## Context the next phase needs
- **Why RED is achievable now (vs the handover-08 deadlock).** handover-08's blocker was
   that atdd inherited a tree where the *phase-1* committed RED commands were GREEN. Phase 2
   targets **different, unimplemented** behavior (codes 3-22), so its NEW RED commands fail
   on `79dcd45`. The phase-1 RED logs are not re-run for phase 2 (the gate reads
   `*-phase-2-*-red.log`).
- **Do NOT reset `index.html` to `36d5b1c`.** handover-08's remedy 1 said to — but
   `36d5b1c` predates ALL of 0024's shipped work (0024's feature lives in the same
   `index.html`). Resetting would destroy 0024. The base for this phase is `79dcd45`, which
   carries both 0024 and the recovered phase-1 fix. This was the human's explicit choice.
- **The 22 code→severity→category contract** (plan *Data models → Finding codes*) is
   unchanged; the `phase` column there still shows the original 1-6 split for provenance
   only — all of codes 3-22 are this single feature-phase 2.

## Strategic note for the human (NOT actionable by the loop)
This re-plan works around the `pbt-floor` for THIS task, but the underlying tooling
behaviour will bite **any** future thin-slice plan: `gate_pbt_required_props`
(`~/code/backlog/lib/gate.sh`) counts the **whole plan's** property rows, with no
per-phase scoping and no config knob — so a plan with N total properties spread over
thin phases will rewind every phase whose cumulative committed count is `< N`. If
thin-slice plans are meant to be first-class, consider making the floor **per-phase**
(scope sub-check (f) to the current phase's declared parametric rules) in the tooling
repo. That is a change to trusted enforcement code (broad blast radius; the in-repo
config cannot relax it), so it is left as a deliberate human decision, not done here.

## Definition of done
The Phase-2 atdd commit confirms a **stable RED** (both `*-phase-2-*` commands exit
non-zero across all 5 flakiness reruns on base `79dcd45`), AND the cumulative committed
`fc.property|test.prop|it.prop` invocation count across all `0023-`-prefixed test files is
**≥12** (satisfying the whole-plan floor for this and every later phase). No frozen
test file is edited; no production code is touched by the atdd phase.
