# Feature: MoSCoW three-scenario forecasting

Created at: 2026-05-21T00:00:00Z

## Context

This feature is the *orchestration* layer that sits on top of feature [0003 — Monte Carlo simulation engine](./0003-monte-carlo-simulation-engine.md). Where 0003 turns a single `(K, λ, pool, iterations)` tuple into one sorted distribution, this feature turns the **Target quarter**'s **Initiative**-by-MoSCoW counts into the three side-by-side distributions the user actually compares: **Must Only**, **Must + Should**, **Must + Should + Could**. Everything visible above the engine — the org-level chart (feature 0006) drawn with three overlapping datasets, the org-level stats table (feature 0007) with one column per scenario, the per-team view (feature 0011) that re-uses the same three-scenario layout — assumes the three-scenario shape this feature defines.

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). The orchestrator lives as one function in `index.html`; no router, no scenario plug-in system.
- [ADR-0002 — Client-side only, no backend](../adr/0002-client-side-only.md). All three scenarios run in the browser on one thread.
- [ADR-0004 — Two-file Initiative/Epic model](../adr/0004-two-file-initiative-epic-model.md). MoSCoW is an **Initiative** field, so the bucketing reads only from `editedInitiatives` (not the epics file).
- [ADR-0005 — Content-based column detection](../adr/0005-content-based-column-detection.md). The MoSCoW column is identified by `detectMoscowCol`; this feature reads `row[detectedCols.moscowCol]` and normalises it via `normalizeMoscow`, never hard-coding a header name.
- [ADR-0006 — Monte Carlo with bootstrapped historical sizes](../adr/0006-monte-carlo-with-bootstrapped-sizes.md). The three scenarios share the same fitted λ and the same bootstrap pool; only `K` differs.
- [ADR-0008 — Poisson distribution for epic count](../adr/0008-poisson-epic-count.md). The same per-initiative Poisson sampling applies across all three scenarios — the cumulative-K choice (this feature) is independent of the per-initiative count discipline (ADR-0008).
- [ADR-0009 — Custom seeded PRNG](../adr/0009-custom-seeded-prng.md). The orchestrator re-seeds `rng` and resets the Box-Muller spare *once* at the top of the Run; the three scenarios then share that seeded stream.
- [ADR-0010 — Three-scenario MoSCoW forecasting](../adr/0010-three-scenario-moscow-forecasting.md). The architectural decision this feature implements.

Glossary terms used below: **Initiative**, **MoSCoW**, **Scenario**, **Run**, **Iteration**, **Target quarter**, **Historical quarter**, **Poisson λ**, **Bootstrap pool**, **Capacity**, **Person-month (PM)** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user who has loaded both CSVs, picked a **Historical quarter** and a **Target quarter**, and pressed **Run Simulation** sees three coloured datasets overlaid on the same chart (Must Only / Must + Should / Must + Should + Could) and a stats table with one column per scenario — every row (P10, P25, P50, P75, P90, Mean, `P(effort > capacity)`, and any custom marker rows) reports three numbers side by side. The sidebar preview block updates *before* the Run to show the MoSCoW count breakdown (`Must`, `Should`, `Could`, `Won't`, unknown) and the three `K` values, so the user can see what each scenario will be summing over.

`Won't` and unknown initiatives are visible in the preview's count breakdown but contribute to none of the three scenarios. If the **Target quarter** contains zero in-scope (non-`Won't`, non-unknown) initiatives, all three distributions collapse to the all-zeros distribution and the table reads `0.0` for every percentile — which is the honest answer to "what is the effort of an empty plan", not a defect.

If one or two of the three buckets are empty (e.g. a plan with only Musts so `#Should = #Could = 0`), the corresponding scenarios still render: Must + Should = Must Only, Must + Should + Could = Must Only, and the three datasets overlap visually on the chart. This is intentional — collapsing them to one would force the user to mentally re-check the table to confirm "yes, they're the same because Should and Could are empty".

## Scope

