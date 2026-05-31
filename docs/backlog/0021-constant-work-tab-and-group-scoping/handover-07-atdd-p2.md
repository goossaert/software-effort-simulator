---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: atdd
feature_phase: 2
for_next_phase: implement
outcome: success
reason: ""
produced_at: 2026-05-31T21:01:54Z
produced_commit: ""
---
## Summary

ATDD for feature 0021 **Phase 2** (per-Group constant-work shift at the org
headline — `fixedEffortPerGroup` replaces the scalar `fixedEffort`; the
auto-default `All` Group unions constant-work Categories) is complete. Authored a
new acceptance file `tests/acceptance/phase-2-constant-work-org-scoping.test.js`
covering scenarios AT-1…AT-11, and migrated every committed test that asserted the
scalar `fixedEffort` contract onto the vector: `phase-1-engine.test.js`
**AT-11/AT-13/AT-14/AT-25** (mechanical `fixedEffort: 0` → `fixedEffortPerGroup: [0,…]`)
and **AT-12** (rewritten — a zero-member Group's shift is now its own `0`, not a
shared scalar), `tests/verification/phase-1-2-review-01.test.js` (two `runSimulation`
calls), and the self-skipping `tests/verification/sanity-check-engine-mean.test.js`
(engine-mean identity → per-Group `mean_g ≈ K_g·λ·E[size] + fixedEffortPerGroup[g]`).
RED confirmed: the acceptance run exits **1** (11 failed / 1 passed); the full suite
exits **1** with **12 failed / 160 passed / 1 skipped** — failures are confined to
the new file plus the rewritten AT-12 (no collateral breakage). No production code
was written.

## Instructions for the next phase

`implement` (feature-phase **2**) — implement inline in `index.html` per ADR-0033
and the plan's **Phase 2** slice. The single load-bearing rename is
`runSimulation`'s scalar `fixedEffort` → vector `fixedEffortPerGroup`, which ripples
to **all four** of its references. Do all of this:

1. **Per-Group constant-work effort vector.** Add the computation that buckets
   `editedConstantWork` rows whose `quarter ∈ targetQuarters` by **Category**
   membership: for each Group in the snapshot, sum
   `tshirtToPersonMonths(size)` over rows whose normalised Category ∈ `group.members`
   (`trim` + case-fold equality; the **(Blank) sentinel** `null` matches blank-Category
   rows — reuse the exact semantics of `bucketRowsByGroups`, `index.html:1827`). Return
   a `number[]` aligned index-for-index with `kPerGroup`/`groups`. Seam is free: a new
   `getConstantWorkEffortPerGroup(quarters, groups, teamName = null)` **or** an extension
   of `getConstantWorkEffort` (`index.html:1755`) — the tests pin only the aligned-vector
   contract, not the helper name. (Add the optional `teamName` filter now if convenient;
   Phase 3 reuses it for the team surface.)
2. **`prepareSimulationData`** (`index.html:1869`) returns `fixedEffortPerGroup`
   (org-wide, all teams — `teamName = null`) alongside `kPerGroup`. It must NOT change
   `kPerGroup`, `lambda`, or `epicSizingDist` (AT-7).
3. **`runSimulation`** (`index.html:2275`): replace the `fixedEffort = 0` parameter with
   `fixedEffortPerGroup = []`. Per-Group shift block (`index.html:2292-2299`): shift
   `results[i].sorted` by `fixedEffortPerGroup[i]` (default `0` when shorter/absent).
   `globalMin = Math.min(...fixedEffortPerGroup)` — or `0` when the array is empty
   (`index.html:2303`). `globalMax` accommodates the tallest shift (replace `fixedEffort + 1`
   with a `Math.max(...fixedEffortPerGroup) + 1` guard, empty-safe). The returned object
   reports `fixedEffortPerGroup` and **must not** carry the scalar `fixedEffort`
   (AT-5 asserts both: `toHaveProperty('fixedEffortPerGroup')` and
   `not.toHaveProperty('fixedEffort')`).
4. **Org run-button handler** (`index.html:4157-4164`): replace
   `orgFixedEffort = getConstantWorkEffort(targetQs)` (scalar) with the org-wide
   `fixedEffortPerGroup` (computed against `groupsSnapshot`/target quarters) and pass it to
   `runSimulation`.
5. **Auto-default `All` Group union.** The auto-default block in `loadInitiativesCSV`
   (`index.html:1584-1592`) currently derives `members` from `editedInitiatives` only and
   `loadConstantWorkCSV` (`index.html:1745`) never touches `groupsStore`. Change both so the
   `All` Group's `members` is the **union** of observed Categories across
   `editedInitiatives` **and** `editedConstantWork` (incl. BLANK), (re)derived on **any** CSV
   load (initiatives or constant work) while `groupsStore` is still the pristine auto-default;
   once the user has modified Groups, no further auto-sync (AT-9, AT-10). Detection mechanism
   (module flag vs structural "is the lone auto-derived `All`" check) is your choice — the
   tests don't pin it; AT-10 freezes after the user replaces the store with their own Groups.
   Reuse `collectObservedCategories` (`index.html:1604`) / `buildCategoryCasingMap`
   (`index.html:1809`); seed casing from initiatives first (Initiative casing wins on merge).
