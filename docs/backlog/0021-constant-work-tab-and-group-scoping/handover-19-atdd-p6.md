---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: atdd
feature_phase: 6
for_next_phase: implement
outcome: success
reason: ""
produced_at: 2026-05-31T22:50:30Z
produced_commit: ""
---
## Summary

ATDD for feature 0021 **Phase 6** (the sixth **Constant work tab** — an editable table with
smart per-field editors and CSV export) is complete. Authored one new acceptance file
`tests/acceptance/phase-6-constant-work-tab.test.js` covering scenarios AT-1…AT-11 (15 `it`
blocks, with triangulation built into AT-3/AT-4/AT-5/AT-6/AT-8). **Migrated the one legacy
test the plan names:** `tests/acceptance/phase-2-groups-tab.test.js`'s AT-1 tab-count
scenario (five tabs → six, with `Constant work` fifth / `Groups` sixth) — edited in this
RED-authoring session and frozen. RED confirmed: the plan's combined acceptance command exits
**1** (16 failed / 33 passed across both files); the focused inner run (`-t "AT-4:"`,
the size-`<select>` render seam) exits **1** (3 failed / 12 skipped); the full suite
(`npm run verify`) exits **1** with **16 failed / 188 passed / 1 skipped** — RED confined to
the new Phase 6 file (15) + the migrated Phase 2 AT-1 (1); every other test file passes. No
production code was written.

## Instructions for the next phase

`implement` (feature-phase **6**) — implement inline in `index.html` per ADR-0034 and the
plan's **Phase 6** slice (plan lines ~903-1058). Model everything on the existing Initiatives
tab. Touchpoints (current line numbers, post-Phase-5):

1. **Tab bar markup (`index.html:1015-1021`).** Insert a sixth button **after** the
   `initiatives` button and **before** the `groups` button:
   `<button class="tab-btn" data-tab="constant-work">Constant work</button>`. Final order must
   be exactly `org, teams, projections, initiatives, constant-work, groups` (AT-1 asserts the
   `data-tab` sequence and that `Constant work` is the **fifth** button).

2. **Tab panel markup (`index.html:1053-1067`).** Insert a sixth panel **after**
   `#tab-initiatives` and **before** `#tab-groups`:
   `<div id="tab-constant-work" class="tab-panel" style="display:none"><div id="constant-work-table-wrap"></div></div>`.
   The `class="tab-panel"` + inline `style="display:none"` is load-bearing: the generic
   tab-switch handler (`index.html:4309-4316`) toggles `display:flex`/`none` by panel id, and
   AT-2 asserts the panel exists, is `display:none`, with the `org` button active by default;
   AT-3 asserts clicking the `constant-work` tab flips it to `display:flex`.