### In scope
- MoSCoW bucketing of `editedInitiatives` filtered to `targetQuarters`: producing `moscowGroups = { must, should, could, wont, unknown }` from `normalizeMoscow(row[moscowCol])` (`index.html:1768-1769`).
- Computing the three K values (`kMust`, `kMustShould`, `kMustShouldCould`) as cumulative bucket sums (`index.html:1771-1773`), with `Won't` and unknown excluded from every scenario.
- The orchestrator `runSimulation({ lambda, epicSizingDist, kMust, kMustShould, kMustShouldCould, capacity, iterations, fixedEffort })` (`index.html:2086`): re-seeds the PRNG and Box-Muller spare *once*, dispatches three calls to `runScenario` (feature 0003), and returns one `{ mustOnly, mustShould, mustShouldCould, globalMin, globalMax, fixedEffort }` payload.
- Per-scenario K=0 short-circuit: when a `K` is zero, the orchestrator returns the all-zeros `Float64Array(iterations)` for that scenario instead of calling `runScenario` (avoiding work that would also return all zeros — see ADR-0006's Monte Carlo discipline).
- The shared seeding discipline: the three scenarios within one Run share one PRNG seed; the seed is `Date.now()` mixed via SplitMix32 at the top of `runSimulation`.
- Returning the `globalMin` / `globalMax` clipped at the P99.5 of the three scenarios' shifted distributions (`index.html:2115-2118`) so downstream histogram binning (feature 0006) can use a shared, comparable x-axis across scenarios.
- The MoSCoW count breakdown returned in `preview.moscowGroups` (`index.html:1785`) so the sidebar preview (feature 0009) can display what is in / out of scope.

### Out of scope
- The single-scenario engine `runScenario` and the underlying samplers / PRNG. That is feature [0003](./0003-monte-carlo-simulation-engine.md).
- The chart rendering of the three overlapping datasets. That is feature [0006](../../backtracked-features.md#0006) (`renderChartOnCanvas`, `index.html:2159`).
- The stats table layout with per-scenario columns. That is feature [0007](../../backtracked-features.md#0007) (`renderStatsTableInto`, `index.html:2357`).
- The constant-work effort shift applied after the three scenarios run. That is feature [0015](../../backtracked-features.md#0015) (`fixedEffort` arg + the post-sort shift, `index.html:2103-2117`); this feature accepts `fixedEffort` as a pass-through and does not own its semantics.
- The team-scoped re-use of the same three-scenario shape. That is feature [0011](../../backtracked-features.md#0011) (`renderTeamSection`, `index.html:2422`); this feature defines the shape that team-level code consumes.
- The MoSCoW *normalisation* (`normalizeMoscow`) and the MoSCoW *column detection* (`detectMoscowCol`). Those are owned by features 0001 (CSV upload) and 0002 (content-based detection) respectively; this feature just calls them.
- The sidebar preview rendering. That is feature [0009](../../backtracked-features.md#0009) (`renderPreview`, `index.html:2818`); this feature only populates the `preview.moscowGroups` and `K` fields the preview reads from.
- Any future "configurable bucket set" or "per-bucket scenario" UI. ADR-0010 explicitly defers those.

## Relevant existing files
Claude may inspect:
- `index.html`, specifically:
  - `normalizeMoscow` (`index.html:1482`).
  - `prepareSimulationData`, especially STEP 3 — Target quarter initiative counts by MoSCoW (`index.html:1765-1788`).
  - `runSimulation` (`index.html:2086-2141`).
  - The org-level chart and stats table for context only (`renderChartOnCanvas`, `renderStatsTableInto`).
- `CONTEXT.md` glossary, especially the "Planning vocabulary" group (**MoSCoW**, **Scenario**, **Run**, **Target quarter**, **Capacity**).
- ADRs 0006, 0008, 0009, 0010 for the constraints this feature must respect.

Claude should not inspect unless needed:
- The CSV parsing / column detection blocks — upstream and produce the inputs this feature reads.
- The chart, stats-table, and marker code — downstream consumers of this feature's output shape.
- The Team Level / Team Projections sections — they re-use the same three-scenario shape but do not change it.

## Existing patterns to follow
- **Layering inside `index.html`**: this feature lives in Module 4 (data prep — `prepareSimulationData`) and Module 5 (engine — `runSimulation`). Module 5 calls Module 4's outputs and Module 3's `runScenario` (feature 0003); it must not reach down into Module 2's samplers directly.
- **Single MoSCoW reader**: every MoSCoW comparison in this feature goes through `normalizeMoscow(row[detectedCols.moscowCol])`. Do not introduce a second normaliser, do not branch on `row.moscow` directly, do not lowercase / trim inline.
- **Cumulative K, not bucket K**: the three scenarios are *cumulative unions of buckets*. `kMustShould = #Must + #Should` (not `#Should`); `kMustShouldCould = #Must + #Should + #Could` (not `#Could`). This is the load-bearing choice in ADR-0010; reversing it would invert what the chart means.
- **`Won't` and unknown are excluded uniformly**: they appear in `moscowGroups` for the preview but contribute to none of the three K values. There is no scenario that includes them.
- **Once-per-Run reseed**: the PRNG is re-seeded and the Box-Muller spare is reset exactly once at the top of `runSimulation`, before any `runScenario` call. The three scenarios then share that stream — see ADR-0010's "shared seed" rationale.
- **Per-scenario K=0 short-circuit**: `kMust > 0 ? runScenario(...) : new Float64Array(iterations)` (and symmetrically for the other two). This is *not* an optimisation — it is the contract that an empty bucket set yields the all-zeros distribution, which downstream stats and histogram code rely on.
- **Float64Array all the way through**: every per-scenario `sorted` field is a `Float64Array` (sorted ascending). Feature 0007's binary-search percentile lookup and feature 0006's bin assignment both depend on this; see feature 0003 for the upstream contract.
- **Shared `globalMin` / `globalMax`**: the chart x-axis is clipped at the maximum of the three scenarios' P99.5 (`index.html:2116-2118`), so the three overlapping datasets share comparable bins. `globalMin` equals `fixedEffort` (the constant-work shift); when there is no constant work it is `0`.
- **No framework, no library**: vanilla JS. No router, no plugin system, no scenario registry — the three scenarios are *named fields* on the return payload, not array elements.
- **Verification command**: there is no automated test harness in this project. Verification is manual: open `index.html` in a browser (`open index.html` on macOS), load known-good CSVs, press Run, and inspect the chart, stats table, and preview against expectations.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer — this is a client-side-only app (ADR-0002). In-memory state read and produced by this feature:

```js
// Read-only inputs (populated upstream by feature 0001 / 0002)
const editedInitiatives = /* Array<RowObject> */;
const detectedCols      = { initKeyCol, moscowCol, /* ... */ };

// Produced by Module 4 — prepareSimulationData(histQuarters, targetQuarters)
{
  lambda:           Number,            // fitted Poisson λ from the historical quarter
  epicSizingDist:   string[],          // bootstrap pool of t-shirt size labels
  kMust:            Integer ≥ 0,       // #Must in target quarter
  kMustShould:      Integer ≥ 0,       // #Must + #Should
  kMustShouldCould: Integer ≥ 0,       // #Must + #Should + #Could
  preview: {
    moscowGroups:   { must, should, could, wont, unknown },  // raw bucket counts
    kMust, kMustShould, kMustShouldCould,
    // ... other fields owned by feature 0009
  }
}

// Produced by Module 5 — runSimulation({ lambda, epicSizingDist, kMust, kMustShould, kMustShouldCould, capacity, iterations, fixedEffort })
{
  mustOnly:        { sorted: Float64Array, stats: { p10, p25, p50, p75, p90, mean, pExceed }, hist: { counts, binCenters, binWidth } },
  mustShould:      { sorted: Float64Array, stats: ..., hist: ... },
  mustShouldCould: { sorted: Float64Array, stats: ..., hist: ... },
  globalMin:       Number,             // = fixedEffort
  globalMax:       Number,             // = max(P99.5 of the three shifted scenarios, fixedEffort + 1)
  fixedEffort:     Number,             // pass-through from input
}
```

The three per-scenario fields (`mustOnly`, `mustShould`, `mustShouldCould`) are *named*, not array-indexed. Adding a fourth scenario would require changes here and at every downstream consumer (chart legend, stats table headers, marker rows) — see ADR-0010 for why we do not.

---

## Phase 1: MoSCoW bucketing of the target quarter

### Acceptance behavior

Scenario AT-1: Each MoSCoW priority lands in its own bucket
Given an Initiatives CSV with five rows in the **Target quarter**: one `Must`, one `Should`, one `Could`, one `Won't`, one with an unparseable MoSCoW value (e.g. empty string)
And the **Historical quarter** is populated normally
When `prepareSimulationData(histQuarters, targetQuarters)` is called
Then `preview.moscowGroups` is `{ must: 1, should: 1, could: 1, wont: 1, unknown: 1 }`
And `kMust === 1`
And `kMustShould === 2`
And `kMustShouldCould === 3`

Scenario AT-2: `Won't` and unknown are excluded from every K
Given an Initiatives CSV with three `Won't` initiatives and two unknown-MoSCoW initiatives in the **Target quarter** and no other initiatives
When `prepareSimulationData(histQuarters, targetQuarters)` is called
Then `preview.moscowGroups.wont === 3`
And `preview.moscowGroups.unknown === 2`
And `kMust === 0` and `kMustShould === 0` and `kMustShouldCould === 0`
(This is the in-scope-empty-plan case; downstream the three scenarios will collapse to all-zeros distributions — see Phase 2 AT-3.)

Scenario AT-3: MoSCoW normalisation is the single reader
Given an Initiatives CSV where one row's `moscow` cell reads `"📌 Must have"` (emoji + extra text) and another reads `"Should-do"` (suffixed)
When `prepareSimulationData(...)` is called
Then both rows are bucketed correctly (`must` and `should`)
And no path in this feature inspects the raw cell value outside of `normalizeMoscow`

Scenario AT-4: Multi-quarter target unions
Given the user has selected two **Target quarters** (e.g. `Q3 2026` and `Q4 2026`)
And the Initiatives CSV contains `Must` initiatives in both quarters (2 in Q3, 3 in Q4)
When `prepareSimulationData(histQuarters, ['Q3 2026', 'Q4 2026'])` is called
Then `kMust === 5`
(The K values count across the union of selected quarters, not per-quarter — feature 0010's multi-select expects this.)

Scenario AT-5: K is cumulative, not per-bucket
Given the **Target quarter** has 4 `Must`, 2 `Should`, 3 `Could`
When `prepareSimulationData(...)` is called
Then `kMust === 4`
And `kMustShould === 6` (4 + 2, *not* 2)
And `kMustShouldCould === 9` (4 + 2 + 3, *not* 3)
(This is the load-bearing cumulative-K rule from ADR-0010.)

Scenario AT-6: Edited MoSCoW values are honoured
Given a user has edited an initiative's MoSCoW from `Should` to `Must` in the Initiatives tab (feature 0019)
And `editedInitiatives[i].moscow` reflects the edit (the canonical edit lives on whichever header `detectedCols.moscowCol` points to, which is the same cell the table edited)
When `prepareSimulationData(...)` is called
Then the count breakdown reflects the *edited* value, not the original
(This feature reads from `editedInitiatives`, never from `parsedInitiatives`.)

### Public entry point

In-code: `prepareSimulationData(histQuarters, targetQuarters)` (`index.html:1705`). Called from the org-level Run button handler in Module 7, and indirectly from `prepareTeamSimulationData` (feature 0011).

UI: none directly. The user-visible surface of this phase is whatever the sidebar preview (feature 0009) renders from `preview.moscowGroups` and the three K values.

### Expected observable outcomes
- `preview.moscowGroups` is an object with exactly the five keys `must`, `should`, `could`, `wont`, `unknown`, each a non-negative integer.
- The three K values are cumulative unions: `kMust === moscowGroups.must`, `kMustShould === kMust + moscowGroups.should`, `kMustShouldCould === kMustShould + moscowGroups.could`.
- `moscowGroups.wont` and `moscowGroups.unknown` are reported but contribute to none of the three K values.
- An initiative whose normalised quarter is not in `targetQuarters` does not contribute to any bucket.
- The function is pure with respect to `editedInitiatives` and `detectedCols`: same inputs in → same `moscowGroups` and Ks out.

### Test harness

Acceptance tests:
- Location: **N/A — this project has no automated test suite.** Manual acceptance is performed via the running app and DevTools console.
- Manual steps:
  1. Open `index.html`. Load known-good CSVs.
  2. Pick a **Target quarter** that contains a known mix of MoSCoW priorities (including at least one `Won't` and one unknown). In DevTools console, call `prepareSimulationData(['Q2 2026'], ['Q3 2026'])` (substitute your quarters) and inspect `result.preview.moscowGroups`. Confirm each count matches a hand-count from the CSV.
  3. Confirm `result.kMust + result.preview.moscowGroups.should === result.kMustShould` and `result.kMustShould + result.preview.moscowGroups.could === result.kMustShouldCould`.
  4. Confirm `result.preview.moscowGroups.wont` and `result.preview.moscowGroups.unknown` together account for the difference between the row count of in-target-quarter initiatives and `result.kMustShouldCould`.
  5. Select two target quarters in the multi-select and re-run step 2. Confirm K values sum across the union of selected quarters.
  6. Edit one initiative's MoSCoW in the Initiatives tab and re-run step 2. Confirm the edit moves the count between buckets.

Inner tests:
- Location: **N/A — no test harness.** If a harness is added, `prepareSimulationData` is straightforward to drive: inject `editedInitiatives` and `detectedCols` as arguments (the function currently reads them as module-scoped state).

Verification:
- Manual: walk the DevTools console steps above after opening `index.html`.

Fake-injection wiring:
- N/A. To exercise the function with a specific row set, reassign `editedInitiatives = [...rows]` in the console before the call. Restore by reloading.

### Proposed implementation seams

Stable seams a future test suite may target:
- `normalizeMoscow(raw: string) → 'must' | 'should' | 'could' | 'wont' | 'unknown'` — owned by feature 0001 but consumed verbatim here.
- `prepareSimulationData(histQuarters, targetQuarters) → { lambda, epicSizingDist, kMust, kMustShould, kMustShouldCould, preview }` — pure function of `editedInitiatives`, `parsedEpics`, and `detectedCols`.

Do NOT lock in:
- The internal Map structure used for epic counting (Phase 1 of feature 0003-side data, not this feature).
- Whether MoSCoW bucketing happens in a single pass or in three filtered scans — the visible contract is the count breakdown.

### Behavioral rule

Bucketing the **Target quarter**'s **Initiatives** by **MoSCoW** produces five counts (`must`, `should`, `could`, `wont`, `unknown`), of which only the first three contribute to the simulator's **Scenarios**. The three K values are cumulative unions of those first three: `kMust ⊆ kMustShould ⊆ kMustShouldCould`.

### Invariants
- `kMust ≤ kMustShould ≤ kMustShouldCould` always (cumulative-K invariant).
- `kMust === moscowGroups.must`.
- `kMustShould === moscowGroups.must + moscowGroups.should`.
- `kMustShouldCould === moscowGroups.must + moscowGroups.should + moscowGroups.could`.
- `moscowGroups.wont` and `moscowGroups.unknown` are computed but never added to any K.
- For every **Initiative** `r` in `editedInitiatives` whose quarter is in `targetQuarters`, exactly one of `moscowGroups[k]` is incremented; for every such `r` whose quarter is *not* in `targetQuarters`, no bucket is incremented.
- `moscowGroups.must + moscowGroups.should + moscowGroups.could + moscowGroups.wont + moscowGroups.unknown === (count of editedInitiatives rows whose quarter is in targetQuarters)`.

### Counterexamples (must NOT pass)
- A bucketing pass that reads `r.moscow` directly instead of `r[detectedCols.moscowCol]` — would silently fail on the **Quirky format** where MoSCoW lives in the column named `emoji`.
- A K calculation that sets `kMustShould = moscowGroups.should` (per-bucket instead of cumulative) — inverts ADR-0010's load-bearing choice. The chart would then show three *independent* slices instead of three cumulative plans.
- A bucketing pass that folds `Won't` or unknown into `Could` (or any other bucket) "to be inclusive" — silently inflates every scenario and violates ADR-0010's exclusion rule.
- A bucketing pass that reads from `parsedInitiatives` instead of `editedInitiatives` — silently ignores any in-tab edits the user made via feature 0019.
- A K calculation that treats `kMustShould` as `Math.max(moscowGroups.must, moscowGroups.should)` or any other non-additive combination — produces wrong forecasts.

### Forbidden shortcuts
- Do not inline a MoSCoW normaliser. There is exactly one (`normalizeMoscow`), and it is shared with the team-level and projections code paths.
- Do not lowercase / trim the raw cell value at the call site. `normalizeMoscow` already does this and also strips emoji prefixes; duplicating that here drifts.
- Do not add a fourth scenario or a fourth K field "as a stub for later". ADR-0010 explicitly defers that, and adding a stub field would force downstream features (chart, table, marker rows) to either render an empty column or hide it conditionally — both worse than the current shape.
- Do not exclude `Won't` from the preview's count breakdown. The user must see what is being dropped on this Run.

### RED gate

On an un-implemented build (e.g. `prepareSimulationData` returns a stub with `kMust = 0, kMustShould = 0, kMustShouldCould = 0`):
- Manual step 2: every bucket reads `0` regardless of what the CSV contains.
- Manual step 3: the cumulative invariant trivially holds (`0 ≤ 0 ≤ 0`) but is uninformative; the by-hand count from the CSV will disagree.
- Manual step 6: editing an initiative changes nothing in the preview.

### Test immutability rule

There are no test files to freeze in this project (manual harness). If a test suite is later introduced and Phase 1's acceptance steps are codified, those tests live under `tests/acceptance/` and are off-limits to the implementation session — only the test-writing session may edit them.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-6 all pass.
- [ ] `moscowGroups` and the three K values are computed in a single pass over the target-quarter-filtered initiatives.
- [ ] No occurrence of `r.moscow`, `r.MoSCoW`, or any other direct MoSCoW header read anywhere in this feature's code — every read goes through `r[detectedCols.moscowCol]`.
- [ ] No occurrence of MoSCoW lowercasing / keyword matching outside `normalizeMoscow`.
- [ ] `git diff` touches only `index.html` (ADR-0001).

---

## Phase 2: Three-scenario orchestration — `runSimulation`

### Acceptance behavior

Scenario AT-1: One Run produces three named per-scenario result blocks
Given the user has loaded both CSVs and pressed **Run Simulation**
When `runSimulation({ lambda, epicSizingDist, kMust, kMustShould, kMustShouldCould, capacity: 120, iterations: 10000, fixedEffort: 0 })` is called with `kMust=3, kMustShould=7, kMustShouldCould=10` and `lambda > 0, epicSizingDist.length > 0`
Then the returned object has exactly the three per-scenario fields `mustOnly`, `mustShould`, `mustShouldCould`
And each has `sorted: Float64Array(10000)`, `stats: { p10, p25, p50, p75, p90, mean, pExceed }`, `hist: { counts, binCenters, binWidth }`
And `globalMin === 0` and `globalMax > 0`
And `fixedEffort === 0`

Scenario AT-2: The three scenarios are ordered by structural K
Given the inputs from AT-1 with `kMust=3, kMustShould=7, kMustShouldCould=10`
When `runSimulation(...)` is called
Then `mustOnly.stats.p50 ≤ mustShould.stats.p50 ≤ mustShouldCould.stats.p50` (within Monte Carlo noise — strict inequality is expected; ties are tolerated for K-equal cases)
And the same ordering holds for `mean` and `pExceed`
(This is the visible consequence of cumulative K + shared seed: larger K cannot produce a smaller forecast.)

Scenario AT-3: All three Ks zero → all-zeros distributions
Given `kMust = kMustShould = kMustShouldCould = 0`
When `runSimulation(...)` is called
Then `mustOnly.sorted`, `mustShould.sorted`, `mustShouldCould.sorted` are each `Float64Array(iterations)` containing all zeros
And every percentile in each `stats` block reads `0`
And `pExceed === 0` for each scenario (since `0 ≤ capacity`)
And `globalMax === fixedEffort + 1` (the floor guarding against a zero-width chart)

Scenario AT-4: A subset of Ks zero — non-zero scenarios run, zero scenarios short-circuit
Given `kMust = 0` and `kMustShould = 5` and `kMustShouldCould = 8`
When `runSimulation(...)` is called
Then `mustOnly.sorted` is all zeros (short-circuited; no `runScenario` call made for it)
And `mustShould.sorted` and `mustShouldCould.sorted` are non-trivial distributions
And `mustOnly.stats.p50 === 0`, `mustOnly.stats.pExceed === 0`

Scenario AT-5: PRNG is re-seeded exactly once per Run
Given any valid inputs
When `runSimulation(...)` is called
Then `new Xoshiro128ss(...)` is constructed exactly once at the top
And `resetBoxMuller()` is called exactly once, immediately after
And the three `runScenario(...)` calls *share* the resulting PRNG stream — there is no re-seed between them
(Verify by spying on the PRNG instance: it is the same object throughout the three scenarios.)

Scenario AT-6: Successive Runs are not byte-identical
Given any valid inputs
When `runSimulation(...)` is called twice in succession (e.g. user clicks Run, then clicks Run again)
Then the two pairs of `mustOnly.sorted` arrays are not byte-identical (because the seed is `Date.now()`-derived)
And the two pairs of `stats.p50` values differ by less than 5% of each other (large-iterations stability)

Scenario AT-7: `globalMax` clips at the P99.5 of the three shifted distributions
Given a Run that produces a distribution with a long right tail (e.g. an XL-heavy bootstrap pool and `kMustShouldCould` large)
When `runSimulation(...)` returns
Then `globalMax === Math.max(p995(shiftedMustShould), p995(shiftedMustOnly), p995(shiftedMustShouldCould), fixedEffort + 1)`
And `globalMin === fixedEffort` (which is `0` in the no-constant-work case)
(This drives feature 0006's shared-x-axis chart.)

Scenario AT-8: `fixedEffort` is a uniform shift applied after `runScenario`
Given `fixedEffort = 30` and otherwise the inputs from AT-1
When `runSimulation(...)` is called
Then each per-scenario `sorted` array is `runScenario(...)` ∘ shift-by-30
And `globalMin === 30`
And the `sorted` arrays remain sorted ascending after the shift
(The shift contract is owned by feature 0015; this phase just verifies the pass-through.)

### Public entry point

In-code: `runSimulation({ lambda, epicSizingDist, kMust, kMustShould, kMustShouldCould, capacity, iterations, fixedEffort = 0 })` (`index.html:2086`). Called from the org-level Run handler in Module 7 and from `renderTeamSection` (feature 0011).

UI: the **Run Simulation** button (`#run-btn`, owned by feature 0001) is the user-visible trigger. The three datasets on the chart and the three columns of the stats table (features 0006, 0007) are the user-visible outputs.

### Expected observable outcomes
- The returned object's shape matches the contract in *Data models* exactly: three named scenario blocks plus `globalMin`, `globalMax`, `fixedEffort`.
- Each scenario block's `sorted` is a `Float64Array` of length `iterations`, sorted ascending, all-finite, non-negative.
- The three scenarios were produced from a single re-seeded PRNG stream (one `new Xoshiro128ss(...)` and one `resetBoxMuller()` at the top of the call).
- The cumulative-K invariant translates to a stochastic-dominance ordering on the three distributions: `mustOnly ⪯ mustShould ⪯ mustShouldCould` in distribution (verifiable by comparing percentiles at large iteration counts).
- No call into this function calls `Math.random()` directly. All randomness flows through the module-scoped `rng`.
- No `console.warn` lines unless the bootstrap pool contains an unrecognised t-shirt size (in which case the warning belongs to feature 0003's `sampleLognormal`, not this feature).

### Test harness

Acceptance tests:
- Location: **N/A — manual.** Same rationale as Phase 1.
- Manual steps:
  1. Open `index.html` and load known-good CSVs. Pick quarters that yield non-zero K values across all three buckets. Press **Run Simulation**.
  2. Inspect the stats table: confirm three columns (Must Only / Must + Should / Must + Should + Could) and that each row's three values increase left → right (modulo tie cases).
  3. Inspect the chart: confirm three overlapping coloured datasets, one per scenario, sharing the same x-axis.
  4. Press **Run Simulation** again. Confirm the chart redraws with *similar but not byte-identical* distributions (visual stability of P50, jitter in the tails).
  5. Edit the Initiatives tab (feature 0019) so the **Target quarter** has only `Won't` and unknown initiatives. Press Run. Confirm all three scenarios' distributions read `0.0` for every percentile.
  6. Edit so the **Target quarter** has only `Must` initiatives (no Should, no Could). Press Run. Confirm the three datasets overlay perfectly (Must Only = Must + Should = Must + Should + Could).
  7. In DevTools console: `const r = runSimulation({ lambda: 5, epicSizingDist: Array(100).fill('M'), kMust: 0, kMustShould: 0, kMustShouldCould: 0, capacity: 120, iterations: 10000, fixedEffort: 0 });` and confirm every `r.mustOnly.sorted[i] === 0` (and the same for the other two).
  8. Repeat step 7 with `fixedEffort: 30` and confirm every `r.mustOnly.sorted[i] === 30` (constant-work shift on the all-zeros distribution).

Inner tests:
- Location: **N/A.** If a harness is added, `runSimulation` is a pure function of its arguments plus the global `rng`; the natural seam is to pass a seeded `Xoshiro128ss` instance as an optional argument (currently constructed internally).

Verification:
- Manual: walk the steps above after `open index.html`.

Fake-injection wiring:
- N/A. To pin randomness for a manual test, reassign `rng = new Xoshiro128ss(specificSeed); resetBoxMuller();` *after* calling `runSimulation` — note that `runSimulation` will reseed at the top of its body, so you cannot pre-seed it; you would have to temporarily comment out the reseed line.

### Proposed implementation seams

Stable seams:
- `runSimulation(opts) → { mustOnly, mustShould, mustShouldCould, globalMin, globalMax, fixedEffort }` — the orchestration contract. Adding a fourth scenario would change this contract; deferred per ADR-0010.

Do NOT lock in:
- The internal `shift` helper (currently an inline closure) — it could be replaced by a numeric loop or `Float64Array.map`-style construct as long as sortedness is preserved.
- The exact P99.5 percentile chosen for `globalMax` clipping — it is a chart-readability knob owned in spirit by feature 0006, hosted here only because the three scenarios need to *share* the same clip.
- The order in which the three `runScenario` calls happen — currently MS, M, MSC; the result is order-independent because they all read from the same PRNG stream and write into named fields.

### Behavioral rule

A single **Run** executes exactly three **Scenarios** — Must Only, Must + Should, Must + Should + Could — on the same fitted Poisson λ, the same **Bootstrap pool**, the same capacity, and the same once-per-Run PRNG seed. Each scenario differs from the others only in its `K` (the cumulative MoSCoW bucket sum from Phase 1). Empty-K scenarios short-circuit to the all-zeros distribution. The three sorted distributions are uniformly shifted by `fixedEffort` (the constant-work pass-through) before stats and histogram derivation.

### Invariants
- The returned object has *exactly* the three per-scenario fields `mustOnly`, `mustShould`, `mustShouldCould` plus `globalMin`, `globalMax`, `fixedEffort`. No additional scenarios, no array-indexed fields.
- `runSimulation` calls `new Xoshiro128ss(...)` exactly once and `resetBoxMuller()` exactly once per invocation.
- For each scenario `s`, `result[s].sorted.length === iterations`, `result[s].sorted` is a `Float64Array`, and `result[s].sorted` is sorted ascending.
- `result[s].sorted[i] ≥ fixedEffort` for every `s, i` (the shift floor).
- `globalMin === fixedEffort`.
- `globalMax ≥ fixedEffort + 1` (chart-width floor).
- For two Runs with the *same* `lambda, epicSizingDist, K*` inputs but different system clocks, the two `sorted` arrays are not byte-identical.
- The cumulative-K stochastic-dominance ordering holds (in distribution) at large iteration counts: `P50(mustOnly) ≤ P50(mustShould) ≤ P50(mustShouldCould)`.

### Counterexamples (must NOT pass)
- A `runSimulation` that re-seeds the PRNG between scenarios — destroys ADR-0010's shared-seed contract and silently inflates the cross-scenario noise. The visible symptom is that successive Runs no longer preserve the cumulative-K ordering reliably at small iteration counts.
- A `runSimulation` that returns scenarios as an array (`results: [mustOnly, mustShould, mustShouldCould]`) — every downstream consumer reads `.mustOnly` etc. by name; switching to array form would silently break the chart legend, the stats table headers, and the marker-row code.
- A `runSimulation` that runs only the non-zero-K scenarios and *omits* the zero-K fields from the returned object — downstream `renderStatsTableInto` (feature 0007) reads all three unconditionally; missing fields crash. The contract is that zero-K scenarios are returned as all-zeros, not absent.
- A `runSimulation` that applies the constant-work shift *before* sorting — `Float64Array.sort()` is numeric and idempotent on a constant shift, so this would coincidentally produce the right answer, but the symmetry breaks the moment the shift becomes non-uniform (which is what ADR-0006's bootstrap discipline forbids anyway, but the code shape would invite that bug).
- A `runSimulation` that computes `globalMax` from only `mustShouldCould.p995` instead of `max(p995 of all three)` — would clip the (rare) case where one scenario has a heavier tail than another and one scenario's histogram would be cut off.
- A `runSimulation` that calls into Module 2's samplers directly instead of going through `runScenario` — violates the layering set by feature 0003.

### Forbidden shortcuts
- Do not collapse the three `runScenario` calls into a loop over `[kMust, kMustShould, kMustShouldCould]` and an array-indexed return value. The named-field shape is load-bearing across features 0006, 0007, 0011, 0015.
- Do not add a "fourth scenario" stub (e.g. "All including Won't") or a per-bucket scenario (e.g. "Could only"). ADR-0010 defers both.
- Do not parallelise the three scenarios via Web Workers. Same reasoning as feature 0003's Phase 2: single-file constraint (ADR-0001), and the wall-clock at 10,000 iterations × 3 scenarios is already interactive.
- Do not call `runSimulation` recursively or from within `runScenario`. Layering is strict.
- Do not re-seed the PRNG inside `runScenario` — ADR-0010's shared-seed discipline is owned at this layer, not below.
- Do not move the K=0 short-circuit *into* `runScenario`. That layer already handles K=0 correctly (per feature 0003 Phase 2 AT-1), but the short-circuit at this layer is an explicit contract: it documents that "an empty scenario yields the all-zeros distribution" is a *scenario-level* fact, not an engine-level optimisation.

### RED gate

On an un-implemented build (e.g. `runSimulation` is a stub that returns three zero-filled `Float64Array`s in all three slots):
- Manual step 2 (three columns increasing): every column reads `0.0` and the ordering is uninformative.
- Manual step 4 (back-to-back Runs): the two Runs look identical (both all zeros).
- Manual step 7 (all-Ks-zero console smoke test): trivially passes because everything is zero — *also* trivially passes on the real implementation, so the discriminating step is step 6 (Musts-only): on a stub, the three datasets overlay perfectly at `0`, not at some positive distribution.

### Test immutability rule

Same as Phase 1: N/A in the current project.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-8 all pass.
- [ ] `runSimulation` calls `new Xoshiro128ss(...)` and `resetBoxMuller()` exactly once per invocation (visible by inspecting `index.html:2088-2089`).
- [ ] The K=0 short-circuit is in place for each of the three scenarios independently.
- [ ] The cumulative-K ordering is observable at default iterations on a non-trivial CSV (P50s ascend left → right in the stats table).
- [ ] The `fixedEffort` pass-through is applied as a uniform shift on the sorted arrays (sortedness preserved).
- [ ] `globalMin === fixedEffort` and `globalMax` is the max of the three P99.5 values (with the `fixedEffort + 1` floor).
- [ ] `git diff` touches only `index.html` (ADR-0001).
