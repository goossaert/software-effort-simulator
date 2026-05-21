# Feature: Multi-quarter selector for Historical and Target quarters

Created at: 2026-05-21T00:00:00Z

## Context

This feature owns the two sidebar **Quarter selectors** that drive every downstream consumer of "which quarters are in scope". Before this feature, the simulator used two bare `<input type="text">` controls — one for the **Historical quarter**, one for the **Target quarter** — that accepted a single label each (e.g. `Q2 2026`) and forced the user to either re-run the simulator to compare across quarters, or pre-merge multiple quarters into a synthetic label upstream. This feature replaces both inputs with a custom multi-select widget (`MultiSelect` class) backed by a chip strip plus a checkbox dropdown, populated chronologically from the union of quarters present in the loaded CSVs, and emits a bubbling `ms-change` `CustomEvent` on every selection edit so live consumers (the **Data preview** in particular) can re-paint without polling.

The feature is deliberately narrow. It does not own the *meaning* of the **Historical quarter** or **Target quarter** in the fit pipeline (that belongs to [feature 0003](./0003-monte-carlo-simulation-engine.md) and [feature 0004](./0004-moscow-three-scenario-forecasting.md)) — it only owns *the picker*. It does not own the **Data preview** that re-paints on `ms-change` ([feature 0009](./0009-sidebar-preview-and-reference-panels.md) does). It does not own the run-button handler that reads `histMS.getSelected()` and `targetMS.getSelected()` at Run time ([feature 0003](./0003-monte-carlo-simulation-engine.md) does). What it owns is: (a) the markup at `index.html:875-895` (the two `<div class="ms-wrapper">` panels), (b) the CSS for the chip/dropdown chrome at `index.html:123-152`, (c) the `extractQuarters` helper (`index.html:1073-1081`) that sorts and deduplicates quarter labels from a row array, (d) the `MultiSelect` class (`index.html:1083-1143`) and its two instances `histMS` / `targetMS` (`index.html:1145-1146`), (e) `refreshQuarters` (`index.html:1523-1542`) that re-populates both widgets after every CSV load while preserving the current selection where possible, and (f) the two `ms-change` listeners on the wrappers (`index.html:3271-3272`).

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). The widget is vanilla DOM (no React, no Choices.js, no Select2); the CSS is inline; the constructor wires its event listeners by hand.
- [ADR-0002 — Client-side only, no backend](../adr/0002-client-side-only.md). The quarter list is derived from the in-memory parsed CSVs; nothing is fetched.
- [ADR-0003 — CSV as the input format](../adr/0003-csv-input-format.md). The widget reads each row's `quarter` field (after the loader has normalised it to `_quarter` for epics); no canonical quarter schema is enforced beyond a `Q[N] YYYY` shape for the chronological sort.
- [ADR-0008 — Poisson distribution for epic count per initiative](../adr/0008-poisson-epic-count.md). The **Historical quarter** selection is what `prepareSimulationData` filters against to fit **Poisson λ**.
- [ADR-0010 — Three-scenario MoSCoW forecasting](../adr/0010-three-scenario-moscow-forecasting.md). The **Target quarter** selection bounds the in-scope **Initiatives** counted into the three per-**Scenario** `K` values.
- [ADR-0016 — Live sidebar preview of fitted model inputs](../adr/0016-live-sidebar-preview.md). The **Data preview** re-paints on every `ms-change`; the wiring is the single bridge between this feature and the preview surface.
- [ADR-0017 — Multi-quarter selectors via a custom widget](../adr/0017-multi-quarter-selectors.md). The architectural decision for *why* the selectors are multi-select, *why* the widget is hand-built rather than native or library-sourced, and *why* the `ms-change` `CustomEvent` is the public observation surface.

Glossary terms used below: **Quarter**, **Historical quarter**, **Target quarter**, **Quarter selector**, **Initiative**, **Epic**, **Initiatives CSV**, **Epics CSV**, **Run**, **Data preview**, **Poisson λ**, **MoSCoW**, **Scenario** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user who opens `index.html` sees both **Quarter selectors** in the sidebar in their resting state: each is an empty chip strip with the placeholder text `Upload CSV to populate` and a `▼` arrow. The dropdown list is collapsed and empty — there is nothing to pick yet. The selectors are visible but functionally inert until at least one CSV is loaded.

After the user uploads the **Initiatives CSV** (or the **Epics CSV** — the order does not matter), `refreshQuarters` fires. It walks the loaded rows, extracts the distinct quarter labels (e.g. `Q1 2026`, `Q2 2026`, `Q3 2026`), sorts them chronologically by `(year, quarter)` against the `Q[N] YYYY` shape, and re-populates both widgets with the same list. The placeholder is replaced by chips for the *defaults*: `Q2 2026` is pre-selected on the **Historical quarter** selector if present (else the first label in the sorted list); `Q3 2026` is pre-selected on the **Target quarter** selector if present (else the second label). If the user uploads the other CSV next, `refreshQuarters` runs again — the new combined union becomes the option list, and the user's prior selection survives if any of its labels still exist in the new union.

Clicking either selector's trigger area toggles its dropdown open (`▼` arrow rotates to `▲`). The dropdown shows one `<label>` per quarter, each containing a checkbox and the label text. Clicking a checkbox toggles its selection state: a check appears (or disappears), a chip with that quarter's label is added to (or removed from) the trigger area, and an `ms-change` `CustomEvent` bubbles from the wrapper. A click outside the wrapper closes the dropdown (a `document`-level click listener checks `!this.wrapper.contains(e.target)`).

Each chip in the trigger area has an `✕` icon at its right edge. Clicking the `✕` removes that quarter from the selection — the matching checkbox in the dropdown unchecks, the chip disappears, and another `ms-change` event bubbles. The `✕` click `stopPropagation()`'s so it does not also toggle the dropdown's open state. With zero selected quarters the placeholder text reappears (`Select quarters…` after the first load, `Upload CSV to populate` before any load).

