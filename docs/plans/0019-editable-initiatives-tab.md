# Feature: Editable Initiatives tab — `editedInitiatives` indirection, per-row dropdowns and numeric inputs, CSV export

Created at: 2026-04-21T00:00:00Z

## Context

This feature introduces the fourth result **Tab** — **Initiatives** (`#tab-initiatives`, `index.html:1027-1029`) — that surfaces every row of the loaded **Initiatives CSV** as a wide editable table and offers a `↓ Export CSV` button that serialises the user's edits back to a CSV file. The feature owns two new module-scoped concepts: `editedInitiatives` (`index.html:1497`), a per-row shallow-clone of `parsedInitiatives` that *every downstream consumer* of initiative data reads from instead of the original parse, and the **Initiatives tab** itself with its inline-edit dropdowns, numeric inputs, and read-only identity cells. The feature is *load-bearing* on the simulator's overall data flow: where every prior feature ([feature 0001](./0001-csv-upload-ui.md), [feature 0010](./0010-multi-quarter-selector.md), [feature 0011](./0011-team-level-tab.md), [feature 0012](./0012-team-projections-tab.md), [feature 0014](./0014-key-result-column.md), [feature 0015](./0015-constant-work-csv-upload.md)) treated `parsedInitiatives` as the simulation source of truth, this feature migrates every reader (`prepareSimulationData` `index.html:1709,1766`, `prepareTeamSimulationData` `index.html:1806,1825`, `buildTeamProjections` `index.html:1922,1935`, the projection-axis `extractQuarters` call `index.html:3356`) to `editedInitiatives` so user edits flow into the next **Run** automatically — see [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).

The feature is deliberately *commit-on-Run*: edits land in `editedInitiatives` immediately via inline `onchange` / `oninput` handlers, but the *other three* tabs' charts and stats do not update until the user presses **Run Simulation**. The Initiatives tab itself is *self-consistent* — the table is re-rendered as part of the Run cycle (`renderInitiativesTable()`, `index.html:3362`), so the rendered DOM always reflects the live `editedInitiatives` state at Run time. The dropdowns' option set is derived from the *immutable* `parsedInitiatives` (via `getUniqueColumnValues(parsedInitiatives)`, `index.html:3143`) so the option pool stays stable across edits — see [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md). Two columns are non-editable (the detected **Initiative key** and the detected name column), two are free-form numeric (`added_value_impact`, `added_value_cost_saving`), two are hidden from the table view but kept in the CSV export (`jira_link`, `emoji`), and everything else renders as a dropdown of observed values.

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). The tab markup, the CSS, the data model, the render function, and the export helper all live inline in `index.html`.
- [ADR-0002 — Client-side only](../adr/0002-client-side-only.md). Edits do not persist across browser sessions other than via the user-driven CSV export.
- [ADR-0018 — Tab-based results layout](../adr/0018-tab-based-results-layout.md). The Initiatives tab is the fourth result tab, pre-rendered per **Run**, sharing the existing tab-bar / tab-panel skeleton.
- [ADR-0021 — Sensible CSV format dual support](../adr/0021-sensible-csv-format-dual-support.md). The hidden `emoji` column is a **Quirky format** legacy artefact; the dropdowns and the non-editable key/name columns honour the format-agnostic **Column detector** outputs.
- [ADR-0022 — Optional Key Result column](../adr/0022-optional-key-result-column.md). The **Key Result** column appears as an editable dropdown when present in the CSV — the table reads `Object.keys(parsedInitiatives[0])`, not a curated column list.
- [ADR-0025 — Per-chart-context Marker system](../adr/0025-per-context-marker-system.md). The `↓ Export CSV` toolbar button follows the same `.add-marker-btn` styling as the chart-card export buttons, by intentional convention.
- [ADR-0027 — Editable Initiatives tab with `editedInitiatives` as the simulation source of truth](../adr/0027-editable-initiatives-tab-with-csv-export.md). The architectural decision for *why* this feature exists in the shape it does (two parallel arrays, edits flow into next Run, dropdowns from observed values, numeric carve-out for two value-impact fields, non-editable identity columns, hidden-but-exported legacy columns, render-once-per-Run, verbatim Papa.unparse export).

