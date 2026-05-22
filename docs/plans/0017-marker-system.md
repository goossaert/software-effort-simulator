# Feature: Per-chart-context Marker system — store, dialog, paired chart line and stats row, CSV roundtrip

Created at: 2026-04-07T00:00:00Z

## Context

This feature builds the **Marker** model — a user-defined threshold on the effort (PM) axis that appears simultaneously as a labelled dashed vertical line on the per-context Histogram chart *and* as an auto-inserted row in the per-context Stats table reporting `P(effort > <value>)` against every **Scenario**. The model is *unified*: the same code path that draws every user-added marker also draws the auto-managed **Capacity** marker, distinguished only by the `isCapacity: true` flag and the protective rules around it ([ADR-0015](../adr/0015-capacity-as-auto-managed-chart-marker.md)). The feature owns six narrow surfaces: (a) the module-scoped `markerStore` keyed by `contextKey` (`'org'`, `'team-{idx}'`) (`index.html:2975`), (b) the modal dialog (`#marker-overlay`) with an 80-colour palette grid (`index.html:2954-2972`), (c) the `markersPlugin` `afterDraw` hook that draws all markers with multi-row label-pill stagger (`index.html:2174-2243`), (d) the canvas click-to-edit handler with a 10 CSS-pixel hit-target (`index.html:2321-2340`), (e) the per-marker stats-table rows (`index.html:2376-2390`), and (f) the per-context CSV save/load (`saveMarkersToCSV` / `triggerLoadMarkers`, `index.html:3204-3265`).

The feature is deliberately *unifying*: every existing chart annotation that conceptually fits the "labelled threshold on the PM axis" model is folded into the marker system on first landing, in particular the **Capacity** line ([ADR-0015](../adr/0015-capacity-as-auto-managed-chart-marker.md)) which becomes the `isCapacity: true` entry created by `ensureCapacityMarker`. Where [feature 0008](./0008-configurable-capacity-and-iterations.md) owns the **Capacity** sidebar input and the *value* that flows into `ensureCapacityMarker`, this feature owns the *drawing*, the *click-to-edit*, the *stats-row* contribution, and the *CSV roundtrip* for that same value. Where [feature 0011](./0011-team-level-tab.md) owns the **Team Level tab** chart canvases and the `team-{idx}` context namespace, this feature owns the `markerStore['team-{idx}']` entries that pin themselves to those canvases. Where [feature 0006](./0006-org-histogram-chart.md) and [feature 0007](./0007-org-level-summary-statistics-table.md) own the org-level Histogram and Stats table, this feature *adds* markers to the chart's `afterDraw` and *appends* per-marker rows to the stats table's `<tbody>` without changing their respective render pipelines.

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). The store, dialog, plugin, click handler, save/load helpers, and palette all live inline in `index.html`.
- [ADR-0002 — Client-side only](../adr/0002-client-side-only.md). Markers are stored in-memory only; the CSV roundtrip is the user-driven persistence mechanism.
- [ADR-0011 — Overlapping histograms with shared bins](../adr/0011-overlapping-histograms-shared-bins.md). The chart whose `globalMin`/`globalMax` the marker x-coordinates project against.
- [ADR-0012 — Percentile summary and probability of exceedance](../adr/0012-percentile-summary-and-probability-of-exceedance.md). The `P(effort > value)` semantics every per-marker stats row reports.
- [ADR-0013 — Three-tier risk colouring](../adr/0013-three-tier-risk-colouring.md). The colour classes the per-marker rows reuse uniformly with the capacity row.
- [ADR-0014 — Capacity and iterations as run inputs](../adr/0014-capacity-and-iterations-as-run-inputs.md). The source of the capacity `value` that `ensureCapacityMarker` mirrors into the marker store.
- [ADR-0015 — Capacity rendered as an auto-managed chart Marker](../adr/0015-capacity-as-auto-managed-chart-marker.md). The capacity line is itself a Marker — the `isCapacity: true` entry — drawn by *this* feature's plugin.
- [ADR-0025 — Per-chart-context Marker system](../adr/0025-per-context-marker-system.md). The architectural decision for *why* this feature exists in the shape it does (per-context store, paired chart-and-table surfaces, modal dialog as editor, chart as marker selector via 10-px hit-target, multi-row pill stagger, per-context CSV roundtrip).

Glossary terms used below: **Marker**, **Marker store**, **Marker dialog**, **Capacity**, **Run**, **Iteration**, **Stats**, **Histogram**, **Bin**, **Probability of exceedance**, **Risk tier**, **Scenario**, **Global histogram range** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user who completes a **Run** sees the org-level Histogram chart with one dashed vertical line per marker, labelled with a coloured pill above the chart reading `<label>: <value> PM` (e.g. `Capacity: 120 PM` in red). On the **Team Level tab**, every team section has its own chart with its own independent markers — clicking from team A's chart to team B's never shows team A's markers. The Stats table beneath each chart carries one row per non-capacity marker, in ascending value order, reading `P(effort > <value> PM) <label>` with three per-scenario cells coloured by the same three-tier rule the `P(effort > capacity)` row uses.

A user who wants to add a marker clicks the `＋ Add marker` button next to the chart, sees a modal dialog with a name field, a value (PM) field, an 80-colour palette grid (Google-Docs-style: grays, reds, oranges, yellows, greens, teals, blues, purples), `Save` / `Cancel` buttons, and (for existing markers) a `Delete` button. The user enters `Stretch goal`, `150`, picks a blue, clicks `Save`; the chart re-draws with a new dashed blue line at PM = 150 and a new stats-table row appears.

A user who wants to edit an existing marker can either click the same `＋ Add marker` button and re-open the dialog (which now lists the marker with its existing values) — wait, that opens it for "add". The actual edit affordance is *clicking on the chart* near an existing marker's line: any click on the canvas within 10 CSS pixels of a marker's vertical line opens the dialog in edit mode for that marker, with the existing values pre-populated. The chart itself is the marker selector — there is no list view.

A user who wants to delete a marker opens it via the chart click, then clicks `Delete` in the dialog footer. The delete button is *hidden* when the marker is the auto-managed **Capacity** marker (`isCapacity === true`) — the user can recolour or rename the capacity line from the dialog but cannot delete it.

A user who wants to keep their markers across browser sessions clicks `↓ Save` next to a chart, which downloads `markers-org.csv` (or `markers-team-0.csv`, etc.) containing one row per marker with `label,value,color,is_capacity`. The user re-uploads this file via the `↑ Load` button on a later session; the markers replace whatever was in the store for that context. If the loaded file's `is_capacity: true` row has a different `value` from the current `#capacity` input, the sidebar's capacity is updated to match and the simulation is re-run; otherwise only the loaded context re-renders.

When two markers are close together on the value axis (e.g. `Capacity: 120 PM` and `Stretch: 125 PM`), their label pills would overlap horizontally. The plugin detects the overlap and stacks the pills across two (or more) rows above the chart so every label remains fully readable. The dashed vertical lines start *below* the tallest row of labels so no line cuts through another marker's pill.

When the user configures a capacity larger than the chart's visible PM range — e.g. `Capacity = 1000 PM` on a chart whose right edge is at 250 PM — the capacity line is clamped to the chart's right edge, with the pill reading `Capacity: 1000 PM`. The user still sees the marker exists; the off-chart value on the pill is the cue to re-check the sidebar.

There is no "marker mode" toggle, no "edit markers" tab, no sidebar list of all markers across all charts. The chart *is* the editor; the dialog is the only modal that interrupts the flow.

## Scope

