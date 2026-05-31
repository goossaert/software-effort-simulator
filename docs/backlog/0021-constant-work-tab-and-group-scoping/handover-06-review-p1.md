---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: review
feature_phase: 1
for_next_phase: atdd
outcome: success
reason: ""
produced_at: 2026-05-31T20:45:15Z
produced_commit: ""
test_commit: 784f6eeec39b5ad0121c2c7ab4a9bc1582ea03c4
impl_commit: 355c2b8878f29dcb0971a886f66561eb700c4271
---
## Summary

Independent review of feature 0021 **Phase 1** (the `editedConstantWork`
substrate). Verdict **PASS**. The implementation is the general substrate rule
the plan specifies and nothing more: `editedConstantWork` declared adjacent to
`parsedConstantWork`, built as a per-row shallow clone (`.map(r => ({ ...r }))`)
at load, nulled alongside `parsedConstantWork` on reset, and read by all three
production readers (`getConstantWorkEffort`, `getConstantWorkEpics`,
`buildTeamProjections`' `cwQuarters`). All six plan invariants hold, none of the
six counterexamples is present, no forbidden shortcut taken, no test file drifted
between `784f6ee..355c2b8`, and no test-gaming pattern exists. Targeted suite
(39/39) and `npm run verify` (160 passed / 1 pre-existing skip) both exit 0; a
negative-control mutation of the core reader is caught by AT-4. The task advances
to **Phase 2 atdd**.

## Instructions for the next phase

`atdd` (feature-phase **2** — "Per-Group constant-work shift at the org
headline", plan lines ~400+):

1. Read the plan's **Phase 2** slice in full for the behavioral rule, invariants,
   counterexamples, forbidden shortcuts, and the **load-bearing test-contract
   migration** it mandates.
2. Author `tests/acceptance/phase-2-*.test.js` for AT-1…AT-10 of Phase 2 and
   **migrate the frozen existing tests Phase 2 names** before any implementation:
   - `tests/acceptance/phase-1-engine.test.js` **AT-11, AT-12, AT-13, AT-14,
     AT-25, AT-26, AT-27** — `runSimulation`'s scalar `fixedEffort` becomes the
     vector `fixedEffortPerGroup`. **AT-12 changes semantics**: a zero-member
     Group's shift is now the sum of constant work in `[]` (i.e. `0`), not the
     old scalar. (Note AT-25 currently still passes `fixedEffort: 0` — that call
     is the Phase-2 migration target.)
   - `tests/verification/sanity-check-engine-mean.test.js` — the engine-mean
     identity becomes per-Group: `mean_g ≈ K_g × λ × E[size] + fixedEffortPerGroup[g]`.
   - `tests/verification/phase-1-2-review-01.test.js` — `fixedEffort: 0` →
     `fixedEffortPerGroup: [0, …]`.
3. Confirm a clean RED gate, freeze the tests, write the atdd handover.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — **Phase 2** slice (behavioral rule / invariants / counterexamples / forbidden shortcuts / DoD) **and** the "Test-contract migration (load-bearing)" note near the top (lines ~22-27) listing exactly which existing tests Phase 2 migrates.
- `docs/backlog/0021-constant-work-tab-and-group-scoping/handover-03-plan.md` — the plan handover (input to every atdd cycle; `next_handover` points here).
- `index.html` — Phase 1 left `runSimulation` (~`2272`) still on the scalar `fixedEffort`; Phase 2 changes its contract. Read `prepareSimulationData` (~`1866-1947`), `bucketRowsByGroups` (~`1824-1857`), `getConstantWorkEffort` (~`1755`), the auto-default `All` block (~`1580-1591`), and the org run-button handler (~`4154-4161`).
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` — the per-Group scoping rationale (the Phase 2 core).
- `tests/acceptance/phase-1-engine.test.js` — the tests Phase 2 migrates (AT-11…AT-14, AT-25, AT-26, AT-27); read before touching.
- `docs/reviews/0021-constant-work-tab-and-group-scoping-phase-1-review-01.md` — this review (the PASS record + evidence).

## Context the next phase needs

Autonomous decisions taken this review session (Loop mode — no user):

- **Verdict PASS, taken autonomously.** Every gate (Step 6 negative control,
  Step 7 additional-tests decision) was resolved without user input and is
  recorded in the review file.
- **Diff range.** `test_commit = 784f6ee` (`handover-04-atdd-p1.md`),
  `impl_commit = 355c2b8` (`handover-05-implement-p1.md`). The range also
  contains the unrelated commit `3029009` ("Changed model to Opus for all
  stages") which touched **`backlog.config.json`** (loop model selection). That
  is orchestration config, **not** a test-runner / coverage / timeout config —
  it cannot affect pass/fail and is **not** a gaming pattern. Recorded so the
  fact is not mistaken later for a silent test-config edit.
- **Negative control.** Mutated `index.html:1759`
  `for (const r of editedConstantWork)` → `parsedConstantWork`; targeted run
  exited 1 with AT-4 failing; reverted; targeted run exited 0 (39/39); working
  tree clean. The mutation is **not** in this commit.
- **No additional verification tests written.** The committed acceptance suite
  already has a catching test for every invariant and all six counterexamples
  (see review Step 4 mapping); the negative control proves the suite fails on a
  real regression. Adding tests would be redundant.

## Definition of done (for the Phase 2 atdd consumer)

- Phase 2 acceptance tests authored + the named existing tests migrated and
  frozen, with a clean RED gate confirmed and logged.
- No production code written in the atdd phase.
- atdd handover written; stage advances to `implement` for Phase 2.
