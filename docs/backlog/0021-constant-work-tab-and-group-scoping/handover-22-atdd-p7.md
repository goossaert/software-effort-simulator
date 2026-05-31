---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: atdd
feature_phase: 7
for_next_phase: implement
outcome: success
reason: ""
produced_at: 2026-05-31T23:21:39Z
produced_commit: ""
---
## Summary

ATDD for feature 0021 **Phase 7** (**Add row / delete row / from-scratch authoring** on the
**Constant work tab** — the ADR-0034 delta over the read-only-shaped Initiatives tab) is
complete. Authored one new acceptance file
`tests/acceptance/phase-7-constant-work-add-delete.test.js` covering scenarios AT-1…AT-7
(11 `it` blocks, with triangulation built into AT-1/AT-3/AT-5 — happy / boundary / negative /
property). **No legacy test migration was needed this phase** (the plan's migration table
concentrates migrations in Phases 1/2/6/8; no committed test asserts the absence of an
add/delete control). RED confirmed on the post-Phase-6 build: acceptance run **11 failed / 11,
exit 1** (every AT fails because the `+ Add row` and per-row delete controls do not exist yet
— AT-1 "no + Add row", AT-3 "no per-row delete", exactly the plan's RED gate); focused inner
run (`-t "AT-1:"`) **2 failed / 9 skipped, exit 1**; full suite (`npm run verify`)
**11 failed / 204 passed / 1 skipped, exit 1** — RED confined to the new file (the 204 passed
equals the post-Phase-6 baseline; the 1 skipped is the pre-existing self-skipping
`sanity-check-engine-mean.test.js`). No production code was written. Logs persisted under
`docs/atdd-logs/`.

## Instructions for the next phase

`implement` (feature-phase 7) — make the Phase 7 acceptance tests GREEN by editing **only**
`index.html` (ADR-0001 single-file app). Do **not** edit any test file (the test commit is the
enforcement boundary).

1. Read the plan's **Phase 7** slice and implement the `+ Add row` / delete / from-scratch
   behaviour inside `renderConstantWorkTable` and two new handlers, mirroring the Groups-tab
   pattern (`appendNewGroup` / `deleteGroup`, `index.html:3764-3855`):
   - **`+ Add row` control**: render a clickable control **whose visible text matches
     `/add row/i`** somewhere inside the `#tab-constant-work` panel (the test locates it by
     text within that panel, not by a CSS class or function name). It must render **even when
     `editedConstantWork` is `null`/`[]`** (the current empty-state early-return at
     `index.html:3684-3687` renders "No constant work loaded." with **no** control — that must
     change so the empty state still offers `+ Add row`). The trailing `+ New group` row in
     `renderGroupsTab` (`index.html:3803-3807`) is the established placement idiom.
   - **Add-row handler**: append a blank row to `editedConstantWork`, initialising
     `editedConstantWork = []` first when it is `null` (`parsedConstantWork` stays `null` —
     from-scratch authoring). The new row's **key set** is:
     - the **canonical schema** `['jira_key','epic_name','key_result','category','team','quarter','tshirt_size']`
       when `parsedConstantWork === null` (nothing imported to mirror);
     - otherwise the **imported header set** = `Object.keys(editedConstantWork[0])` (so all rows
       share columns and the export still round-trips).
     All values blank (`''`). Re-render the table after appending.
   - **Per-row delete control**: render **one `<button>` per data row** (the test finds the
     single `<button>` inside a `<tbody> <tr>`; editor cells are `<input>`/`<select>`, never
     buttons). Glyph is free (`×` / `Delete` / `Remove` all pass). Its handler **splices**
     that row out of `editedConstantWork` immediately — **no `confirm()` / dialog** (the test
     stubs `window.confirm` and asserts it is never called) — preserving the order of the rest,
     then re-renders.
2. Reuse the existing seams unchanged: the size `<select>` / datalist-combo / free-text cell
   editors (`CW_SIZE_COLS` / `CW_CATEGORY_COLS` / `CW_TEAM_COLS` / `CW_QUARTER_COLS`,
   `index.html:3656-3659`), the inline `onchange` write-through + `tryUpdatePreview`, and
   `exportConstantWorkCSV()` (`index.html:4197`). An added row's cells must render the **same**
   smart editors as imported rows (AT-6) — this is automatic if the add-row handler just
   appends a row and lets `renderConstantWorkTable` render it.
3. Lenient blanks (AT-5) are **already** correct in the engine
   (`getConstantWorkEffortPerGroup` / `tshirtToPersonMonths` / `normalizeCategory`); do not
   add coercion. A blank `tshirt_size` → `tshirtToPersonMonths('')` → `0`; a blank `quarter` is
   not in any Target-quarter set → excluded; a blank `category` → `normalizeCategory('')` →
   `BLANK` (matches only Groups whose `members` include the **(Blank) sentinel**).
4. Run `npx vitest run tests/acceptance/phase-7-constant-work-add-delete.test.js` (expect
   11/11 GREEN) and `npm run verify` (expect 215 passed / 1 skipped, exit 0). The diff must
   touch only `index.html`.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the **Phase 7** slice
  (`## Phase 7`, ~line 1061): acceptance behavior, behavioral rule, invariants, counterexamples,
  forbidden shortcuts, RED gate, definition of done. THE CONTRACT.
- `tests/acceptance/phase-7-constant-work-add-delete.test.js` — the frozen Phase 7 tests
  (the GREEN target). Read the header comment for the seam contract; do not edit.
- `CONTEXT.md` — glossary (Constant work, Constant work tab, Category, Group, (Blank) sentinel,
  Target quarter, Recognised t-shirt sizes).
- `docs/adr/0034-editable-constant-work-tab.md` — `+ Add row` / per-row delete / from-scratch
  authoring / commit-on-Run; the Out-of-scope items (no Duplicate-row, no confirmation on
  delete, no localStorage).
- `docs/adr/0023-constant-work-csv-deterministic-shift.md` and
  `docs/adr/0028-category-as-generalized-moscow.md` — the lenient-blank / (Blank)-sentinel
  semantics AT-5 asserts (already implemented; do not change).
- `index.html` — `renderConstantWorkTable` (`3681-3747`), the `CW_*_COLS` sets (`3656-3659`),
  `_cwObservedValues` (`3665`), `exportConstantWorkCSV` (`4197`); the Groups-tab add/delete
  idiom `renderGroupsTab` / `appendNewGroup` / `deleteGroup` (`3764-3855`); the run-button
  render sequence (`~4551`, where `renderConstantWorkTable()` is already called).
- Test commit SHA (derive after this commit lands):
  `git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-22-atdd-p7.md`.

## Context the next phase needs

**Autonomously-chosen seams (no user in Loop mode — recorded here per the contract):**

- **The add/delete controls are tested through the rendered UI, not by handler name.** The
  plan's "Do NOT lock in" list forbids locking the control markup or the canonical-schema
  constant; it also does not name the handler functions. So the tests:
  - locate `+ Add row` as *any* `button`/`a`/`[role="button"]` inside `#tab-constant-work`
    whose text matches `/add\s*row/i`, and click it (`.click()`);
  - locate per-row delete as the single `<button>` inside a data `<tr>` (preferring text
    `/delete|remove|×|✕|✖|^x$/i`, else the first button), and click it.
  This means the implementer is free to choose placement, glyph, and function names — any
  rendering that surfaces a text-`/add row/i` control and a per-row button satisfies the tests.
  Clicking inline-`onclick` buttons is a **proven** harness capability (the Phase-2 Groups-tab
  tests drive `appendNewGroup` / `deleteGroup` / `removeGroupMember` the same way).
- **Authored-row behaviour (AT-4/AT-5) is asserted via the Phase-2 engine seam**
  `getConstantWorkEffortPerGroup(quarters, groups, teamName?)`, not via a full Run, to keep the
  assertion deterministic and to verify the *engine reads `editedConstantWork`* regardless of
  `parsedConstantWork` (from-scratch). Cells are filled by setting the rendered editor's
  `.value` and dispatching a `change` event (the inline write-through), exactly as a user would.
- **The canonical-schema KEY SET is the contract** (`['jira_key','epic_name','key_result',
  'category','team','quarter','tshirt_size']`, in that order); whether it lives in a shared
  constant or inline is the implementer's call (the plan's "Do NOT lock in" note).
