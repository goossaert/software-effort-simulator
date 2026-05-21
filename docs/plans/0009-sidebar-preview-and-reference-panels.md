# Feature: Sidebar data preview, t-shirt size reference, and column-detection debug panels

Created at: 2026-05-21T00:00:00Z

## Context

This feature owns the three **Pre-Run sidebar surfaces** the user reads *before* pressing **Run** to decide whether the simulator has fit the right inputs and is sampling against the right pool. Where [feature 0003](./0003-monte-carlo-simulation-engine.md) owns the engine, [feature 0007](./0007-org-level-summary-statistics-table.md) owns the post-Run numeric verdict, and [feature 0008](./0008-configurable-capacity-and-iterations.md) owns the **Run knobs**, this feature owns the *trust surfaces* that make the fit auditable: the live **Data preview** of fitted model inputs, the static **T-shirt size reference** band table, and the **Column-detection debug** JSON pre-block. None of these surfaces contribute to the Monte Carlo loop; all three exist so the user can sanity-check what the simulator believes about the loaded data without spending iteration time.

The feature is deliberately narrow. It does not own `prepareSimulationData` (whose `preview` payload it consumes) — that function belongs to [feature 0003](./0003-monte-carlo-simulation-engine.md). It does not own the **Column detectors** themselves (which write `detectedCols`) — those belong to [feature 0002](./0002-content-based-column-detection.md). It does not own the **T-shirt size** parameter map (`T_SHIRT_PARAMS`) the reference table mirrors — that belongs to [feature 0005](./0005-synthetic-lognormal-parameters.md). What it owns is: (a) the sidebar markup at `index.html:923-957` (the `#data-preview` block plus the two `<details>` panels), (b) `renderPreview(preview)` (`index.html:2818-2846`) — the DOM writer that paints the **Data preview** grid and updates the debug pre-block, and (c) `tryUpdatePreview()` (`index.html:2873-2884`) — the guarded entry point that re-runs the fit and re-paints the preview on every file-load and quarter-multi-select change.

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). The three surfaces are inline HTML + inline CSS + module-scoped functions; no template engine, no UI library, no client router.
- [ADR-0002 — Client-side only, no backend](../adr/0002-client-side-only.md). The preview reads in-memory parsed CSVs; nothing is fetched.
- [ADR-0003 — CSV as the input format](../adr/0003-csv-input-format.md). The preview reflects whatever the user has uploaded; no canonical schema is enforced beyond the **Column detectors**' contract.
- [ADR-0005 — Content-based column detection](../adr/0005-content-based-column-detection.md). The **Column-detection debug** panel exists to make the otherwise-opaque content-scan result auditable — see that ADR's closing paragraph, which already names `#debug-pre` as the trust surface.
- [ADR-0006 — Monte Carlo with bootstrapped historical sizes](../adr/0006-monte-carlo-with-bootstrapped-sizes.md). The **Data preview**'s `Epic samples` count is the size of the **Bootstrap pool** this ADR specifies; the per-size breakdown is its empirical distribution.
- [ADR-0007 — Lognormal effort distribution per t-shirt size](../adr/0007-lognormal-effort-distribution.md). The **T-shirt size reference** table is the user-facing mirror of `T_SHIRT_PARAMS`' P10/P90 bands; that ADR already names this panel as the surface that makes the bands visible.
- [ADR-0008 — Poisson distribution for epic count per initiative](../adr/0008-poisson-epic-count.md). The **Data preview**'s `Poisson λ` row is the single scalar this ADR fits.
- [ADR-0010 — Three-scenario MoSCoW forecasting](../adr/0010-three-scenario-moscow-forecasting.md). The **Data preview**'s three `K` rows (`Must only`, `Must + Should`, `Must + Should + Could`) are the per-**Scenario** initiative counts this ADR consumes.
- [ADR-0016 — Live sidebar preview of fitted model inputs](../adr/0016-live-sidebar-preview.md). The architectural decision for *why* this feature surfaces fitted inputs in the sidebar before **Run**, rather than only inside the post-Run results panel, and why the three surfaces share that location.

Glossary terms used below: **Data preview**, **T-shirt size reference**, **Column-detection debug**, **Run**, **Iteration**, **Historical quarter**, **Target quarter**, **MoSCoW**, **Scenario**, **Poisson λ**, **Bootstrap pool**, **T-shirt size**, **Person-month (PM)**, **Column detector**, **Recognised t-shirt size** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user who has just opened `index.html` sees the sidebar's three pre-Run surfaces in their respective resting states:

- The **Data preview** block (`#data-preview`) is *hidden* (`display: none`) — there is nothing to preview before any CSV is loaded.
- The **T-shirt size reference** `<details>` panel is *visible* but *collapsed*, showing only its summary label (`T-shirt size reference`). It is available even with no CSVs loaded — the reference table is static.
- The **Column-detection debug** `<details>` panel (`#debug-details`) is *hidden* (`display: none`) — there is no detection to debug before any CSV is loaded.

