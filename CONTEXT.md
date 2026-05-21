# Software Effort Simulator

A Monte Carlo simulator that, given a historical quarter's body of work and a target quarter's planned initiatives, projects the probability that delivery effort will fit within available team capacity.

## Language

### Work items

**Initiative**:
A unit of planned work that belongs to one quarter, one team, and one MoSCoW priority. Initiatives are sampled by *count* (Poisson) and *generate* zero or more Epics.
_Avoid_: project, ticket, story, feature (in the product-management sense).

**Epic**:
A child of an Initiative carrying a t-shirt size. The size is what the simulator actually samples to produce effort, via a lognormal distribution. An Epic without a parent Initiative is an *orphan epic* (currently unhandled).
_Avoid_: task, sub-task, work item.

**Initiative key**:
The Jira-style identifier (e.g. `INIT-123`) that links an Epic to its parent Initiative. Stored on the Epic as the link column, surfaced internally as `_initiative_key`.
_Avoid_: parent id, ticket id.

**Constant work**:
Deterministic, guaranteed work assigned to a specific team/quarter pair. Bypasses Monte Carlo sampling — its effort is computed from t-shirt size as the lognormal mean and added as a fixed shift to every iteration's output.
_Avoid_: fixed work, baseline work.

### Sizing and effort

**T-shirt size**:
The categorical effort label on an Epic — one of `2XS`, `XS`, `S`, `M`, `L`, `XL`, `XL+`. Each size maps to a lognormal distribution over person-months.
_Avoid_: estimate, story points, complexity.

**Person-month (PM)**:
The unit of effort throughout the system: one engineer working for one calendar month. All capacities, samples, and statistics are expressed in PM.
_Avoid_: man-month, FTE-month, sprint-points.

**Synthetic parameters**:
The default lognormal parameter set, fit to the documented P10/P90 of each t-shirt size band.
_Avoid_: theoretical, default, calibrated.

**Empirical parameters**:
An alternative parameter set, bias-corrected from realised effort in Q1 2026. Selected via the sidebar radio; swapping is global and affects all samplers.
_Avoid_: actual, real-world, fitted.

**Poisson λ**:
The mean of the Poisson distribution from which each **Initiative**'s epic count is drawn. Fitted in `prepareSimulationData` as the average count of in-scope **Epics** per in-scope **Initiative** over the **Historical quarter**. One scalar per Run at the org level; one per team in the Team Level tab.
_Avoid_: rate, mean, average epics.

**Bootstrap pool**:
The flat array of historical **T-shirt size** labels — one entry per in-scope **Epic** in the **Historical quarter** — that each **Iteration**'s epic sizes are drawn from uniformly with replacement. Size labels that are not a **Recognised t-shirt size** are excluded from the pool.
_Avoid_: empirical distribution, sample pool, size population.

### Organisational unit

**Team**:
The owning unit of an **Initiative**, drawn from the initiative's team column (the **Sensible format** uses `teams`, the **Quirky format** uses the value-detected variant). Within `prepareTeamSimulationData` (`index.html:1802`), teams are deduplicated case-insensitively with first-seen casing preserved and sorted alphabetically case-insensitively. The **Team Level tab** renders one section per team present in the selected **Target quarter(s)**.
_Avoid_: squad, group, tribe, owner.

### Planning vocabulary

**Quarter**:
A label like `Q3 2026`. The unit of time the simulator works in. Initiatives and Epics each carry a quarter.
_Avoid_: sprint, period, cycle.

**Historical quarter**:
The quarter (or set of quarters) used to fit the model: Poisson λ over initiative count and the bootstrap pool of t-shirt sizes. Selected via the **Quarter selector** `#hist-ms` in the sidebar.
_Avoid_: source, baseline, reference quarter.

**Target quarter**:
The quarter (or set of quarters) being forecast. Initiatives in the target quarter are bucketed by MoSCoW and counted as `K` for each scenario. Selected via the **Quarter selector** `#target-ms` in the sidebar.
_Avoid_: forecast quarter, projected quarter, future quarter.

