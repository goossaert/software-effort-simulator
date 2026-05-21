# Feature: Team Level tab with per-team independent simulations and historical-scope toggle

Created at: 2026-05-21T00:00:00Z

## Context

This feature introduces the **Team Level tab** — the second of four tabs in the results region — and the per-team independent **Run** model it surfaces. Where the org-level tab ([feature 0006](./0006-org-histogram-chart.md) + [feature 0007](./0007-org-level-summary-statistics-table.md)) answers "is the plan plausible at the organisation level?", the Team Level tab answers "where does the risk concentrate, team-by-team?" by running one full Monte Carlo simulation per **Team** present in the selected **Target quarter(s)** and rendering each team's own histogram + stats table in its own section. The same feature also introduces the tab structure itself — a four-button `.tab-bar` and four sibling `.tab-panel` panels with a delegated click handler that toggles visibility — because the second view is what made the first tab need to exist.

The feature is deliberately broad enough to own three things: (a) the tab bar markup and switching mechanism (`index.html:982-987`, `index.html:3275-3291`), (b) the per-team data assembly via `prepareTeamSimulationData` (`index.html:1802-1904`), and (c) the per-team rendering via `renderTeamCharts` and `renderTeamSection` (`index.html:2422-2525`), including the `Historical data` radio toggle between *This team only* and *All teams — org-wide*. It does *not* own the org-level chart and stats table inside `#tab-org` (those belong to [feature 0006](./0006-org-histogram-chart.md) and [feature 0007](./0007-org-level-summary-statistics-table.md)) — it only *embeds them in a tab panel*. It does not own the Team Projections tab ([feature 0012](../../backtracked-features.md#0012)) or the Initiatives tab ([feature 0019](../../backtracked-features.md#0019)); their markup exists inside the tab structure this feature defines, but their content is owned by later features.

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). The tab switching is vanilla DOM (no router); the per-team sections are appended via `innerHTML`; no template engine.
- [ADR-0008 — Poisson distribution for epic count per initiative](../adr/0008-poisson-epic-count.md). The team-scoped **Poisson λ** is fit by the same logic as the org-level λ, just over the team-filtered initiative set.
- [ADR-0010 — Three-scenario MoSCoW forecasting](../adr/0010-three-scenario-moscow-forecasting.md). Each team's **Run** produces the same three **Scenario** outputs (Must Only / Must + Should / Must + Should + Could).
- [ADR-0014 — Capacity and iterations as user-configured per-Run sidebar inputs](../adr/0014-capacity-and-iterations-as-run-inputs.md). Every team's Run reads the same **Capacity** and **Iterations** as the org-level Run; there is no per-team capacity override.
- [ADR-0015 — Capacity as an auto-managed chart marker](../adr/0015-capacity-as-auto-managed-chart-marker.md). Every team chart inherits the auto-managed capacity marker through `ensureCapacityMarker(`team-${idx}`, lastCapacity)`.
- [ADR-0018 — Tab-based results layout, with the org level as the resting tab](../adr/0018-tab-based-results-layout.md). The architectural decision for *why* the results region is split into tabs and *why* the org tab is the resting one. The Team Level tab is the second one.
- [ADR-0019 — Per-team independent Monte Carlo simulations with toggleable historical scope](../adr/0019-per-team-independent-simulations.md). The architectural decision for *why* each team gets its own full Monte Carlo, *why* the historical parameter source is toggleable, and *why* the recommendation threshold is 4 historical initiatives.

Glossary terms used below: **Team**, **Team Level tab**, **Tab**, **Tab panel**, **Run**, **Iteration**, **Scenario**, **MoSCoW**, **Initiative**, **Epic**, **Historical quarter**, **Target quarter**, **Poisson λ**, **Bootstrap pool**, **T-shirt size**, **Capacity**, **Stats**, **Risk tier**, **Marker** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user who has just pressed **Run Simulation** sees the results region appear with four tab buttons across the top: `Organization Level` (active), `Team Level`, `Team Projections`, `Initiatives`. The org panel is visible; the other three are hidden. The org panel shows the canonical three-**Scenario** histogram and the **Stats** table as before (feature 0006 / 0007). Clicking the `Team Level` button switches the active state: the org panel hides, the team panel becomes visible (`display: flex`), and the active underline shifts to the `Team Level` button. The tab bar style is a row of buttons with a 2 px bottom border; the active tab carries the indigo accent.

Inside the `Team Level` panel the user sees one section per **Team** with at least one in-scope **Initiative** in the selected **Target quarter(s)**, sorted alphabetically (case-insensitive). Each section is a vertical block containing:

1. **Section title row** — the team name in bold indigo, followed by a small grey breadcrumb listing the three **Scenario** initiative counts: `Must: 3 · Must+Should: 7 · All: 11`.
2. **Historical data selector** — a soft-grey card with the label `HISTORICAL DATA` and two radio buttons:
   - `This team only (5 initiatives)` — uses the team-scoped **Poisson λ** and **Bootstrap pool**.
   - `All teams — org-wide (160 epic samples)` — uses the org-level **λ** and **Bootstrap pool** computed in the same **Run**.
   When the team has 4 or fewer historical **Initiatives**, the org-wide radio is pre-selected and a yellow recommendation chip is appended: `⚠️ Recommended: only 3 historical initiatives found for this team`. When the team has 5 or more, the team-scoped radio is pre-selected and no chip is shown.
3. **Chart card** — a 420 px-tall white card holding a `<canvas id="team-chart-${idx}">`. The chart is the same three-**Scenario** overlapping histogram as the org chart, with the capacity marker (`Capacity: {value} PM`) auto-rendered. Three buttons sit in the top-right corner: `↓ Save` (markers), `↑ Load` (markers), `＋ Add marker` — each is per-team-context, with key `team-${idx}` ([feature 0017](../../backtracked-features.md#0017)).
4. **Stats table** — the same `Metric | Must Only | Must + Should | Must + Should + Could` table as the org tab, with P10 / P25 / P50 / P75 / P90 / Mean / `P(effort > capacity)` rows and the same **Risk tier** colour rules.

Clicking the other radio in any team's selector immediately re-runs that team's Monte Carlo with the alternative historical source and re-paints only that section's chart and stats table. The other sections, the org tab, and any markers on the other teams' charts are untouched. The radio toggle is the *only* live re-render path on this tab — every other change requires a new **Run** through the sidebar's Run button.

If the user re-presses the `Run Simulation` button while on the `Team Level` tab, the run-button handler resets the active tab to `Organization Level` and re-renders everything, including the team list. Teams that have disappeared between runs (e.g. the user changed the target quarter selection) drop out of the list; new teams that have appeared get fresh sections with their own radio defaults.

There is no per-tab progress indicator and no per-team re-Run button — every team is part of the same atomic **Run**. The radio toggle is a *post-Run* control that uses cached `lastTeamData` and the **Capacity** / **Iterations** values *as used by the most recent Run*, not the live sidebar values (which the user may have edited since pressing Run).

## Scope

### In scope
- The tab bar markup at `index.html:982-987`: a single `.tab-bar` `<div>` containing four `<button class="tab-btn">` elements with `data-tab="org" | "teams" | "projections" | "initiatives"` and the `active` class on `data-tab="org"` initially.
- The four `.tab-panel` panels with `id="tab-org" | "tab-teams" | "tab-projections" | "tab-initiatives"` (`index.html:990-1029`). The contract is: each panel's `id` is `tab-${dataTab}`; only `#tab-org` starts visible, the other three start `display: none`.
- The CSS at `index.html:520-537`: `.tab-bar`, `.tab-btn`, `.tab-btn:hover`, `.tab-btn.active`, `.tab-panel`.
- The CSS at `index.html:551-638`: `#teams-container`, `.team-section`, `.team-section-title`, `.team-hist-selector`, `.team-hist-selector .selector-label`, `.team-hist-selector label`, `.team-hist-selector input[type=radio]`, `.team-hist-rec`, `.team-chart-wrapper`, `.team-stats-table` and its column variants.
- The delegated tab-switch click handler at `index.html:3275-3291`:
  - Reads `e.target.closest('.tab-btn')`.
  - Toggles `.active` on `.tab-btn` exclusively.
  - Toggles `.tab-panel.style.display` between `flex` (active) and `none` (inactive) based on `p.id === \`tab-${tab}\``.
  - Resizes `teamChartInstances` on `teams` activation and `projectionChartInstances` on `projections` activation (the latter is wired here but the *content* of the projections tab belongs to feature 0012).
- The post-Run tab reset (`index.html:3367-3375`): toggles `.tab-btn.active` to `data-tab="org"`, sets `#tab-org.style.display = 'flex'`, and sets the other three to `display: none`.
- `prepareTeamSimulationData(histQuarters, targetQuarters, orgLambda, orgEpicSizingDist)` (`index.html:1802-1904`):
  - Collects the case-insensitively-deduplicated set of teams from `editedInitiatives` filtered by `targetQuarters`, preserving first-seen casing.
  - Sorts teams alphabetically (case-insensitive `localeCompare`).
  - For each team, computes:
    - `histInits` — initiatives in the team and the historical quarters.
    - `quartersWithEpicData` — the set of `histQuarters` that have at least one tagged epic.
    - `teamLambda` — mean epic count per `histInits` initiative, restricted to initiatives whose quarter is in `quartersWithEpicData`. `0` when the team has no in-scope sized epics.
    - `teamEpicSizingDist` — the **Bootstrap pool** of t-shirt sizes for this team, filtered to **Recognised t-shirt size** entries.
    - `kMust`, `kMustShould`, `kMustShouldCould` — cumulative **MoSCoW** counts over the team's in-scope target-quarter initiatives.
    - `useOrgByDefault` — `true` iff `histInitCount <= 4`.
    - `fixedEffort` — the deterministic constant-work shift for this team and target quarters, via `getConstantWorkEffort(targetQuarters, teamName)` ([feature 0015](../../backtracked-features.md#0015)).
  - Returns the array of `TeamData` entries also carrying the `orgLambda` and `orgEpicSizingDist` arguments verbatim, so `renderTeamSection` can switch between team-scoped and org-wide without re-asking the engine.
- The module-scoped state (`index.html:2410-2416`):
  - `teamChartInstances: Array<Chart>` — one Chart.js instance per team section, indexed by team idx; previous instances are destroyed before re-render.
  - `projectionChartInstances: Array<Chart>` — declared here, used by feature 0012; resized on `projections` tab activation.
  - `lastTeamData: Array<TeamData>` — cached output of the most-recent `prepareTeamSimulationData` Run.
  - `lastCapacity: number` — capacity *as used* by the most-recent Run.
  - `lastIterations: number` — iterations *as used* by the most-recent Run.
- `renderTeamCharts(teamDataArray, capacity, iterations)` (`index.html:2445-2525`):
  - Persists `lastTeamData` / `lastCapacity` / `lastIterations`.
  - Destroys previous `teamChartInstances` entries.
  - Empties and re-populates `#teams-container` with one `.team-section` per team.
  - Attaches a single delegated `change` listener to `#teams-container` that calls `renderTeamSection(idx, useOrgNow)` on any radio change.
  - Calls `renderTeamSection(idx, useOrg)` for each team's initial paint, where `useOrg` is `td.useOrgByDefault`.
- `renderTeamSection(idx, useOrg)` (`index.html:2422-2439`):
  - Reads `lastTeamData[idx]`.
  - Selects `lambda` and `epicSizingDist` from team-scoped or org-wide based on `useOrg`.
  - Calls `runSimulation` with `{lambda, epicSizingDist, kMust, kMustShould, kMustShouldCould, capacity: lastCapacity, iterations: lastIterations, fixedEffort}`.
  - Calls `ensureCapacityMarker(\`team-${idx}\`, lastCapacity)`.
  - Destroys the previous `teamChartInstances[idx]` and creates a fresh chart via `renderChartOnCanvas`.
  - Renders the stats table via `renderStatsTableInto(\`team-stats-tbody-${idx}\`, results, lastCapacity, \`team-${idx}\`)`.
- The run-button handler integration (`index.html:3352-3353`): the Run pipeline calls `prepareTeamSimulationData(histQs, targetQs, lambda, epicSizingDist)` and `renderTeamCharts(teamData, capacity, iters)` after the org-level render is complete.

### Out of scope
- The org-level chart and stats table rendering inside `#tab-org`. [Feature 0006](./0006-org-histogram-chart.md) and [feature 0007](./0007-org-level-summary-statistics-table.md). This feature only embeds them inside the tab structure.
- The Team Projections tab's contents. [Feature 0012](../../backtracked-features.md#0012). The `#tab-projections` panel is declared here (the tab structure owns the markup); its contents (`buildTeamProjections`, `renderTeamProjections`, the summary table, the per-team projection sections) belong to feature 0012.
- The Initiatives tab's contents. [Feature 0019](../../backtracked-features.md#0019). Same split as projections.
- The Monte Carlo engine (`runSimulation`, `runScenario`, `samplePoisson`, `sampleLognormal`, `Xoshiro128ss`). [Feature 0003](./0003-monte-carlo-simulation-engine.md). This feature *calls* `runSimulation` per team; the engine's internals are upstream.
- `renderChartOnCanvas` and `renderStatsTableInto` themselves. [Feature 0006](./0006-org-histogram-chart.md) and [feature 0007](./0007-org-level-summary-statistics-table.md). This feature *consumes* them for the team charts and tables.
- `ensureCapacityMarker` and the marker system more broadly. [Feature 0017](../../backtracked-features.md#0017). The team charts use the per-context `team-${idx}` key the marker system exposes; this feature does not own the marker logic.
- `getConstantWorkEffort`. [Feature 0015](../../backtracked-features.md#0015). This feature reads the per-team/quarter constant-work shift via that helper.
- A per-team **Capacity** override. [ADR-0014](../adr/0014-capacity-and-iterations-as-run-inputs.md). Out of scope; every team reads `lastCapacity`.
- A per-team **Iterations** override. Out of scope; every team reads `lastIterations`.
- Persisting the radio selection across **Runs**. Out of scope; on the next Run, every team re-evaluates `useOrgByDefault` from scratch and the radio resets accordingly.
- A "filtered org-wide" third radio option (every team *except* the current one). Future revision; called out in [ADR-0019](../adr/0019-per-team-independent-simulations.md) as additive.

## Relevant existing files
Claude may inspect:
- `index.html`, specifically:
  - The tab-bar markup at `index.html:982-987` and the four panel siblings at `index.html:990-1029`.
  - The tab-related CSS at `index.html:515-537` and the team-section CSS at `index.html:551-638`.
  - `prepareTeamSimulationData` (`index.html:1802-1904`).
  - `teamChartInstances`, `lastTeamData`, `lastCapacity`, `lastIterations` declarations (`index.html:2410-2416`).
  - `renderTeamSection` (`index.html:2422-2439`) and `renderTeamCharts` (`index.html:2445-2525`).
  - The run-button handler at `index.html:3303-3389` — specifically the team-level integration at `index.html:3352-3353` and the post-Run tab reset at `index.html:3367-3375`.
  - The tab-switch delegated handler at `index.html:3275-3291`.
- `CONTEXT.md` glossary, especially the new **Team**, **Team Level tab**, **Tab**, **Tab panel** entries and the existing **Run**, **Scenario**, **Stats**, **MoSCoW** terms.
- ADRs 0001, 0008, 0010, 0014, 0015, 0018, and 0019 for the constraints this feature must respect.

Claude should not inspect unless needed:
- The Monte Carlo samplers themselves (`samplePoisson`, `sampleLognormal`, `Xoshiro128ss`) — they are called by `runSimulation`, which is what this feature drives.
- The marker dialog implementation (`openMarkerDialog`, `handleMarkerSave`, `handleMarkerDelete`) — the team charts wire the same per-context API; the dialog internals are upstream.
- `prepareSimulationData` itself — the team-prep function reads the *result* of the org prep (the `lambda` and `epicSizingDist` arguments), not the prep's internals.
- The empirical-parameters toggle ([feature 0018](../../backtracked-features.md#0018)) — it swaps `activeParams` globally, which the team Runs read transparently; no special wiring here.

## Existing patterns to follow
- **Layering inside `index.html`**: the tab-bar and panel markup live in Module 0 (the static HTML). The CSS lives at the top of the same file. `prepareTeamSimulationData` lives in Module 4 (data prep), grouped after `prepareSimulationData`. The team-rendering functions (`renderTeamSection`, `renderTeamCharts`) live in Module 6 (chart & stats rendering), grouped next to `renderChart` and `renderStatsTable`. The tab-switch handler and the run-button handler integration live in Module 7 (UI controller). This matches the layering plans [0006](./0006-org-histogram-chart.md) and [0007](./0007-org-level-summary-statistics-table.md) follow.
- **Per-context marker key naming**: every team section uses the context key `team-${idx}` where `idx` is the zero-based section index. The org context uses the literal `'org'`. The convention is fixed; the marker system ([feature 0017](../../backtracked-features.md#0017)) reads these keys directly.
- **One DOM write per re-render**: `renderTeamCharts` empties `#teams-container.innerHTML` once at the top, then builds each `.team-section` via a template literal and appends it via `appendChild`. `renderTeamSection` does not touch `#teams-container`'s outer structure — it only mutates `team-chart-${idx}` and `team-stats-tbody-${idx}`. The split keeps "build the section list" and "(re-)paint a single section" cleanly separated.
- **Delegated event handling at container scope**: the radio change listener is attached once to `#teams-container` (not once per radio), reading the team index from `closest('.team-section').dataset.teamIdx`. The same pattern is used by the tab-bar click handler on `#results-content`.
- **Module-scoped Run cache**: `lastTeamData`, `lastCapacity`, `lastIterations` are the *only* cross-Run state owned by this feature. They are written by `renderTeamCharts` and read by `renderTeamSection`. Do not read the live sidebar `#capacity.value` from `renderTeamSection` — that would let a sidebar edit between two radio toggles silently shift the chart's capacity line and the stats table's `P(effort > capacity)` row.
- **Team dedup is case-insensitive but casing-preserving**: `teamMap.set(raw.toLowerCase(), raw)` — the first-seen casing wins. Lowercasing the section title would feel like a downgrade. Title-casing would be a presumption.
- **Sort teams case-insensitively**: `[...teamMap.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))`. The alphabetical sort is the documented order; insertion order would surprise the reader.
- **No framework**: vanilla DOM (`document.getElementById`, `appendChild`, `closest`, `dataset.*`). The radio markup uses native `<input type="radio" name="hist-src-${idx}">` with the unique `name` attribute scoping each pair to its section.
- **Verification command**: there is no automated test harness in this project. Verification is manual: open `index.html`, upload known-good CSVs, press Run, click the `Team Level` tab, exercise the radios.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer — this is a client-side-only app (ADR-0002). In-memory state owned by this feature:

```js
// Module-scoped, declared once near the team-rendering functions.
let teamChartInstances:       Array<Chart>     = [];   // One per team section; destroyed-and-rebuilt on re-render.
let projectionChartInstances: Array<Chart>     = [];   // Declared here, owned by feature 0012.
let lastTeamData:             Array<TeamData>  = [];   // Snapshot from the most-recent Run.
let lastCapacity:             number           = 120;  // Capacity *as used* by the most-recent Run.
let lastIterations:           number           = 10000;// Iterations *as used* by the most-recent Run.

// Shape returned per entry by prepareTeamSimulationData(...):
type TeamData = {
  teamName:           string;            // First-seen casing of the team label.
  histInitCount:      number;            // Count of in-scope historical Initiatives.
  useOrgByDefault:    boolean;           // True iff histInitCount <= 4.
  // Team-scoped historical parameters
  teamLambda:         number;            // Poisson λ over this team's in-scope historical Initiatives. 0 if none.
  teamEpicSizingDist: string[];          // Bootstrap pool of Recognised t-shirt sizes for this team.
  // Org-wide historical parameters (passed in verbatim)
  orgLambda:          number;            // Same number the org-level Run used.
  orgEpicSizingDist:  string[];          // Same pool the org-level Run used.
  // Target-quarter MoSCoW counts (always team-scoped, never toggleable)
  kMust:              number;            // Count of Must initiatives for this team in the target quarter(s).
  kMustShould:        number;            // Cumulative Must + Should.
  kMustShouldCould:   number;            // Cumulative Must + Should + Could.
  // Deterministic constant-work effort (PM) for this team's target quarters
  fixedEffort:        number;            // 0 when no constant-work CSV is loaded.
};
```

Read contract for the radio toggle: `renderTeamSection(idx, useOrg)` reads `lastTeamData[idx]`, `lastCapacity`, `lastIterations`. It does *not* read the live sidebar inputs.

---

## Phase 1: Tab bar markup, tab switching, post-Run tab reset

### Acceptance behavior

Scenario AT-1: Initial paint shows all four tabs with org active
Given the page has just loaded
And the user has pressed **Run Simulation** for the first time
When the results region (`#results-content`) becomes visible
Then `.tab-bar` contains four buttons in the order `Organization Level`, `Team Level`, `Team Projections`, `Initiatives`
And exactly one button — the one with `data-tab="org"` — carries the `.active` class
And `#tab-org.style.display === 'flex'`
And `#tab-teams.style.display === 'none'`
And `#tab-projections.style.display === 'none'`
And `#tab-initiatives.style.display === 'none'`

Scenario AT-2: Clicking a tab switches the active state
Given the user is on the `Organization Level` tab
When the user clicks the `Team Level` button
Then the `data-tab="teams"` button gains `.active` and the `data-tab="org"` button loses it
And `#tab-teams.style.display === 'flex'`
And `#tab-org.style.display === 'none'`
And `#tab-projections.style.display === 'none'`
And `#tab-initiatives.style.display === 'none'`

Scenario AT-3: Tab switch triggers chart resize on the now-visible tab
Given the user has run a simulation and is currently on the `Organization Level` tab
And `teamChartInstances` holds one or more non-null Chart.js instances
When the user clicks the `Team Level` button
Then `c.resize()` is called on every non-null entry of `teamChartInstances`
(The resize is needed because Chart.js cannot compute canvas dimensions while the panel is `display: none`.)

Scenario AT-4: Tab switch triggers chart resize on projections tab too
Given the user is currently on the `Organization Level` tab
And `projectionChartInstances` holds one or more non-null Chart.js instances
When the user clicks the `Team Projections` button
Then `c.resize()` is called on every non-null entry of `projectionChartInstances`
(Wired in the same handler; the content of the projections tab is owned by [feature 0012](../../backtracked-features.md#0012).)

Scenario AT-5: Switching to org or initiatives does not resize team or projection charts
Given the user is on the `Team Level` tab
When the user clicks `Organization Level` or `Initiatives`
Then `teamChartInstances` and `projectionChartInstances` are *not* resized
(The resize is only invoked when the *just-activated* tab is the one whose charts are about to be visible.)

Scenario AT-6: Run-button press resets the active tab to org
Given the user is currently on the `Team Level` tab
And has just pressed `Run Simulation`
When the Run pipeline finishes
Then exactly one `.tab-btn.active` exists, and it is the `data-tab="org"` button
And `#tab-org.style.display === 'flex'`
And the three other panels are `display: none`

Scenario AT-7: Click outside `.tab-btn` does nothing
Given the user clicks an empty area of `#results-content` (e.g. between the tab bar and the panel)
When the delegated click handler fires
Then `e.target.closest('.tab-btn')` returns `null`
And the handler returns early
And no active-state changes occur

Scenario AT-8: Repeated clicks on the same tab are idempotent
Given the user is on the `Team Level` tab
When the user clicks the `Team Level` button again
Then the active state remains on `Team Level`
And `#tab-teams.style.display` stays `'flex'`
And `teamChartInstances.forEach(c => c.resize())` runs again (idempotent — the resize is safe to re-invoke)

### Public entry point

In-code:
- The tab-bar markup at `index.html:982-987` (four `<button class="tab-btn">`).
- The delegated click handler at `index.html:3275-3291`.
- The post-Run reset block at `index.html:3367-3375` inside the run-button handler.

UI: the four buttons in `.tab-bar`. There is no keyboard shortcut.

### Expected observable outcomes
- `.tab-btn.active` is on exactly one button at all times after the first paint.
- `.tab-panel.style.display` is `'flex'` on exactly one panel at all times after the first paint; the others are `'none'`.
- The button's `data-tab` and the panel's `id` match by the convention `id === \`tab-${dataTab}\``.
- The chart resize is invoked only on the just-activated tab's relevant array.

### Test harness

Acceptance tests:
- Location: **N/A — this project has no automated test suite.** Manual acceptance is performed in the browser.
- Manual steps:
  1. Open `index.html`, load CSVs, press Run. Confirm AT-1's `Then` clauses by inspecting `.tab-btn` and `.tab-panel` in DevTools.
  2. Click `Team Level`. Confirm AT-2.
  3. With DevTools open, attach a temporary monkey-patch on `Chart.prototype.resize` (e.g. wrap to count invocations). Click `Team Level` and confirm one resize call per team chart (AT-3). Repeat for `Team Projections` (AT-4). Click `Organization Level` and `Initiatives` and confirm no resize calls on team/projection arrays (AT-5).
  4. From the `Team Level` tab, press Run again. Confirm the tab returns to `Organization Level` (AT-6).
  5. Click between the tab bar and the chart card. Confirm no tab change (AT-7).
  6. Double-click `Team Level`. Confirm idempotent state (AT-8).

Inner tests:
- Location: **N/A.** If a harness is added, the handler is testable by dispatching synthetic `click` events on each `.tab-btn` against a fixture DOM.

Verification: manual.

Fake-injection wiring: N/A.

### Proposed implementation seams

Stable seams a future test suite may target:
- The `id === \`tab-${dataTab}\`` convention.
- The single-source-of-truth rule for "which tab is active" (the `.active` class is the only state).
- The post-Run reset always lands on `data-tab="org"`.

Do NOT lock in:
- The exact button labels (`Organization Level`, `Team Level`, etc.). Human-readable.
- The order of the four tabs in the bar; reordering is a UX change, not a contract.
- The 2 px bottom border, the indigo accent colour, the underline animation duration — purely cosmetic.
- The exact `style.display: 'flex' | 'none'` toggle (a hypothetical future revision could swap to `hidden` attribute or `aria-selected`-driven CSS).

### Behavioral rule

The results region is split into four tabs whose buttons live in a single `.tab-bar` and whose panels are sibling `.tab-panel` divs inside `#results-content`. Exactly one tab is active at any time, indicated by the `.active` class on the button and `display: flex` on the matching panel; clicking another button switches both in a single delegated handler. After every **Run**, the active tab resets to `Organization Level`. Chart instances on the just-activated tab are resized so Chart.js can compute their canvas dimensions for the first time since the panel was hidden.

### Invariants
- Exactly one `.tab-btn` carries `.active` at all times after the first paint.
- Exactly one `.tab-panel` has `display: flex` at all times after the first paint; the others are `display: none`.
- The convention `panel.id === \`tab-${btn.dataset.tab}\`` holds for every button/panel pair.
- The delegated click handler is the *only* writer of `.active` on `.tab-btn` and of `.style.display` on `.tab-panel` (excluding the initial markup state and the post-Run reset).
- The post-Run reset *always* leaves the active tab on `Organization Level`, regardless of which tab was active before the Run.
- `c.resize()` is invoked only on the chart array matching the just-activated tab (`teamChartInstances` for `teams`, `projectionChartInstances` for `projections`).

### Counterexamples (must NOT pass)
- A handler that toggles `display: block` (instead of `flex`) on the panel — would break the panel's flex column layout and stack its children incorrectly.
- A handler that calls `c.resize()` on the *org* chart on every tab switch — would not be a bug per se, but is wasted work because the org chart only needs a resize when its panel first becomes visible after a Run.
- A `Run` pipeline that preserves the previous active tab — would silently leave the user on `Team Level` after a Run, where the team list may have changed; they would need a manual scroll to find the new data.
- A handler that uses `e.target.classList.contains('tab-btn')` instead of `closest('.tab-btn')` — clicks on a child element of the button (if any are added later) would miss the handler.
- A handler that listens on each button individually — would require rebind logic if a new tab is added or removed.

### Forbidden shortcuts
- Do not introduce a router or hash-based tab state. The tab is a transient UI affordance; bookmarking a tab is out of scope.
- Do not lazy-render heavy tabs on first show. Every panel pre-renders during the same Run that produces its data (see [ADR-0019](../adr/0019-per-team-independent-simulations.md)).
- Do not use ARIA `role="tablist"` and `role="tabpanel"` without also wiring focus management; the half-built ARIA story is worse than none. A future a11y pass is an opt-in revision.

### RED gate

On an un-implemented build:
- Manual step 1: the tab bar is absent and the results region shows just the org chart in a single column.
- Manual step 2: clicking the `Team Level` button does nothing (no class change, no display flip).
- Manual step 3: a team chart renders with a zero-sized canvas because no resize was invoked.

### Test immutability rule

There are no test files to freeze (manual harness).

### Definition of done
- [ ] Manual scenarios AT-1 through AT-8 all pass.
- [ ] Exactly one tab is visually active and exactly one panel is rendered at all times.
- [ ] The post-Run reset lands on org regardless of the previous tab.
- [ ] Chart resize on activation is only invoked on the corresponding array.

---

## Phase 2: `prepareTeamSimulationData` — per-team data assembly

### Acceptance behavior

Scenario AT-1: One entry per team present in the target quarter(s)
Given `editedInitiatives` has rows with teams `Platform`, `Lending`, `platform`, `Risk` in the selected target quarters
When `prepareTeamSimulationData(['Q2 2026'], ['Q3 2026'], orgLambda, orgEpicSizingDist)` runs
Then the returned array has length 3 (`Platform` and `platform` are deduplicated case-insensitively)
And the `teamName` fields are `['Lending', 'Platform', 'Risk']` (alphabetically sorted, case-insensitive)

Scenario AT-2: Case-insensitive dedup preserves first-seen casing
Given rows with teams `platform`, `Platform`, `PLATFORM` (in that row order)
When `prepareTeamSimulationData` runs
Then exactly one entry exists with `teamName === 'platform'` (the first-seen casing)

Scenario AT-3: Empty team values are excluded
Given some rows have an empty `team` field (`''` or whitespace-only)
When `prepareTeamSimulationData` runs
Then those rows do not contribute a section
And the returned array contains no entry with empty `teamName`

Scenario AT-4: Teams present only in non-target quarters are excluded
Given a row with team `Legacy` whose `quarter` is not in the selected target quarter(s)
When `prepareTeamSimulationData` runs
Then no entry for `Legacy` is returned
(The team list is bounded by the target-quarter selection.)

Scenario AT-5: Team-scoped λ is the mean epic count per in-scope initiative
Given team `Platform` has 4 in-scope historical initiatives whose epic counts (after the in-scope filter) are `[2, 3, 5, 6]`
When `prepareTeamSimulationData` runs
Then `teamData[i].teamLambda === 4` (mean of `[2,3,5,6]` = 4)

Scenario AT-6: Team-scoped λ is 0 when the team has no in-scope sized epics
Given team `Lending` has 3 historical initiatives but no epics are linked to them
When `prepareTeamSimulationData` runs
Then `teamData[i].teamLambda === 0`

Scenario AT-7: Team-scoped bootstrap pool is filtered to Recognised t-shirt sizes
Given team `Risk` has epics with sizes `['S', 'M', 'foo', 'L', '', 'XL']`
When `prepareTeamSimulationData` runs
Then `teamData[i].teamEpicSizingDist === ['S', 'M', 'L', 'XL']` (in the order the epics were walked)
And `'foo'` and `''` are excluded

Scenario AT-8: K values are always team-scoped, never org-wide
Given the org has 24 in-scope initiatives in the target quarter (8 Must, 11 Should, 5 Could) but team `Platform` has only 3 (2 Must, 1 Should, 0 Could)
When `prepareTeamSimulationData` runs
Then `teamData['Platform'].kMust === 2`
And `teamData['Platform'].kMustShould === 3`
And `teamData['Platform'].kMustShouldCould === 3`
And no toggleable variant of these counts exists

Scenario AT-9: `useOrgByDefault` flips at the 4-initiative threshold
Given team `A` has 4 historical initiatives and team `B` has 5
When `prepareTeamSimulationData` runs
Then `teamData['A'].useOrgByDefault === true` (4 is ≤ 4)
And `teamData['B'].useOrgByDefault === false` (5 is > 4)

Scenario AT-10: orgLambda and orgEpicSizingDist are passed through verbatim
Given `orgLambda = 4.32` and `orgEpicSizingDist = ['S', 'M', ..., 'XL+']` (160 entries)
When `prepareTeamSimulationData(histQs, targetQs, orgLambda, orgEpicSizingDist)` runs
Then every entry's `orgLambda === 4.32` exactly
And every entry's `orgEpicSizingDist` is the same array reference (or a value-identical copy)

Scenario AT-11: `fixedEffort` reflects the constant-work CSV for this team
Given `constantWorkData` has one row matching team `Platform` and target quarter `Q3 2026` with size `M` (lognormal mean ≈ 2.12 PM)
When `prepareTeamSimulationData([..], ['Q3 2026'], ..., ..)` runs
Then `teamData['Platform'].fixedEffort ≈ 2.12`
And teams with no matching constant-work row have `fixedEffort === 0`

Scenario AT-12: Quarters with epic data are identified by tagged epics only, not by initiative-link
Given an epic links to `INIT-A` (which exists in `Q2 2026`) but the epic itself is untagged
And the user selects only `Q1 2026` as the historical quarter
When `prepareTeamSimulationData(['Q1 2026'], ..., ..., ...)` runs
Then `Q1 2026` is *not* added to `quartersWithEpicData` (because no tagged epic carries `_quarter === 'Q1 2026'`)
And the in-scope filter excludes that epic when scoring λ for any team
(This mirrors the org-level inScope logic — a quarter must have a tagged epic to count as having epic data.)

### Public entry point

In-code: `prepareTeamSimulationData(histQuarters: string[], targetQuarters: string[], orgLambda: number, orgEpicSizingDist: string[]): TeamData[]`.

UI: implicit — the run-button handler calls this function during the Run pipeline.

### Expected observable outcomes
- Pure function from inputs (and the module-scoped `editedInitiatives`, `parsedEpics`, `detectedCols`, `T_SHIRT_PARAMS`) to the returned `TeamData[]`.
- No DOM mutation, no chart instances created, no markers touched.
- The returned array is sorted alphabetically by `teamName.toLowerCase()`.
- `teamLambda` and `teamEpicSizingDist` are computed by the same in-scope logic as the org-level prep, just team-filtered.

### Test harness

Acceptance tests:
- Location: **N/A — manual.** Same rationale as Phase 1.
- Manual steps:
  1. In DevTools console, after a Run: `prepareTeamSimulationData(histMS.getSelected(), targetMS.getSelected(), 4.32, ['S','M','L','XL'])`. Inspect the returned array's length and `teamName` values.
  2. Construct a CSV with mixed-case team labels and confirm AT-1, AT-2, AT-3.
  3. Construct a CSV with a team that only appears in non-target quarters and confirm AT-4.
  4. Pick a small team with countable epics and confirm `teamLambda` matches a hand-computed mean (AT-5).
  5. Construct a team with no in-scope sized epics; confirm `teamLambda === 0` (AT-6).
  6. Add a few epics with unrecognised sizes; confirm they are filtered out (AT-7).
  7. Confirm `kMust + (Should) + (Could)` per team matches a hand-computed count restricted to that team (AT-8).
  8. Find two teams flanking the threshold (4 and 5 historical initiatives); confirm `useOrgByDefault` flips (AT-9).
  9. Confirm `orgLambda` and `orgEpicSizingDist` are passed through unchanged (AT-10).
 10. Load a constant-work CSV with a row matching a known team and target quarter; confirm `fixedEffort` is non-zero for that team (AT-11).
 11. Untag every epic's `_quarter` and confirm the in-scope filter falls back to the initiative-link-only path (AT-12).

Inner tests: N/A.

Verification: manual.

Fake-injection wiring: N/A.

### Proposed implementation seams

Stable seams a future test suite may target:
- `prepareTeamSimulationData(histQuarters, targetQuarters, orgLambda, orgEpicSizingDist): TeamData[]` — pure function.
- The 4-initiative threshold (`histInitCount <= 4`) as `useOrgByDefault`.
- The case-insensitive dedup + first-seen-casing rule.
- The alphabetical case-insensitive sort.

Do NOT lock in:
- The 4-initiative threshold itself — it is a calibrated midpoint, changeable in one line.
- The exact sort comparator — `localeCompare` is the current choice; future could switch to a more sophisticated locale-aware sort.
- The `targetInits.filter(isTeam)` walk pattern — internal, may be refactored.

### Behavioral rule

`prepareTeamSimulationData` assembles one `TeamData` entry per **Team** present in the selected **Target quarter(s)**, with a case-insensitive dedup (first-seen casing preserved) and an alphabetical case-insensitive sort. For each team it computes a *team-scoped* **Poisson λ** and **Bootstrap pool** using the same in-scope-epic logic as the org-level prep (a quarter counts as having epic data only if at least one tagged epic carries that quarter), the three cumulative target-quarter **MoSCoW** counts (`kMust`, `kMustShould`, `kMustShouldCould`), the deterministic constant-work shift (`fixedEffort`) via `getConstantWorkEffort`, and the `useOrgByDefault` flag set to `true` iff the team has 4 or fewer historical initiatives. The `orgLambda` and `orgEpicSizingDist` arguments are carried verbatim into every entry so the radio toggle can switch between team-scoped and org-wide without re-asking the engine.

### Invariants
- Every returned entry's `teamName` is a non-empty string and is the first-seen casing of that team.
- The returned array is sorted by `teamName.toLowerCase()` via `localeCompare`.
- No two entries have `teamName.toLowerCase()` equal (case-insensitive dedup).
- `teamLambda >= 0`.
- `teamEpicSizingDist` contains only **Recognised t-shirt size** entries.
- `kMust + (kMustShould - kMust) + (kMustShouldCould - kMustShould)` equals the team's count of in-scope target initiatives in `{Must, Should, Could}` (cumulative invariants).
- `useOrgByDefault === (histInitCount <= 4)`.
- `orgLambda` and `orgEpicSizingDist` are passed through unchanged.

### Counterexamples (must NOT pass)
- A team-list build that does *not* dedupe case-insensitively — would render two sections for `Platform` and `platform` whose Runs and stats are nominally identical but visually doubled.
- A team-list build that uses `Set<string>` directly — would lose the first-seen casing (insertion order in `Set` is fine but the *value* stored is whichever casing was last set if you call `set` twice).
- A `teamLambda` computation that includes initiatives from non-selected historical quarters — would inflate the team's pace by importing data the user did not opt into.
- A `kMust` computation that reads org-wide totals — would forecast each team's plan against another team's commitments.
- A `useOrgByDefault` rule that uses `histInitCount < 4` instead of `<= 4` — the threshold is documented in [ADR-0019](../adr/0019-per-team-independent-simulations.md) as 4, inclusive.
- A `teamEpicSizingDist` that includes unrecognised sizes — would inject `NaN`-valued samples into `sampleLognormal`, crashing the engine.

### Forbidden shortcuts
- Do not recompute `orgLambda` or `orgEpicSizingDist` inside this function. They are passed in for a reason ([ADR-0019](../adr/0019-per-team-independent-simulations.md)).
- Do not skip the `quartersWithEpicData` walk. It is what makes the team-scoped fit honest about which quarters actually have epic data.
- Do not derive `useOrgByDefault` from `teamEpicSizingDist.length` or `teamLambda > 0`. The threshold is on **Initiative** count, not epic count.

### RED gate

On an un-implemented build:
- Manual step 1: `prepareTeamSimulationData` is undefined or returns `[]` despite a CSV with multiple teams.
- Manual step 2: case-insensitive dedup fails — two sections appear for `Platform` and `platform`.
- Manual step 5: `teamLambda` does not match the hand-computed mean.

### Test immutability rule

N/A.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-12 all pass.
- [ ] The function is pure (no DOM mutation, no chart creation).
- [ ] The alphabetical case-insensitive sort and first-seen casing rule are observable.
- [ ] `useOrgByDefault` flips at the documented threshold.

---

## Phase 3: `renderTeamCharts` + `renderTeamSection` + the historical-data radio toggle

### Acceptance behavior

Scenario AT-1: One section per team, in the order from `prepareTeamSimulationData`
Given `teamData` is `[{teamName: 'Lending', ...}, {teamName: 'Platform', ...}, {teamName: 'Risk', ...}]`
When `renderTeamCharts(teamData, 120, 10000)` runs
Then `#teams-container` contains three `.team-section` children in that order
And each has `data-team-idx` equal to its zero-based index (`0`, `1`, `2`)
And each has the team name in its `.team-section-title`

Scenario AT-2: Section title row includes the three K counts
Given `teamData[0] = { teamName: 'Lending', kMust: 2, kMustShould: 5, kMustShouldCould: 8, ... }`
When the section is rendered
Then the title row contains the substring `Must: 2`
And the substring `Must+Should: 5`
And the substring `All: 8`

Scenario AT-3: Radio defaults follow `useOrgByDefault`
Given `teamData[0].useOrgByDefault === true` (small team)
And `teamData[1].useOrgByDefault === false` (large team)
When the sections are rendered
Then in section 0, the `value="org"` radio is checked and the `value="team"` radio is not
And in section 1, the `value="team"` radio is checked and the `value="org"` radio is not

Scenario AT-4: Recommendation chip appears only on small teams
Given `teamData[0].histInitCount === 3` (small)
And `teamData[1].histInitCount === 12` (large)
When the sections are rendered
Then section 0 contains a `.team-hist-rec` element with text including `Recommended` and `3 historical initiative`
And section 1 contains no `.team-hist-rec` element

Scenario AT-5: Singular vs plural in the histInitCount counts
Given `teamData[0].histInitCount === 1`
When the section is rendered
Then the `This team only` radio's label reads `(1 initiative)` (singular)
And the recommendation chip reads `... only 1 historical initiative found ...` (singular)
(For counts >= 2 or 0, the plural `initiatives` is used.)

Scenario AT-6: Each section gets a chart, a stats table, and three marker buttons
Given a team section is rendered
When the user inspects its DOM
Then it contains exactly one `<canvas id="team-chart-${idx}">`
And one `<tbody id="team-stats-tbody-${idx}">`
And three buttons in the chart-card corner: `↓ Save`, `↑ Load`, `＋ Add marker`
Each button's `onclick` references the per-context key `team-${idx}`

Scenario AT-7: Initial paint runs `runSimulation` for each section with the default radio's parameters
Given section 0 defaults to `useOrg = true`
And section 1 defaults to `useOrg = false`
When `renderTeamCharts` finishes its loop
Then `runSimulation` was called once per section
With section 0's call using `lambda = teamData[0].orgLambda`, `epicSizingDist = teamData[0].orgEpicSizingDist`
And section 1's call using `lambda = teamData[1].teamLambda`, `epicSizingDist = teamData[1].teamEpicSizingDist`
And both used `capacity = lastCapacity` and `iterations = lastIterations`

Scenario AT-8: Capacity marker is auto-managed per team context
Given a team section is rendered
When `renderTeamSection(idx, useOrg)` runs
Then `ensureCapacityMarker(\`team-${idx}\`, lastCapacity)` is called exactly once
And the chart on that section renders a capacity line at `lastCapacity` PM

Scenario AT-9: Toggling the radio re-renders only the affected section
Given section 0 is rendered with `useOrg = true` and a custom marker on its chart
And section 1 is rendered with `useOrg = false` and a custom marker on its chart
When the user clicks the `This team only` radio in section 0
Then `renderTeamSection(0, false)` runs
And section 0's chart is destroyed and rebuilt with `lambda = teamData[0].teamLambda`
And section 0's stats table is re-rendered
And section 0's custom marker for `team-0` is preserved (marker store is keyed by context, not by chart instance)
And section 1's chart, stats, and marker are untouched

Scenario AT-10: Toggle reads cached Run values, not live sidebar
Given the user has just pressed Run with `capacity = 120` and the chart is showing capacity-line at 120 PM
And the user then edits `#capacity` to `200` *without* pressing Run
When the user toggles a team's radio
Then `renderTeamSection` uses `lastCapacity = 120` (the cached value)
And the chart's capacity line stays at 120 PM
And the stats table's `P(effort > capacity)` row still reads against 120 PM
(The live sidebar value will only take effect on the *next* Run, per [ADR-0014](../adr/0014-capacity-and-iterations-as-run-inputs.md).)

Scenario AT-11: Re-Run rebuilds the team list from scratch
Given a previous Run rendered sections for `Lending`, `Platform`, `Risk`
And the user changes the target quarter selection so the team list becomes `Lending`, `Risk`, `Trust`
When the user presses Run again
Then `#teams-container.innerHTML` is emptied
And three new sections appear for `Lending`, `Risk`, `Trust` (the new list, alphabetical)
And the previous `Platform` section is gone
And each section's radio is reset to its `useOrgByDefault` value (no carry-over from the previous Run)

Scenario AT-12: Chart instances are destroyed before re-creation
Given `teamChartInstances` holds a Chart.js instance at index 0 from a previous Run
When `renderTeamCharts` is called again
Then `teamChartInstances[0].destroy()` is invoked before the new chart is built
And `teamChartInstances` is reset to a fresh array of `null`s sized to the new team list
(This prevents Chart.js memory leaks across Runs.)

Scenario AT-13: Radio scoping is per-section
Given sections 0 and 1 both have radios named `hist-src-0` and `hist-src-1` respectively
When the user clicks the `team` radio in section 0
Then only section 0's `team` radio becomes checked
And section 1's radios are unaffected
(The `name` attribute scopes the pair to the section; without unique names, clicking a radio in section 0 would uncheck section 1's radio.)

### Public entry point

In-code:
- `renderTeamCharts(teamDataArray: TeamData[], capacity: number, iterations: number): void` (`index.html:2445`).
- `renderTeamSection(idx: number, useOrg: boolean): void` (`index.html:2422`).
- The delegated `change` listener attached inside `renderTeamCharts` at `index.html:2517-2524`.

UI: each section's two radios under the `Historical data` label.

### Expected observable outcomes
- `#teams-container` contains one `.team-section` per entry in `lastTeamData`, in the same order, with consistent `data-team-idx` values.
- Each section's chart and stats table reflect the currently-selected radio's parameters.
- Toggling a radio re-renders only that section.
- The marker buttons in each section's chart card carry the per-team-context key.
- `lastTeamData`, `lastCapacity`, `lastIterations` are written once per Run by `renderTeamCharts`.

### Test harness

Acceptance tests:
- Location: **N/A — manual.** Same rationale as Phase 1.
- Manual steps:
  1. After a Run with multiple teams, open the `Team Level` tab. Confirm AT-1 (section order and `data-team-idx`).
  2. Inspect a section's title row and confirm the three K-count substrings (AT-2).
  3. Confirm radio defaults across at least one small and one large team (AT-3) and the recommendation chip presence/absence (AT-4).
  4. Pick a team with `histInitCount === 1` and confirm singular wording (AT-5). Confirm plural for counts of 2+.
  5. Inspect a section's DOM: canvas, stats tbody, three marker buttons (AT-6).
  6. In DevTools, monkey-patch `runSimulation` to log its arguments; confirm one call per section with the expected parameters (AT-7).
  7. Confirm the capacity line is drawn at the cached `lastCapacity` (AT-8).
  8. Add a custom marker to one section; toggle that section's radio; confirm the chart updates and the marker is preserved (AT-9).
  9. Edit `#capacity` to a new value *without* pressing Run; toggle a section's radio; confirm the chart's capacity line stays at the previous value (AT-10).
 10. Change the target quarter selection and press Run; confirm the section list changes accordingly (AT-11).
 11. In DevTools, count `Chart.prototype.destroy` calls across two Runs to confirm previous instances are torn down (AT-12).
 12. Click radios in two different sections; confirm scoping per section (AT-13).

Inner tests: N/A.

Verification: manual.

Fake-injection wiring: N/A. To exercise `renderTeamSection` without going through `renderTeamCharts`, set `lastTeamData[idx]` manually in DevTools and call `renderTeamSection(idx, useOrg)`.

### Proposed implementation seams

Stable seams a future test suite may target:
- `renderTeamCharts(teamDataArray, capacity, iterations)` — full-rebuild contract; persists `lastTeamData` / `lastCapacity` / `lastIterations`; empties and re-fills `#teams-container`.
- `renderTeamSection(idx, useOrg)` — targeted re-render of one section; reads cached values only.
- The radio-name scoping convention `hist-src-${idx}`.
- The per-team-context marker key `team-${idx}`.
- The delegated change listener on `#teams-container`.

Do NOT lock in:
- The exact section title HTML template — the K-count substrings are the contract; the wrapping markup is mutable.
- The recommendation chip's exact wording (currently `⚠️ Recommended: only N historical initiative(s) found for this team`).
- The radio labels' exact text (`This team only`, `All teams — org-wide`).
- The 420 px chart-card height.

### Behavioral rule

`renderTeamCharts` is the *Run-time* surface: called once per **Run**, it caches the per-Run parameters, destroys any previous Chart.js instances, empties `#teams-container`, and appends one `.team-section` per team. For each section it calls `renderTeamSection(idx, useOrg)` with the team's `useOrgByDefault` value. A single delegated `change` listener on `#teams-container` calls `renderTeamSection` again on every radio toggle, re-running the team's Monte Carlo with the alternative historical parameters and re-painting only that section's chart and stats table. The other sections, the org tab, and all per-context markers are untouched.

### Invariants
- `#teams-container.children.length === lastTeamData.length` after every successful `renderTeamCharts` call.
- Each `.team-section.dataset.teamIdx` equals its zero-based index in DOM order and equals its index in `lastTeamData`.
- `teamChartInstances.length === lastTeamData.length`; each non-null entry is a live Chart.js instance.
- Previous Chart.js instances are destroyed before re-creation (no per-tab memory leak).
- `lastCapacity` and `lastIterations` are the values *as used* by the most-recent Run; the live sidebar values may differ.
- The radio name `hist-src-${idx}` scopes each radio pair to its section; no two sections share a name.
- `ensureCapacityMarker(\`team-${idx}\`, lastCapacity)` is invoked exactly once per `renderTeamSection` call.
- Only one delegated change listener is attached to `#teams-container` per Run (the container is fully replaced on every `renderTeamCharts`, so the listener is fresh each time).

### Counterexamples (must NOT pass)
- A `renderTeamSection` that reads `parseFloat(document.getElementById('capacity').value)` — would let a sidebar edit silently take effect on a radio toggle (see Scenario AT-10 and [ADR-0014](../adr/0014-capacity-and-iterations-as-run-inputs.md)).
- A `renderTeamCharts` that does *not* destroy previous Chart.js instances — leaks Chart.js memory and event listeners on every Run.
- A radio markup that shares the `name` across sections (e.g. `hist-src` instead of `hist-src-${idx}`) — clicking section 1's `team` radio would uncheck section 0's `team` radio. Section AT-13 explicitly tests this.
- A toggle handler that re-renders *all* team sections — destroys other teams' custom markers, slow on large team lists.
- A toggle handler that recomputes `prepareTeamSimulationData` — wastes work and risks divergence from `lastTeamData`.
- A `renderTeamCharts` that attaches the change listener inside the per-section template (e.g. `addEventListener` per radio) — leaks listeners across Runs and bloats the section count.

### Forbidden shortcuts
- Do not lift the marker buttons (`↓ Save`, `↑ Load`, `＋ Add marker`) out of the per-section template into a shared toolbar. Each team's markers are per-context; sharing the toolbar would mean sharing the markers.
- Do not pre-render hidden sections for teams that *might* appear in a future Run. The team list is bounded by the current Run's target-quarter selection.
- Do not animate the radio-toggle re-render. The instant repaint is the documented affordance ([ADR-0019](../adr/0019-per-team-independent-simulations.md)).
- Do not introduce a "re-run only this team" button. Every team is part of the same atomic Run; live re-runs across the team list are out of scope.
- Do not preserve the user's radio choice across Runs. The `useOrgByDefault` evaluation is a per-Run heuristic; preserving the previous radio would silently apply a heuristic to a different `histInitCount`.

### RED gate

On an un-implemented build:
- Manual step 1: `#teams-container` is empty after a Run, or contains a single placeholder section.
- Manual step 3: every section starts on the same radio regardless of `useOrgByDefault`.
- Manual step 8: toggling a radio destroys other sections' markers (because the toggle re-renders all of them).
- Manual step 10: the chart's capacity line moves to the live sidebar value on radio toggle (because the toggle reads the live input).

### Test immutability rule

N/A.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-13 all pass.
- [ ] `renderTeamSection` is the *only* writer of a section's chart and stats; `renderTeamCharts` is the *only* writer of `#teams-container`'s outer structure.
- [ ] Toggling a radio re-runs only that team's Monte Carlo and re-paints only that section.
- [ ] `lastCapacity` and `lastIterations` are read on every toggle; the live sidebar inputs are not.
- [ ] Each section's marker context key is `team-${idx}`.
- [ ] `git diff` touches only `index.html` ([ADR-0001](../adr/0001-single-file-html-app.md)).
