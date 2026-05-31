---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: review
feature_phase: 5
for_next_phase: atdd
outcome: success
reason: ""
produced_at: 2026-05-31T22:40:04Z
produced_commit: ""
test_commit: 0d56a924362b78faf32023661c8fbab9002830dd
impl_commit: 1e4e617229440363ac1889b73d748b0072d04a57
---
## Summary

Independent verification of feature 0021 **Phase 5** (constant-work quarters in
the **Target** selector + **Data preview** surfacing of per-Group constant-work
PM and exclusions). Verdict **PASS**. The diff `0d56a92..1e4e617` is
`index.html`-only (plus loop bookkeeping); no test file drifted. The general rule,
all 5 invariants, and the forbidden-shortcut constraints hold; none of the 5
counterexamples is realizable. Two negative-control mutations were each caught and
reverted. Targeted acceptance (6 passed) and `npm run verify` (189 passed / 1
skipped) both exit 0. Review file:
`docs/reviews/0021-constant-work-tab-and-group-scoping-phase-5-review-01.md`.

## Instructions for the next phase

`atdd` for **Phase 6** — *Constant work tab: editable table with smart per-field
editors and CSV export* (plan lines ~903+). This is the start of a new
feature-phase cycle: read the plan's Phase 6 slice and `handover-03-plan.md` (the
task-level plan handover), author
`tests/acceptance/phase-6-*.test.js` (AT-1…AT-N per the plan), perform any legacy
test migration the plan calls for, confirm the RED gate, and write
`docs/atdd-logs/0021-…-phase-6-*` logs. Phase 6 is UI-heavy (a sixth tab,
per-field editors, add/delete rows, from-scratch authoring, CSV export) — read the
plan's Phase 6 seams and definition-of-done carefully before choosing test seams.

Phase 5 is complete and frozen; no Phase 5 follow-up is required.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the **Phase 6** slice
  (acceptance behavior, seams, invariants, counterexamples, RED gate, DoD).
- `docs/backlog/0021-constant-work-tab-and-group-scoping/handover-03-plan.md` — the
  task-level plan handover (input to every atdd cycle).
- `index.html` — the production file (`editedConstantWork` substrate from Phase 1,
  the tab bar / visibility-reset block, existing per-field editor patterns for the
  Initiatives tab to mirror, `tshirtToPersonMonths` / Recognised t-shirt sizes).
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` and
  `docs/adr/0028-category-as-generalized-moscow.md` — constant-work + Category
  semantics.
- `CONTEXT.md` — glossary (Constant work, Recognised t-shirt sizes, CSV export).

## Context the next phase needs

Autonomous decisions taken during this review (no user in Loop mode):

- **Two negative-control mutations** (rather than one) were run to cover both core
  Phase 5 rules: (A) `histMS.populate(all)` → `histMS.populate(allTarget)` made
  AT-1 and AT-3 fail (exit 1) — the selector-source split is genuinely guarded;
  (B) removing the `if (inSomeGroup) continue;` guard in `getConstantWorkExcluded`
  made AT-5 and AT-6 fail (exit 1) — the overlap-aware exclusion is genuinely
  guarded. Both reverted; targeted run restored to 6 passed (exit 0); working tree
  confirmed clean (`git status --porcelain` empty) before this commit.
- **No additional verification tests written.** Counterexamples 1–4 are each pinned
  by a positive+negative assertion pair in AT-1/AT-3/AT-4/AT-5 (two confirmed by the
  mutations). Counterexample 5 (a Run gate/alert when constant work is excluded) has
  no dedicated test, but is an *absence* — confirmed structurally from the diff (the
  only Run-path change is the preview fields + `renderPreview` surfacing; no
  `alert()`/modal/early-return/gate keyed on excluded work). The plan permits
  surfacing-only, so this is an acceptable coverage observation, not a defect; a
  brittle "no alert" spy would add little signal.
- **`'Q2 2026'`/`'Q3 2026'` literals are not gaming.** They are pre-existing
  default-selection quarters: the `histDef` line is byte-for-byte unchanged in the
  diff; `targetDef` only swaps `all`→`allTarget`. App demo defaults, not
  test-keyed branches.
- **1 skipped test** in `npm run verify` is the pre-existing self-skipping
  `tests/verification/sanity-check-engine-mean.test.js` (from Phase 2), not a
  Phase 5 skip.

## Definition of done

This phase is done: review file written and appended to `index.md`
`artifacts.reviews`; `index.md` advanced to `stage: atdd`, `current_phase: 6`,
`retry_count: 0`, `next_handover: handover-03-plan.md`; this handover written with
`outcome: success`; all committed atomically under the `docs/backlog/.lock`. The
loop reads `outcome: success` (= PASS) and proceeds to Phase 6 atdd.
