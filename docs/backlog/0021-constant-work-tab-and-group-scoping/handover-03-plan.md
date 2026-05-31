---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: plan
feature_phase: null
for_next_phase: atdd
outcome: success
reason: ""
produced_at: 2026-05-30T07:22:10Z
produced_commit: e3dc6be
---
## Summary

The plan for feature 0021 is written to
`docs/plans/0021-constant-work-tab-and-group-scoping.md` and conforms to
`PLAN-TEMPLATE.md`. It decomposes the feature into **`total_phases: 8`** thin vertical
slices, each with acceptance scenarios (AT-N), a public entry point, expected observable
outcomes, test-harness locations, proposed seams, a behavioral rule, invariants,
counterexamples, forbidden shortcuts, a RED gate, a test-immutability rule, and a
definition of done. Outcome: success — ready for the `atdd → implement → review` cycle,
beginning at `current_phase: 1`.

**This handover is the input to EVERY atdd cycle** (phases 1 through 8). After each review
PASS for phase `k < 8`, the loop sets `next_handover` back to this file for the atdd of
phase `k+1`. Always work the `Phase <current_phase>` slice named in `index.md`.

## Instructions for the next phase

`atdd` (per feature-phase `<current_phase>`):

1. Read `docs/plans/0021-constant-work-tab-and-group-scoping.md` and extract the
   `Phase <current_phase>` slice: its acceptance scenarios, entry point, observable
   outcomes, test-harness locations, seams, behavioral rule, invariants, counterexamples,
   forbidden shortcuts, and RED gate.
2. Write the acceptance tests (and inner tests where the slice names a separate inner seam)
   in the locations the plan specifies, under `tests/acceptance/` / `tests/verification/`
   using `tests/harness.js`. Apply triangulation (happy / boundary / negative / property).
3. **Migrate the existing committed tests this phase names — during RED authoring, not
   implementation** (see the plan's "Test-contract migration" note). Then freeze all tests:
   - **Phase 1** migrates `tests/acceptance/phase-1-engine.test.js` **AT-21, AT-27**.
   - **Phase 2** migrates `phase-1-engine.test.js` **AT-11–AT-14, AT-25, AT-26, AT-27**,
     `tests/verification/sanity-check-engine-mean.test.js`, and
     `tests/verification/phase-1-2-review-01.test.js` (AT-12 changes semantics).
   - **Phase 6** migrates `tests/acceptance/phase-2-groups-tab.test.js` tab-count (5 → 6).
   - **Phase 8** migrates `phase-2-groups-tab.test.js` **AT-28** (popover source union).
4. Confirm the RED gate: run `npm run verify`, persist the RED logs to
   `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-<current_phase>-acceptance-red.log`
   (and `…-inner-red.log` when an inner gate exists). Do not write production code.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the full plan; the `Phase <current_phase>` slice is the spec (behavioral rules, invariants, counterexamples, RED gate, test-immutability rule).
- `CONTEXT.md` — glossary; use canonical terms (Constant work, Category, Group, Scenario, Target quarter, Constant work tab, Data preview, Projection group).
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` — engine semantics: per-Group `fixedEffortPerGroup`, Category scoping on all three surfaces, exclusion-but-surfaced, target-quarter-only, `globalMin` = min per-group shift.
- `docs/adr/0034-editable-constant-work-tab.md` — `editedConstantWork` substrate, the sixth tab, smart per-field editors, add/delete/from-scratch, CSV export, commit-on-Run.
- `docs/adr/0023-constant-work-csv-deterministic-shift.md` — the retained deterministic mechanism (closed-form lognormal mean, post-sort shift, Synthetic↔Empirical toggle).
- `docs/adr/0027-editable-initiatives-tab-with-csv-export.md` — the editable-tab pattern phases 1/6/7 mirror.
- `docs/adr/0028-category-as-generalized-moscow.md` — case-insensitive Category comparison + the (Blank) sentinel.
- `docs/adr/0029-user-defined-groups-supersede-cumulative-moscow.md` — the user-defined Group model phases 2/3/4/8 extend.
- `tests/harness.js` — how to instantiate the jsdom harness, `read`/`evalIn`/`typeOf` helpers, and call the runner.

## Context the next phase needs

- **The plan is the contract**: do not re-derive design; everything atdd needs is in the
  `Phase <current_phase>` slice plus the cited ADRs and CONTEXT.md.
- **Test immutability**: tests authored (and the named legacy tests migrated) in this atdd
  session are frozen; the `implement` phase must not edit any test file.
- **Phase ordering matters**: phase 2 changes the `runSimulation` contract
  (`fixedEffort` scalar → `fixedEffortPerGroup` vector), so its test migration is
  load-bearing; phase 1 is the transparent-indirection substrate (`editedConstantWork`)
  that must keep Run output unchanged (AT-8).
- **Verify command**: `npm run verify` (added to `package.json` as `vitest run`).

## Definition of done (for atdd)

The `Phase <current_phase>` acceptance (and any inner) tests are written and committed, the
named legacy tests are migrated and frozen, the RED gate is confirmed with persisted RED
logs under `docs/atdd-logs/`, no production code was written, and `index.md` is advanced to
`stage: implement` with `next_handover: handover-NN-atdd-p<current_phase>.md`.
