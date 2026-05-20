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

### Planning vocabulary

**Quarter**:
A label like `Q3 2026`. The unit of time the simulator works in. Initiatives and Epics each carry a quarter.
_Avoid_: sprint, period, cycle.

**Historical quarter**:
The quarter (or set of quarters) used to fit the model: Poisson λ over initiative count and the bootstrap pool of t-shirt sizes. Selected in the sidebar.
_Avoid_: source, baseline, reference quarter.

**Target quarter**:
The quarter (or set of quarters) being forecast. Initiatives in the target quarter are bucketed by MoSCoW and counted as `K` for each scenario.
_Avoid_: forecast quarter, projected quarter, future quarter.

**MoSCoW**:
The priority label on an Initiative — one of `Must`, `Should`, `Could`, `Won't`, or unknown. `Won't` and unknown initiatives are excluded from every scenario.
_Avoid_: priority, tier, importance.

**Scenario**:
One of the three forecasts the simulator runs side-by-side, defined by which MoSCoW buckets are included: **Must Only**, **Must + Should**, **Must + Should + Could**.
_Avoid_: case, projection, model.

**Capacity**:
The PM budget the team commits to deliver in the target quarter. Configured via the sidebar (`#capacity`), default 120 PM. Every scenario's risk is reported as `P(effort > capacity)`.
_Avoid_: budget, headcount, throughput.

**Iteration**:
One draw of the Monte Carlo loop: sample `numEpics ~ Poisson(λ)` for each of the `K` initiatives, sample each epic's effort from `Lognormal(μ, σ)` by t-shirt size, sum to a total. Default iteration count is 10,000.
_Avoid_: trial, sample, run (which means the whole batch).

**Run**:
A single press of `Run Simulation`. Re-seeds the PRNG and executes `iteration` × 3 scenarios.
_Avoid_: simulation, batch.

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
The CSV layout where headers match their semantics: `jira_key`, `building_block`, `moscow`, `teams`, `quarter`. The recommended layout going forward.

**Quirky format**:
The legacy CSV layout exported by an older internal tooling, where `teams` actually held Jira keys and `emoji` actually held MoSCoW priority. Still parseable because detection scans column *values*, not header names.

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
The header-name lookup invoked when a content scan finds no winning column (empty CSV, or no column above the **Detection threshold**). Returns either the **Sensible format** header (`jira_key`, `moscow`, `building_block`, `teams`) or the legacy **Quirky format** header (`teams`, `emoji`).
_Avoid_: default column, header lookup.

**Recognised t-shirt size**:
A normalised size string (output of `normalizeSize`) that exists as a key in the active `T_SHIRT_PARAMS` map (synthetic or empirical). Used as the tie-breaker when two Epic rows share an `_epic_key` during within-file dedup — the row with a recognised size wins.
_Avoid_: valid size, known size.

## Relationships

- An **Initiative** belongs to exactly one **Quarter**, exactly one team, and exactly one **MoSCoW** bucket.
- An **Epic** belongs to exactly one **Initiative** (via **Initiative key**) and carries exactly one **T-shirt size**.
- A **Scenario** is a set of MoSCoW buckets ⊆ {Must, Should, Could}; it determines `K`, the count of **Initiatives** included from the **Target quarter**.
- A **Run** executes `iteration` independent **Iterations** per **Scenario**, producing one distribution of total effort per scenario.
- A **Constant work** entry produces a fixed PM shift applied to every **Iteration** of the matching team/quarter, after sorting.

## Example dialogue

> **Dev:** When the user picks `Q2 2026` as the **Historical quarter** and `Q3 2026` as the **Target quarter**, what are we fitting and what are we forecasting?
> **Modeller:** We fit Poisson λ from the **Initiative** count in Q2, and we build the bootstrap pool of **T-shirt sizes** from the Q2 **Epics**. We forecast Q3 by counting how many **Initiatives** fall in each **MoSCoW** bucket and running three **Scenarios** on those counts.
> **Dev:** What if an **Initiative** in Q3 has no **Epics** yet?
> **Modeller:** That's fine — we don't read Q3 epics for the forecast at all. The number of epics per initiative comes from λ (fit on the historical quarter), and the sizes come from the bootstrap pool. The target-quarter epics only appear in the **Team Projections** view, not in the org-level forecast.

## Flagged ambiguities

- "team" was used to mean both the **owning team of an Initiative** and the **team-scoped simulation context** in the Team Level tab — resolved: the column is the Initiative's owning team; the tab runs a per-team Run filtered by that column.
- "size" was used to mean both **T-shirt size** (label) and **person-months** (number) — resolved: T-shirt size is always the label; PM is always the number.
- "iteration" was used for both a single Monte Carlo draw and a Jira-style sprint — resolved: only the Monte Carlo meaning is used in this project. Use **Run** for "one press of the button."
- "quarter" can refer to a single quarter or the user's multi-quarter selection — resolved: the historical and target selectors are both multi-selects; "quarter" in domain talk usually means the selected set unless explicitly singular.
- "detection" was used for two distinct steps: identifying which header carries a semantic column (a **Column detector** via **Content scan** / **Detection fallback**) versus normalising a raw value once the column is known (`normalizeMoscow`, `normalizeSize`) — resolved: *detection* picks the column, *normalisation* transforms the value.