### In scope
- The module-scoped `markerStore` (`index.html:2975`) — `contextKey: string → Marker[]`, where `contextKey` is `'org'` or `'team-{idx}'`.
- `getMarkers(key)` (`index.html:2981-2984`) — lazy-initialises an empty array for a fresh context, then returns the stored array.
- `ensureCapacityMarker(contextKey, capacityValue)` (`index.html:2986-2994`) — creates a new `isCapacity: true` entry on first call per context, or updates `value` in place on subsequent calls; never touches `label` or `color`. Called from `renderChart` (`index.html:2348`) and `renderTeamSection` (`index.html:2435`).
- `computePExceed(sorted, threshold)` (`index.html:2996-3002`) — binary search over a sorted `Float64Array`, returning the fraction of values strictly greater than `threshold`.
- The `_dialogState` / `_dialogColor` module-scoped binding (`index.html:2977-2978`) — `null` while the dialog is closed; `{ contextKey, markerId }` while open; `markerId === null` for new markers, a string for edit.
- `openMarkerDialog(contextKey, markerId = null)` (`index.html:3020-3039`) — populates the dialog inputs from the marker (when editing) or with defaults (when adding), disables the value field and hides the delete button when `isCapacity === true`, then shows the overlay.
- `closeMarkerDialog()` (`index.html:3041-3044`) — hides the overlay and clears `_dialogState`.
- `handleMarkerSave()` (`index.html:3051-3081`) — reads the dialog inputs, validates the value (non-NaN, ≥ 0), pushes a new entry (with a unique random `id`) or mutates the existing one in place, then calls `rerenderContext`.
- `handleMarkerDelete()` (`index.html:3083-3091`) — splices the marker out of `markerStore[contextKey]` and calls `rerenderContext`.
- `rerenderContext(contextKey)` (`index.html:3094-3108`) — looks up the cached `lastRenderState[contextKey]`, destroys the chart instance, re-renders the chart canvas, and re-renders the stats table `<tbody>` for that context. The org context destroys/restores `chartInstance`; team contexts destroy/restore `teamChartInstances[idx]`.
- `lastRenderState` (`index.html:2976`) — the cache `contextKey → { canvasId, results, capacity, tbodyId }` written by `renderChartOnCanvas` (`index.html:2161-2167`) and `renderStatsTableInto` (indirectly via the per-context render flow). Required so `rerenderContext` can rebuild without re-running the simulation.
- `markersPlugin` (`index.html:2174-2243`) — the Chart.js plugin with `afterDraw` running the three passes:
  - **Pass 1**: compute pixel x-centre, pill text, text width, clamped pill centre `px` for each marker (sorted ascending by `value`).
  - **Pass 2**: assign each pill a row index by walking left-to-right and incrementing the row until no previously-placed pill on the same row overlaps `[leftPx, rightPx]`.
  - **Pass 3**: for each marker, draw the dashed vertical line from `lineTop = ca.top + (maxRow + 1) * 19 + 4` down to `ca.bottom`, then the rounded-rectangle pill at `(px, ca.top + row * 19)`.
- The canvas click-to-edit handler (`index.html:2321-2340`) — gated on `contextKey` being set, ignores clicks outside the plot area, walks `getMarkers(contextKey)` to find the marker whose pixel x is within 10 CSS pixels of the click x; opens the dialog for that marker.
- The per-context stats-table marker rows in `renderStatsTableInto` (`index.html:2376-2390`) — filters `getMarkers(contextKey)` to non-capacity markers, sorts ascending by value, computes per-scenario `pExceed` against each marker's value, emits a `<tr class="marker-stats-row">` per marker with the same three-tier colouring as the capacity row.
- The 80-colour palette `COLOR_PALETTE` (`index.html:2954-2972`) — eight rows of ten swatches each: grays, reds, oranges, yellows, greens, teals, blues, purples/pinks.
- `buildColorPalette(selectedColor)` (`index.html:3005-3011`) — renders the swatch grid into `#color-palette-grid`, with the `.selected` class on the swatch matching `selectedColor`.
- The global swatch-click handler (`index.html:3013-3018`) — delegated `click` on `.color-swatch` updates `_dialogColor` and toggles the `.selected` class.
- The backdrop click-to-close handler (`index.html:3046-3049`) — clicking the overlay's outer element (but not the dialog body) closes the dialog.
- `saveMarkersToCSV(contextKey)` (`index.html:3204-3219`) — writes a CSV with headers `label,value,color,is_capacity` and one row per marker; downloads as `markers-${contextKey}.csv`. Bail with an alert when the store is empty.
- `triggerLoadMarkers(contextKey)` (`index.html:3224-3229`) — sets `_loadMarkersContext` and triggers a hidden file-input click.
- The marker-load file-input `change` handler (`index.html:3231-3265`) — parses the CSV, filters rows with `label` and `value` set, maps each row to a Marker (re-using the canonical `cap-${contextKey}` id when `is_capacity === 'true'`, generating a random id otherwise), replaces `markerStore[contextKey]` wholesale, and either re-runs the simulation (when a capacity row landed and changed the sidebar `value`) or just calls `rerenderContext(contextKey)`.
- The per-context button trio in the chart card header (`index.html:993-995`, `2489-2491`): `↓ Save`, `↑ Load`, `＋ Add marker`, each wired via inline `onclick` to call the relevant function with the right `contextKey`.
- The HTML markup for the modal overlay (`#marker-overlay`) and dialog body, the `#color-palette-grid`, the `#marker-name-input`, the `#marker-value-input` / `#marker-value-row`, the `#marker-delete-btn`, the `#marker-dialog-title`, and the `#marker-load-input` hidden file input — declared elsewhere in the HTML but consumed by this feature.

### Out of scope
- The org-level Histogram chart construction. [Feature 0006](./0006-org-histogram-chart.md). This feature *adds* the `markersPlugin` and the click handler; it does not change the bar render, the axes, the overlap mode, or the `globalMin`/`globalMax` computation.
- The org-level Stats table structure. [Feature 0007](./0007-org-level-summary-statistics-table.md). This feature *appends* per-marker rows after the existing capacity row; it does not change the percentile rows, the mean row, or the table header.
- The capacity sidebar input itself. [Feature 0008](./0008-configurable-capacity-and-iterations.md). This feature reads the value via `ensureCapacityMarker`'s argument; it does not own the input or its event listeners.
- The Team Level tab structure. [Feature 0011](./0011-team-level-tab.md). This feature *consumes* the `team-{idx}` contextKey namespace; it does not own the tab, the section layout, the historical-data toggle, or the team chart construction.
- The Team Projections tab and its per-team / per-quarter charts. [Feature 0012](./0012-team-projections-tab.md). Projection charts have a different axis semantic (per-quarter bands) and are out of the marker system's scope at landing time — see "future revisions" in [ADR-0025](../adr/0025-per-context-marker-system.md).
- The `Float64Array` percentile / pExceed computation. [Feature 0007](./0007-org-level-summary-statistics-table.md), [ADR-0012](../adr/0012-percentile-summary-and-probability-of-exceedance.md). This feature *calls* `computePExceed`; the helper itself uses the same binary search the existing stats use.
- The three-tier risk-colouring rule. [Feature 0007](./0007-org-level-summary-statistics-table.md), [ADR-0013](../adr/0013-three-tier-risk-colouring.md). This feature *reuses* the `cls(p)` function from `renderStatsTableInto`; the rule itself is unchanged.
- Saving simulation results, run inputs, or any other state to localStorage / server. Out of scope by [ADR-0002](../adr/0002-client-side-only.md).
- A "global threshold that applies to every chart". Listed as a future revision in [ADR-0025](../adr/0025-per-context-marker-system.md).
- A free-form colour picker. The 80-colour palette is the documented input space; widening it is a future revision.
- Per-marker hover effects (dimming the distribution to the right, tooltips). Listed as future revisions in [ADR-0025](../adr/0025-per-context-marker-system.md).
- Reordering markers in the stats table other than ascending by value. The sort is hardcoded.
- Editing the capacity value from the dialog. The dialog's value-input is disabled when `isCapacity === true`; the capacity value is owned by the sidebar input. See [ADR-0015](../adr/0015-capacity-as-auto-managed-chart-marker.md).
- Deleting the capacity marker. The delete button is hidden when `isCapacity === true`. See [ADR-0015](../adr/0015-capacity-as-auto-managed-chart-marker.md).

