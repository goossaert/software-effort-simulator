---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: atdd
feature_phase: 3
for_next_phase: implement
outcome: success
reason: ""
produced_at: 2026-05-31T21:38:30Z
produced_commit: ""
---
## Summary

ATDD for feature 0021 **Phase 3** (Team Level surface honors Category-scoping —
`prepareTeamSimulationData` replaces its per-team scalar constant-work effort with a
per-team `fixedEffortPerGroup`; `renderTeamSection` consumes the vector) is complete.
Authored one new acceptance file
`tests/acceptance/phase-3-team-level-constant-work-scoping.test.js` covering scenarios
AT-1…AT-5. **No legacy test migration was needed this phase** — `phase-1-engine.test.js`
AT-25 (the only Team-Level engine test) was already migrated to `fixedEffortPerGroup`
in Phase 2 and stays green; the plan states no Phase-3-unique migration is expected.
RED confirmed: the targeted run exits **1** (5 failed / 0 passed); the full suite
(`npm run verify`) exits **1** with **5 failed / 172 passed / 1 skipped** — the failures
are confined to the new file (no collateral breakage). No production code was written.

## Instructions for the next phase

`implement` (feature-phase **3**) — implement inline in `index.html` per ADR-0033 and
the plan's **Phase 3** slice. This is a small, well-scoped wiring change; the Phase 2
helper already does the heavy lifting. Do all of this:

