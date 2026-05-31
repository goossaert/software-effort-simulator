---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: review
feature_phase: 3
for_next_phase: atdd
outcome: success
reason: ""
produced_at: 2026-05-31T21:52:01Z
produced_commit: ""
test_commit: aa0d5769e7fd4460cecc09bdf84621328cf5fb3f
impl_commit: aab5babf57bf64b441e370c8cc9a63eb0c6b1bcc
---
## Summary

Independent review of feature 0021 **Phase 3** (Team Level surface honors
Category-scoping) — verdict **PASS**. The `test_commit..impl_commit` diff
(`aa0d576..aab5bab`) touches only `index.html` (plus this phase's handover +
`index.md`); no test/feature/e2e/acceptance file drifted. The implementation encodes
the general per-team rule, not the fixtures: `prepareTeamSimulationData` reports a
per-team `fixedEffortPerGroup` built by the shared helper
`getConstantWorkEffortPerGroup(targetQuarters, groupsStore, teamName)` (case-insensitive
team match AND-composed with ADR-0028 Category membership, group-aligned), and
`renderTeamSection` consumes `td.fixedEffortPerGroup`; the per-team scalar `fixedEffort`
is gone. All four invariants hold by construction, none of the four counterexamples is
realizable, and constant work never enters any team's `kPerGroup` / λ / bootstrap pool.
Negative control (drop the `teamName` arg → org-wide) fails AT-2/AT-5 (exit 1) and
recovers on revert (5/5, exit 0). Targeted (5 pass) and `npm run verify`
(177 pass / 1 skip) both exit 0.

Review file: `docs/reviews/0021-constant-work-tab-and-group-scoping-phase-3-review-01.md`.

## Instructions for the next phase

`atdd` (feature-phase **4**) — author and freeze the acceptance tests for the plan's
**Phase 4** slice: *Team Projections surface honors Category-scoping — Projection-group-scoped
constant work, degenerate fallback resolved* (`docs/plans/0021-…md`, ~lines 676 onward).

Phase 4 is the third and last of the three Category-scoping surfaces. The org headline
(Phase 2) and the Team Level tab (Phase 3) are done; Phase 4 scopes constant work in the
**Team Projections** projection cell. The current interim state to replace is at
`index.html:2275`: `fixedEffortPerGroup: [cwEffort]` — a single-group, **unscoped** cell
band where `cwEffort` is the sum of all the cell's constant-work epics (see
`buildTeamProjections`, the `cwEpics`/`cwEffort` block ~lines 2245–2280). Phase 4 must
scope both (a) which constant-work rows appear in the cell's appended **Initiative matrix**
and (b) the cell's `cwEffort` band floor to the **Projection group**'s members (ADR-0028
Category semantics). Read the Phase 4 slice for the exact AT scenarios, invariants,
counterexamples, and the degenerate-fallback behavior before authoring tests.

Operate per `phase-atdd` Loop mode: write the frozen acceptance file, migrate any
legacy tests the plan's Phase 4 slice names, confirm the RED gate (record the logs under
`docs/atdd-logs/0021-…-phase-4-*`), advance `index.md` to `stage: implement`, and write
`handover-NN-atdd-p4.md`.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the **Phase 4** slice
  (~line 676 onward): acceptance behavior, behavioral rule, invariants, counterexamples,
  forbidden shortcuts, RED gate, definition of done. (Phase 2 slice ~400–566 for the
  `runSimulation` vector contract; Phase 3 slice ~570–672 for the per-team vector now in
  place.)