6. **The other three `runSimulation` call sites must be migrated to the new parameter
   shape** (removing the scalar param from the definition forces this — and the plan forbids
   keeping `fixedEffort` as a back-compat alias):
   - **Projection cell** (`index.html:2164-2169`, inside `buildTeamProjections`): change
     `fixedEffort: cwEffort` → `fixedEffortPerGroup: [cwEffort]` (single-element; **unscoped**
     — Phase 4 owns scoping `cwEffort` to the Projection group).
   - **Team level** (`index.html:2619-2625`, inside `renderTeamSection`): change
     `fixedEffort: td.fixedEffort || 0` to the new vector shape. **Do NOT** Category-scope it
     and **do NOT** broadcast the org-wide vector here — Phase 3 owns the per-team
     `fixedEffortPerGroup`. Preserve the *existing* (uniform) team behaviour in the new shape
     (e.g. broadcast `td.fixedEffort` across the team's groups) so this is a pure
     parameter-shape change, not a semantics change. (No committed test exercises this call
     in Phase 2, so discipline + the reviewer are the only guards — keep the diff minimal and
     behaviour-preserving here.)
7. **GREEN target:**
   `npx vitest run tests/acceptance/phase-2-constant-work-org-scoping.test.js tests/acceptance/phase-1-engine.test.js tests/verification/sanity-check-engine-mean.test.js tests/verification/phase-1-2-review-01.test.js`
   exits 0, **and** `npm run verify` (full suite) returns to green (no regression in
   `phase-2-groups-tab.test.js`, `phase-3-*`, `drag-reorder`, `preview-hist-init-count-*`).
   Make the tests pass **without editing any test file**.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — **Phase 2** slice (lines ~400-566) is the spec: behavioral rule, invariants, counterexamples, forbidden shortcuts, definition of done. Also re-read the top-of-file *Data models* `runSimulation` BEFORE/AFTER block.
- `tests/acceptance/phase-2-constant-work-org-scoping.test.js` — the frozen Phase 2 acceptance tests (read for the exact seam contract; do NOT edit). The org-vector scenarios drive through `prepareSimulationData(hist, target).fixedEffortPerGroup`; the shift/globalMin scenarios drive through `runSimulation` directly.
- `tests/acceptance/phase-1-engine.test.js` — frozen; contains migrated AT-11/13/14/25 and the rewritten AT-12 (the lone failing legacy test). AT-26/AT-27 are unchanged (see Context) and must stay green.
- `tests/verification/phase-1-2-review-01.test.js` and `tests/verification/sanity-check-engine-mean.test.js` — frozen; migrated to the vector contract.
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-2-acceptance-red.log` — confirmed acceptance RED (command, exit 1, full output).
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-2-inner-red.log` — the full plan-verification command (4 files) RED; documents that Phase 2 has no separate inner seam (the vector helper is exercised inside the acceptance file).
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-2-verify-ci.log` — full-suite run proving the RED is targeted (12 failed / 160 passed / 1 skipped).
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` — engine semantics: per-Group `fixedEffortPerGroup`, Category scoping, `globalMin = min per-group shift`, constant work never enters K/λ/bootstrap pool.
- `docs/adr/0028-category-as-generalized-moscow.md` — case-insensitive Category comparison + the (Blank) sentinel.
- `docs/adr/0029-user-defined-groups-supersede-cumulative-moscow.md` — the user-defined Group model the auto-default union extends.
- `CONTEXT.md` — glossary; canonical terms (Constant work, Category, Group, Scenario, Target quarter, (Blank) sentinel, Global histogram range, Poisson λ, Bootstrap pool).

The test commit SHA (the `implement`→`review` diff boundary) is the commit of THIS
handover file — derive it with:
`git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-07-atdd-p2.md`.
No SHA is embedded here (each phase is one atomic commit).

## Context the next phase needs

Autonomous decisions taken this session (the interactive Step-4 seam proposal and
Step-7 test-API review have no user in Loop mode):

- **Chosen seams (stable, all plan-named — no private helper name locked in):**
  - The **org-wide per-Group vector** is asserted via
    `prepareSimulationData(hist, target).fixedEffortPerGroup` (a committed return-shape seam
    in the plan), NOT via a `getConstantWorkEffortPerGroup` call. This deliberately leaves the
    helper name / "standalone vs extension of `getConstantWorkEffort`" choice open per the
    plan's "Do NOT lock in" note, while still pinning the aligned-vector contract.
  - The **shift / `globalMin` / return contract** is asserted via `runSimulation` directly
    (AT-5, AT-6, AT-11) with explicit `fixedEffortPerGroup` vectors — the stable engine seam.
  - The **auto-default union** is asserted via `loadInitiativesCSV` / `loadConstantWorkCSV`
    (both load orders) reading `groupsStore` (AT-9, AT-10) — no detection-mechanism assumption.
- **No separate inner-loop seam:** the plan states Phase 2's vector helper is exercised
  directly in the acceptance file. The `…-inner-red.log` therefore records the plan's 4-file
  verification command (acceptance + migrated engine/verification), demonstrating the migrated
  scalar-contract tests fail alongside the new scenarios.
- **AT-26 / AT-27 required NO test edit** (despite being listed under Phase 2's migration in
  the plan/plan-handover). They call `buildTeamProjections`, never pass `fixedEffort`, and do
  not reach the `runSimulation` shift with a non-zero value (AT-26: `cwEffort === 0`; AT-27:
  empty `groupsStore` → degenerate flat-band fallback, the `runSimulation` branch at
  `index.html:2164` is not hit). They are already on `editedConstantWork` (Phase 1) and stay
  green. The plan's "AT-26/AT-27 migration" is therefore purely the **production-side**
  parameter-shape change at the projection call site (`index.html:2164`) — see Instruction 6.
- **Which migrated tests are RED vs green (deliberate):** only **AT-12** (rewritten) is RED
  among the legacy engine tests. The `fixedEffort: 0` → `fixedEffortPerGroup: [0,…]` swaps in
  AT-11/13/14/25 and in `phase-1-2-review-01.test.js` are **mechanical and stay green** on the
  current build — passing `fixedEffortPerGroup` is ignored and the scalar `fixedEffort` defaults
  to `0`, so behaviour is identical. This is expected: the RED is driven by the new acceptance
  scenarios (per-Group shift, `globalMin = min`, auto-default union, `fixedEffortPerGroup` on the
  return) plus AT-12 (zero-member Group must sit at its own `0`, not a shared `5`). The
  implementer must still remove the scalar `fixedEffort` entirely (no back-compat alias) so the
  contract is the vector only.
- **`phase-2-groups-tab.test.js:465` retains a harmless `fixedEffort: 0`** — intentionally NOT
  migrated (that file is owned by Phases 6/8 per the plan-handover). After impl it is an ignored
  extra property (defaults to the same `0` shift), so the suite stays green. Do not be confused
  by it and do not edit it this phase.
- **Test-API review verdict:** all imposed names match `CONTEXT.md` / the plan verbatim
  (`fixedEffortPerGroup`, Group, Category, (Blank) sentinel, Target quarter, Global histogram
  range); the only introduced field is `fixedEffortPerGroup` (replacing the removed scalar
  `fixedEffort`); no incidental seams. Recommendation: proceed.

RED gate detail (from the persisted logs):
- Acceptance command: `npx vitest run tests/acceptance/phase-2-constant-work-org-scoping.test.js`
  → exit **1**, 11 failed / 1 passed. The 1 pass is **AT-10** (the auto-default-freeze guard),
  green on both builds by design (the negative case for the auto-sync rule).
- Inner/integration command: the plan's 4-file verification command → exit **1**,
  12 failed / 35 passed / 1 skipped (sanity-check self-skips: its CSVs are absent).
- Full suite (`npm run verify`) → exit **1**, 12 failed / 160 passed / 1 skipped — confirming
  the RED is confined to the new acceptance file (11) + rewritten AT-12 (1).
- Failure reasons match the plan's Phase 2 RED gate exactly: `prepareSimulationData` returns no
  `fixedEffortPerGroup`; `runSimulation` ignores the vector and shifts every Group by the scalar
  default `0`; `globalMin` is the scalar (0) not `min(...vec)`; the auto-default `All` Group is
  built from initiatives only (missing the constant-work-only Category).

## Definition of done (for implement)

- `npx vitest run tests/acceptance/phase-2-constant-work-org-scoping.test.js tests/acceptance/phase-1-engine.test.js tests/verification/sanity-check-engine-mean.test.js tests/verification/phase-1-2-review-01.test.js`
  exits 0 (AT-1…AT-11, incl. the rewritten AT-12, all pass).
- `npm run verify` (full suite) exits 0 — no regression in any other phase/verification file.
- The scalar `fixedEffort` parameter is gone from `runSimulation`; the return reports
  `fixedEffortPerGroup`; all four `runSimulation` references use the vector shape.
- Constant work does not affect `kPerGroup` / `lambda` / `epicSizingDist` (AT-7); the auto-default
  `All` Group unions both sources and freezes on user modification (AT-9, AT-10).
- No test file was edited (the test commit SHA is the boundary).
- `git diff` for the implement commit touches only `index.html` (plus the plan / ADRs / CONTEXT.md
  if a material clarification surfaces).
- `index.md` advanced to `stage: review`, `next_handover: handover-NN-implement-p2.md`.