After the user uploads the **Initiatives CSV** *or* the **Epics CSV**, `tryUpdatePreview` fires. If both CSVs are loaded *and* at least one **Historical quarter** and one **Target quarter** are selected in the multi-select widgets ([feature 0010](../../backtracked-features.md#0010)), the **Data preview** block becomes visible and the **Column-detection debug** panel becomes visible (still collapsed). If either CSV is missing or no quarters have been selected, `tryUpdatePreview` silently returns and the two hidden surfaces stay hidden — the user sees no half-painted state.

When the preview is fully populated, the **Data preview** block shows a two-column grid laid out top-to-bottom:

```
Hist. quarter              Q2 2026
Initiatives (hist.)        37
Poisson λ                  4.32
Epic samples               160
                           XS×12  S×38  M×62  L×34  XL×11  XL+×3
---
Target quarter             Q3 2026
Must + Should (K)          18
Must only (K)              7
Must+Should+Could (K)      24
```

Each row is `(label, value)`. Labels are in a muted grey; values are in a brighter cyan and right-aligned with bold weight. The per-size breakdown row spans both columns and is rendered in a smaller indigo font; it lists sizes in canonical order (`2XS`, `XS`, `S`, `M`, `L`, `XL`, `XL+`) with their bootstrap-pool counts. A horizontal divider separates the historical block from the target block.

Editing either quarter selector (or re-uploading a CSV) re-fires `tryUpdatePreview`, which re-runs the fit and re-paints the grid. There is no spinner — the fit is cheap enough that the paint is perceived as instant. There is no error toast: if `prepareSimulationData` throws (typically because column detection has not yet identified a key column), `tryUpdatePreview` swallows the exception, logs `[preview] <message>` to the console, and leaves the previous preview content in place.

The **T-shirt size reference** panel expands on click to show a three-column table — `Size`, `Min PM`, `Max PM` — listing the documented P10/P90 band of each size from `2XS` (`0.10`–`0.25` PM) to `XL+` (`10`–`11` PM), followed by the footnote `Min ≈ P10, Max ≈ P90 of lognormal distribution`. The table is static markup; it does not change between Runs and does not reflect the **Empirical parameters** toggle ([feature 0018](../../backtracked-features.md#0018)) — it is always the synthetic band reference.

The **Column-detection debug** panel expands on click to show a single `<pre>` block containing two JSON sections:

```
Detected columns:
{
  "initKeyCol": "jira_key",
  "moscowCol": "moscow",
  "epicLinkCol": "(normalised→_initiative_key)",
  "teamCol": "teams",
  "nameCol": "name",
  "krCol": null
}

Target MoSCoW breakdown:
{
  "must": 7,
  "should": 11,
  "could": 6,
  "wont": 0,
  "unknown": 0
}
```

`Detected columns` is the live `detectedCols` object written by the **Column detectors** ([feature 0002](./0002-content-based-column-detection.md)); `Target MoSCoW breakdown` is the `moscowGroups` field of the same `preview` payload the grid above renders. Both refresh on every `tryUpdatePreview` call.

There is no user-visible failure path at this layer. A CSV whose key column cannot be detected leaves the **Data preview** block hidden and the **Column-detection debug** panel hidden; pressing **Run** is the surface that will surface the failure (via the existing alert path). A perfectly-detected pair of CSVs with no quarters selected leaves the preview hidden — the user picks quarters to make it appear. Selecting quarters that contain zero in-scope initiatives produces a preview with `Initiatives (hist.) 0`, `Poisson λ 0.00`, `Epic samples 0`, and `— ` in the per-size row — the honest answer to "the selected quarter has no data", not a defect.

## Scope

### In scope
- The three sidebar markup blocks at `index.html:923-957`:
  - `#data-preview` (`index.html:924-927`): a `display: none` flex container holding the `📋 Data Preview` title and the empty `#preview-grid`.
  - The **T-shirt size reference** `<details>` panel (`index.html:930-949`): the summary `T-shirt size reference`, the three-column `.size-table`, and the `Min ≈ P10, Max ≈ P90` footnote. The seven `<tr>` rows for `2XS` through `XL+`.
  - `#debug-details` (`index.html:952-957`): a `display: none` `<details>` panel containing the summary `Column detection debug` and the empty `<pre id="debug-pre">`.
- The inline CSS rules that style the three surfaces (`index.html:269-358`):
  - `#data-preview` and `#data-preview .preview-title` (the panel chrome and title typography).
  - `.preview-grid`, `.preview-grid .pk`, `.preview-grid .pv`, `.preview-grid .divider` (the two-column grid, the label/value classes, and the horizontal rule).
  - `#config-panel details`, `#config-panel summary`, `#config-panel summary::before`, `#config-panel details[open] summary::before`, `#config-panel details .details-body` (the collapsible chrome shared by both `<details>` panels).
  - `.size-table`, `.size-table th`, `.size-table td`, `.size-table td:not(:first-child)` (the reference table typography).
  - `pre.debug-pre` (the debug pre-block typography).
- `renderPreview(preview)` (`index.html:2818-2846`): paints the `#preview-grid` with the eight `(label, value)` cells, the per-size breakdown row, and the divider; unhides `#data-preview`; unhides `#debug-details` and populates `#debug-pre` with the two JSON sections.
- `tryUpdatePreview()` (`index.html:2873-2884`): the guarded entry point — returns early if either `parsedInitiatives` or `parsedEpics` is missing, or if either multi-select has no selection; otherwise calls `prepareSimulationData(histQs, targetQs)` and passes its `preview` payload to `renderPreview`. Swallows exceptions and logs them with the `[preview]` prefix.
- The five call sites of `tryUpdatePreview`:
  - `initiatives-file` change handler (`index.html:2899`).
  - `epics-file` change handler (`index.html:2915`).
  - `epics-reset-btn` click handler (`index.html:2921`).
  - `hist-ms` `ms-change` listener (`index.html:3271`) — feature 0010 fires this on every multi-select edit.
  - `target-ms` `ms-change` listener (`index.html:3272`) — same.
- The per-size canonical order `['2XS', 'XS', 'S', 'M', 'L', 'XL', 'XL+']` used to sort the per-size breakdown line (`index.html:2821`).
- The contract that `renderPreview` is the *only* DOM writer that unhides `#data-preview` and `#debug-details`; nothing else may set their `style.display`.

### Out of scope
- `prepareSimulationData` (`index.html:1705`) and the `preview` field it returns. [Feature 0003](./0003-monte-carlo-simulation-engine.md). This feature *reads* the `preview` payload but does not own its shape — the field set (`histQuarter`, `histInitCount`, `lambda`, `epicSizingCount`, `sizeDist`, `targetQuarter`, `kMust`, `kMustShould`, `kMustShouldCould`, `moscowGroups`) is defined upstream.
- The **Column detectors** that write `detectedCols`. [Feature 0002](./0002-content-based-column-detection.md). This feature only *displays* `detectedCols`; the detection logic, the **Detection threshold**, and the **Detection fallback** all live upstream.
- The multi-select widget that fires `ms-change`. [Feature 0010](../../backtracked-features.md#0010). This feature only *listens* for `ms-change`; the widget, its chip UI, and the chronological quarter sort all live there.
- The **T-shirt size** parameter map `T_SHIRT_PARAMS` that the reference table mirrors. [Feature 0005](./0005-synthetic-lognormal-parameters.md). The reference table is a *static documentation surface*; it is not derived from `T_SHIRT_PARAMS` at runtime, and the two are kept in sync by hand. The intentional duplication is recorded in [ADR-0007](../adr/0007-lognormal-effort-distribution.md).
- The **Empirical parameters** mode toggle and its alternative `T_SHIRT_PARAMS_EMPIRICAL` map. [Feature 0018](../../backtracked-features.md#0018). The reference table does *not* re-render when the user flips the toggle — it always shows the synthetic bands.
- The Team Level tab's per-team `histInitCount` / `λ` previews. [Feature 0011](../../backtracked-features.md#0011). It computes its own per-team `prepareTeamSimulationData` and renders the result inside the team section, not in the sidebar.
- The Run-button gating on `initiativesLoaded && epicsLoaded`. [Feature 0001](./0001-csv-upload-ui.md). The preview's hide/show is independent: the preview can be visible while Run is still disabled (no quarters selected), and Run can become enabled before the preview unhides (CSVs loaded but no quarters chosen yet).
- Any "what-if" preview that re-fits while the user types capacity or iterations. The **Run knobs** ([feature 0008](./0008-configurable-capacity-and-iterations.md)) do not feed `prepareSimulationData` and therefore do not influence the preview.
- An export of the preview payload to CSV / clipboard. The preview is read-only; copying values requires the user to select-and-copy from the rendered HTML.

## Relevant existing files
Claude may inspect:
- `index.html`, specifically:
  - The sidebar markup at `index.html:923-957` and the surrounding `<aside id="config-panel">` boundary.
  - The CSS rules at `index.html:269-358` listed in *In scope*.
  - `renderPreview` (`index.html:2818-2846`) and `tryUpdatePreview` (`index.html:2873-2884`).
  - The `preview` field of `prepareSimulationData`'s return value (`index.html:1779-1786`) — to confirm the field set this feature consumes.
  - The five `tryUpdatePreview` call sites listed in *In scope*.
  - The `detectedCols` declaration (`index.html:1501`) and the two writers that populate it (`index.html:1512`, `index.html:1598`).
- `CONTEXT.md` glossary, especially the **Pre-Run sidebar surfaces** group (this feature owns the named surfaces), and the **Planning vocabulary** group (**Historical quarter**, **Target quarter**, **MoSCoW**, **Scenario**) plus **Poisson λ** and **Bootstrap pool** in **Sizing and effort** (whose values the preview surfaces).
- ADRs 0005, 0006, 0007, 0008, 0010, and 0016 for the constraints this feature must respect.

Claude should not inspect unless needed:
- The Monte Carlo samplers (`samplePoisson`, `sampleLognormal`, `Xoshiro128ss`) — the preview is read-only against the *fit*, not the *engine*.
- `runScenario`, `runSimulation`, `buildHistogram`, `computeStats` — all post-Run; the preview is pre-Run.
- The marker system, the stats table, the chart, the Team Level / Team Projections / Initiatives tabs — none touch the sidebar preview.
- The CSV parsers themselves (`loadInitiativesCSV`, `loadEpicsFile`) — they write `parsedInitiatives` / `parsedEpics` / `detectedCols`, all of which this feature reads, but their internals are upstream.

## Existing patterns to follow
- **Layering inside `index.html`**: the three sidebar markup blocks live in Module 1 (the static HTML head). Their CSS lives at the top of the same file. `renderPreview` lives in Module 6 (chart & stats rendering — the module that owns all DOM writers downstream of the engine), grouped next to the other render functions. `tryUpdatePreview` and the five call sites live in Module 7 (UI controller). This matches the same layering plans [0006](./0006-org-histogram-chart.md) and [0007](./0007-org-level-summary-statistics-table.md) follow: data-shaping in Module 5, painting in Module 6, event wiring in Module 7.
- **Read-once-per-event**: `tryUpdatePreview` reads `parsedInitiatives`, `parsedEpics`, and the two multi-select selections once at the top of the function. After that point, it calls `prepareSimulationData` and renders the result. There is no caching layer — every call re-fits — because the fit is cheap (`O(rows)` over both CSVs, with no per-iteration cost).
- **One DOM write per paint**: `renderPreview` builds the whole grid HTML as a single template literal and assigns it to `#preview-grid.innerHTML` in one statement. The same pattern applies to the debug pre-block: a single `textContent` assignment, not per-line appends. This matches the plan-0007 pattern ("Single DOM write per render").
- **Hide-then-show, never half-shown**: the `#data-preview` block starts at `display: none` and is unhidden by `renderPreview` only when the preview is fully populated. There is no "loading" state and no "partial" state; either the preview is fully filled or it is hidden. The same applies to `#debug-details`.
- **Silent failure on partial inputs**: `tryUpdatePreview` returns early on missing inputs without surfacing a message. The user already knows the file upload state (from the file-input chrome) and the quarter selection state (from the multi-select chips); a preview error message would be redundant noise. Exceptions from `prepareSimulationData` are caught and logged with the `[preview]` prefix, never alerted.
- **Per-size canonical order is hard-coded**: the size order array `['2XS', 'XS', 'S', 'M', 'L', 'XL', 'XL+']` lives inline inside the `sort` callback in `renderPreview`. Do not lift it to a module-scoped constant — the array literal is a single line, and lifting it creates a synchronisation hazard with the reference-table `<tr>` order in markup (the two surfaces must agree on the order, and the colocation makes the contract obvious).
- **Reference table is hand-maintained, not generated**: the seven `<tr>` rows in the **T-shirt size reference** panel mirror `T_SHIRT_PARAMS` but are *not* rendered from it at runtime. The duplication is intentional and is recorded in [ADR-0007](../adr/0007-lognormal-effort-distribution.md) — the table is a documentation surface, not a derived view. Changing a band in `T_SHIRT_PARAMS` requires editing the matching `<tr>` by hand.
- **Debug pre-block is `textContent`, not `innerHTML`**: `JSON.stringify` output is written as `textContent` to avoid any chance of HTML injection from a malicious header name. The pattern is intentional and matches the trust-surface theme — the debug panel must faithfully show the raw `detectedCols` value, including header names with HTML characters in them.
- **No framework, no library**: vanilla DOM `getElementById`, vanilla template literals, vanilla `<details>` / `<summary>` for the collapsibles. No CSS framework, no animation library. The `▶` rotation on `summary::before` is a single CSS transition.
- **Verification command**: there is no automated test harness in this project. Verification is manual: open `index.html` in a browser (`open index.html` on macOS), upload known-good CSVs, edit the multi-selects, and inspect the three sidebar surfaces.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer — this is a client-side-only app (ADR-0002). In-memory state read and produced by this feature:

```js
// Read from upstream (feature 0003's prepareSimulationData, called by tryUpdatePreview).
// The shape this feature consumes; it does not own the field set.
const preview = {
  histQuarter:       'Q2 2026',       // String. Comma-joined list of selected historical quarters.
  histInitCount:     37,              // Integer. Count of historical Initiatives in scope.
  lambda:            4.32,            // Float. Poisson λ over historical Initiatives.
  epicSizingCount:   160,             // Integer. Size of the Bootstrap pool.
  sizeDist:          { XS: 12, S: 38, M: 62, L: 34, XL: 11, 'XL+': 3 }, // Per-Recognised-t-shirt-size counts.
  epicCountMin:      0,                // Unused by renderPreview today (reserved).
  epicCountMax:      18,               // Unused by renderPreview today (reserved).
  targetQuarter:     'Q3 2026',        // String. Comma-joined list of selected target quarters.
  targetInitCount:   24,               // Unused by renderPreview today (reserved).
  moscowGroups:      { must: 7, should: 11, could: 6, wont: 0, unknown: 0 }, // Used by the debug panel.
  kMust:             7,                // Integer. K for the Must Only Scenario.
  kMustShould:       18,               // Integer. K for the Must + Should Scenario.
  kMustShouldCould:  24,               // Integer. K for the Must + Should + Could Scenario.
};

// Read from upstream (feature 0002's Column detectors, written into the module-scoped detectedCols).
const detectedCols = {
  initKeyCol:  'jira_key',                       // String | null. Header name carrying the Initiative key.
  moscowCol:   'moscow',                         // String | null. Header name carrying MoSCoW priority.
  epicLinkCol: '(normalised→_initiative_key)',   // String. Always this literal once epics are loaded.
  teamCol:     'teams',                          // String | null. Header name carrying the team.
  nameCol:     'name',                           // String | null. Header name carrying the Initiative name.
  krCol:       null,                             // String | null. Header name carrying the Key Result.
};
```

This feature owns no module-scoped state. Its only writes are to the DOM (`#preview-grid.innerHTML`, `#data-preview.style.display`, `#debug-details.style.display`, `#debug-pre.textContent`). Re-paint is idempotent — calling `renderPreview` twice with the same `preview` argument produces byte-identical DOM state.

---

## Phase 1: Live Data preview block

### Acceptance behavior

Scenario AT-1: Initial paint hides the Data preview
Given the page has just loaded (no CSVs, no quarter selection)
When the user looks at the sidebar
Then `#data-preview` has `style.display === 'none'`
And `#debug-details` has `style.display === 'none'`
And the **T-shirt size reference** `<details>` panel is visible and collapsed (see Phase 2)

Scenario AT-2: Uploading only the Initiatives CSV does not show the preview
Given the user has uploaded a valid **Initiatives CSV**
And the user has not yet uploaded the **Epics CSV**
When `tryUpdatePreview` fires (from the file-input handler)
Then `tryUpdatePreview` returns early
And `#data-preview` remains hidden
And `#debug-details` remains hidden
(The same applies symmetrically when only the **Epics CSV** has been uploaded.)

Scenario AT-3: Uploading both CSVs without quarter selection does not show the preview
Given the user has uploaded both CSVs
And the user has not selected any **Historical quarter** or **Target quarter** in the multi-selects
When `tryUpdatePreview` fires
Then `tryUpdatePreview` returns early
And both hidden surfaces remain hidden

Scenario AT-4: Full input set shows a populated preview
Given the user has uploaded both CSVs
And the user has selected `Q2 2026` as the **Historical quarter** and `Q3 2026` as the **Target quarter**
When `tryUpdatePreview` fires
Then `prepareSimulationData(['Q2 2026'], ['Q3 2026'])` is called
And its `preview` payload is passed to `renderPreview`
And `#data-preview` becomes visible (`style.display === 'flex'`)
And `#preview-grid.innerHTML` contains nine grid cells in the documented order:
  - `Hist. quarter` / `Q2 2026`
  - `Initiatives (hist.)` / `<histInitCount>`
  - `Poisson λ` / `<lambda.toFixed(2)>`
  - `Epic samples` / `<epicSizingCount>`
  - the per-size breakdown row spanning both columns
  - a `<div class="divider">`
  - `Target quarter` / `Q3 2026`
  - `Must + Should (K)` / `<kMustShould>`
  - `Must only (K)` / `<kMust>`
  - `Must+Should+Could (K)` / `<kMustShouldCould>`

Scenario AT-5: Lambda is formatted to two decimal places
Given a successful `prepareSimulationData` returns `lambda = 4.3217`
When `renderPreview(preview)` runs
Then the `Poisson λ` cell shows `4.32` exactly (not `4.3217`, not `4.3`, not `4`)

Scenario AT-6: Per-size breakdown is sorted in canonical order
Given `preview.sizeDist === { XL: 11, S: 38, '2XS': 5, M: 62, XS: 12, L: 34, 'XL+': 3 }` (i.e. insertion order is scrambled)
When `renderPreview(preview)` runs
Then the per-size row reads exactly `2XS×5  XS×12  S×38  M×62  L×34  XL×11  XL+×3` (two spaces between each entry)
(The order is the documented canonical `['2XS', 'XS', 'S', 'M', 'L', 'XL', 'XL+']`.)

Scenario AT-7: Empty bootstrap pool renders an em-dash
Given `preview.sizeDist === {}` (no in-scope **Recognised t-shirt size** found)
When `renderPreview(preview)` runs
Then the per-size row shows `—` (a single em-dash)
And no `<size>×<count>` token is rendered

Scenario AT-8: Multi-quarter selection joins with `,&nbsp;`
Given the user has selected `Q1 2026` and `Q2 2026` as **Historical quarter**
When `tryUpdatePreview` fires
Then `preview.histQuarter === 'Q1 2026, Q2 2026'`
And the `Hist. quarter` cell renders that string verbatim

Scenario AT-9: Re-paint on quarter change
Given a preview is currently rendered for `(Q2 2026 → Q3 2026)`
When the user changes the **Target quarter** multi-select to `Q4 2026`
Then `ms-change` fires on `#target-ms`
And `tryUpdatePreview` re-runs the fit with the new selection
And the `Target quarter` cell now shows `Q4 2026`
And the three `K` cells reflect the new target quarter's **MoSCoW** counts
And the `Hist. quarter`, `Initiatives (hist.)`, `Poisson λ`, `Epic samples`, and per-size row are unchanged

Scenario AT-10: Re-paint on epics reset
Given a preview is currently rendered
When the user clicks `epics-reset-btn` and resets the **Epics CSV**
Then `tryUpdatePreview` fires
And `tryUpdatePreview` returns early (because `parsedEpics` is now falsy)
And the preview *retains its previous DOM content* but its parent block is *not* re-hidden by this function — the existing displayed content stays until the next successful paint
(The display state of `#data-preview` is not reset to `none` by `tryUpdatePreview`; only the *initial* state is `none`. This is a deliberate "no flicker" rule.)

Scenario AT-11: Silent failure on `prepareSimulationData` exception
Given the user has uploaded a CSV whose key column cannot be detected (`detectedCols.initKeyCol === null`)
And the user has selected quarters
When `tryUpdatePreview` fires
Then `prepareSimulationData` throws (because it destructures `{ initKeyCol, moscowCol }` then dereferences them)
And `tryUpdatePreview`'s `try/catch` logs `[preview] <message>` to `console.warn`
And `#data-preview` keeps its previous `style.display` value (it is *not* re-hidden by the failure)
And no `alert()` is raised

Scenario AT-12: Editing initiatives via the Initiatives tab refreshes the preview's K-counts
Given the user has edited an initiative's **MoSCoW** from `Could` to `Must` via the Initiatives tab ([feature 0019](../../backtracked-features.md#0019))
And the Initiatives tab calls `tryUpdatePreview` after the edit (current behaviour: it does *not* — it only mutates `editedInitiatives`)
When the user changes the multi-select selection (or re-uploads), triggering a refresh
Then the preview's `kMust` and `kMustShouldCould` reflect the edited value, because `prepareSimulationData` reads `editedInitiatives`, not the original `parsedInitiatives`
(This scenario documents the consequence of the upstream contract — feature 0019 is the writer; this feature is the reader. A bug where edits do not appear in the preview until the user nudges a multi-select is a *coupling* issue between this feature and 0019, not a defect in either alone.)

### Public entry point

In-code:
- `tryUpdatePreview()` (`index.html:2873`) — the guarded entry point. Called by file-input handlers, the epics-reset button, and the two multi-select `ms-change` listeners.
- `renderPreview(preview)` (`index.html:2818`) — the DOM writer. Called only by `tryUpdatePreview`.

UI: the sidebar `#data-preview` block. There is no button, no menu, no keyboard shortcut — the preview is fully event-driven by file uploads and multi-select edits.

### Expected observable outcomes
- `#data-preview.style.display` is `'flex'` after at least one successful `renderPreview` call; `'none'` before that.
- `#preview-grid.innerHTML` exactly matches the template literal in `renderPreview`, with the per-size row sorted in canonical order.
- `#debug-pre.textContent` contains the two JSON sections (`Detected columns:\n{...}\n\nTarget MoSCoW breakdown:\n{...}`) — see Phase 2 for the debug-panel specifics.
- `#debug-details.style.display` is `'block'` after at least one successful `renderPreview` call.
- Calling `tryUpdatePreview` with no inputs is safe (silent early return; no console output unless an exception is caught).
- Calling `renderPreview` with a `preview` object missing any field crashes the template-literal expansion (e.g. `preview.lambda.toFixed` on `undefined`); the `try/catch` in `tryUpdatePreview` is what protects the surface.

### Test harness

Acceptance tests:
- Location: **N/A — this project has no automated test suite.** Manual acceptance is performed in the browser, with optional DevTools inspection.
- Manual steps:
  1. Open `index.html`. Confirm `#data-preview` and `#debug-details` are hidden; `T-shirt size reference` is visible and collapsed (AT-1).
  2. Upload only the **Initiatives CSV** from `test-data/`. Confirm the two hidden surfaces stay hidden (AT-2).
  3. Upload the **Epics CSV**. Confirm the two hidden surfaces *still* stay hidden if no quarters are selected (AT-3).
  4. Open the **Historical quarter** multi-select and select `Q2 2026`; open the **Target quarter** multi-select and select `Q3 2026`. Confirm `#data-preview` becomes visible with the expected nine-cell grid (AT-4). Cross-check the rendered `Poisson λ` against `lambda` in the DevTools console: `prepareSimulationData(['Q2 2026'], ['Q3 2026']).preview.lambda.toFixed(2)` must match the cell (AT-5).
  5. With the same selection, inspect the per-size row; confirm it is sorted `2XS, XS, S, M, L, XL, XL+` regardless of the order of keys in `preview.sizeDist` (AT-6). To stress-test, in DevTools shuffle `preview.sizeDist` and call `renderPreview(preview)` directly.
  6. Pick a historical quarter with no in-scope **Recognised t-shirt size** (or temporarily set every epic's size to an unrecognised value). Confirm the per-size row shows `—` (AT-7).
  7. Add a second historical quarter to the multi-select. Confirm the `Hist. quarter` cell now reads `Q1 2026, Q2 2026` (AT-8).
  8. Change the **Target quarter** to `Q4 2026`. Confirm the `Target quarter` cell and the three `K` cells update, while the historical cells do not (AT-9).
  9. Click `epics-reset-btn`. Confirm `tryUpdatePreview` fires, returns early, and the previous preview content stays in the DOM (AT-10) — inspect via DevTools that `#data-preview.style.display` is still `'flex'`.
 10. Upload a CSV with a missing key column (e.g. an Initiatives CSV with no Jira-key-shaped column). Pick quarters. Confirm DevTools shows a `console.warn` with the `[preview]` prefix and no alert dialog (AT-11).
 11. Open the Initiatives tab and change an initiative's **MoSCoW** from `Could` to `Must`. Nudge the **Target quarter** multi-select to re-fire `ms-change`. Confirm the preview's `kMust` cell reflects the edit (AT-12).

Inner tests:
- Location: **N/A — no test harness.** If a harness is added, `renderPreview` is trivially testable as a pure function from `preview` to DOM mutation against a fresh `<div id="preview-grid">` fixture, and `tryUpdatePreview`'s guard logic is testable by stubbing `parsedInitiatives`, `parsedEpics`, `histMS.getSelected()`, and `targetMS.getSelected()`.

Verification:
- Manual: walk the steps above. The grid contents are inspectable in the rendered HTML; the `console.warn` is inspectable in DevTools; the `display` state is inspectable on `#data-preview` and `#debug-details`.

Fake-injection wiring:
- N/A. To exercise the helper without going through `prepareSimulationData`, call `renderPreview(somePreviewObject)` directly from the DevTools console with a hand-crafted payload.

### Proposed implementation seams

Stable seams a future test suite may target:
- `tryUpdatePreview()` — its guard contract (returns early on falsy `parsedInitiatives` / `parsedEpics` or empty multi-select selection) and its `try/catch` behaviour.
- `renderPreview(preview)` — its pure-write contract against `#preview-grid`, `#data-preview`, `#debug-details`, and `#debug-pre`.
- The five `tryUpdatePreview` call sites: file-input handlers, epics-reset, and the two `ms-change` listeners.
- The contract that `renderPreview` is the *only* writer of `#data-preview.style.display` (besides the initial `display: none` in the markup).

Do NOT lock in:
- The exact label strings (`Hist. quarter`, `Initiatives (hist.)`, `Poisson λ`, `Epic samples`, `Target quarter`, `Must + Should (K)`, `Must only (K)`, `Must+Should+Could (K)`). They are human-readable and may be re-worded. The *fact* that there are nine cells in the documented order is the contract.
- The `toFixed(2)` precision on `lambda` — a future revision could lift it to three decimals if real fits warrant. The contract is "a fixed precision, not raw float".
- The two-space separator between per-size tokens (`2XS×5  XS×12`) — that is purely visual.
- The colours (`#94a3b8` for `.pk`, `#a5f3fc` for `.pv`, `#6366f1` for the title and divider, `#252349` for the panel background). They follow the broader sidebar palette; recolouring is a global theme change, not a contract.
- The icon `📋` in the title — decorative.
- The reserved fields `epicCountMin` / `epicCountMax` / `targetInitCount` in the `preview` payload. They exist in upstream's payload (feature 0003) but are not consumed by `renderPreview` today. A future revision could surface them; their *presence* in the payload is upstream's contract, not this feature's.

### Behavioral rule

The **Data preview** block is a live, hide-by-default sidebar surface that paints the fitted model inputs once both CSVs are loaded and at least one **Historical quarter** and one **Target quarter** are selected. Its single entry point is `tryUpdatePreview()`, which guards on those four preconditions and silently returns when any are missing. When all four are met, it calls `prepareSimulationData(histQs, targetQs)` and hands the `preview` payload to `renderPreview`, which writes the grid in a single `innerHTML` assignment, unhides the block, and updates the **Column-detection debug** panel (Phase 2). Exceptions from `prepareSimulationData` are caught and logged with the `[preview]` prefix; the previously-painted content stays in place rather than being torn down. Once unhidden, the block stays visible for the rest of the session — there is no "re-hide" path.

### Invariants
- `#data-preview` exists in the DOM at all times after page load.
- `#preview-grid` exists in the DOM at all times after page load.
- `#data-preview.style.display === 'none'` until the first successful `renderPreview` call; after that, `'flex'` for the rest of the session.
- `#preview-grid.innerHTML` is the empty string until the first `renderPreview` call; after that, exactly the nine-cell grid template literal from `renderPreview`.
- The per-size breakdown row's tokens are in canonical order `['2XS', 'XS', 'S', 'M', 'L', 'XL', 'XL+']`, regardless of the iteration order of `preview.sizeDist`.
- The `Poisson λ` cell is `preview.lambda.toFixed(2)` byte-for-byte.
- `tryUpdatePreview` reads `parsedInitiatives`, `parsedEpics`, `histMS.getSelected()`, and `targetMS.getSelected()` exactly once per call.
- `tryUpdatePreview` never raises an exception; the `try/catch` is total.
- `renderPreview` performs exactly one assignment to `#preview-grid.innerHTML`, one assignment to `#data-preview.style.display`, one assignment to `#debug-details.style.display`, and one assignment to `#debug-pre.textContent` per call.
- The `display` state of `#data-preview` and `#debug-details` is monotonically `none → flex` / `none → block` — once unhidden, the surfaces stay unhidden for the session.

### Counterexamples (must NOT pass)
- A `tryUpdatePreview` that *alerts* on `prepareSimulationData` failure — would noise up the file-load happy path on every CSV that has a typo in a header. The user has not yet pressed **Run**; surfacing the failure now is premature. The Run-button click handler is the surface that may alert.
- A `tryUpdatePreview` that re-hides the preview on guard failure — would let the user see the preview flicker out and back as they edit the multi-select between selections. The "hide-then-show, never re-hide" rule prevents that flicker.
- A `renderPreview` that iterates over `preview.sizeDist` with `for…in` (insertion order) instead of sorting — would let the per-size row appear in arbitrary order depending on the CSV's row order, breaking the user's ability to scan it.
- A `renderPreview` that reads `detectedCols` directly instead of taking the `preview` payload — would re-tangle the data-population path (which lives upstream in `prepareSimulationData`) with the painting path (this feature). The single `preview` argument is the contract.
- A `renderPreview` that uses per-cell `document.createElement` instead of a single `innerHTML` write — would be slower, more verbose, and would diverge from the existing one-write pattern of `renderStatsTableInto` (plan 0007).
- A `renderPreview` that hides `#data-preview` on empty inputs (e.g. `preview.histInitCount === 0`) — would punish the user for selecting an empty quarter. `0` is the correct preview for a quarter with no data; hiding the surface would prevent the user from learning that the selection was empty.
- A `tryUpdatePreview` that fires from the **Run knobs** (`#capacity`, `#iterations`) change events — the **Run knobs** do not influence the fit and so do not influence the preview. Wiring them in would cause spurious re-paints.
- A `tryUpdatePreview` that fires synchronously from the engine's `runSimulation` callback — would re-paint the preview after **Run** completes, suggesting (falsely) that the displayed values somehow reflect post-Run state. The preview is pre-Run only.
- A module-scoped cache of the last `preview` payload, used to skip `renderPreview` when the payload has not changed — would couple the surface to a custom equality check on the payload's deeply-nested `sizeDist` and `moscowGroups` fields. The fit is cheap; the paint is cheap; the cache would be a complication paying for itself in no measurable scenario.

### Forbidden shortcuts
- Do not show the preview block as a *modal* or *popover*. It is a sidebar surface; the user reads it alongside the file-input chrome and the quarter selectors as part of the same configuration gesture. A modal would interrupt that gesture.
- Do not show a "preview is stale" badge when the user has edited inputs but not yet selected new quarters. The whole point of `tryUpdatePreview` is that the surface re-paints automatically on every relevant event; a staleness badge would be redundant with the live re-paint.
- Do not add an "advanced preview" toggle that surfaces `epicCountMin`, `epicCountMax`, or `targetInitCount`. The reserved fields exist in the payload, but the resting preview surface is intentionally compact — a discoverability surface, not a configuration dashboard.
- Do not migrate the grid to a templating library (Handlebars, mustache, lit-html). The template literal is one assignment; a library would be a strict regression on [ADR-0001](../adr/0001-single-file-html-app.md).
- Do not split `tryUpdatePreview` into one function per call site (`onFileLoad`, `onMsChange`, `onEpicsReset`). The single-entry guard is the load-bearing simplification — five call sites must converge on one place that knows when to paint.
- Do not derive `kMust`, `kMustShould`, `kMustShouldCould` inside `renderPreview` from `moscowGroups`. They are already computed in `prepareSimulationData`; deriving them again would create a second source of truth and a possible drift.

### RED gate

On an un-implemented build (e.g. `renderPreview` is a stub that returns immediately, or `#data-preview` markup is missing):
- Manual step 1: the sidebar shows no preview block at all (or shows the block but never unhides it).
- Manual step 4: with full inputs and quarter selection, `#data-preview` stays hidden — no nine-cell grid appears.
- Manual step 9: epics-reset has no visible effect (because there was nothing painted to begin with).

### Test immutability rule

There are no test files to freeze in this project (manual harness). If a test suite is later introduced and Phase 1's acceptance steps are codified, those tests live under `tests/unit/` and are off-limits to the implementation session — only the test-writing session may edit them.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-12 all pass.
- [ ] `#data-preview`, `#preview-grid`, `#debug-details`, and `#debug-pre` exist in the DOM with the documented `id`s and initial `display` states.
- [ ] `renderPreview` is the *only* writer of `#preview-grid.innerHTML`, `#data-preview.style.display` (post-initial), `#debug-details.style.display` (post-initial), and `#debug-pre.textContent`.
- [ ] `tryUpdatePreview` is the *only* caller of `renderPreview`.
- [ ] The five `tryUpdatePreview` call sites (file inputs, epics-reset, two `ms-change` listeners) exist and fire as documented.
- [ ] Exceptions from `prepareSimulationData` are swallowed with a `[preview]` console warning and do not surface to the user.
- [ ] `git diff` touches only `index.html` (ADR-0001).

---

## Phase 2: T-shirt size reference and Column-detection debug `<details>` panels

### Acceptance behavior

Scenario AT-1: T-shirt size reference panel renders the seven canonical bands
Given the page has just loaded
When the user clicks the `T-shirt size reference` summary
Then the panel expands and the `.size-table` shows exactly seven rows:
  - `2XS` / `0.10` / `0.25`
  - `XS` / `0.25` / `0.75`
  - `S` / `0.75` / `1.5`
  - `M` / `1.5` / `3`
  - `L` / `3` / `6`
  - `XL` / `6` / `9`
  - `XL+` / `10` / `11`
And the footnote `Min ≈ P10, Max ≈ P90 of lognormal distribution` is shown below the table

Scenario AT-2: T-shirt size reference panel is available with no CSV loaded
Given the page has just loaded
And no CSV has been uploaded
When the user clicks the `T-shirt size reference` summary
Then the panel expands and shows the same seven rows
(The reference is documentation; it is not gated on data availability.)

Scenario AT-3: T-shirt size reference panel does *not* reflect the Empirical parameters toggle
Given the user has switched the parameters radio to **Empirical** (feature 0018)
When the user expands the `T-shirt size reference` panel
Then the seven rows are still the synthetic bands (`2XS` `0.10`–`0.25`, …, `XL+` `10`–`11`)
And the footnote is unchanged
(The reference table is hand-maintained against `T_SHIRT_PARAMS` (synthetic) only; see [ADR-0007](../adr/0007-lognormal-effort-distribution.md).)

Scenario AT-4: Column-detection debug panel is hidden until first successful preview
Given the page has just loaded
When the user looks at the sidebar
Then `#debug-details` is hidden (`style.display === 'none'`)
And expanding it via JS would show an empty `<pre id="debug-pre">`
(The hidden surface is not interactable by the user.)

Scenario AT-5: Column-detection debug panel unhides and populates after first successful preview
Given the user has uploaded both CSVs and selected a **Historical quarter** and a **Target quarter**
When `tryUpdatePreview` fires and `renderPreview` runs to completion
Then `#debug-details.style.display === 'block'`
And `#debug-pre.textContent` starts with the literal string `Detected columns:\n`
And after the first `{...}` block, contains `\n\nTarget MoSCoW breakdown:\n`
And after the second `{...}` block, has no trailing content beyond the JSON

Scenario AT-6: Detected columns reflects current `detectedCols`
Given `detectedCols === { initKeyCol: 'jira_key', moscowCol: 'moscow', epicLinkCol: '(normalised→_initiative_key)', teamCol: 'teams', nameCol: 'name', krCol: null }`
When `renderPreview(preview)` runs
Then the first JSON block in `#debug-pre.textContent` is the result of `JSON.stringify(detectedCols, null, 2)` byte-for-byte

Scenario AT-7: Target MoSCoW breakdown reflects the current `preview.moscowGroups`
Given `preview.moscowGroups === { must: 7, should: 11, could: 6, wont: 0, unknown: 0 }`
When `renderPreview(preview)` runs
Then the second JSON block in `#debug-pre.textContent` is the result of `JSON.stringify(preview.moscowGroups, null, 2)` byte-for-byte

Scenario AT-8: Debug panel uses `textContent`, not `innerHTML`
Given a CSV with a header that contains an HTML-special character (e.g. `<priority>`)
And the **Column detector** has assigned that header to `detectedCols.moscowCol`
When `renderPreview(preview)` runs
Then `#debug-pre.textContent` contains the literal four-character substring `<priority>` (escaped by the browser's text-node handling)
And the DOM contains no `<priority>` element
(The `textContent` rule is what makes this safe; an `innerHTML` write would attempt to parse the header as markup.)

Scenario AT-9: Both `<details>` panels share the same chrome
Given the page has just loaded
When the user inspects both `<details>` panels in DevTools
Then both have the `▶` rotation indicator from `summary::before`
And both use the same `background`, `border`, and `border-radius` from `#config-panel details`
And both `<summary>` use the same `padding`, `font-size`, and `color` from `#config-panel summary`

### Public entry point

In-code:
- No exported function. The **T-shirt size reference** panel is pure static markup; its open/close state is handled by the browser's native `<details>`/`<summary>` semantics.
- `renderPreview(preview)` (`index.html:2841-2845`) is the writer that unhides `#debug-details` and updates `#debug-pre.textContent`. It is the same function that Phase 1 owns; this phase documents the *debug pre-block contract* of that function.

UI: the two `<details>` summaries (`T-shirt size reference`, `Column detection debug`) and the bodies they expand to. There is no programmatic API to open/close the panels; the user clicks the summary.

### Expected observable outcomes
- The **T-shirt size reference** `<details>` is always present in the DOM and always interactable, regardless of CSV state.
- The seven `<tr>` rows are the hand-maintained mirror of the synthetic `T_SHIRT_PARAMS` bands ([feature 0005](./0005-synthetic-lognormal-parameters.md)).
- `#debug-details.style.display === 'none'` until the first successful `renderPreview` call.
- After the first call, `#debug-details.style.display === 'block'` for the rest of the session and `#debug-pre.textContent` is refreshed on every subsequent call.
- The pre-block contains exactly two JSON sections separated by `\n\n`; each is the 2-space-indented `JSON.stringify` of its source object.
- Neither panel re-fits, re-detects, or recomputes anything — both are read-only views of state owned upstream.

### Test harness

Acceptance tests:
- Location: **N/A — manual.** Same rationale as Phase 1.
- Manual steps:
  1. Open `index.html` on a fresh page. Click the `T-shirt size reference` summary. Confirm seven rows in the documented order and the footnote (AT-1).
  2. Without loading any CSV, expand the panel again (or leave it open across a hard refresh). Confirm same content (AT-2).
  3. Load CSVs, expand the parameters mode radio (if present) and switch to **Empirical**. Expand the reference panel. Confirm the bands are still synthetic (AT-3). (Note: this scenario is verifying *non-coupling*, not coupling.)
  4. On a fresh page, inspect `#debug-details.style.display` via DevTools — confirm `'none'` (AT-4).
  5. Load both CSVs, select quarters. Confirm `#debug-details` unhides and the pre-block contains both JSON sections (AT-5).
  6. In DevTools console: `JSON.stringify(detectedCols, null, 2)` — confirm the substring appears verbatim in `#debug-pre.textContent` (AT-6). Same for `JSON.stringify(prepareSimulationData(histQs, targetQs).preview.moscowGroups, null, 2)` (AT-7).
  7. Construct an Initiatives CSV with a header `<priority>` populated with MoSCoW values. Upload it. Confirm the pre-block displays the literal text `<priority>` and no `<priority>` DOM element exists anywhere in the page (AT-8).
  8. Inspect both `<details>` elements' computed styles. Confirm the `▶` chevron rotates 90° when expanded and both summaries share the same chrome (AT-9).

Inner tests:
- Location: **N/A.** If a harness is added, the reference table is testable as a DOM snapshot, and the debug pre-block is testable as a function from `(detectedCols, preview.moscowGroups)` to a string.

Verification:
- Manual: walk the steps above.

Fake-injection wiring:
- N/A. To exercise the debug pre-block, mutate `detectedCols` in the DevTools console and call `renderPreview(somePreview)` directly.

### Proposed implementation seams

Stable seams a future test suite may target:
- The presence of the seven `<tr>` rows in the **T-shirt size reference** panel and their order (`2XS, XS, S, M, L, XL, XL+`).
- The presence of the `Min ≈ P10, Max ≈ P90 of lognormal distribution` footnote.
- The pre-block's section labels (`Detected columns:`, `Target MoSCoW breakdown:`) and the `\n\n` separator between them.
- The `textContent` (not `innerHTML`) write contract on `#debug-pre`.

Do NOT lock in:
- The exact band values (`0.10`–`0.25`, etc.) — these mirror `T_SHIRT_PARAMS` and may be re-calibrated. The *fact* that the table exists and lists seven sizes in canonical order is the contract; the numbers are sourced from [feature 0005](./0005-synthetic-lognormal-parameters.md).
- The footnote wording.
- The 2-space JSON indentation. A future revision could switch to 4 spaces without breaking any observable contract.
- The summary strings `T-shirt size reference` and `Column detection debug` — human-readable, mutable.
- The `▶` chevron — purely decorative.

### Behavioral rule

The **T-shirt size reference** panel is a *static documentation surface* mirroring the synthetic `T_SHIRT_PARAMS` bands; it is available on every page load regardless of CSV state and does not respond to the **Empirical parameters** toggle. The **Column-detection debug** panel is a *live debug surface* that unhides on the first successful `renderPreview` call and re-renders its two JSON sections (the live `detectedCols` and the current `preview.moscowGroups`) on every subsequent call. Both panels are read-only views: neither computes anything, neither writes to module-scoped state, and neither is interactable beyond `<details>` open/close.

### Invariants
- The **T-shirt size reference** `<details>` element exists in the DOM at all times after page load with exactly seven `<tr>` rows in canonical order.
- The seven band values match the synthetic `T_SHIRT_PARAMS` map by hand; changing one without the other is a documented bug surface in [ADR-0007](../adr/0007-lognormal-effort-distribution.md).
- `#debug-details.style.display` is `'none'` until the first successful `renderPreview` call; `'block'` thereafter for the session.
- `#debug-pre` is written via `textContent`, never `innerHTML`.
- The pre-block contains exactly two JSON sections separated by `\n\n`; no other content is appended.
- The first JSON block is the `JSON.stringify(detectedCols, null, 2)` of the *current* `detectedCols` at the time of the call (not a snapshot from page load).
- The second JSON block is the `JSON.stringify(preview.moscowGroups, null, 2)` of the *current* `preview` argument.

### Counterexamples (must NOT pass)
- A `renderPreview` that writes `#debug-pre.innerHTML` instead of `.textContent` — would parse `<priority>` (or any other special-character header) as markup, breaking the trust-surface property of the panel and opening an XSS vector if a user uploads an adversarial CSV.
- A reference table generated from `T_SHIRT_PARAMS` at runtime — would silently re-render to show the **Empirical** bands when the user flips the toggle, suggesting (falsely) that the reference panel is the empirical authority. The hand-maintained synthetic table is the documented contract.
- A reference table that hides itself when no CSV is loaded — would force first-time users to upload a CSV before they can read the size bands they need to understand the CSV in the first place. The panel is documentation; it must be available always.
- A debug pre-block that *unhides on page load* — would show `Detected columns: { initKeyCol: null, ... }` before any detection has run, suggesting a defect rather than a not-yet-loaded state. The unhide-on-first-successful-preview rule is what keeps the surface honest.
- A debug pre-block that updates on every `detectedCols` write (i.e. inside the **Column detectors** themselves) — would re-render the panel mid-file-load, before quarters are picked, and could show a snapshot that does not match the current `preview`. Updating only inside `renderPreview` keeps the two halves of the pre-block coherent.
- A debug pre-block with three or more sections (e.g. adding the **Bootstrap pool** size distribution as a third JSON block) — would dilute the panel's purpose (column detection + MoSCoW bucketing audit) into a generic dump. The compact two-section format is intentional.

### Forbidden shortcuts
- Do not auto-expand the **T-shirt size reference** panel on first load. It is `<details>` (collapsed by default) for a reason: the user opens it when they want it. Auto-expanding clutters the sidebar.
- Do not auto-expand the **Column-detection debug** panel on first successful preview. The unhide is sufficient; auto-opening is noisy for the typical user who is not debugging.
- Do not render the size bands as a chart or interactive widget. The static table is the documented surface; an interactive widget would invite the question "can I edit the bands here?" — which is no, calibration happens in [feature 0005](./0005-synthetic-lognormal-parameters.md).
- Do not add a "copy to clipboard" button on the debug pre-block. The native browser selection is sufficient.
- Do not move the reference table inside the **Data preview** block. The two surfaces have different lifecycles (the reference is always-on; the preview is gated) and different sources (the reference is static; the preview is live).
- Do not derive the reference table from `T_SHIRT_PARAMS` at load time even as a "best of both worlds" compromise. The intentional duplication exists precisely so the reference cannot silently drift when the parameter set is re-calibrated. See [ADR-0007](../adr/0007-lognormal-effort-distribution.md).

### RED gate

On an un-implemented build:
- Manual step 1: the `T-shirt size reference` summary is missing or expands to an empty panel.
- Manual step 5: with full inputs, `#debug-details` stays hidden — no `Detected columns:` text appears.
- Manual step 7: a `<priority>` header in the uploaded CSV creates a `<priority>` DOM element somewhere on the page (because the implementation used `innerHTML`).

### Test immutability rule

Same as Phase 1: N/A in the current project. If tests are added later, they're off-limits to the implementation session.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-9 all pass.
- [ ] The **T-shirt size reference** panel is always present and shows the seven hand-maintained bands.
- [ ] The **Column-detection debug** panel is hidden until the first successful `renderPreview` call.
- [ ] `#debug-pre` is written via `textContent`; an adversarial header is rendered as literal text, not parsed as markup.
- [ ] The reference table does *not* change when the **Empirical parameters** toggle is flipped.
- [ ] `git diff` touches only `index.html` (ADR-0001).