- `index.html` — the Phase 4 seam:
  - `buildTeamProjections` (~line 2065 in `prepareTeamSimulationData`; the per-quarter
    projection cell loop with `cwEpics` / `cwEffort` ~lines 2245–2280 and the projection
    `runSimulation` call at ~line 2270 with `fixedEffortPerGroup: [cwEffort]`,
    `index.html:2275` — the interim unscoped band Phase 4 must scope);
  - `getConstantWorkEpics` (~line 1871, returns the cell's constant-work epics — the
    Initiative-matrix rows Phase 4 must filter by the Projection group's members);
  - `getConstantWorkEffortPerGroup` (~line 1831, the shared per-Group helper — candidate
    for the cell band, called with the single Projection group);
  - `normalizeCategory` + the `BLANK` sentinel (the Category semantics to reuse).
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` — engine semantics:
  Category scoping across all three surfaces; constant work never enters K / λ / the
  bootstrap pool.
- `docs/adr/0029-…` (Projection band driven by the Projection group's K) and
  `docs/adr/0028-category-as-generalized-moscow.md` (case-insensitive Category comparison +
  the (Blank) sentinel).
- `CONTEXT.md` — glossary (Constant work, Category, Group, Projection group, Target
  quarter, Team Projections, Initiative matrix, (Blank) sentinel, Poisson λ, Bootstrap
  pool).
- `tests/acceptance/phase-3-team-level-constant-work-scoping.test.js` — the frozen Phase 3
  acceptance pattern (`loadInitiativesCSV` + `setEpics` + `editedConstantWork`/`groupsStore`
  via `execIn`; assert via `evalIn`) — a template for the Phase 4 acceptance harness.

## Context the next phase needs

Autonomous decisions taken this review session (no user in Loop mode):

- **Diff boundary derived per LOOP-MODE.md.** `test_commit` =
  `aa0d5769e7fd4460cecc09bdf84621328cf5fb3f` (`git log -1 --format=%H -- …handover-10-atdd-p3.md`);
  `impl_commit` = `aab5babf57bf64b441e370c8cc9a63eb0c6b1bcc`
  (`… -- …handover-11-implement-p3.md`). Reviewed `git diff test_commit..impl_commit`.
- **Plan + diff read before the tests** (ordering rule). Initial assessment from the diff
  alone: the change is general (shared helper parameterised by `groupsStore` + `teamName`),
  every changed line maps to the rule, no suspicious constructs.
- **Test-drift check is the decisive gate.**
  `git diff aa0d576..aab5bab -- tests features e2e acceptance` returned **empty** — no test
  file changed between the test and impl commits. Per the review Rules, any such change
  would force FAIL; none present.
- **Negative control chosen to attack the central rule** (team-scoping), not a peripheral
  one: dropped the `teamName` argument at `index.html:2166`
  (`getConstantWorkEffortPerGroup(targetQuarters, groupsStore)`), making the team vector
  org-wide. Result: exit 1, AT-2 + AT-5 fail (the team filter is what they pin). Reverted
  the one-line edit; re-ran → exit 0, 5/5; `git status --porcelain` empty afterward, so the
  committed tree contains no mutation residue.
- **No additional verification tests written.** The only Phase-3-specific production logic
  is wiring (pass `groupsStore`+`teamName`; consume `td.fixedEffortPerGroup`); AT-1…AT-5 +
  the negative control fully exercise it and all four counterexamples. The Category
  trim/case-fold/(Blank) semantics are the *same shared helper* already verified on the org
  path in Phase 2 — no team-level code divergence to test separately.
- **Other surfaces confirmed untouched:** org headline (`index.html:2033` /
  `runSimulation` `2385`) and the Team Projections projection cell (Phase 4,
  `index.html:2275`, `fixedEffortPerGroup: [cwEffort]`). `getConstantWorkEffort` (scalar,
  `index.html:1800`) has no production caller but is retained — still exercised by Phase 1's
  frozen substrate tests; not dead code to remove this phase.

## Definition of done (for the Phase 4 atdd consumer)

- Author + freeze `tests/acceptance/phase-4-…test.js` covering the Phase 4 slice's AT
  scenarios (Projection-group-scoped Initiative-matrix rows + scoped `cwEffort` band floor +
  degenerate fallback).
- Confirm the RED gate against the current build (the unscoped `[cwEffort]` cell), record
  logs under `docs/atdd-logs/0021-…-phase-4-*`.
- Migrate only the legacy tests the Phase 4 slice explicitly names; edit no other test file.
- Advance `index.md`: `stage: implement`, `current_phase` stays 4; write
  `handover-NN-atdd-p4.md` (`outcome: success`).
