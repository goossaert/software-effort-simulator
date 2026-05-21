# Feature: Org-level overlapping histogram chart

Created at: 2026-05-21T00:00:00Z

## Context

This feature is the *primary visual surface* of the simulator: the chart the user looks at when **Run Simulation** finishes. It sits between the orchestrator [feature 0004 — MoSCoW three-scenario forecasting](./0004-moscow-three-scenario-forecasting.md) (which produces three sorted `Float64Array` distributions, one per **Scenario**) and the stats table [feature 0007](../../backtracked-features.md#0007) (which reads the same distributions for percentile and `P(effort > capacity)` lookup). This feature owns the *bins* (the histogram tuple per Scenario), the *shared edges* across the three Scenarios (the **Global histogram range**), and the *Chart.js rendering* that overlays them onto a single canvas (`#results-chart`).

The feature is deliberately narrow: it does not own the capacity line ([feature 0008](../../backtracked-features.md#0008) — added shortly after), the custom marker system ([feature 0017](../../backtracked-features.md#0017) — added much later and absorbing the capacity line into a unified marker store), the per-team chart re-use ([feature 0011](../../backtracked-features.md#0011)), or the stats table layout (feature 0007). What it owns is the *shape* of the chart — three overlapping bar datasets on shared bins, with the x-axis clipped at P99.5 of the three Scenarios — which every downstream consumer assumes.

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). Chart.js is loaded from CDN; there is no module system to hold a chart wrapper.
- [ADR-0002 — Client-side only, no backend](../adr/0002-client-side-only.md). Rendering is on-page; no server-side image generation.
- [ADR-0006 — Monte Carlo with bootstrapped historical sizes](../adr/0006-monte-carlo-with-bootstrapped-sizes.md). The sorted distributions this feature bins are the engine's output; the chart is the empirical-distribution view the user reads back.
- [ADR-0007 — Lognormal effort distribution](../adr/0007-lognormal-effort-distribution.md). Right-skewed lognormal tails are why the x-axis clip exists.
- [ADR-0010 — Three-scenario MoSCoW forecasting](../adr/0010-three-scenario-moscow-forecasting.md). The number three is load-bearing here: three datasets, three legend entries, three colour channels.
- [ADR-0011 — Overlapping bar histograms with shared bins and P99.5 outlier clipping](../adr/0011-overlapping-histograms-shared-bins.md). The architectural decision this feature implements.

Glossary terms used below: **Scenario**, **Run**, **Iteration**, **Person-month (PM)**, **Histogram**, **Bin**, **Global histogram range**, **Outlier clip**, **Constant work** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user who has loaded both CSVs, picked a **Historical quarter** and a **Target quarter**, and pressed **Run Simulation** sees a single bar chart appear in the main pane within a second (at the default 10,000 **Iterations** on a typical laptop). The chart has three coloured datasets overlaid on the same x-axis:

- **Must Only** — orange (`rgba(234, 124, 44, 0.58)`), drawn on top
- **Must + Should** — indigo (`rgba(79, 70, 229, 0.52)`)
- **Must + Should + Could** — green (`rgba(5, 150, 105, 0.42)`), drawn underneath

The y-axis is *simulation count* (number of Iterations falling in each **Bin**); the x-axis is *total effort* in **person-months**. Hovering a bar shows a tooltip with the bin's approximate centre (`Effort ≈ X.X PM`) and the count for the hovered dataset (`{scenarioName}: {count} runs`). The legend at the top toggles dataset visibility.

When the user re-runs with the same inputs, the chart shape is *visibly similar but not byte-identical* because the **Run** is re-seeded from wall-clock time (see [ADR-0009](../adr/0009-custom-seeded-prng.md) and feature [0003](./0003-monte-carlo-simulation-engine.md)). When the user changes the **Target quarter** to a plan with only Must initiatives, all three datasets overlap perfectly (because Must + Should = Must Only = Must + Should + Could in that case) — the chart shows one visible coloured stack at the orange position, not an error.

There is no user-visible failure path at this layer: an empty plan (`kMust = kMustShould = kMustShouldCould = 0`) renders three Histograms whose counts are all-zero — the chart shows axes with no visible bars, which is the honest answer to "what is the effort of an empty plan", not a defect. A non-finite value in a distribution (which would only happen if a sampler upstream returned `NaN`/`Infinity` — see feature 0003's invariants forbidding that) would surface as a bar at index 0 with count = `iterations`, not as a thrown error; this is the documented failure mode of `buildHistogram` in the degenerate case.

## Scope

### In scope
- `buildHistogram(sorted, globalMin, globalMax, numBins)` (`index.html:2072`): turns one sorted `Float64Array` into `{ counts, binCenters, binWidth }`. Bin edges are derived from `globalMin` / `globalMax` / `numBins`; values outside `[globalMin, globalMax]` are clamped into the first or last Bin.
- The shared `globalMin` / `globalMax` computation in `runSimulation` (`index.html:2115-2118`): `globalMin = fixedEffort`; `globalMax = max(P99.5(MS), P99.5(M), P99.5(MSC), fixedEffort + 1)`.
- The fixed bin count `NUM_BINS = 60` (`index.html:2120`).
- `renderChartOnCanvas(canvasId, results, capacity, contextKey)` (`index.html:2159`): the Chart.js wrapper that draws three overlapping bar datasets on the named canvas using the `results` payload from `runSimulation`. *Context-key* and the marker-plugin hook are present in the signature but the marker behaviour itself is feature 0017 — see Out of scope.
- `renderChart(results, capacity)` (`index.html:2347`): the org-level convenience wrapper that targets `#results-chart`, destroys the previous Chart instance (single-instance `chartInstance` module variable), and re-renders with `contextKey = 'org'`.
- The Chart.js configuration: `type: 'bar'`, `options.grouped: false` (the overlay behaviour), `barPercentage: 1.0`, `categoryPercentage: 1.0`, dataset `order` 1/2/3 so Must Only is on top, axis titles, tooltip callbacks, `responsive: true`, `maintainAspectRatio: false`, `animation.duration: 350`.
- The single instance tracking: a module-scoped `chartInstance` variable that is destroyed (`chartInstance.destroy()`) before each new Run to avoid Chart.js memory leaks.

### Out of scope
- The capacity line on the chart. That is [feature 0008](../../backtracked-features.md#0008), added shortly after and later absorbed into the unified marker system ([feature 0017](../../backtracked-features.md#0017)). The `markersPlugin` `afterDraw` hook present in `renderChartOnCanvas` today is feature 0017's surface; this feature only commits to "the plugin slot exists" — not to what it draws.
- The custom marker system (add/edit/delete, palette, label-pill collision avoidance, marker CSV save/load). Feature 0017.
- The per-team chart instances (`teamChartInstances` array, `renderTeamSection`, `renderTeamCharts`). Feature 0011 — it *re-uses* `renderChartOnCanvas` with a different canvas and context key, but does not change this feature's contract.
- The Team Projections P25/P50/P75 bar chart and the stacked MoSCoW count chart. Feature 0012.
- The org-level stats table (`renderStatsTableInto`, `renderStatsTable`). Feature 0007 — it reads the same `sorted` arrays but does not touch the chart.
- The MoSCoW orchestration that produces the three `Float64Array`s (`runSimulation`, `prepareSimulationData`). Feature 0004 — this feature consumes its output payload.
- The Monte Carlo engine itself (`runScenario`, the samplers, the PRNG). Feature 0003.
- Any future "small multiples" toggle, density-plot mode, configurable bin count, or configurable clip percentile. ADR-0011 explicitly defers all four.

## Relevant existing files
Claude may inspect:
- `index.html`, specifically:
  - `buildHistogram` (`index.html:2072-2081`).
  - `runSimulation` (`index.html:2086-2141`) — *for context only*; only the `globalMin` / `globalMax` / `NUM_BINS` block (`index.html:2115-2120`) is in this feature's scope. The orchestration shape and `fixedEffort` shift are feature 0004 / 0015.
  - `renderChartOnCanvas` (`index.html:2159-2344`) — particularly the dataset definitions (`index.html:2249-2278`), the `scales` block (`index.html:2298-2315`), the `tooltip` callbacks (`index.html:2291-2296`), and the `chartInstance` destroy/recreate pattern in `renderChart` (`index.html:2347-2351`).
  - The `#results-chart` canvas element in the markup.
- `CONTEXT.md` glossary, especially the **Visualisation** group (**Histogram**, **Bin**, **Global histogram range**, **Outlier clip**).
- ADRs 0006, 0010, and 0011 for the constraints this feature must respect.

Claude should not inspect unless needed:
- The CSV parsing / column detection blocks — upstream and produce the inputs `runSimulation` reads.
- The marker code (`markersPlugin` body past the dataset block, `openMarkerDialog`, `saveMarkersToCSV`, etc.) — that is feature 0017 and is conceptually layered *on top of* this feature.
- The Team Level / Team Projections sections — they call `renderChartOnCanvas` but do not change its contract.

## Existing patterns to follow
- **Layering inside `index.html`**: `buildHistogram` and the `globalMin`/`globalMax` block live in Module 5 (engine) next to `runSimulation`. `renderChartOnCanvas` and `renderChart` live in Module 6 (chart & stats rendering). Module 6 reads from Module 5's output payload; Module 5 must never reach into Module 6 to call rendering.
- **Single chart instance per canvas**: there is at most one Chart.js instance per canvas at any time. Before each new render, the previous instance is destroyed via `chartInstance.destroy()` (or, for team charts, `teamChartInstances[idx].destroy()`). Skipping the destroy step leaks the previous instance's listeners and is a documented Chart.js antipattern.
- **`buildHistogram` is pure**: it takes a sorted `Float64Array`, a `(globalMin, globalMax)`, and a bin count, and returns a fresh `{ counts, binCenters, binWidth }` object. It does not read globals, does not call into Chart.js, and does not mutate its `sorted` argument.
- **Shared Global histogram range**: `globalMin` / `globalMax` are computed *once* per Run, in `runSimulation`, *before* the per-Scenario `buildHistogram` calls. Every Scenario binned in this Run uses the *same* `(globalMin, globalMax, NUM_BINS)` triple. There is no per-Scenario range.
- **`globalMin = fixedEffort`**: the lower bound is the constant-work shift, not `0`. When there is no constant work, `fixedEffort = 0` and the two coincide. Do not hard-code `0` as the lower bound — it would silently break the **Constant work** view (feature 0015).
- **`globalMax = max(P99.5 of each Scenario, globalMin + 1)`**: the `+ 1` floor prevents a degenerate all-zeros distribution from collapsing into `globalMax == globalMin` and producing a `binWidth` of `0`. `buildHistogram` has a separate `|| 1` guard for the same case; both are intentional belt-and-braces.
- **Out-of-range values are clamped**: `buildHistogram`'s assignment is `idx = Math.min(numBins - 1, Math.max(0, Math.floor((v - globalMin) / binWidth)))`. Values above `globalMax` land in the last Bin (which is what makes P99.5 clipping a *display* decision, not a data loss — the upper tail's mass is still counted, just into the last bin). Values below `globalMin` land in the first Bin (relevant only in pathological cases, since the engine guarantees non-negative outputs).
- **`Float64Array.sort()` is numeric by default**: the upstream `sorted` argument is a sorted `Float64Array` from `runScenario` (feature 0003). `buildHistogram` does *not* re-sort and does *not* re-validate ordering. The P99.5 lookup `arr[Math.floor(0.995 * arr.length)]` relies on the sorted contract.
- **Chart.js options are inlined, not extracted to a config object**: the bar styling, axis titles, tooltip callbacks, legend layout, and animation duration all live in the `new Chart(...)` call. This is intentional — see ADR-0001's "no abstractions" tone. Do not extract a `ChartOptions` builder or a `defaultChartConfig` constant.
- **`order` controls z-order in the overlay**: lower `order` draws on top. Must Only is `order: 1`, Must + Should is `order: 2`, Must + Should + Could is `order: 3`. This is the reason the orange (smallest scenario, drawn on top) is visible at all when the three distributions overlap.
- **No framework, no library beyond Chart.js**: vanilla DOM. No React, no D3, no canvas-only renderer. Chart.js is loaded from CDN; this feature does not pin a specific minor version (the CDN URL is in the head).
- **Verification command**: there is no automated test harness in this project. Verification is manual: open `index.html` in a browser (`open index.html` on macOS), load known-good CSVs, press Run, and inspect the chart against expectations.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer — this is a client-side-only app (ADR-0002). In-memory state read and produced by this feature:

```js
// Read-only inputs from feature 0004 (runSimulation output payload)
const results = {
  mustOnly:        { sorted: Float64Array, stats: { p10, p25, p50, p75, p90, mean, pExceed }, hist: { counts, binCenters, binWidth } },
  mustShould:      { sorted: Float64Array, stats: ..., hist: ... },
  mustShouldCould: { sorted: Float64Array, stats: ..., hist: ... },
  globalMin:       Number,   // = fixedEffort (the constant-work shift)
  globalMax:       Number,   // = max(P99.5(MS), P99.5(M), P99.5(MSC), globalMin + 1)
  fixedEffort:     Number,   // pass-through; equals globalMin
};

// Produced by buildHistogram
{
  counts:     number[],   // length === NUM_BINS (60); integer counts per Bin
  binCenters: number[],   // length === NUM_BINS; PM at the midpoint of each Bin
  binWidth:   number,     // (globalMax - globalMin) / NUM_BINS, with a `|| 1` guard
}

// Module-scoped single-instance tracking
let chartInstance = null;   // current Chart.js instance on #results-chart, or null
```

The `Histogram` tuple is *not* keyed; consumers read `counts`, `binCenters`, `binWidth` by name. `counts.length === binCenters.length === NUM_BINS` is an invariant.

The `chartInstance` is the *only* place a reference to the current Chart.js instance lives. Every render path goes `destroy → new Chart()` and reassigns `chartInstance`. Per-team rendering uses a parallel `teamChartInstances: Chart[]` array (feature 0011), which is owned by that feature, not this one.

---

## Phase 1: Histogram binning and the shared Global histogram range

### Acceptance behavior

Scenario AT-1: `buildHistogram` produces the expected bin shape
Given a sorted `Float64Array` `dist` of 10,000 values drawn from `Lognormal(0.75, 0.27)` (the M-size synthetic distribution), with `globalMin = 0`, `globalMax = 10`, `numBins = 60`
When `buildHistogram(dist, 0, 10, 60)` is called
Then the return value has `counts.length === 60`, `binCenters.length === 60`, and `binWidth === 10/60 ≈ 0.1667`
And `binCenters[0] === 0 + 0.5 * binWidth` (the centre of the first Bin)
And `binCenters[59] === 0 + 59.5 * binWidth`
And `counts.reduce((a, b) => a + b) === 10000` (every Iteration is counted exactly once)
And every `counts[i]` is a non-negative integer

Scenario AT-2: Values above `globalMax` clamp into the last Bin
Given a sorted `Float64Array` `dist = [0, 1, 2, 50, 100]`, `globalMin = 0`, `globalMax = 10`, `numBins = 10`
When `buildHistogram(dist, 0, 10, 10)` is called
Then `counts[9]` (the last Bin) is exactly `2` — the values `50` and `100` both clamped in
And `counts.reduce((a, b) => a + b) === 5` (no value is dropped)
(This is the load-bearing behaviour that makes **Outlier clip** a display decision, not data loss.)

Scenario AT-3: Degenerate range produces a non-fatal histogram
Given a sorted `Float64Array` `dist = [0, 0, 0]`, `globalMin = 0`, `globalMax = 0`, `numBins = 60`
When `buildHistogram(dist, 0, 0, 60)` is called
Then `binWidth === 1` (the `|| 1` guard kicks in)
And `counts[0] === 3` and all other `counts[i] === 0`
And no exception is thrown and no `NaN` appears anywhere in the output

Scenario AT-4: `Global histogram range` is shared across all three Scenarios
Given a Run whose three Scenarios have sorted distributions `S_M`, `S_MS`, `S_MSC` with P99.5s of `120`, `180`, `240` PM respectively, and `fixedEffort = 0`
When `runSimulation(...)` completes
Then `results.globalMin === 0` and `results.globalMax === 240`
And `results.mustOnly.hist.binWidth === results.mustShould.hist.binWidth === results.mustShouldCould.hist.binWidth`
And the three `binCenters` arrays are byte-identical (same range, same bin count)

Scenario AT-5: `globalMin` follows the constant-work shift
Given a Run whose `fixedEffort === 30` PM and whose three Scenarios' P99.5s (after shift) are `150`, `210`, `270`
When `runSimulation(...)` completes
Then `results.globalMin === 30` (not `0`)
And `results.globalMax === 270`
And the first Bin's centre is `30 + 0.5 * binWidth`, not `0.5 * binWidth`

Scenario AT-6: `globalMax` has a `+1` floor for degenerate plans
Given a Run whose `kMust = kMustShould = kMustShouldCould = 0` (empty plan) and `fixedEffort = 0`
When `runSimulation(...)` completes
Then every Scenario's `sorted` is the all-zeros `Float64Array(iterations)`
And every Scenario's P99.5 is `0`
And `results.globalMax === 1` (because `max(0, 0, 0, 0 + 1) === 1`)
And the resulting Histogram has `counts[0] === iterations` and all other bins are `0`
(This is what makes the empty-plan case render as "axes with no visible bars" rather than throwing on `binWidth === 0`.)

Scenario AT-7: `buildHistogram` does not mutate its input
Given any sorted `Float64Array` `dist`
And a snapshot copy `pre = new Float64Array(dist)`
When `buildHistogram(dist, globalMin, globalMax, numBins)` is called
Then `dist` is element-wise equal to `pre`

### Public entry point

In-code: `buildHistogram(sorted, globalMin, globalMax, numBins)` (`index.html:2072`) and the four-line `globalMin` / `globalMax` / `NUM_BINS` block inside `runSimulation` (`index.html:2115-2120`). Called once per Scenario per Run (three times for the org-level Run; once per Scenario per team for team-level Runs in feature 0011).

UI: none directly; the Bins it produces become Chart.js dataset `data` in Phase 2.

### Expected observable outcomes
- `buildHistogram(sorted, globalMin, globalMax, NUM_BINS)` returns an object with `counts.length === NUM_BINS`, `binCenters.length === NUM_BINS`, and `binWidth === (globalMax - globalMin) / NUM_BINS` (or `1` when the range is degenerate).
- `counts.reduce((a, b) => a + b) === sorted.length` for every call — every Iteration lands in exactly one Bin.
- `binCenters[i] === globalMin + (i + 0.5) * binWidth` exactly.
- Values in `sorted` above `globalMax` are clamped into the last Bin; values below `globalMin` (not expected to occur — the engine guarantees non-negative output) are clamped into the first Bin.
- `results.globalMin` equals `fixedEffort` after `runSimulation`. `results.globalMax` equals `max(p995(shiftedMS), p995(shiftedM), p995(shiftedMSC), fixedEffort + 1)`.
- The three Scenarios' `hist.binWidth` are byte-identical for a given Run.
- No console output unless the upstream samplers warn (e.g. unknown size labels — feature 0003's behaviour, not this feature's).

### Test harness

Acceptance tests:
- Location: **N/A — this project has no automated test suite.** Manual acceptance is performed via the DevTools console after opening `index.html`.
- Manual steps:
  1. Open `index.html` and load known-good CSVs. Press **Run Simulation**.
  2. In DevTools console, inspect `results.mustOnly.hist` (the org Run's result object is held by the rendering path; rebuild via `runSimulation({...})` directly if needed). Confirm `counts.length === 60`, `binCenters.length === 60`, and `counts.reduce((a,b)=>a+b) === iterations` (default 10,000).
  3. Confirm `results.mustOnly.hist.binWidth === results.mustShould.hist.binWidth === results.mustShouldCould.hist.binWidth`.
  4. Confirm `results.globalMin === fixedEffort` and `results.globalMax >= results.mustShouldCould.stats.p90` (P99.5 ≥ P90).
  5. From the same console, call `buildHistogram(new Float64Array([0,1,2,50,100]), 0, 10, 10)` and confirm `counts[9] === 2` (the 50 and 100 clamped in) and `counts.reduce((a,b)=>a+b) === 5`.
  6. Call `buildHistogram(new Float64Array([0,0,0]), 0, 0, 60)` and confirm `binWidth === 1`, `counts[0] === 3`, and no `NaN` in the output.
  7. Load an Initiatives CSV with no in-scope initiatives in the **Target quarter** (e.g. all `Won't`). Press Run. Confirm the chart renders empty axes and that `results.globalMax === 1`.
  8. Load a **Constant Work CSV** that contributes `fixedEffort = 30` (feature 0015). Press Run. Confirm `results.globalMin === 30` and the first Bin's centre is `30 + 0.5 * binWidth`.

Inner tests:
- Location: **N/A — no test harness.** `buildHistogram` is a pure function and would be trivially fuzzable if a harness were added.

Verification:
- Manual: walk the DevTools console steps above after opening `index.html`. `buildHistogram` is module-scoped and reachable directly from the console.

Fake-injection wiring:
- N/A. `buildHistogram` is a pure function of its four arguments; the test seam is "call it with hand-crafted inputs."

### Proposed implementation seams

Stable seams a future test suite may target:
- `buildHistogram(sorted, globalMin, globalMax, numBins) → { counts, binCenters, binWidth }` — pure, deterministic, no globals.
- The `globalMin` / `globalMax` computation in `runSimulation` — could be extracted to a `computeGlobalRange(scenarios, fixedEffort)` helper without changing semantics, but is currently inline.

Do NOT lock in:
- The exact bin count `60` — it is a hand-tuned compromise and is allowed to be revisited (see ADR-0011's "future revision" note). The shape `numBins === 60` is the *current* commitment, not an invariant.
- The `Outlier clip` percentile `0.995` — same as above. The fact that the chart x-axis is clipped is load-bearing; the *specific* percentile is a knob ADR-0011 owns.
- The `|| 1` guard's specific value — any non-zero finite fallback would do; `1` happens to be the value that keeps the empty-plan Histogram visible at all.

### Behavioral rule

The histogram binning layer turns a sorted distribution of per-**Iteration** total efforts into a fixed-size frequency table over a shared **Global histogram range**. Values are counted into Bins of equal width; values outside the range clamp into the nearest end Bin so that the upper-tail clip is a *display* decision, not data loss. The Global histogram range is computed once per **Run** from the three Scenarios' **Outlier clip** points and the **Constant work** shift; all three Scenarios in the Run bin against that same range.

### Invariants
- `buildHistogram(sorted, gMin, gMax, n).counts.length === n` and `.binCenters.length === n` for all valid inputs.
- `counts.reduce((a, b) => a + b) === sorted.length` (no Iteration is lost; clamped values are still counted into the end Bins).
- `binCenters[i] === gMin + (i + 0.5) * binWidth` exactly.
- `binWidth === (gMax - gMin) / n` when `gMax > gMin`; `binWidth === 1` when `gMax === gMin` (the `|| 1` guard).
- The three Scenarios in a Run share identical `binWidth` and identical `binCenters` arrays.
- `results.globalMin === results.fixedEffort` after `runSimulation`.
- `results.globalMax >= results.globalMin + 1` always (the floor guarantees this).
- `buildHistogram` does not mutate its `sorted` argument.

### Counterexamples (must NOT pass)
- A `buildHistogram` that drops out-of-range values (`if (v < gMin || v > gMax) continue`) — would silently lose the upper-tail mass, making the count totals differ across Scenarios and breaking the comparability promise of ADR-0011.
- A `buildHistogram` that computes its own `globalMax = Math.max(...sorted)` — would produce *per-Scenario* bin grids and destroy the cross-Scenario comparability that is the entire point of the overlay.
- A `globalMin` hard-coded to `0` — would shift the **Constant work** Run's first Bin to `0.5 * binWidth` instead of `fixedEffort + 0.5 * binWidth`, wasting half the x-axis on empty space and misleading the reader about where the distribution starts.
- A `globalMax` without the `+ 1` floor — would set `binWidth = 0` in the empty-plan case, divide by zero in the bin-assignment formula, and produce `NaN` indices. The `|| 1` guard in `buildHistogram` is the second line of defence; both are intentional.
- A `Scenario`-specific bin count (e.g. `Math.ceil(Math.sqrt(sorted.length))` à la Sturges) — would re-introduce the differently-binned-histograms problem ADR-0011 explicitly rejects.
- A `buildHistogram` that returns a `Float64Array` for `counts` — Chart.js expects a plain `Array` (or `number[]`) for dataset `data`; using a typed array works in current Chart.js versions but is undocumented and brittle.

### Forbidden shortcuts
- Do not import a stats library (jStat, simple-statistics, math.js) for percentile / binning helpers. The two relevant operations — sorted-array P99.5 lookup and equal-width binning — are one line each.
- Do not pre-sort `sorted` inside `buildHistogram` "just to be safe". The input is already sorted (contract of `runScenario`, feature 0003); re-sorting would be a 60-Bin × N-Iteration redundancy that scales linearly with the iteration knob.
- Do not memoise the histogram per `(sorted, gMin, gMax, n)` tuple. Every Run produces a fresh distribution; the memo would never hit.
- Do not move the `globalMin` / `globalMax` computation into Phase 2 (the renderer). The values are part of the **runSimulation** payload and are *also* read by feature 0007's stats table and feature 0017's marker hit-test; centralising them in the engine layer is intentional.

### RED gate

On an un-implemented build (e.g. `buildHistogram` is a stub returning `{ counts: new Array(60).fill(0), binCenters: new Array(60).fill(0), binWidth: 1 }`):
- Manual step 2 (count sum): `counts.reduce((a,b)=>a+b)` is `0`, not `iterations`.
- Manual step 5 (clamp test): `counts[9]` is `0`, not `2`.
- Manual step 7 (empty plan): no observable difference from a populated plan (both produce all-zero counts), proving the engine path is not actually wired.

### Test immutability rule

There are no test files to freeze in this project (manual harness). If a test suite is later introduced and Phase 1's acceptance steps are codified, those tests live under `tests/unit/` and are off-limits to the implementation session — only the test-writing session may edit them.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-7 all pass via the DevTools console.
- [ ] `buildHistogram` is the *only* binning callable; no other code path in `index.html` computes per-Bin counts.
- [ ] `globalMin` / `globalMax` are computed exactly once per Run and read unchanged by all three Scenarios.
- [ ] `Outlier clip` is honoured: values above `globalMax` clamp into the last Bin and are not dropped.
- [ ] `git diff` touches only `index.html` (ADR-0001).

---

## Phase 2: Chart.js rendering of three overlapping bar datasets

### Acceptance behavior

Scenario AT-1: First Run renders three overlaid bar datasets
Given the user has just loaded both CSVs and picked valid quarters
When the user presses **Run Simulation** for the first time
Then a single Chart.js bar chart appears on `#results-chart`
And the chart has exactly three datasets, labelled **Must Only**, **Must + Should**, **Must + Should + Could**
And the datasets are drawn overlaid (not grouped side-by-side) — i.e. each Bin shows three coloured bars stacked at the same x position, with semi-transparent fills so the underlying datasets are visible
And the y-axis title is `Simulation count`
And the x-axis title is `Total Effort (person-months)`
And `chartInstance` is non-null and is a Chart.js instance

Scenario AT-2: Second Run destroys the first instance before re-rendering
Given the user has just completed a Run (so `chartInstance` is non-null)
When the user presses **Run Simulation** again
Then `chartInstance.destroy()` is called on the previous instance before the new `new Chart(...)` call
And only one Chart.js instance exists on `#results-chart` at any time (verifiable via DevTools: `Chart.getChart(canvas)` returns a single instance)

Scenario AT-3: All three datasets share x-axis bin centres
Given a Run has produced `results` with `results.mustOnly.hist.binCenters` and `results.mustShould.hist.binCenters` and `results.mustShouldCould.hist.binCenters`
When the chart is rendered
Then the chart's `labels` array is exactly one of those `binCenters` arrays formatted to 2 dp
(Because the three `binCenters` arrays are identical per Phase 1's invariant, the choice of "which Scenario's binCenters" is arbitrary — the renderer uses `mustShould`.)

Scenario AT-4: Dataset z-order puts Must Only on top
Given a rendered chart
When the user inspects the three datasets via DevTools
Then the dataset with `label === 'Must Only'` has `order === 1`
And `Must + Should` has `order === 2`
And `Must + Should + Could` has `order === 3`
(Chart.js draws *lower* `order` values *on top*. Must Only being on top is what makes the smallest scenario's coloured bars visible above the larger ones.)

Scenario AT-5: Tooltip shows bin centre and dataset count
Given a rendered chart
When the user hovers a bar
Then the tooltip title reads `Effort ≈ {binCenter} PM` (one decimal place)
And the tooltip body reads `{datasetLabel}: {count.toLocaleString()} runs`

Scenario AT-6: Empty plan renders without throwing
Given a Run where every Scenario's `sorted` is all-zeros (empty in-scope plan)
When the chart is rendered
Then no exception is thrown
And the chart renders axes with the y-axis starting at `0` and the x-axis covering `[0, 1]` (per Phase 1 AT-6)
And every dataset's `data` array has length 60 with one large value at index 0 and zeros elsewhere

Scenario AT-7: Re-render after marker edit re-uses the cached render state
Given a Run has rendered the chart and `lastRenderState['org']` has been populated by `renderChartOnCanvas`
When a downstream marker-edit path (feature 0017) calls `renderChartOnCanvas('results-chart', cachedResults, cachedCapacity, 'org')` again
Then the chart re-renders with the same three datasets and the same `(globalMin, globalMax)` axis range
(This feature owns the cache-write side of `lastRenderState[contextKey]`; the cache-read side is feature 0017.)

### Public entry point

In-code:
- `renderChart(results, capacity)` (`index.html:2347`) — the org-level wrapper, called from the run-button click handler in Module 7.
- `renderChartOnCanvas(canvasId, results, capacity, contextKey)` (`index.html:2159`) — the underlying renderer, also called from `renderTeamSection` (feature 0011).

UI: the user-visible chart at `#results-chart` in the main pane.

### Expected observable outcomes
- A Chart.js `bar` chart on `#results-chart` with `grouped: false` (the overlay behaviour) and three datasets.
- Single-instance discipline: `chartInstance` is the only reference to the current org chart; previous instances are destroyed before re-rendering.
- The three datasets' `data` arrays are `results.mustOnly.hist.counts`, `results.mustShould.hist.counts`, `results.mustShouldCould.hist.counts` respectively — passed by reference, not deep-copied.
- The chart's `labels` are the shared `binCenters` formatted to 2 decimal places (the renderer uses `mustShould.hist.binCenters`).
- Dataset colours: orange (Must Only), indigo (Must + Should), green (Must + Should + Could), at the alpha levels documented in Scope.
- Dataset `order`: `1` (Must Only) / `2` (Must + Should) / `3` (Must + Should + Could) — lower `order` draws on top.
- `barPercentage: 1.0` and `categoryPercentage: 1.0` on every dataset — the bars touch each other within a Bin and across Bins, which is what gives the histogram its bar-chart-as-histogram appearance.
- Tooltip behaviour as in AT-5.
- `responsive: true`, `maintainAspectRatio: false` — the chart fills its container, which resizes on window resize.

### Test harness

Acceptance tests:
- Location: **N/A — manual.** Same rationale as Phase 1.
- Manual steps:
  1. Open `index.html` and load known-good CSVs. Confirm the canvas is empty until **Run Simulation** is pressed.
  2. Press **Run Simulation**. Confirm AT-1's `Then` clauses: three datasets, overlaid (not grouped), labels match, axis titles match.
  3. Press **Run Simulation** a second time. In DevTools, before the click, snapshot `Chart.getChart(document.getElementById('results-chart'))`; after the click, snapshot again. Confirm the two are different instances and the first is no longer registered.
  4. Hover a tall bar in the middle of the distribution. Confirm AT-5's tooltip text format.
  5. Edit the Initiatives CSV to remove every `Must`/`Should`/`Could` initiative for the target quarter (leave a few `Won't` rows so the file is non-empty). Reload, re-pick the quarter, press Run. Confirm AT-6: chart renders without throwing, axes visible, no tall bars.
  6. Open a Run with custom markers (feature 0017) and edit one marker. Confirm the chart re-renders without flicker and that the `(globalMin, globalMax)` x-range is unchanged (AT-7).
  7. Toggle a legend entry off and on. Confirm Chart.js's default toggle behaviour hides/shows that dataset and that the other two remain.

Inner tests:
- Location: **N/A.** If a harness is added, the seams are listed below.

Verification:
- Manual: `open index.html` and walk the steps above.

Fake-injection wiring:
- N/A. Chart.js is loaded from CDN; this feature does not stub or mock the chart library.

### Proposed implementation seams

Stable seams a future test suite may target:
- `renderChartOnCanvas(canvasId, results, capacity, contextKey) → Chart` — depends on Chart.js being loaded. The contract is "given a valid `results` payload, draws three overlaid datasets on the named canvas and returns the Chart instance".
- `renderChart(results, capacity) → void` — the org-level convenience wrapper. Internally destroys the previous instance and reassigns `chartInstance`.
- The `chartInstance` module variable — the canonical "what is currently drawn" reference for the org chart.

Do NOT lock in:
- The exact CDN URL or version pin for Chart.js (resolved at page load).
- The exact RGBA values for the three dataset fills (they may be tuned for legibility on different displays; the relative *order* and the *transparency* are the load-bearing properties).
- The `animation.duration: 350` — Chart.js animation timing is an aesthetic knob.
- The `maxTicksLimit: 10` on the x-axis — a Chart.js tick-density knob, not a contract.
- The presence of the `markersPlugin` `afterDraw` hook *body* — the hook slot is in scope for this feature, but its drawing logic belongs to feature 0017.

### Behavioral rule

The chart rendering layer turns one `runSimulation` payload into one Chart.js bar chart on a named canvas, with three semi-transparent overlapping datasets sharing a single x-axis. There is at most one Chart.js instance per canvas at any time; the previous instance is destroyed before any re-render. The renderer reads the `Histogram` tuples and the **Global histogram range** from the payload without modification — it does not re-bin, does not re-clip, and does not decide on colours per Run.

### Invariants
- After `renderChart(results, capacity)` returns, `chartInstance` is a non-null Chart.js instance and `Chart.getChart(document.getElementById('results-chart')) === chartInstance`.
- Every render path destroys the prior `chartInstance` before constructing a new one — no canvas accumulates Chart.js instances.
- The three datasets' `data` arrays are exactly `results.mustOnly.hist.counts` / `results.mustShould.hist.counts` / `results.mustShouldCould.hist.counts` (reference-equal, not deep-copied).
- The chart's `labels` array has length `NUM_BINS` (60).
- `options.grouped === false` — the overlay behaviour is non-negotiable; grouped bars would be a different chart type.
- Each dataset has `barPercentage === 1.0` and `categoryPercentage === 1.0` so bars touch within and across Bins.
- Dataset `order` is `1` / `2` / `3` for Must Only / Must + Should / Must + Should + Could respectively.
- `responsive === true` and `maintainAspectRatio === false`.
- `lastRenderState[contextKey]` is populated after every render (so feature 0017's marker-edit path can re-render without re-running the simulation).

### Counterexamples (must NOT pass)
- A renderer that calls `new Chart(canvas, ...)` without destroying the previous instance — Chart.js will attach a new instance to the canvas alongside the old one, leaking event listeners and producing the "ghost tooltips" Chart.js antipattern.
- A renderer that deep-copies the `counts` arrays before passing them to Chart.js — wastes memory at every Run and gains nothing (the engine never mutates `counts` after `buildHistogram` returns).
- A renderer with `options.grouped: true` (or omitting `grouped` and relying on the default) — would produce three side-by-side bars per Bin, defeating the overlay design ADR-0011 chose.
- A renderer that reassigns `chartInstance` without destroying the previous instance — same leak as above, harder to notice because the canvas *visually* updates.
- A renderer that hard-codes its own `labels` from `0..NUM_BINS-1` integers instead of formatted bin centres — would produce a chart where the x-axis numbers do not correspond to person-month values, making the tooltip's `Effort ≈ X.X PM` line read off-by-many.
- A renderer that draws a capacity line directly inside this feature's `afterDraw` plugin — the plugin slot is here, but the line is feature 0017's `Marker`. Adding capacity drawing here would shortcut around the marker store and break the unified-marker semantics added later.

### Forbidden shortcuts
- Do not import D3, ECharts, plotly, or any second charting library. Chart.js is the documented dependency in ADR-0001.
- Do not switch to `Chart.js` `type: 'line'` "to show the shape better" — the histogram-as-bar-chart appearance is the documented choice; a line chart would invite interpolation between Bins that the discrete distribution does not have.
- Do not extract `defaultBarOptions` / `defaultScales` constants. The inline configuration is intentional (see *Existing patterns to follow*).
- Do not pin a Chart.js version inside this feature — the CDN `<script>` tag in the head is the single source of truth.
- Do not bypass `renderChartOnCanvas` and call `new Chart(...)` directly from anywhere else. The destroy-then-render discipline lives in the wrapper.
- Do not draw text or marker lines from `renderChartOnCanvas`'s main body. The `afterDraw` plugin hook is the only place additional drawing is allowed (and is owned by feature 0017).

### RED gate

On an un-implemented build (e.g. `renderChartOnCanvas` is a stub that logs the inputs and returns `null`):
- Manual step 2: the canvas is blank after pressing Run — no datasets visible, no axes.
- Manual step 3: `Chart.getChart(canvas)` returns `undefined` both before and after the second click.
- Manual step 4: hovering produces no tooltip (no chart, no listeners).
- Manual step 6 (marker edit): the marker dialog opens but its OK button does nothing observable on the chart (because the cached render state is empty).

### Test immutability rule

Same as Phase 1: N/A in the current project. If tests are added later, they're off-limits to the implementation session.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-7 all pass.
- [ ] `chartInstance` is the only reference to the current org chart; the destroy-then-render discipline is observable via `Chart.getChart`.
- [ ] The three datasets render overlaid (not grouped) and the smallest Scenario (Must Only) is visually on top.
- [ ] The tooltip text format matches AT-5 exactly.
- [ ] Empty-plan and non-zero-`fixedEffort` Runs both render without exceptions.
- [ ] `lastRenderState['org']` is populated on every successful render and consumed by feature 0017 without changes here.
- [ ] `git diff` touches only `index.html` (ADR-0001).
