---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: atdd
feature_phase: 4
for_next_phase: implement
outcome: success
reason: ""
produced_at: 2026-05-31T22:00:20Z
produced_commit: ""
---
## Summary

ATDD for feature 0021 **Phase 4** (Team Projections surface honors Category-scoping —
each (team, quarter) cell on the **Team Projections tab** scopes its **Constant work** to
the **Projection group**'s members; degenerate fallback resolved) is complete. Authored
one new acceptance file `tests/acceptance/phase-4-projections-constant-work-scoping.test.js`
covering scenarios AT-1…AT-5 (6 `it` blocks — AT-2 carries an extra case-insensitive/trim
**property** test). **No legacy test migration was needed this phase** —
`phase-1-engine.test.js` AT-26 (zero-member Projection group) and AT-27 (empty-`groupsStore`
fallback) had their `runSimulation` parameter migrated to the vector in Phase 2 and stay
**GREEN** under the degenerate-fallback decision (the plan states no Phase-4-unique
migration). RED confirmed: the targeted acceptance run exits **1** (5 failed / 1 passed);
the combined run with `phase-1-engine.test.js` exits **1** (5 failed / 31 passed — RED
confined to the new file, AT-26/AT-27 green); the full suite (`npm run verify`) exits **1**
with **5 failed / 178 passed / 1 skipped**. No production code was written.

## Instructions for the next phase

`implement` (feature-phase **4**) — implement inline in `index.html` per ADR-0033 and the
plan's **Phase 4** slice. This is a small, well-scoped change confined to
`buildTeamProjections` (`index.html:2182`). Do all of this:

1. **Scope the cell's constant work to the Projection group's members.** The function
   already computes the Projection group's membership sets at the top
   (`index.html:2200-2208`): `projGroup = groupsStore.find(g => g.isProjection) || null`,
   plus `projLcMembers` (a `Set` of lowercased non-blank members) and `projHasBlank` (the
   **(Blank) sentinel** flag). Today the cell uses **all** of the team/quarter's constant
   work:
   - `const cwEpics = getConstantWorkEpics(q, teamName);` (`index.html:2228`) — already
     returns epics whose `.category` is `normalizeCategory(...)` (so `BLANK` or a trimmed
     string) and `.effort` is `tshirtToPersonMonths(size)`.
   - `for (const cw of cwEpics) initiatives.push(cw);` (`index.html:2252`) — appends the
     constant-work **Initiative matrix** rows.
   - `const cwEffort = cwEpics.reduce((s, e) => s + e.effort, 0);` (`index.html:2255`).
   - the projection `runSimulation` call passes `fixedEffortPerGroup: [cwEffort]`
     (`index.html:2275`).

   Change: when **a Projection group exists**, scope `cwEpics` to rows whose **Category** ∈
   `projGroup.members` *before* it is used for both the matrix append and the `cwEffort`
   sum. The natural, minimal implementation reuses the already-computed `projLcMembers` /
   `projHasBlank`, e.g. derive a scoped list:
   ```js
   const scopedCwEpics = projGroup
     ? cwEpics.filter(e => e.category === BLANK ? projHasBlank
                                                : projLcMembers.has(e.category.toLowerCase()))
     : cwEpics; // degenerate fallback: no Projection group → all constant work
   ```
   then drive **both** the matrix append and `cwEffort` off `scopedCwEpics`. (The plan
   leaves the mechanism open — "reuse the Phase 2 vector helper with `[projGroup]` as
   `groups`, or filter `getConstantWorkEpics`' output inline"; the inline filter above is
   the smaller change and reuses the membership sets already present. Either is fine as
   long as the contract below holds.) `cwEffort` then becomes `scopedCwEpics.reduce(...)`,
   the matrix appends `scopedCwEpics`, and the projection `runSimulation` call passes
   `fixedEffortPerGroup: [cwEffort]` (now the scoped sum). Replace the interim comment at
   `index.html:2274` ("Single-group cell, unscoped: Phase 4 owns Projection-group Category
   scoping.").

2. **Preserve the degenerate fallback (ADR-0023).** When **no** Projection group exists
   (`projGroup === null`, which includes an empty `groupsStore`), the cell must fall back to
   **all** constant work for that (team, quarter) — i.e. `scopedCwEpics === cwEpics`
   unchanged. Do **not** scope by the first Group when no `isProjection` Group exists; the
   fallback is all-constant-work, not first-Group.

3. **Zero-member Projection group scopes to 0.** When `projGroup.members === []`,
   `projLcMembers` is empty and `projHasBlank` is false, so `scopedCwEpics` is empty →
   `cwEffort === 0`, the matrix has no constant-work rows, and (since `kProj === 0` for an
   empty member set) the **Effort projection band** stays the flat `(0, 0, 0)` triple. This
   is already covered by `phase-1-engine.test.js` AT-26's no-constant-work case; Phase 4's
   AT-3 adds the *with*-constant-work case, which must also collapse to 0.

4. **Do NOT** touch the org headline (Phase 2, done), the per-team Team Level surface
   (Phase 3, done — `prepareTeamSimulationData` / `renderTeamSection`), or the initiative
   side of the projection cell (`kProj`, `bucketRowsByGroups`, the `kProj > 0` Monte Carlo
   band). Constant work must still contribute **zero** to the cell's `kPerGroup` / **Poisson
   λ** / **Bootstrap pool** — the scoped `cwEffort` is purely the additive deterministic
   band floor / shift.

5. **GREEN target:**
   `npx vitest run tests/acceptance/phase-4-projections-constant-work-scoping.test.js`
   exits 0 (all 6 `it`s pass), **and** `npm run verify` (full suite) returns to green
   (no regression — `phase-1-engine.test.js` AT-26/AT-27 must stay green). Make the tests
   pass **without editing any test file**.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the **Phase 4** slice
  (lines ~676-784) is the spec: behavioral rule, invariants, counterexamples (esp.
  "a cell that shows all constant work when a Projection group exists" and "scope by the
  *first* Group" — both forbidden), forbidden shortcuts, definition of done.
- `tests/acceptance/phase-4-projections-constant-work-scoping.test.js` — the frozen Phase 4
  acceptance tests (read for the exact seam contract; **do NOT edit**). All scenarios drive
  through `buildTeamProjections(allQuarters, orgLambda, orgEpicSizingDist, projIterations)`
  and read the cell at `proj[i].byQuarter[q]`: `cell.cwEffort`, `cell.p25/p50/p75`, and
  `cell.initiatives.filter(e => e.isConstant)` (the appended constant-work matrix rows).
- `tests/acceptance/phase-1-engine.test.js` — frozen; AT-26 (zero-member Projection group →
  flat band) and AT-27 (empty `groupsStore` → constant-work-only flat band) must stay green.
  No edit needed.
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-4-acceptance-red.log` —
  confirmed acceptance RED (command, exit 1, full output: 5 failed / 1 passed).
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-4-inner-red.log` — the
  combined run (new file + `phase-1-engine.test.js`); documents that Phase 4 has no separate
  inner seam (the scoping is exercised through `buildTeamProjections`) and that the RED is
  confined to the new file while AT-26/AT-27 stay green.
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-4-verify-ci.log` —
  full-suite run proving the RED is targeted (5 failed / 178 passed / 1 skipped).
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` — engine semantics:
  Category scoping on the Team Projections surface; constant work never enters K / λ /
  the bootstrap pool.
- `docs/adr/0023-constant-work-csv-deterministic-shift.md` — the degenerate behaviour the
  no-Projection-group fallback preserves (constant-work-only flat band).
- `docs/adr/0028-category-as-generalized-moscow.md` — case-insensitive Category comparison
  + the (Blank) sentinel (the membership semantics `projLcMembers` / `projHasBlank` already
  implement for the `kProj` count and that step 1 reuses).
- `CONTEXT.md` — glossary; canonical terms (Constant work, Category, Group, Projection
  group, Scenario, Target quarter, Team Projections tab, Effort projection band,
  Initiative matrix, (Blank) sentinel, Poisson λ, Bootstrap pool).

The test commit SHA (the `implement`→`review` diff boundary) is the commit of THIS handover
file — derive it with:
`git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-13-atdd-p4.md`.
No SHA is embedded here (each phase is one atomic commit).

## Context the next phase needs

Autonomous decisions taken this session (the interactive Step-4 seam proposal and Step-7
test-API review have no user in Loop mode):

- **Chosen seam (stable, plan-named — no private helper name locked in):** every scenario
  drives through the plan's stable entry point `buildTeamProjections(...)` and reads the
  cell object's public, already-existing fields — `cwEffort`, the band `p25/p50/p75`, and
  the appended matrix rows via `initiatives.filter(e => e.isConstant)`. Tests do **not**
  call `getConstantWorkEpics` / `getConstantWorkEffortPerGroup` directly, leaving the
  plan's "reuse the Phase 2 helper with `[projGroup]` vs filter inline" choice fully open
  while pinning the contract: scoped `cwEffort`, scoped band floor, scoped matrix rows.
- **Deterministic band by construction (load-bearing fixture choice):** every fixture gives
  its single initiative a Category (`ScaffoldCat`) that is in **no** Projection-group
  member, so the projection `kProj === 0` and the band collapses to the flat
  `(cwEffort, cwEffort, cwEffort)` triple — **no Monte Carlo is invoked**, and the scoped
  `cwEffort` is directly observable in the band. The implementer must not "fix" any test by
  making `kProj` non-zero; the flat-band assumption is load-bearing for the exact-value
  band assertions (AT-2/AT-3/AT-4).
- **AT-4 is a preserved-behaviour guard, not a RED-driver.** With an empty `groupsStore`
  there is no Projection group, so the current build *already* sums all constant work into
  `cwEffort` — AT-4 is the one passing test on the current build (1 passed). It pins the
  degenerate fallback so the implementer cannot regress it while adding scoping. The other
  five `it`s are RED. This matches the plan's RED gate, which names only AT-1/AT-2/AT-3 as
  failing on the post-Phase-3 build (AT-5 fails too here because its fixture adds a
  non-blank `Backend` row that must be excluded — a strengthening over the plan's
  single-blank-row scenario, added to satisfy the triangulation negative-case rule and to
  make AT-5 genuinely RED rather than coincidentally green).
- **Triangulation coverage** of the Category-membership scoping rule: happy path (AT-1/AT-2,
  exact-case `Backend`), **property** (AT-2's second `it`: trim + case-fold via `'  backend '`),
  **boundary** (AT-3 zero-member group → 0; AT-5 (Blank) sentinel member), **negative**
  (AT-1 `Ops` row excluded; AT-5 non-blank row excluded; AT-2 unscoped total explicitly
  rejected via `.not.toBeCloseTo`).
- **No separate inner-loop seam:** the plan states Phase 4's scoping is "covered in the
  acceptance file". The `…-inner-red.log` therefore records the *combined* run
  (new file + `phase-1-engine.test.js`) with a header note — chosen over re-running the
  bare new file so the inner log doubles as proof that the RED is confined to the new file
  and that AT-26/AT-27 stay green. No standalone unit test was authored.
- **No legacy migration this phase:** `phase-1-engine.test.js` AT-26/AT-27 were migrated
  onto `fixedEffortPerGroup` in Phase 2 and exercise exactly the two degenerate cases Phase
  4 preserves (zero-member Projection group; empty `groupsStore`). They stay green; no
  other committed test asserts the unscoped projection-cell `cwEffort`.
- **Test-API review verdict:** all imposed names match `CONTEXT.md` / the plan verbatim
  (Constant work, Category, Group, Projection group, Effort projection band, Initiative
  matrix, (Blank) sentinel, `cwEffort`, `fixedEffortPerGroup`); the only cell fields read
  are the pre-existing public `cwEffort` / `p25` / `p50` / `p75` / `initiatives`
  (with `isConstant`). No incidental seams. Recommendation: proceed.

RED gate detail (from the persisted logs):
- Acceptance command: `npx vitest run tests/acceptance/phase-4-projections-constant-work-scoping.test.js`
  → exit **1**, 5 failed / 1 passed.
- Inner/combined command: `npx vitest run tests/acceptance/phase-4-projections-constant-work-scoping.test.js tests/acceptance/phase-1-engine.test.js`
  → exit **1**, 5 failed / 31 passed (RED confined to the new file; AT-26/AT-27 green).
- Full suite (`npm run verify`) → exit **1**, 5 failed / 178 passed / 1 skipped.
- Failure reasons match the plan's Phase 4 RED gate exactly:
  - AT-1: the cell appends **all** constant work, so the matrix has 2 constant-work rows
    (Backend + Ops) instead of the 1 scoped row — the "cell shows all constant work when a
    Projection group exists" counterexample.
  - AT-2 (both `it`s): `cwEffort` is the unscoped Backend+Ops total (`6.60…`) instead of
    the scoped Backend-only `pm('M')` (`2.20…`).
  - AT-3: a zero-member Projection group does not scope `cwEffort` to 0 (`cwEffort === 2.20…`,
    band non-zero) — the "zero-member Projection group still lifts the band by all constant
    work" counterexample.
  - AT-5: with `members:[BLANK]`, `cwEffort` is the unscoped blank+Backend total (`6.60…`)
    instead of the scoped blank-only `pm('M')`.

## Definition of done (for implement)

- `npx vitest run tests/acceptance/phase-4-projections-constant-work-scoping.test.js`
  exits 0 (AT-1…AT-5, all 6 `it`s pass).
- `npm run verify` (full suite) exits 0 — no regression in any other phase/verification file
  (`phase-1-engine.test.js` AT-26/AT-27 stay green).
- When a Projection group exists, each cell's `cwEffort` and appended constant-work matrix
  rows are scoped to `projGroup.members` (trim + case-fold + (Blank) sentinel); a
  zero-member group scopes to 0.
- The degenerate fallback (no Projection group / empty `groupsStore`) uses **all** constant
  work for the cell.
- The projection `runSimulation` call passes `fixedEffortPerGroup: [scopedCwEffort]`.
- Constant work does not affect the cell's `kProj` / `lambda` / `epicSizingDist`.
- No test file was edited (the test commit SHA is the boundary).
- `git diff` for the implement commit touches only `index.html` (plus the plan / ADRs /
  CONTEXT.md if a material clarification surfaces).
- `index.md` advanced to `stage: review`, `next_handover: handover-NN-implement-p4.md`.
