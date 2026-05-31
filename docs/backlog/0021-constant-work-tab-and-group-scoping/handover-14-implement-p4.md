---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: implement
feature_phase: 4
for_next_phase: review
outcome: success
reason: ""
produced_at: 2026-05-31T22:04:51Z
produced_commit: ""
---
## Summary

Implemented feature 0021 **Phase 4** (Team Projections surface honors Category-scoping —
each (team, quarter) cell on the **Team Projections tab** scopes its **Constant work** to the
**Projection group**'s members; degenerate fallback preserved). The change is confined to
`buildTeamProjections` in `index.html` (one `index.html`-only diff, 18 insertions / 5
deletions). Each cell now derives a `scopedCwEpics` list from `getConstantWorkEpics(q,
teamName)` filtered to the Projection group's membership, and drives **both** the appended
constant-work **Initiative matrix** rows and the `cwEffort` band floor off it. GREEN: the
targeted acceptance file passes 6/6 (exit 0); the combined run with `phase-1-engine.test.js`
passes 36/36 (AT-26/AT-27 stay green); `npm run verify` exits 0 (183 passed / 1 skipped).
No test file was edited.

## Instructions for the next phase

`review` (feature-phase **4**) — independently verify the Phase 4 slice. Derive the diff
boundary and read the diff before the tests:

```bash
test_commit=$(git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-13-atdd-p4.md)
impl_commit=$(git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-14-implement-p4.md)
git diff "$test_commit".."$impl_commit" -- index.html
```

Verify, against the plan's **Phase 4** slice (behavioral rule / invariants / counterexamples
/ forbidden shortcuts):

1. **General rule, not fixture-fitting.** The implementation introduces one local,
   `let`-free derivation inside `buildTeamProjections`:
   ```js
   const scopedCwEpics = projGroup
     ? cwEpics.filter(e => e.category === BLANK
         ? projHasBlank
         : projLcMembers.has(e.category.toLowerCase()))
     : cwEpics;
   ```
   `projGroup` / `projLcMembers` / `projHasBlank` are the membership sets the function
   **already** computes at the top (`index.html:2200-2208`) and that the `kProj` count
   reuses — so Category scoping is identical to the org/team surfaces (trim + case-fold +
   the **(Blank) sentinel**, ADR-0028). Confirm there are **no** literal fixture values
   (`Backend`, `Ops`, `ScaffoldCat`, `2.20…`, `6.60…`), no branches on test identity, no
   `NODE_ENV`/test-only paths.

2. **Both sinks scoped.** The constant-work matrix append (`for (const cw of scopedCwEpics)
   initiatives.push(cw);`) and `const cwEffort = scopedCwEpics.reduce((s, e) => s + e.effort,
   0);` are **both** driven off `scopedCwEpics`. The projection `runSimulation` call still
   passes `fixedEffortPerGroup: [cwEffort]` — now the **scoped** sum (no scalar
   `fixedEffort`).

3. **Degenerate fallback (ADR-0023).** No Projection group (incl. empty `groupsStore`) →
   `projGroup === null` → `scopedCwEpics === cwEpics` (all constant work for the cell). The
   fallback is **all-constant-work, not first-Group** — confirm no `groupsStore[0]` fallback.

4. **Zero-member Projection group scopes to 0.** `members:[]` → `projLcMembers` empty,
   `projHasBlank` false → `scopedCwEpics` empty → `cwEffort === 0`, no constant-work matrix
   rows, and (since `kProj === 0`) the band stays the flat `(0,0,0)` triple.

5. **Out of scope (must be untouched):** the org headline (Phase 2:
   `prepareSimulationData` / org `runSimulation`), the per-team Team Level surface (Phase 3:
   `prepareTeamSimulationData` / `renderTeamSection`), and the **initiative** side of the
   cell — `kProj`, `bucketRowsByGroups`, the `kProj > 0` Monte Carlo band. Constant work
   must contribute **zero** to the cell's `kPerGroup` / **Poisson λ** / **Bootstrap pool**;
   it is purely the additive deterministic band floor. Confirm the diff touches only the
   three lines around the scoping (the `scopedCwEpics` derivation, the matrix append, the
   `cwEffort` reduce) plus comment text; the `kProj` loop and the simulation call's other
   params are unchanged.

Then run the negative control and re-confirm GREEN:
- Negative control suggestion: make the scoping unconditional-all (e.g. `const scopedCwEpics
  = cwEpics;`) → AT-1/AT-2/AT-3/AT-5 fail; revert → 6/6 GREEN. Or drop the `projGroup`
  guard so an empty `groupsStore` scopes to 0 → AT-4 fails.
- `npx vitest run tests/acceptance/phase-4-projections-constant-work-scoping.test.js
  tests/acceptance/phase-1-engine.test.js` exits 0 (36 pass).
