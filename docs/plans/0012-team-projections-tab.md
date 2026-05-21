# Feature: Team Projections tab — cross-quarter, per-team forecast view

Created at: 2026-05-21T00:00:00Z

## Context

This feature introduces the **Team Projections tab** — the third of four tabs in the results region — and the cross-quarter view it surfaces. Where the org-level tab and the Team Level tab both forecast a *single* **Target quarter** by *fitting on* the selected **Historical quarter(s)** ([feature 0006](./0006-org-histogram-chart.md), [feature 0007](./0007-org-level-summary-statistics-table.md), [feature 0011](./0011-team-level-tab.md)), the Team Projections tab keeps the time axis *explicit*: every quarter present in the loaded **Initiatives CSV** (and any quarter referenced by the optional **Constant Work CSV**) becomes a column in the summary table and in every per-team Projection section. The user reads the cross-quarter plan as a horizon — "what has this team committed across the visible future?" — without re-pressing **Run** between quarters.

The feature owns three things: (a) the `#tab-projections` panel and its two-section structure (`#proj-summary-wrap` + `#proj-teams-container`, `index.html:1020-1024`); (b) the data-assembly function `buildTeamProjections(allQuarters, orgLambda, orgEpicSizingDist, projIterations)` (`index.html:1917-2009`), which builds one entry per **Team** with a `byQuarter` map of per-quarter counts and the **Quick projection Monte Carlo** P25/P50/P75 band; and (c) the rendering function `renderTeamProjections(projData, allQuarters)` (`index.html:2550-2815`), which emits a single summary table (initiatives per team per quarter) followed by one **Projection section** per team containing a stacked `Initiatives by Quarter` count chart, an `Effort Projection by Quarter` P25/P50/P75 bar chart, and an **Initiative matrix** listing every in-scope initiative as a row with per-quarter MoSCoW badge columns plus footer rows for the per-quarter cumulative count chips and the P50 (P25–P75) effort band. The two small HTML helpers `moscowBadge(m)` and `countChips(kMust, kShould, kCould)` (`index.html:2530-2542`) are also owned by this feature; they are pure functions of their arguments and are consumed only by this tab.

It does *not* own the tab bar itself or the tab-switching mechanism — those are owned by [feature 0011](./0011-team-level-tab.md) (which introduced the tab structure alongside the second tab). It also does not own the org-level, Team Level, or Initiatives tabs' contents. The capacity marker system ([feature 0017](../../backtracked-features.md#0017)) does *not* apply to the projection charts — neither chart has an `ensureCapacityMarker` call, by design (see ADR-0020).

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). All markup, CSS, and JS for this feature live in `index.html`; the projection charts use the same Chart.js global the other tabs do.
- [ADR-0002 — Client-side only](../adr/0002-client-side-only.md). No persistence; the projection state is rebuilt from `editedInitiatives` and `parsedConstantWork` on every **Run**.
- [ADR-0006 — Monte Carlo with bootstrapped historical sizes](../adr/0006-monte-carlo-with-bootstrapped-sizes.md). The **Quick projection Monte Carlo** uses the same `runSimulation` engine; the only difference is the iteration cap.
- [ADR-0008 — Poisson epic-count](../adr/0008-poisson-epic-count.md). The projection's λ is the same Poisson mean fit by `prepareSimulationData`, passed in verbatim.
- [ADR-0010 — Three-scenario MoSCoW forecasting](../adr/0010-three-scenario-moscow-forecasting.md). Only the MSC scenario (Must + Should + Could) is used for the projection band; Must Only and Must + Should are not surfaced on this tab.
- [ADR-0014 — Capacity and iterations as user-configured per-Run sidebar inputs](../adr/0014-capacity-and-iterations-as-run-inputs.md). The **Quick projection Monte Carlo** reads the same `iters` value as the headline Run but caps it at `Math.min(iters, 3000)`.
- [ADR-0015 — Capacity as auto-managed chart marker](../adr/0015-capacity-as-auto-managed-chart-marker.md). The projection charts *do not* render a capacity line; the projection effort band is a forecast, not a risk gate.
- [ADR-0017 — Multi-quarter selectors](../adr/0017-multi-quarter-selectors.md). The projections tab deliberately bypasses the **Quarter selector** — it iterates `extractQuarters(editedInitiatives)` directly.
- [ADR-0018 — Tab-based results layout](../adr/0018-tab-based-results-layout.md). The Team Projections tab is the third **Tab** and follows the same pre-render-on-Run, reset-to-org-on-Run rules.
- [ADR-0019 — Per-team independent simulations](../adr/0019-per-team-independent-simulations.md). The team-list dedup rule is the same as the Team Level tab; the team-list *scope* is different (every quarter in the CSV vs. the target-quarter selection).
- [ADR-0020 — Cross-quarter Team Projections tab with quick projection Monte Carlo](../adr/0020-team-projections-cross-quarter-view.md). The architectural decision for *why* this tab exists, *why* it uses a capped Monte Carlo, *why* it always uses org-wide parameters, and *why* it surfaces a P25/P50/P75 band.

Glossary terms used below: **Team Projections tab**, **Projection section**, **Initiative matrix**, **Quick projection Monte Carlo**, **Effort projection band**, **Team**, **Tab**, **Tab panel**, **Run**, **Iteration**, **Scenario**, **MoSCoW**, **Initiative**, **Epic**, **Constant work**, **Quarter**, **Poisson λ**, **Bootstrap pool**, **T-shirt size** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user who has just pressed **Run Simulation** and clicks the third tab `Team Projections` sees the panel become visible with two stacked sections:

1. **Summary table** — a single full-width table titled `Initiatives per Team per Quarter`. The first column is the team name (left-aligned, bold indigo); each subsequent column is one **Quarter** from the loaded CSVs in chronological order. Each body cell shows the total **Initiative** count for that team and quarter (centred, bold) above a row of compact MoSCoW count chips (`M:3 S:2 C:1`, only categories with non-zero counts shown). An em-dash (`—`) appears in cells where the team has no initiatives in that quarter. Constant work is *not* counted in the summary table — only Initiatives are.