## Relevant existing files
Claude may inspect:
- `index.html`, specifically:
  - `markerStore`, `lastRenderState`, `_dialogState`, `_dialogColor` declarations (`index.html:2975-2978`).
  - `getMarkers`, `ensureCapacityMarker`, `computePExceed` (`index.html:2981-3002`).
  - `buildColorPalette`, the swatch-click delegation, `openMarkerDialog`, `closeMarkerDialog`, the backdrop-click handler, `handleMarkerSave`, `handleMarkerDelete` (`index.html:3005-3091`).
  - `rerenderContext` (`index.html:3094-3108`).
  - `saveMarkersToCSV`, `triggerLoadMarkers`, the marker-load `change` handler (`index.html:3204-3265`).
  - `markersPlugin` and its `afterDraw` (`index.html:2174-2243`).
  - The canvas click-to-edit handler inside `renderChartOnCanvas` (`index.html:2321-2340`).
  - The per-marker rows block inside `renderStatsTableInto` (`index.html:2376-2390`).
  - The chart-card button trio markup (`index.html:993-995`, `2489-2491`).
  - The modal overlay markup (`#marker-overlay`, `#color-palette-grid`, `#marker-name-input`, `#marker-value-input`, etc).
  - `COLOR_PALETTE` (`index.html:2954-2972`).
- `CONTEXT.md` glossary — the **Marker**, **Marker store**, **Marker dialog**, **Capacity**, **Probability of exceedance**, **Risk tier**, **Histogram**, **Stats** entries.
- [ADR-0025](../adr/0025-per-context-marker-system.md) — the architectural decision this feature implements.
- [ADR-0015](../adr/0015-capacity-as-auto-managed-chart-marker.md) — the capacity-as-marker protocol this feature implements the drawing for.
- ADRs 0011, 0012, 0013, 0014 for surrounding constraints.

Claude should not inspect unless needed:
- The Monte Carlo engine internals — markers consume the pre-computed `sorted` array; they do not re-sample.
- The CSV parsing column-detector family — the marker CSV has a *fixed* schema (`label,value,color,is_capacity`), not a detected one.
- The Initiatives, Epics, Constant Work upload paths — orthogonal data flows.
- The Team Projections tab code — out of scope for this feature.

## Existing patterns to follow
- **Layering inside `index.html`**: the marker store and helpers live in Module 7 (Marker System); the modal dialog markup lives in the HTML; the plugin and click handler live inside `renderChartOnCanvas` in Module 6 (Chart & Stats Rendering); the per-marker stats-table rows live inside `renderStatsTableInto` in Module 6; the save/load helpers live in Module 8 (UI Glue). There is *no* new module file, *no* helper file, *no* refactor of the chart pipeline.
- **`contextKey` is a flat string**: `'org'` for the org chart, `'team-{idx}'` for each team chart. Never an object reference, never a numeric ID — the string is the cache key in `markerStore`, `lastRenderState`, the canvas-click handler, and the CSV filename. Adding a new context (e.g. `'team-projections-{idx}-{quarter}'`) is a future-revision-level concern.
- **`isCapacity` is the only marker flag**: the boolean drives `ensureCapacityMarker`'s update-in-place behaviour, the dialog's value-input disabled state, the dialog's delete-button visibility, and the stats-table filter (`.filter(m => !m.isCapacity)`). Do not introduce a second boolean for analogous protections — a second protection class would justify a new ADR.
- **Markers are draw-from-truth**: the chart `afterDraw` and the stats table both read directly from `markerStore[contextKey]` on every render. No cached "rendered markers" structure exists. Adding, editing, deleting, or loading a marker calls `rerenderContext` which re-runs both reads.
- **No mutation outside helpers**: the marker objects are mutated *only* inside `ensureCapacityMarker`, `handleMarkerSave`, `handleMarkerDelete`, and the CSV-load handler. The plugin's `afterDraw` and the stats-table render only *read*. The click handler only *opens the dialog*. Do not mutate from the render path.
- **Pill collision is `O(n²)` and OK**: the three-pass plugin runs an `O(n²)` interval-overlap test per render. `n` is small (typically ≤ 12 markers per chart including the capacity); the cost is dominated by the canvas draw calls. Do not introduce a spatial index, a sweep-line algorithm, or any other optimisation.
- **The dialog is keyed by `_dialogState`**: while open, `_dialogState = { contextKey, markerId }`. `markerId === null` ⇒ new marker. The dialog does *not* hold the marker's draft state — the draft lives in the DOM `<input>` values until `Save`. Do not introduce a parallel draft object.
- **The hit-test reads marker pixel x via the same formula the renderer uses**: `(value - globalMin) / range`, clamped to `[0, 1]`. Do not introduce a parallel computation; both surfaces must agree on every marker's screen position.
- **The 10-CSS-pixel hit-target is intentional**: smaller would make markers fiddly; larger would cause adjacent markers to fight for the same hit-zone. The constant is inline (`closestDist = 10`) — do not lift it to a named constant unless you intend to bind another reader to it.
- **CSV save/load is per-context**: the filename includes the contextKey (`markers-org.csv`); the load replaces the target context's store wholesale. There is no "bundle all contexts" save; users who want to bundle markers must export each context separately.
- **Capacity-on-load triggers a re-run**: when the loaded CSV's `is_capacity: true` row has a different `value` from the current `#capacity` input, the sidebar is updated and the run button is clicked. This is the *one* place the marker system reaches outside its model — it exists because a capacity value diverging from the sidebar would silently desynchronise the next Run.
- **No framework**: vanilla DOM, Chart.js for the canvas, PapaParse for CSV parsing. The modal is a fixed-position overlay; the palette is a CSS grid of `<button>`s.
- **Verification command**: manual. Open `index.html`, complete a Run, add a marker, edit a marker, delete a marker, save the CSV, reload, load the CSV, confirm the chart and stats table reflect the state.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer in the app — markers live in memory and persist across browser sessions only via the user-driven CSV roundtrip ([ADR-0025](../adr/0025-per-context-marker-system.md)).

```js
// Module 7 — Marker System.

// In-memory store: contextKey -> Marker[].
const markerStore = {};
//   contextKey: 'org' | `team-${number}`
//   Marker: { id, label, value, color, isCapacity }

type Marker = {
  id:         string;       // 'cap-<contextKey>' for capacity; random string otherwise
  label:      string;       // user-supplied; fallback 'Marker' on empty save
  value:      number;       // PM on the effort axis; ≥ 0
  color:      string;       // hex string from COLOR_PALETTE (or any string on CSV load)
  isCapacity: boolean;      // true exactly for the capacity entry per context
};

// Cache used by rerenderContext to rebuild a chart + stats table without re-running.
const lastRenderState = {};
//   contextKey -> { canvasId: string, results: SimResults, capacity: number, tbodyId: string }

// Dialog binding while open; null while closed.
let _dialogState = null;
//   { contextKey: string, markerId: string | null }
//   markerId === null  : new marker
//   markerId: string   : edit existing

let _dialogColor = COLOR_PALETTE[4]; // currently-selected swatch in the dialog
let _loadMarkersContext = null;       // contextKey awaiting CSV load
```

The Marker's `id` is the only field with a generation rule: `'cap-${contextKey}'` for the capacity entry (deterministic, so CSV roundtrips re-key cleanly), and `Date.now().toString(36) + Math.random().toString(36).slice(2)` for every other marker (effectively unique within a session). The id is *not* persisted across the CSV roundtrip for non-capacity markers — a `↓ Save` followed by `↑ Load` will produce new ids for non-capacity markers, but the `label`, `value`, `color`, and `isCapacity` fields are preserved verbatim.

---

## Phase 1: Per-context marker store, dialog, palette, and add/edit/delete

### Acceptance behavior

Scenario AT-1: A fresh page has an empty marker store for every context
Given the user has not yet pressed Run
When `getMarkers('org')` is evaluated in DevTools
Then it returns `[]` (an empty array)
And `getMarkers('team-0')` also returns `[]`
(The lazy-init writes a fresh `[]` on first read.)

Scenario AT-2: Pressing Run creates the capacity marker on every chart context
Given the user presses Run with `#capacity = 120` and two teams
When the render completes
Then `markerStore['org']` contains exactly one entry with `isCapacity: true`, `label: 'Capacity'`, `value: 120`, `color: '#ef4444'`, `id: 'cap-org'`
And `markerStore['team-0']` contains the same shape with `id: 'cap-team-0'`
And `markerStore['team-1']` contains the same shape with `id: 'cap-team-1'`