The chips inside the trigger area are rendered in a stable lexicographic order (`[...selected].sort()`) regardless of the order in which the user clicked them. The option list in the dropdown is rendered in chronological order (the same order produced by `extractQuarters`).

The two selectors are independent: changing the **Historical quarter** selector does not affect the **Target quarter** selector, and vice versa. Selecting the same quarter in both is allowed (e.g. fitting and forecasting on `Q3 2026` is valid — the simulator does not enforce that historical ≠ target). Selecting zero quarters in either is allowed at the widget level — the downstream consumers (the **Data preview**'s guard, the run-button handler's gate) decide whether to act on the empty selection.

Editing either selector (checkbox or chip-`✕`) fires `ms-change` on the matching wrapper. Two listeners on `index.html:3271-3272` call `tryUpdatePreview` on every event; the live **Data preview** re-paints, picking up the new historical or target quarter set. No spinner, no debounce, no error path — the cost of a paint is trivially fast.

## Scope

### In scope
- The two sidebar markup blocks at `index.html:875-895`:
  - The `Historical Quarter(s) — λ source` label and `<div class="ms-wrapper" id="hist-ms">` container with its `.ms-trigger`, `.ms-placeholder`, `.ms-arrow`, and empty `.ms-options-wrap`.
  - The `Target Quarter(s)` label and `<div class="ms-wrapper" id="target-ms">` container with the same internal structure.
- The inline CSS at `index.html:123-152`:
  - `.ms-wrapper`, `.ms-trigger`, `.ms-trigger:hover`, `.ms-placeholder`, `.ms-arrow`, `.ms-wrapper.open .ms-arrow`.
  - `.ms-chip`, `.ms-chip-x`, `.ms-chip-x:hover`.
  - `.ms-options-wrap`, `.ms-wrapper.open .ms-options-wrap`, `.ms-option`, `.ms-option:hover`, `.ms-option input[type=checkbox]`.
- `extractQuarters(rows)` (`index.html:1073-1081`): pure function from a row array to a chronologically-sorted, deduplicated string array of quarter labels. Reads `row.quarter` (not `row._quarter` — initiatives keep the raw header value; the function is also called directly with `parsedInitiatives`).
- The `MultiSelect` class (`index.html:1083-1143`):
  - Constructor: takes a `wrapperId`, caches `wrapper` / `trigger` / `optWrap` references, initialises an empty `Set` for selections and an empty array for the quarter list, wires the trigger click and a `document`-level outside-click listener.
  - `populate(quarters, defaultSelections)`: replaces the option list and the chip strip, filtering `defaultSelections` against `quarters` to drop any stale label.
  - `getSelected(): string[]`: returns `[...this.selected]` — the canonical read API.
  - `toggle()` / `close()`: pure DOM, toggles the `open` class.
  - `_renderOptions()`: rebuilds the dropdown list from the sorted quarter array; each checkbox's `change` handler updates the `selected` Set, re-renders the chip strip, and dispatches `ms-change`.
  - `_renderChips()`: rebuilds the chip strip from `[...selected].sort()` (lexicographic), or inserts a placeholder when the selection is empty; each chip's `✕` click removes the quarter, re-renders both surfaces, and dispatches `ms-change`.