1. **`prepareTeamSimulationData`** (`index.html:2065`, currently returning the per-team
   scalar at `index.html:2162`): replace
   `fixedEffort: getConstantWorkEffort(targetQuarters, teamName)` with a per-team
   `fixedEffortPerGroup: getConstantWorkEffortPerGroup(targetQuarters, groupsStore, teamName)`.
   The helper `getConstantWorkEffortPerGroup(quarters, groups, teamName = null)` **already
   exists** (`index.html:1831`, added in Phase 2) and already AND-composes the team filter
   (case-insensitive, existing convention) with Category membership (`trim` + case-fold +
   the **(Blank) sentinel**) and returns a `number[]` aligned with the passed `groups`.
   So the Phase 3 change is: feed it `groupsStore` + the team's `teamName`. The returned
   per-team entry must carry `fixedEffortPerGroup` (a vector aligned index-for-index with
   the team's `kPerGroup` / `groupsStore`), and the scalar `fixedEffort` field on the team
   entry must be **gone** (no back-compat alias).
2. **`renderTeamSection`** (`index.html:2726`, currently broadcasting at
   `index.html:2741`: `fixedEffortPerGroup: teamGroupsSnapshot.map(() => td.fixedEffort || 0)`):
   consume the per-team vector instead — pass `fixedEffortPerGroup: td.fixedEffortPerGroup`
   (the team's own per-Group vector) to `runSimulation`. The vector was computed against
   `groupsStore` order in step 1; `renderTeamSection` snapshots `groupsStore.slice()` for
   the `groups` argument, so the two stay index-aligned as long as `groupsStore` is not
   mutated between prepare and render (it is not, within a Run). Remove the Phase-2 interim
   "broadcast `td.fixedEffort`" comment/logic.
3. **Do NOT** touch the org headline (Phase 2, done) or the **Team Projections** surface
   (Phase 4 owns `buildTeamProjections`' projection-cell `runSimulation` call at
   `index.html:2271` — leave its `fixedEffortPerGroup: [cwEffort]` exactly as is). Constant
   work must still contribute **zero** to any team's `kPerGroup` / **Poisson λ** /
   **Bootstrap pool** — `getConstantWorkEffortPerGroup` is purely an additive post-sort shift.
4. **GREEN target:**
   `npx vitest run tests/acceptance/phase-3-team-level-constant-work-scoping.test.js`
   exits 0 (AT-1…AT-5 pass), **and** `npm run verify` (full suite) returns to green
   (178 total: 177 passed / 1 skipped, no regression in any other phase). Make the tests
   pass **without editing any test file**.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the **Phase 3** slice
  (lines ~570-673) is the spec: behavioral rule, invariants, counterexamples, forbidden
  shortcuts, definition of done. (Phase 2 slice ~400-566 for the `runSimulation` vector
  contract context.)
- `tests/acceptance/phase-3-team-level-constant-work-scoping.test.js` — the frozen Phase 3
  acceptance tests (read for the exact seam contract; **do NOT edit**). AT-1/2/3/5 drive
  through `prepareTeamSimulationData(hist, target, orgLambda, orgSizing)[i].fixedEffortPerGroup`;
  AT-4 drives through `renderTeamSection` + the rendered stats table (Median row).
- `tests/acceptance/phase-1-engine.test.js` — frozen; AT-25 (Team Level stats, already on
  the vector) must stay green. No edit needed.
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-3-acceptance-red.log` —
  confirmed acceptance RED (command, exit 1, full output).
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-3-inner-red.log` — same
  targeted run; documents that Phase 3 has no separate inner seam (the per-team vector is
  exercised through `prepareTeamSimulationData` in the acceptance file).
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-3-verify-ci.log` —
  full-suite run proving the RED is targeted (5 failed / 172 passed / 1 skipped).
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` — engine semantics:
  per-Group `fixedEffortPerGroup`, Category scoping on the Team Level surface, constant
  work never enters K / λ / the bootstrap pool.
- `docs/adr/0028-category-as-generalized-moscow.md` — case-insensitive Category comparison
  + the (Blank) sentinel (the semantics `getConstantWorkEffortPerGroup` already implements).
- `CONTEXT.md` — glossary; canonical terms (Constant work, Category, Group, Scenario,
  Target quarter, Team Level tab, (Blank) sentinel, Poisson λ, Bootstrap pool).

The test commit SHA (the `implement`→`review` diff boundary) is the commit of THIS
handover file — derive it with:
`git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-10-atdd-p3.md`.
No SHA is embedded here (each phase is one atomic commit).

## Context the next phase needs

Autonomous decisions taken this session (the interactive Step-4 seam proposal and Step-7
test-API review have no user in Loop mode):

- **Chosen seams (stable, all plan-named — no private helper name locked in):**
  - The **per-team, Category-scoped, group-aligned vector** is asserted via
    `prepareTeamSimulationData(...)[i].fixedEffortPerGroup` (the plan's stable return-shape
    seam: "prepareTeamSimulationData returning fixedEffortPerGroup per team entry"). Tests
    do **not** call `getConstantWorkEffortPerGroup` directly, leaving the plan's "shared
    helper with a teamName filter vs inline" choice open while pinning the aligned-vector
    contract. (The helper already exists from Phase 2 with the `teamName` argument, so the
    natural implementation is to call it — but the contract is the vector, not the call.)
  - The **`renderTeamSection` consumption** (AT-4) is asserted through the **Team Level
    tab**'s rendered stats table — build team data, set `lastTeamData`/`lastCapacity`/
    `lastIterations`, mount `#team-chart-0` + `#team-stats-thead-0`/`#team-stats-tbody-0`,
    call `renderTeamSection(0, td.useOrgByDefault)`, then read the "Median (P50)" row's
    `td.val` cells. This is the genuine user-observable surface (not a private internal),
    and it is the discriminating test: in RED the scalar is broadcast uniformly, so the
    Frontend column reads `4.4` (= pm('L')) instead of `0.0`.
- **AT-4 fixture design (why it is unambiguous):** the Platform initiative's Category is
  `ScaffoldCat` (in no Group), so every Group's `K === 0` → each Group's distribution sits
  *flat* at exactly its own per-Group shift. That makes the rendered Median directly
  equal to the shift: Backend → `pm('L').toFixed(1)`, Frontend → `'0.0'`. The implementer
  must not "fix" AT-4 by making `kPerGroup` non-zero — the flat-band assumption is load-bearing.
- **No separate inner-loop seam:** the plan states Phase 3's vector is "covered in the
  acceptance file". The `…-inner-red.log` therefore records the same targeted command as
  the acceptance gate, with a header note. No standalone unit-level test was authored
  (the helper is already covered org-wide by Phase 2's acceptance file and team-wide here).
- **No legacy migration this phase:** `phase-1-engine.test.js` AT-25 was migrated to
  `fixedEffortPerGroup: [0, 0]` in Phase 2 and is green; it exercises `runSimulation` +
  `renderStatsTableInto`, not `prepareTeamSimulationData`, so Phase 3 leaves it untouched.
  No other committed test asserts the per-team scalar `fixedEffort`. (Confirm AT-25 stays
  green after the wiring change.)
- **Test-API review verdict:** all imposed names match `CONTEXT.md` / the plan verbatim
  (`fixedEffortPerGroup`, Group, Category, (Blank) sentinel, Target quarter, Team Level
  tab); the only field touched on the team entry is the rename of the scalar `fixedEffort`
  → vector `fixedEffortPerGroup`; no incidental seams (the AT-4 render path uses only
  documented module-scoped state + public render functions). Recommendation: proceed.

RED gate detail (from the persisted logs):
- Acceptance command: `npx vitest run tests/acceptance/phase-3-team-level-constant-work-scoping.test.js`
  → exit **1**, 5 failed / 0 passed.
- Inner/integration command: identical (no separate inner seam) → exit **1**.
- Full suite (`npm run verify`) → exit **1**, 5 failed / 172 passed / 1 skipped — confirming
  the RED is confined to the new acceptance file.
- Failure reasons match the plan's Phase 3 RED gate exactly:
  - AT-1/AT-2/AT-3/AT-5: `prepareTeamSimulationData` returns no `fixedEffortPerGroup`
    (the team entry still carries the scalar `fixedEffort`), so the asserted vector is
    `undefined`.
  - AT-4: `renderTeamSection` broadcasts the team scalar uniformly across every Group, so
    the Frontend column is wrongly lifted to `4.4` (= pm('L')) instead of `0.0` — the
    plan's "a team section that retains the scalar fixedEffort (lifts every Group
    uniformly)" counterexample.

## Definition of done (for implement)

- `npx vitest run tests/acceptance/phase-3-team-level-constant-work-scoping.test.js`
  exits 0 (AT-1…AT-5 all pass).
- `npm run verify` (full suite) exits 0 — no regression in any other phase/verification file.
- `prepareTeamSimulationData` returns a per-team `fixedEffortPerGroup` (team AND Category
  scoped, group-aligned); the per-team scalar `fixedEffort` is gone.
- `renderTeamSection` / the per-team `runSimulation` call consume the per-team vector.
- Constant work does not affect any team's `kPerGroup` / `lambda` / `epicSizingDist`.
- No test file was edited (the test commit SHA is the boundary).
- `git diff` for the implement commit touches only `index.html` (plus the plan / ADRs /
  CONTEXT.md if a material clarification surfaces).
- `index.md` advanced to `stage: review`, `next_handover: handover-NN-implement-p3.md`.
