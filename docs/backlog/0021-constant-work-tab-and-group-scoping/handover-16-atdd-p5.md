---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: atdd
feature_phase: 5
for_next_phase: implement
outcome: success
reason: ""
produced_at: 2026-05-31T22:25:14Z
produced_commit: ""
---
## Summary

ATDD for feature 0021 **Phase 5** (Constant-work quarters in the **Target quarter**
selector + **Data preview** surfacing of per-Group constant-work PM and exclusions) is
complete. Authored one new acceptance file
`tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js` covering scenarios
AT-1…AT-6 (6 `it` blocks). **No legacy test migration was needed this phase** — the plan
names no Phase-5 migration (the migrations are concentrated in Phases 1/2/6/8), and no
committed test asserts the pre-Phase-5 selector source or preview shape. RED confirmed:
the targeted acceptance run exits **1** (3 failed / 3 passed); the focused inner run
(`-t "Data preview"`) exits **1** (2 failed / 1 passed / 3 skipped); the full suite
(`npm run verify`) exits **1** with **3 failed / 186 passed / 1 skipped** — RED confined to
the new file (12 other test files pass). No production code was written.

## Instructions for the next phase

`implement` (feature-phase **5**) — implement inline in `index.html` per ADR-0033 and the
plan's **Phase 5** slice (plan lines ~787-899). Three independent, well-scoped edits, all
in `index.html`:

1. **`refreshQuarters` (`index.html:1667-1686`) — split the two selector sources.** Today
   both selectors are populated from `all = initiatives ∪ epics` quarters
   (`histMS.populate(all, …); targetMS.populate(all, …)`). Change so the **Historical**
   selector keeps `all` (initiatives ∪ epics) and the **Target** selector is populated from
   `all ∪ editedConstantWork` quarters. Concretely: derive
   `fromCW = editedConstantWork ? extractQuarters(editedConstantWork) : []` (the existing
   `extractQuarters` reads each row's `.quarter`, trims, dedups, and sorts), build
   `allTarget = [...new Set([...all, ...fromCW])]` sorted with the **same** Q-quarter
   comparator already used for `all`, and call `targetMS.populate(allTarget, targetDef)`
   while `histMS.populate(all, histDef)` is unchanged. Preserve the existing
   selection-preservation logic; only widen what the Target selector's `populate` list and
   its `targetDef`/`curTarget` validity check consider valid (so a constant-work-only
   target quarter can stay selected). **Read `editedConstantWork`, not
   `parsedConstantWork`** (the Phase 1 substrate / source of truth). For the source split to
   be observable after a Constant Work CSV load, ensure `refreshQuarters()` is invoked once
   constant work changes — `loadConstantWorkCSV` (`index.html:1787-1794`) does **not**
   currently call it; add a `refreshQuarters()` call there (and consider `resetConstantWorkFile`,
   `index.html:1776-1785`, for symmetry). The Phase 5 tests call `refreshQuarters()`
   explicitly, so this wiring is not strictly required to make them green, but it is required
   for the user-visible behavior and is the natural completion of the slice.

2. **`prepareSimulationData`'s `preview` (`index.html:2039-2049`) — add three fields.** The
   org-wide per-Group vector `fixedEffortPerGroup` is **already computed** at
   `index.html:2033` (`getConstantWorkEffortPerGroup(targetQuarters, groupsStore)`) and
   returned at the top level (`index.html:2051`) but is **not** in the `preview` object.
   Add to `preview`:
   - `fixedEffortPerGroup` — the same vector already computed (aligned index-for-index with
     `preview.kPerGroup` / `preview.groupNames`).
   - `cwExcludedPM` — total `tshirtToPersonMonths` of `editedConstantWork` rows whose
     `quarter ∈ targetQuarters` **and** whose normalised **Category** is in **no** Group's
     members (overlap-aware: a row counts only if it matches no Group). Use the existing
     `normalizeCategory` + the `category → moscow → emoji` cascade and the trim + case-fold
     + **(Blank) sentinel** membership semantics that `getConstantWorkEffortPerGroup`
     (`index.html:1831-1865`) and `bucketRowsByGroups` already use — DRY by reusing/extending
     one of those, or a small sibling helper. **Do NOT** double-count: a Category in ≥1
     Group is never excluded, regardless of how many Groups it is in.
   - `cwExcludedRows` — the count of those same excluded rows.
   When there is no constant work or nothing is excluded, both must be `0` (the tests accept
   `0` or absent for the no-exclusion case, but `0` is cleaner and what AT-6 documents).

3. **`renderPreview` (`index.html:3136-3173`) — surface both.** Beside each per-Group `K`
   row (the `groupKRows` map at `index.html:3150-3154`), also show that Group's
   constant-work person-months from `preview.fixedEffortPerGroup[i]` (the rendered text must
   contain a `PM` figure — the AT-4 assertion is `grid` text matches `/PM/i`; exact
   wording/format is **yours to choose**, plan does not lock it). Add a dedicated line
   reporting the excluded constant work when `preview.cwExcludedRows > 0` (or always, with a
   `0`), e.g. `Constant work in no group: <PM> PM across <N> rows — excluded`. AT-5 asserts
   the rendered grid text matches `/excluded/i`; AT-6 asserts the rendered text does **not**
   match `/[1-9]\d*\s*rows?\b[\s\S]*excluded/i` (i.e. no *positive* excluded row count) — so
   a zero/absent excluded line is fine when nothing is excluded, but you must not emit a
   positive excluded-rows line when `cwExcludedRows === 0`.

4. **Do NOT** add any Run-time gate, alert, or modal for excluded constant work — surfacing
   is the **Data preview** only (ADR-0033 lenient validation; the plan's forbidden shortcut).
   **Do NOT** add constant-work quarters to the **Historical** selector, and **Do NOT**
   populate both selectors from the same (target) list. Constant work must still contribute
   **zero** to any Group's `kPerGroup` / **Poisson λ** / **Bootstrap pool**.

5. **GREEN target:**
   `npx vitest run tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js`
   exits 0 (all 6 `it`s pass), **and** `npm run verify` (full suite) returns to green (190
   passed / 1 skipped — no regression). Make the tests pass **without editing any test
   file**.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the **Phase 5** slice
  (lines ~787-899) is the spec: behavioral rule, invariants (esp. "Target options ⊇ Hist
  options; difference = constant-work-only quarters"; "cwExcludedPM/Rows count target-quarter
  rows in no Group, overlap-aware"), counterexamples (esp. "refreshQuarters that adds CW
  quarters to the Historical selector"; "an excluded count that includes constant work that
  *is* in some Group"; "a Run gate / alert when CW is excluded"), forbidden shortcuts,
  definition of done.
- `tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js` — the frozen Phase 5
  acceptance tests (read for the exact seam contract; **do NOT edit**). Seams exercised:
  `refreshQuarters()` + the rendered checkbox options under `#target-ms .ms-options-wrap` /
  `#hist-ms .ms-options-wrap`; `prepareSimulationData(hist, target).preview.fixedEffortPerGroup`
  / `.cwExcludedPM` / `.cwExcludedRows`; `renderPreview(preview)` → `#preview-grid` text.
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-5-acceptance-red.log` —
  confirmed acceptance RED (command, exit 1, full output: 3 failed / 3 passed).
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-5-inner-red.log` — the
  focused inner run (`-t "Data preview"`, exit 1, 2 failed / 1 passed / 3 skipped); documents
  the inner preview-field seam and that Phase 5 has no separate inner-loop seam.
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-5-verify-ci.log` —
  full-suite run proving the RED is targeted (3 failed / 186 passed / 1 skipped; only the new
  file fails).
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` — engine semantics:
  constant-work quarters are **Target**-only (never Historical — they cannot inform λ / the
  bootstrap pool); per-Group `fixedEffortPerGroup`; exclusion is surfaced, never silently
  dropped; lenient validation (no Run gate).
- `docs/adr/0028-category-as-generalized-moscow.md` — case-insensitive (trim + case-fold)
  Category comparison + the (Blank) sentinel — the membership semantics the excluded-count
  computation must reuse.
- `CONTEXT.md` — glossary; canonical terms (Constant work, Category, Group, Scenario, Target
  quarter, Data preview, Poisson λ, Bootstrap pool, MultiSelect, Quarter selector).

The test commit SHA (the `implement`→`review` diff boundary) is the commit of THIS handover
file — derive it with:
`git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-16-atdd-p5.md`.
No SHA is embedded here (each phase is one atomic commit).

## Context the next phase needs

Autonomous decisions taken this session (the interactive Step-4 seam proposal and Step-7
test-API review have no user in Loop mode):

- **Chosen seams (stable, plan-named — no private helper name locked in):**
  - *Quarter selectors:* every selector assertion drives through the plan's stable entry
    point `refreshQuarters()` and reads the **user-observable** option list — the `value` of
    each rendered `<input type=checkbox>` in `#target-ms .ms-options-wrap` /
    `#hist-ms .ms-options-wrap` — NOT the internal `MultiSelect.quarters` field. This pins
    the contract (Target ⊇ Historical; difference = constant-work-only quarters) while
    leaving the widget's internals free.
  - *Preview surfacing:* AT-4/AT-5/AT-6 assert the plan-named `preview` fields
    `fixedEffortPerGroup`, `cwExcludedPM`, `cwExcludedRows` (exact values), plus a **lenient**
    rendered-text presence check (`/PM/i` for the per-Group PM; `/excluded/i` for the
    excluded line; a *negative* `/[1-9]\d*\s*rows?…excluded/i` guard for the no-exclusion
    case). Per the plan, the exact wording/number formatting of the rendered lines is
    **intentionally not asserted** — only that the information is surfaced. Whether the
    excluded summary is computed inline in `prepareSimulationData` or in a small helper is
    left open.
- **RED-driver vs preserved-guard split (matches the plan RED gate):** AT-1 (Target lists a
  constant-work-only quarter), AT-4 (`preview.fixedEffortPerGroup` exists + rendered PM), and
  AT-5 (`preview.cwExcludedRows`/`cwExcludedPM` exist + rendered excluded line) are the three
  RED-drivers — exactly the scenarios the plan's RED gate names. AT-2, AT-3, AT-6 are
  **preserved-behavior guards** that are GREEN on the post-Phase-4 build:
  - *AT-2* (pure-constant-work forecast from a constant-work-only Target quarter) already
    works — `fixedEffortPerGroup` has applied to any target quarter since Phase 2; AT-2 pins
    that a Target quarter with no Initiatives yields `kPerGroup` all-0 and each Group flat at
    its shift, so the implementer cannot regress it while widening the selector source.
  - *AT-3* (Historical selector source unchanged) is GREEN today (the Historical selector
    never listed constant-work-only quarters); it is the **negative guard** for the
    counterexample "refreshQuarters adds CW quarters to the Historical selector" — it must
    stay GREEN after the Target-selector widening.
  - *AT-6* (no positive excluded line when every Category is in a Group) uses
    `(preview.cwExcludedPM || 0) === 0` so it tolerates absent-or-zero (the plan explicitly
    allows "a zero/absent line"); GREEN today (fields undefined → `|| 0`), and the
    overlap-aware negative is the load-bearing complement to AT-5's positive case.
- **Triangulation coverage** of the two rules:
  - *Selector source:* happy (AT-1 Q4 2026 in Target), negative (AT-1/AT-3 Q4 2026 / Q1 2027
    NOT in Historical), **property** (AT-1 `Target − Historical === ['Q1 2027','Q4 2026']`
    over a set, with an overlapping `Q3 2026` CW row proving overlap is excluded from the
    difference), boundary (AT-3 exact-equality on the Historical list).
  - *Exclusion count:* happy (AT-5 one `Ops` row excluded), **overlap-aware negative**
    (AT-5's `Backend` row IS in a Group → not counted; `.not.toBeCloseTo` the Ops+Backend
    total), boundary (AT-5's out-of-target-quarter `Ops` row → not counted; AT-6 zero
    excluded).
- **No separate inner-loop seam:** the plan states Phase 5's inner tests are "covered in the
  acceptance file". The `…-inner-red.log` therefore records a *focused* run
  (`-t "Data preview"`, isolating AT-4/AT-5/AT-6 — the `preview`-object field seam) rather
  than a second test file. No standalone unit test was authored.
- **No legacy migration this phase:** confirmed by re-reading the plan's "Test-contract
  migration" note (Phases 1/2/6/8 only) — no committed test asserts the pre-Phase-5 selector
  source or the pre-Phase-5 preview shape, so nothing needed migrating/freezing beyond the
  new file.
- **Test-API review verdict:** all imposed names match `CONTEXT.md` / the plan verbatim
  (Constant work, Category, Group, Scenario, Target quarter, Historical quarter, Data
  preview, Poisson λ, Bootstrap pool, MultiSelect, `fixedEffortPerGroup`, `cwExcludedPM`,
  `cwExcludedRows`). The only DOM seam read is the public option-checkbox markup the widget
  already renders; the only `preview` fields read are the three plan-named additions plus the
  pre-existing `kPerGroup` / `groupNames`. No incidental seams. Recommendation: proceed.

RED gate detail (from the persisted logs):
- Acceptance command: `npx vitest run tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js`
  → exit **1**, 3 failed / 3 passed.
- Inner command: `npx vitest run tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js -t "Data preview"`
  → exit **1**, 2 failed / 1 passed / 3 skipped (the preview-field seam is RED).
- Full suite (`npm run verify`) → exit **1**, 3 failed / 186 passed / 1 skipped (RED confined
  to the new file).
- Failure reasons match the plan's Phase 5 RED gate exactly:
  - AT-1: `refreshQuarters` populates both selectors from `initiatives ∪ epics`, so the
    constant-work-only `Q4 2026` appears in the Target selector's options for **neither**
    selector — `expected [ 'Q2 2026', 'Q3 2026' ] to include 'Q4 2026'`.
  - AT-4: `preview.fixedEffortPerGroup` is `undefined`
    (`Array.isArray(undefined) === false`) — the preview has no per-Group constant-work PM.
  - AT-5: `preview.cwExcludedRows` is `undefined` (`expected undefined to be 1`) — the
    preview has no excluded line.

## Definition of done (for implement)

- `npx vitest run tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js`
  exits 0 (AT-1…AT-6, all 6 `it`s pass).
- `npm run verify` (full suite) exits 0 — no regression (190 passed / 1 skipped).
- The **Target** selector's option source is `initiatives ∪ epics ∪ editedConstantWork`
  quarters; the **Historical** selector's source stays `initiatives ∪ epics` (no
  constant-work-only quarter leaks in).
- `prepareSimulationData`'s `preview` carries `fixedEffortPerGroup` (group-aligned),
  `cwExcludedPM`, and `cwExcludedRows` (overlap-aware, target-quarter-scoped).
- `renderPreview` surfaces the per-Group constant-work PM beside each per-Group `K` row and
  an excluded line (no *positive* excluded-rows line when `cwExcludedRows === 0`).
- No Run gate / alert for excluded constant work; constant work does not affect `kPerGroup` /
  `lambda` / `epicSizingDist`.
- No test file was edited (the test commit SHA is the boundary).
- `git diff` for the implement commit touches only `index.html` (plus the plan / ADRs /
  CONTEXT.md if a material clarification surfaces).
- `index.md` advanced to `stage: review`, `next_handover: handover-NN-implement-p5.md`.
