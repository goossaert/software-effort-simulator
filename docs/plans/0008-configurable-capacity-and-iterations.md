# Feature: Configurable capacity and iterations + on-chart capacity line

Created at: 2026-05-21T00:00:00Z

## Context

This feature owns the two **Run knobs** the user touches between **Run**s and the visual cue that ties one of them — **Capacity** — back to the chart. Where [feature 0003](./0003-monte-carlo-simulation-engine.md) owns the engine and [feature 0004](./0004-moscow-three-scenario-forecasting.md) owns the three-Scenario orchestration, this feature owns the *inputs* those layers consume (`capacity`, `iterations`) and the *output annotation* that lets the user read overrun risk straight off the chart without leaving for the stats table.

The feature is deliberately narrow. It does not own the engine's iteration loop ([feature 0003](./0003-monte-carlo-simulation-engine.md)), the `Probability of exceedance` computation ([feature 0007](./0007-org-level-summary-statistics-table.md)), the **Risk tier** colouring ([feature 0013](../adr/0013-three-tier-risk-colouring.md)), or the general marker-add/edit dialog ([feature 0017](../../backtracked-features.md#0017) — which arrived later and absorbed the capacity-line drawing into a unified marker store while leaving the *auto-management* contract of this feature intact). What it owns is: (a) the two sidebar `<input type="number">` controls and the run-button-handler clamps that turn raw input strings into the numeric arguments `runSimulation` reads, and (b) the `ensureCapacityMarker(contextKey, capacityValue)` helper that guarantees a single, label-`Capacity`, red, `isCapacity: true` entry exists in the marker store for every rendered chart context — so the user always sees a labelled red dashed line at the configured PM number, even if they have never touched the marker dialog.

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). The two inputs are inline `<input>` elements; the handler reads them with `document.getElementById`. No form library.
- [ADR-0002 — Client-side only, no backend](../adr/0002-client-side-only.md). Capacity is *not* fetched from a team-roster API; it is whatever the user types.
- [ADR-0006 — Monte Carlo with bootstrapped historical sizes](../adr/0006-monte-carlo-with-bootstrapped-sizes.md). The iterations knob is the precision dial on the empirical distribution this ADR produces.
- [ADR-0010 — Three-scenario MoSCoW forecasting](../adr/0010-three-scenario-moscow-forecasting.md). The same `capacity` value is compared against all three **Scenarios**; there is no per-Scenario capacity.
- [ADR-0011 — Overlapping bar histograms with shared bins and P99.5 outlier clipping](../adr/0011-overlapping-histograms-shared-bins.md). The capacity line is drawn on top of the chart this ADR specifies; the line shares the chart's `(globalMin, globalMax)` x-axis range.
- [ADR-0012 — Five-point tail-percentile summary with probability-of-exceedance](../adr/0012-percentile-summary-and-probability-of-exceedance.md). The capacity number is the threshold the table's `P(effort > capacity)` row is computed against.
- [ADR-0013 — Three-tier risk colouring at 25% / 50% cuts](../adr/0013-three-tier-risk-colouring.md). The colour grading on the capacity row keys off this feature's `capacity` value.
- [ADR-0014 — Capacity and iterations as user-configured per-Run inputs](../adr/0014-capacity-and-iterations-as-run-inputs.md). The architectural decision for the *shape* of these knobs (numeric inputs, no presets, no derivation from team-roster data).
- [ADR-0015 — Capacity rendered as an auto-managed chart marker](../adr/0015-capacity-as-auto-managed-chart-marker.md). The architectural decision for *how* the capacity number is visualised on the chart and why it shares its rendering path with the general marker system.

Glossary terms used below: **Capacity**, **Iteration**, **Run**, **Person-month (PM)**, **Scenario**, **Probability of exceedance**, **Risk tier**, **Global histogram range**, **Marker** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user who opens `index.html` sees two numeric fields in the sidebar below the **Target Quarter(s)** selector:

- **Quarterly Capacity (person-months)** — single line, value `120` pre-filled, `min="1"` and `step="1"` enforced by the browser. The label is verbatim `Quarterly Capacity (person-months)` so the unit (**PM**) is unambiguous at the point of entry.
- **Iterations** — single line, value `10000` pre-filled, `min="1000"` / `max="10000000"` / `step="1000"`. The label is the unadorned word `Iterations`; the *unit-less* nature of the field is intentional (an **Iteration** is one Monte Carlo draw, not a PM value).

Neither input has a slider, a preset list, a tooltip, or an inline validation hint. The browser-supplied number stepper is the entire UX. If the user types a non-numeric value (or leaves the field empty) the field shows the browser's native invalid state on focus loss, but the **Run Simulation** button does *not* become disabled — instead, the run-button handler falls back to the defaults (capacity `120`, iterations `1000000` for an empty/NaN `Iterations` field; iterations are then clamped to `[1000, 10000000]`). This is a deliberate "no dead-end" UX: a slightly-off input still produces a Run, and the user can correct the value and re-run.