**Quarter selector**:
The sidebar multi-select widget the user picks **Historical quarter**(s) or **Target quarter**(s) with — a custom-built combo box (`MultiSelect` class, `index.html:1083`) showing a chip strip plus a checkbox dropdown. The simulator instantiates two: `#hist-ms` (Historical) and `#target-ms` (Target). Each is populated by `refreshQuarters` from the chronologically-sorted union of quarter labels present in the loaded **Initiatives CSV** and **Epics CSV** (`extractQuarters`, `index.html:1073`). Read via `histMS.getSelected()` / `targetMS.getSelected()`, both returning `string[]`. Every checkbox toggle and every chip-`✕` click dispatches a single bubbling `ms-change` `CustomEvent` on the wrapper; the canonical observation contract — see [ADR-0017](docs/adr/0017-multi-quarter-selectors.md). Selecting zero quarters is allowed at the widget level; downstream consumers (the **Data preview**'s guard, the run-button handler's gate) decide whether to act on the empty selection.
_Avoid_: quarter dropdown, quarter picker, multi-select, combo box.

**MoSCoW**:
The priority label on an Initiative — one of `Must`, `Should`, `Could`, `Won't`, or unknown. `Won't` and unknown initiatives are excluded from every scenario.
_Avoid_: priority, tier, importance.

**Scenario**:
One of the three forecasts the simulator runs side-by-side, defined by which MoSCoW buckets are included: **Must Only**, **Must + Should**, **Must + Should + Could**.
_Avoid_: case, projection, model.

**Capacity**:
The PM budget the team commits to deliver in the target quarter. Configured via the sidebar (`#capacity`), default 120 PM. Every scenario's risk is reported as `P(effort > capacity)`. Rendered on every chart as an auto-managed **Marker** (red dashed vertical line, label `Capacity: {value} PM`) via `ensureCapacityMarker`; the user can recolour or relabel the line from the marker dialog, but cannot delete it, and its `value` is overwritten from the sidebar input on every **Run**.
_Avoid_: budget, headcount, throughput.

**Iteration**:
One draw of the Monte Carlo loop: sample `numEpics ~ Poisson(λ)` for each of the `K` initiatives, sample each epic's effort from `Lognormal(μ, σ)` by t-shirt size, sum to a total. The iteration count is user-configured via `#iterations` (default 10,000 in the HTML, 1,000,000 if the field is empty when **Run** is pressed), clamped to `[1000, 10000000]`.
_Avoid_: trial, sample, run (which means the whole batch).

**Run**:
A single press of `Run Simulation`. Re-seeds the PRNG and executes `iteration` × 3 scenarios.
_Avoid_: simulation, batch.

**Quick projection Monte Carlo**:
The per-(**Team**, **Quarter**) Monte Carlo run inside `buildTeamProjections` (`index.html:1986-1996`) that produces the **Effort projection band** for the **Team Projections tab**. Uses the same `runSimulation` engine as the headline Run but with three differences: (a) only the MSC **Scenario** is read out (P25/P50/P75 from `mustShouldCould.stats`), (b) the iteration count is *capped* at `projIterations = Math.min(iters, 3000)` (set once in the run-button handler, `index.html:3357`), and (c) **Capacity** is passed as `0` so no risk-gate row is computed and no marker is drawn. Reads the org-wide **Poisson λ** and **Bootstrap pool** verbatim — never the team-scoped ones — see [ADR-0020](docs/adr/0020-team-projections-cross-quarter-view.md). Skipped (band defaults to `cwEffort`) when the team-quarter cell has `kMustShouldCould === 0`, when `orgLambda === 0`, or when `orgEpicSizingDist.length === 0`.
_Avoid_: projection run, mini simulation, quick MC.

### Inputs

**Initiatives CSV**:
A user-supplied file listing one row per Initiative. Carries the Jira key, name, MoSCoW priority, team, quarter, and optionally a Key Result. Required.
_Avoid_: initiative file, input file.

**Epics CSV**:
A user-supplied file listing one row per Epic. Carries the t-shirt size, the parent initiative key, and a quarter. Required.
_Avoid_: epic file, sizing file.

**Constant Work CSV**:
An optional third CSV describing constant-work epics (see *Constant work*).
_Avoid_: fixed-work file.

