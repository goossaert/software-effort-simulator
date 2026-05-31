---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: implement
feature_phase: 7
for_next_phase: review
outcome: success
reason: ""
produced_at: 2026-05-31T23:29:12Z
produced_commit: ""
---
## Summary

Implemented feature 0021 **Phase 7** — **Add row / delete row / from-scratch authoring** on the
**Constant work tab** (the ADR-0034 delta over the read-only-shaped Initiatives tab) — inline in
`index.html` (the single production file; ADR-0001). The Phase 7 acceptance suite is now GREEN:
`npx vitest run tests/acceptance/phase-7-constant-work-add-delete.test.js` → **11/11 pass, exit 0**;
`npm run verify` → **215 passed / 1 skipped, exit 0** (the 1 skipped is the pre-existing
self-skipping `tests/verification/sanity-check-engine-mean.test.js`; the 11 RED-drivers flipped with
no regression — the post-Phase-6 baseline was 204 passed). No test file was edited; `git diff` touches
only `index.html`.

## What changed (for the reviewer)

All edits are confined to `index.html`. Four mechanical changes implementing one general rule
(ADR-0034: the Constant work tab gains `+ Add row` + per-row delete; from-scratch authoring works
with no CSV):

1. **`CW_CANONICAL_SCHEMA` constant** (near the `CW_*_COLS` recognisers, ~`index.html:3661`):
   `['jira_key','epic_name','key_result','category','team','quarter','tshirt_size']` — the KEY SET
   for a from-scratch row (the plan's "Do NOT lock in" note allows shared-constant or inline).
2. **`renderConstantWorkTable` restructure** (~`index.html:3687`): the toolbar — now `+ Add row`
   (button text matching `/add row/i`) **plus** the existing `↓ Export CSV` — is built once and
   rendered in **every** state. The empty-state branch (`!hasRows`) now renders
   `toolbar + "No constant work loaded."` instead of early-returning with no control, so `+ Add row`
   is reachable from-scratch (AT-1). `+ Add row` lives in the toolbar, **not** as a `<tbody>` row, so
   `#constant-work-table-wrap tbody tr` count stays exactly one-per-data-row (preserves Phase-6 AT-3
   and Phase-7 AT-1/AT-3 row-count assertions). Export renders only when `hasRows` (unchanged
   behaviour — the empty branch never rendered it).
3. **Per-row delete column** (in the row loop): a trailing `<th></th>` in the head and a trailing
   `<td><button class="group-row-btn danger" onclick="deleteConstantWorkRow(${rowIdx})">Delete</button></td>`
   per data row. It is the **single** `<button>` in the row (editor cells are `<input>`/`<select>`),
   and the trailing column keeps every data-column index intact (header-text→index lookup in the
   tests is unaffected).
4. **Two new handlers** (after `renderConstantWorkTable`):
   - `addConstantWorkRow()` — `if (editedConstantWork === null) editedConstantWork = [];` (an
     already-`[]` model is **not** reset; `parsedConstantWork` stays `null`), then
     `cols = (parsedConstantWork === null) ? CW_CANONICAL_SCHEMA : Object.keys(editedConstantWork[0] || parsedConstantWork[0] || {})`,
     push a row with every column `''`, re-render.
   - `deleteConstantWorkRow(rowIdx)` — `editedConstantWork.splice(rowIdx, 1)` then re-render. **No
     `confirm()`/dialog** (AT-3 stubs `window.confirm` and asserts 0 calls); order preserved.

Reused unchanged: the size `<select>` / datalist-combo / free-text cell editors
(`CW_SIZE_COLS`/`CW_CATEGORY_COLS`/`CW_TEAM_COLS`/`CW_QUARTER_COLS`), the inline `onchange`
write-through + `tryUpdatePreview`, `exportConstantWorkCSV()`, and the Phase-2 engine seam
`getConstantWorkEffortPerGroup` (the lenient-blank semantics — size→0 PM, blank quarter→excluded,
blank Category→(Blank) sentinel — were already correct; **no coercion was added**, per the
forbidden-shortcuts list).

## Instructions for the next phase

`review` (feature-phase 7) — independently verify the diff implements the **general** ADR-0034 rule
and that none of the Phase 7 counterexamples is realizable. Read the plan's Phase 7 slice and the
frozen tests **first**, then the diff.

1. Derive the commit range:
   ```bash
   git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-22-atdd-p7.md   # test commit (= be17a60)
   git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-23-implement-p7.md # impl commit (this commit)
   ```
   Diff `test_commit..impl_commit` — it must touch **only** `index.html` (plus this handover + the
   index.md advance).
2. Confirm the invariants hold by construction and the counterexamples (must NOT pass):
   - `+ Add row` is **not** gated behind a loaded CSV (from-scratch works: AT-1/AT-4/AT-5/AT-6 all
     author through the control with `parsedConstantWork === null`).
   - An added row's keys equal the **other rows'** keys (shared-columns contract): canonical from
     null-import, imported header set otherwise (AT-1 vs AT-2 distinguish the two branches; AT-2's
     negative asserts no `jira_key`/`tshirt_size` for an imported file).
   - Delete is **immediate, no confirmation**, and preserves order (AT-3; `window.confirm` spy = 0).
   - A blank `tshirt_size` contributes `0` PM and does not throw (AT-5).
3. Suggested negative controls (revert after): (a) gate `+ Add row` behind `parsedConstantWork`
   (re-add the no-control empty state) → AT-1/AT-4/AT-5/AT-6 fail; (b) make `addConstantWorkRow`
   always use `CW_CANONICAL_SCHEMA` → AT-2 fails; (c) add a `confirm()` to delete returning false →
   AT-3 fails. Each should flip exactly the named AT(s); revert → 11/11 GREEN.
4. Re-run targeted (`npx vitest run tests/acceptance/phase-7-constant-work-add-delete.test.js`,
   expect 11/11) and `npm run verify` (expect 215 passed / 1 skipped, exit 0). Confirm no test file
   drifted across `test_commit..impl_commit`.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the **Phase 7** slice (`## Phase 7`,
  ~line 1061): behavioral rule, invariants, counterexamples, forbidden shortcuts, RED gate, DoD.
  THE CONTRACT.
- `tests/acceptance/phase-7-constant-work-add-delete.test.js` — the frozen Phase 7 tests (AT-1…AT-7,
  11 `it`s). The GREEN target; read the header for the seam contract. Do not edit.
- `index.html` — `CW_CANONICAL_SCHEMA` (~`3661`), `renderConstantWorkTable` (~`3687`, toolbar +
  trailing delete column), `addConstantWorkRow` / `deleteConstantWorkRow` (immediately after
  `renderConstantWorkTable`); the Groups-tab delete idiom `deleteGroup` / `appendNewGroup`
  (~`3870-3890`) for comparison.
- `docs/adr/0034-editable-constant-work-tab.md` — `+ Add row` / per-row delete / from-scratch /
  commit-on-Run; Out-of-scope (no Duplicate-row, no delete confirmation, no localStorage).
- `docs/adr/0023-constant-work-csv-deterministic-shift.md` + `docs/adr/0028-category-as-generalized-moscow.md`
  — the lenient-blank / (Blank)-sentinel semantics AT-5 asserts (already implemented; do not change).
- Commit SHAs to diff (derive per the commands above).

## Context the next phase needs

**Autonomously-taken decisions (no user in Loop mode — recorded per the contract):**

- **`+ Add row` placement: the toolbar, not a trailing `<tbody>` row.** The Groups tab puts
  `+ New group` as a trailing `<tr>` in its `<tbody>`, but the Phase-7 (and Phase-6) tests count
  `#constant-work-table-wrap tbody tr` to assert the exact data-row count (AT-1 expects 1, AT-3's
  boundary expects 0 after deleting the last row). A toolbar button keeps that count exact in every
  state, including empty. This is the chosen deviation from the Groups idiom and is the safer reading
  of the frozen tests.
- **Per-row delete glyph: text `Delete`** (free per the plan / handover; `×`/`Remove`/`Delete` all
  satisfy `rowDeleteControl`'s regex). Rendered via the existing `group-row-btn danger` class (no new
  CSS). It is the single `<button>` in the row.
- **Add/delete re-render only — they do NOT call `tryUpdatePreview`.** This mirrors the established
  Groups-tab idiom (`appendNewGroup`/`deleteGroup` call only `renderGroupsTab`) and the
  commit-on-Run discipline; the tests assert neither presence nor absence of a preview refresh on
  add/delete. (Cell edits still call `tryUpdatePreview` via the unchanged inline `onchange`.)
- **Imported-header-set source is robust to a fully-emptied import**:
  `Object.keys(editedConstantWork[0] || parsedConstantWork[0] || {})`. AT-2 exercises the
  `editedConstantWork[0]` path (1 imported row present); the `parsedConstantWork[0]` fallback guards
  the "imported then all rows deleted, then + Add row" edge so it still yields the imported header
  set rather than throwing.
- **Lenient blanks: no coercion added** — left entirely to the engine
  (`getConstantWorkEffortPerGroup` / `tshirtToPersonMonths` / `normalizeCategory`), per the
  forbidden-shortcuts list. AT-5 passes against the unchanged engine.

**Note on the benign stderr in the logs:** the export anchor's `.click()` emits a jsdom
`Error: Not implemented: navigation (except hash changes)` to stderr (AT-7 / Phase-6 AT-8). It is
not a test failure — both suites report exit 0.

## Definition of done (for review — PASS criteria)

- The diff implements the general ADR-0034 rule in `index.html` only; no fixture literals,
  test-id branches, `NODE_ENV` checks, or `tests/` imports.
- All Phase 7 invariants hold; none of the counterexamples is realizable.
- No test file drifted across `test_commit..impl_commit`.
- Targeted suite 11/11 GREEN and `npm run verify` exits 0 (215 passed / 1 skipped).