- **The `editedConstantWork === []` boundary is covered** (AT-1 second `it`): the first add on an
  already-empty array must still produce one canonical row — so the handler's "initialise to
  `[]` when null" must not *reset* a non-null empty array.
- **AT-2 distinguishes the two branches with a negative**: with an imported header set
  (`epic_key, building_block, t_shirt_size, …`), the new row's keys must equal the imported set
  and must **not** contain `jira_key` or `tshirt_size` — so an implementation that always uses
  the canonical schema fails AT-2, and one that always mirrors row 0 fails AT-1's from-null case.

**RED-gate decision:** all 11 `it`s are RED on the post-Phase-6 build (the add/delete controls
are absent), which subsumes and exceeds the plan's named RED gate (AT-1, AT-3). AT-4–AT-7 are
written to author *through* the add control (faithful to the scenarios "the user clicks
+ Add row …"), so they are RED for the same root cause rather than being preserved-behavior
guards; their assertions still pin the *engine*/export behaviour that must hold post-implement.

## Definition of done (for implement)

- `tests/acceptance/phase-7-constant-work-add-delete.test.js` passes 11/11.
- `+ Add row` appends a blank row (canonical schema when nothing imported, else the imported
  header set) and initialises `editedConstantWork` to `[]` when `null`; the control renders even
  in the empty state.
- Per-row delete splices immediately with no confirmation, preserving order; the table
  re-renders after add and delete.
- From-scratch authoring feeds the simulation (`parsedConstantWork` stays `null`); lenient
  blanks behave as documented (size→0 PM, quarter→excluded, Category→BLANK).
- No test file is edited; `git diff` touches only `index.html`.
- `npm run verify` exits 0 (expected 215 passed / 1 skipped).