**Sensible format**:
The CSV layout where headers match their semantics: `jira_key`, `building_block`, `moscow`, `teams`, `quarter`. The recommended layout going forward. The `building_block` and `teams` headers are read by `detectNameCol` and `detectTeamCol` via a *direct header-name match* placed *before* the positional fallback (see [ADR-0021](docs/adr/0021-sensible-csv-format-dual-support.md)); the `jira_key` and `moscow` headers are picked up by the **Content scan** in the normal case and by the **Detection fallback** in degenerate-data cases.
_Avoid_: new format, target format, modern format.

**Quirky format**:
The legacy CSV layout exported by an older internal tooling, where `teams` actually held Jira keys and `emoji` actually held MoSCoW priority. Still parseable because detection scans column *values*, not header names — and because the positional fallbacks inside `detectNameCol` / `detectTeamCol` read the header immediately *before* `initKeyCol` and `moscowCol` respectively (the layout the legacy export imposes). Both **Sensible format** and **Quirky format** remain first-class inputs — see [ADR-0021](docs/adr/0021-sensible-csv-format-dual-support.md).
_Avoid_: old format, legacy format (acceptable in prose, but the canonical term is **Quirky format**).

### Summary statistics

**Stats**:
The per-**Scenario** tuple `{ p10, p25, p50, p75, p90, mean, pExceed }` produced by `computeStats` from a sorted `Float64Array` of per-**Iteration** totals. Exactly one Stats tuple per Scenario per **Run** — three per Run at the org level. Read by the stats table at `#stats-table` and by any per-team or per-**Marker** row that displays a percentile or a **Probability of exceedance**.
_Avoid_: summary, metrics, KPIs.

**Percentile (Pxx)**:
The value at fractional rank `xx/100` in the sorted distribution, computed as `sorted[min(n − 1, floor(p · n))]`. Every reported percentile is an *actual realised Iteration* (not an interpolated value). The simulator reports P10, P25, P50, P75, and P90 — see [ADR-0012](docs/adr/0012-percentile-summary-and-probability-of-exceedance.md). P50 is the **Median**.
_Avoid_: quantile, percentile estimate, interpolated percentile.

**Tail percentile**:
P75 and P90 specifically — the *upper* points used to read overrun risk. The simulator deliberately does *not* report P95 or P99: at the default 10,000 **Iterations** the latter are dominated by Monte Carlo noise and are the territory custom **Markers** are designed for.
_Avoid_: extreme percentile, upper bound.

**Probability of exceedance**:
The fraction of **Iterations** whose total effort *strictly* exceeds a threshold, in `[0, 1]`. The headline cell in the stats table is `P(effort > capacity)`, but the same metric is computed against every non-capacity **Marker** value. Computed by a single binary search over the sorted `Float64Array` via `computePExceed` (or the inline form inside `computeStats`).
_Avoid_: overrun probability, breach probability, P(breach), risk score.

**Risk tier**:
The colour class applied to a **Probability of exceedance** cell in the stats table: `ok` (green) when `pExceed ≤ 0.25`, `caution` (orange) when `0.25 < pExceed ≤ 0.5`, `warn` (red) when `pExceed > 0.5`. Hard-coded; see [ADR-0013](docs/adr/0013-three-tier-risk-colouring.md). Applies identically to the capacity row and to per-**Marker** rows.
_Avoid_: risk level, severity, status, RAG.

### Result tabs

**Tab**:
One of four named views of a **Run**'s output: `Organization Level`, **Team Level tab**, **Team Projections tab**, `Initiatives`. The tab bar (`.tab-bar`, `index.html:982`) holds one `.tab-btn` per tab; exactly one carries the `.active` class at any time. After every Run, the active tab resets to `Organization Level` — see [ADR-0018](docs/adr/0018-tab-based-results-layout.md).
_Avoid_: view, panel (which is the container the tab points to), section (which is the per-**Team** block inside the Team Level tab or **Projection section** inside the Team Projections tab).

**Tab panel**:
The container `<div class="tab-panel">` that holds a Tab's content. Identified by `id="tab-${dataTab}"`; exactly one panel has `display: flex` at a time, the others are `display: none`. Pre-rendered during the Run, not lazy-rendered on tab switch.
_Avoid_: view, page, screen.

