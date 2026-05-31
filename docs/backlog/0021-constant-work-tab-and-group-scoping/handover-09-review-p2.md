---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: review
feature_phase: 2
for_next_phase: atdd
outcome: success
reason: ""
produced_at: 2026-05-31T21:26:54Z
produced_commit: ""
test_commit: 59744d9d99c8c667fa563b1f7cd1b5a2b315ed75
impl_commit: 54563abe092e021a9fcdafa14cd5121fb64083c9
---
## Summary

Independent review of feature 0021 **Phase 2** (per-Group constant-work shift at
the org headline). Verdict **PASS**. The diff (`59744d9..54563ab`, `index.html`
only) implements the **general** per-Group rule, not fixture-keyed shortcuts: the
scalar `fixedEffort` is fully removed from `runSimulation`'s parameter **and**
return (replaced by the aligned vector `fixedEffortPerGroup`);
`getConstantWorkEffortPerGroup` buckets `editedConstantWork` by Category with the
exact `trim`+case-fold+BLANK semantics of `bucketRowsByGroups` and never feeds
`kPerGroup`/λ/the bootstrap pool; `globalMin = min(...)` (empty-safe); the
auto-default `All` Group unions initiative ∪ constant-work Categories via the
existing `confirmLoadGroupsReplacement` pristine heuristic and freezes on user
modification (the un-migrated AT-29 fires-once contract preserved). None of the
seven counterexamples is present; all seven invariants hold; **no test file
drifted** across `test_commit..impl_commit`. Two negative-control mutations both
failed the suite and were reverted. Targeted command (47 pass / 1 skip) and
`npm run verify` (172 pass / 1 skip) both exit 0.

## Instructions for the next phase

`atdd` (feature-phase **3** — Team Level surface honors Category-scoping). Read
the input handover named in `index.md` `next_handover` (`handover-03-plan.md`, the
plan handover that is input to every atdd cycle) and operate on the plan's
**Phase 3** slice (lines ~570-661): `prepareTeamSimulationData` replaces its
per-team scalar `fixedEffort` (`index.html:2162`,
`getConstantWorkEffort(targetQuarters, teamName)`) with a per-team
`fixedEffortPerGroup` — team match AND Category membership — and `renderTeamSection`
(`index.html:~2728-2741`) consumes it instead of broadcasting `td.fixedEffort`
uniformly.

Note the seam Phase 2 already left in place for Phase 3: the helper
`getConstantWorkEffortPerGroup(quarters, groups, teamName = null)` already accepts
an optional `teamName` filter (unused at the org call site, which passes `null`).
Phase 3 reuses it with the team name. `getConstantWorkEffort` (the scalar) is
still live (used by `prepareTeamSimulationData` → `td.fixedEffort`) and is Phase 3's
to replace.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — **Phase 3** slice
  (AT-1…AT-5, invariants, counterexamples, forbidden shortcuts, DoD).
- `index.html` — `prepareTeamSimulationData` (`~1960-2060`, scalar at `2162`),
  `renderTeamSection` (`~2728-2741`, the uniform broadcast to replace), and the
  already-present `getConstantWorkEffortPerGroup` helper (`~1830`).
- `tests/acceptance/phase-1-engine.test.js` — AT-25 (Team Level stats) was
  migrated to the vector in Phase 2 and is green; confirm it stays green.
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` — engine semantics.
- `docs/adr/0028-category-as-generalized-moscow.md` — case-insensitive Category +
  (Blank) sentinel.

## Context the next phase needs

Autonomous decisions taken this review session (Loop mode — no user at any gate):

- **Verdict PASS, taken autonomously.** All rules in the skill's "Rules" block
  were applied: no gaming pattern found ⇒ not forced to FAIL; no test file changed
  between `test_commit..impl_commit` (`git diff 59744d9..54563ab -- tests features
  e2e acceptance` empty) ⇒ not forced to FAIL; both negative controls ran with
  real non-zero/zero exit codes ⇒ not BLOCKED.

- **Negative control chose two mutations** on the two load-bearing rules rather
  than one: (A) `shifts[i]` → `shifts[0]` (uniform shift) failed AT-5 + AT-11
  (2 failed, exit≠0); (B) `Math.min(...shifts)` → `Math.max(...shifts)` failed
  AT-6 on the `[8,3]` vector (1 failed, exit 1). Both reverted; working tree
  verified clean (`git status --porcelain` empty, `git diff 54563ab -- index.html`
  empty) before the commit.

- **No additional verification tests written.** The committed AT-1…AT-11 already
  cover every Phase 2 invariant and counterexample (AT-5 property over `[0,5,12]`
  + `not.toHaveProperty('fixedEffort')`; AT-6 property over `[[0,8],[3,8],[8,3],
  [5,5]]`; AT-7 K/λ/pool invariance; AT-3/AT-4 case/BLANK; AT-9/AT-10 auto-default).
  No gap warranted an additive test.

- **Invariant-count note (non-material).** The implement handover referred to
  "8 invariants"; the plan's Phase 2 *Invariants* section lists **7** bullets.
  This review assessed all 7 (all SATISFIED). No behavioural difference.

- **Team/projection surfaces deferred correctly.** Phase 2 left
  `renderTeamSection` broadcasting `td.fixedEffort` uniformly and the projection
  cell passing `[cwEffort]` — shape-only, behaviour-preserving, with comments
  deferring to Phases 3/4. No committed Phase 2 test exercises a non-zero shift
  there, and this is *forbidden-shortcut compliant* (Phase 2 must not pre-empt
  Phases 3/4). Phase 3 now owns the team surface.

## Definition of done

This review phase is done: review file written
(`docs/reviews/0021-constant-work-tab-and-group-scoping-phase-2-review-01.md`,
appended to `index.md` `artifacts.reviews`), `index.md` advanced to
`stage: atdd` / `current_phase: 3` / `retry_count: 0` /
`next_handover: handover-03-plan.md`, this handover written with
`outcome: success`, and everything committed atomically under the lock.
