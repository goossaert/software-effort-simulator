---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: implement
feature_phase: 5
for_next_phase: review
outcome: success
reason: ""
produced_at: 2026-05-31T22:33:03Z
produced_commit: ""
---
## Summary

Implemented feature 0021 **Phase 5** (Constant-work quarters in the **Target
quarter** selector + **Data preview** surfacing of per-Group constant-work PM and
exclusions) entirely inline in `index.html`. Three independent edits: (1)
`refreshQuarters` now sources the **Target** selector from
`initiatives ∪ epics ∪ editedConstantWork` quarters while the **Historical**
selector keeps `initiatives ∪ epics`; (2) `prepareSimulationData`'s `preview`
gained `fixedEffortPerGroup` (the already-computed org-wide vector),
`cwExcludedPM`, and `cwExcludedRows` (a new overlap-aware
`getConstantWorkExcluded` helper); (3) `renderPreview` surfaces the per-Group
constant-work PM beside each per-Group `K` row and a positive "excluded" line.
GREEN confirmed: targeted acceptance **6/6 pass** (exit 0); `npm run verify`
exits **0** (189 passed / 1 skipped — no regression). No test file was edited
(working tree change is `index.html` only).

## Instructions for the next phase

`review` (feature-phase **5**) — independent verification. Derive the diff
boundary `test_commit..impl_commit` from git log (see below) and verify the
general rule, invariants, counterexamples, and forbidden shortcuts of the plan's
**Phase 5** slice (plan lines ~787-899) hold, with no test gaming / overfitting.

The single production change is `index.html`. What changed and the general rule
each part implements:

1. **`refreshQuarters` (now ~`index.html:1667-1692`) — Target/Historical source
   split.** Extracted the Q-quarter comparator to a local `cmpQuarter` (reused for
   both sorts — DRY, no behavior change). `all = initiatives ∪ epics` (Historical
   source, unchanged); `allTarget = [...new Set([...all, ...fromCW])].sort(cmpQuarter)`
   where `fromCW = editedConstantWork ? extractQuarters(editedConstantWork) : []`
   (Target source). `histMS.populate(all, histDef)` is unchanged; `targetMS.populate(allTarget, targetDef)`.
   The Target selection-preservation check now validates `curTarget` against
   `allTarget` (so a constant-work-only target quarter can stay selected); the
   `targetDef` fallback uses `allTarget`. *General rule:* the Target selector's
   source is `initiatives ∪ epics ∪ editedConstantWork`; the Historical selector's
   source stays `initiatives ∪ epics` (constant work cannot inform λ / the
   bootstrap pool) — ADR-0033.
2. **`loadConstantWorkCSV` + `resetConstantWorkFile` — wired in `refreshQuarters()`.**
   `loadConstantWorkCSV` now calls `refreshQuarters()` after `syncAutoDefaultGroup()`
   (so a freshly loaded CW quarter shows up in the Target selector); `resetConstantWorkFile`
   calls `refreshQuarters()` at the end (symmetry — CW-only quarters drop out of the
   Target selector when the source is cleared). *General rule:* a constant-work
   source change refreshes the selectors. (The Phase 5 tests call `refreshQuarters()`
   explicitly, so this wiring is not strictly required for GREEN, but completes the
   user-visible slice; it does not affect the test outcomes.)
3. **New helper `getConstantWorkExcluded(quarters, groups, teamName=null)` (after
   `getConstantWorkEffortPerGroup`).** Returns `{pm, rows}` for in-scope
   `editedConstantWork` rows (quarter ∈ `quarters`, optional team match) whose
   normalised **Category** is in **no** Group's members. Membership reuses the
   exact trim + case-fold + **(Blank) sentinel** semantics of
   `getConstantWorkEffortPerGroup` / `bucketRowsByGroups` and the same
   `category → moscow → emoji` cascade via `normalizeCategory`. *Overlap-aware:* it
   builds the **union** of all Groups' members once and excludes a row only if its
   Category is in *none* of them — a Category in ≥1 Group is never excluded.
4. **`prepareSimulationData`'s `preview` — three fields added.** `fixedEffortPerGroup`
   (the vector already computed at the call site, aligned with `kPerGroup` /
   `groupNames`), `cwExcludedPM`, `cwExcludedRows` (from `getConstantWorkExcluded(targetQuarters, groupsStore)`).
   *General rule:* the per-Group constant-work allocation and the in-no-Group
   exclusion are surfaced on the preview object.
5. **`renderPreview` — surfacing.** Each per-Group `K` row's `pv` span now reads
   `K = <k> · <pm>.<1> PM constant` (the per-Group PM from
   `preview.fixedEffortPerGroup[i]`, default `0`). A dedicated excluded line is
   emitted **only when `preview.cwExcludedRows > 0`**:
   `Constant work in no group: <pm> PM across <n> rows — excluded`. Nothing is
   emitted when `cwExcludedRows === 0` (no positive excluded-rows line). *General
   rule:* preview-only surfacing of per-Group PM + exclusion (no Run gate / alert).

What was deliberately **not** touched (forbidden shortcuts / invariants): no
Run-time gate / alert / modal for excluded constant work (surfacing is the Data
preview only); the Historical selector never lists a constant-work-only quarter;
the two selectors are populated from *different* lists; constant work still
contributes **zero** to any Group's `kPerGroup` / **Poisson λ** / **Bootstrap pool**
(the engine path is unchanged — `fixedEffortPerGroup` is the same additive
post-sort shift introduced in Phase 2).

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the **Phase 5** slice
  (lines ~787-899): behavioral rule, invariants (esp. "Target options ⊇ Hist
  options; difference = constant-work-only quarters"; "`cwExcludedPM/Rows` count
  target-quarter rows in no Group, overlap-aware"), counterexamples (a
  `refreshQuarters` that adds CW quarters to the Historical selector / populates
  both from the same list; a preview omitting per-Group CW PM; an excluded count
  that includes work that *is* in some Group; a Run gate when CW is excluded),
  forbidden shortcuts, definition of done.