Scenario AT-3: Re-running with a different capacity updates `value` in place but preserves `label` and `color`
Given a previous Run created `markerStore['org']` with the capacity entry at `value: 120, color: '#ef4444'`
And the user has edited the capacity marker from the dialog to `label: 'Org budget'`, `color: '#3b82f6'`
When the user changes the sidebar `#capacity` to `200` and presses Run again
Then the org capacity entry now has `value: 200`
And `label === 'Org budget'`
And `color === '#3b82f6'`
(The auto-management rule from [ADR-0015](../adr/0015-capacity-as-auto-managed-chart-marker.md): only `value` is overwritten.)

Scenario AT-4: The `＋ Add marker` button opens the dialog with default state
Given the user has completed a Run
When the user clicks `＋ Add marker` next to the org chart
Then the dialog overlay is visible
And `marker-dialog-title` reads `Add Marker`
And `marker-name-input` is empty
And `marker-value-input` is empty
And the colour palette grid has 80 swatches and one is highlighted (default `COLOR_PALETTE[4]`)
And the `Delete` button is hidden
And `_dialogState === { contextKey: 'org', markerId: null }`

Scenario AT-5: Saving a new marker pushes it to the store and re-renders
Given the dialog is open in add mode for context `'org'`
And the user has typed `Stretch: 150`, value `150`, picked a blue swatch (`#3b82f6`)
When the user clicks `Save`
Then `markerStore['org']` has a new entry with `label: 'Stretch: 150'`, `value: 150`, `color: '#3b82f6'`, `isCapacity: false`, and an `id` that is a unique random string
And the dialog closes
And the org chart re-renders with a blue dashed line at PM = 150
And the org stats table has a new `marker-stats-row` showing `P(effort > 150 PM)`

Scenario AT-6: Saving with an empty name uses the fallback label `'Marker'`
Given the dialog is open in add mode
When the user enters value `100`, leaves name empty, clicks Save
Then the new entry has `label === 'Marker'`
(The fallback applies the trim-and-fallback: `value.trim() || 'Marker'`.)

Scenario AT-7: Saving with an invalid value rejects and shows an alert
Given the dialog is open in add mode
When the user enters value `not a number` (or leaves the value empty, or enters `-5`)
And clicks Save
Then `alert('Please enter a valid PM value.')` fires
And the dialog stays open
And `markerStore[contextKey]` is unchanged

Scenario AT-8: Editing an existing marker pre-populates the dialog
Given the user has saved a marker `Stretch: 150` at PM = 150, blue
When the user clicks on the chart within 10 CSS-pixels of the marker's line
Then the dialog opens
And `marker-dialog-title` reads `Edit Marker`
And `marker-name-input.value === 'Stretch: 150'`
And `marker-value-input.value === '150'`
And the blue swatch is highlighted
And the `Delete` button is visible
And `_dialogState === { contextKey: 'org', markerId: <existing-id> }`

Scenario AT-9: Saving an edit mutates the existing marker in place
Given the dialog is open in edit mode for marker `<id-X>`
When the user changes the label to `Updated label`, value to `175`, picks a red swatch
And clicks Save
Then `markerStore['org']` *still has the same `id-X` entry* (same array slot, same id)
And `entry.label === 'Updated label'`, `entry.value === 175`, `entry.color === '#ef4444'`
And the dialog closes and the chart re-renders

Scenario AT-10: Editing a capacity marker disables the value input and hides the Delete button
Given a context has its capacity marker `cap-org` at `value: 120`
When the user clicks on the capacity line and the dialog opens
Then `marker-value-input.disabled === true`
And `marker-value-row.style.opacity === '0.5'`
And the `Delete` button has `style.display === 'none'`
And the label and colour fields are still editable

Scenario AT-11: Saving an edited capacity marker preserves `value` even if `value` is changed in the dialog
Given the dialog is open in edit mode for a capacity marker
When the user (somehow — devtools, etc.) modifies `marker-value-input.value` to `'999'`
And clicks Save
Then the saved entry's `value` is *unchanged* from before the save
And only `label` and `color` are applied
(The `handleMarkerSave` branch `if (!m.isCapacity) { … m.value = value; }` gates the value write.)

Scenario AT-12: Deleting a marker removes it from the store and re-renders
Given the user has a non-capacity marker in `markerStore['org']`
When the user opens the dialog for that marker and clicks `Delete`
Then `markerStore['org'].length` decreases by 1 and that marker is gone
And the dialog closes
And the org chart re-renders without that line
And the org stats table no longer has that marker's row

Scenario AT-13: Cancel (overlay backdrop click) closes the dialog without mutation
Given the dialog is open in edit mode and the user has modified the label
When the user clicks the overlay backdrop (outside the dialog body)
Then the dialog closes
And `markerStore[contextKey]` is unchanged
(Backdrop-click only closes; it never saves.)

Scenario AT-14: The colour palette has exactly 80 swatches in the documented 8 × 10 layout
Given the dialog is open
When the user inspects `#color-palette-grid`
Then it contains exactly 80 `.color-swatch` `<button>` elements
And they are arranged in 8 rows of 10 (grays, reds, oranges, yellows, greens, teals, blues, purples)

Scenario AT-15: Clicking a swatch updates `_dialogColor` and toggles the `.selected` class
Given the dialog is open and the user has not yet clicked a swatch
When the user clicks the 5th swatch in the reds row
Then `_dialogColor` is set to that swatch's `data-color`
And exactly one swatch has the `.selected` class — the one the user clicked
(The delegated handler toggles `.selected` across every `.color-swatch` matching the clicked one.)

Scenario AT-16: Markers are independent per context
Given the user adds `M1` to `'org'` and `M2` to `'team-0'`
When `getMarkers('org')` and `getMarkers('team-0')` are evaluated
Then `markerStore['org']` contains `M1` and the org capacity
And `markerStore['team-0']` contains `M2` and the team-0 capacity
And neither store contains the other context's marker
(Adding/deleting/editing on one context never touches another.)

### Public entry point

In-code:
- `getMarkers(contextKey: string): Marker[]` (`index.html:2981-2984`).
- `ensureCapacityMarker(contextKey: string, capacityValue: number): void` (`index.html:2986-2994`).
- `openMarkerDialog(contextKey: string, markerId?: string | null): void` (`index.html:3020-3039`).
- `closeMarkerDialog(): void` (`index.html:3041-3044`).
- `handleMarkerSave(): void` (`index.html:3051-3081`).
- `handleMarkerDelete(): void` (`index.html:3083-3091`).
- `buildColorPalette(selectedColor: string): void` (`index.html:3005-3011`).

UI: the modal overlay `#marker-overlay`, the swatch grid `#color-palette-grid`, the per-context `＋ Add marker` button.

### Expected observable outcomes
- Every chart context has its own independent marker store.
- The capacity marker is auto-created on the first Run, updated in place on every subsequent Run, and never deletable.
- Adding, editing, and deleting markers mutate `markerStore[contextKey]` in place and trigger a chart + stats-table re-render via `rerenderContext`.
- The dialog state lives only in DOM inputs and `_dialogState` / `_dialogColor` — there is no parallel draft model.
- The palette is exactly 80 swatches in the documented layout.

### Test harness

Acceptance tests:
- Location: **N/A — manual.**
- Manual steps:
  1. Load a clean session, press Run; in DevTools confirm `markerStore['org']` has only the capacity entry (AT-2).
  2. Click `＋ Add marker`, inspect the dialog title, fields, and palette (AT-4, AT-14).
  3. Save a new marker; inspect `markerStore['org']` and confirm the new entry; confirm the chart and stats table reflect it (AT-5).
  4. Save with an empty name; confirm fallback `'Marker'` (AT-6).
  5. Try to save with `value: 'abc'`; confirm the alert and that nothing changes (AT-7).
  6. Click on the chart near an existing marker line; confirm the edit dialog pre-populates (AT-8).
  7. Edit the label and value; confirm the marker is mutated in place and the chart + table re-render (AT-9).
  8. Open the capacity marker dialog by clicking on the red line; confirm the value-input is disabled and the delete button is hidden (AT-10).
  9. Edit only the capacity label and colour, save, and confirm `value` is untouched (AT-11).
  10. Delete a non-capacity marker; confirm it disappears from both surfaces (AT-12).
  11. Cancel an edit via the backdrop; confirm no mutation (AT-13).
  12. Add a marker to `org`, then switch to `team-0` and add a different marker; confirm each context's store is independent (AT-16).