When the user presses **Run Simulation**, the on-chart histogram appears with a **red dashed vertical line** at the x-coordinate corresponding to the typed capacity (in PM). Above the line, a small red pill displays the literal text `Capacity: {capacity} PM` (e.g. `Capacity: 120 PM`). The line spans from below the label pill down to the chart's bottom axis. If the capacity sits outside the chart's clipped x-range (the **Global histogram range**, which is `[fixedEffort, max(P99.5(MS), P99.5(M), P99.5(MSC), fixedEffort+1)]`), the line and pill are clamped to the chart edge — the user still sees *that there is a capacity line*, even when the configured number is far below or far above the simulated distribution. The same red dashed line also appears on each per-team chart in the **Team Level** tab ([feature 0011](../../backtracked-features.md#0011)) at the *same* PM number — capacity is global to the **Run**, not per-team.

Re-running with the same inputs reproduces the line at the same x-coordinate. Editing the capacity field and re-running moves the line to the new x-coordinate without any other chart change (subject to the small Monte Carlo noise in the bar shapes themselves; see [ADR-0009](../adr/0009-custom-seeded-prng.md)). Clicking on the dashed line (within a 10 px hit-target — feature 0017's hit detector) opens the marker-edit dialog with the capacity marker selected; the user can change its colour or label there, but the *value* is auto-synced to the sidebar `#capacity` field on the next Run (`ensureCapacityMarker` overwrites `cap.value`). The user *cannot* delete the capacity marker from the dialog ([feature 0017](../../backtracked-features.md#0017)'s delete button is hidden when `isCapacity === true`).

There is no user-visible failure path at this layer. A capacity of `0` produces a line at the chart's left edge and a stats-table row tinted red (`pExceed === 1.0` strictly exceeds `0` for any non-zero iteration). A capacity above the chart's clipped range produces a clamped line at the right edge and a green-tinted stats row (`pExceed` close to `0` because almost no Iteration exceeds the configured PM). Iterations below `1000` are clamped up to `1000`; above `10000000` are clamped down — no exception, no modal.

## Scope

### In scope
- The two `<input type="number">` controls in the sidebar markup (`index.html:897-905`): `#capacity` (default `120`, `min="1"`, `step="1"`) and `#iterations` (default `10000`, `min="1000"`, `max="10000000"`, `step="1000"`).
- The two `<label>` elements with their verbatim user-facing text: `Quarterly Capacity (person-months)` and `Iterations`.
- The run-button handler's read-and-clamp logic at the top of the click handler (`index.html:3310-3312`):
  ```js
  const capacity = parseFloat(document.getElementById('capacity').value) || 120;
  const iters    = Math.min(10000000, Math.max(1000,
                    parseInt(document.getElementById('iterations').value) || 1000000));
  ```
  The `|| 120` and `|| 1000000` fall-throughs are the empty/NaN fallback; the `Math.min` / `Math.max` is the clamp.
- The `ensureCapacityMarker(contextKey, capacityValue)` helper (`index.html:2986-2994`): given a context key (`'org'` or `'team-{idx}'`) and a numeric capacity, either updates the existing `isCapacity` marker's `value` field or creates a fresh one with `{ id: 'cap-{contextKey}', label: 'Capacity', value: capacityValue, color: '#ef4444', isCapacity: true }`.
- The single call site of `ensureCapacityMarker` in the org-level chart wrapper `renderChart` (`index.html:2348`) — and the equivalent call site for per-team charts in `renderTeamCharts` (feature 0011), which this feature documents but does not own the team-tab orchestration of.
- The `isCapacity: true` flag's *contract*: feature 0017's marker dialog reads it to (a) hide the delete button and (b) optionally restyle the dialog. This feature owns *only* the contract that the flag exists and is `true` for the capacity marker; the dialog's read of it belongs to feature 0017.

### Out of scope
- The general marker store (`markerStore`, `getMarkers`), the marker-add/edit dialog, the 80-colour palette, the label-pill collision avoidance, click-to-edit hit-detection, marker CSV save/load. All [feature 0017](../../backtracked-features.md#0017). This feature predates 0017 but its current implementation *delegates* to 0017's rendering and dialog; the boundary is `ensureCapacityMarker` — this feature ensures the marker exists; 0017 draws and edits it.
- The `markersPlugin` `afterDraw` body that actually draws the line and pill on the canvas (`index.html:2174-2243`). Feature 0017.
- The `Probability of exceedance` computation against capacity (`computePExceed`, the inline binary search in `computeStats`). [Feature 0007](./0007-org-level-summary-statistics-table.md).
- The capacity row's **Risk tier** colour ([ADR-0013](../adr/0013-three-tier-risk-colouring.md)) and the capacity row's label (`P(effort > {capacity} PM)`, rendered in `renderStatsTableInto`, `index.html:2396`). Feature 0007.
- The engine's iteration loop. [Feature 0003](./0003-monte-carlo-simulation-engine.md). This feature only *supplies* the `iterations` argument.
- The per-team capacity application. [Feature 0011](../../backtracked-features.md#0011) re-uses the *same* capacity value for every team chart (there is no per-team capacity field) and calls `ensureCapacityMarker('team-{idx}', capacity)` for each.
- The **Team Projections** quick-Monte-Carlo iteration count (capped at `Math.min(iters, 3000)` in `index.html:3357`). [Feature 0012](../../backtracked-features.md#0012) reads `iters` from the same input but applies its own cap; this feature does not own that cap.
- Any future per-team capacity override, per-Scenario capacity, capacity-vs-headcount derivation, or unit toggle (PM ↔ FTE-months). [ADR-0014](../adr/0014-capacity-and-iterations-as-run-inputs.md) defers all of these.

## Relevant existing files
Claude may inspect:
- `index.html`, specifically:
  - The sidebar inputs (`index.html:897-905`).
  - The run-button handler's read-and-clamp block (`index.html:3303-3312`) and the immediately-following `runSimulation` call (`index.html:3344`).
  - `ensureCapacityMarker` (`index.html:2986-2994`) and the surrounding marker-state declarations (`markerStore`, `index.html:2975`).
  - `renderChart` (`index.html:2347-2351`) — the single call site of `ensureCapacityMarker` for the org chart.
  - `renderTeamCharts` (`index.html:2445`) and `renderTeamSection` — they re-invoke `ensureCapacityMarker` for per-team contexts.
- `CONTEXT.md` glossary, especially the **Planning vocabulary** group (**Capacity**, **Iteration**, **Run**), the **Summary statistics** group's **Probability of exceedance** entry (which reads the capacity number), and the **Visualisation** group's **Global histogram range** entry (whose x-range the capacity line is drawn into).
- ADRs 0010, 0011, 0012, 0013, 0014, and 0015 for the constraints this feature must respect.

Claude should not inspect unless needed:
- The CSV parsing / column detection blocks — unrelated to the Run knobs.
- The Monte Carlo samplers (`samplePoisson`, `sampleLognormal`, the PRNG) — this feature passes them an iteration count, nothing more.
- The marker-dialog body (`openMarkerDialog`, `handleMarkerSave`), the colour palette grid, the marker CSV save/load — feature 0017.
- The Team Projections matrix — feature 0012; it uses the same `iters` input but applies its own cap.

## Existing patterns to follow
- **Layering inside `index.html`**: the two inputs live in the sidebar markup (Module 1-equivalent — the static HTML head). The read-and-clamp block lives in the run-button handler (Module 7 — UI wiring). `ensureCapacityMarker` lives in Module 7's helper section alongside `getMarkers` and `computePExceed`. The capacity *value* is plumbed as a function argument (`runSimulation({ ..., capacity })`, `renderChart(results, capacity)`, `ensureCapacityMarker(contextKey, capacityValue)`) — there is *no* module-scoped `currentCapacity` global. The single source of truth is the live `#capacity` input value at the moment **Run** is pressed.
- **Read-once-per-Run**: the `#capacity` and `#iterations` inputs are read *once*, at the top of the run-button handler. After that point, no consumer reads them again — they receive the value via function argument. This matches the **Run** boundary defined in [CONTEXT.md](../../CONTEXT.md) (a Run is one press of the button) and means mid-Run edits to the sidebar have no effect on the in-flight Run; they take effect on the *next* press.
- **Default-then-clamp**: `parseFloat(x) || default` handles the empty/NaN case; `Math.min(max, Math.max(min, n))` handles the out-of-range case. The two steps are kept distinct because their semantics are distinct: the first is "what to use when the field is unparseable" (fallback), the second is "what to use when the field is parseable but extreme" (clamp). Combining them into one expression would obscure that distinction.
- **Capacity is not derivable**: there is no "auto-compute capacity from team headcount and quarter length" path. The user types the PM number. See [ADR-0014](../adr/0014-capacity-and-iterations-as-run-inputs.md) for why.
- **One capacity, all charts**: every chart in a Run (org chart + per-team charts) shows the same capacity line at the same PM number. `ensureCapacityMarker` is called once per chart context with the *same* `capacityValue` argument from the same single read of `#capacity`. The capacity is a global per-Run knob, not a per-context one.
- **Auto-management, not creation**: `ensureCapacityMarker` is *idempotent*. Calling it twice with the same `contextKey` and the same `capacityValue` is a no-op (the first call creates, the second updates a field to the same value). Calling it with a different `capacityValue` updates `cap.value` in place — preserving the user's edits to `cap.color` and `cap.label` (if any) from the marker dialog. The user can recolour the line to bright yellow from the dialog and a re-Run will keep that yellow line — only the `value` is overwritten.
- **`isCapacity: true` is the protected-marker flag**: feature 0017's dialog reads this to gate the delete button. The flag is `true` only on the capacity marker — there is no other code path that sets it.
- **No framework, no library**: vanilla `document.getElementById`, vanilla `<input type="number">`. No form library, no validator, no controlled-component pattern.
- **Verification command**: there is no automated test harness in this project. Verification is manual: open `index.html` in a browser (`open index.html` on macOS), edit the two inputs, load known-good CSVs, press Run, and inspect the resulting chart and stats table.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer — this is a client-side-only app (ADR-0002). In-memory state read and produced by this feature:

```js
// Read from the DOM at the top of the run-button handler (the start of a Run).
const capacity   = parseFloat(document.getElementById('capacity').value)   || 120;        // PM
const iterations = Math.min(10000000, Math.max(1000,
                     parseInt(document.getElementById('iterations').value) || 1000000));   // unitless

// Owned by feature 0017, but this feature reads/writes the isCapacity entry.
// One entry per chart context. The Capacity entry is guaranteed to exist after
// renderChart / renderTeamSection.
const markerStore = {
  'org':        [ /* ..., */ { id: 'cap-org',     label: 'Capacity', value: capacity, color: '#ef4444', isCapacity: true } ],
  'team-0':     [ /* ..., */ { id: 'cap-team-0',  label: 'Capacity', value: capacity, color: '#ef4444', isCapacity: true } ],
  'team-1':     [ /* ..., */ { id: 'cap-team-1',  label: 'Capacity', value: capacity, color: '#ef4444', isCapacity: true } ],
  // ...
};
```

Field contract for the capacity marker entry:
- `id`: the string `'cap-' + contextKey`. Unique within `markerStore` because `contextKey` is unique per chart context.
- `label`: the literal string `'Capacity'`. Editable from the dialog (feature 0017) but reset to `'Capacity'` is *not* enforced — if the user renames it, the rename persists across Runs.
- `value`: the PM number from `#capacity`. *Always* overwritten by `ensureCapacityMarker` on every Run (this is the auto-management part). User edits to `value` from the dialog do not survive a Run.
- `color`: default `'#ef4444'` (red). Editable from the dialog and the user's colour choice persists across Runs.
- `isCapacity`: the boolean flag `true`. Set on creation; not modified by any code path after that.

There is no module-scoped state owned by this feature beyond what lives in `markerStore[contextKey]` (which is owned by [feature 0017](../../backtracked-features.md#0017)). The `<input>` elements' `value` attributes are the single source of truth between Runs.

---

## Phase 1: Sidebar inputs and the run-button read-and-clamp

### Acceptance behavior

Scenario AT-1: Default values render on first paint
Given the page has just loaded (no user interaction)
When the user looks at the sidebar
Then `#capacity` shows `120` with the label `Quarterly Capacity (person-months)`
And `#iterations` shows `10000` with the label `Iterations`
And both fields are `<input type="number">` with the documented `min` / `max` / `step` attributes:
  - `#capacity`: `min="1"`, `step="1"`, no `max`
  - `#iterations`: `min="1000"`, `max="10000000"`, `step="1000"`

Scenario AT-2: Typed values flow into `runSimulation`
Given the user has loaded both CSVs and picked valid quarters
And the user has edited `#capacity` to `200` and `#iterations` to `50000`
When the user presses **Run Simulation**
Then `runSimulation` is called with `capacity: 200` and `iterations: 50000`
And the engine produces a sorted `Float64Array` of length `50000` per **Scenario**
And the stats table's bottom row label reads `P(effort > 200 PM)`

Scenario AT-3: Empty `#capacity` falls back to `120`
Given the user has cleared the `#capacity` field (its value is the empty string)
When the user presses **Run Simulation**
Then `runSimulation` is called with `capacity: 120` (the documented default)
And no exception is thrown
And the stats table's bottom row label reads `P(effort > 120 PM)`

Scenario AT-4: Empty `#iterations` falls back to `1000000`
Given the user has cleared the `#iterations` field
When the user presses **Run Simulation**
Then `runSimulation` is called with `iterations: 1000000`
(Note: this fallback differs from the *placeholder* default of `10000` — the placeholder is the value shipped in the HTML attribute; the *handler* fallback for an empty field is `1000000`. Documented in the run-button handler at `index.html:3311-3312`.)

Scenario AT-5: Out-of-range `#iterations` is clamped
Given the user has typed `100` (below `min`) into `#iterations`
When the user presses **Run Simulation**
Then `runSimulation` is called with `iterations: 1000`
Given the user has typed `99999999` (above `max`) into `#iterations`
When the user presses **Run Simulation**
Then `runSimulation` is called with `iterations: 10000000`

Scenario AT-6: Non-numeric `#capacity` falls back to `120`
Given the user has typed `abc` into `#capacity`
When the user presses **Run Simulation**
Then `runSimulation` is called with `capacity: 120`
(The browser's number input typically prevents `abc` from sticking; the fallback exists for paste-through and locale-edge cases.)

Scenario AT-7: Reading happens once at Run start
Given the user has typed `200` into `#capacity` and pressed **Run Simulation**
When the run-button click handler is mid-execution and the user edits `#capacity` to `500` *before* `runSimulation` returns
Then the in-flight Run completes with `capacity: 200` (the value at click time)
And the chart and table reflect `capacity: 200`
And only the *next* press of **Run Simulation** picks up `500`
(This is the **Run** boundary from [CONTEXT.md](../../CONTEXT.md): mid-Run sidebar edits do not affect the in-flight Run.)

Scenario AT-8: Capacity is the same for org and team charts
Given the user has typed `150` into `#capacity` and pressed **Run Simulation**
When all charts render
Then the org chart's capacity marker's `value` is `150`
And every team chart's capacity marker's `value` is also `150`
(There is no per-team capacity input.)

### Public entry point

In-code: the two `<input>` elements (`index.html:899` and `index.html:904`) and the read-and-clamp block at the top of the run-button click handler (`index.html:3310-3312`). There is no exported function; the inputs are read inline.

UI: the two sidebar fields. Labels: `Quarterly Capacity (person-months)` and `Iterations`.

### Expected observable outcomes
- The two `<input>` elements exist with the documented attributes.
- `parseFloat(document.getElementById('capacity').value) || 120` and `Math.min(10000000, Math.max(1000, parseInt(document.getElementById('iterations').value) || 1000000))` are the *only* read paths for the capacity and iteration values.
- The same `capacity` value is passed to `runSimulation`, `renderChart`, `renderStatsTable`, `renderTeamCharts`, and `buildTeamProjections` within a single Run.
- The same `iters` value is passed to `runSimulation` and (capped at 3000) to `buildTeamProjections`.
- No global mutable state stores the capacity or iteration value between Runs — the `<input>` `value` attribute is the source of truth.

### Test harness

Acceptance tests:
- Location: **N/A — this project has no automated test suite.** Manual acceptance is performed in the browser, with optional DevTools inspection.
- Manual steps:
  1. Open `index.html`. Confirm the two fields render with their defaults (`120` and `10000`) and their labels (AT-1).
  2. In DevTools, inspect each `<input>`'s `min`, `max`, `step` attributes against AT-1's spec.
  3. Load known-good CSVs, pick quarters, edit `#capacity` to `200`, edit `#iterations` to `50000`, press Run. Open DevTools and inspect the stats table's last-row label: it should read `P(effort > 200 PM)`. The chart's capacity-line pill should read `Capacity: 200 PM` (Phase 2 manual check).
  4. Clear `#capacity` (select all, delete), press Run. Confirm the table's last-row label reads `P(effort > 120 PM)` (AT-3).
  5. Clear `#iterations`, press Run. Confirm the engine runs `1000000` iterations (slow but completes — count via the chart's overall bar-count sum which should be `~ 1,000,000` per Scenario), per AT-4.
  6. Type `100` into `#iterations`, press Run. Open DevTools and inspect the engine's invocation (the `iters` value passed in `runSimulation({..., iterations: iters})`) — it should be clamped to `1000`. The fastest visible check: the engine completes near-instantly and the chart renders with visibly noisier bars than a `10000`-iter Run (AT-5).
  7. Type `99999999` into `#iterations`, press Run. Confirm the clamp to `10000000` by observing the Run takes the same time as the upper-bound case (AT-5).
  8. Set `#capacity` to `200`, press Run. *During* the Run (the spinner is visible), edit `#capacity` to `500` and wait for the Run to complete. Confirm the chart and table show `200`, not `500` (AT-7). Press Run again — now `500` takes effect.
  9. With a multi-team CSV loaded, set `#capacity` to `150`, press Run. Switch to the Team Level tab. Confirm every team chart's capacity-line pill reads `Capacity: 150 PM` (AT-8).

Inner tests:
- Location: **N/A — no test harness.** If a harness is added, the read-and-clamp expression is trivially testable as a pure function once extracted.

Verification:
- Manual: walk the steps above. The values are observable in (a) the stats-table last-row label, (b) the capacity-line pill on the chart, and (c) the spinner timing for the iteration count.

Fake-injection wiring:
- N/A. The inputs are read from the live DOM; the test seam is setting `<input>.value` before the click.

### Proposed implementation seams

Stable seams a future test suite may target:
- The two `<input>` elements (`#capacity`, `#iterations`) — their `id`, `type`, and the documented `min`/`max`/`step` attributes.
- The read-and-clamp expressions, if extracted into named helpers (`readCapacity()`, `readIterations()`). Currently inline; extracting them would not change semantics.

Do NOT lock in:
- The exact default values (`120` for capacity, `10000` placeholder / `1000000` empty-fallback for iterations). The *fact* that there are defaults and clamps is load-bearing; the *specific numbers* are calibration knobs and may be tuned. See [ADR-0014](../adr/0014-capacity-and-iterations-as-run-inputs.md) for the rationale.
- The clamp range `[1000, 10000000]` for iterations — same as above. See [ADR-0014](../adr/0014-capacity-and-iterations-as-run-inputs.md).
- The discrepancy between the HTML `value="10000"` placeholder and the handler's `|| 1000000` empty-fallback — this is a quirk worth preserving for backward-compatible behaviour but is not architecturally meaningful. Aligning them would not require an ADR re-open.

### Behavioral rule

The two sidebar inputs `#capacity` and `#iterations` are the user-supplied **Run knobs**. They are read *once* per **Run**, at the top of the run-button handler, and passed by value into every downstream consumer (`runSimulation`, `renderChart`, `renderStatsTable`, `renderTeamCharts`, `buildTeamProjections`). Empty or NaN values fall back to documented defaults; out-of-range iterations are clamped to `[1000, 10000000]`. There is no module-scoped global that stores the last-read value — the `<input>.value` attribute is the source of truth between Runs.

### Invariants
- `#capacity` and `#iterations` exist in the DOM at all times after page load; their `id`, `type`, `min`, `max`, `step` are exactly as documented.
- The run-button handler reads each input *exactly once* per click (no re-reads inside `setTimeout` body or downstream calls).
- The capacity value passed to `runSimulation`, `renderChart`, `renderStatsTable`, `renderTeamCharts`, and `buildTeamProjections` within one Run is byte-identical (same `parseFloat` result).
- The iterations value passed to `runSimulation` is byte-identical to the value computed by the read-and-clamp expression; the value passed to `buildTeamProjections` is `Math.min(iters, 3000)`.
- `capacity > 0` for every Run that completes (the `|| 120` fallback guarantees a positive default; the input's `min="1"` discourages negative entries).
- `iterations >= 1000 && iterations <= 10000000` for every Run that completes (the `Math.min/Math.max` clamp guarantees this).
- Editing the inputs mid-Run does not affect the in-flight Run.

### Counterexamples (must NOT pass)
- A handler that re-reads `#capacity` inside `runSimulation`'s `setTimeout` callback — would silently let a mid-Run edit change the in-flight `capacity`, contradicting the **Run** boundary in [CONTEXT.md](../../CONTEXT.md) and producing a chart whose capacity line and stats-table row disagree if the edit lands between the two renders.
- A handler that uses `Number(x)` (which returns `NaN` for empty string) and *passes the `NaN`* into `runSimulation` — would produce `NaN` for `pExceed` and `NaN%` in the table. The `|| 120` fallback is the documented guard.
- A handler that skips the clamp and accepts the raw `parseInt` result — would let a typo of `100000000000` (eleven digits) pass into `runSimulation`, hanging the engine for minutes. The `Math.min(10000000, ...)` is the cap.
- A handler that uses `parseInt(capacity)` instead of `parseFloat(capacity)` — would silently truncate `120.5` to `120`, and a user who typed `0.5` would get `0`. The capacity is allowed to be a non-integer PM number.
- A storage of `capacity` in a module-scoped global between Runs — would let a stale value survive after the user edits the input and re-runs, if any code path reads the global instead of the latest `#capacity.value`. The plumb-by-argument pattern is the prevention.
- A per-team `<input>` capacity field — would break the "one capacity, all charts" rule and would force every team table's `P(effort > capacity)` row to be read against a different threshold, defeating the comparability that the **Team Level** tab exists for.

### Forbidden shortcuts
- Do not derive capacity from team-roster data (e.g. "team-size × quarter-weeks × utilisation"). [ADR-0014](../adr/0014-capacity-and-iterations-as-run-inputs.md) explicitly defers this.
- Do not add a presets dropdown (e.g. `Small / Medium / Large team`). The numeric input is the documented surface; a preset would either require a roster source (ADR-0014 defers) or invite stale presets that no longer match reality.
- Do not add a slider for iterations. A slider would hide the exact value the user is running and make it harder to bisect "what changed between two Runs" — the precision is the point of the field.
- Do not add inline validation toast / alert dialogs. The fallback-then-clamp pattern is the validation; surfacing it as a toast would noise up the happy path.
- Do not migrate to a form library (React Hook Form, Formik). Vanilla DOM read is one line; a library would be a strict regression on [ADR-0001](../adr/0001-single-file-html-app.md).
- Do not couple the iterations clamp to the team-projection cap (3000). The org-level Run uses the full clamped `iters`; the team-projection path applies its own `Math.min(iters, 3000)` for its own reasons (a side-quest, not a contract — [feature 0012](../../backtracked-features.md#0012)).

### RED gate

On an un-implemented build (e.g. the two `<input>` elements are missing or the read-and-clamp block is stubbed to `capacity = 0, iters = 0`):
- Manual step 1: the sidebar shows no fields (or fields without labels).
- Manual step 3: pressing Run throws (`runSimulation({iterations: 0})` would loop zero times and produce empty `Float64Array`s — chart renders flat).
- Manual step 6: typing `100` into `#iterations` produces the same all-flat chart, proving the clamp is not wired.

### Test immutability rule

There are no test files to freeze in this project (manual harness). If a test suite is later introduced and Phase 1's acceptance steps are codified, those tests live under `tests/unit/` and are off-limits to the implementation session — only the test-writing session may edit them.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-8 all pass.
- [ ] The two `<input>` elements render with the documented `id`, `type`, `min`, `max`, `step`.
- [ ] The read-and-clamp block is the *only* read path for these two values; no other code reads `#capacity` or `#iterations` directly.
- [ ] `capacity` and `iters` flow through `runSimulation`, `renderChart`, `renderStatsTable`, `renderTeamCharts`, and `buildTeamProjections` as function arguments — no global storage.
- [ ] Mid-Run sidebar edits do not affect the in-flight Run (verified by AT-7).
- [ ] `git diff` touches only `index.html` (ADR-0001).

---

## Phase 2: Auto-managed on-chart capacity marker — `ensureCapacityMarker`

### Acceptance behavior

Scenario AT-1: First Run on a fresh page creates the org-context capacity marker
Given the page has just loaded (no Runs yet)
And `markerStore['org']` is `undefined` (no markers have been added)
When the user presses **Run Simulation** with `#capacity` showing `120`
Then `renderChart` calls `ensureCapacityMarker('org', 120)`
And `markerStore['org']` is now `[{ id: 'cap-org', label: 'Capacity', value: 120, color: '#ef4444', isCapacity: true }]`
And the chart shows a red dashed vertical line at `x = 120` (or clamped to the chart edge if `120` falls outside `[globalMin, globalMax]`)
And the line's pill reads `Capacity: 120 PM`

Scenario AT-2: Re-Run updates the capacity marker's value in place
Given a Run has completed and `markerStore['org']` contains the capacity marker with `value === 120`
And the user has edited `#capacity` to `200`
When the user presses **Run Simulation** again
Then `markerStore['org']`'s capacity marker has `value === 200`
And `markerStore['org']` still has exactly one entry with `isCapacity === true`
And the marker's `id`, `label`, `color`, and `isCapacity` fields are unchanged from the previous Run
(The function *updates* `cap.value` in place; it does not push a second capacity marker.)

Scenario AT-3: User-recoloured capacity marker preserves colour across Runs
Given a Run has completed and the user has opened the marker dialog on the capacity marker and changed its colour to `#facc15` (yellow)
When the user presses **Run Simulation** again
Then the capacity marker's `color` remains `#facc15`
And the capacity marker's `value` is overwritten with the current `#capacity` field value
And the chart shows a yellow dashed line at the new capacity x-coordinate

Scenario AT-4: Per-team charts each get their own capacity marker
Given the user has a multi-team CSV loaded and presses **Run Simulation** with `#capacity` showing `150`
When `renderTeamCharts` iterates over the team list
Then for each team index `i`, `ensureCapacityMarker('team-{i}', 150)` is called
And `markerStore['team-0']`, `markerStore['team-1']`, … each contain a capacity marker with `value === 150` and `id === 'cap-team-{i}'`
And every team chart shows the same red dashed line at the same PM number

Scenario AT-5: `isCapacity: true` is set on creation
Given a fresh page load
When `ensureCapacityMarker('org', 120)` runs for the first time
Then the marker entry pushed into `markerStore['org']` has `isCapacity === true`
(This flag is the contract [feature 0017](../../backtracked-features.md#0017) reads to hide the delete button in the marker dialog. This feature owns the flag's *presence*; 0017 owns its *consumption*.)

Scenario AT-6: Idempotence — calling with the same value twice is a no-op on the second call
Given `markerStore['org']` contains the capacity marker with `value === 120`
When `ensureCapacityMarker('org', 120)` is called again (without a state change in between)
Then `markerStore['org']` is unchanged in length
And the capacity marker's fields are byte-identical to before the call

Scenario AT-7: Capacity marker is the first marker in a fresh context
Given `markerStore['org']` is `undefined`
When `ensureCapacityMarker('org', 120)` is called
Then `markerStore['org']` is exactly `[capacityMarker]` (length 1)
(Subsequent feature 0017 additions append to this array; the *initial* capacity marker is the first entry.)

Scenario AT-8: Clicking the capacity line opens the marker dialog
Given the chart has rendered with the capacity marker at `x = 120`
When the user clicks within 10 px of the capacity line on the chart
Then `openMarkerDialog('org', 'cap-org')` is called by feature 0017's click handler
And the dialog opens with the capacity marker selected
(This is verified as a Phase 2 acceptance because the clickability depends on `id === 'cap-org'` matching the hit-test in feature 0017's canvas click listener.)

### Public entry point

In-code: `ensureCapacityMarker(contextKey, capacityValue)` (`index.html:2986-2994`). Called from:
- `renderChart` (`index.html:2348`) — once per org-level Run.
- `renderTeamSection` and `renderTeamCharts` (feature 0011) — once per team chart per Run.

UI: the red dashed vertical line and the `Capacity: {value} PM` pill above it, drawn by [feature 0017](../../backtracked-features.md#0017)'s `markersPlugin` on each chart canvas. This feature is *not* the drawing path; it is the data-population path that guarantees the drawing path has something to draw.

### Expected observable outcomes
- After every successful `renderChart(results, capacity)` call, `markerStore['org']` contains exactly one entry with `isCapacity === true` and `value === capacity`.
- After every successful `renderTeamSection(team, idx, ...)` call (feature 0011), `markerStore['team-{idx}']` contains exactly one entry with `isCapacity === true` and `value === capacity`.
- The capacity marker's `id` is the literal string `'cap-' + contextKey` (e.g. `'cap-org'`, `'cap-team-2'`).
- The capacity marker's `label` is `'Capacity'` on first creation; the user can rename it from the marker dialog and the rename persists across Runs (because `ensureCapacityMarker` only overwrites `value`).
- The capacity marker's `color` is `'#ef4444'` (red) on first creation; the user can recolour it from the dialog and the recolour persists across Runs.
- The capacity marker's `value` is overwritten on *every* call to `ensureCapacityMarker` (no debounce, no diffing).
- `ensureCapacityMarker` does *not* call into the rendering layer; it only mutates the marker store. The next render call ([feature 0017](../../backtracked-features.md#0017)'s `markersPlugin` `afterDraw`) reads the updated store.

### Test harness

Acceptance tests:
- Location: **N/A — manual.** Same rationale as Phase 1.
- Manual steps:
  1. Open `index.html` on a fresh page (or reload). In DevTools console, before pressing Run: `markerStore.org` should be `undefined`.
  2. Load CSVs, pick quarters, leave `#capacity` at `120`, press Run. In console: `markerStore.org` is `[{ id: 'cap-org', label: 'Capacity', value: 120, color: '#ef4444', isCapacity: true }]` (AT-1).
  3. Visually confirm the chart shows a red dashed vertical line and a `Capacity: 120 PM` pill above it.
  4. Edit `#capacity` to `200`, press Run. Confirm `markerStore.org[0].value === 200`, the marker count is still 1, and the line has moved (AT-2).
  5. Open the marker dialog on the capacity marker (click within 10 px of the line). Change its colour to a non-red value (e.g. yellow). OK. Confirm the line is now yellow. Press Run again with `#capacity` still at `200`. Confirm the line is *still* yellow and the value is still `200` (AT-3).
  6. With a multi-team CSV loaded, set `#capacity` to `150`, press Run, switch to Team Level tab. In console: `Object.keys(markerStore)` should include `'org'` and one `'team-{i}'` per team. Each team context's capacity marker should have `value === 150` and the matching `id` (AT-4).
  7. In console: `markerStore.org.find(m => m.isCapacity).id === 'cap-org'` returns `true` (AT-5).
  8. Confirm AT-6 by adding a no-op extra call in DevTools: `ensureCapacityMarker('org', markerStore.org[0].value); markerStore.org.length` — still `1`.
  9. With a Run rendered, click within 10 px of the capacity line. Confirm the marker dialog opens with the capacity marker pre-selected (AT-8).
 10. In the marker dialog opened in step 9, confirm the delete button is hidden (feature 0017's gate on `isCapacity === true`).

Inner tests:
- Location: **N/A.** If a harness is added, `ensureCapacityMarker` is a pure function of its arguments and the `markerStore` global; it is trivially testable with an injected store.

Verification:
- Manual: open `index.html` and walk the steps above. `ensureCapacityMarker` is module-scoped and reachable from the DevTools console.

Fake-injection wiring:
- N/A. To exercise the helper, call it directly from the console with a hand-crafted `contextKey` and value.

### Proposed implementation seams

Stable seams a future test suite may target:
- `ensureCapacityMarker(contextKey, capacityValue) → void` — pure on `markerStore`, idempotent on equal-value calls.
- The capacity marker's *invariant fields* (`id`, `isCapacity`) — set once on creation, never overwritten.
- The capacity marker's *auto-managed field* (`value`) — overwritten on every call.
- The capacity marker's *user-editable fields* (`label`, `color`) — set on creation, preserved across calls.

Do NOT lock in:
- The default colour `'#ef4444'` — see [ADR-0015](../adr/0015-capacity-as-auto-managed-chart-marker.md). Red is the documented signal for "this is the budget line"; the *exact* shade is a knob.
- The default label `'Capacity'` — the contract is that the label is human-readable and references the **Capacity** glossary term; the exact English string is mutable.
- The id prefix `'cap-'` — the contract is that the capacity marker has a *deterministic* id, distinct from any user-added marker's id; the prefix string is a convention.

### Behavioral rule

The capacity marker is *auto-managed*: `ensureCapacityMarker(contextKey, capacityValue)` guarantees that `markerStore[contextKey]` contains *exactly one* entry with `isCapacity === true`, with that entry's `value` field synced to the supplied `capacityValue`. It is called on every Run for every chart context. The user-editable fields (`label`, `color`) and the protected metadata (`id`, `isCapacity`) are set on first creation and preserved across subsequent Runs; only `value` is overwritten. The function does not call into the rendering layer — the next chart render reads the updated store via [feature 0017](../../backtracked-features.md#0017)'s `markersPlugin`.

### Invariants
- After any `ensureCapacityMarker(contextKey, v)` call, `markerStore[contextKey]` contains *exactly one* entry where `isCapacity === true`.
- That entry's `value` is exactly `v` (no rounding, no clamping inside the helper).
- That entry's `id` is exactly `'cap-' + contextKey` (set on creation, never overwritten).
- That entry's `isCapacity` is exactly `true` (set on creation, never overwritten).
- Calling `ensureCapacityMarker(contextKey, v)` twice with the same arguments back-to-back is a no-op on the second call (idempotence on equal-value calls; the second call updates `value` to the same value).
- `markerStore[contextKey]`'s length does not decrease as a result of any `ensureCapacityMarker` call.
- The user's edits to `cap.label` and `cap.color` (via [feature 0017](../../backtracked-features.md#0017)'s dialog) survive subsequent `ensureCapacityMarker` calls.
- The user's edits to `cap.value` (via the dialog) do *not* survive — the next Run overwrites them with the current `#capacity` field value.

### Counterexamples (must NOT pass)
- A `ensureCapacityMarker` that always *pushes* a new entry (no `find` step) — would accumulate duplicate capacity markers, one per Run, eventually painting many overlapping lines and breaking the "one capacity per chart" contract.
- A `ensureCapacityMarker` that overwrites `label`, `color`, or `id` on every call — would silently revert the user's dialog edits to colour and label on every Run, frustrating the user who tried to recolour the line.
- A `ensureCapacityMarker` that *also* triggers a re-render — would couple the data-population path to the rendering path and would re-render twice per Run (once for `ensureCapacityMarker`, once for the orchestrating `renderChart`). The data-then-render separation is intentional.
- A `ensureCapacityMarker` without the `isCapacity` flag — would let [feature 0017](../../backtracked-features.md#0017)'s dialog treat the capacity marker as a regular marker, exposing a delete button that, if clicked, would remove the capacity line. The user would then be unable to recover the line without inspecting the source.
- A `ensureCapacityMarker` that reads `#capacity` directly instead of accepting a `capacityValue` argument — would couple the helper to the DOM and break the "read once at Run start" contract from Phase 1.
- A `ensureCapacityMarker` that lives inside `renderChartOnCanvas` rather than as a top-level helper — would re-tangle the data-population and rendering paths.
- A capacity marker stored at module scope (e.g. `let capacityMarker = null`) rather than inside `markerStore[contextKey]` — would force [feature 0017](../../backtracked-features.md#0017)'s plugin to special-case the capacity line outside its marker store, defeating the unification [ADR-0015](../adr/0015-capacity-as-auto-managed-chart-marker.md) commits to.

### Forbidden shortcuts
- Do not draw the capacity line directly from this feature (e.g. a separate `afterDraw` hook just for capacity). [ADR-0015](../adr/0015-capacity-as-auto-managed-chart-marker.md) commits the line to the unified marker rendering path. The pre-0017 implementation did this; the current implementation explicitly does not.
- Do not store the capacity line's pixel position; recompute it from `value`, `globalMin`, `globalMax` at draw time. [Feature 0017](../../backtracked-features.md#0017)'s plugin already does this; do not duplicate the math here.
- Do not expose a `removeCapacityMarker` function. The capacity marker is *always present* on every chart; removal is not a legal state.
- Do not introduce a `setCapacityColor` or `setCapacityLabel` helper. The dialog (feature 0017) is the user surface for those edits; this feature owns only the auto-managed `value`.
- Do not memoise on `(contextKey, capacityValue)` — the store mutation is the *purpose* of the call; a memo would skip it on equal-value re-entries and break the *guarantee* of "exactly one capacity marker exists after this call".

### RED gate

On an un-implemented build (e.g. `ensureCapacityMarker` is a stub that returns immediately):
- Manual step 2: `markerStore.org` is `undefined` after pressing Run (or empty if [feature 0017](../../backtracked-features.md#0017)'s click handler has populated it).
- Manual step 3: the chart shows no capacity line and no pill.
- Manual step 9: clicking where the capacity line would be opens no dialog.

### Test immutability rule

Same as Phase 1: N/A in the current project. If tests are added later, they're off-limits to the implementation session.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-8 all pass.
- [ ] `ensureCapacityMarker` is the *only* writer of any marker entry with `isCapacity === true`.
- [ ] Every chart render (`renderChart`, `renderTeamSection`) invokes `ensureCapacityMarker(contextKey, capacity)` before constructing the Chart.js instance — verified by tracing the call order in `index.html`.
- [ ] User edits to `label` and `color` survive subsequent Runs; user edits to `value` do not.
- [ ] The capacity marker is always renderable by [feature 0017](../../backtracked-features.md#0017)'s `markersPlugin` without any special-casing — the marker is just an entry in the store with an extra `isCapacity` flag.
- [ ] `git diff` touches only `index.html` (ADR-0001).
