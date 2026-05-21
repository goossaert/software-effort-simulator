# Feature: Org-level summary statistics table

Created at: 2026-05-21T00:00:00Z

## Context

This feature is the *primary numeric surface* of the simulator: the table the user reads after glancing at the chart ([feature 0006](./0006-org-histogram-chart.md)). It sits between the orchestrator [feature 0004 — MoSCoW three-scenario forecasting](./0004-moscow-three-scenario-forecasting.md) (which produces three sorted `Float64Array` distributions, one per **Scenario**) and the user, and it owns two responsibilities: (a) computing the **Stats** tuple `{ p10, p25, p50, p75, p90, mean, pExceed }` per Scenario from the sorted distribution, and (b) rendering those tuples into the HTML table at `#stats-table` with a colour-coded **Risk tier** on the `P(effort > capacity)` row.

The feature is deliberately narrow. It does not own the chart (feature 0006), the marker system that adds extra `P(effort > value)` rows ([feature 0017](../../backtracked-features.md#0017)), or the per-team table re-use ([feature 0011](../../backtracked-features.md#0011) — which calls into this feature's renderer with a different `<tbody>` id). What it owns is the `computeStats` function, the `renderStatsTableInto` function, the three CSS risk classes (`.ok`, `.caution`, `.warn`), and the table markup at `#stats-table`.

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). The stats layer is module-scoped functions and inline CSS in `index.html`; no template engine, no UI library.
- [ADR-0002 — Client-side only, no backend](../adr/0002-client-side-only.md). Rendering is on-page; no server-side stats computation.
- [ADR-0006 — Monte Carlo with bootstrapped historical sizes](../adr/0006-monte-carlo-with-bootstrapped-sizes.md). The sorted `Float64Array` this feature consumes is the engine's output; the table is the numeric view of the same empirical distribution the chart visualises.
- [ADR-0010 — Three-scenario MoSCoW forecasting](../adr/0010-three-scenario-moscow-forecasting.md). The number three is load-bearing here: three coloured columns in the header, three numeric cells per row.
- [ADR-0011 — Overlapping bar histograms with shared bins and P99.5 outlier clipping](../adr/0011-overlapping-histograms-shared-bins.md). The chart this table is read alongside; **Outlier clip** is the reason the table does *not* report a max.
- [ADR-0012 — Five-point tail-percentile summary with probability-of-exceedance](../adr/0012-percentile-summary-and-probability-of-exceedance.md). The architectural decision for the six points and the binary-search exceedance lookup that this feature implements.
- [ADR-0013 — Three-tier risk colouring at 25% / 50% cuts](../adr/0013-three-tier-risk-colouring.md). The architectural decision for the `ok` / `caution` / `warn` tiers and palette this feature implements.

Glossary terms used below: **Scenario**, **Run**, **Iteration**, **Person-month (PM)**, **Capacity**, **Stats**, **Percentile (Pxx)**, **Tail percentile**, **Probability of exceedance**, **Risk tier**, **Marker** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user who has loaded both CSVs, picked a **Historical quarter** and a **Target quarter**, and pressed **Run Simulation** sees a table appear below the chart within a second (at the default 10,000 **Iterations** on a typical laptop). The table has four columns — **Metric**, **Must Only**, **Must + Should**, **Must + Should + Could** — with the three scenario headers tinted in the same orange / indigo / green palette as the chart's datasets ([feature 0006](./0006-org-histogram-chart.md)).

The body rows are, top to bottom: **P10**, **P25**, **Median (P50)**, **P75**, **P90**, **Mean** (all formatted as `X.X` person-months, right-aligned, with tabular numerals), followed by a final bold row **`P(effort > {capacity} PM)`** showing the **Probability of exceedance** for each Scenario as a percentage (`XX.X%`). The bottom-row cells are tinted green (`.ok`), orange (`.caution`), or red (`.warn`) per the **Risk tier** thresholds: green ≤ 25%, orange 25–50%, red > 50%. When **Markers** have been added to the org chart context ([feature 0017](../../backtracked-features.md#0017)), one extra row per non-capacity marker appears between the percentile rows and the capacity row — formatted as `P(effort > {value} PM) {label}` with a coloured swatch matching the marker's pill colour and the same `ok` / `caution` / `warn` tier on its three percentage cells.

Re-running with the same inputs produces *visibly similar but not byte-identical* numbers in the percentile cells (the **Run** is re-seeded from the wall clock — see [ADR-0009](../adr/0009-custom-seeded-prng.md)), but the **Risk tier** colours rarely flip class on the same plan because the tier boundaries (25%, 50%) are well-separated from typical exceedance values. When the user changes **Capacity** in the sidebar and re-runs, the capacity row's label updates to the new PM number and the tier colours re-grade accordingly.

There is no user-visible failure path at this layer. An empty plan (all three Scenarios produce the all-zeros `Float64Array`) renders a table with every percentile cell showing `0.0`, the mean showing `0.0`, and `P(effort > capacity)` showing `0.0%` tinted green — which is the honest answer to "what is the risk of overrunning capacity with an empty plan", not a defect. A `Capacity` of `0` makes every cell show `100.0%` tinted red, which is similarly the honest answer.

## Scope

### In scope
- `computeStats(sorted, capacity)` (`index.html:2048`): given a sorted `Float64Array` and a numeric capacity, returns the **Stats** tuple `{ p10, p25, p50, p75, p90, mean, pExceed }`. Percentiles via fractional-index lookup; mean via reduce; `pExceed` via a single binary search ([ADR-0012](../adr/0012-percentile-summary-and-probability-of-exceedance.md)).
- `computePExceed(sorted, threshold)` (`index.html:2996`): the standalone binary-search exceedance lookup shared with the per-Marker rows owned by [feature 0017](../../backtracked-features.md#0017). The function lives in this feature's scope because the marker rows are *added* by feature 0017 but the lookup *function* is the same one `computeStats` uses internally.
- `renderStatsTableInto(tbodyId, results, capacity, contextKey)` (`index.html:2357`): writes the six percentile rows and the capacity row into the named `<tbody>`. The `contextKey` is `'org'` for the org table and `'team-{idx}'` for per-team tables ([feature 0011](../../backtracked-features.md#0011)); the marker-row block is feature 0017's surface (this feature ships an empty marker list).
- `renderStatsTable(results, capacity)` (`index.html:2406`): the org-level convenience wrapper that targets `#stats-tbody` with `contextKey = 'org'`.
- The risk-tier classifier `cls = p => p > 0.5 ? 'warn' : p > 0.25 ? 'caution' : 'ok'` (`index.html:2361`) and the three CSS rules `.ok` / `.caution` / `.warn` (`index.html:496-498`).
- The static HTML at `#stats-table` (`index.html:1001-1011`): the four-column header with the three scenario-tinted column classes (`.col-m`, `.col-ms`, `.col-msc`) and the empty `<tbody id="stats-tbody">`.
- The percentage and PM cell formatters: `fmt = n => n.toFixed(1)`, `pct = p => (p * 100).toFixed(1) + '%'`.

### Out of scope
- The chart on `#results-chart` and its `globalMin` / `globalMax` calculation. That is [feature 0006](./0006-org-histogram-chart.md).
- The MoSCoW orchestration that produces the three `Float64Array`s. That is [feature 0004](./0004-moscow-three-scenario-forecasting.md).
- The Monte Carlo engine itself. That is [feature 0003](./0003-monte-carlo-simulation-engine.md).
- The **Constant work** shift (`fixedEffort`) applied before the percentiles are computed. That is [feature 0015](../../backtracked-features.md#0015); this feature reads the already-shifted distribution unchanged.
- The marker dialog, marker palette, marker CSV save/load, and the per-marker `P(effort > value)` row *body*. Those are [feature 0017](../../backtracked-features.md#0017) — though that feature's marker rows reuse `computePExceed` and the `cls` classifier without modification.
- The per-team table instances (`team-stats-tbody-{idx}`). [Feature 0011](../../backtracked-features.md#0011) — it *re-uses* `renderStatsTableInto` with a different `<tbody>` id and `contextKey`, but does not change this feature's contract.
- The Team Projections P25/P50/P75 effort bars and the per-quarter count matrix. [Feature 0012](../../backtracked-features.md#0012).
- The **Synthetic ↔ Empirical** parameter-set toggle ([feature 0018](../../backtracked-features.md#0018)) — this feature reads whatever distribution is produced; the toggle is upstream.
- Future power-user knobs for the percentile set, the risk-tier cuts, or the percentile estimator. ADR-0012 and ADR-0013 explicitly defer these.

## Relevant existing files
Claude may inspect:
- `index.html`, specifically:
  - `computeStats` (`index.html:2044-2065`).
  - `renderStatsTableInto` (`index.html:2353-2403`) and `renderStatsTable` (`index.html:2405-2408`).
  - `computePExceed` (`index.html:2996-3002`).
  - The `#stats-table` markup (`index.html:999-1012`).
  - The risk CSS rules (`index.html:496-498`) and the scenario-tint header CSS (`index.html:483-485`).
- `CONTEXT.md` glossary, especially the **Summary statistics** group (**Stats**, **Percentile (Pxx)**, **Tail percentile**, **Probability of exceedance**, **Risk tier**) and the **Visualisation** group's **Outlier clip** entry.
- ADRs 0006, 0010, 0011, 0012, 0013 for the constraints this feature must respect.

Claude should not inspect unless needed:
- The CSV parsing / column detection blocks — upstream and produce the inputs `runSimulation` reads.
- The chart code (`buildHistogram`, `renderChartOnCanvas`, `markersPlugin`) — that is feature 0006 / 0017.
- The Team Level / Team Projections sections — they call `renderStatsTableInto` but do not change its contract.

## Existing patterns to follow
- **Layering inside `index.html`**: `computeStats` lives in Module 5 (engine) next to `runScenario` / `buildHistogram`. `renderStatsTableInto` and `renderStatsTable` live in Module 6 (chart & stats rendering). `computePExceed` is exposed at the Module 7 boundary because feature 0017's marker rendering reads it. Module 6 reads from Module 5's output payload; Module 5 must never reach into Module 6 to call rendering.
- **`computeStats` is pure**: it takes a sorted `Float64Array` and a numeric capacity and returns a fresh `{ p10, p25, p50, p75, p90, mean, pExceed }` object. It does not read globals, does not touch the DOM, and does not mutate its `sorted` argument.
- **Single sortedness contract**: the input `sorted` argument is the sorted `Float64Array` from `runScenario` ([feature 0003](./0003-monte-carlo-simulation-engine.md)). `computeStats` does *not* re-sort and does *not* re-validate ordering. The percentile lookup `sorted[Math.floor(p * n)]` and the binary search both rely on the contract.
- **Fractional-index percentile**: `pct = p => sorted[Math.min(n - 1, Math.floor(p * n))]`. The `Math.min(n - 1, ...)` clamp handles `p === 1.0` (which is not currently passed but is the natural edge case). Every reported percentile is therefore an *actual realised* Iteration value, not an interpolated one ([ADR-0012](../adr/0012-percentile-summary-and-probability-of-exceedance.md)).
- **Binary-search exceedance**: `pExceed` and `computePExceed` use the *same* loop shape — `while (lo < hi) { const mid = (lo + hi) >> 1; sorted[mid] <= threshold ? (lo = mid + 1) : (hi = mid); }` followed by `(n − lo) / n`. The two implementations exist (one inline in `computeStats`, one as a top-level `computePExceed`) because the inline version saves a function call in the hot path and the top-level version is what feature 0017's marker rows call; their semantics are identical and the duplication is documented here so a future cleanup does not silently de-sync them.
- **Risk-tier classifier is one line**: `const cls = p => p > 0.5 ? 'warn' : p > 0.25 ? 'caution' : 'ok'`. Defined fresh inside `renderStatsTableInto`, not lifted to a module-scoped constant — the inline form matches the existing tone of the codebase (see [feature 0006](./0006-org-histogram-chart.md)'s "no abstractions" pattern) and keeps the cuts visible right next to the `pct(...)` formatting.
- **Cell formatters are inline**: `fmt = n => n.toFixed(1)` and `pct = p => (p * 100).toFixed(1) + '%'` are declared at the top of `renderStatsTableInto`. Do not extract a `formatStats` helper.
- **Three columns are passed positionally**: rows are built as `[label, mustOnlyValue, mustShouldValue, mustShouldCouldValue]`. Note the column order in the rendered HTML is **Must Only / Must + Should / Must + Should + Could** (see `#stats-table` `<thead>`), even though `results.mustShould` appears first in the destructure. This is intentional and matches the chart's legend order ([feature 0006](./0006-org-histogram-chart.md)) — the leftmost column is the *cheapest* scenario.
- **The capacity row is structurally distinct**: it is a single `<tr>` *not* in the `rows` array; its template lives in the `innerHTML` join directly. The CSS rule `#stats-table tr:last-child td { font-weight: 700 }` automatically bolds it as the *table's last row* — which means the per-Marker rows ([feature 0017](../../backtracked-features.md#0017)) are appended *after* the capacity row to preserve the bold-last-row styling.
- **Single DOM write per render**: the whole table body is built as one HTML string and assigned once to `tbodyId.innerHTML`. Do not do per-cell DOM creation.
- **No framework, no template engine**: vanilla DOM, vanilla template literals. No React, no lit-html, no Mustache.
- **Verification command**: there is no automated test harness in this project. Verification is manual: open `index.html` in a browser (`open index.html` on macOS), load known-good CSVs, press Run, and inspect the table against expectations.

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
  mustOnly:        { sorted: Float64Array, /* hist, populated later by feature 0006 */ },
  mustShould:      { sorted: Float64Array, ... },
  mustShouldCould: { sorted: Float64Array, ... },
};
const capacity = Number;  // PM, sidebar input #capacity (feature 0008)

// Produced by computeStats — the per-Scenario Stats tuple
{
  p10:     Number,   // PM at the 10th percentile of the sorted distribution
  p25:     Number,   // PM at the 25th percentile
  p50:     Number,   // PM at the 50th percentile (median)
  p75:     Number,   // PM at the 75th percentile
  p90:     Number,   // PM at the 90th percentile
  mean:    Number,   // arithmetic mean of the sorted distribution, in PM
  pExceed: Number,   // Probability of exceedance: fraction of Iterations with total > capacity
}

// After `runSimulation` returns, each scenario's Stats tuple is attached as `.stats`:
results.mustOnly.stats        // { p10, p25, p50, p75, p90, mean, pExceed }
results.mustShould.stats
results.mustShouldCould.stats
```

The `pExceed` field is a fraction in `[0, 1]`, *not* a percentage. The percent formatting happens only at render time in `pct(...)`.

The Stats tuple is *not* keyed by Scenario inside itself — the keying lives at the `results.<scenario>.stats` level. Consumers read fields by name.

There is no module-scoped state owned by this feature. The render function writes directly into the named `<tbody>` and does not cache.

---

## Phase 1: Stats computation — `computeStats` and `computePExceed`

### Acceptance behavior

Scenario AT-1: `computeStats` returns the full tuple shape
Given a sorted `Float64Array` `dist = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])` and `capacity = 8`
When `computeStats(dist, 8)` is called
Then the return value has exactly the keys `{ p10, p25, p50, p75, p90, mean, pExceed }`
And every value is a finite number
And no extra keys are present

Scenario AT-2: Percentiles are fractional-index lookups
Given the dist and capacity from AT-1
When `computeStats(dist, 8)` is called
Then `p10 === dist[Math.floor(0.10 * 10)] === dist[1] === 2`
And `p50 === dist[Math.floor(0.50 * 10)] === dist[5] === 6`
And `p90 === dist[Math.floor(0.90 * 10)] === dist[9] === 10`
(Verifies the non-interpolated estimator from [ADR-0012](../adr/0012-percentile-summary-and-probability-of-exceedance.md).)

Scenario AT-3: Mean is the arithmetic mean
Given the dist from AT-1
When `computeStats(dist, 8)` is called
Then `mean === (1+2+3+4+5+6+7+8+9+10) / 10 === 5.5`

Scenario AT-4: `pExceed` is the strict-greater fraction
Given the dist from AT-1 and `capacity = 8`
When `computeStats(dist, 8)` is called
Then `pExceed === 2 / 10 === 0.2`
(Only the values `9` and `10` strictly exceed `8`; `8` itself does not.)

Scenario AT-5: `pExceed === 0` when capacity exceeds the entire distribution
Given the dist from AT-1 and `capacity = 100`
When `computeStats(dist, 100)` is called
Then `pExceed === 0`
And no exception is thrown

Scenario AT-6: `pExceed === 1` when capacity is below the entire distribution
Given the dist from AT-1 and `capacity = -1`
When `computeStats(dist, -1)` is called
Then `pExceed === 1`

Scenario AT-7: All-zeros distribution produces the all-zeros Stats tuple
Given `dist = new Float64Array(1000)` (all zeros) and any non-negative `capacity`
When `computeStats(dist, capacity)` is called
Then every percentile field is `0`
And `mean === 0`
And `pExceed === 0` (because no zero strictly exceeds a non-negative capacity)

Scenario AT-8: `computeStats` does not mutate its input
Given any sorted `Float64Array` `dist` and a snapshot copy `pre = new Float64Array(dist)`
When `computeStats(dist, capacity)` is called
Then `dist` is element-wise equal to `pre`

Scenario AT-9: `computePExceed` and `computeStats`'s inline `pExceed` agree
Given any sorted `Float64Array` `dist` and any numeric `threshold`
When `computeStats(dist, threshold).pExceed` and `computePExceed(dist, threshold)` are both computed
Then the two return values are byte-identical
(Guards the documented duplication between the inline binary search in `computeStats` and the top-level `computePExceed`.)

Scenario AT-10: `computePExceed` returns `0` for an empty array
Given `dist = new Float64Array(0)` and any `threshold`
When `computePExceed(dist, threshold)` is called
Then the return value is `0`
And no exception is thrown
(This is the documented contract; `computeStats` does not need the same guard because the engine never produces a zero-length distribution.)

### Public entry point

In-code: `computeStats(sorted, capacity)` and `computePExceed(sorted, threshold)`. `computeStats` is called from `runSimulation` (feature 0004) once per Scenario, and from `prepareTeamSimulationData`-fed Team Level Runs (feature 0011). `computePExceed` is called from feature 0017's per-Marker row construction in `renderStatsTableInto`.

UI: none directly; the Stats tuple becomes table cells in Phase 2.

### Expected observable outcomes
- `computeStats(sorted, capacity)` returns an object with exactly `{ p10, p25, p50, p75, p90, mean, pExceed }` keys.
- Every percentile field equals `sorted[Math.min(n - 1, Math.floor(p * n))]` for the corresponding `p`.
- `mean` equals `sorted.reduce((a, b) => a + b, 0) / sorted.length` exactly (modulo IEEE-754 summation order, which is consistent within a JavaScript engine).
- `pExceed` equals the fraction of elements strictly greater than `capacity` — never the fraction `≥ capacity`.
- `computePExceed(empty, t) === 0`; `computePExceed(non-empty, t)` matches `computeStats`'s inline form for the same `t`.
- No DOM access. No `console` output.

### Test harness

Acceptance tests:
- Location: **N/A — this project has no automated test suite.** Manual acceptance is performed via the DevTools console after opening `index.html`.
- Manual steps:
  1. Open `index.html` in a browser. In DevTools console:
     ```js
     const d = new Float64Array([1,2,3,4,5,6,7,8,9,10]);
     const s = computeStats(d, 8);
     ```
     Confirm `s` has exactly the seven keys listed in AT-1.
  2. From the same console:
     `s.p10 === 2 && s.p50 === 6 && s.p90 === 10 && s.mean === 5.5 && s.pExceed === 0.2`
     should be `true`.
  3. From the same console: `computeStats(d, 100).pExceed === 0` and `computeStats(d, -1).pExceed === 1`.
  4. From the same console:
     `const z = new Float64Array(1000); const sz = computeStats(z, 10);`
     and confirm every percentile is `0`, `sz.mean === 0`, and `sz.pExceed === 0`.
  5. From the same console:
     `const pre = new Float64Array(d); computeStats(d, 5); const same = d.every((v,i) => v === pre[i]);`
     Confirm `same === true`.
  6. From the same console:
     `computePExceed(d, 5) === computeStats(d, 5).pExceed`
     should be `true`. Repeat for `threshold ∈ {-10, 0, 5.5, 10, 100}`.
  7. From the same console:
     `computePExceed(new Float64Array(0), 5) === 0`
     should be `true`.
  8. After a real Run (load CSVs, press Run): in the console, call
     `computeStats(results.mustShouldCould.sorted, capacity).pExceed`
     and confirm the value matches the percentage shown in the table's last row (modulo rounding to 1 dp).

Inner tests:
- Location: **N/A — no test harness.** `computeStats` and `computePExceed` are pure functions and would be straightforward to drive.

Verification:
- Manual: walk the DevTools console steps above. Both functions are module-scoped and reachable directly from the console.

Fake-injection wiring:
- N/A. Pure functions; the test seam is hand-crafted inputs.

### Proposed implementation seams

Stable seams a future test suite may target:
- `computeStats(sorted, capacity) → { p10, p25, p50, p75, p90, mean, pExceed }` — pure, deterministic, no globals.
- `computePExceed(sorted, threshold) → number` — pure, deterministic, identical contract to `computeStats`'s inline binary search.

Do NOT lock in:
- The percentile set `{0.10, 0.25, 0.50, 0.75, 0.90}` — see [ADR-0012](../adr/0012-percentile-summary-and-probability-of-exceedance.md), this is a deliberate but revisitable choice.
- The fractional-index percentile estimator — same as above; a future switch to type-7 interpolation would re-open ADR-0012 and require a numerical-equivalence pin.
- The `Math.min(n - 1, ...)` clamp's specific shape — any equivalent guard against `p === 1.0` is fine.

### Behavioral rule

The stats-computation layer turns a sorted `Float64Array` of per-**Iteration** total efforts into a `{ p10, p25, p50, p75, p90, mean, pExceed }` tuple of plain numbers in person-months (PM) and probability fractions. Percentiles are fractional-index lookups (every reported value is an actual realised Iteration); the mean is arithmetic; the **Probability of exceedance** is a strict-greater fraction computed by a single binary search. The layer is pure: same `(sorted, capacity)` in → same tuple out, byte-identical across calls.

### Invariants
- `computeStats(sorted, capacity)` returns exactly the seven-key tuple `{ p10, p25, p50, p75, p90, mean, pExceed }`. No extra keys; no missing keys.
- Every percentile field is in the closed range `[sorted[0], sorted[n - 1]]` — they are picks *from* the distribution, not interpolated.
- `0 ≤ pExceed ≤ 1` for any valid `(sorted, capacity)` pair; `pExceed === 0` iff no element strictly exceeds `capacity`; `pExceed === 1` iff every element strictly exceeds `capacity`.
- `computeStats(zeros, c).pExceed === 0` for any `c ≥ 0` and any zero-only `Float64Array`.
- `computeStats` does not mutate its `sorted` argument.
- `computeStats(sorted, c).pExceed === computePExceed(sorted, c)` for every valid `(sorted, c)` pair.
- `computePExceed(emptyArr, c) === 0` for any `c`.

### Counterexamples (must NOT pass)
- A `computeStats` that returns `pExceed === (n - lo + 1) / n` (off-by-one in the binary-search post-processing) — would silently report `pExceed > 0` even when no element strictly exceeds `capacity`. The `(n - lo) / n` form is load-bearing; the binary search finds the *first* index where `sorted[idx] > capacity`, and `n - lo` is the count of strictly-exceeding elements.
- A `computeStats` that uses `>= capacity` (or an inclusive `≤ capacity` in the search condition) — would report the wrong number for any distribution that has an element exactly equal to the capacity, contradicting the user-facing "*strictly* exceeds" semantics of the **Probability of exceedance** ([CONTEXT.md](../../CONTEXT.md)). The published label is `P(effort > capacity)`, not `P(effort ≥ capacity)`.
- A `computeStats` that uses a linear scan for `pExceed` instead of a binary search — would be invisible at the default 10,000 iterations but would degrade the marker-row hot path to `O(markers · n)`. See [ADR-0012](../adr/0012-percentile-summary-and-probability-of-exceedance.md).
- A `computeStats` that uses a linearly-interpolated percentile estimator without re-opening [ADR-0012](../adr/0012-percentile-summary-and-probability-of-exceedance.md) — would change the meaning of "the P75" from "an actual realised Iteration" to "a synthetic number between two adjacent Iterations".
- A `computeStats` that mutates `sorted` (e.g. calls `sorted.sort()` defensively) — would be redundant work and would risk silently degrading the engine's documented sortedness contract if `Float64Array.sort()` is ever passed an incorrect comparator.
- A `computePExceed` that returns `NaN` for an empty array — would propagate `NaN` into the marker-row `pct(...)` formatter and render `NaN%` in the cell. The documented contract is `computePExceed(empty, t) === 0`.

### Forbidden shortcuts
- Do not import a stats library (jStat, simple-statistics, math.js) for percentile / mean helpers. Both operations are one line.
- Do not pre-sort `sorted` inside `computeStats` "just to be safe". The input is sorted by contract ([feature 0003](./0003-monte-carlo-simulation-engine.md)); re-sorting would be `O(n log n)` per Run and would mask upstream bugs.
- Do not memoise per-`(sorted, capacity)` tuple — every Run produces a fresh distribution; the memo would never hit.
- Do not introduce a unified `computeStatsWithMarkers(sorted, thresholds[])` helper. The marker-row construction belongs to feature 0017; this feature ships `computePExceed` as the reusable primitive and leaves the iteration to the caller.
- Do not change the `Math.min(n - 1, Math.floor(p * n))` shape to `Math.floor(p * (n - 1))`. The current form is the documented fractional-index estimator in [ADR-0012](../adr/0012-percentile-summary-and-probability-of-exceedance.md); the alternative is a different estimator and would silently shift every reported percentile by a fraction of one Iteration.

### RED gate

On an un-implemented build (e.g. `computeStats` is a stub returning all-zero fields, and `computePExceed` returns `0`):
- Manual step 2: `s.p10 === 2 && s.p50 === 6 && ...` is `false` (every field is `0`).
- Manual step 3: `computeStats(d, -1).pExceed === 1` is `false` (stub returns `0`).
- Manual step 8: the table's bottom row shows `0.0%` for every Scenario tinted green, while the chart shows distributions that visibly overlap the capacity line — an obvious mismatch.

### Test immutability rule

There are no test files to freeze in this project (manual harness). If a test suite is later introduced and Phase 1's acceptance steps are codified, those tests live under `tests/unit/` and are off-limits to the implementation session — only the test-writing session may edit them.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-10 all pass via the DevTools console.
- [ ] `computeStats` is the *only* place the per-Scenario tuple is computed; no caller inlines percentile or mean math.
- [ ] `computePExceed` is the *only* shared binary-search lookup; feature 0017's marker rows call it without re-implementing.
- [ ] No occurrence of `arr.sort(` inside `computeStats` or `computePExceed`.
- [ ] No DOM access from either function.
- [ ] `git diff` touches only `index.html` (ADR-0001).

---

## Phase 2: Table rendering — `renderStatsTableInto` and `renderStatsTable`

### Acceptance behavior

Scenario AT-1: First Run renders six percentile rows plus the capacity row
Given the user has just loaded both CSVs and picked valid quarters
When the user presses **Run Simulation** for the first time
Then the `<tbody id="stats-tbody">` contains exactly seven `<tr>` elements (no markers active)
And the six top rows are, in order, labelled `P10`, `P25`, `Median (P50)`, `P75`, `P90`, `Mean`
And the seventh (bottom) row is labelled `P(effort > {capacity} PM)` (e.g. `P(effort > 120 PM)`)
And every cell in the six top rows is formatted as `X.X` (one decimal place)
And the bottom row's three Scenario cells are formatted as `XX.X%`

Scenario AT-2: Column order is Must Only / Must + Should / Must + Should + Could
Given a rendered table
When the user reads the header
Then the columns appear in the order: **Metric**, **Must Only**, **Must + Should**, **Must + Should + Could**
And the body cells in every row appear in the same column order
(This matches the chart's legend and is the *cheapest-to-most-ambitious* reading order, [ADR-0010](../adr/0010-three-scenario-moscow-forecasting.md).)

Scenario AT-3: Risk-tier colouring grades the capacity row
Given a Run where the three Scenarios produce `pExceed` values of `0.05`, `0.32`, `0.74`
When the table is rendered
Then the Must Only cell's `<span>` has class `ok`
And the Must + Should cell's `<span>` has class `caution`
And the Must + Should + Could cell's `<span>` has class `warn`
And the rendered colours match the CSS rules at `index.html:496-498` (green `#10b981`, orange `#f97316`, red `#ef4444`)

Scenario AT-4: Threshold boundaries are strictly greater
Given a Scenario whose `pExceed` is *exactly* `0.25`
When the table is rendered
Then the cell's class is `ok`, not `caution` (the classifier uses `pExceed > 0.25`)
Given a Scenario whose `pExceed` is *exactly* `0.5`
Then the cell's class is `caution`, not `warn`
(Documents the strict-greater discipline of the tier classifier; matches [ADR-0013](../adr/0013-three-tier-risk-colouring.md).)

Scenario AT-5: The percentile rows are not coloured
Given any rendered table
When the user inspects the P10–Mean rows
Then no `<td>` in those rows contains a `<span class="ok">` / `.caution` / `.warn`
And those cells inherit the default `#374151` text colour from `#stats-table td`
(Risk colouring applies only to **Probability of exceedance** cells, not to PM percentiles. The PM percentiles are reference numbers, not verdicts.)

Scenario AT-6: Capacity row is bold via `:last-child`
Given a rendered table with no markers
When the user inspects the computed style of any `<td>` in the bottom row
Then `font-weight` is `700` (per the `#stats-table tr:last-child td { font-weight: 700 }` rule)
And no `<td>` in the rows above has `font-weight: 700`
(This is what makes feature 0017's marker rows append *below* the capacity row: the markers want the bold styling carried over to their rows, and `tr:last-child` does that automatically.)

Scenario AT-7: Re-render replaces the previous body wholesale
Given a Run has rendered the table (so `#stats-tbody.innerHTML` is non-empty)
When the user presses **Run Simulation** again
Then `#stats-tbody.innerHTML` is reassigned in a single write
And no `<tr>` from the previous Run remains in the DOM
(Verifies the single-write rendering pattern: one `innerHTML` assignment per render, not per-row DOM manipulation.)

Scenario AT-8: Per-team rendering writes to a different `<tbody>`
Given the user has switched to the **Team Level** tab and a team has rendered
When `renderStatsTableInto('team-stats-tbody-2', teamResults, capacity, 'team-2')` is called by feature 0011
Then the `<tbody id="team-stats-tbody-2">` is populated using the same row shape as the org table
And `#stats-tbody` (the org table body) is *not* touched
(Documents the contract feature 0011 relies on: the renderer is a pure function of `(tbodyId, results, capacity, contextKey)`.)

Scenario AT-9: Empty plan renders without throwing
Given a Run where every Scenario's `sorted` is the all-zeros `Float64Array(iterations)`
When the table is rendered
Then every percentile cell shows `0.0`
And the mean cell shows `0.0`
And the capacity row shows `0.0%` in every cell, with `<span class="ok">`

### Public entry point

In-code:
- `renderStatsTable(results, capacity)` (`index.html:2406`) — the org-level wrapper, called from the run-button click handler in Module 7.
- `renderStatsTableInto(tbodyId, results, capacity, contextKey)` (`index.html:2357`) — the underlying renderer, also called from `renderTeamSection` (feature 0011) and from feature 0017's marker-edit re-render path.

UI: the user-visible table at `#stats-table` in the main pane, below the chart.

### Expected observable outcomes
- The `<tbody>` named by `tbodyId` contains 6 + 1 + (marker count) `<tr>` elements after a successful render.
- Every cell in the percentile and mean rows is right-aligned with tabular numerals via the `.val` class.
- The capacity row's three Scenario cells contain a `<span class="ok|caution|warn">` wrapping the percentage; no other row uses those classes (except marker rows, owned by feature 0017).
- The capacity row's label embeds the current `capacity` value as a literal PM number.
- The header is *not* rewritten on render — the column titles live in the static markup at `index.html:1001-1011` and never change.
- `<tbody>` is reassigned via a single `innerHTML` write per render.

### Test harness

Acceptance tests:
- Location: **N/A — manual.** Same rationale as Phase 1.
- Manual steps:
  1. Open `index.html` and load known-good CSVs. Confirm `<tbody id="stats-tbody">` is empty until **Run Simulation** is pressed.
  2. Press **Run Simulation**. Confirm AT-1's `Then` clauses: seven rows, correct labels, `X.X` PM and `XX.X%` formatting.
  3. In DevTools, inspect the capacity row's three Scenario cells. Confirm AT-3's expected classes by reading `outerHTML` of each cell.
  4. Edit Capacity in the sidebar so that the Must + Should pExceed crosses one of the thresholds (a low capacity to force `warn`, a high one to force `ok`). Re-run. Confirm the colour changes.
  5. Try Capacity values that put a Scenario right at `0.25` or `0.5` exact (if reachable on your data). Confirm AT-4: exact `0.25` is `ok`, exact `0.5` is `caution`.
  6. Confirm AT-5 by inspecting `outerHTML` of any P10–Mean cell — no `<span class>` is present.
  7. Read the computed `font-weight` of the capacity row vs. the P50 row in DevTools' Computed Styles panel. Confirm AT-6: bottom row 700, others not.
  8. Press Run twice and confirm `<tbody id="stats-tbody">.children.length === 7` after each press (no row accumulation).
  9. Switch to the Team Level tab and let a team table render. Confirm AT-8: `#team-stats-tbody-0` (or whatever index) is populated; `#stats-tbody` is unchanged from the org Run.
  10. Edit the Initiatives CSV to remove every Must / Should / Could initiative for the target quarter. Reload, re-pick the quarter, press Run. Confirm AT-9: all cells show `0.0` / `0.0%`, all tier classes are `ok`, no exception.

Inner tests:
- Location: **N/A.** If a harness is added, the seam is `renderStatsTableInto(tbodyId, results, capacity, contextKey)` with a mocked `document.getElementById` returning a stub element.

Verification:
- Manual: `open index.html` and walk the steps above.

Fake-injection wiring:
- N/A. The renderer's only side effect is the `innerHTML` write on the named `<tbody>`.

### Proposed implementation seams

Stable seams a future test suite may target:
- `renderStatsTableInto(tbodyId, results, capacity, contextKey) → void` — depends on the DOM. The contract is "given a valid `results` payload (Phase 1's tuple per Scenario) and a numeric capacity, writes the table body and returns".
- `renderStatsTable(results, capacity) → void` — the org-level convenience wrapper.
- The risk-tier classifier `cls` is *not* exposed as a top-level seam; it is intentionally inlined inside the renderer.

Do NOT lock in:
- The exact label strings (`P10`, `Median (P50)`, etc.) — they are user-facing and may be tweaked for clarity (e.g. localisation). The *row order* and the *number of rows* are load-bearing; the labels are not.
- The exact cell format (`toFixed(1)`) — one decimal place is a deliberate but tunable choice. ADR-0012 documents why P95/P99 are *not* in the table; the precision of the values that *are* in the table is a separate knob.
- The exact CSS hex colours (`#10b981` / `#f97316` / `#ef4444`) — the *three tiers* and the *traffic-light mapping* (green/orange/red) are load-bearing per [ADR-0013](../adr/0013-three-tier-risk-colouring.md); the shades may be tuned.

### Behavioral rule

The table rendering layer turns three per-Scenario **Stats** tuples (the Phase 1 outputs) and one numeric **Capacity** into one HTML table body, written into the named `<tbody>` in a single `innerHTML` assignment. The percentile and mean rows are reference numbers in PM; the bottom row is the **Probability of exceedance** verdict, with the `ok` / `caution` / `warn` **Risk tier** class applied per cell. Per-Marker rows from [feature 0017](../../backtracked-features.md#0017) appear between the percentile block and the capacity row but are not owned by this feature.

### Invariants
- `renderStatsTableInto` writes to *exactly* the `<tbody>` element identified by `tbodyId` and to no other DOM node.
- The body's row count after rendering is `6 + 1 + markerCount` (the six percentile rows, the one capacity row, and one per non-capacity marker for the given `contextKey`).
- The capacity row is *always* the `<tr>` immediately after the percentile rows and *immediately before* the marker rows. (When `markerCount === 0` it is the table's last row and is automatically bolded by the `:last-child` rule.)
- The risk-tier class applied to a cell is exactly `cls(pExceed)` where `cls = p => p > 0.5 ? 'warn' : p > 0.25 ? 'caution' : 'ok'` — strict-greater on both cuts.
- `cls(0.25) === 'ok'` and `cls(0.5) === 'caution'` (boundary values fall to the lower tier).
- The PM percentile cells contain *no* `<span class="ok|caution|warn">` wrapper.
- The capacity row's label embeds the current `capacity` value verbatim (e.g. `P(effort > 120 PM)`); it is not abbreviated or rounded.
- Per-Run state is *not* cached between calls; consecutive Runs produce independently rendered tables.

### Counterexamples (must NOT pass)
- A renderer that uses `pExceed >= 0.5` (or `> 0.49`) in the warn cut — would flip the boundary semantics documented in [ADR-0013](../adr/0013-three-tier-risk-colouring.md) and surprise users who land at exactly half.
- A renderer that paints the P75 / P90 cells with risk-tier colours "because they are tail percentiles" — would conflate *reference numbers* with *verdicts* and force the reader to apply a mental threshold to PM values that have no fixed risk meaning.
- A renderer that appends rows via `document.createElement` and `tbody.appendChild` per cell — defeats the "single innerHTML write" pattern and is slower at marker-heavy team tables.
- A renderer that hard-codes the column order to **Must + Should** first ("because `results.mustShould` is the first destructure") — would silently misalign the table with the chart legend and with [ADR-0010](../adr/0010-three-scenario-moscow-forecasting.md)'s cumulative left-to-right framing.
- A renderer that calls `computeStats` itself instead of reading `results.<scenario>.stats` — moves work that belongs in the engine layer into the rendering layer and breaks the Phase 1 / Phase 2 boundary.
- A renderer that omits the `PM` unit from the capacity row label — would conflate the capacity (a PM number) with `pExceed` (a fraction) at a glance.
- A renderer that writes the marker rows *before* the capacity row — would steal the `:last-child` bold styling from the capacity row and leave the user uncertain which row is the headline verdict.

### Forbidden shortcuts
- Do not extract a `<TableRow>` component or a `formatStats` builder. The renderer is one function with inline helpers (see *Existing patterns to follow*).
- Do not import a date / number formatting library (date-fns, numeral.js). `toFixed(1)` is the documented choice.
- Do not migrate to a template engine (lit-html, Handlebars). Template literals + `innerHTML` are the documented choice per [ADR-0001](../adr/0001-single-file-html-app.md).
- Do not parameterise the risk-tier cuts via a sidebar control. [ADR-0013](../adr/0013-three-tier-risk-colouring.md) explicitly defers that.
- Do not move the `cls` classifier out of `renderStatsTableInto` to a module-scoped constant. The inline form keeps the cuts visible at the point of use.
- Do not move the marker-row body into this feature. The empty `markerRows` array (`extraMarkers.map(...)`) is *the slot*; feature 0017 fills it.

### RED gate

On an un-implemented build (e.g. `renderStatsTableInto` is a stub that logs the inputs and returns):
- Manual step 2: `<tbody id="stats-tbody">` is empty after pressing Run.
- Manual step 3: no `<span class="ok|caution|warn">` exists anywhere in the table.
- Manual step 8: row count is `0` after both Runs (or accumulates if the stub appends).
- Manual step 10 (empty plan): same emptiness; no observable difference from a populated plan.

### Test immutability rule

Same as Phase 1: N/A in the current project. If tests are added later, they're off-limits to the implementation session.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-9 all pass.
- [ ] `renderStatsTableInto` is the *only* writer of `<tbody>` content for any stats table (org or per-team).
- [ ] The risk-tier classifier matches [ADR-0013](../adr/0013-three-tier-risk-colouring.md)'s strict-greater discipline at both `0.25` and `0.5`.
- [ ] The capacity row remains the `<tr>` immediately before the marker rows; the `tr:last-child` bold styling is preserved whether or not markers are present.
- [ ] Per-team tables (feature 0011) render via the same function without modification.
- [ ] Per-Marker rows (feature 0017) append into the same `<tbody>` after the capacity row without modification here.
- [ ] `git diff` touches only `index.html` (ADR-0001).