Inner tests: N/A.

Verification: manual.

### Behavioral rule

Markers are kept in a module-scoped `markerStore` map keyed by `contextKey`. Each context's array is lazily initialised on first read. The capacity marker is created by `ensureCapacityMarker(contextKey, value)` on the first Run for a context and *updated in place* on subsequent Runs — only `value` is overwritten; `label` and `color` are preserved across Runs to honour any user personalisation from the dialog ([ADR-0015](../adr/0015-capacity-as-auto-managed-chart-marker.md)). All other markers are created, edited, and deleted via the modal dialog: `openMarkerDialog(contextKey, markerId)` populates the dialog from the marker (or from defaults when `markerId === null`); `handleMarkerSave` either pushes a new entry with a unique random id or mutates the existing entry in place; `handleMarkerDelete` splices the entry out. The capacity marker's value-input is disabled and its delete button hidden — the user can recolour and rename but cannot move or remove it. Every save and delete calls `rerenderContext(contextKey)` which rebuilds the chart and stats table from the new store state.

### Invariants
- `markerStore[contextKey]` is an array of `Marker` records or `undefined`. `getMarkers` normalises `undefined` to `[]`.
- Exactly one entry per context has `isCapacity === true`. `ensureCapacityMarker` is idempotent at landing — calling it twice does not create a second capacity entry.
- The capacity marker's `id` is `'cap-${contextKey}'`. No other marker shares this id.
- Non-capacity markers have ids generated from `Date.now().toString(36) + Math.random().toString(36).slice(2)`. Collisions are statistically negligible at session scale.
- `handleMarkerSave` validates non-NaN `value >= 0` *only* for non-capacity entries. Capacity entries skip the value-input read entirely.
- `handleMarkerSave` and `handleMarkerDelete` *both* call `rerenderContext(contextKey)` on the way out, so the chart and stats table always reflect the latest store.
- `closeMarkerDialog` clears `_dialogState` to `null`. While `_dialogState` is `null`, `handleMarkerSave` and `handleMarkerDelete` are no-ops.
- The colour palette grid contains exactly 80 `.color-swatch` buttons. Adding or removing a swatch is a one-line edit to `COLOR_PALETTE` and a future-revision concern.
- The dialog *never* mutates `markerStore` outside of `Save` and `Delete`. Backdrop-click and any future Cancel button do not write.

### Counterexamples (must NOT pass)
- A `getMarkers` that returns `null` on first read of an unknown context — every consumer assumes an array; the lazy-init `[]` is the contract.
- An `ensureCapacityMarker` that creates a *second* `isCapacity: true` entry on the second Run — the chart would have two overlapping red lines and the dialog would not know which to edit.
- An `ensureCapacityMarker` that resets `label` or `color` on subsequent Runs — silently reverts user personalisation. See [ADR-0015](../adr/0015-capacity-as-auto-managed-chart-marker.md).
- An `openMarkerDialog` that fails to disable the value-input when `isCapacity === true` — the user could move the capacity line out of sync with the sidebar input.
- An `openMarkerDialog` that fails to hide the delete button on a capacity marker — the user could delete the capacity line, leaving the chart without a budget indicator.
- A `handleMarkerSave` that creates a *new* marker on the save of an edit — would orphan the original `id` and break the click-to-edit `id` lookup.
- A `handleMarkerSave` that pushes a non-capacity marker with `isCapacity: true` — would interfere with the capacity protections.
- A `handleMarkerSave` that succeeds with `value < 0` or `NaN` — would produce a chart line at a non-physical PM value or crash the renderer.
- A `handleMarkerDelete` that deletes a capacity marker — the delete button is hidden, but if it is somehow reached (e.g. devtools), the protection is the only thing preventing data loss. Either the button must be unreachable or the function must short-circuit on `m.isCapacity`.
- A dialog flow that mutates the marker on every keystroke — would create un-cancelable changes.

### Forbidden shortcuts
- Do not introduce a parallel "draft" object for the dialog's in-flight state. The DOM inputs are the draft; `_dialogState` is the binding to the target marker.
- Do not centralise marker creation through a single `createMarker(props)` helper. Two creation paths exist — `ensureCapacityMarker` for the capacity entry and `handleMarkerSave` for the user-added marker — and the differences in id generation, default colour, and validation are intentional.
- Do not migrate `markerStore` to a `Map` instead of a plain object. The string-keyed object is the simplest form and serialises identically when (if ever) we add a localStorage path.
- Do not pre-allocate `markerStore['org']` and `markerStore['team-{idx}']` keys at simulator startup. Lazy-init keeps the store free of unused contexts and reflects the actual chart inventory.

### RED gate

On an unimplemented build:
- Manual step 1: `markerStore` doesn't exist (`ReferenceError`).
- Manual step 2: `＋ Add marker` button is not present in the chart card or the click does nothing.
- Manual step 6: clicking on the chart near a line does not open a dialog.

### Test immutability rule

There are no test files to freeze (manual harness).

### Definition of done
- [ ] Manual scenarios AT-1 through AT-16 all pass.
- [ ] `markerStore` is lazily-initialised per context.
- [ ] `ensureCapacityMarker` is idempotent and preserves `label`/`color` across Runs.
- [ ] The dialog disables value-input and hides Delete on capacity markers.
- [ ] Save/Delete both call `rerenderContext` and never leave stale chart/table state.
- [ ] The palette has 80 swatches.
- [ ] `git diff` for this phase touches only `index.html`.

---

## Phase 2: Chart-and-table paired rendering — `markersPlugin`, click-to-edit, and per-marker stats rows

### Acceptance behavior

Scenario AT-1: Every marker draws a dashed vertical line at its PM value
Given `markerStore['org']` contains the capacity and one custom marker `M` at `value: 150`
When the chart re-renders
Then there are exactly two dashed vertical lines on the chart
And each line's x-position equals `ca.left + ((m.value - globalMin) / (globalMax - globalMin)) * (ca.right - ca.left)` (clamped to `[0, 1]`)
And each line's colour matches the marker's `color`
And each line uses `setLineDash([7, 4])` and `lineWidth = 2`

Scenario AT-2: Each marker draws a coloured rounded-rectangle pill above the chart
Given a marker `M` with `label: 'Stretch'`, `value: 150`, `color: '#3b82f6'`
When the chart re-renders
Then a rounded-rectangle pill (`roundRect(..., 4)`) is filled with `#3b82f6` at `globalAlpha = 0.92`
And the pill text reads `Stretch: 150 PM` in `bold 11px system-ui`, white text, centred
And the pill is positioned above the chart plot area

