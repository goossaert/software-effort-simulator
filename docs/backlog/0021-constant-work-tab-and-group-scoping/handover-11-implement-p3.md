---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: implement
feature_phase: 3
for_next_phase: review
outcome: success
reason: ""
produced_at: 2026-05-31T21:43:49Z
produced_commit: ""
---
## Summary

Implemented feature 0021 **Phase 3** (Team Level surface honors Category-scoping)
inline in `index.html` — a small, well-scoped wiring change reusing the Phase 2
helper. Two edits, both in `index.html`:

1. `prepareTeamSimulationData` now returns a per-team `fixedEffortPerGroup`
   (`getConstantWorkEffortPerGroup(targetQuarters, groupsStore, teamName)`) in place
   of the per-team scalar `fixedEffort` (`getConstantWorkEffort(...)`). The scalar
   field is **gone** from the team entry (no back-compat alias).
2. `renderTeamSection` now passes the team's own per-Group vector
   (`fixedEffortPerGroup: td.fixedEffortPerGroup`) to `runSimulation`, replacing the
   Phase-2 interim broadcast (`teamGroupsSnapshot.map(() => td.fixedEffort || 0)`).

GREEN confirmed: targeted run **5/5 pass** (exit 0);
`npm run verify` (full suite) exits **0** with **177 passed / 1 skipped (178 total)**
— exactly the handover's GREEN target, no regression in any other phase. No test file
was created, edited, or deleted; the only working-tree change is `index.html`
(13 insertions / 7 deletions).

## Instructions for the next phase

`review` (feature-phase **3**) — independently verify the Team Level wiring against
the plan's **Phase 3** slice. Do all of this:

1. **Derive the diff boundary** (LOOP-MODE.md):
   - test commit: `git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-10-atdd-p3.md`
     (= `aa0d5769e7fd4460cecc09bdf84621328cf5fb3f`);
   - impl commit: `git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-11-implement-p3.md`.
   Review the `test_commit..impl_commit` diff. It should touch **only** `index.html`
   (plus this handover + index.md frontmatter); no test/feature/e2e/acceptance file
   may appear.
2. **Confirm the general rule, not the fixtures.** The implementation must encode the
   Phase 3 behavioral rule: `prepareTeamSimulationData` reports a per-team
   `fixedEffortPerGroup` that AND-composes the case-insensitive **team** match with
   **Category** membership (trim + case-fold + the **(Blank) sentinel**), aligned
   index-for-index with `kPerGroup` / `groupsStore`; `renderTeamSection` consumes that
   vector. No literal fixture values (`'Platform'`, `'Backend'`, `'ScaffoldCat'`,
   `4.4`, t-shirt sizes) may appear in production logic; no branch on test identity.