3. **`renderConstantWorkTable()`** — new function modelled on `renderInitiativesTable`
   (`index.html:3548-3640` neighbourhood). It reads `editedConstantWork`, builds the whole
   table as a single string, and assigns to `#constant-work-table-wrap.innerHTML` **once**.
   Per-column editor rule (AT-4/AT-5/AT-6):
   - **`tshirt_size` / `t_shirt_size`** → a `<select>` whose options are **exactly** the seven
     **Recognised t-shirt sizes** `['2XS','XS','S','M','L','XL','XL+']` (source them from
     `Object.keys(T_SHIRT_PARAMS)` or a literal; AT-4 asserts `option` values `.toEqual` the
     seven in that order), with the row's current value selected. If the imported value is
     **unrecognised** (e.g. `XXL`), the seven canonical options must still all be present and
     the current value shown as an extra selected option (AT-4 boundary — do not silently drop
     it; this is the silent-0-PM-footgun close, but it must not lose data).
   - **`category` / `team` / `quarter`** (and the ADR-0023 aliases: `category|moscow|emoji`,
     `team`, `quarter`) → `<input list="…">` datalist combos. The datalist options for **each**
     of category/team/quarter are the observed **union** of `editedInitiatives` **and**
     `editedConstantWork` values for that field (AT-5: the category datalist must contain
     initiative-only `A`, initiative-only `B`, **and** constant-work-only `C`; team/quarter
     datalists must contain both a constant-work value and an initiative value). The initiative
     side reads from `editedInitiatives` (note its team column is `teams`, plural) — gather its
     observed values; the constant-work side reads `editedConstantWork`. **Do NOT** seed the
     datalist from `parsedConstantWork`/`parsedInitiatives` only, and **do NOT** seed it from
     constant work alone (counterexample: "A datalist seeded only from `editedConstantWork`").
   - **`jira_key`, `epic_name`, `key_result`, and any unknown extra columns** (e.g. `notes`) →
     free-text `<input type="text">` with **no** `list` attribute and **no** `<select>`
     (AT-6 asserts each is a text input with `hasAttribute('list') === false` and no sibling
     `<select>`). **No cell is read-only** — the Constant work tab has no Epics join to
     protect (counterexample + forbidden shortcut: do not protect `jira_key`/`epic_name`).
   - Header row `<th>` text must equal the column key (the tests locate cells by matching
     `<th>` text to the row-object key, exactly as `renderInitiativesTable` does).
   - Inline `onchange` handlers write `this.value` to `editedConstantWork[rowIdx][col]` **and**
     call `tryUpdatePreview()` (AT-7/AT-10). No Run fires from an edit (commit-on-Run). Use the
     `safeCol = escapeAttr(col)` idiom for the handler attribute, `escapeHtml` for cell text /
     option labels, `escapeAttr` for attribute values (AT-11: a `<script>` payload must render
     as inert text — no `<script>` element added; the input's `value` is the literal string).
   - A toolbar with a `↓ Export CSV` button (`class="add-marker-btn" onclick="exportConstantWorkCSV()"`),
     mirroring the Initiatives toolbar.
   - Empty state: when `editedConstantWork` is null/empty, render an empty table (the
     `+ Add row` authoring affordance is **Phase 7**, out of scope here).

4. **`exportConstantWorkCSV()`** — new function modelled on `exportInitiativesCSV`
   (`index.html:4053-4063`): no-op when `editedConstantWork` is null/empty; otherwise
   `Papa.unparse(editedConstantWork)` → `Blob` → anchor with `download = 'constant-work-edited.csv'`
   → click → revoke. **Preserve the imported header set verbatim** — header order is
   `Object.keys(editedConstantWork[0])`; do **not** normalise aliases to canonical names and do
   **not** reorder columns (AT-8 asserts the header line equals the imported headers
   `epic_key,building_block,t_shirt_size,category,team,quarter,notes` exactly and that it does
   NOT contain `tshirt_size`/`jira_key`; AT-9 asserts the export round-trips through
   `loadConstantWorkCSV`).

5. **Wire the render + visibility-reset into the Run handler (`index.html:4337-4421`).** Call
   `renderConstantWorkTable()` in the run-button render sequence (next to
   `renderInitiativesTable()` at `index.html:4404`), and add
   `document.getElementById('tab-constant-work').style.display = 'none';` to the
   visibility-reset block (`index.html:4416-4420`) so a fresh Run resets to the Organization
   Level tab with the Constant work panel hidden.

6. **CSS** for `#constant-work-table-wrap` and its toolbar, mirroring `#initiatives-table-wrap`
   (Module 1 `<style>` block). Not asserted by tests; keep it consistent.

7. **GREEN target:**
   `npx vitest run tests/acceptance/phase-6-constant-work-tab.test.js tests/acceptance/phase-2-groups-tab.test.js`
   exits 0 (Phase 6: all 15 `it`s pass; Phase 2: all 34 pass incl. the migrated AT-1), **and**
   `npm run verify` (full suite) returns to green (204 passed / 1 skipped — the 16 RED tests
   flip, no regression). Make the tests pass **without editing any test file**.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the **Phase 6** slice
  (lines ~903-1058) is the spec: behavioral rule, invariants (six `.tab-btn`; size `<select>`
  is exactly the seven sizes; category/team/quarter datalists are the `editedInitiatives ∪
  editedConstantWork` union; `onchange` writes `this.value` + calls `tryUpdatePreview`, no
  Run; export is no-op when empty, imported header order), counterexamples (size as free-text
  or observed-sizes-only; category/team/quarter as a plain `<select>`; read-only key/name
  cells; export normalising/reordering headers; edit triggering a Run or skipping
  `tryUpdatePreview`; datalist seeded only from `editedConstantWork`), forbidden shortcuts,
  definition of done.
- `tests/acceptance/phase-6-constant-work-tab.test.js` — the frozen Phase 6 acceptance tests
  (read for the exact seam contract; **do NOT edit**). Seams exercised: the sixth tab
  button/panel markup; `renderConstantWorkTable()` writing `#constant-work-table-wrap`; the
  size `<select>` option set; the `<input list>` datalist combos (resolved dynamically via each
  input's `list` attribute → the referenced `<datalist>`'s options); `exportConstantWorkCSV()`
  download name + header line; the `onchange` write-through + `tryUpdatePreview` spy; the
  `escapeHtml`/`escapeAttr` inertness check.
- `tests/acceptance/phase-2-groups-tab.test.js` — its **AT-1** scenario was migrated to six
  tabs this session and is now frozen (do **not** edit). AT-2…AT-33 are unchanged and stay
  green.
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-6-acceptance-red.log` —
  confirmed combined acceptance RED (command, exit 1, full output: 16 failed / 33 passed).
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-6-inner-red.log` — the focused
  inner run (`-t "AT-4:"`, exit 1, 3 failed / 12 skipped); documents the size-`<select>` render
  seam and that Phase 6 has no separate inner-loop test file.
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-6-verify-ci.log` — full-suite
  run proving the RED is targeted (16 failed / 188 passed / 1 skipped; only the new file + the
  migrated AT-1 fail).
- `docs/adr/0034-editable-constant-work-tab.md` — the design rationale: the sixth tab, the
  `editedConstantWork` source of truth, smart per-field editors (size `<select>`; datalist
  combos seeded from the observed union), CSV export verbatim, commit-on-Run; from-scratch /
  add / delete is **Phase 7** (out of scope here).
- `docs/adr/0027-editable-initiatives-tab-with-csv-export.md` — the editable-tab + commit-on-Run
  + immutable-substrate pattern this phase mirrors (`renderInitiativesTable` /
  `exportInitiativesCSV` are the templates).
- `docs/adr/0028-category-as-generalized-moscow.md` — case-insensitive Category comparison +
  the (Blank) sentinel; relevant to the category datalist union.
- `docs/adr/0023-constant-work-csv-deterministic-shift.md` — the constant-work CSV alias
  cascade (`category|moscow|emoji`, `tshirt_size|t_shirt_size`, `epic_name|building_block`,
  `jira_key|epic_key`, `key_result|KR|kr`) the editors and export must respect.
- `CONTEXT.md` — glossary; canonical terms (Constant work, Constant work tab, Category, Group,
  Tab, Tab panel, Initiatives tab, Recognised t-shirt sizes, Data preview, Run).

The test commit SHA (the `implement`→`review` diff boundary) is the commit of THIS handover
file — derive it with:
`git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-19-atdd-p6.md`.
No SHA is embedded here (each phase is one atomic commit).

## Context the next phase needs

Autonomous decisions taken this session (the interactive Step-4 seam proposal and Step-7
test-API review have no user in Loop mode):

- **Chosen seams (stable, plan-named — no private helper name or incidental DOM detail locked
  in):**
  - *Tab markup:* the plan-named `data-tab="constant-work"`, `#tab-constant-work`, and
    `#constant-work-table-wrap` ids are the only structural names asserted. Tab reveal is
    driven through the **real** generic tab-switch handler (clicking the `.tab-btn`), not a
    private switch function.
  - *Render seam:* `renderConstantWorkTable()` (called explicitly via `execIn` in tests, as the
    Run handler will call it in production). Cells are located by matching `<th>` text to the
    row-object key (the `renderInitiativesTable` convention) — robust to column ordering.
  - *Datalist combos:* the `<datalist>` `id` and CSS classes are **intentionally not locked in**
    (per the plan's "Do NOT lock in"). The test reads `input.getAttribute('list')` and resolves
    the referenced `<datalist>` dynamically, then asserts its `<option>` values — so any id /
    class scheme is fine as long as the union of values is offered.
  - *Export seam:* `exportConstantWorkCSV()` (called directly). The download name + the Blob
    content's first line are asserted via the same `Blob`/`createElement('a').download`
    interception used by the Phase-3 JSON-persistence export test — no real file I/O.
  - *Preview-refresh seam:* AT-10 spies on `tryUpdatePreview` by **reassigning** the page-scope
    binding to a counter before dispatching `change`; the inline handler resolves the binding at
    call time, so this captures the real call. "No Run fired" is asserted by `typeof chartInstance`
    being unchanged across the edit (the same technique as Phase-2 Groups-tab AT-19).
- **AT-2 verification choice (recorded gated decision):** the plan's AT-2 ("panel hidden
  immediately after a Run") is verified through the panel's **default/after-Run hidden state**
  (`#tab-constant-work` exists, `class="tab-panel"`, `style.display === 'none'`, with the `org`
  button active) — exactly the seam the sibling Phase-2 Groups-tab AT-2 uses — rather than
  driving the asynchronous `setTimeout`-deferred Run handler in jsdom (which would be flaky and
  risk unrelated chart-render throws). The visibility-reset block is still required by the plan
  (instruction 5 above) and AT-3 exercises the live tab-switch reveal; this choice only avoids
  asserting through the async Run path. The implementer must still add `#tab-constant-work` to
  the reset block so production behaviour matches.
- **Triangulation coverage:**
  - *Tab order:* happy (full `data-tab` sequence equals the six-tab order), negative (Groups
    stays last; Constant work is not after it).
  - *Row rendering:* happy (3 rows → 3 `<tr>`), boundary (1 row → 1 `<tr>`).
  - *Size `<select>`:* happy (`M` → exactly the seven sizes, `M` selected), alias
    (`t_shirt_size` also renders a size `<select>`), **boundary/property** (an unrecognised
    `XXL` keeps all seven canonical options present **and** preserves the current value).
  - *Datalist union:* happy + **property** (category datalist ⊇ {initiative-only A,
    initiative-only B, constant-work-only C}); team/quarter each assert a constant-work value
    **and** an initiative value (the union, not a single source).
  - *Free-text columns:* negative (each of `jira_key`/`epic_name`/`key_result`/`notes` has no
    `list` attribute and no `<select>`).
  - *Export:* happy (name + exact header line), **negative** (aliases NOT rewritten to
    canonical names), round-trip (re-import reproduces the edited model).
- **Legacy migration this phase:** the plan's "Test-contract migration" note names exactly one
  Phase-6 migration — `phase-2-groups-tab.test.js`'s tab-count assertion (five → six). Done and
  frozen: AT-1's `describe`/`it` text and assertions now require six `.tab-btn` with the full
  ordered `data-tab` sequence, `Constant work` fifth, `Groups` sixth. No other committed test
  asserts the tab count or references a Constant work tab, so nothing else needed migrating.
  (Phase 8's `phase-2-groups-tab.test.js` AT-28 Members-popover migration is a **later** phase —
  left untouched here.)
- **No separate inner-loop seam:** the plan states Phase 6's inner tests are "covered in the
  acceptance file" (the render + export functions are the seams). The `…-inner-red.log` records
  a *focused* run (`-t "AT-4:"`, isolating the size-`<select>` render — the most
  algorithmic/domain-significant inner behaviour, the silent-0-PM-footgun close) rather than a
  second test file. No standalone unit test was authored.
- **Test-API review verdict:** all imposed names match `CONTEXT.md` / the plan verbatim
  (Constant work, Constant work tab, Category, Group, Tab, Recognised t-shirt sizes, Data
  preview, Initiatives tab; the engine helper `getConstantWorkEffortPerGroup` reused in AT-7;
  `editedConstantWork`/`parsedConstantWork`/`editedInitiatives`/`tryUpdatePreview`/
  `tshirtToPersonMonths` are existing bindings). The only structural names introduced are the
  three plan-named ids and the two plan-named functions. No incidental seams. Recommendation:
  proceed.

RED gate detail (from the persisted logs):
- Acceptance command: `npx vitest run tests/acceptance/phase-6-constant-work-tab.test.js tests/acceptance/phase-2-groups-tab.test.js`
  → exit **1**, 16 failed / 33 passed.
- Inner command: `npx vitest run tests/acceptance/phase-6-constant-work-tab.test.js -t "AT-4:"`
  → exit **1**, 3 failed / 12 skipped (the size-`<select>` render seam is RED).
- Full suite (`npm run verify`) → exit **1**, 16 failed / 188 passed / 1 skipped (RED confined
  to the new Phase 6 file + the migrated Phase 2 AT-1).
- Failure reasons match the plan's Phase 6 RED gate exactly:
  - AT-1 (both files): only five `.tab-btn` exist (`expected length 5 to be 6`) — no
    `Constant work` button yet.
  - AT-3/AT-4/AT-5/AT-6/AT-7/AT-10/AT-11: `#tab-constant-work` / `#constant-work-table-wrap`
    do not exist and `renderConstantWorkTable` is undefined, so the table never renders (cell
    queries return `null`/empty).
  - AT-8/AT-9: `exportConstantWorkCSV` is undefined — no Export CSV button mounts and the
    export call yields no Blob.

## Definition of done (for implement)

- `npx vitest run tests/acceptance/phase-6-constant-work-tab.test.js tests/acceptance/phase-2-groups-tab.test.js`
  exits 0 (Phase 6 AT-1…AT-11, all 15 `it`s; Phase 2 all 34 incl. the migrated AT-1).
- `npm run verify` (full suite) exits 0 — no regression (204 passed / 1 skipped).
- A sixth `Constant work` tab button (fifth position, `data-tab="constant-work"`) and a
  `#tab-constant-work` panel containing `#constant-work-table-wrap` exist, between Initiatives
  and Groups.
- `renderConstantWorkTable()` renders all cells editable with the documented per-field editors
  (size `<select>` of the seven sizes; category/team/quarter `<input list>` combos seeded from
  the `editedInitiatives ∪ editedConstantWork` union; keys/name/kr/extras as free text), writes
  `#constant-work-table-wrap.innerHTML` once, and escapes cell text/attrs.
- `exportConstantWorkCSV()` is a no-op when empty; otherwise downloads `constant-work-edited.csv`
  with the imported header set verbatim (no normalisation/reorder), round-tripping through
  re-import.
- Edits commit to `editedConstantWork` immediately, call `tryUpdatePreview`, fire **no** Run,
  and flow into the next Run.
- `renderConstantWorkTable()` is called in the Run handler; `#tab-constant-work` is in the
  visibility-reset block.
- No test file was edited (the test commit SHA is the boundary).
- `git diff` for the implement commit touches only `index.html` (plus the plan / ADRs /
  CONTEXT.md if a material clarification surfaces).
- `index.md` advanced to `stage: review`, `next_handover: handover-NN-implement-p6.md`.