- `tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js` — the
  frozen Phase 5 acceptance tests (AT-1…AT-6). Seams: `refreshQuarters()` + the
  rendered option checkboxes under `#target-ms .ms-options-wrap` /
  `#hist-ms .ms-options-wrap`; `prepareSimulationData(...).preview.fixedEffortPerGroup`
  / `.cwExcludedPM` / `.cwExcludedRows`; `renderPreview(preview)` → `#preview-grid`
  text. **Do NOT edit.**
- `index.html` — the only production change. Read `refreshQuarters`,
  `getConstantWorkEffortPerGroup` + the new `getConstantWorkExcluded`,
  `prepareSimulationData`'s preview block, and `renderPreview`.
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` — constant-work
  quarters are **Target**-only; exclusion is surfaced, never silently dropped;
  lenient validation (no Run gate).
- `docs/adr/0028-category-as-generalized-moscow.md` — trim + case-fold Category
  comparison + the (Blank) sentinel (the membership semantics the excluded-count
  computation reuses).
- `docs/backlog/0021-constant-work-tab-and-group-scoping/handover-16-atdd-p5.md` —
  the atdd handover: seam contract, RED-driver vs preserved-guard split,
  triangulation coverage.
- `CONTEXT.md` — glossary (Constant work, Category, Group, Target quarter,
  Historical quarter, Data preview, Poisson λ, Bootstrap pool, MultiSelect).

Derive the diff boundary:
```
git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-16-atdd-p5.md   # test commit (= 0d56a92)
git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-17-implement-p5.md  # impl commit (this commit)
```
Review `test_commit..impl_commit` (production should be `index.html`-only; the
plan / ADRs / CONTEXT.md were not changed this phase).

## Context the next phase needs

Autonomous decisions taken this session (no user in Loop mode):

- **Comparator extraction.** The inline Q-quarter sort comparator in
  `refreshQuarters` was lifted to a local `const cmpQuarter` and reused for both
  the `all` and `allTarget` sorts. Pure refactor (identical comparison logic) — it
  keeps the two sources sorted by the same rule the original used.
- **Excluded summary lives in a small sibling helper** (`getConstantWorkExcluded`),
  not inline in `prepareSimulationData` — the plan explicitly leaves this open
  ("whether the excluded summary is computed inside `prepareSimulationData` or a
  small helper"). It mirrors `getConstantWorkEffortPerGroup`'s shape and reuses the
  identical membership semantics, computing the member **union** once so the
  overlap-aware rule ("excluded iff in no Group") is structurally correct rather
  than per-Group-and-then-combined.
- **Excluded line is conditional (`cwExcludedRows > 0`).** The plan allows "a
  zero/absent line"; emitting nothing when there is no exclusion is the cleanest
  way to satisfy AT-6's negative guard
  (`not.toMatch(/[1-9]\d*\s*rows?\b[\s\S]*excluded/i)`) while AT-5 still sees the
  positive line. No other text in the grid contains the word "excluded".
- **Per-Group PM wording.** Rendered as `K = <k> · <pm>.<1> PM constant`. The plan
  intentionally does not lock wording/format — only that the per-Group PM is
  surfaced (AT-4 asserts `/PM/i`). Verified this does not regress the two existing
  `renderPreview` assertions: `phase-1-engine.test.js`
  (`/\bA\b[\s\S]*K\s*=\s*5/`, `/\bB\b[\s\S]*K\s*=\s*4/`,
  `not /K_must…/`) and `preview-hist-init-count-engine-denominator.test.js`
  (`Initiatives used (hist.)` label + denominator) — appending ` · … PM constant`
  to the `pv` span leaves all four matches intact.
- **GREEN evidence (commands + exit codes):**
  - `npx vitest run tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js`
    → exit **0**, **6 passed** (AT-1…AT-6).
  - `npm run verify` → exit **0**, **189 passed / 1 skipped** (full log:
    `.agent/last-verify.log`, gitignored). The `Not implemented: navigation`
    lines are pre-existing jsdom warnings, not failures (suite still exits 0).
    Note the atdd handover's "190 passed" target was off by one — RED was
    3 failed / 186 passed / 1 skipped (190 total); flipping the 3 → 189 passed /
    1 skipped. No regression: every previously-passing test still passes.
- **No test file edited.** `git diff --name-only 0d56a92..HEAD -- tests features
  e2e acceptance` is empty; the working-tree change is `index.html` only.

## Definition of done (for review — PASS criteria)

- The diff `test_commit..impl_commit` touches only `index.html` (no test files; no
  plan/ADR/CONTEXT change this phase).
- The general Phase 5 rule holds: Target source = `initiatives ∪ epics ∪
  editedConstantWork`; Historical source = `initiatives ∪ epics`; the two
  selectors are populated from different lists; `preview.fixedEffortPerGroup`
  (group-aligned) + `preview.cwExcludedPM` / `cwExcludedRows` (overlap-aware,
  target-quarter-scoped) are present; `renderPreview` surfaces per-Group PM and a
  positive-only excluded line.
- None of the Phase 5 counterexamples is realizable; the forbidden shortcuts (Run
  gate / alert; both selectors from the same list) are absent.
- Constant work contributes zero to any Group's `kPerGroup` / `lambda` /
  `epicSizingDist` (engine path unchanged).
- `npx vitest run tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js`
  exits 0 (6 passed) and `npm run verify` exits 0 (189 passed / 1 skipped).
- No test file drifted across `test_commit..impl_commit`.