3. **Check the four counterexamples do NOT pass** (plan ~644-649):
   - the team entry must not retain a scalar `fixedEffort` (uniform broadcast) —
     `grep -n 'td.fixedEffort\b'` in `index.html` must return nothing;
   - the team vector must not ignore the team filter (org-wide CW lifting every team);
   - it must not ignore the Category filter (all the team's CW lifting every Group);
   - the team match must not be case-sensitive.
4. **Check the invariants** (plan ~639-642): `fixedEffortPerGroup.length === groups.length`;
   contributes only on team-match AND Category∈members; same Category semantics as the
   org vector; constant work does **not** enter the team's `kPerGroup` / **Poisson λ** /
   **Bootstrap pool** (it is a purely additive post-sort shift via the helper). Confirm
   the org headline (Phase 2) and **Team Projections** (Phase 4, `index.html:2271`
   `fixedEffortPerGroup: [cwEffort]`) were **not** touched.
5. **Negative control** (suggested): mutate the team call to broadcast a scalar (e.g.
   `groupsStore.map(() => something_uniform)`) → AT-1/AT-4 must fail; revert → GREEN.
6. **Run the gate yourself:**
   `npx vitest run tests/acceptance/phase-3-team-level-constant-work-scoping.test.js`
   (exit 0, 5 pass) and `npm run verify` (exit 0, 177 pass / 1 skip). PASS only if both
   exit 0, the diff is `index.html`-only, no counterexample is realized, and no test
   file drifted between `test_commit..impl_commit`.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the **Phase 3** slice
  (~lines 570-672): behavioral rule, invariants, counterexamples, forbidden shortcuts,
  definition of done. (Phase 2 slice ~400-566 for the `runSimulation` vector contract.)
- `tests/acceptance/phase-3-team-level-constant-work-scoping.test.js` — the frozen
  Phase 3 acceptance tests (AT-1…AT-5). AT-1/2/3/5 assert
  `prepareTeamSimulationData(...)[i].fixedEffortPerGroup`; AT-4 drives `renderTeamSection`
  + the rendered Median (P50) stats row. **Do NOT edit.**
- `index.html` — the two changed seams:
  - `prepareTeamSimulationData` (~line 2065; the per-team return now carries
    `fixedEffortPerGroup` at ~line 2165, no scalar `fixedEffort`);
  - `renderTeamSection` (~line 2726; consumes `td.fixedEffortPerGroup` at ~line 2744);
  - `getConstantWorkEffortPerGroup` (~line 1831, **unchanged** — added in Phase 2; the
    team filter + Category semantics it implements);
  - `getConstantWorkEffort` (~line 1800, **unchanged** — now called only by Phase 1's
    substrate acceptance tests, no longer by `prepareTeamSimulationData`; kept on
    purpose, not dead-code to remove this phase).
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` — engine semantics:
  per-Group `fixedEffortPerGroup`, Category scoping on the Team Level surface, constant
  work never enters K / λ / the bootstrap pool.
- `docs/adr/0028-category-as-generalized-moscow.md` — case-insensitive Category
  comparison + the (Blank) sentinel.
- `CONTEXT.md` — glossary (Constant work, Category, Group, Target quarter, Team Level
  tab, (Blank) sentinel, Poisson λ, Bootstrap pool).
- `.agent/last-verify.log` — full `npm run verify` output for this implement run
  (exit 0, 177 pass / 1 skip; the trailing jsdom `getContext` / `navigation` lines are
  benign environment noise, not failures).

## Context the next phase needs

Autonomous decisions taken this session (no user in Loop mode):

- **Exactly the two handover-specified edits, nothing more.** The Phase 2 helper
  `getConstantWorkEffortPerGroup(quarters, groups, teamName = null)` already existed and
  already AND-composes the case-insensitive team filter with ADR-0028 Category
  membership and returns a `number[]` aligned with the passed `groups`. So Phase 3 was
  pure wiring: feed it `groupsStore` + the team's `teamName` in
  `prepareTeamSimulationData`, and have `renderTeamSection` pass the resulting per-team
  vector to `runSimulation`. No new helper, no signature change to existing functions.
- **Alignment argument:** `kPerGroup` is built by `bucketRowsByGroups` via
  `groupsStore.map(...)`, and the new `fixedEffortPerGroup` is built by the helper over
  the same `groupsStore`, so the two are index-for-index aligned by construction.
  `renderTeamSection` snapshots `groupsStore.slice()` for `groups`, and `groupsStore` is
  not mutated between prepare and render within a Run — so the vector stays aligned with
  the render-time Group order. This is documented in the new `renderTeamSection` comment.
- **`getConstantWorkEffort` (scalar) intentionally retained.** After the wiring change it
  has no caller in `index.html`, but it is still exercised by Phase 1's frozen
  `phase-1-constant-work-substrate.test.js` (AT-4 etc. call it via `evalIn`). Removing it
  would break committed tests, so it is kept as-is. It is **not** dead code to clean up
  in this phase.
- **Org headline + Team Projections untouched.** `prepareSimulationData` /
  `runSimulation` (Phase 2) and `buildTeamProjections`' projection-cell call
  (`index.html:2271`, `fixedEffortPerGroup: [cwEffort]`, Phase 4) were left exactly as is.
- **AT-4 flat-band assumption honored:** the Platform initiative's Category `ScaffoldCat`
  is in no Group, so every Group's `K === 0` and each Group's distribution sits flat at
  its own per-Group shift, making the rendered Median directly equal the shift
  (Backend → `pm('L').toFixed(1)`, Frontend → `'0.0'`). The implementation did **not**
  perturb `kPerGroup` to "fix" AT-4; the test passes because the per-Group shift is
  correctly scoped, which is the intended discriminator.
- **No test drift:** `git diff --cached --name-only -- tests features e2e acceptance` was
  confirmed empty at commit time; the only staged production change is `index.html`.

## Definition of done (for review)

- The `test_commit..impl_commit` diff touches only `index.html` (plus this handover +
  index.md); no test file drifted.
- `prepareTeamSimulationData` returns a per-team `fixedEffortPerGroup` (team AND Category
  scoped, group-aligned); the per-team scalar `fixedEffort` is gone.
- `renderTeamSection` / the per-team `runSimulation` call consume the per-team vector.
- Constant work does not affect any team's `kPerGroup` / λ / bootstrap pool; none of the
  four Phase 3 counterexamples is realized; all four invariants hold.
- `npx vitest run tests/acceptance/phase-3-team-level-constant-work-scoping.test.js`
  exits 0 (5 pass) and `npm run verify` exits 0 (177 pass / 1 skip).
- On PASS with k=3 < N=8: advance `current_phase: 4`, `retry_count: 0`,
  `stage: atdd`, `next_handover` → the plan handover (`handover-03-plan.md`), append the
  review file to `artifacts.reviews`. On FAIL: `stage: implement`,
  `next_handover: handover-NN-review-p3.md`, `retry_count += 1`.