2. **Per-team Projection sections** — one `.proj-team-section` per **Team** appearing anywhere in the **Initiatives CSV** (alphabetical, case-insensitive). Each section is a vertical block containing:
   - **Section title** — the team name (bold indigo, with a soft underline divider).
   - **Charts row** — two side-by-side cards (stacked on widths under 760 px):
     - `Initiatives by Quarter` — a stacked bar chart with one stack per quarter, segments coloured by MoSCoW (red `Must`, amber `Should`, blue `Could`). The y-axis is integer-stepped initiative count; the legend shows the three categories.
     - `Effort Projection by Quarter (P25 – P50 – P75, person-months)` — a paired bar chart: a wide semi-transparent indigo P25–P75 range bar overlaid by a narrower opaque indigo P50 median bar per quarter. Quarters without sized historical data render as a flat grey `No historical data` series.
   - **Initiative matrix** — a wide table titled `Initiative Details`. Columns: `Jira Key`, optionally `KR` (only present if at least one initiative in this team has a non-empty Key Result — see [feature 0014](../../backtracked-features.md#0014)), `Initiative Name`, then one **Quarter** column per quarter in the same order as the summary table. Each Initiative occupies one row; the MoSCoW badge appears in *exactly the column matching that initiative's quarter*, leaving every other quarter column for that row empty. Initiatives are sorted Must → Should → Could → Won't → Unknown, then alphabetically by Jira key.
   - **Constant-work rows** — rows for **Constant work** entries are appended after the sorted Initiatives, with a soft green background (`#f0fdf4`) and the t-shirt size + estimated PM annotation in the name cell (`[M · ~2.12 PM]`).
   - **Footer rows** — two `<tfoot>` rows: `Initiatives count` (compact MoSCoW chips per quarter, same as the summary table cells) and `Effort P50 (P25–P75)` (per-quarter P50 in indigo with the P25–P75 range underneath in grey, or `—` for quarters with no effort data).

When the user re-presses **Run Simulation** with a different selection, the team list, the summary table, the per-team sections, and both charts per team are all rebuilt. The active tab resets to `Organization Level` (see [feature 0011](./0011-team-level-tab.md), ADR-0018), and the user must click `Team Projections` again to view the refreshed projection.

There are no live controls on this tab — no radio buttons, no markers, no sliders. Every visual is a function of the in-memory `editedInitiatives` + `parsedConstantWork` + the headline Run's `lambda` and `epicSizingDist`. Editing an Initiative on the Initiatives tab ([feature 0019](../../backtracked-features.md#0019)) and re-running the simulation re-runs the projection too.

## Scope

### In scope
- The `#tab-projections` panel markup at `index.html:1020-1024`: a `.tab-panel` containing `#proj-summary-wrap` and `#proj-teams-container`. The panel itself is part of the four-panel tab structure owned by [feature 0011](./0011-team-level-tab.md); this feature only owns its *contents*.
- The projection-specific CSS at `index.html:722-801`: `#proj-summary-wrap`, `.proj-summary-table` and its descendants, `.proj-cell-chips`, `.mc-chip` / `.mc-must` / `.mc-should` / `.mc-could` (count-chip palette), `#proj-teams-container`, `.proj-team-section`, `.proj-team-title`, `.proj-charts-row`, `.proj-chart-card`, `.proj-chart-label`, `.proj-chart-wrapper`, `.proj-init-wrap`, `.proj-init-table` and its descendants (`th.qcol`, `td.jira-key`, `td.init-name`, `td.moscow-td`, `td.qcol`), and the `@media (max-width: 760px)` collapse rule.
- `buildTeamProjections(allQuarters, orgLambda, orgEpicSizingDist, projIterations)` (`index.html:1917-2009`):
  - Builds the team list from every team present in `editedInitiatives` (case-insensitive dedup with first-seen casing, alphabetical case-insensitive sort).
  - For each team, walks the union of `allQuarters` and the team's constant-work quarters (`cwQuarters`).
  - For each (team, quarter) pair: collects in-quarter Initiatives, computes the MoSCoW group counts (`kMust`, `kShould`, `kCould`, plus `wont` and `unknown` for ordering), and builds the per-quarter initiative list sorted Must → Should → Could → Won't → Unknown then alphabetically by `jira_key`.
  - Appends the quarter's **Constant Work** epics (via `getConstantWorkEpics(quarter, teamName)`, [feature 0015](../../backtracked-features.md#0015)) to the per-quarter initiative list with `isConstant: true`.
  - Runs the **Quick projection Monte Carlo** for that (team, quarter) only when `kMustShouldCould > 0`, `orgEpicSizingDist.length > 0`, *and* `orgLambda > 0`. The simulation uses the org-wide λ and epic-sizing pool, the MSC `K` count, `iterations = projIterations`, `capacity = 0` (no capacity marker on projection charts), and `fixedEffort = cwEffort` (the deterministic sum of the quarter's constant-work effort).
  - Reads `p25`, `p50`, `p75` from the MSC scenario's stats; defaults all three to `cwEffort` when the Quick projection is skipped (so a quarter with only constant work still surfaces a non-zero effort band equal to the constant shift).
- `renderTeamProjections(projData, allQuarters)` (`index.html:2550-2815`):
  - Destroys every previous `projectionChartInstances` entry, resets the array.
  - Writes the **Summary table** into `#proj-summary-wrap` with one row per team and one column per `allQuarters[]` entry.
  - Empties `#proj-teams-container`, then appends one `.proj-team-section` per team. Each section pre-computes `displayQuarters = allQuarters` (the team's own quarter axis is *always* the full CSV axis, for visual alignment across sections), `allInits = displayQuarters.flatMap(q => byQuarter[q]?.initiatives ?? [])`, and `hasKr = allInits.some(i => i.kr)`.
  - Builds the **Initiative matrix** rows with one row per initiative, each row carrying:
    - `Jira Key` cell (indigo monospace).
    - Optional `KR` cell when `hasKr === true`.
    - `Initiative Name` cell — for constant-work rows, the name is suffixed with `[{tshirt} · ~{effort.toFixed(2)} PM]` in green.
    - One per-quarter cell per `displayQuarters[]` entry: a `moscowBadge(i.moscow)` *only* in the column matching that initiative's quarter, blank elsewhere.
    - Constant-work rows carry `style="background:#f0fdf4"`.
  - Builds the two `<tfoot>` rows: `Initiatives count` (per-quarter `countChips(d.kMust, d.kShould, d.kCould)`) and `Effort P50 (P25–P75)` (per-quarter P50 in indigo with the P25–P75 range underneath in grey, or `—` for `!d` or `d.p50 === 0`).
  - Creates the two Chart.js charts per team via `new Chart(...)` and pushes them into `projectionChartInstances` (so the tab-switch handler can resize them on first visibility — see [feature 0011](./0011-team-level-tab.md)).
- `moscowBadge(m)` (`index.html:2530-2533`): pure function returning the HTML for a single MoSCoW pill (`<span class="mb mb-${m}">{label}</span>`, label resolved via the local `labels` map with the `?` glyph for `unknown`).
- `countChips(kMust, kShould, kCould)` (`index.html:2536-2542`): pure function returning the HTML for the compact MoSCoW chip row, omitting categories with zero counts; returns a grey em-dash placeholder when all three are zero.
- The module-scoped state declared at `index.html:2412`: `let projectionChartInstances = [];`. (Declared inside the Team Level chart-rendering block but consumed by this feature.)
- The run-button handler integration at `index.html:3355-3359`: `const allQuarters = extractQuarters(editedInitiatives); const projIterations = Math.min(iters, 3000); const projData = buildTeamProjections(allQuarters, lambda, epicSizingDist, projIterations); renderTeamProjections(projData, allQuarters);`.

### Out of scope
- The tab bar markup, the tab-switching click handler, and the post-Run tab reset. [Feature 0011](./0011-team-level-tab.md). This feature only inhabits the third panel; it does not own the panel-switching mechanism.
- The Monte Carlo engine (`runSimulation`, `runScenario`, `samplePoisson`, `sampleLognormal`, `bootstrapChoice`, `Xoshiro128ss`). [Feature 0003](./0003-monte-carlo-simulation-engine.md). This feature *calls* `runSimulation` with a capped iteration count; the engine's internals are upstream.
- The `prepareSimulationData` org-level prep that produces `lambda` and `epicSizingDist`. [Feature 0003](./0003-monte-carlo-simulation-engine.md) / [feature 0009](./0009-sidebar-preview-and-reference-panels.md). This feature reads the *outputs* of that prep, not its internals.
- `prepareTeamSimulationData` and the per-team Run. [Feature 0011](./0011-team-level-tab.md). The Team Projections tab does *not* use the team-scoped λ or bootstrap pool; it always reads the org-wide ones (see [ADR-0020](../adr/0020-team-projections-cross-quarter-view.md)).
- The marker system. [Feature 0017](../../backtracked-features.md#0017). The projection charts have no markers, no capacity line, and no per-chart-context store. `ensureCapacityMarker` is *not* called for either projection chart.
- The Constant Work CSV upload UI and parsing. [Feature 0015](../../backtracked-features.md#0015). This feature reads `parsedConstantWork` via `getConstantWorkEpics` and `getConstantWorkEffort`; it does not own the upload or the parse.
- The Key Result column detection. [Feature 0014](../../backtracked-features.md#0014). This feature reads `detectedCols.krCol` and renders the column when `hasKr === true`; it does not own the detector.
- The Initiatives tab and `editedInitiatives` mutation surface. [Feature 0019](../../backtracked-features.md#0019). The projections read the *current state* of `editedInitiatives` on every Run.
- A capacity line on the projection effort chart. [ADR-0020](../adr/0020-team-projections-cross-quarter-view.md). Out of scope by design — projections are a forecast, not a risk gate.
- A `Historical data` toggle (org-wide vs. team-scoped) on this tab. [ADR-0020](../adr/0020-team-projections-cross-quarter-view.md) calls this out as a future revision.
- Surfacing the Must Only or Must + Should scenarios on the effort projection chart. Only MSC is shown.
- Surfacing P10 or P90 on the projection band. The 3000-iteration cap is calibrated to the three quartiles only.
- Filtering the team list by the **Target quarter** selection. The full team inventory is always rendered.

## Relevant existing files
Claude may inspect:
- `index.html`, specifically:
  - The `#tab-projections` markup at `index.html:1020-1024`.
  - The projection CSS block at `index.html:714-801`.
  - `buildTeamProjections` at `index.html:1917-2009`.
  - `getConstantWorkEpics` at `index.html:1668-1686` and `getConstantWorkEffort` at `index.html:1648-1666`.
  - `moscowBadge` and `countChips` at `index.html:2530-2542`.
  - `renderTeamProjections` at `index.html:2550-2815`.
  - `projectionChartInstances` declaration at `index.html:2412`.
  - The run-button handler integration at `index.html:3355-3359`.
  - The tab-switch handler's resize call at `index.html:3289` (resizes `projectionChartInstances` on tab activation).
- `CONTEXT.md` glossary — especially the new **Team Projections tab**, **Projection section**, **Initiative matrix**, **Quick projection Monte Carlo**, **Effort projection band** entries plus the existing **Team**, **Constant work**, **Quarter**, **Run**, **Initiative**, **MoSCoW**, **T-shirt size** terms.
- ADRs 0001, 0002, 0006, 0008, 0010, 0014, 0015, 0017, 0018, 0019, 0020 for the constraints this feature must respect.

Claude should not inspect unless needed:
- The Monte Carlo samplers (`samplePoisson`, `sampleLognormal`, `Xoshiro128ss`) — called by `runSimulation`.
- The marker dialog implementation (`openMarkerDialog`, `handleMarkerSave`, `handleMarkerDelete`) — not used by this tab.
- The `MultiSelect` widget and the **Quarter selector** state — the projections tab bypasses the selectors entirely.
- The Constant Work CSV parse path — this feature only reads the parsed structure.

## Existing patterns to follow
- **Layering inside `index.html`**: the panel markup lives in Module 0 (static HTML). The CSS lives in the top stylesheet block. `buildTeamProjections` lives in Module 4 (data prep), grouped after `prepareTeamSimulationData` and before the Monte Carlo Engine module. `moscowBadge`, `countChips`, and `renderTeamProjections` live in Module 6 (chart & stats rendering), grouped after `renderTeamSection` / `renderTeamCharts`. The run-button handler integration is two lines inside the Run pipeline (`index.html:3355-3359`).
- **Pure builder + side-effecting renderer split**: `buildTeamProjections` is a *pure* function from `(allQuarters, orgLambda, orgEpicSizingDist, projIterations)` and the module-scoped CSV state to a `ProjectionTeamData[]` array. `renderTeamProjections` is the *only* function that touches the DOM and the chart instances. Mirrors the `prepareSimulationData` / `renderChart` and `prepareTeamSimulationData` / `renderTeamCharts` split.
- **Case-insensitive dedup with first-seen casing**: `teamMap.set(raw.toLowerCase(), raw)` is the same rule the Team Level tab uses ([feature 0011](./0011-team-level-tab.md)). The first-seen casing wins. Do not normalise to title-case or lowercase.
- **Case-insensitive alphabetical sort**: `[...teamMap.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))`.
- **MoSCoW ordering**: the constant `mOrder = ['must','should','could','wont','unknown']` is used as the primary sort key for the **Initiative matrix**. The same order is used implicitly by the count chips (Must → Should → Could).
- **HTML-string template literals + single `innerHTML` write**: each large DOM region (`#proj-summary-wrap`, each `.proj-team-section`) is built as one template literal and written via `innerHTML` once. Subsequent in-place mutations are limited to the Chart.js instances. The same pattern is used by `renderTeamCharts` ([feature 0011](./0011-team-level-tab.md)).
- **Chart instance bookkeeping**: every `new Chart(...)` is pushed into `projectionChartInstances`. The next `renderTeamProjections` call destroys them all and starts a fresh array. The tab-switch click handler's `forEach(c => c.resize())` reads the same array.
- **No framework**: vanilla DOM (`document.getElementById`, `document.createElement('div')`, `appendChild`, `innerHTML`).
- **Quarter ordering**: `extractQuarters(editedInitiatives)` is the canonical chronological-by-(year, quarter-number) sort the **Quarter selector** also uses. The projections tab does not implement its own sort.
- **`countChips` and `moscowBadge` are pure HTML helpers**: they take primitive arguments and return strings. They never read module state. Do not reach into them to thread per-team or per-quarter context — at most, wrap their output.
- **Verification command**: there is no automated test harness in this project. Verification is manual: open `index.html`, upload known-good CSVs, press Run, click the `Team Projections` tab.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer — this is a client-side-only app (ADR-0002). In-memory state owned by this feature:

```js
// Module-scoped, declared once near the team-rendering functions.
let projectionChartInstances: Array<Chart> = []; // Two entries per rendered team (count + effort).

// Shape returned per entry by buildTeamProjections(...):
type ProjectionTeamData = {
  teamName: string;             // First-seen casing of the team label.
  byQuarter: {                  // Sparse map: only quarters with initiatives or constant work for this team.
    [quarter: string]: {
      kMust:            number; // Count of Must Initiatives for this team in this quarter.
      kShould:          number; // Count of Should Initiatives.
      kCould:           number; // Count of Could Initiatives.
      kMustShould:      number; // kMust + kShould.
      kMustShouldCould: number; // kMust + kShould + kCould.
      p25:              number; // P25 of the Quick projection Monte Carlo (or cwEffort when skipped).
      p50:              number; // P50 of the same.
      p75:              number; // P75 of the same.
      cwEffort:         number; // Sum of deterministic constant-work effort for this team/quarter.
      initiatives: Array<{
        key:        string;     // Jira key (or '' if missing).
        name:       string;     // Initiative name.
        moscow:     'must' | 'should' | 'could' | 'wont' | 'unknown';
        kr:         string;     // Key Result (empty string if no KR column or no value).
        // Constant-work-only fields:
        isConstant?: boolean;   // true for constant-work rows (appended after sorted initiatives).
        tshirt?:     string;    // Normalised t-shirt size label.
        effort?:     number;    // Deterministic PM (lognormal mean of tshirt).
      }>;
    };
  };
};
```

Read contract for `renderTeamProjections`: it consumes the `ProjectionTeamData[]` array and the `allQuarters` argument and writes to `#proj-summary-wrap`, `#proj-teams-container`, and `projectionChartInstances`. It does *not* read the sidebar inputs and does *not* mutate `editedInitiatives` or `parsedConstantWork`.

---

## Phase 1: `buildTeamProjections` — pure data assembly

### Acceptance behavior

Scenario AT-1: One entry per team appearing anywhere in the Initiatives CSV
Given `editedInitiatives` has rows with teams `Platform`, `Lending`, `Risk` across various quarters
And the **Quarter selector** target is `['Q3 2026']` only
When `buildTeamProjections(['Q2 2026','Q3 2026','Q4 2026'], orgLambda, orgEpicSizingDist, 3000)` runs
Then the returned array has length 3
And all three team names appear, regardless of which quarter their initiatives sit in
(The team list is bounded by the *entire CSV*, not the target-quarter selection — contrast with [feature 0011](./0011-team-level-tab.md)'s `prepareTeamSimulationData`.)

Scenario AT-2: Case-insensitive dedup preserves first-seen casing
Given rows with teams `platform`, `Platform`, `PLATFORM` (in that row order) and rows for team `Risk`
When `buildTeamProjections` runs
Then exactly one entry exists with `teamName === 'platform'` (the first-seen casing)
And one entry exists with `teamName === 'Risk'`

Scenario AT-3: Empty team values are excluded
Given some rows have an empty `team` field (`''` or whitespace-only)
When `buildTeamProjections` runs
Then those rows do not contribute a team entry
And the returned array contains no entry with empty `teamName`

Scenario AT-4: Quarters with no Initiatives and no Constant work for a team are skipped
Given team `Lending` has Initiatives only in `Q3 2026` and no constant work in any quarter
When `buildTeamProjections(['Q2 2026','Q3 2026','Q4 2026'], ...)` runs
Then `teamData['Lending'].byQuarter` has exactly one key: `'Q3 2026'`
And no `byQuarter['Q2 2026']` or `byQuarter['Q4 2026']` is present
(The sparse map is intentional — `renderTeamProjections` renders an em-dash for missing entries on the summary table and an empty column for missing initiatives on the matrix.)

Scenario AT-5: Constant-work-only quarters become non-empty entries
Given team `Platform` has no Initiatives in `Q4 2026` but the constant-work CSV has a row for that team/quarter
When `buildTeamProjections(['Q2 2026','Q3 2026'], ...)` runs (note: `Q4 2026` is *not* in `allQuarters`)
Then `teamData['Platform'].byQuarter['Q4 2026']` exists
And it carries the constant-work epic in its `initiatives[]` with `isConstant: true`
And `kMust`, `kShould`, `kCould` are all `0` (constant work is not an Initiative)
And `cwEffort > 0`
(The team's per-team quarter axis is augmented by `cwQuarters` even when the org-level `allQuarters` does not list them.)

Scenario AT-6: K counts are team-and-quarter scoped
Given team `Platform` in `Q3 2026` has 2 Must, 1 Should, 0 Could in-quarter Initiatives
When `buildTeamProjections` runs
Then `teamData['Platform'].byQuarter['Q3 2026'].kMust === 2`
And `kShould === 1`
And `kCould === 0`
And `kMustShould === 3`
And `kMustShouldCould === 3`

Scenario AT-7: Initiative matrix rows are sorted MoSCoW then alphabetically by key
Given team `Platform` has Initiatives `(INIT-2, Could)`, `(INIT-1, Must)`, `(INIT-3, Should)`, `(INIT-4, Must)` in `Q3 2026`
When `buildTeamProjections` runs
Then `teamData['Platform'].byQuarter['Q3 2026'].initiatives[0].key === 'INIT-1'` (Must, first alphabetically)
And `initiatives[1].key === 'INIT-4'` (Must, second alphabetically)
And `initiatives[2].key === 'INIT-3'` (Should)
And `initiatives[3].key === 'INIT-2'` (Could)

Scenario AT-8: Constant-work epics are appended *after* sorted Initiatives
Given team `Platform` has 2 Must Initiatives and 1 constant-work epic in `Q3 2026`
When `buildTeamProjections` runs
Then `initiatives[0..1]` are the two Initiatives (MoSCoW-sorted, alpha-sorted)
And `initiatives[2]` is the constant-work epic
And `initiatives[2].isConstant === true`
And `initiatives[2].tshirt` and `initiatives[2].effort` are populated

Scenario AT-9: Quick projection Monte Carlo runs only when MSC K > 0 and org parameters are non-trivial
Given team `Platform` in `Q3 2026` has `kMust=0`, `kShould=0`, `kCould=0` (all `Won't` or unknown)
And `orgEpicSizingDist.length === 0` (degenerate org)
When `buildTeamProjections` runs
Then `runSimulation` is *not* called for this (team, quarter)
And `p25`, `p50`, `p75` default to `cwEffort` (which is `0` if no constant work)
(The same guard applies for `orgLambda === 0`.)

Scenario AT-10: P25/P50/P75 reflect the MSC scenario's stats with constant-work shift
Given team `Platform` in `Q3 2026` has `kMust=2, kShould=1, kCould=0` (kMSC=3)
And `orgLambda = 4.32`
And `orgEpicSizingDist = ['S','M','L', ...]` (160 entries)
And `cwEffort = 5.0` (one constant-work epic at L size, ~5 PM)
And `projIterations = 3000`
When `buildTeamProjections` runs
Then `runSimulation` is called once with `lambda = 4.32, epicSizingDist = orgEpicSizingDist, kMust=2, kMustShould=3, kMustShouldCould=3, capacity=0, iterations=3000, fixedEffort=5.0`
And `p25`, `p50`, `p75` are read from the returned `mustShouldCould.stats` object
And every returned value is `>= 5.0` (the constant-work shift floors the distribution)

Scenario AT-11: Skipped Quick projections default the band to the constant-work shift
Given team `Platform` in `Q4 2026` has zero in-quarter Initiatives but one constant-work epic with `cwEffort = 2.12`
When `buildTeamProjections` runs
Then `byQuarter['Q4 2026'].p25 === 2.12`
And `p50 === 2.12`
And `p75 === 2.12`
(A flat band — the user reads "constant-work only" by the absence of variance.)

Scenario AT-12: Org-wide parameters are passed in by argument; never re-derived
Given the caller passes `orgLambda = 4.32` and `orgEpicSizingDist = [...]`
When `buildTeamProjections` runs
Then no internal step re-walks `editedInitiatives` to recompute `lambda` or `epicSizingDist`
And every `runSimulation` call inside the function uses the passed-in `orgLambda` and `orgEpicSizingDist` verbatim
(See [ADR-0020](../adr/0020-team-projections-cross-quarter-view.md) — recomputation would risk a second source of truth.)

Scenario AT-13: KR is read via `detectedCols.krCol` only when the detector identified a KR column
Given the loaded **Initiatives CSV** has no Key Result column
And `detectedCols.krCol === null`
When `buildTeamProjections` runs
Then every `initiative.kr === ''`
And no row reads from a non-existent column

Scenario AT-14: Initiative quarter is read by the literal `quarter` column
Given an Initiative row has `quarter: 'Q3 2026'` and the team is `Platform`
When `buildTeamProjections(['Q3 2026'], ...)` runs
Then that row is placed into `teamData['Platform'].byQuarter['Q3 2026']`
(The function does not invoke `extractQuarters` or any normalisation on the `quarter` value beyond a trim.)

### Public entry point

In-code: `buildTeamProjections(allQuarters: string[], orgLambda: number, orgEpicSizingDist: string[], projIterations: number): ProjectionTeamData[]` (`index.html:1917`).

UI: implicit — the run-button handler calls this function inside the Run pipeline.

### Expected observable outcomes
- Pure function from `(allQuarters, orgLambda, orgEpicSizingDist, projIterations)` and the module-scoped `editedInitiatives`, `parsedConstantWork`, `detectedCols`, `T_SHIRT_PARAMS` to the returned `ProjectionTeamData[]`.
- No DOM mutation, no chart instances created.
- The returned array is sorted alphabetically by `teamName.toLowerCase()`.
- The returned array's `teamName` set is exactly the case-insensitive-deduped set of non-empty teams in `editedInitiatives`.
- For each `(team, quarter)` cell, `kMust + kShould + kCould === kMustShouldCould` and `kMust + kShould === kMustShould`.
- Every `initiative.isConstant === true` row appears strictly after every non-constant row within the same quarter's `initiatives[]`.

### Test harness

Acceptance tests:
- Location: **N/A — manual.**
- Manual steps:
  1. In DevTools, after a Run: `buildTeamProjections(extractQuarters(editedInitiatives), 4.32, ['S','M','L'], 3000)`. Inspect length and `teamName` values.
  2. Construct a CSV with mixed-case team labels; confirm AT-1, AT-2, AT-3.
  3. Construct a team whose Initiatives are entirely outside the target quarter selection; confirm the team still appears (AT-1).
  4. Pick a team whose `byQuarter` should be sparse; confirm only quarters with content are keyed (AT-4).
  5. Add a constant-work row for a team and a quarter that has no Initiatives; confirm `byQuarter` is populated for that quarter (AT-5).
  6. Hand-compute the K counts and the matrix sort order for a small team; confirm AT-6, AT-7, AT-8.
  7. Construct a team-quarter cell with `kMustShouldCould === 0` and confirm `runSimulation` is *not* called (AT-9).
  8. With a constant-work CSV loaded, confirm the per-quarter band is shifted by `cwEffort` (AT-10) and that a constant-work-only quarter renders a flat band (AT-11).
  9. Monkey-patch `runSimulation` to log its arguments; confirm `lambda` and `epicSizingDist` match the passed-in org-wide values (AT-12).
 10. Load a CSV with no KR column; confirm every initiative's `kr === ''` (AT-13).

Inner tests: N/A.

Verification: manual.

Fake-injection wiring: N/A. To exercise without going through the full Run, call the function directly in the DevTools console after a Run has populated `editedInitiatives`.

### Proposed implementation seams

Stable seams a future test suite may target:
- `buildTeamProjections(allQuarters, orgLambda, orgEpicSizingDist, projIterations): ProjectionTeamData[]` — pure function.
- The case-insensitive dedup with first-seen casing.
- The MoSCoW-then-alphabetical sort inside each quarter's `initiatives[]`.
- The `mOrder = ['must','should','could','wont','unknown']` constant — the ordering, not the value strings.
- The 3000-iteration cap is *not* enforced inside this function; the cap is the caller's responsibility (the run-button handler passes `Math.min(iters, 3000)`).

Do NOT lock in:
- The exact shape of `runSimulation`'s return value beyond `.mustShouldCould.stats.{p25,p50,p75}` — internal API of [feature 0003](./0003-monte-carlo-simulation-engine.md).
- The exact iteration cap value — see [ADR-0020](../adr/0020-team-projections-cross-quarter-view.md). The cap is the caller's choice.
- The set of fields returned per `byQuarter[q]` — additive fields (e.g. `p90`, `pExceed`) could be added in the future, but doing so would re-open [ADR-0020](../adr/0020-team-projections-cross-quarter-view.md).
- The exact `cwEffort` floor for skipped Quick projections — the rule is "default to the deterministic shift", not "default to a particular numeric formula".

### Behavioral rule

`buildTeamProjections` assembles one `ProjectionTeamData` entry per **Team** appearing anywhere in the **Initiatives CSV** (case-insensitive dedup, alphabetical case-insensitive sort, first-seen casing preserved). For each team, it walks the union of `allQuarters` and the team's constant-work quarters and emits a sparse `byQuarter` map keyed only by quarters that have at least one in-quarter Initiative *or* at least one constant-work epic for the team. Each map entry carries the three MoSCoW counts (`kMust`, `kShould`, `kCould`) plus their cumulative variants, the per-quarter initiative list sorted Must → Should → Could → Won't → Unknown then alphabetically by Jira key with constant-work epics appended (`isConstant: true`), the deterministic constant-work effort sum `cwEffort`, and the P25/P50/P75 of an MSC-scenario **Quick projection Monte Carlo** run with the org-wide λ and bootstrap pool and `fixedEffort = cwEffort`. When `kMustShouldCould === 0` or the org parameters are degenerate, the Quick projection is skipped and `p25 = p50 = p75 = cwEffort`.

### Invariants
- `teamName` is a non-empty string for every returned entry.
- `teamName` set is the case-insensitive dedup of non-empty teams in `editedInitiatives` (constant-work-only teams *not* in the Initiatives CSV do *not* appear).
- The returned array is sorted by `teamName.toLowerCase()` via `localeCompare`.
- `byQuarter[q]` keys are a subset of `(allQuarters ∪ cwQuartersForTeam)`.
- For every `(team, q)` entry: `kMust + kShould + kCould === kMustShouldCould` and `kMust + kShould === kMustShould`.
- `p25 <= p50 <= p75` for every entry (the underlying stats are read from a sorted Float64Array).
- Every `initiative.isConstant === true` row appears strictly after every non-constant row within a quarter's `initiatives[]`.
- When the Quick projection is skipped, `p25 === p50 === p75 === cwEffort`.
- `runSimulation`'s `lambda` and `epicSizingDist` arguments are always the passed-in `orgLambda` and `orgEpicSizingDist`, never recomputed.

### Counterexamples (must NOT pass)
- A team-list build that uses the **Target quarter** selection as a filter — would silently hide teams whose initiatives sit in non-target quarters from the cross-quarter view.
- A `byQuarter` build that emits an entry for every `allQuarters[q]` regardless of content — would surface noise rows in the summary table for empty cells (which are already represented by em-dashes in the renderer).
- A Quick projection that uses the team-scoped `teamLambda` or `teamEpicSizingDist` — violates [ADR-0020](../adr/0020-team-projections-cross-quarter-view.md)'s "always org-wide" rule and re-introduces the sample-starvation problem.
- A Quick projection that does *not* pass `fixedEffort = cwEffort` — the projection band would underreport effort for quarters with constant work, contradicting the matrix that shows the constant-work rows.
- A `runSimulation` call that uses the full `iters` (not capped) — would lock the main thread at the empty-field fallback `iters = 1000000` across all team-quarter cells.
- A sort that places constant-work rows *between* MoSCoW buckets (e.g. by treating them as `Should`) — visually conflates two distinct categories and breaks the MoSCoW-sorted reading order.
- A KR read that assumes the column always exists — would crash on CSVs without a KR column (the original quirky format).

### Forbidden shortcuts
- Do not recompute `orgLambda` or `orgEpicSizingDist` inside this function. They are passed in for a reason ([ADR-0020](../adr/0020-team-projections-cross-quarter-view.md)).
- Do not skip the constant-work walk when `parsedConstantWork === null`. Guard with `parsedConstantWork ? [...] : []` and continue.
- Do not pre-allocate `byQuarter` for every `allQuarters[q]` to "make the map dense". The renderer relies on the sparse map for the em-dash rule.
- Do not normalise the `quarter` value beyond a trim. The **Quarter** identifier is the literal CSV cell value; normalising it would break joins with the **Constant Work CSV** that uses the same literal.
- Do not assume `runSimulation`'s return shape beyond `.mustShouldCould.stats.{p25,p50,p75}`. Other fields are internal to [feature 0003](./0003-monte-carlo-simulation-engine.md).

### RED gate

On an un-implemented build:
- Manual step 1: `buildTeamProjections` is undefined or returns `[]` despite a populated CSV.
- Manual step 5: a constant-work-only quarter is missing from `byQuarter`.
- Manual step 8: constant-work rows are interleaved with sampled Initiatives instead of appended.
- Manual step 10: every `initiative.kr` is undefined or throws on the empty-column case.

### Test immutability rule

N/A.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-14 all pass.
- [ ] The function is pure (no DOM mutation, no chart creation).
- [ ] The case-insensitive dedup, first-seen casing, and alphabetical sort rules are observable.
- [ ] The Quick projection Monte Carlo uses the passed-in org-wide parameters verbatim.
- [ ] Constant-work integration is correct: deterministic `cwEffort` shift on the band, `isConstant: true` rows appended after the MoSCoW sort.

---

## Phase 2: Summary table — initiatives per team per quarter

### Acceptance behavior

Scenario AT-1: Header row lists every quarter from `allQuarters` in order
Given `allQuarters = ['Q2 2026', 'Q3 2026', 'Q4 2026', 'Q1 2027']` (chronological sort from `extractQuarters`)
When `renderTeamProjections(projData, allQuarters)` runs
Then `#proj-summary-wrap table thead tr` contains a `<th>Team</th>` followed by four `<th>` cells in the same order
And every quarter label has its space replaced with a non-breaking space (`Q3&nbsp;2026`) to prevent mid-label wrap

Scenario AT-2: Body has one row per `projData` entry, in the same order
Given `projData = [{teamName: 'Lending', ...}, {teamName: 'Platform', ...}, {teamName: 'Risk', ...}]`
When `renderTeamProjections` runs
Then the summary table's `<tbody>` has three `<tr>` rows in that order
And the first `<td>` of each row is the team name

Scenario AT-3: Cells with no `byQuarter[q]` entry render an em-dash
Given `projData[0].byQuarter = { 'Q3 2026': {...} }` (Q2, Q4 absent)
And `allQuarters` includes Q2, Q3, Q4
When `renderTeamProjections` runs
Then the cell for (Lending, Q2 2026) reads `—`
And the cell for (Lending, Q4 2026) reads `—`
And the cell for (Lending, Q3 2026) shows the count and chips

Scenario AT-4: Populated cells show total count and per-MoSCoW chips
Given `projData[0].byQuarter['Q3 2026'] = { kMust: 2, kShould: 1, kCould: 0, ... }`
When `renderTeamProjections` runs
Then the (Lending, Q3 2026) cell contains the substring `3` (total = 2 + 1 + 0)
And the cell contains a `.mc-must` chip with text `M:2`
And the cell contains a `.mc-should` chip with text `S:1`
And the cell does *not* contain a `.mc-could` chip (kCould === 0)

Scenario AT-5: Constant work is not counted in the summary table
Given `projData[0].byQuarter['Q3 2026'] = { kMust: 0, kShould: 0, kCould: 0, cwEffort: 5.0, initiatives: [{isConstant: true, ...}] }`
When `renderTeamProjections` runs
Then the cell shows `0` as the total and no MoSCoW chips
(But the cell still exists — `byQuarter['Q3 2026']` is populated, so the renderer does not emit an em-dash.)

Scenario AT-6: Empty `projData` yields an empty summary table body
Given `projData = []` (no teams)
When `renderTeamProjections([], allQuarters)` runs
Then `#proj-summary-wrap table tbody` has no rows
And the table still renders with its header row visible
(No initiative data, no team rows — but the table structure is present.)

Scenario AT-7: Re-render replaces the previous summary table
Given a previous Run rendered three team rows
And the next Run produces `projData` with two team rows
When `renderTeamProjections` runs
Then `#proj-summary-wrap.innerHTML` is overwritten in one assignment
And the table now has exactly two body rows
And no stale rows from the previous Run remain

### Public entry point

In-code: inside `renderTeamProjections` (`index.html:2550-2587`).

UI: the table at the top of the `Team Projections` panel.

### Expected observable outcomes
- `#proj-summary-wrap` contains exactly one `.proj-summary-table` after every render.
- The header has `len(allQuarters) + 1` `<th>` cells; the body has `projData.length` rows, each with `len(allQuarters) + 1` `<td>` cells.
- Quarter labels are non-breaking (single label never wraps mid-quarter).

### Test harness

Acceptance tests:
- Location: **N/A — manual.**
- Manual steps:
  1. Load CSVs spanning four quarters; press Run; click `Team Projections`. Confirm AT-1.
  2. Inspect a `byQuarter` entry that is sparse in DevTools, verify the summary cell is `—` (AT-3) and the populated cell shows count + chips (AT-4).
  3. Add a constant-work-only quarter; verify the summary cell shows `0` (AT-5) — the chips section is empty.
  4. Run with an empty `editedInitiatives` (delete every row on the Initiatives tab); verify the summary table renders with header but no body rows (AT-6).
  5. Run twice with different team lists; verify the second render replaces the first (AT-7).

Inner tests: N/A.

Verification: manual.

Fake-injection wiring: N/A.

### Proposed implementation seams

Stable seams a future test suite may target:
- The header structure `<th>Team</th>` followed by one `<th>` per quarter.
- The em-dash convention for missing cells.
- The total-count + chips two-row vertical layout inside each populated cell.
- `countChips(kMust, kShould, kCould)` is the *only* helper that writes the chips in this table.

Do NOT lock in:
- The exact CSS class names (`proj-summary-table`, `proj-cell-chips`, `mc-chip`, `mc-must`, `mc-should`, `mc-could`) — purely presentational.
- The `min-width: 600px` rule on the table — UX call.
- The non-breaking-space substitution for quarter labels — could be replaced with a CSS `white-space: nowrap` rule on the `<th>` (already present, the `&nbsp;` is a belt-and-braces).
- The bold-indigo styling of the team name column.

### Behavioral rule

The summary table renders once per `renderTeamProjections` call. It has one header row (`Team` + one column per `allQuarters[]` entry in chronological order) and one body row per `projData[]` entry (team name + one cell per quarter). A cell with no `byQuarter[q]` entry renders an em-dash; a populated cell renders the total Initiative count above a chip row from `countChips(kMust, kShould, kCould)`. Constant work is *never* counted in the totals or chips — the summary table is an Initiative inventory, not an effort inventory.

### Invariants
- `#proj-summary-wrap.children.length === 1` after every render (one `.stats-section` wrapper containing the table).
- The table has exactly one `<thead>` row and exactly `projData.length` `<tbody>` rows.
- Each row's `<td>` cell count equals `len(allQuarters) + 1`.
- An em-dash cell has no `.mc-chip` descendants; a populated cell has at most three (one per non-zero MoSCoW count).
- The team-name column is left-aligned; all quarter columns are centred.

### Counterexamples (must NOT pass)
- A render that emits a body row for every quarter in `allQuarters` regardless of `projData.length` — would invert the row/column meaning of the table.
- A cell that counts constant-work epics in the chips — would conflate Initiatives and constant work, contradicting the **Initiative matrix**'s separate constant-work rows.
- A render that omits the `<thead>` row when `projData` is empty — would lose the column headers (the user could not tell which quarters were loaded).
- A render that mutates the previous summary table in place — would risk stale columns from a previous Run's `allQuarters`.
- A render that wraps a quarter label mid-label (e.g. `Q3<br>2026`) — destroys the column rhythm and the chronological read.

### Forbidden shortcuts
- Do not introduce a "totals" row at the bottom of the summary table. The per-team-per-quarter view is the contract; aggregating across teams would compete with the org-level tab.
- Do not introduce a "totals" column at the right of the summary table. Per-quarter totals across teams compete with the org-level forecast already shown on the first tab.
- Do not move the chip styling into the cell-level inline `style=`. The `.mc-must` / `.mc-should` / `.mc-could` palette is shared with the matrix footer rows; inline styling would mean two sources of truth.
- Do not animate the table render. Instant repaint matches the rest of the tab and the data is unchanged between viewings unless the user re-Runs.

### RED gate

On an un-implemented build:
- Manual step 1: `#proj-summary-wrap` is empty after the Run.
- Manual step 2: cells show raw object stringification (`[object Object]`) or no chips.
- Manual step 5: a second Run leaves the first Run's rows in the table.

### Test immutability rule

N/A.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-7 all pass.
- [ ] Em-dash cells visibly distinguish "no data" from "zero".
- [ ] Chips palette matches the matrix footer chips.
- [ ] Re-render fully replaces the previous summary table.

---

## Phase 3: Per-team Projection sections — count chart, effort chart, Initiative matrix

### Acceptance behavior

Scenario AT-1: One Projection section per `projData` entry, in order
Given `projData = [{teamName: 'Lending', ...}, {teamName: 'Platform', ...}, {teamName: 'Risk', ...}]`
When `renderTeamProjections(projData, allQuarters)` runs
Then `#proj-teams-container` contains three `.proj-team-section` children in that order
And each has the team name in its `.proj-team-title`

Scenario AT-2: Each section contains a count chart, an effort chart, and an initiative matrix
Given a section is rendered
When the user inspects its DOM
Then it contains exactly one `<canvas id="proj-count-${teamIdx}">`
And exactly one `<canvas id="proj-effort-${teamIdx}">`
And exactly one `<table class="proj-init-table">`

Scenario AT-3: Initiative matrix has one row per initiative across all quarters
Given team `Platform` has 3 Initiatives in `Q3 2026` and 2 Initiatives in `Q4 2026`
When the section renders
Then the matrix `<tbody>` has 5 rows
And every row has the MoSCoW badge in *exactly one* quarter column

Scenario AT-4: Initiative quarter columns are blank for non-matching quarters
Given Initiative `INIT-1` has `quarter = 'Q3 2026'`
And `displayQuarters = ['Q2 2026', 'Q3 2026', 'Q4 2026']`
When the row renders
Then the cell under `Q2 2026` is empty (`<td class="qcol"></td>`)
And the cell under `Q3 2026` contains a `moscowBadge(i.moscow)`
And the cell under `Q4 2026` is empty

Scenario AT-5: KR column appears only when at least one initiative has a non-empty KR
Given team `Platform` has 3 Initiatives, none with a `kr` value
When the section renders
Then the matrix has no `KR` column
And every `tfoot` `colspan` is `2` (Jira Key + Initiative Name)

Scenario AT-6: KR column appears when at least one initiative has a KR
Given team `Risk` has 2 Initiatives, one with `kr = 'KR-7'`
When the section renders
Then the matrix has a `<th>KR</th>` column header
And the row for the KR-bearing initiative shows `KR-7` in its KR cell (indigo, bold)
And the row for the KR-less initiative shows `—` in its KR cell
And every `tfoot` `colspan` is `3` (Jira Key + KR + Initiative Name)

Scenario AT-7: Constant-work rows are visually distinct and labelled
Given team `Platform` has 2 Initiatives in `Q3 2026` and 1 constant-work epic in `Q3 2026` with `tshirt = 'M'` and `effort = 2.12`
When the section renders
Then the matrix has 3 rows
And the third row (the constant-work epic) has `style="background:#f0fdf4"`
And the name cell contains the substring `[M · ~2.12 PM]` in green

Scenario AT-8: Count chart is a stacked bar with one stack per `displayQuarters` entry
Given `displayQuarters = ['Q2 2026', 'Q3 2026', 'Q4 2026']`
And team data has Must/Should/Could counts in each quarter
When the section renders
Then the count chart's `labels` array equals `displayQuarters`
And the chart has three datasets labelled `Must`, `Should`, `Could`
And every dataset is stacked on the same `stack: 'stack'` group
And the y-axis ticks are integer-stepped (`stepSize: 1`)

Scenario AT-9: Count chart cells default to 0 for quarters with no `byQuarter[q]`
Given `byQuarter` has only `Q3 2026`; `displayQuarters` includes `Q2 2026` too
When the section renders
Then the count chart's `Must` dataset has `[0, kMust_Q3, ...]`
And the `Q2 2026` column renders an empty stack

Scenario AT-10: Effort chart shows a P25–P75 range bar overlaid with a P50 median bar
Given a quarter has `p25=5, p50=8, p75=12`
When the section renders
Then the effort chart has two datasets when at least one quarter has `p50 > 0`:
  - `P25–P75 range` (semi-transparent indigo, wider bar, `order: 2`) with data `[p25, p75]` per quarter
  - `P50 median` (opaque indigo, narrower bar, `order: 1`) with data `p50` per quarter
And the legend shows both labels

Scenario AT-11: Effort chart degrades to a grey "No historical data" series when no quarter has data
Given every `byQuarter[q].p50 === 0`
When the section renders
Then the effort chart has one dataset labelled `No historical data` (grey)
And no P25–P75 range bar is drawn

Scenario AT-12: Effort chart tooltip surfaces the three percentiles
Given the effort chart has a hover on the `Q3 2026` quarter with `p25=5, p50=8, p75=12`
When the user hovers
Then the tooltip text reads `P25: 5.0 · P50: 8.0 · P75: 12.0 PM`
And the bar value is *not* the raw chart coordinate (the callback overrides the default)

Scenario AT-13: Effort chart tooltip says "No effort data" for empty quarters
Given the `Q4 2026` quarter has `p50 === 0` (no MSC data, no constant work)
When the user hovers that quarter
Then the tooltip reads `No effort data`

Scenario AT-14: Matrix footer rows summarise counts and effort per quarter
Given a team has data in 3 quarters
When the section renders
Then the matrix `<tfoot>` has two rows
And the first row (`Initiatives count`) has the team-name colspan group on the left and one per-quarter count-chips cell on the right
And the second row (`Effort P50 (P25–P75)`) shows `~{p50} PM` with `{p25}–{p75}` underneath, or `—` for empty quarters

Scenario AT-15: All charts are tracked in `projectionChartInstances` and destroyed on next render
Given a previous Run rendered 3 teams (6 chart instances: 3 count + 3 effort)
When `renderTeamProjections` runs again with a new `projData`
Then every previous chart instance has `.destroy()` called before any new chart is built
And `projectionChartInstances` is reset to a fresh array
And the new array's length is `2 × projData.length` after the render

Scenario AT-16: Tab-switch resize fires for projection charts on first show
Given the user has just pressed Run while the active tab is `Organization Level`
And the projection charts were built while `#tab-projections` was `display: none`
When the user clicks `Team Projections`
Then every entry in `projectionChartInstances` has `.resize()` called
And the charts draw at their full container size
(The resize is wired in the tab-switch handler at `index.html:3289`, owned by [feature 0011](./0011-team-level-tab.md).)

Scenario AT-17: `displayQuarters` always equals `allQuarters` per section
Given team `Platform` has Initiatives only in `Q3 2026`
And `allQuarters = ['Q2 2026', 'Q3 2026', 'Q4 2026']`
When the section renders
Then the matrix header has three quarter columns (Q2, Q3, Q4) — *not* one
And the count and effort chart x-axes have three labels
(Per-team alignment across the cross-quarter view is the documented affordance — see [ADR-0020](../adr/0020-team-projections-cross-quarter-view.md).)

### Public entry point

In-code: `renderTeamProjections(projData, allQuarters)` (`index.html:2550`).

UI: the `Team Projections` tab's per-team sections.

### Expected observable outcomes
- `#proj-teams-container.children.length === projData.length` after every render.
- `projectionChartInstances.length === 2 × projData.length` after every render.
- Each section's count chart has three stacked datasets; each effort chart has either two datasets (range + median) or one fallback dataset.
- The Initiative matrix has `len(allInits) + len(constantWorkRows)` body rows and 2 footer rows.
- The KR column appears only when at least one Initiative in the section has a non-empty `kr`.

### Test harness

Acceptance tests:
- Location: **N/A — manual.**
- Manual steps:
  1. Load CSVs spanning 3+ quarters with multiple teams. Press Run. Click `Team Projections`. Confirm section ordering and titles (AT-1).
  2. Inspect a section's DOM — count chart canvas, effort chart canvas, matrix table (AT-2).
  3. Pick a team with Initiatives across multiple quarters; confirm the matrix has one row per initiative with the badge in exactly the matching quarter column (AT-3, AT-4).
  4. Load a CSV with no KR column; confirm the matrix has no KR column (AT-5). Add a KR column; confirm the column appears (AT-6).
  5. Add a constant-work CSV with one entry; confirm the matrix shows the green-tinted row with the size+PM annotation (AT-7).
  6. Hover the count chart; confirm legend, stacking, integer y-axis (AT-8). Pick a team with sparse `byQuarter` and confirm zero-filled stacks (AT-9).
  7. Hover the effort chart's P50 bar; confirm the tooltip surfaces P25, P50, P75 (AT-12). Pick a team with no historical data and confirm the grey fallback dataset and "No effort data" tooltip (AT-11, AT-13).
  8. Inspect the matrix footer rows; confirm the count chips and effort band rows (AT-14).
  9. In DevTools, count `Chart.prototype.destroy` calls across two Runs; confirm previous instances are torn down (AT-15).
 10. With the active tab on `Organization Level` after a Run, confirm the projection chart canvases are zero-sized; click `Team Projections` and confirm they resize to their containers (AT-16).
 11. Pick a team with Initiatives in one quarter only; confirm the matrix and charts still show every quarter from `allQuarters` (AT-17).

Inner tests: N/A.

Verification: manual.

Fake-injection wiring: N/A.

### Proposed implementation seams

Stable seams a future test suite may target:
- `renderTeamProjections(projData, allQuarters)` — full-rebuild contract; destroys previous chart instances, rewrites `#proj-summary-wrap` and `#proj-teams-container`, repopulates `projectionChartInstances`.
- The per-section canvas id convention `proj-count-${teamIdx}` and `proj-effort-${teamIdx}`.
- The two-dataset shape of the effort chart (`P25–P75 range` + `P50 median`) when `hasEffort === true`.
- The single-dataset fallback (`No historical data`) when no quarter has `p50 > 0`.
- The conditional KR column rule (`hasKr = allInits.some(i => i.kr)`).
- The constant-work row tint and the `[{tshirt} · ~{effort} PM]` annotation.

Do NOT lock in:
- The exact chart colours (red/amber/blue/indigo palette) — purely cosmetic.
- The `barPercentage: 0.6 / 0.4` and `categoryPercentage: 0.7` numbers — visual tuning.
- The `252px` chart wrapper height — UX call.
- The `36px` gap between team sections — UX call.
- The exact tooltip wording (`P25: 5.0 · P50: 8.0 · P75: 12.0 PM`) — debuggable, not contractual.

### Behavioral rule

`renderTeamProjections` is the *Run-time* surface: called once per **Run**, it destroys every previous `projectionChartInstances` entry, writes the **Summary table** into `#proj-summary-wrap`, empties `#proj-teams-container`, and appends one `.proj-team-section` per `projData` entry. Each section's `displayQuarters` is *always* `allQuarters` (full cross-quarter axis, even when the team has data in only one quarter), `allInits` is the flat union of every quarter's `byQuarter[q].initiatives` array (including constant-work rows), and `hasKr` controls whether the KR column appears. Two Chart.js instances per team are created (the stacked count chart and the P25/P50/P75 effort chart) and pushed into `projectionChartInstances`. The tab-switch handler ([feature 0011](./0011-team-level-tab.md)) calls `c.resize()` on every entry of `projectionChartInstances` on first visibility.

### Invariants
- `#proj-teams-container.children.length === projData.length` after every successful render.
- Each `.proj-team-section` contains exactly one count canvas and one effort canvas.
- `projectionChartInstances.length === 2 × projData.length` after the render.
- Previous Chart.js instances are destroyed before re-creation (no memory leak).
- The Initiative matrix has the same `len(allQuarters)` quarter columns across every team (cross-team visual alignment).
- The KR column appears iff at least one initiative in the section has a non-empty `kr`.
- Constant-work rows are *strictly* after non-constant rows within the matrix `<tbody>`.
- The capacity marker is *not* rendered on either projection chart (`ensureCapacityMarker` is never called from this function).

### Counterexamples (must NOT pass)
- A `renderTeamProjections` that does *not* destroy previous Chart.js instances — leaks Chart.js memory and event listeners on every Run.
- A `displayQuarters` that is per-team (only the team's own quarters) — would break the cross-team alignment of the matrix and the count chart x-axis.
- A KR column that always appears — adds dead column space on CSVs that have no KR; the column is conditional by design.
- A constant-work row interleaved with sampled initiatives in the matrix — visually conflates the two categories; the green tint alone is not enough disambiguation.
- A count chart whose datasets are not stacked — would render the three MoSCoW counts side-by-side, losing the total-per-quarter read.
- An effort chart with a capacity line — re-introduces a risk-gate semantic that this view deliberately avoids ([ADR-0020](../adr/0020-team-projections-cross-quarter-view.md)).
- A render that lazy-builds chart instances on tab visibility — would mean every tab switch re-runs the Quick projection Monte Carlo; the pre-render-on-Run rule of [ADR-0018](../adr/0018-tab-based-results-layout.md) is the load-bearing decision.
- A constant-work row that hides the `[{tshirt} · ~{effort} PM]` annotation — the user reads the band shift from the chart and the rows from the matrix; both surfaces must agree.

### Forbidden shortcuts
- Do not introduce per-team or per-quarter markers on the projection charts. The marker system is for the chart contexts owned by the org tab and the team-level sections, not this tab.
- Do not animate bar transitions. The 300 ms duration is for the *initial* paint; subsequent renders happen on the next Run, where the user expects an instant repaint.
- Do not introduce a tooltip on the count chart's hover that aggregates across teams. The chart is per-team; cross-team comparison is the summary table's job.
- Do not surface the Must Only or Must + Should scenarios on the effort chart. Only MSC is rendered.
- Do not surface P10 or P90 on the band. The 3000-iteration cap is calibrated to P25/P50/P75 only ([ADR-0020](../adr/0020-team-projections-cross-quarter-view.md)).

### RED gate

On an un-implemented build:
- Manual step 1: `#proj-teams-container` is empty after the Run.
- Manual step 3: the matrix has one row per *quarter* (not per initiative), or every row's badge appears in every quarter column.
- Manual step 4: the KR column always appears or never appears regardless of the data.
- Manual step 7: constant-work rows are missing, untinted, or lack the size+PM annotation.
- Manual step 9: a second Run leaves the first Run's chart canvases in the DOM.

### Test immutability rule

N/A.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-17 all pass.
- [ ] Each Projection section renders count chart + effort chart + Initiative matrix with the documented structure.
- [ ] The KR column is conditional on `hasKr`.
- [ ] Constant-work rows are appended after the MoSCoW-sorted initiatives, green-tinted, with size+PM annotation.
- [ ] Previous Chart.js instances are destroyed on every re-render.
- [ ] The projection charts have *no* capacity line.
- [ ] `git diff` touches only `index.html` and the new ADR / plan / CONTEXT.md entries ([ADR-0001](../adr/0001-single-file-html-app.md)).