- `npm run verify` exits 0 (183 passed / 1 skipped).
- Confirm no test file drifted across `test_commit..impl_commit`:
  `git diff --name-only "$test_commit".."$impl_commit" -- tests` returns nothing.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the **Phase 4** slice
  (lines ~676-784): behavioral rule, invariants, the four counterexamples (esp. "a cell that
  shows all constant work when a Projection group exists", "zero-member group still lifts by
  all constant work", "scope by the *first* Group", "still passing scalar `fixedEffort`"),
  forbidden shortcuts, definition of done.
- `index.html` — the implementation. The whole change is in `buildTeamProjections`
  (~`index.html:2182`); the scoping derivation sits right after
  `const cwEpics = getConstantWorkEpics(q, teamName);`.
- `tests/acceptance/phase-4-projections-constant-work-scoping.test.js` — the frozen Phase 4
  acceptance tests (AT-1…AT-5, 6 `it`s). Read for the seam contract; **do NOT edit**. All
  scenarios drive through `buildTeamProjections(...)` and read `proj[i].byQuarter[q]`:
  `cell.cwEffort`, `cell.p25/p50/p75`, `cell.initiatives.filter(e => e.isConstant)`.
- `tests/acceptance/phase-1-engine.test.js` — frozen; AT-26 (zero-member Projection group →
  flat band) and AT-27 (empty `groupsStore` → constant-work-only flat band) must stay green.
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` — engine semantics: Category
  scoping on the Team Projections surface; constant work never enters K / λ / bootstrap pool.
- `docs/adr/0023-constant-work-csv-deterministic-shift.md` — the degenerate behaviour the
  no-Projection-group fallback preserves.
- `docs/adr/0028-category-as-generalized-moscow.md` — case-insensitive Category comparison +
  the (Blank) sentinel (the membership semantics `projLcMembers` / `projHasBlank` implement).
- `CONTEXT.md` — glossary (Constant work, Category, Group, Projection group, Team Projections
  tab, Effort projection band, Initiative matrix, (Blank) sentinel, Poisson λ, Bootstrap pool).

Derive the diff boundary SHAs from git log of the two handover files (the commands above);
no SHA is embedded here (each phase is one atomic commit).

## Context the next phase needs

Autonomous decisions taken this session (no user in Loop mode):

- **Chosen mechanism (inline filter, not the Phase 2 helper).** The plan left the mechanism
  open ("reuse the Phase 2 vector helper with `[projGroup]` as `groups`, or filter
  `getConstantWorkEpics`' output inline"). I chose the **inline filter** the atdd handover
  recommended — it is the smaller change and reuses the membership sets the function already
  builds (`projLcMembers` / `projHasBlank`), keeping the scoping semantics literally
  identical to the `kProj` count two lines below. No new helper, no second pass over
  `editedConstantWork`. The observable contract (scoped `cwEffort`, scoped band floor,
  scoped matrix rows) is what the tests pin, so this is fully within the plan's latitude.
- **Cell-skip condition left on `cwEpics` (unscoped).** The guard
  `if (!qInits.length && !cwEpics.length) continue;` was **not** changed to `scopedCwEpics`.
  The atdd handover scopes the change to "both the matrix append and the `cwEffort` sum"
  only, and every fixture has an initiative present (`ScaffoldCat`) so `qInits.length > 0` —
  the skip never fires in the tests, and changing it would be an untested behaviour change
  (it would newly suppress a cell whose constant work is entirely out of scope). Keeping it
  on `cwEpics` is the minimal, conservative choice and matches AT-3's behaviour (a cell with
  out-of-scope constant work is still rendered, with `cwEffort === 0` and a flat `(0,0,0)`
  band) — consistent rather than special-cased.
- **`scopedCwEpics` is `const`, function-local per (team, quarter) iteration** — no shared
  state, no mutation of `cwEpics` or `editedConstantWork`. The scoped sum flows into
  `fixedEffortPerGroup: [cwEffort]` automatically (that line was untouched; only `cwEffort`'s
  definition changed), so the simulation call needed no edit.
- **Comments updated, not added as test crutches.** The interim comment at the
  `runSimulation` call ("Single-group cell, unscoped: Phase 4 owns …") was replaced with one
  stating `cwEffort` is already scoped; a short comment was added at the `scopedCwEpics`
  derivation explaining the membership semantics and the ADR-0023 fallback. No comments
  reference tests or fixtures.

GREEN gate detail:
- Targeted: `npx vitest run tests/acceptance/phase-4-projections-constant-work-scoping.test.js`
  → exit **0**, **6 passed** (AT-1…AT-5, 6 `it`s).
- Combined: `npx vitest run tests/acceptance/phase-4-projections-constant-work-scoping.test.js
  tests/acceptance/phase-1-engine.test.js` → exit **0**, **36 passed** (AT-26/AT-27 green).
- Full suite: `npm run verify` → exit **0**, **183 passed / 1 skipped** (no regression; the
  jsdom "Not implemented: navigation" lines are pre-existing benign warnings, not failures).
- No test file drifted (`git diff --cached --name-only -- tests …` empty at commit time;
  the only staged production file is `index.html`).

## Definition of done (for review — PASS criteria)

- The diff implements the **general** Projection-group Category-scoping rule in
  `index.html`'s `buildTeamProjections` only (no fixture literals, no test-keyed branches,
  no production import from `tests/`).
- When a Projection group exists, each cell's `cwEffort` and appended constant-work matrix
  rows are scoped to `projGroup.members` (trim + case-fold + (Blank) sentinel); a zero-member
  group scopes to `0`.
- The degenerate fallback (no Projection group / empty `groupsStore`) uses **all** constant
  work for the cell (not the first Group).
- The projection `runSimulation` call passes `fixedEffortPerGroup: [scopedCwEffort]`; constant
  work does not affect the cell's `kProj` / λ / `epicSizingDist` / bootstrap pool.
- None of the four Phase 4 counterexamples is realizable.
- `npx vitest run tests/acceptance/phase-4-projections-constant-work-scoping.test.js` exits 0
  (6 pass); `npm run verify` exits 0 (183 passed / 1 skipped); AT-26/AT-27 stay green.
- No test file drifted across `test_commit..impl_commit`.