- The two module-scoped instances `histMS` and `targetMS` (`index.html:1145-1146`).
- `refreshQuarters()` (`index.html:1523-1542`): merges quarter labels from `parsedInitiatives` and `parsedEpics` (the latter via `row._quarter` because the epics loader normalises) into a single chronologically-sorted union; preserves each selector's current selection where labels still exist, otherwise falls back to defaults (`Q2 2026` for historical, `Q3 2026` for target, with `slice(0,1)` / `slice(1,2)` as the final fallback).
- The five `refreshQuarters` call sites:
  - End of `loadInitiativesCSV` (`index.html:1515`).
  - End of `loadEpicsFile` (around the epics-loader's commit point).
  - Per-file reset handlers (`resetInitiativesFile`, `resetEpicsFile`) — to repopulate or empty the widgets when a CSV is removed.
- The two `ms-change` listeners at `index.html:3271-3272`:
  - `document.getElementById('hist-ms').addEventListener('ms-change', tryUpdatePreview);`
  - `document.getElementById('target-ms').addEventListener('ms-change', tryUpdatePreview);`
- The chronological sort comparator (`/^Q(\d)\s+(\d{4})$/`, `(year, quarter)` ordering, `localeCompare` fallback) used in both `extractQuarters` and `refreshQuarters`.

### Out of scope
- `prepareSimulationData(histQs, targetQs)` and the downstream simulation pipeline that consumes the selection. [Feature 0003](./0003-monte-carlo-simulation-engine.md). This feature *produces* the two string arrays; the engine *consumes* them.
- `tryUpdatePreview` and the **Data preview** itself. [Feature 0009](./0009-sidebar-preview-and-reference-panels.md). The wiring (`ms-change → tryUpdatePreview`) is in scope here; the preview's repaint contract is owned upstream.
- The **MoSCoW** bucketing of in-scope **Initiatives** inside the target quarter selection. [Feature 0004](./0004-moscow-three-scenario-forecasting.md). This feature only delivers the set of quarter labels; the bucketing happens in `prepareSimulationData`.
- The Team Level tab's per-team historical selection. [Feature 0011](../../backtracked-features.md#0011). The team tab uses the same `histMS.getSelected()` / `targetMS.getSelected()` reads as the org-level engine; it does *not* render its own quarter widgets.
- The Team Projections tab's cross-quarter forecast. [Feature 0012](../../backtracked-features.md#0012). It walks all quarters available in the CSVs (independent of the selector) and renders one column per quarter.
- The Constant Work CSV's team/quarter pair. [Feature 0015](../../backtracked-features.md#0015). The constant-work loader matches on its own `team` / `quarter` columns; it does not read the selectors.
- The Run-button gating. [Feature 0001](./0001-csv-upload-ui.md). The selectors are functional even with the Run button disabled, and the Run button can be enabled before any quarter is selected (the run-button handler is the surface that gates on selection, not the widget).
- A "select all" shortcut, a search box on the option list, or keyboard navigation through the dropdown. Additive surfaces; if added later, they would not re-open [ADR-0017](../adr/0017-multi-quarter-selectors.md).
- Persisting the selection across page reloads (localStorage / URL params). Out of scope; the selectors reset to their defaults on every reload.

## Relevant existing files
Claude may inspect:
- `index.html`, specifically:
  - The two markup blocks at `index.html:875-895`.
  - The CSS at `index.html:123-152`.
  - `extractQuarters` (`index.html:1073-1081`), the `MultiSelect` class (`index.html:1083-1143`), and the two instances (`index.html:1145-1146`).
  - `refreshQuarters` (`index.html:1523-1542`) and its call sites in `loadInitiativesCSV` (`index.html:1515`) and the epics loader.
  - The two `ms-change` listeners at `index.html:3271-3272`.
  - The `prepareSimulationData(histQs, targetQs)` signature (`index.html:1705`) — to confirm the read contract.
  - The run-button handler's `histMS.getSelected()` / `targetMS.getSelected()` reads (`index.html:3310-3312`).
- `CONTEXT.md` glossary, especially the **Planning vocabulary** group (**Quarter**, **Historical quarter**, **Target quarter**, **Quarter selector**) and the **Inputs** group (**Initiatives CSV**, **Epics CSV**).
- ADRs 0001, 0002, 0003, 0008, 0010, 0016, and 0017 for the constraints this feature must respect.

Claude should not inspect unless needed:
- The Monte Carlo samplers, `runScenario`, `runSimulation`, `buildHistogram`, `computeStats` — all downstream; this feature does not touch them.
- The marker system, the stats table, the chart — none read the selectors directly.
- The Team Projections tab — it walks all quarters from the CSVs, independent of the selector.
- The CSV parsers (`loadInitiativesCSV`, `loadEpicsFile`) — they call `refreshQuarters` at their tail; the parser internals are upstream.

## Existing patterns to follow
- **Layering inside `index.html`**: the markup block lives in Module 0 (the static HTML head). The CSS lives at the top of the same file. `extractQuarters`, the `MultiSelect` class, and the two instances live in a dedicated `<script>` block immediately above the PRNG module (`index.html:1073-1147`). `refreshQuarters` lives in Module 3 (CSV loaders), at the tail of the loader code so that every CSV mutation triggers a widget refresh. The two `ms-change` listeners live in Module 7 (UI controller), grouped with the other event wirings. This matches the layering plans [0001](./0001-csv-upload-ui.md) and [0009](./0009-sidebar-preview-and-reference-panels.md) follow.
- **One source of truth per concern**: the widget's `selected` `Set` is the canonical state for "which quarters are picked"; `getSelected()` is the only read API; the DOM (chips + checkboxes) is a derived view rebuilt from the `Set` on every change. Do not introduce a parallel `lastSelection` cache or read the DOM (via `:checked` selectors) as the source of truth.
- **One DOM write per paint**: `_renderOptions` builds the entire option list HTML as a single `.map(...).join('')` template literal and assigns it to `optWrap.innerHTML` in one statement. `_renderChips` removes the existing chips with a single `forEach`/`remove` pass and re-inserts the new chips in another single `forEach`. No per-character DOM manipulation, no `appendChild` loops with intermediate reflows.
- **Bubbling `CustomEvent` as the public observation surface**: every selection change (checkbox toggle, chip `✕`) dispatches `new CustomEvent('ms-change', { bubbles: true })` on the wrapper. Consumers attach listeners to the wrapper; the widget does not know who is listening. Do not add a constructor-supplied callback, do not extend the widget with an EventEmitter, do not introduce a global event bus.
- **Chronological sort lives in two places, by design**: `extractQuarters` sorts the raw rows; `refreshQuarters` sorts the merged union. Both use the same `(year, quarter)` comparator against the `^Q(\d)\s+(\d{4})$` regex with `localeCompare` as the fallback. The duplication is small and the colocation makes each call site self-contained.
- **Defaults are last-resort, not first-resort**: `refreshQuarters` first preserves the current selection (filtered against the new union); only when nothing survives does it fall back to `Q2 2026` (or the first available) for historical and `Q3 2026` (or the second available) for target. The fallback is conservative and only kicks in on a fundamental dataset change.
- **No framework, no library**: vanilla DOM (`document.getElementById`, `querySelector`, `addEventListener`, `dispatchEvent`, `CustomEvent`). No `<select multiple>` underneath; no third-party combobox loaded from CDN.
- **Verification command**: there is no automated test harness in this project. Verification is manual: open `index.html` in a browser, upload known-good CSVs, exercise the selectors, and inspect the chip strip, the dropdown, and the `ms-change`-driven re-paint of the **Data preview**.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer — this is a client-side-only app (ADR-0002). In-memory state owned by this feature:

```js
// Module-scoped, after the MultiSelect class declaration.
const histMS   = new MultiSelect('hist-ms');   // The Historical quarter selector instance.
const targetMS = new MultiSelect('target-ms'); // The Target quarter selector instance.

// Inside each MultiSelect instance:
class MultiSelect {
  wrapper:  HTMLElement;            // The .ms-wrapper element.
  trigger:  HTMLElement;            // The .ms-trigger child — holds chips + arrow.
  optWrap:  HTMLElement;            // The .ms-options-wrap child — holds the option list.
  selected: Set<string>;            // The canonical selection state.
  quarters: string[];               // The current option list, in chronological order.
}

// Read from upstream (feature 0001's parsers).
let parsedInitiatives: Array<RowObject> | null;   // Each row has a raw `quarter` field.
let parsedEpics:       Array<EpicRow>   | null;   // Each row has a normalised `_quarter` field.
```

Read contract for downstream consumers:
- `histMS.getSelected(): string[]` — the current **Historical quarter** selection, in lexicographic order. Possibly empty.
- `targetMS.getSelected(): string[]` — the current **Target quarter** selection, in lexicographic order. Possibly empty.
- Both arrays are *snapshots* — mutating the returned array does not affect the widget's internal `Set`.

Event contract:
- Every checkbox toggle and every chip `✕` click dispatches one `ms-change` `CustomEvent` on the wrapper, with `bubbles: true` and no `detail`. Listeners read the current selection via `getSelected()` rather than from the event.

---

## Phase 1: MultiSelect widget chrome, click-to-open dropdown, click-outside-to-close

### Acceptance behavior

Scenario AT-1: Initial paint shows two empty selectors
Given the page has just loaded (no CSVs)
When the user looks at the sidebar
Then both `#hist-ms` and `#target-ms` are visible
And each shows the placeholder text `Upload CSV to populate`
And each shows the `▼` arrow on the right
And neither has any chips
And neither has the `open` class
And the `.ms-options-wrap` of each is collapsed (`max-height: 0`)

Scenario AT-2: Clicking the trigger opens the dropdown
Given the page has loaded CSVs (so the option list is non-empty)
When the user clicks the `.ms-trigger` of `#hist-ms`
Then `#hist-ms` gains the `open` class
And its `.ms-options-wrap` expands (`max-height: 200px`)
And the `▼` arrow rotates to point upward (`transform: rotate(180deg)`)

Scenario AT-3: Clicking the trigger again closes the dropdown
Given the dropdown of `#hist-ms` is open
When the user clicks the `.ms-trigger` again
Then `#hist-ms` loses the `open` class
And its `.ms-options-wrap` collapses

Scenario AT-4: Clicking outside the wrapper closes the dropdown
Given the dropdown of `#hist-ms` is open
When the user clicks any element that is not a descendant of `#hist-ms`
Then `#hist-ms` loses the `open` class
And its `.ms-options-wrap` collapses
(The same applies symmetrically to `#target-ms`.)

Scenario AT-5: The two selectors are independent
Given the dropdown of `#hist-ms` is open
When the user clicks the `.ms-trigger` of `#target-ms`
Then `#target-ms` gains the `open` class
And `#hist-ms` loses the `open` class (because `#target-ms`'s trigger is outside `#hist-ms`, so the document-level outside-click listener fires for `#hist-ms`)

### Public entry point

In-code:
- `new MultiSelect('hist-ms')` and `new MultiSelect('target-ms')` — the constructors that wire the trigger click and the document-level outside-click listener.

UI: the two `.ms-trigger` elements. There is no programmatic open/close API — the user clicks.

### Expected observable outcomes
- Both wrappers exist in the DOM at page load with the `Upload CSV to populate` placeholder.
- The `open` class is toggled on the wrapper exclusively by trigger clicks and outside clicks; nothing else flips it.
- The `▼` arrow uses CSS-only animation (`transform: rotate`) driven by the `.ms-wrapper.open` selector.

### Test harness

Acceptance tests:
- Location: **N/A — this project has no automated test suite.** Manual acceptance is performed in the browser.
- Manual steps:
  1. Open `index.html`. Confirm both selectors show the placeholder and the `▼` arrow (AT-1).
  2. Load both CSVs (so options exist). Click `#hist-ms`'s trigger. Confirm the dropdown opens and the arrow rotates (AT-2).
  3. Click the same trigger again. Confirm the dropdown closes (AT-3).
  4. Open `#hist-ms`. Click an empty area of the sidebar. Confirm the dropdown closes (AT-4).
  5. Open `#hist-ms`. Click `#target-ms`'s trigger. Confirm `#target-ms` opens and `#hist-ms` closes (AT-5).

Inner tests:
- Location: **N/A — no test harness.** If a harness is added, the `toggle()` and `close()` methods are pure DOM and trivially testable against a fixture wrapper.

Verification: manual; walk the steps above.

Fake-injection wiring: N/A.

### Proposed implementation seams

Stable seams a future test suite may target:
- `new MultiSelect(wrapperId)` — constructor contract (wraps the wrapper with that `id`, finds the three children by class, attaches the two listeners).
- `toggle()` / `close()` — pure DOM methods, no business rules.
- The `.ms-wrapper.open` CSS selector — the chrome's open/closed state is driven by one class.

Do NOT lock in:
- The `▼` glyph — purely decorative; could be replaced by an SVG.
- The `max-height: 200px` value — a UX choice, not a contract.
- The animation duration (`0.2s`) — UX choice.
- The colours (`#2d2b52` background, `#4a4870` border, etc.) — global theme.

### Behavioral rule

The **Quarter selector** is a custom-built combo box that opens its dropdown on trigger click and closes it on either another trigger click *or* any click outside the wrapper. The two selectors operate independently — opening one does not affect the other, and closing-on-outside-click is what enforces "only one open at a time" without the selectors knowing about each other.

### Invariants
- After page load, both `#hist-ms` and `#target-ms` exist in the DOM and have an `.ms-trigger`, a `.ms-options-wrap`, an `.ms-placeholder` (initially `Upload CSV to populate`), and a `.ms-arrow`.
- The `open` class on a wrapper is set iff its dropdown is currently visible.
- A `document`-level click on any element outside a wrapper closes that wrapper's dropdown.
- The constructor attaches exactly one listener to its trigger and exactly one listener to `document`.

### Counterexamples (must NOT pass)
- A `MultiSelect` constructor that attaches multiple listeners on re-instantiation (the constructor is called exactly twice at module load; re-attaching on each `populate` call would leak listeners).
- A `toggle` that uses `.ms-wrapper.open` from a sibling wrapper (would couple the two instances; the close-on-outside-click is what enforces mutual exclusion without coupling).
- An `open` state driven by inline `style.display` rather than the `open` class (would defeat the CSS-driven animation).
- A click handler on `.ms-trigger` that does not `stopPropagation()` — *not* a defect, because the document-level listener correctly ignores wrapper-internal clicks via `wrapper.contains(e.target)`; the design choice is intentional and `stopPropagation` would be over-engineering.

### Forbidden shortcuts
- Do not use a native `<select multiple>` as the underlying control. The custom widget exists precisely because the native control's behaviour is hostile on most platforms (see [ADR-0017](../adr/0017-multi-quarter-selectors.md)).
- Do not load a third-party combobox library. The widget is ~60 lines of vanilla DOM; a library would conflict with [ADR-0001](../adr/0001-single-file-html-app.md).
- Do not attach the open/close listener to `window` instead of `document`. The two are functionally equivalent here, but the existing pattern uses `document` and consistency wins.

### RED gate

On an un-implemented build:
- Manual step 1: the two wrappers are missing from the sidebar, or they are present but show no placeholder.
- Manual step 2: clicking the trigger does nothing (no class change, no arrow rotation, no expansion).

### Test immutability rule

There are no test files to freeze in this project (manual harness). If a test suite is later introduced and Phase 1's acceptance steps are codified, those tests live under `tests/unit/` and are off-limits to the implementation session — only the test-writing session may edit them.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-5 all pass.
- [ ] Both `#hist-ms` and `#target-ms` exist with the documented internal structure.
- [ ] The `open` class is the *only* lever for the dropdown's visibility.
- [ ] No third-party combobox dependency was added.

---

## Phase 2: Populating the quarter list, default selection, selection persistence on re-population

### Acceptance behavior

Scenario AT-1: Loading the Initiatives CSV populates both selectors
Given the page has just loaded
And no CSV has been uploaded
When the user uploads an **Initiatives CSV** whose rows include the quarters `Q1 2026`, `Q2 2026`, `Q3 2026`
Then `loadInitiativesCSV` calls `refreshQuarters`
And `refreshQuarters` extracts the quarter set and sorts it chronologically (`Q1 2026, Q2 2026, Q3 2026`)
And calls `histMS.populate(['Q1 2026', 'Q2 2026', 'Q3 2026'], ['Q2 2026'])`
And calls `targetMS.populate(['Q1 2026', 'Q2 2026', 'Q3 2026'], ['Q3 2026'])`
And `#hist-ms`'s placeholder is replaced by a chip reading `Q2 2026`
And `#target-ms`'s placeholder is replaced by a chip reading `Q3 2026`
And each dropdown's option list shows three `<label>` rows with checkboxes (the `Q2 2026` checkbox checked on `#hist-ms`, the `Q3 2026` checkbox checked on `#target-ms`)

Scenario AT-2: Loading the Epics CSV merges its quarters into the union
Given the user has already loaded an **Initiatives CSV** with quarters `Q2 2026, Q3 2026`
And both selectors are populated with that two-quarter list
When the user uploads an **Epics CSV** whose rows include `Q1 2026, Q2 2026, Q4 2026`
Then `loadEpicsFile` calls `refreshQuarters`
And the new union is `Q1 2026, Q2 2026, Q3 2026, Q4 2026`
And both selectors are re-populated with that four-quarter list
And the previously-selected `Q2 2026` on `#hist-ms` and `Q3 2026` on `#target-ms` survive
And each dropdown now shows four option rows

Scenario AT-3: Selection survives when its labels are still in the new union
Given the user has selected `Q1 2026, Q2 2026` on `#hist-ms` (two chips)
And has selected `Q3 2026` on `#target-ms`
When the user re-uploads (or resets and re-uploads) a CSV whose union still includes those three labels
Then `refreshQuarters` is called again
And `#hist-ms` still shows chips for `Q1 2026` and `Q2 2026`
And `#target-ms` still shows the chip for `Q3 2026`

Scenario AT-4: Selection falls back to default when none of its labels survive
Given the user has selected `Q4 2025` on `#hist-ms`
And the user resets the **Initiatives CSV** and uploads a *different* file whose union is `Q1 2026, Q2 2026, Q3 2026`
When `refreshQuarters` runs
Then the current selection `['Q4 2025']` filtered against the new union is empty
And the fallback chain selects `Q2 2026` (because it is present in the new union)
And `#hist-ms` shows a chip for `Q2 2026`

Scenario AT-5: Defaults fall through to first/second available when canonical defaults are absent
Given the loaded CSVs contain only quarters `Q1 2027, Q2 2027`
And the user has no prior selection
When `refreshQuarters` runs
Then `#hist-ms`'s default is `Q1 2027` (the first available, because `Q2 2026` is not in the union)
And `#target-ms`'s default is `Q2 2027` (the second available, because `Q3 2026` is not in the union)

Scenario AT-6: Chronological sort against the `Q[N] YYYY` regex
Given the loaded rows include quarters `Q3 2027, Q1 2026, Q4 2026, Q2 2026, Q1 2027`
When `extractQuarters(rows)` runs
Then the returned array is `['Q1 2026', 'Q2 2026', 'Q4 2026', 'Q1 2027', 'Q3 2027']` (sorted by year, then quarter)
And both selectors' option lists render in that order

Scenario AT-7: Non-canonical quarter labels fall through to `localeCompare`
Given a row's `quarter` field is the literal `TBD`
When `extractQuarters` runs
Then `TBD` is included in the output array
And its position is determined by `localeCompare` against the other labels (whatever stable order that produces)
(The simulator does not reject the row; it surfaces `TBD` as a pickable option.)

Scenario AT-8: Empty quarter fields are excluded
Given some rows have an empty `quarter` field
When `extractQuarters` runs
Then those rows contribute nothing to the option list
And the rows are not surfaced as an empty-string option

Scenario AT-9: `populate` filters stale defaults against the new option list
Given `populate(['Q1 2026', 'Q2 2026'], ['Q3 2026'])` is called
When the method runs
Then `this.selected` is the empty `Set` (because `Q3 2026` is not in the option list)
And the chip strip shows the placeholder

### Public entry point

In-code:
- `extractQuarters(rows)` (`index.html:1073`).
- `MultiSelect.populate(quarters, defaultSelections)` (`index.html:1095`).
- `refreshQuarters()` (`index.html:1523`) — called from `loadInitiativesCSV`, the epics loader, and the per-file resetters.

UI: implicit — the user uploads a CSV, the option list and chip strip update on next paint.

### Expected observable outcomes
- `extractQuarters` returns a chronologically-sorted, deduplicated array; empty strings are excluded.
- `populate` replaces both the option list and the chip strip in one call; defaults are filtered against the new option list.
- `refreshQuarters` merges quarters from both loaded CSVs (or just one, if only one is loaded), preserves the current selection where possible, and falls back to the documented defaults otherwise.

### Test harness

Acceptance tests: manual.
- Manual steps:
  1. Load an Initiatives CSV with `Q1 2026, Q2 2026, Q3 2026`. Confirm AT-1's `Then` clauses by opening both dropdowns and inspecting their option lists and chip strips.
  2. Load an Epics CSV with `Q1 2026, Q2 2026, Q4 2026`. Confirm AT-2.
  3. In DevTools console, set `histMS.populate(['Q1 2026','Q2 2026','Q3 2026','Q4 2026'], ['Q1 2026','Q2 2026'])`. Then call `refreshQuarters()` with the same union. Confirm AT-3.
  4. Reset the Initiatives CSV and upload a new one whose union does not contain the prior selection. Confirm AT-4.
  5. Upload a CSV whose only quarters are `Q1 2027, Q2 2027`. Confirm AT-5.
  6. Construct a CSV whose `quarter` column is scrambled. Confirm AT-6 by reading `extractQuarters(parsedInitiatives)` in DevTools.
  7. Add a row with `quarter: TBD` and confirm it appears in both dropdowns (AT-7).
  8. Add a row with empty `quarter` and confirm it does not (AT-8).
  9. In DevTools console, call `histMS.populate(['Q1 2026','Q2 2026'], ['Q3 2026'])`. Confirm the chip strip shows the placeholder (AT-9).

Inner tests:
- Location: N/A. If a harness is added, `extractQuarters` is a pure function and trivially testable; `populate` is testable against a wrapper fixture.

Verification: manual.

Fake-injection wiring: N/A. To exercise `populate` without going through `refreshQuarters`, call it directly from the DevTools console.

### Proposed implementation seams

Stable seams a future test suite may target:
- `extractQuarters(rows: Array<{quarter?: string}>): string[]` — pure function, no DOM.
- `MultiSelect.populate(quarters: string[], defaultSelections: string[]): void` — pure-ish: replaces internal state and re-renders the DOM children of the wrapper. No event dispatched.
- `refreshQuarters(): void` — reads `parsedInitiatives` and `parsedEpics` from module scope, computes the merged union, preserves the current selection, calls `populate` on each instance. No event dispatched (because the upstream caller — the file-load handler — fires `tryUpdatePreview` itself; firing here would double-paint).

Do NOT lock in:
- The exact default fallback labels (`Q2 2026` for historical, `Q3 2026` for target). They are reasonable choices for the current calendar and may shift over time. The fallback *chain* (current selection → canonical default → first/second available) is the contract; the literal years are not.
- The chronological sort comparator's tolerance — `localeCompare` for non-canonical labels is one acceptable choice; a stricter comparator that rejects non-`Q[N] YYYY` labels would also be acceptable.

### Behavioral rule

`refreshQuarters` is the single bridge between CSV-load events and the **Quarter selector** widgets. It runs after every successful load and every per-file reset, merges the union of quarters from whatever CSVs are currently loaded, preserves the user's selection where labels survive, and falls back to the documented defaults only when nothing survives. `populate` is the widget's only entry point for replacing its option list; it filters defaults against the option list so that a stale default never ends up in `selected`.

### Invariants
- `extractQuarters(rows)` returns an array whose entries are unique, non-empty, and sorted by the `(year, quarter)` ordering on `Q[N] YYYY` labels (with `localeCompare` as the fallback for non-matching labels).
- `refreshQuarters` is called from every code path that mutates `parsedInitiatives` or `parsedEpics`.
- After `populate(quarters, defaults)`, `this.selected` ⊆ `Set(quarters)` and is exactly `Set(defaults.filter(d => quarters.includes(d)))`.
- After `refreshQuarters`, `histMS.getSelected()` and `targetMS.getSelected()` are each non-empty (because the fallback chain guarantees at least one label is selected) *if and only if* the union is non-empty.
- `refreshQuarters` does not dispatch `ms-change`; the upstream loader is responsible for firing any post-load re-paint.

### Counterexamples (must NOT pass)
- A `refreshQuarters` that wipes the user's selection on every CSV load — would punish the natural workflow of "load initiatives, pick quarters, then load epics" by forcing a re-pick after the second load.
- A `populate` that does *not* filter `defaultSelections` against the option list — would let a stale default end up in `selected` and produce a chip for a quarter the dropdown does not list, an inconsistency.
- An `extractQuarters` that uses `localeCompare` as the *only* comparator — would mis-order `Q2 2025` before `Q1 2026`. The `(year, quarter)` ordering is the contract.
- A `refreshQuarters` that dispatches `ms-change` itself — would double-fire on every CSV load (once from the loader's explicit `tryUpdatePreview`, once from this synthetic event), causing two re-paints per load.
- An `extractQuarters` that includes empty quarter strings — would surface a blank option in the dropdown, useless and confusing.
- A `populate` that appends to the existing option list rather than replacing it — would let stale options from a previous CSV persist after the new CSV's load.

### Forbidden shortcuts
- Do not derive the option list from a hard-coded calendar (e.g. `['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026', …]`). The data is the source of truth (see [ADR-0017](../adr/0017-multi-quarter-selectors.md)).
- Do not fetch the option list from a server. Client-side only ([ADR-0002](../adr/0002-client-side-only.md)).
- Do not lift the chronological sort comparator into a shared helper at this stage. The two call sites (`extractQuarters`, `refreshQuarters`) are short and self-explanatory; a shared helper would create a synchronisation hazard for what is currently a small literal duplication.
- Do not extend `populate` with an `options` parameter. The widget's API surface is intentionally small: option list + default selections.

### RED gate

On an un-implemented build:
- Manual step 1: loading the Initiatives CSV does not populate the dropdown — both selectors still show `Upload CSV to populate`.
- Manual step 4: after a CSV swap, the chip strip shows a stale quarter that is not in the new option list.
- Manual step 6: the option list is in CSV-row-order or alphabetical order, not chronological.

### Test immutability rule

Same as Phase 1: N/A in the current project.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-9 all pass.
- [ ] `extractQuarters` is pure and DOM-free.
- [ ] `refreshQuarters` is the single bridge between CSV loads and the widgets.
- [ ] The chronological sort produces `(year, quarter)` ordering for canonical labels and `localeCompare` ordering for non-canonical ones.
- [ ] The default fallback chain works as documented (`Q2 2026` / `Q3 2026` → first/second available).

---

## Phase 3: Selection editing via checkboxes and chip-removal, `ms-change` bubbling

### Acceptance behavior

Scenario AT-1: Checking a checkbox adds a chip and fires `ms-change`
Given `#hist-ms` is populated with `[Q1 2026, Q2 2026, Q3 2026]` and `selected = {Q2 2026}`
And the dropdown is open
When the user clicks the `Q3 2026` checkbox
Then `this.selected` becomes `{Q2 2026, Q3 2026}`
And the chip strip now contains two chips (in lexicographic order: `Q2 2026`, `Q3 2026`)
And one `ms-change` `CustomEvent` is dispatched on `#hist-ms` with `bubbles: true`
And the dropdown stays open

Scenario AT-2: Unchecking a checkbox removes the chip and fires `ms-change`
Given `selected = {Q2 2026, Q3 2026}`
And the dropdown of `#hist-ms` is open
When the user unchecks the `Q2 2026` checkbox
Then `this.selected` becomes `{Q3 2026}`
And the chip strip now contains only the `Q3 2026` chip
And one `ms-change` event is dispatched

Scenario AT-3: Clicking a chip's `✕` removes the quarter and fires `ms-change`
Given `selected = {Q1 2026, Q2 2026}` and the chip strip shows both
When the user clicks the `✕` on the `Q1 2026` chip
Then `this.selected` becomes `{Q2 2026}`
And the `Q1 2026` checkbox in the dropdown unchecks
And the chip strip now contains only the `Q2 2026` chip
And one `ms-change` event is dispatched
And the dropdown does not open (the `✕` click does *not* bubble to the trigger)

Scenario AT-4: Last chip's `✕` shows the post-load placeholder
Given `selected = {Q2 2026}` and one chip is rendered
When the user clicks that chip's `✕`
Then `selected` becomes `{}`
And the placeholder text `Select quarters…` is rendered in place of the chip strip
And one `ms-change` event is dispatched

Scenario AT-5: Chips are rendered in lexicographic order
Given the user clicks the `Q3 2026` checkbox, then `Q1 2026`, then `Q2 2026`
When the chip strip is re-rendered after each click
Then after the third click the chips are in the order `Q1 2026, Q2 2026, Q3 2026` (lexicographic), not `Q3 2026, Q1 2026, Q2 2026` (click order)

Scenario AT-6: `ms-change` is observed by the wired listeners
Given the wired listeners are attached: `hist-ms` → `tryUpdatePreview`, `target-ms` → `tryUpdatePreview`
When the user toggles any checkbox on `#hist-ms`
Then `tryUpdatePreview` is called
And the **Data preview** re-paints with the new historical-quarter list (provided all of its other preconditions hold)

Scenario AT-7: `getSelected` returns a snapshot, not a live view
Given `selected = {Q1 2026, Q2 2026}`
When the consumer calls `histMS.getSelected()` and then the user toggles `Q3 2026`
Then the consumer's array reference still has length 2 (the snapshot is not mutated by the later toggle)
And a fresh `histMS.getSelected()` call returns a length-3 array

Scenario AT-8: Selecting zero quarters is allowed at the widget level
Given the user has cleared all chips
When the consumer calls `histMS.getSelected()`
Then the returned array is `[]` (length 0)
And no exception is raised
And the downstream consumer's guard (`tryUpdatePreview`'s early return, the run-button handler's gate) is what decides whether to act on the empty selection

### Public entry point

In-code:
- The checkbox `change` handlers attached inside `_renderOptions` (`index.html:1110-1117`).
- The chip `✕` `click` handlers attached inside `_renderChips` (`index.html:1132-1138`).
- `getSelected()` (`index.html:1101`) — the read API.

UI: the dropdown's checkboxes and the chip strip's `✕` icons.

### Expected observable outcomes
- Every checkbox toggle and every chip `✕` click mutates the `selected` `Set` and re-renders the chip strip (and, for checkbox toggles inside `_renderChips`'s outer call site, the chip strip is the only re-render — the option list is left untouched).
- A single bubbling `ms-change` `CustomEvent` is dispatched per user gesture.
- Chips are rendered in lexicographic order; the dropdown's option list is in chronological order.
- `getSelected()` returns a fresh array (`[...this.selected]`) on every call.

### Test harness

Acceptance tests: manual.
- Manual steps:
  1. With both CSVs loaded, open `#hist-ms`. Check `Q3 2026`. Confirm AT-1 by inspecting `histMS.selected` and the chip strip in DevTools, and by attaching a temporary listener (`histMS.wrapper.addEventListener('ms-change', () => console.log('fired'))`) to count events.
  2. Uncheck `Q2 2026`. Confirm AT-2.
  3. With multiple chips visible, click an `✕`. Confirm AT-3 (and confirm the dropdown does not open by checking the `open` class).
  4. Click the last chip's `✕`. Confirm AT-4 (placeholder text reappears).
  5. Pick three quarters in non-sorted order. Confirm AT-5.
  6. Confirm the **Data preview** re-paints on every toggle (AT-6) — provided both CSVs are loaded and a target quarter is also selected.
  7. In DevTools console, capture `const snap = histMS.getSelected()`; toggle another quarter; confirm `snap` is unchanged (AT-7).
  8. Clear all chips; in DevTools console, confirm `histMS.getSelected() === []` (AT-8).

Inner tests:
- Location: N/A. If a harness is added, `getSelected` is trivial, and the checkbox/chip handlers are testable against a wrapper fixture by dispatching synthetic `change` and `click` events.

Verification: manual.

Fake-injection wiring: N/A. To exercise the handlers without UI gestures, dispatch `new Event('change')` on the relevant checkbox (or `new Event('click')` on the chip's `✕`) from the DevTools console.

### Proposed implementation seams

Stable seams a future test suite may target:
- The `ms-change` event contract: dispatched on the wrapper, bubbles, no `detail` payload, fires exactly once per user gesture.
- `getSelected()`: returns a snapshot array, not a reference to `this.selected`.
- The chronological-vs-lexicographic ordering split (dropdown chronological, chips lexicographic) — see [ADR-0017](../adr/0017-multi-quarter-selectors.md).

Do NOT lock in:
- The exact `<input type="checkbox">` markup. The widget could later use a styled `<div>` with `aria-checked` and produce the same observable contract.
- The `✕` glyph; could be a `<button>` with an icon font or SVG.
- The chip CSS classes (`ms-chip`, `ms-chip-x`); they are referenced by the JS but not by external consumers.
- The lexicographic chip order — purely cosmetic; could be changed to chronological or to insertion-order without breaking the read API.

### Behavioral rule

Every user gesture that changes the **Quarter selector**'s selection — clicking a checkbox in the dropdown, or clicking a chip's `✕` icon — mutates the widget's internal `selected` `Set`, re-renders the chip strip (and the option list when the dropdown is re-rendered), and dispatches a single bubbling `ms-change` `CustomEvent` on the wrapper. Consumers attach a listener to the wrapper and call `getSelected()` to read the current selection; the event carries no payload because the widget's `Set` is the canonical state.

### Invariants
- One user gesture (one checkbox toggle, or one chip-`✕` click) produces exactly one `ms-change` `CustomEvent` dispatch on the wrapper.
- Every `ms-change` dispatch is `bubbles: true` and has no `detail`.
- `getSelected()` returns a fresh array (different reference per call).
- The chip strip's order is lexicographic over `selected`; the dropdown's option order is chronological over `quarters`.
- The chip-`✕` click does not bubble to the trigger and does not open/close the dropdown.
- Mutating the array returned by `getSelected()` does not affect `this.selected`.

### Counterexamples (must NOT pass)
- A checkbox handler that calls `_renderOptions` (rebuilding the option list) on every check — would lose the dropdown's scroll position and risk re-binding listeners under the user's cursor.
- A chip `✕` handler that does not `stopPropagation` — would also toggle the dropdown open/closed on every chip removal.
- An `ms-change` event with `bubbles: false` — would break the existing wiring (`hist-ms.addEventListener('ms-change', ...)` works only because the event bubbles to the wrapper).
- An `ms-change` event with a `detail` payload — would invite consumers to read the payload instead of calling `getSelected()`, creating a second source of truth.
- A `getSelected()` that returns `this.selected` directly (a reference to the `Set`) — would let a careless consumer mutate the widget's internal state.
- A chip strip rendered in insertion order rather than sorted order — would produce a different visual layout per click sequence, distracting the user.
- A handler that opens the dropdown on every chip change — would force the user to close it manually after every selection edit.

### Forbidden shortcuts
- Do not pass the new selection as `event.detail`. The widget's `Set` is the canonical state; consumers read via `getSelected()`.
- Do not introduce a debounce on `ms-change`. The cost of `tryUpdatePreview` is trivially small; debouncing would add complexity and a "preview lags my click" UX bug for no benefit.
- Do not auto-close the dropdown on a checkbox click. The user typically picks multiple quarters in sequence; auto-closing would force a re-open after every pick.
- Do not introduce a "confirm selection" button at the bottom of the dropdown. Live `ms-change` dispatch is the documented contract; a confirm button would gate the **Data preview**'s repaint behind a second click.

### RED gate

On an un-implemented build:
- Manual step 1: toggling a checkbox does not change the chip strip and does not fire `ms-change` (no console log from the temporary listener).
- Manual step 3: clicking a chip's `✕` toggles the dropdown open (because `stopPropagation` is missing or the chip is a child of the trigger and the click bubbles).
- Manual step 5: chips are in click order, not lexicographic.

### Test immutability rule

Same as Phase 1: N/A in the current project.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-8 all pass.
- [ ] One user gesture → one `ms-change` dispatch (no double-fire, no skipped fire).
- [ ] The `ms-change` listener wiring at `index.html:3271-3272` produces a **Data preview** re-paint on every selection edit (provided the preview's other preconditions hold — see [feature 0009](./0009-sidebar-preview-and-reference-panels.md)).
- [ ] `getSelected()` returns a snapshot; mutating it does not affect the widget.
- [ ] `git diff` touches only `index.html` ([ADR-0001](../adr/0001-single-file-html-app.md)).