Scenario AT-3: Pills that would overlap horizontally are stacked across rows
Given two markers at `value: 120` and `value: 125` (close enough that their pills overlap)
When the chart re-renders
Then the two pills sit on *different* rows
And the higher-value pill is on the lower row (the algorithm walks left → right; the first hit row 0, the second is bumped to row 1 because its `[leftPx, rightPx]` overlaps row 0's entry)
And the dashed vertical lines start *below* the lower of the two pill rows (`lineTop = ca.top + (maxRow + 1) * 19 + 4`)

Scenario AT-4: Pills are clamped to the chart plot area horizontally
Given a marker at `value = globalMin` (the leftmost possible position)
Then the pill's centre is at `ca.left + tw / 2 + 4` (not at `ca.left - tw/2`)
And the pill never bleeds off the chart's left edge
And similarly for the right edge
(The clamp formula: `Math.min(Math.max(xPx, ca.left + tw / 2 + 4), ca.right - tw / 2 - 4)`.)

Scenario AT-5: Markers with `value` outside `[globalMin, globalMax]` are clamped to the chart edge
Given a capacity marker at `value: 1000` on a chart whose `globalMax = 250`
When the chart re-renders
Then the line is drawn at `xPx = ca.right` (right edge)
And the pill text still reads `Capacity: 1000 PM` (the off-chart value is preserved in the label)
(The fraction is clamped via `Math.max(0, Math.min(1, ...))`.)

Scenario AT-6: Clicking on the chart within 10 CSS-pixels of a marker line opens the dialog for that marker
Given a marker at pixel x = `400` (computed from its `value`)
When the user clicks at canvas-relative coordinates `(395, <any y inside plot area>)`
Then `openMarkerDialog(contextKey, marker.id)` is called
And the dialog opens in edit mode

Scenario AT-7: Clicking on the chart outside the plot area is ignored
Given a click whose `(clickX, clickY)` is *not* inside `[ca.left, ca.right] × [ca.top, ca.bottom]`
When the click handler runs
Then no dialog is opened

Scenario AT-8: Clicking more than 10 CSS-pixels from every marker is ignored
Given two markers at pixels `x = 100` and `x = 300`
When the user clicks at `clickX = 200` (more than 10 px from both)
Then no dialog opens

Scenario AT-9: The closest marker wins the click when two are within 10 px
Given two markers at `x = 100` and `x = 108`
When the user clicks at `clickX = 105`
Then the dialog opens for the marker at `x = 108` (`|105 - 108| = 3 < |105 - 100| = 5`)
(The handler tracks `closestDist` and updates only on strictly-closer hits.)

Scenario AT-10: Every non-capacity marker contributes one row to the stats table
Given `markerStore['org']` contains the capacity and three non-capacity markers
When `renderStatsTableInto('stats-tbody', results, capacity, 'org')` runs
Then the stats table has the 6 hard-coded percentile/mean rows, the capacity row, and 3 additional `marker-stats-row` rows — 10 rows total
And the 3 marker rows appear *after* the capacity row
And the 3 marker rows are sorted by `value` ascending

Scenario AT-11: Each marker row reports `P(effort > value)` per scenario with the same three-tier colouring
Given a marker `M` with `value: 150`
When the stats table renders
Then the row reads `P(effort > 150 PM) <label>` in the first cell
And the next three cells contain percentages computed via `computePExceed(scenario.sorted, 150)`
And each percentage cell's `<span>` carries one of `ok`, `caution`, `warn` class per the existing rules

Scenario AT-12: The capacity marker is *not* included in the marker-row block
Given the capacity marker exists in `markerStore[contextKey]`
When the stats table renders
Then the capacity row is the hardcoded `<tr><td>P(effort > <capacity> PM)</td>…</tr>` (not in the marker-row block)
And the `markerRows` filter (`.filter(m => !m.isCapacity)`) excludes the capacity entry
(Including it would duplicate the capacity row.)

Scenario AT-13: `rerenderContext` rebuilds both chart and stats table from the cached `lastRenderState`
Given a previous render cached `lastRenderState['org'] = { canvasId: 'results-chart', results: <R>, capacity: 120, tbodyId: 'stats-tbody' }`
When `rerenderContext('org')` is called (e.g. after an `Add marker` save)
Then `chartInstance` is destroyed and re-created via `renderChartOnCanvas('results-chart', R, 120, 'org')`
And `renderStatsTableInto('stats-tbody', R, 120, 'org')` is called
And the new render uses the *current* `markerStore['org']`

Scenario AT-14: `rerenderContext` is a no-op when no `lastRenderState[contextKey]` exists
Given the user has not yet run a simulation for context `'team-2'`
When `rerenderContext('team-2')` is called
Then no chart is destroyed or created
And no stats table is rebuilt
(The function guards `if (!s) return;`.)

Scenario AT-15: The chart click handler is wired only when `contextKey` is set
Given `renderChartOnCanvas` is called with `contextKey = undefined`
When the canvas renders
Then no `click` listener is attached
(Used by any future "preview-only chart" surface that wants no marker affordance.)

Scenario AT-16: Clicking the capacity line opens the dialog in capacity-edit mode
Given the capacity marker `cap-org` is at `value: 120`
When the user clicks within 10 CSS-pixels of the capacity line
Then `openMarkerDialog('org', 'cap-org')` is called
And the dialog opens with the value-input disabled and the Delete button hidden
And the user can edit `label` and `color` but not `value`

### Public entry point

In-code:
- `markersPlugin` (`index.html:2174-2243`) — the Chart.js plugin object with the `afterDraw` hook.
- The canvas `click` listener inside `renderChartOnCanvas` (`index.html:2321-2340`).
- The `markerRows` block inside `renderStatsTableInto` (`index.html:2376-2390`).
- `rerenderContext(contextKey: string): void` (`index.html:3094-3108`).

UI: the chart canvas (`#results-chart`, `team-chart-{idx}`) and the stats `<tbody>` (`#stats-tbody`, `team-stats-tbody-{idx}`).

### Expected observable outcomes
- Every marker shows simultaneously as a chart line and (for non-capacity markers) a stats-table row.
- The two surfaces share the same source-of-truth (`markerStore[contextKey]`); they cannot diverge.
- The chart accepts marker-edit clicks within a 10-CSS-pixel hit-target.
- Label pills stagger across multiple rows to avoid horizontal overlap.
- `rerenderContext` rebuilds both surfaces atomically without re-running the simulation.

### Test harness

Acceptance tests:
- Location: **N/A — manual.**
- Manual steps:
  1. Run a simulation; confirm the capacity dashed line is drawn on the org chart with a red pill above (AT-1, AT-2).
  2. Add a marker at PM `~capacity` (e.g. 122); confirm the two pills stack across two rows (AT-3).
  3. Add a marker at PM `0`; confirm the pill is clamped to the chart's left edge (AT-4).
  4. Set sidebar capacity to a very large value (e.g. 5000) and Run; confirm the capacity line clamps to the right edge with the pill reading the actual value (AT-5).
  5. Click within ~5 px of an existing line; confirm the edit dialog opens (AT-6).
  6. Click outside the plot area; confirm no dialog (AT-7).
  7. Click in the plot area but far from every line; confirm no dialog (AT-8).
  8. Add two markers close in value; click between them; confirm the closer marker wins (AT-9).
  9. Add three markers, then inspect the stats table: confirm 3 marker-stats-rows in ascending value order, each with the three-tier colour class on its percentage cells (AT-10, AT-11).
  10. Confirm the capacity row is *not* duplicated in the marker-stats-rows block (AT-12).
  11. From DevTools call `rerenderContext('org')` and observe the chart + table rebuilding without a new simulation Run (AT-13).
  12. Call `rerenderContext('team-99')` (no such context) and observe nothing happens (AT-14).
  13. Click on the capacity line; confirm the dialog opens with disabled value and hidden Delete (AT-16).

Inner tests: N/A.

Verification: manual.

### Behavioral rule

`markersPlugin`'s `afterDraw` runs three passes per render: (1) compute pixel x-centre, pill text, text width, and clamped pill centre `px` for every marker (sorted ascending by `value`); (2) walk pills left-to-right and assign each a row index whose `[leftPx, rightPx]` interval does not overlap any prior pill on the same row; (3) draw the dashed vertical line from `lineTop = ca.top + (maxRow + 1) * 19 + 4` down to `ca.bottom`, then draw the rounded-rectangle pill at the assigned row. The canvas `click` listener — wired only when `contextKey` is set — computes the click's offset from the canvas bounding rect, ignores clicks outside the plot area, then walks `getMarkers(contextKey)` to find the marker whose pixel x is closest to the click x; if the closest distance is under 10 CSS pixels, the dialog opens for that marker. `renderStatsTableInto` filters `getMarkers(contextKey)` to non-capacity markers, sorts ascending by `value`, computes `P(effort > value)` per scenario via `computePExceed`, and emits one `<tr class="marker-stats-row">` per marker after the hardcoded capacity row. `rerenderContext(contextKey)` looks up `lastRenderState[contextKey]`, destroys and re-creates the chart canvas, and re-renders the stats table `<tbody>` — both reads from the *current* `markerStore[contextKey]`.

### Invariants
- Every marker in `markerStore[contextKey]` produces exactly one dashed vertical line and exactly one label pill on the chart.
- Every non-capacity marker produces exactly one row in the stats table; the capacity marker does not produce a row in the marker-rows block (its row is the hardcoded one).
- The label pill never bleeds off the chart's left or right edge — the clamp formula guarantees `[leftPx, rightPx] ⊆ [ca.left, ca.right]`.
- The dashed line of one marker never crosses the pill of another marker — `lineTop` is below every assigned label row.
- Marker pixel x is computed identically in the renderer (pass 1) and the click hit-test — both use `(value - globalMin) / range` with the `[0, 1]` clamp. The two surfaces *cannot* disagree on screen position.
- The click handler ignores clicks outside the plot area and clicks farther than 10 CSS pixels from every marker.
- The closest marker wins ties of 0 distance; in practice no two markers share an exact pixel x.
- `rerenderContext` is a no-op when `lastRenderState[contextKey]` is unset; this prevents crashes when a tab has never been rendered.
- The chart click handler is wired only when `contextKey` is truthy. Charts rendered with `contextKey = undefined` (a future "preview-only" surface) have no marker affordance.

### Counterexamples (must NOT pass)
- A renderer that draws the line *before* computing the row assignment — would produce lines crossing pills.
- A renderer that lays out pills using only the marker's centre x (no width measurement) — would let adjacent pills overlap.
- A click handler that uses `pageX`/`pageY` instead of the canvas-relative offset — would mismap clicks on scrolled pages.
- A click handler with a hit-target of 0 — would make markers practically unclickable.
- A click handler with a 50 CSS-pixel hit-target — would make adjacent markers fight for the same hit-zone unpredictably.
- A stats-table renderer that includes the capacity marker in the per-marker rows — would render the capacity row twice.
- A stats-table renderer that sorts markers by `id` or insertion order rather than ascending `value` — would scramble the reading order.
- A `rerenderContext` that re-runs the simulation — would invalidate per-Iteration determinism in a context where the user is just toggling markers.
- A pill that clamps but loses its text — the clamp must preserve `text`; only `px` is clamped.
- A renderer that uses `Math.max(0, Math.min(1, ...))` on the *pixel x* instead of the *fraction* — would clamp at `[0, 1]` pixels (effectively `0`) for any value > `globalMin`.

### Forbidden shortcuts
- Do not move the marker rendering into the Chart.js dataset (e.g. as a custom dataset type). The `afterDraw` plugin is the documented integration point and avoids interfering with the existing bar dataset's axes, tooltips, and scaling.
- Do not introduce a separate canvas overlay for markers. Drawing into the same canvas via `afterDraw` keeps the marker stack tied to the chart's clip rect and `globalMin`/`globalMax`.
- Do not animate marker line transitions. The chart is re-rendered atomically; transitions would conflict with `rerenderContext`'s destroy-and-recreate flow.
- Do not introduce a per-marker hover state. Hover effects are listed as a future revision; the click-to-edit affordance is the entire interaction model at landing.
- Do not move the per-marker stats row block into a separate helper. It is 14 lines, lives next to the hardcoded percentile rows, and benefits from the proximity.
- Do not cache `Object.keys(markerStore)` or the marker arrays. Every render reads through `getMarkers(contextKey)` fresh.

### RED gate

On an unimplemented build:
- Manual step 1: no marker lines on the chart even when `markerStore[contextKey]` has entries.
- Manual step 5: clicking on the chart near a line does nothing.
- Manual step 9: the stats table has only the percentile/mean rows and the capacity row — no marker rows.
- Manual step 11: `rerenderContext` is undefined.

### Test immutability rule

N/A.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-16 all pass.
- [ ] Every marker is drawn as a line + pill.
- [ ] Every non-capacity marker contributes a stats-table row.
- [ ] Label pills stagger across rows; lines start below the tallest row.
- [ ] The click handler opens the right dialog for the closest marker within 10 CSS pixels.
- [ ] `rerenderContext` rebuilds both surfaces atomically.
- [ ] `git diff` for this phase touches only `index.html`.

---

## Phase 3: CSV save/load — per-context export, schema-driven import with capacity sync

### Acceptance behavior

Scenario AT-1: `↓ Save` exports a CSV named `markers-${contextKey}.csv`
Given `markerStore['org']` has the capacity entry and one custom marker
When the user clicks `↓ Save` next to the org chart
Then a file download is triggered with name `markers-org.csv`
And the file contains:
  - Header: `label,value,color,is_capacity`
  - Row for the capacity marker: `"Capacity",120,#ef4444,true`
  - Row for the custom marker: `"<label>",<value>,<color>,false`
(The label is JSON-encoded to handle commas/quotes; values, colours, and booleans are bare.)

Scenario AT-2: `↓ Save` on an empty store alerts and does not download
Given `markerStore['team-3'] === undefined` or `[]`
When the user clicks `↓ Save` for team-3 (in a hypothetical UI)
Then `alert('No markers to save.')` fires
And no download happens

Scenario AT-3: `↑ Load` opens a file picker and parses the chosen CSV
Given the user clicks `↑ Load` next to the org chart
Then `_loadMarkersContext` is set to `'org'`
And `#marker-load-input` is reset (`value = ''`) and clicked
And the OS file picker opens

Scenario AT-4: Loading a CSV replaces `markerStore[contextKey]` wholesale
Given `markerStore['org']` has 5 markers
And the user chooses a CSV with 2 valid rows
When the load handler runs
Then `markerStore['org'].length === 2`
And the previous 5 markers are gone
(`markerStore[contextKey] = parsed.filter(...).map(...)`.)

Scenario AT-5: Rows without `label` or `value` are filtered out
Given a CSV with three rows: one fully populated, one missing `label`, one missing `value`
When the load handler runs
Then `markerStore[contextKey].length === 1`
(The filter is `r.label && r.value !== undefined`.)

Scenario AT-6: `is_capacity: 'true'` rounds-trip preserves the canonical capacity id
Given a CSV row with `is_capacity: 'true'`
When the load handler runs for context `'org'`
Then the resulting marker has `id === 'cap-org'` (not a random id)
And `isCapacity === true`

Scenario AT-7: `is_capacity: 'false'` (or absent) produces a non-capacity marker with a random id
Given a CSV row with `is_capacity: 'false'`
When the load handler runs
Then the resulting marker has `isCapacity === false`
And `id` matches the random-id format

Scenario AT-8: A loaded `value` that doesn't parse as a number defaults to `0`
Given a CSV row with `value: 'abc'`
When the load handler runs
Then the resulting marker has `value === 0` (via `parseFloat('abc') || 0`)
And the marker is still pushed
(Permissive: garbage values become `0`, not rejections.)

Scenario AT-9: A loaded row without a `color` falls back to indigo
Given a CSV row with no `color` column or empty `color`
When the load handler runs
Then the resulting marker has `color === '#6366f1'`
(The fallback `r.color || '#6366f1'`.)

Scenario AT-10: Loading a CSV that contains a capacity row with a *different* value updates the sidebar and re-runs the simulation
Given the current `#capacity = 120`
And the user loads a CSV whose capacity row has `value: 200`
When the load handler runs
Then `markerStore[contextKey]` is replaced
And `document.getElementById('capacity').value === 200`
And `#run-btn` is clicked (the simulation re-runs, which re-renders every chart context)
(The handler explicitly returns after the re-run so `rerenderContext` is not also called.)

Scenario AT-11: Loading a CSV without a capacity row only re-renders the target context
Given the loaded CSV has only non-capacity rows
When the load handler runs
Then `markerStore[contextKey]` is replaced
And `rerenderContext(contextKey)` is called
And `#run-btn` is *not* clicked

Scenario AT-12: Loading a CSV whose capacity row has the *same* value as the current sidebar `#capacity` only re-renders, no re-run
Given the current `#capacity = 120`
And the user loads a CSV whose capacity row has `value: 120`
When the load handler runs
Then the sidebar is unchanged (or set to the same value)
And `#run-btn.click()` is also called because the check is `!isNaN(newCapacity) && newCapacity > 0` (not "newCapacity !== current")
And the simulation re-runs (one identical Run; user can tolerate this minor non-optimisation)
(The current code re-runs on *any* loaded capacity row with a positive parseable value.)

Scenario AT-13: Loading an empty CSV is a no-op
Given the user chooses a CSV with no data rows
When the load handler runs
Then `markerStore[contextKey]` is *not* replaced
And no re-render happens
(`if (!parsed.length) return;`.)

Scenario AT-14: Loading the same CSV file twice in a row re-triggers the load
Given the user has just loaded a marker CSV
When the user clicks `↑ Load` again and selects the same file
Then the file is parsed and applied again
(The `input.value = ''` reset before `.click()` ensures the `change` event fires even on identical file selection.)

Scenario AT-15: The save format includes capacity rows so a round-trip preserves the capacity marker
Given `markerStore['org']` has the capacity entry at `label: 'Org budget'`, `color: '#3b82f6'`, `value: 200`
When the user saves the CSV
And then loads the same CSV in a fresh session (with `#capacity = 120` in the sidebar)
Then `markerStore['org']` re-acquires the capacity entry with the loaded label/color/value
And the sidebar `#capacity` is updated to `200`
And the simulation re-runs at the new capacity
(`label`, `color`, `value`, `isCapacity` all survive the round-trip; only `id` is rebuilt deterministically for capacity entries.)

### Public entry point

In-code:
- `saveMarkersToCSV(contextKey: string): void` (`index.html:3204-3219`).
- `triggerLoadMarkers(contextKey: string): void` (`index.html:3224-3229`).
- The marker-load `change` handler attached to `#marker-load-input` (`index.html:3231-3265`).

UI: the per-context `↓ Save` and `↑ Load` buttons (`index.html:993-994`, `2489-2490`), the hidden `#marker-load-input` file input.

### Expected observable outcomes
- The user can save a context's markers to a per-context CSV.
- The user can load a CSV into any context (the loaded context replaces wholesale).
- Capacity rows in the loaded CSV propagate to the sidebar `#capacity` and trigger a re-run.
- Non-capacity rows only trigger a `rerenderContext` of the target context.
- The save and load formats are symmetric for `label`, `value`, `color`, `isCapacity` — `id` is regenerated deterministically for capacity and randomly for non-capacity entries.

### Test harness

Acceptance tests:
- Location: **N/A — manual.**
- Manual steps:
  1. After a Run, click `↓ Save` next to the org chart; open the downloaded `markers-org.csv` and confirm headers + rows (AT-1).
  2. Manually clear `markerStore['org']` in DevTools, then click `↓ Save`; confirm the alert (AT-2).
  3. Click `↑ Load` and choose a valid CSV; confirm `markerStore['org']` is replaced (AT-3, AT-4).
  4. Construct a CSV with one row missing `label` and one missing `value`; load; confirm only the valid row lands (AT-5).
  5. Construct a CSV with `is_capacity: true`; load; confirm the marker has `id: 'cap-org'` (AT-6).
  6. Construct a CSV with `value: 'abc'`; load; confirm `value === 0` (AT-8).
  7. Construct a CSV with no `color`; load; confirm `color === '#6366f1'` (AT-9).
  8. Construct a CSV whose capacity row has `value: 200` (sidebar currently `120`); load; confirm sidebar updates and a Run fires (AT-10).
  9. Construct a CSV with only non-capacity rows; load; confirm only `rerenderContext` is called, no Run (AT-11).
  10. Construct an empty CSV (just headers); load; confirm no replacement, no re-render (AT-13).
  11. Save a CSV, edit a marker, then re-load the same CSV; confirm the original markers come back (AT-14).
  12. Save → fresh session (refresh page) → Run a different config → Load the saved CSV; confirm the capacity is restored to the saved value and the simulation re-runs at it (AT-15).

Inner tests: N/A.

Verification: manual.

### Behavioral rule

The save path serialises `markerStore[contextKey]` to a CSV with headers `label,value,color,is_capacity`, JSON-encoding labels (to tolerate commas/quotes) and writing values, colours, and booleans bare. The file is named `markers-${contextKey}.csv` and downloaded via a blob URL. Empty stores alert and do not download. The load path opens a file picker keyed to the target `contextKey`, parses the CSV via PapaParse, filters rows lacking `label` or `value`, maps each surviving row to a Marker (regenerating `id` deterministically for `is_capacity === 'true'` rows and randomly otherwise), and replaces `markerStore[contextKey]` wholesale. When a capacity row is present and its value is a positive parseable number, the sidebar `#capacity` is updated and `#run-btn` is clicked (re-running the simulation, which re-renders every context); otherwise `rerenderContext(contextKey)` is called to refresh only the target context.

### Invariants
- `saveMarkersToCSV(contextKey)` writes a CSV whose row count equals `markerStore[contextKey].length` (or alerts on empty).
- The save header is exactly `label,value,color,is_capacity`. The order matches the load handler's column lookup.
- The save row format is `${JSON.stringify(label)},${value},${color},${isCapacity}` — exactly four fields per row, JSON-encoding for labels only.
- The load handler replaces `markerStore[contextKey]` *wholesale*; partial merges are not supported.
- A loaded `is_capacity === 'true'` row always lands with `id === 'cap-${contextKey}'`. A loaded `is_capacity === 'false'` row always lands with `isCapacity: false` and a random id.
- The capacity-on-load re-run is triggered by `!isNaN(newCapacity) && newCapacity > 0` — not by "value differs from current". An identical-value capacity load still fires the Run.
- An empty CSV (no rows after parsing) is a no-op — `markerStore[contextKey]` is not replaced.
- The load file-input is reset to `value = ''` before `.click()`, so the `change` event fires on identical-file re-selection.
- The load `value` parse is permissive: `parseFloat('abc') || 0` writes `0` rather than rejecting the row.

### Counterexamples (must NOT pass)
- A save format that emits an unquoted label containing commas — would break the load parser on round-trip.
- A save format that includes the random `id` in the CSV — would either pollute the file with session-only state or break id regeneration on load.
- A load handler that uses `String(r.is_capacity) === 'true'` and treats `'TRUE'` or `'1'` as capacity — the CSV save writes the exact string `'true'`/`'false'`; case insensitivity here would be silent flexibility that breaks the deterministic round-trip.
- A load handler that *appends* to `markerStore[contextKey]` instead of replacing — would silently grow the store across loads.
- A load handler that updates the sidebar `#capacity` *without* re-running — would silently desynchronise the next Run's `ensureCapacityMarker` value from the loaded intent.
- A load handler that runs `#run-btn.click()` for non-capacity rows — would waste a full Run for a marker-only change.
- A load handler that skips empty-CSV protection — would replace `markerStore[contextKey]` with `[]` and lose the existing capacity marker until the next Run.
- A save handler that lets the user save an empty store as a header-only CSV — would create surprise on the corresponding load (which then no-ops).

### Forbidden shortcuts
- Do not migrate the CSV save/load to `localStorage` as a "first" persistence path. The CSV is the documented persistence model — see [ADR-0025](../adr/0025-per-context-marker-system.md).
- Do not introduce a "save all contexts" button. Per-context save is the contract; users who want to bundle multiple contexts save each separately.
- Do not pre-validate the CSV's `color` against the 80-colour palette. Any string is accepted; the chart will render whatever colour the CSV provides.
- Do not introduce a Save-As file-name prompt. The filename is hardcoded per context; the user renames via the OS.
- Do not pre-populate the marker dialog with values from the most-recently-saved CSV. Each session starts from `markerStore = {}` (plus the per-Run capacity creation).

### RED gate

On an unimplemented build:
- Manual step 1: clicking `↓ Save` does nothing or `saveMarkersToCSV` is undefined.
- Manual step 3: clicking `↑ Load` does not open the file picker.
- Manual step 8: loading a CSV with a different capacity does not update the sidebar.

### Test immutability rule

N/A.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-15 all pass.
- [ ] `saveMarkersToCSV` writes the documented CSV format and downloads per-context.
- [ ] `triggerLoadMarkers` resets the file input and triggers the picker.
- [ ] The load handler replaces wholesale, regenerates capacity ids deterministically, and triggers a re-run only on capacity rows.
- [ ] Empty CSVs are no-ops.
- [ ] `git diff` for this phase touches only `index.html`.