Glossary terms used below: **Initiatives CSV**, **Initiative**, **Initiative key**, **MoSCoW**, **Team**, **Quarter**, **Key Result**, **Quirky format**, **Sensible format**, **Tab**, **Tab panel**, **Run**, **Column detector** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user who has loaded an **Initiatives CSV** and pressed **Run Simulation** sees a new tab button labelled `Initiatives` after `Team Projections` in the tab bar. Clicking it reveals a wide horizontally-scrolling table with one row per initiative and one column per CSV header — except the `jira_link` and `emoji` headers, which are suppressed in the table view (and the row's "edit affordance" depends on the column). A single-row toolbar above the table holds a `↓ Export CSV` button on the right edge. There is no other chrome on the tab — no header, no filter, no row selector.

A user reads the table top-to-bottom: the **Jira key** column and the name column are rendered as plain dark-grey text (`.init-readonly-cell`), un-editable; every other column carries either a `<select>` dropdown (for categorical columns like `moscow`, `teams`, `quarter`, `key_result`) or a small `<input type="number" step="any">` field (for the two value-impact columns, `added_value_impact` and `added_value_cost_saving`). The user clicks a `moscow` cell, the dropdown opens, and the options are the unique observed MoSCoW values from the *original* loaded CSV (e.g. `Could`, `Must`, `Should`, `Won't`, sorted alphabetically) — plus the cell's current value if it is somehow not in the unique set. The user picks `Must`, the dropdown closes, and the table re-flows in place (the next press of Run will see the new value).

A user can edit any cell freely without consequence to the rest of the UI: the chart, the stats table, the per-team sections, the Team Projections matrix, and the **Data preview** all stay reflecting the *previous* Run until the user presses **Run Simulation** again. The Initiatives table's dropdown UI updates immediately to show the new selection; the simulation's interpretation of the new value waits for the next Run.

A user who has edited several cells clicks `↓ Export CSV`; a file named `initiatives-edited.csv` is downloaded immediately. Opening the file in a spreadsheet shows every column from the original CSV (including the two hidden ones, `jira_link` and `emoji`), in the original parsed column order, with the user's edits substituted into the appropriate cells. The user re-uploads this same file to the simulator on a fresh page-load and sees the same column-detection results as the original — round-trip-stable.

A user who presses Run after editing several cells sees the new edits feed into the engine: a MoSCoW change moves an initiative between scenarios (e.g. an initiative changed from `Could` to `Must` now contributes to the `Must Only` scenario's `K`); a team change moves an initiative between **Projection sections**; a quarter change moves it between **Target quarter** scope or out of scope entirely. The Run completes; the active tab resets to `Organization Level`; the Initiatives tab itself is re-rendered with the post-edit state preserved (the dropdowns continue to show the user's new selections).

A user who has not yet loaded an **Initiatives CSV**, or who has loaded one but never pressed Run, does not see the Initiatives tab content — the tab button only appears when the entire `#results-content` is visible (post-Run), and the tab panel itself is rendered as part of the run cycle.

A user who clicks `↓ Export CSV` while the table is empty (no rows in `editedInitiatives`) sees no download — the export silently no-ops via the `if (!editedInitiatives || !editedInitiatives.length) return` guard. This matches the empty-store guard on the **Marker CSV** save path ([ADR-0025](../adr/0025-per-context-marker-system.md)).

There is no row-add affordance, no row-delete affordance, no undo button, no "reset to original" control — every such control is listed as a future revision in [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md). The simulator's normal flow is: load CSVs → edit on the Initiatives tab → Run → repeat.

## Scope

### In scope

- The fourth tab-bar button (`<button class="tab-btn" data-tab="initiatives">Initiatives</button>`, `index.html:986`) and the fourth tab panel (`<div id="tab-initiatives" class="tab-panel" style="display:none"><div id="initiatives-table-wrap"></div></div>`, `index.html:1027-1029`).
- The CSS rules for `#initiatives-table-wrap`, `#initiatives-table-wrap table`, `#initiatives-table-wrap th`, `#initiatives-table-wrap td`, `#initiatives-table-wrap tr:hover td`, `#initiatives-table-wrap select`, `#initiatives-table-wrap select:focus`, `.init-readonly-cell`, and `.initiatives-toolbar` (`index.html:539-548`).
- The `editedInitiatives` module-scoped binding (`index.html:1497`): a `let` initially `null`, set to `parsedInitiatives.map(r => ({ ...r }))` immediately after `parsedInitiatives = parseCSV(text)` inside `loadInitiativesCSV` (`index.html:1505`), and reset to `null` inside `resetInitiativesFile` (`index.html:1619`).
- Migration of *every* downstream initiative-reader to `editedInitiatives`:
  - `prepareSimulationData` (`index.html:1709`, `1766`).
  - `prepareTeamSimulationData` (`index.html:1806`, `1825`).
  - `buildTeamProjections` (`index.html:1922`, `1935`).
  - The projection-axis `extractQuarters` call inside the run-button handler (`index.html:3356`).
- `getUniqueColumnValues(rows)` helper (`index.html:3124-3134`): for each column key in `rows[0]`, collect the non-empty unique values across all rows into a sorted `string[]`. Returns `{}` for empty input.
- `renderInitiativesTable()` (`index.html:3136-3189`): the main render function that reads `editedInitiatives` and writes a complete `<table>` into `#initiatives-table-wrap`. Internals:
  - Bail with `<p>No initiatives loaded.</p>` when `editedInitiatives` is null or empty.
  - Compute `uniqueVals = getUniqueColumnValues(parsedInitiatives)` (from the *immutable* parsed array, see [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md)).
  - Compute `nonEditable = new Set([detectedCols.initKeyCol, detectedCols.nameCol].filter(Boolean))`, `hiddenCols = new Set(['jira_link', 'emoji'])`, `numericCols = new Set(['added_value_impact', 'added_value_cost_saving'])`.
  - Compute `allCols = Object.keys(parsedInitiatives[0])` (the original CSV column order, preserved by the parser and the spread-clone) and `visibleCols = allCols.filter(c => !hiddenCols.has(c))`.
  - Emit the toolbar `<div class="initiatives-toolbar"><button class="add-marker-btn" onclick="exportInitiativesCSV()">↓ Export CSV</button></div>` and a `<table>` with `<thead>` rendering `visibleCols` and `<tbody>` rendering one `<tr>` per row of `editedInitiatives`.
  - Per cell:
    - If `nonEditable.has(col)`: emit `<td class="init-readonly-cell">${escapeHtml(val)}</td>`.
    - Else if `numericCols.has(col)`: emit `<td><input type="number" step="any" value="${escapeAttr(String(val))}" style="width:90px;font-size:12px;border:1px solid #d1d5db;border-radius:4px;padding:2px 6px" onchange="editedInitiatives[${rowIdx}]['${safeCol}'] = this.value" oninput="editedInitiatives[${rowIdx}]['${safeCol}'] = this.value"></td>`.
    - Else: emit `<td><select onchange="editedInitiatives[${rowIdx}]['${safeCol}'] = this.value">…</select></td>` where the option set is `allOpts = opts.includes(current) ? opts : (current ? [current, ...opts] : opts)`. When `allOpts` is empty, emit a single `<option value="">${escapeHtml(current)}</option>`.
- `exportInitiativesCSV()` (`index.html:3191-3201`): the export helper that builds a CSV via `Papa.unparse(editedInitiatives)`, wraps it in a `Blob`, creates an object URL, programmatically clicks a synthetic `<a>` with `download = 'initiatives-edited.csv'`, and revokes the URL. Bail with no download when `editedInitiatives` is null or empty.
- The render call inside the run-button handler (`index.html:3362`): a single `renderInitiativesTable();` invocation in the rendering sequence, immediately after the **Team Projections** render and before the visibility-reset block.

### Out of scope

- The Initiatives CSV parsing itself ([feature 0001](./0001-csv-upload-ui.md)). `loadInitiativesCSV`'s parsing call (`parsedInitiatives = parseCSV(text)`) is unchanged; this feature only adds the post-parse clone `editedInitiatives = parsedInitiatives.map(r => ({ ...r }))`.
- The **Column detector** family ([ADR-0021](../adr/0021-sensible-csv-format-dual-support.md), [ADR-0022](../adr/0022-optional-key-result-column.md)). The detectors run inside `loadInitiativesCSV` after this feature's clone step and produce `detectedCols.initKeyCol` / `nameCol` which the table reads; the detectors themselves are unchanged.
- The Monte Carlo engine (`runScenario`, `runSimulation`). Engine signatures and bodies are unchanged. The downstream-reader migration is a *substrate swap* — the engine reads from a different array but the array's per-row shape is identical to what `parsedInitiatives` would have produced.
- The org-level **Histogram**, **Stats**, **Marker** system, **Team Level tab**, **Team Projections tab**. All consume the *output* of `runSimulation`; the active initiative array is encoded in the inputs that flow through, not in any of these surfaces' code.
- The **Constant Work CSV** ([feature 0015](./0015-constant-work-csv-upload.md), [ADR-0023](../adr/0023-constant-work-csv-deterministic-shift.md)). Constant work is *not* surfaced on the Initiatives tab; the tab shows only **Initiatives**, not constant-work entries. The Constant Work CSV is a separate data flow with a fixed schema and a different rendering surface (the **Initiative matrix** in the **Team Projections tab**).
- The **Data preview** (`renderPreview`, `index.html:2818`). The preview reads the **Bootstrap pool** and per-**Initiative** count; this feature does not modify the preview's source-reading.
- The sidebar **T-shirt size reference**, the **Column-detection debug** panel.
- The tab-switching logic (`tab-btn` click handler). The new tab is added to the existing tab bar; the handler iterates `document.querySelectorAll('.tab-btn')` and `data-tab` mapping, so the fourth tab joins automatically — see [ADR-0018](../adr/0018-tab-based-results-layout.md).
- A "Reset to original" button. Listed as a future revision in [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- A row-add / row-delete affordance. Listed as a future revision in [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- An "edits pending" indicator on other tabs. Listed as a future revision in [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- Persisting edits across browser sessions. Listed as a future revision in [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md); would re-open [ADR-0002](../adr/0002-client-side-only.md).
- A column-chooser UI. Listed as a future revision in [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- Making the numeric carve-out data-driven (auto-detect numeric columns). Listed as a future revision in [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md); would re-open the ADR because the hardcoded `numericCols` set is load-bearing.
- Editing `jira_key` or the name column. Listed as a future revision in [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md); would re-open the ADR.
- An autocomplete-style dropdown for columns with many unique values. Listed as a future revision in [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- Schema transformation on export (e.g. renaming **Quirky format** headers to **Sensible format** on export). The export is verbatim — see [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).

## Relevant existing files

Claude may inspect:
- `index.html`, specifically:
  - The tab-bar markup (`index.html:982-987`) and the existing three tab panels (`index.html:990-1024`) — *for layout context*; the new tab button and panel slot into the same skeleton.
  - The tab-switch handler (`index.html:3275-3291`) — *for context only*; the handler iterates the existing buttons and panels generically.
  - `parsedInitiatives` declaration (`index.html:1496`) and `loadInitiativesCSV` (`index.html:1503-1516`) — the clone insertion point.
  - `resetInitiativesFile` (`index.html:1617-1622`) — the reset point for `editedInitiatives`.
  - Every downstream reader that currently names `parsedInitiatives` directly — for the migration:
    - `prepareSimulationData` (`index.html:1700-1800` neighbourhood).
    - `prepareTeamSimulationData` (`index.html:1800-1900` neighbourhood).
    - `buildTeamProjections` (`index.html:1917-2000` neighbourhood).
    - The run-button handler's `extractQuarters` call (`index.html:3356`).
  - `escapeHtml` and `escapeAttr` (`index.html:3110-3122`) — *for context only*; the render function uses both.
  - The `.add-marker-btn` CSS class (used by the org-level chart's buttons and the per-team charts' buttons) — *for context only*; the `↓ Export CSV` button reuses it.
  - The run-button handler's render sequence (`index.html:3340-3375`) — *for the render-call insertion point*.
  - The Papa.unparse usage elsewhere (e.g. `saveMarkersToCSV`, `index.html:3204-3219`) — *for context only*; the export helper follows the same blob/anchor pattern.
- `CONTEXT.md` glossary — the **Initiatives CSV**, **Initiative**, **Initiative key**, **MoSCoW**, **Team**, **Quarter**, **Key Result**, **Quirky format**, **Sensible format**, **Tab**, **Tab panel**, **Run**, **Column detector** entries.
- [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md) — the architectural decision this feature implements.
- [ADR-0018](../adr/0018-tab-based-results-layout.md) — the tab framework this feature extends.
- [ADR-0021](../adr/0021-sensible-csv-format-dual-support.md) — the format-dual-support rule that explains why `emoji` is hidden but exported.
- [ADR-0022](../adr/0022-optional-key-result-column.md) — the **Key Result** column's optionality, which the table renders only when present.
- `docs/plans/0018-empirical-lognormal-parameters.md` — the prior plan; mostly for context on the recent "Module 1 sidebar, Module 9 UI Glue" layering.

Claude should not inspect unless needed:
- The Monte Carlo engine internals (`runScenario`, `runSimulation`).
- The CSV parsing helpers (`parseCSV`, `readFile`).
- The chart, stats-table, **Marker** system, **Team Projections** rendering code.
- The **Constant Work CSV** code paths.

## Existing patterns to follow

- **Layering inside `index.html`**: the new tab markup lives in the `<section id="results-content">` block in Module 1, immediately after the **Team Projections tab** panel. The CSS lives in Module 1's `<style>` block, after the existing `.tab-panel` rule. The `editedInitiatives` binding sits next to `parsedInitiatives` in Module 4 (Data Cache). The `getUniqueColumnValues`, `renderInitiativesTable`, `exportInitiativesCSV` functions live in Module 7 (Initiatives Tab) — a new sub-module between the existing Module 6 (Chart & Stats Rendering) and the marker system. There is *no* new file.
- **Two parallel arrays, never a merged structure**: `parsedInitiatives` is the immutable parsed input; `editedInitiatives` is the mutable simulation source of truth. Do not introduce a third "merged view" or a getter that resolves edits-over-parsed lazily — see [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- **`editedInitiatives` is a `let`, not a `const`**: the binding is reassigned on every `loadInitiativesCSV` (to the freshly-cloned array) and on every `resetInitiativesFile` (to `null`). The *contents* of the array are mutated by the inline edit handlers; the array itself is only ever wholesale-reassigned at the file-lifecycle boundaries.
- **Shallow-clone-per-row at load time**: `parsedInitiatives.map(r => ({ ...r }))` produces a new top-level array whose elements are new objects with the same string-valued properties. Deep cloning is not needed because CSV cells are strings (or null/undefined when missing). Use the spread, not `Object.assign`, not `structuredClone`.
- **Engine reads `editedInitiatives`, dropdowns read `parsedInitiatives`**: the simulation reads from the mutable array; the dropdown-option enumeration reads from the immutable array. Crossing the wires (e.g. reading dropdowns from `editedInitiatives`) would collapse the option pool to whatever the user has typed last — see [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- **Inline `onchange` / `oninput` handlers writing directly to `editedInitiatives[rowIdx][col] = this.value`**: no delegated event listener, no virtual-DOM diff, no per-cell controller object. The handler is a one-liner because the contract is one-liner.
- **String values everywhere**: `this.value` is always a string, including from `<input type="number">`. The value lands in `editedInitiatives` as a string; downstream consumers already accept the string shape (since `parsedInitiatives`' values are also strings from `parseCSV`). Do not coerce to `Number` inside the handler.
- **Numeric carve-out is hardcoded**: the `numericCols` set lists exactly `added_value_impact` and `added_value_cost_saving`. Do not auto-detect.
- **Non-editable identity columns**: `nonEditable = new Set([detectedCols.initKeyCol, detectedCols.nameCol].filter(Boolean))`. The `.filter(Boolean)` covers the edge case where the name column could not be detected (`detectedCols.nameCol === null` would not happen at landing because `detectNameCol` always falls back to the column before `initKeyCol`, but the filter is defensive).
- **Hidden-but-exported columns are a single literal set**: `hiddenCols = new Set(['jira_link', 'emoji'])`. The set is consulted in the *view* path (skipped from `visibleCols`); it is *not* consulted in the *export* path (`Papa.unparse(editedInitiatives)` reads all keys of every row).
- **Column order is the original CSV's**: `Object.keys(parsedInitiatives[0])` returns keys in parse order, which is preserved by both the spread-clone and `Papa.unparse`. Do not sort, do not curate.
- **`escapeHtml` for cell text, `escapeAttr` for attribute values**: the table uses both — text content of `<td>` and `<th>` goes through `escapeHtml`; the `value` attribute of `<input>` and the option `value` go through `escapeAttr`. Inline `onchange` handler bodies use the *unescaped* `safeCol` because the column name is a JS-string-literal key — but `escapeAttr` is still applied to `safeCol` to defang quotes.
- **Toolbar button reuses `.add-marker-btn` class**: the `↓ Export CSV` button shares the chart-card export button styling, consistent with the Marker CSV save/load buttons (see [ADR-0025](../adr/0025-per-context-marker-system.md)).
- **Render-once-per-Run, not lazy on tab activation**: the render call sits in the run-button handler alongside `renderTeamCharts`, `renderTeamProjections`, etc. The tab-switch handler is generic and does not need to know about the Initiatives render.
- **Empty-store export is a silent no-op**: matches the **Marker CSV** save path's empty-store alert (which alerts; the Initiatives export does *not* alert — see [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md) — because the button is only visible inside the rendered table, and the empty-table case shows "No initiatives loaded." instead of the toolbar).
- **CSV filename is hardcoded**: `initiatives-edited.csv`. Do not prompt the user, do not parameterise by run count or timestamp.
- **No framework, no library**: vanilla DOM, PapaParse for CSV (already imported), vanilla CSS. The table is built by string concatenation and assigned to `innerHTML` — matching the simulator's overall rendering pattern.
- **Verification command**: manual. Open `index.html`, load CSVs, press Run, click the Initiatives tab, edit a cell, press Run again, confirm the engine reflects the edit, export the CSV, re-upload it, confirm round-trip stability.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer — this is a client-side-only app ([ADR-0002](../adr/0002-client-side-only.md)). The in-memory state owned by this feature is one new mutable binding and one transient table render:

```js
// Module 4 — Data Cache.

let parsedInitiatives = null;            // immutable result of parseCSV (existing).
let editedInitiatives = null;            // ← NEW: per-row shallow-clone of parsedInitiatives.

// Module 7 — Initiatives Tab.

function getUniqueColumnValues(rows) {
  // Returns: { [columnName: string]: string[] } — sorted unique non-empty values per column.
  if (!rows || !rows.length) return {};
  const cols = Object.keys(rows[0]);
  const result = {};
  cols.forEach(col => {
    result[col] = [...new Set(
      rows.map(r => r[col]).filter(v => v !== undefined && v !== null && v !== '')
    )].sort();
  });
  return result;
}

function renderInitiativesTable(): void { /* builds DOM into #initiatives-table-wrap */ }
function exportInitiativesCSV(): void  { /* triggers initiatives-edited.csv download */ }

// Hardcoded literal sets used inside renderInitiativesTable:
const hiddenCols  = new Set(['jira_link', 'emoji']);
const numericCols = new Set(['added_value_impact', 'added_value_cost_saving']);
// nonEditable is computed per-call from detectedCols.
```

The DOM markup:
```html
<!-- Module 1 — results section -->
<button class="tab-btn" data-tab="initiatives">Initiatives</button>
<!-- ... -->
<div id="tab-initiatives" class="tab-panel" style="display:none">
  <div id="initiatives-table-wrap"></div>
</div>
```

No new module file, no new class, no new event-bus, no per-cell controller object. The edit flow is one DOM event listener (per `<select>` / `<input>`) writing one property assignment.

---

## Phase 1: `editedInitiatives` indirection — clone at load, reset on file-clear, migrate every downstream reader

### Acceptance behavior

Scenario AT-1: Loading an Initiatives CSV creates `editedInitiatives` as a per-row shallow clone of `parsedInitiatives`
Given the user uploads a valid **Initiatives CSV**
When `loadInitiativesCSV(text)` runs
Then `parsedInitiatives` equals the `parseCSV(text)` output (existing behaviour)
And `editedInitiatives` is a new top-level array with the same length as `parsedInitiatives`
And for every index `i`: `editedInitiatives[i] !== parsedInitiatives[i]` (different object references)
And for every index `i` and key `k`: `editedInitiatives[i][k] === parsedInitiatives[i][k]` (same property values)
And `Object.keys(editedInitiatives[i])` equals `Object.keys(parsedInitiatives[i])` in the same order (spread preserves insertion order)

Scenario AT-2: Mutating `editedInitiatives[i][k]` does not mutate `parsedInitiatives[i][k]`
Given `loadInitiativesCSV(text)` has run
When the user reassigns `editedInitiatives[0].moscow = 'Must'` in DevTools
Then `parsedInitiatives[0].moscow` is the original CSV value (unchanged)
(Per-row shallow clone isolates the two arrays at the row level.)

Scenario AT-3: `resetInitiativesFile` sets both `parsedInitiatives` and `editedInitiatives` to `null`
Given an **Initiatives CSV** is loaded
When the user clicks the `✕ Remove file` button on the initiatives upload
Then `parsedInitiatives === null`
And `editedInitiatives === null`
And the simulator returns to its empty-state

Scenario AT-4: `prepareSimulationData` reads `editedInitiatives` for the historical-quarter filter
Given an **Initiatives CSV** is loaded
And the user has edited `editedInitiatives[0].quarter` from `Q2 2026` to `Q1 2026`
And `Q1 2026` is the selected **Historical quarter**
When `prepareSimulationData` runs (e.g. via **Run**)
Then `prepareSimulationData` includes the edited row in the historical-quarter scope
(The reader at `index.html:1709` now reads from `editedInitiatives`.)

Scenario AT-5: `prepareSimulationData` reads `editedInitiatives` for the target-quarter filter
Given an **Initiatives CSV** is loaded
And the user has edited `editedInitiatives[0].moscow` from `Could` to `Must`
And the row's quarter is one of the selected **Target quarter(s)**
When `prepareSimulationData` runs
Then the row is counted in the `K_must` scenario, not `K_must+should+could` only
(The reader at `index.html:1766` now reads from `editedInitiatives`.)

Scenario AT-6: `prepareTeamSimulationData` reads `editedInitiatives` for the target and historical filters
Given an **Initiatives CSV** is loaded
And the user has edited `editedInitiatives[0].teams` from `Platform` to `Risk`
When `prepareTeamSimulationData` runs
Then the edited row appears in the `Risk` team's section, not the `Platform` team's section
(The readers at `index.html:1806` and `index.html:1825` now read from `editedInitiatives`.)

Scenario AT-7: `buildTeamProjections` reads `editedInitiatives` for the per-(team, quarter) cells
Given an **Initiatives CSV** is loaded
And the user has edited `editedInitiatives[0].quarter` from `Q3 2026` to `Q4 2026`
When `buildTeamProjections` runs
Then the per-team count for `Q4 2026` reflects the edited row
(The readers at `index.html:1922` and `index.html:1935` now read from `editedInitiatives`.)

Scenario AT-8: The projection-axis `extractQuarters` reads `editedInitiatives`
Given an **Initiatives CSV** is loaded with quarters `Q2 2026` and `Q3 2026`
And the user has edited a row's quarter to `Q1 2026` (a quarter not previously in the CSV)
When the run-button handler runs
Then `extractQuarters(editedInitiatives)` returns `['Q1 2026', 'Q2 2026', 'Q3 2026']`
And the **Team Projections tab**'s `allQuarters` axis includes `Q1 2026`
(The reader at `index.html:3356` now reads from `editedInitiatives`.)

Scenario AT-9: When `editedInitiatives` is null (no CSV loaded), the engine does not run
Given no **Initiatives CSV** is loaded
When the user clicks **Run Simulation**
Then the run-button handler's early-guard fires (`if (!parsedInitiatives || !parsedEpics) { alert(...); return; }`)
And neither `prepareSimulationData` nor `prepareTeamSimulationData` nor `buildTeamProjections` is called
(The migration does not require an `if (editedInitiatives)` guard inside each reader because the run-button handler already gates on `parsedInitiatives`; `editedInitiatives` is non-null whenever `parsedInitiatives` is.)

Scenario AT-10: A freshly-loaded CSV with no edits produces identical Run output to a build before this feature
Given an **Initiatives CSV** is loaded and *not* edited
When the user presses Run
Then the org-level **Stats**, the **Histogram**, the **Team Level tab** charts, the **Team Projections** matrix, and the **Data preview** all match the pre-feature output bit-for-bit
(The indirection is observably transparent when no edits have been made.)

Scenario AT-11: Editing a row mid-Run is impossible in practice but safe in principle
Given a Run is in progress (the synchronous Monte Carlo loop is executing)
When the user (somehow) mutates `editedInitiatives[0].moscow` from DevTools mid-loop
Then the in-flight Run completes with whatever state was captured by `prepareSimulationData` at the start of the Run
(The Monte Carlo loop runs synchronously inside one event-loop tick; user mutations from DevTools cannot interleave.)

Scenario AT-12: Loading a different CSV replaces `editedInitiatives` wholesale
Given a CSV `A` was loaded and the user edited several rows
When the user uploads a different CSV `B` via the same file input
Then `editedInitiatives` now equals `parsedInitiatives.map(r => ({ ...r }))` for `B`
And the edits from `A` are gone
(The file-load path always rebuilds the clone; partial merges are not supported.)

### Public entry point

In-code: none new at the API surface. The new declaration is:
- `editedInitiatives` (a `let` binding initially `null`).

The migrated read sites are inside `prepareSimulationData`, `prepareTeamSimulationData`, `buildTeamProjections`, and the run-button handler.

UI: none in this phase (the tab UI is Phase 2).

### Expected observable outcomes

- A new module-scoped `editedInitiatives` array exists alongside `parsedInitiatives` and is created at CSV-load time as a per-row shallow clone.
- Every downstream consumer of initiative data reads from `editedInitiatives`, not `parsedInitiatives`.
- The two arrays are independent at the per-row level — mutating a row of one does not mutate the other.
- A freshly-loaded CSV produces identical Run output to a build before this feature (transparent indirection).
- A file-clear (`resetInitiativesFile`) clears both arrays.
- A file-replace rebuilds the clone wholesale.

### Test harness

Acceptance tests:
- Location: **N/A — manual.** This project has no automated test suite.
- Manual steps:
  1. Open `index.html` cold. In DevTools, evaluate `editedInitiatives` and confirm `null` (AT-3 baseline).
  2. Upload an **Initiatives CSV**. Evaluate `editedInitiatives.length === parsedInitiatives.length` and `editedInitiatives[0] !== parsedInitiatives[0]` (AT-1).
  3. Compare `Object.keys(editedInitiatives[0])` and `Object.keys(parsedInitiatives[0])`; confirm same order (AT-1).
  4. Mutate `editedInitiatives[0].moscow = 'Must'`; confirm `parsedInitiatives[0].moscow` is unchanged (AT-2).
  5. Click `✕ Remove file` on the initiatives upload; confirm both arrays are now `null` (AT-3).
  6. Re-load the CSV. Mutate `editedInitiatives[0].quarter` to a value matching the selected **Historical quarter**; press Run; confirm the **Data preview**'s historical count reflects the mutation (AT-4).
  7. Mutate `editedInitiatives[0].moscow` to `Must`; press Run; confirm the `Must Only` scenario's `K` includes the edited row (AT-5).
  8. Mutate `editedInitiatives[0].teams` to a different team; press Run; click **Team Level**; confirm the row appears in the new team's section (AT-6).
  9. Mutate `editedInitiatives[0].quarter` to a quarter not in the CSV; press Run; click **Team Projections**; confirm the new quarter appears in the projection axis (AT-7, AT-8).
  10. With no CSV loaded, press Run; confirm the alert fires and no engine code runs (AT-9).
  11. Load a CSV, do not edit, press Run, and screenshot the output. Reload the page (which forces a fresh build), load the same CSV, do not edit, press Run; confirm output is identical (AT-10).
  12. Replace the CSV by uploading a different file; confirm `editedInitiatives` reflects the new file's data and the edits from the previous file are gone (AT-12).

Inner tests: N/A.

Verification: manual.

### Behavioral rule

A second module-scoped initiative array `editedInitiatives` is created at CSV-load time as a per-row shallow clone of `parsedInitiatives` (`parsedInitiatives.map(r => ({ ...r }))`). Every downstream consumer of initiative data — `prepareSimulationData`, `prepareTeamSimulationData`, `buildTeamProjections`, and the projection-axis `extractQuarters` call in the run-button handler — reads from `editedInitiatives`, making it the *simulation source of truth* (see [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md)). `parsedInitiatives` remains the immutable parsed input, retained only for downstream uses that need the pre-edit shape (the dropdown-option enumeration in Phase 2's `getUniqueColumnValues(parsedInitiatives)` call). File-clear (`resetInitiativesFile`) sets both arrays to `null`; file-replace (re-load) rebuilds the clone wholesale and discards any prior edits.

### Invariants

- `editedInitiatives` is declared `let editedInitiatives = null;` immediately after `parsedInitiatives` (`index.html:1497`).
- Whenever `parsedInitiatives !== null`, `editedInitiatives !== null` (and vice-versa). They live and die together.
- `editedInitiatives.length === parsedInitiatives.length` at load time. Edits do not change array length (no row-add, no row-delete — see [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md)).
- For every index `i`: `editedInitiatives[i] !== parsedInitiatives[i]` (different object references, by virtue of the spread clone).
- Immediately after load: for every index `i` and key `k`, `editedInitiatives[i][k] === parsedInitiatives[i][k]`. After any edit: `editedInitiatives` may diverge from `parsedInitiatives` per-cell, but `parsedInitiatives` is never mutated.
- `Object.keys(editedInitiatives[i])` equals `Object.keys(parsedInitiatives[i])` in the same order at load time. Edits do not add or remove keys (the inline handlers always write to an existing key via index, never via key creation).
- `prepareSimulationData`, `prepareTeamSimulationData`, `buildTeamProjections`, and the run-button handler's `extractQuarters` call all name `editedInitiatives`. They never name `parsedInitiatives`.
- `parsedInitiatives` continues to be named by the **Column detector** family (inside `loadInitiativesCSV`) and by `getUniqueColumnValues` (which is consumed only by Phase 2). Migrating those reads would defeat the dropdown's stable-option-pool guarantee — see [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- `resetInitiativesFile` sets both arrays to `null` and does not regenerate either until the next `loadInitiativesCSV`.

### Counterexamples (must NOT pass)

- An `editedInitiatives` built via `JSON.parse(JSON.stringify(parsedInitiatives))` — would deep-clone unnecessarily and would coerce non-string values (none exist at load, but the pattern would be misleading).
- An `editedInitiatives` built via `Object.assign({}, ...parsedInitiatives)` — wrong shape; produces a single merged object, not an array of clones.
- An `editedInitiatives` built via `parsedInitiatives.slice()` — shallow array clone, but the row objects are still shared by reference; mutating `editedInitiatives[0].moscow` would mutate `parsedInitiatives[0].moscow`.
- An `editedInitiatives` built lazily on first edit — would create a window where downstream readers see `parsedInitiatives` before the first edit and `editedInitiatives` after, breaking the invariant that engine reads always flow through the edited array.
- A migration that leaves any downstream reader on `parsedInitiatives` — would create a silent partial-edit state where some scenarios reflect edits and others do not.
- A migration that *also* moves `getUniqueColumnValues` to read `editedInitiatives` — would collapse the dropdown option pool to whatever the user had typed last; contradicts [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- A `resetInitiativesFile` that nulls only `parsedInitiatives` and leaves `editedInitiatives` set — would orphan the edited array and cause downstream readers to consume stale data on the next Run.
- A `loadInitiativesCSV` that *appends* to the existing `editedInitiatives` instead of rebuilding — would silently grow the array across CSV switches and confuse downstream consumers.
- A downstream reader that calls `.map(r => { ...r })` to defensively re-clone before reading — would invalidate the "edits flow into next Run" semantics (each Run would see a re-cloned `parsedInitiatives` shape).
- A downstream reader that *writes* to `editedInitiatives[i][k]` — engine code is read-only over the array; only the inline edit handlers (Phase 2) and the CSV-load/reset path write.

### Forbidden shortcuts

- Do not unify `parsedInitiatives` and `editedInitiatives` into a single mutable array. The two-array shape is the contract — see [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- Do not introduce a `getInitiatives()` helper that returns "the right one" based on context. Every reader names `editedInitiatives` directly; the engine has no need to consult `parsedInitiatives`.
- Do not deep-clone via `structuredClone` — the per-row shape is flat strings; the shallow spread is sufficient and idiomatic.
- Do not memoize the spread clone. Each `loadInitiativesCSV` call rebuilds it fresh; partial reuse across CSV swaps would corrupt the new clone.
- Do not add a "diff against `parsedInitiatives`" helper to detect which rows have edits. Useful for a future "edits pending" indicator (called out in [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md)), but not needed for the engine itself.

### RED gate

On an unimplemented build:
- Manual step 2: `editedInitiatives` is `undefined` (`ReferenceError`).
- Manual step 5: `resetInitiativesFile` exists but does not null `editedInitiatives` (it's not declared at all).
- Manual step 7: mutating `editedInitiatives[0].moscow` has no effect on the next Run — the engine reads `parsedInitiatives`.
- Manual step 9: mutating `editedInitiatives[0].quarter` to a new quarter does not change the projection axis — `extractQuarters` reads `parsedInitiatives`.

### Test immutability rule

There are no test files to freeze (manual harness). If a test suite is later introduced, tests for the `editedInitiatives` indirection contract (clone shape, reader migration, reset/replace lifecycle) would live under `tests/acceptance/` and be off-limits to the implementation session.

### Definition of done

- [ ] Manual scenarios AT-1 through AT-12 all pass.
- [ ] `editedInitiatives` is declared as a `let` initially `null`, immediately after `parsedInitiatives`.
- [ ] `loadInitiativesCSV` writes `editedInitiatives = parsedInitiatives.map(r => ({ ...r }))` immediately after `parsedInitiatives = parseCSV(text)`.
- [ ] `resetInitiativesFile` sets both arrays to `null`.
- [ ] `prepareSimulationData`, `prepareTeamSimulationData`, `buildTeamProjections`, and the run-button handler's `extractQuarters` call all read `editedInitiatives`.
- [ ] `getUniqueColumnValues` (Phase 2's dependency) and the **Column detector** family continue to name `parsedInitiatives`.
- [ ] No engine code, no detection code, no chart / stats / matrix / preview code is *otherwise* modified beyond the reader migration.
- [ ] A freshly-loaded CSV produces bit-for-bit identical Run output as a pre-feature build.
- [ ] `git diff` for this phase touches only `index.html` (plus this plan, the ADR, and CONTEXT.md per [ADR-0001](../adr/0001-single-file-html-app.md)).

---

## Phase 2: Initiatives tab — table render with per-cell edit affordances, CSV export

### Acceptance behavior

Scenario AT-1: The fourth tab button appears in the tab bar
Given the user has completed a Run
When the user looks at the tab bar
Then there are exactly four `.tab-btn` elements: `Organization Level`, `Team Level`, `Team Projections`, `Initiatives`
And the fourth button has `data-tab="initiatives"` and text `Initiatives`

Scenario AT-2: The Initiatives tab panel is hidden by default after a Run
Given the user has just pressed Run
When the run-button handler completes the visibility-reset block
Then `#tab-initiatives.style.display === 'none'`
And the active tab is `Organization Level`
(The tab is *rendered* but not *displayed* on Run; see [ADR-0018](../adr/0018-tab-based-results-layout.md).)

Scenario AT-3: Clicking the Initiatives tab button reveals the table
Given the Run has completed and the user is on the Organization Level tab
When the user clicks the `Initiatives` tab button
Then `#tab-initiatives.style.display === 'flex'`
And the table is visible with one row per initiative

Scenario AT-4: The table's column order matches the loaded CSV's column order, minus hidden columns
Given an **Initiatives CSV** has columns `jira_key`, `name`, `moscow`, `teams`, `quarter`, `key_result`, `added_value_impact`, `added_value_cost_saving`, `jira_link`, `emoji`, in that order
When the table renders
Then the table's `<thead>` has 8 `<th>` elements in the order `jira_key`, `name`, `moscow`, `teams`, `quarter`, `key_result`, `added_value_impact`, `added_value_cost_saving`
And the `jira_link` and `emoji` columns are absent from the table

Scenario AT-5: Each row in the table corresponds to a row in `editedInitiatives`
Given `editedInitiatives` has `N` rows
When the table renders
Then the table's `<tbody>` has exactly `N` `<tr>` elements
And the `rowIdx` embedded in each row's `onchange` / `oninput` handler matches the row's index in `editedInitiatives`

Scenario AT-6: The detected Jira key and name cells are non-editable
Given the **Column detector** has resolved `detectedCols.initKeyCol = 'jira_key'` and `detectedCols.nameCol = 'building_block'`
When the table renders
Then the cells in the `jira_key` and `building_block` columns are rendered as `<td class="init-readonly-cell">` with plain text
And there is no `<select>` or `<input>` inside those cells
And the rendered text is `escapeHtml(val)`

Scenario AT-7: The `added_value_impact` and `added_value_cost_saving` cells are numeric inputs
Given the **Initiatives CSV** has those two columns
When the table renders
Then the cells in those columns are rendered as `<input type="number" step="any" value="${escapeAttr(String(val))}" ...>`
And the inputs carry both `onchange` and `oninput` handlers writing `editedInitiatives[rowIdx][col] = this.value`

Scenario AT-8: Every other editable column renders as a dropdown of unique observed values
Given the **Initiatives CSV** has a `moscow` column with values `Must, Should, Could, Won't, Could, Must`
When the table renders
Then each row's `moscow` cell is `<td><select onchange="editedInitiatives[rowIdx]['moscow'] = this.value">…</select></td>`
And the options are `Could`, `Must`, `Should`, `Won't` in sorted order
And the option matching the row's current value is `selected`

Scenario AT-9: A row whose cell value is not in the unique observed values still has its current value as the first option
Given a row's `moscow` cell holds the value `Maybe` (not in any other row)
When the table renders
Then the dropdown's option list starts with `Maybe` followed by the other unique values
And `Maybe` is the selected option

Scenario AT-10: Editing a dropdown writes the new value into `editedInitiatives` and does not re-render
Given the table is rendered and a row's `moscow` cell currently shows `Could`
When the user opens the dropdown and selects `Must`
Then `editedInitiatives[rowIdx].moscow === 'Must'` immediately
And the dropdown continues to show `Must`
And the table is *not* re-rendered
And no other tab's content changes

Scenario AT-11: Editing a numeric input writes the new value into `editedInitiatives` on both `oninput` and `onchange`
Given the table is rendered and a row's `added_value_impact` input currently shows `100`
When the user types `5` (appending to make `1005`)
Then on each keystroke, `oninput` fires and `editedInitiatives[rowIdx].added_value_impact === '1005'` (a string)
And on focus-out, `onchange` fires (also writing `'1005'`)

Scenario AT-12: The `↓ Export CSV` button is visible above the table on the right
Given the table is rendered
When the user looks at the toolbar
Then there is exactly one `<button>` inside `.initiatives-toolbar` with the text `↓ Export CSV` and class `add-marker-btn`
And the toolbar is right-aligned (`justify-content: flex-end`)

Scenario AT-13: Clicking `↓ Export CSV` downloads `initiatives-edited.csv`
Given the table is rendered with `editedInitiatives` of length `N`
When the user clicks `↓ Export CSV`
Then a file download is triggered with name `initiatives-edited.csv`
And the file's first line is the CSV header (the keys of `editedInitiatives[0]` in their object-key order)
And the file has `N + 1` lines (header + one row per initiative)

Scenario AT-14: The exported CSV includes the hidden columns (`jira_link`, `emoji`)
Given the loaded CSV had `jira_link` and `emoji` columns
When the user exports
Then the exported CSV's header row includes `jira_link` and `emoji`
And every data row has cells for those columns (the original values, preserved by the shallow clone)
(Hidden in the table view, but kept in the export — see [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).)

Scenario AT-15: The exported CSV reflects all user edits
Given the user has edited row 0's `moscow` to `Must`, row 2's `teams` to `Risk`, and row 5's `added_value_impact` to `9999`
When the user exports
Then the corresponding cells in the exported CSV carry the edited values
(`Papa.unparse(editedInitiatives)` reads the now-mutated objects.)

Scenario AT-16: The exported CSV is round-trip stable
Given the user exports `initiatives-edited.csv`
And the user uploads the same file via the Initiatives file input on a fresh page-load
When `loadInitiativesCSV` runs against the exported file
Then `parsedInitiatives` has the same column count and column order as the original
And the **Column detector** family resolves `detectedCols` to the same column names
And a Run on the re-uploaded file produces output indistinguishable from a Run on the original file *with the edits applied in DevTools* (within Monte Carlo noise)

Scenario AT-17: Exporting when `editedInitiatives` is empty (no rows) silently no-ops
Given `editedInitiatives === null` (no CSV loaded) or `editedInitiatives.length === 0` (empty CSV)
When `exportInitiativesCSV()` is called (e.g. directly from DevTools — the toolbar button is not visible in this case because the "No initiatives loaded." bail-out replaces the toolbar)
Then no file download is triggered
And no alert fires

Scenario AT-18: Rendering with `editedInitiatives === null` shows the empty-state message
Given no **Initiatives CSV** is loaded
And `renderInitiativesTable()` is called (e.g. directly from DevTools)
Then `#initiatives-table-wrap.innerHTML === '<p style="color:#6b7280;padding:16px">No initiatives loaded.</p>'`
And the toolbar is not rendered

Scenario AT-19: The Initiatives tab is re-rendered as part of every Run
Given the user has pressed Run once
And the user then edits a row
And the user does *not* press Run yet
When the user clicks the Initiatives tab
Then the table reflects the user's edit (the dropdown shows the new value)
When the user then presses Run again
Then `renderInitiativesTable` is called as part of the run-button handler's render sequence
And the table continues to reflect the user's edit (re-render reads the same `editedInitiatives`)

Scenario AT-20: Editing a cell does *not* trigger a Run
Given the user is on the Initiatives tab after a Run
When the user changes a dropdown or types in a numeric input
Then `runSimulation` is *not* called
And the **Histogram**, **Stats** table, **Team Level tab**, and **Team Projections tab** do *not* update
(Edits commit to `editedInitiatives` and flow into the *next* Run only.)

Scenario AT-21: Switching tabs while edits are pending does not lose the edits
Given the user is on the Initiatives tab and has edited row 0's `moscow` to `Must`
When the user clicks `Organization Level`, then clicks `Initiatives` again
Then row 0's dropdown still shows `Must`
And `editedInitiatives[0].moscow === 'Must'`
(The tab-switch shows/hides panels; it does not re-render.)

Scenario AT-22: `escapeHtml` and `escapeAttr` protect against CSV-injected HTML/JS in cell values
Given a CSV cell contains the string `<script>alert('xss')</script>`
When the table renders
Then the rendered DOM contains the escaped text `&lt;script&gt;alert('xss')&lt;/script&gt;`
And no `<script>` tag is added to the DOM
And no alert fires

### Public entry point

In-code:
- `getUniqueColumnValues(rows: RowObject[]): { [col: string]: string[] }` (`index.html:3124-3134`).
- `renderInitiativesTable(): void` (`index.html:3136-3189`).
- `exportInitiativesCSV(): void` (`index.html:3191-3201`).

UI: the fourth tab button, the fourth tab panel, the `↓ Export CSV` button.

### Expected observable outcomes

- A user can see every loaded initiative as a row in the Initiatives tab's table.
- A user can edit any cell except the Jira key and name; the edit is captured in `editedInitiatives` and flows into the next Run.
- A user can export `editedInitiatives` as `initiatives-edited.csv` via a single toolbar button.
- The export is round-trip stable: re-uploading the exported file produces the same column-detection result and same Run output as the original.
- Edits do not trigger Runs, do not re-render other tabs, and do not re-render the table itself.

### Test harness

Acceptance tests:
- Location: **N/A — manual.**
- Manual steps:
  1. Load an **Initiatives CSV** with all the documented columns (`jira_key`, `name` / `building_block`, `moscow`, `teams`, `quarter`, `key_result`, `added_value_impact`, `added_value_cost_saving`, `jira_link`, `emoji`). Press Run. Confirm the fourth tab button appears (AT-1).
  2. Confirm `#tab-initiatives.style.display === 'none'` and the active tab is `Organization Level` (AT-2).
  3. Click `Initiatives`; confirm the table appears (AT-3).
  4. Inspect `<thead>`; confirm 8 columns in the documented order, no `jira_link`, no `emoji` (AT-4).
  5. Confirm the `<tbody>` row count equals `editedInitiatives.length` (AT-5).
  6. Confirm the `jira_key` and `building_block` cells are `<td class="init-readonly-cell">` with plain text (AT-6).
  7. Confirm the `added_value_impact` and `added_value_cost_saving` cells are `<input type="number" step="any">` with both `oninput` and `onchange` handlers (AT-7).
  8. Confirm the `moscow` cell is a `<select>` with the unique values sorted alphabetically; pick a different value; confirm the dropdown updates and `editedInitiatives[rowIdx].moscow` is the new value (AT-8, AT-10).
  9. Manually set a row's `moscow` to a value no other row has (e.g. via DevTools `editedInitiatives[0].moscow = 'Maybe'`), re-render via `renderInitiativesTable()`, and confirm `Maybe` is the first option and selected (AT-9).
  10. Type into a numeric input; observe `oninput` fires per keystroke (AT-11).
  11. Confirm the toolbar shows `↓ Export CSV` in the right corner (AT-12).
  12. Click `↓ Export CSV`; confirm `initiatives-edited.csv` downloads with header + N rows (AT-13).
  13. Open the exported file in a spreadsheet; confirm `jira_link` and `emoji` columns are present with their original values (AT-14).
  14. Edit several cells; export; confirm the edited values are in the file (AT-15).
  15. Reload the page; upload the exported file as the new Initiatives CSV; press Run; confirm the simulation behaves identically to the DevTools-edited path (AT-16).
  16. Without loading a CSV, call `exportInitiativesCSV()` from DevTools; confirm no download (AT-17).
  17. Without loading a CSV, call `renderInitiativesTable()` from DevTools; confirm the `No initiatives loaded.` message (AT-18).
  18. Edit a row, then press Run again; confirm the table re-renders and continues to show the edited values (AT-19).
  19. Edit a row; confirm no Run fires, no other tab updates (AT-20).
  20. Edit a row, switch tabs and back; confirm the edit persists (AT-21).
  21. Manually craft a CSV with a cell containing `<script>alert('xss')</script>`; load it; confirm the table renders the text safely with no script execution (AT-22).

Inner tests: N/A.

Verification: manual.

### Behavioral rule

The Initiatives tab is the fourth result **Tab**, identified by `data-tab="initiatives"` and rendered into `#initiatives-table-wrap`. `renderInitiativesTable()` reads `editedInitiatives` and writes a single `<table>` whose `<thead>` carries one `<th>` per visible column (the original CSV columns minus the `hiddenCols` set `{'jira_link', 'emoji'}`) and whose `<tbody>` carries one `<tr>` per row of `editedInitiatives`. Per cell, the render decides on the cell type by consulting three literal sets and the detected column names: non-editable plain-text cells for the columns matching `detectedCols.initKeyCol` and `detectedCols.nameCol`; `<input type="number" step="any">` cells for columns in the `numericCols` set (`{'added_value_impact', 'added_value_cost_saving'}`); `<select>` dropdowns of unique observed values (from `getUniqueColumnValues(parsedInitiatives)`) for every other column. Both edit affordances write to `editedInitiatives[rowIdx][col] = this.value` via inline `onchange` (and `oninput` for numeric inputs). The toolbar carries a single `↓ Export CSV` button that calls `exportInitiativesCSV()`, which serialises `editedInitiatives` via `Papa.unparse` and downloads `initiatives-edited.csv` — the export is verbatim, includes the hidden columns, and is round-trip stable when re-uploaded. The render call sits inside the run-button handler's render sequence (`renderInitiativesTable()`, `index.html:3362`), so the table is built once per **Run** and reflects the latest `editedInitiatives` state at Run time; edits made *between* Runs are visible in the DOM as the user makes them (the inline handlers update the rendered `<select>` / `<input>` directly) but do not retrigger any other tab's render.

### Invariants

- The tab bar has exactly four `.tab-btn` elements after this feature lands; the new one is the fourth and is always the rightmost.
- `renderInitiativesTable` writes to `#initiatives-table-wrap.innerHTML` exactly once per call — no incremental DOM updates.
- `getUniqueColumnValues` is called with `parsedInitiatives`, never `editedInitiatives`. The dropdown option pool is stable across user edits — see [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- `nonEditable` is `new Set([detectedCols.initKeyCol, detectedCols.nameCol].filter(Boolean))`. The `.filter(Boolean)` guard handles the (rare) case where the name column is undetected.
- `numericCols` is the literal `new Set(['added_value_impact', 'added_value_cost_saving'])`. Hardcoded; no auto-detection — see [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- `hiddenCols` is the literal `new Set(['jira_link', 'emoji'])`. Hidden in the table view; *kept* in the export — see [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- Inline `onchange` / `oninput` handlers write `this.value` (always a string) into `editedInitiatives[rowIdx][col]`. No coercion to `Number`, no validation, no `parseFloat`.
- The dropdown's option list is `opts.includes(current) ? opts : (current ? [current, ...opts] : opts)`. The row's current value is always selectable, even if it is not among the unique observed values.
- An empty `editedInitiatives` (`null` or zero-length) renders the "No initiatives loaded." message; no toolbar, no table.
- `exportInitiativesCSV` bails silently on empty `editedInitiatives` (no alert, no download).
- The exported filename is the literal `'initiatives-edited.csv'`. No timestamp, no Run count, no user prompt.
- The exported CSV's header set equals `Object.keys(editedInitiatives[0])` in the object-key order; this matches the original CSV's column order because the spread-clone preserves insertion order and `Papa.unparse` reads keys from the first row.
- The render call lives inside the run-button handler at `index.html:3362`, immediately after the **Team Projections** render and immediately before the visibility-reset block.
- The Initiatives tab panel is `display:none` immediately after the run-button handler's visibility-reset block; it becomes `display:flex` only when the user clicks the `Initiatives` tab button.
- Cell content is always passed through `escapeHtml` (for text) or `escapeAttr` (for attribute values). No unescaped user-supplied data reaches the DOM.

### Counterexamples (must NOT pass)

- A renderer that reads `editedInitiatives` for the dropdown option pool — would collapse the pool to whatever the user had typed last, contradicting [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- A renderer that omits hidden columns from `editedInitiatives[rowIdx]` (e.g. by stripping the keys at clone time) — would lose those columns from the export, breaking round-trip stability.
- A renderer that hardcodes the visible column list rather than deriving it from `Object.keys(parsedInitiatives[0])` — would drop optional columns (e.g. `key_result` when absent) by accident or include hidden columns when present.
- A renderer that renders `jira_key` as a dropdown or text input — would let the user mutate the **Initiative key** and orphan every linked Epic.
- A renderer that auto-detects numeric columns from cell values — would surprise the user on CSVs where a label column happens to be numeric-shaped.
- A renderer that emits multiple `<table>` elements (e.g. one per quarter) — the contract is one wide table.
- A renderer that uses `innerHTML` injection without going through `escapeHtml` / `escapeAttr` — would open an XSS vector on user-supplied CSV content.
- An `onchange` handler that calls `runSimulation` or any rendering function — would burn a full Run on every edit and flash every other tab.
- An `onchange` handler that writes to `parsedInitiatives` — would corrupt the immutable parsed array and (worse) silently change the dropdown option pool on the next render.
- An `oninput` handler missing from numeric inputs — would mean the user's typed value is captured only on blur, not per keystroke; a user who types and immediately presses Run would lose the in-flight digit.
- An `oninput` handler on dropdowns — `oninput` does not fire on `<select>` in all browsers; the contract for dropdowns is `onchange` only.
- An export that calls `JSON.stringify` instead of `Papa.unparse` — would produce JSON, not CSV, and break round-trip via re-upload.
- An export that filters out hidden columns before `Papa.unparse` — would break round-trip stability for **Quirky format** CSVs.
- An export that pretty-prints or sorts the columns — would change the column order and break the user's reading expectations.
- An export that prompts the user for a filename — would interrupt the flow; the convention across the simulator is hardcoded filenames per artefact (see [ADR-0025](../adr/0025-per-context-marker-system.md)).
- An export that alerts on empty `editedInitiatives` — out of pattern; the empty-state is handled by the render path, not the export path (the toolbar is not visible when the table is empty).
- A tab-switch handler that has to be modified to know about the Initiatives panel — the existing handler iterates generically and must not need a special case.
- A render call that lives *outside* the run-button handler — the Initiatives table must be rendered on the same cadence as the other three tabs (once per Run).
- An empty-table render that produces a toolbar with a disabled Export button — out of pattern; the contract is "no table, no toolbar".

### Forbidden shortcuts

- Do not introduce a virtual-DOM or any kind of diffing render layer. The table is built by string concatenation and assigned to `innerHTML`; that pattern is shared with the rest of the simulator's renderers.
- Do not extract `getUniqueColumnValues` to operate over `editedInitiatives`. The function takes `rows` as a parameter; the renderer chooses which array to pass. The choice is `parsedInitiatives`.
- Do not introduce a per-cell editor component (e.g. `<initiative-cell row="0" col="moscow">`). The plain HTML controls with inline handlers are the contract.
- Do not migrate the inline handlers to delegated event listeners on `#initiatives-table-wrap`. The inline handlers are a one-line read; delegation would require parsing `data-row` / `data-col` attributes that the inline form bakes into the handler body directly.
- Do not introduce a "Reset to original" button as part of this feature. Listed as a future revision in [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- Do not introduce an "edits pending" indicator on the other tabs. Listed as a future revision in [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- Do not add row-add or row-delete affordances. Listed as a future revision in [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- Do not auto-detect numeric columns. Hardcoded `numericCols` set is the contract; data-driven detection is a future revision called out in [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- Do not allow editing of `jira_key` or the name column. Listed as a future revision in [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md); the protection is load-bearing for cross-table joins.
- Do not column-rename on export. The export is verbatim — see [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md).
- Do not lift the export filename to a constant or to a sidebar input. Hardcoded `initiatives-edited.csv` is the contract.

### RED gate

On an unimplemented build:
- Manual step 1: there is no fourth tab button.
- Manual step 4: `renderInitiativesTable` is `undefined` or produces no DOM.
- Manual step 8: editing a dropdown does not write to `editedInitiatives`.
- Manual step 12: there is no `↓ Export CSV` button.
- Manual step 13: clicking `↓ Export CSV` either errors (`exportInitiativesCSV is not defined`) or produces no download.
- Manual step 21: the cell content `<script>alert('xss')</script>` *executes* (the `escapeHtml` / `escapeAttr` guards are missing).

### Test immutability rule

There are no test files to freeze (manual harness).

### Definition of done

- [ ] Manual scenarios AT-1 through AT-22 all pass.
- [ ] The tab bar has the fourth `Initiatives` tab button.
- [ ] The `#tab-initiatives` panel renders the table when populated and the empty-state message when not.
- [ ] `getUniqueColumnValues(parsedInitiatives)` powers the dropdown option pool.
- [ ] The non-editable, numeric, and hidden column sets behave as documented.
- [ ] Inline `onchange` (and `oninput` for numeric) write `this.value` into `editedInitiatives[rowIdx][col]`.
- [ ] The `↓ Export CSV` button downloads `initiatives-edited.csv` via `Papa.unparse(editedInitiatives)`.
- [ ] The exported CSV is round-trip stable.
- [ ] Cell content is escape-clean.
- [ ] The render call lives in the run-button handler at `index.html:3362`.
- [ ] `git diff` for this phase touches only `index.html` (plus this plan, the ADR, and CONTEXT.md).