**Team Level tab**:
The second **Tab**, `#tab-teams`. Renders one section per **Team** in the selected **Target quarter(s)**, with the team's title row, a `Historical data` radio toggle, a chart card, and a Stats table. Each section runs an *independent* Monte Carlo via `runSimulation`, with K values always team-scoped and **Poisson λ** + **Bootstrap pool** toggleable between team-scoped and org-wide — see [ADR-0019](docs/adr/0019-per-team-independent-simulations.md). Section ordering is the alphabetical case-insensitive sort produced by `prepareTeamSimulationData`.
_Avoid_: per-team tab, teams view, drilldown.

**Historical data toggle**:
The per-section radio pair on the **Team Level tab** that selects which historical parameters to feed the section's Run: `This team only` (uses `teamLambda` + `teamEpicSizingDist`) or `All teams — org-wide` (uses the org-level `lambda` + `epicSizingDist` carried by the same Run). Defaults to *org-wide* when the team has 4 or fewer historical **Initiatives** (`useOrgByDefault === histInitCount <= 4`), surfaced via a yellow `Recommended: only N historical initiatives found for this team` chip. Toggling re-runs *only that team's* Monte Carlo via `renderTeamSection(idx, useOrg)`; the other sections, the org tab, and per-section **Markers** are untouched. K values are *not* toggleable — only the historical scope is.
_Avoid_: source selector, parameter switch, scope toggle.

**Team Projections tab**:
The third **Tab**, `#tab-projections`. A *cross-quarter*, *per-team* view: a single **Summary table** of **Initiative** counts per **Team** per **Quarter** followed by one **Projection section** per team appearing anywhere in the loaded **Initiatives CSV**. The team list is bounded by the *entire CSV*, never by the **Quarter selector**'s **Historical quarter(s)** or **Target quarter(s)** selection — see [ADR-0020](docs/adr/0020-team-projections-cross-quarter-view.md). Built by `buildTeamProjections` (`index.html:1917`) and `renderTeamProjections` (`index.html:2550`); the team-list dedup is the same case-insensitive rule with first-seen casing as the **Team Level tab**. Unlike the Team Level tab, this tab does *not* surface a **Historical data toggle** — every projection runs with the org-wide **Poisson λ** and **Bootstrap pool**.
_Avoid_: projections view, cross-quarter view, forecast tab.

**Projection section**:
The per-**Team** block inside the **Team Projections tab** (`.proj-team-section`). Contains the team's title, a `proj-charts-row` holding two charts side-by-side (the stacked-bar `Initiatives by Quarter` count chart and the `Effort Projection by Quarter` P25/P50/P75 bar chart), and a `.proj-init-table` **Initiative matrix** with a per-quarter MoSCoW badge column per initiative plus footer rows for the per-quarter cumulative count chips and the **Effort projection band**. Sections are appended to `#proj-teams-container` in alphabetical case-insensitive order. Each section's quarter axis (`displayQuarters`) is *always* the full `allQuarters` from `extractQuarters(editedInitiatives)`, regardless of which quarters that team has data in — see [ADR-0020](docs/adr/0020-team-projections-cross-quarter-view.md).
_Avoid_: team projection card, projection panel, drilldown (which is the **Team Level tab**'s per-team block).

### Visualisation

**Histogram**:
The per-**Scenario** tuple `{ counts, binCenters, binWidth }` produced by `buildHistogram` from a sorted `Float64Array` of per-**Iteration** totals. Exactly one Histogram per Scenario per **Run** — three per Run at the org level.
_Avoid_: chart data, frequency table, bar data.

**Bin**:
One fixed-width interval over the effort (person-month) axis. There are exactly 60 Bins per Run, shared across all three Scenarios so their bars are directly comparable.
_Avoid_: bucket, band, slot.

**Global histogram range**:
The shared `(globalMin, globalMax)` interval used to compute every Scenario's Bins in a Run. `globalMin` equals the **Constant work** shift (`fixedEffort`; `0` when none is loaded); `globalMax` equals `max(Outlier clip of each Scenario, globalMin + 1)`. Computed once per Run in `runSimulation`.
_Avoid_: chart range, x-range, plot range.

**Outlier clip**:
The P99.5 of a Scenario's sorted distribution, used as that Scenario's contribution to the upper bound of the Global histogram range. Purely a *display* decision — it does not change the simulated distribution and does not affect any percentile or `P(effort > capacity)` value reported in the stats table.
_Avoid_: chart clip, tail clip, P99.5 cap.

**Initiative matrix**:
The wide table inside each **Projection section** (`.proj-init-table`) listing every in-scope **Initiative** for the team as a row, with columns `Jira Key`, optional `KR` ([feature 0014](backtracked-features.md#0014); only present when at least one row in the section has a non-empty Key Result), `Initiative Name`, and one column per **Quarter** in `allQuarters`. A row's MoSCoW badge appears in *exactly* the column matching that initiative's `quarter`; other quarter columns are blank. Rows are sorted Must → Should → Could → Won't → Unknown then alphabetically by Jira key. **Constant work** rows are appended after the sorted Initiatives, tinted soft green (`#f0fdf4`) with the t-shirt size and estimated PM in the name cell (`[M · ~2.12 PM]`). The `<tfoot>` holds two summary rows per section: `Initiatives count` (per-quarter MoSCoW count chips) and `Effort P50 (P25–P75)` (the **Effort projection band** values for each quarter).
_Avoid_: initiative table, projection table, initiative grid.

**Effort projection band**:
The triple `{p25, p50, p75}` produced by the **Quick projection Monte Carlo** for one **Team** in one **Quarter** on the MSC scenario (with `fixedEffort = cwEffort`). Surfaced two ways: (a) as a paired bar on the `Effort Projection by Quarter` chart — a semi-transparent indigo P25–P75 range bar overlaid by a narrower opaque P50 median bar; (b) as a footer row in the **Initiative matrix** showing `~{p50} PM` with `{p25}–{p75}` underneath. When the Quick projection is skipped (no MSC initiatives, zero org λ, or empty bootstrap pool), all three values default to `cwEffort` — surfacing a flat band that reads as "constant-work only" in the chart. The band is deliberately a *three-point summary*, not P10/P90: the 3000-iteration cap on the **Quick projection Monte Carlo** is calibrated to those three quartiles only — see [ADR-0020](docs/adr/0020-team-projections-cross-quarter-view.md).
_Avoid_: projection range, P25–P75 range (which is just one half of the band), percentile band.

### Column detection

**Column detector**:
A function that, given the parsed rows of a CSV, returns the header name corresponding to a known semantic column (Initiative key, MoSCoW, team, name, Epic→Initiative link, Key Result). Downstream code reads `row[headerName]`; nothing else interprets headers.
_Avoid_: parser, mapper, resolver.

**Content scan**:
The detector strategy that iterates over each column and computes the fraction of non-empty values matching a fixed regex (Jira-key pattern for keys, MoSCoW keyword pattern for priorities). The first column whose match ratio exceeds the **Detection threshold** wins.
_Avoid_: regex match, content sniff, value-based detection.

**Detection threshold**:
The fraction of non-empty values that must match the regex for a content scan to claim a column. Currently `> 0.5` for the Initiative key and MoSCoW columns, `> 0.4` for the Epic→Initiative link column. Header-name fallback applies when no column clears the threshold.
_Avoid_: confidence, score.

**Detection fallback**:
The header-name lookup branch inside a **Column detector**, used when the **Content scan** finds no winning column (empty CSV, or no column above the **Detection threshold**) or — for the name and team detectors only — checked *before* any positional inference. The fallback returns either the **Sensible format** header (`jira_key`, `moscow`, `building_block`, `teams`) or the legacy **Quirky format** header (`teams`, `emoji`). Per-detector branch order is asymmetric and *intentional*: `detectInitKeyCol` and `detectMoscowCol` run the **Content scan** first and treat the **Sensible format** header as a fallback; `detectNameCol` and `detectTeamCol` check the **Sensible format** header *first* and only fall through to positional inference when it is absent — see [ADR-0021](docs/adr/0021-sensible-csv-format-dual-support.md).
_Avoid_: default column, header lookup.

**Recognised t-shirt size**:
A normalised size string (output of `normalizeSize`) that exists as a key in the active `T_SHIRT_PARAMS` map (synthetic or empirical). Used as the tie-breaker when two Epic rows share an `_epic_key` during within-file dedup — the row with a recognised size wins.
_Avoid_: valid size, known size.

### Pre-Run sidebar surfaces

**Data preview**:
The live sidebar block (`#data-preview`) that surfaces the *fitted* model inputs the simulator believes about the currently-loaded CSVs and quarter selection: **Historical quarter**, count of historical **Initiatives**, **Poisson λ**, **Bootstrap pool** size with its per-**T-shirt size** breakdown, **Target quarter**, and the three per-**Scenario** initiative counts (`K_must`, `K_must+should`, `K_must+should+could`). Painted by `renderPreview` from the `preview` field of `prepareSimulationData`'s return value. Hidden until both **Initiatives CSV** and **Epics CSV** are loaded *and* at least one **Historical quarter** and one **Target quarter** are selected; thereafter monotonically visible. Re-paints automatically via `tryUpdatePreview` on every file-load, every epics-reset, and every multi-select change.
_Avoid_: summary, sidebar dashboard, input preview.

**T-shirt size reference**:
The collapsible `<details>` panel in the sidebar showing a static three-column table — `Size`, `Min PM`, `Max PM` — listing the documented P10/P90 band of each **T-shirt size** from `2XS` (`0.10`–`0.25` PM) to `XL+` (`10`–`11` PM). Hand-maintained mirror of the synthetic `T_SHIRT_PARAMS` map (see [ADR-0007](docs/adr/0007-lognormal-effort-distribution.md)); does *not* re-render when the **Empirical parameters** toggle is flipped. Always available, regardless of CSV state.
_Avoid_: size legend, sizing guide, t-shirt key.

**Column-detection debug**:
The collapsible `<details>` panel (`#debug-details`) whose `<pre id="debug-pre">` block shows two JSON sections — `Detected columns` (the live `detectedCols` map written by the **Column detectors**) and `Target MoSCoW breakdown` (the `preview.moscowGroups` field). The trust surface for [ADR-0005](docs/adr/0005-content-based-column-detection.md)'s content-based detection: lets the user verify which header was claimed for each semantic column. Hidden until the first successful **Data preview** paint; written via `textContent` (never `innerHTML`) to neutralise HTML-special characters in user-supplied headers.
_Avoid_: diagnostics, detection log, parser output.

## Relationships

- An **Initiative** belongs to exactly one **Quarter**, exactly one team, and exactly one **MoSCoW** bucket.
- An **Epic** belongs to exactly one **Initiative** (via **Initiative key**) and carries exactly one **T-shirt size**.
- A **Scenario** is a set of MoSCoW buckets ⊆ {Must, Should, Could}; it determines `K`, the count of **Initiatives** included from the **Target quarter**.
- A **Run** executes `iteration` independent **Iterations** per **Scenario**, producing one distribution of total effort per scenario.
- A **Constant work** entry produces a fixed PM shift applied to every **Iteration** of the matching team/quarter, after sorting.
- A **Run** produces one **Histogram** per **Scenario**; all three Histograms in a Run share the same **Global histogram range** and the same Bin count.
- A **Run** also produces one **Stats** tuple per **Scenario**, computed from the same sorted distribution the **Histogram** is built from. The Stats tuple's `pExceed` field is the **Probability of exceedance** against the configured **Capacity**; its **Risk tier** classifies that probability into one of three colour bands.
- A **Marker** (when present) adds one extra row to the stats table whose value is `P(effort > marker.value)` — the same **Probability of exceedance** metric as the capacity row, classified into the same **Risk tier** bands.
- The **Data preview** is read pre-**Run** and reflects the fitted inputs (**Poisson λ**, **Bootstrap pool**, per-**Scenario** `K`) the engine *would* consume if the user pressed **Run** now; it is the upstream-of-the-engine companion to the post-Run **Stats** table.
- The **Column-detection debug** panel is the user-visible audit of `detectedCols` — the same map the **Column detectors** write and that every downstream reader (`prepareSimulationData`, `prepareTeamSimulationData`, `buildTeamProjections`, `renderInitiativesTable`) consumes; surfacing it as JSON in the sidebar makes the otherwise-opaque content-scan outcome reviewable before any **Run**.
- A **Run** produces one **Projection section** per **Team** appearing in the **Initiatives CSV** (not bounded by the **Quarter selector**'s selection — contrast with the **Team Level tab**). Each Projection section contains one **Effort projection band** per quarter where the team has in-scope **Initiatives** or **Constant work**.
- An **Effort projection band** is the `{p25, p50, p75}` output of a **Quick projection Monte Carlo** for one (Team, Quarter) cell — the same engine as the headline Run, with a smaller iteration budget and the MSC **Scenario** only. **Constant work** for the cell is folded in deterministically as a `fixedEffort` shift, so the band always sits at or above `cwEffort`.
- The **Initiative matrix** inside a **Projection section** lists every in-scope **Initiative** for the team (including **Constant work** rows at the bottom) with the MoSCoW badge in exactly the column matching the initiative's quarter; per-quarter footer rows surface the cumulative MoSCoW count chips and the **Effort projection band** as `~{p50} PM` with `{p25}–{p75}` underneath.

## Example dialogue

> **Dev:** When the user picks `Q2 2026` as the **Historical quarter** and `Q3 2026` as the **Target quarter**, what are we fitting and what are we forecasting?
> **Modeller:** We fit Poisson λ from the **Initiative** count in Q2, and we build the bootstrap pool of **T-shirt sizes** from the Q2 **Epics**. We forecast Q3 by counting how many **Initiatives** fall in each **MoSCoW** bucket and running three **Scenarios** on those counts.
> **Dev:** What if an **Initiative** in Q3 has no **Epics** yet?
> **Modeller:** That's fine — we don't read Q3 epics for the forecast at all. The number of epics per initiative comes from λ (fit on the historical quarter), and the sizes come from the bootstrap pool. The target-quarter epics only appear in the **Team Projections** view, not in the org-level forecast.

## Flagged ambiguities

- "team" was used to mean both the **owning team of an Initiative** and the **team-scoped simulation context** in the **Team Level tab** — resolved: the column is the **Team** (the Initiative's owning team); the tab runs a per-team Run filtered by that column.
- "size" was used to mean both **T-shirt size** (label) and **person-months** (number) — resolved: T-shirt size is always the label; PM is always the number.
- "iteration" was used for both a single Monte Carlo draw and a Jira-style sprint — resolved: only the Monte Carlo meaning is used in this project. Use **Run** for "one press of the button."
- "quarter" can refer to a single quarter or the user's multi-quarter selection — resolved: the historical and target **Quarter selectors** are both multi-selects; "quarter" in domain talk usually means the selected set unless explicitly singular.
- "detection" was used for two distinct steps: identifying which header carries a semantic column (a **Column detector** via **Content scan** / **Detection fallback**) versus normalising a raw value once the column is known (`normalizeMoscow`, `normalizeSize`) — resolved: *detection* picks the column, *normalisation* transforms the value.
- "range" was used for both a **T-shirt size**'s P10/P90 band and the chart's **Global histogram range** on the effort axis — resolved: a size's range is its *band* (input to the lognormal fit); the chart's range is the **Global histogram range** (output of `runSimulation`).
- "bin" had been informally used both for one of the 60 effort-axis intervals (**Bin**) and for a MoSCoW bucket — resolved: Bin is reserved for the histogram; MoSCoW grouping uses *bucket* (`moscowGroups.must` etc.).
- "probability" was used for two distinct things: the per-**Iteration** sampling draws inside the Monte Carlo loop, and the reported fraction `P(effort > capacity)` in the stats table — resolved: the latter is **Probability of exceedance**, an *empirical fraction* over the completed **Run**, never an in-loop sampling probability.
- "exceed" / "overrun" / "breach" were used interchangeably for the same metric — resolved: the published term is **Probability of exceedance**; the cell label is `P(effort > capacity)`; the code field is `pExceed`. The comparison is *strictly* greater (`>`), not `≥`.
- "risk" was used both for the **Risk tier** colour class and informally for "any of the three orange/red cells in the table" — resolved: Risk tier is the named classifier; individual cells *carry* a tier, they are not themselves "the risk".
