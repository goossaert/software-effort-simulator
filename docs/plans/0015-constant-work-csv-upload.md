# Feature: Constant Work CSV upload — optional deterministic shift on every Run

Created at: 2026-04-07T00:00:00Z

## Context

This feature adds an optional third CSV — the **Constant Work CSV** — to the simulator, alongside the required **Initiatives CSV** and **Epics CSV**, describing work that is *guaranteed* to ship in a given (team, quarter) pair. Constant work is *deterministic*: its per-row effort is computed from the row's t-shirt size as the closed-form lognormal mean (`e^(μ + σ²/2)`) via `tshirtToPersonMonths` (`index.html:1272-1276`) and added to every per-**Iteration** total *after* the Monte Carlo sort, so the **Histogram**, **Stats**, and chart **Global histogram range** of every **Scenario** are translated by exactly `fixedEffort` PM with no reshaping of the distribution. The feature owns four narrow surfaces: (a) the sidebar upload control `#constant-work-upload` (`index.html:861-872`) with its companion reset button, (b) the parse cache `parsedConstantWork` plus `loadConstantWorkCSV` / `resetConstantWorkFile` (`index.html:1500`, `1631-1644`), (c) the two consumer helpers `getConstantWorkEffort(quarters, teamName?)` (`index.html:1650-1662`) and `getConstantWorkEpics(quarter, teamName)` (`index.html:1668-1686`), and (d) the rendering fork inside `renderTeamProjections` (`index.html:2626-2634`) that appends soft-green-tinted rows to the bottom of each **Projection section**'s **Initiative matrix**.

The feature is deliberately narrow. It does not introduce a new tab, a new chart, a new sidebar parameter beyond the file upload, a new MoSCoW bucket, or any change to the existing **Initiatives CSV** / **Epics CSV** parse paths. It does not touch the **Quarter selector** widget (`#hist-ms`, `#target-ms`), the **Capacity** input, the **Iteration** count, the marker system, the **Synthetic parameters** ↔ **Empirical parameters** toggle, or the column detector family (`detectInitKeyCol`, `detectMoscowCol`, `detectNameCol`, `detectTeamCol`, `detectEpicLinkCol`, `detectKrCol`). The constant-work CSV is the *user's own template* with a *fixed schema* (hardcoded inline column reads, not detector-driven). Where [feature 0001](./0001-csv-upload-ui.md) owns the two-file upload UI pattern, this feature reuses that pattern verbatim for the third file. Where [feature 0003](./0003-monte-carlo-simulation-engine.md) owns the Monte Carlo engine, this feature *adds one optional parameter* (`fixedEffort = 0`) to `runSimulation` and a post-sort shift that preserves every existing invariant. Where [feature 0012](./0012-team-projections-tab.md) owns the **Team Projections tab** and the **Initiative matrix**, this feature *appends rows* to the matrix and *expands* the quarter axis to include constant-work-only quarters, without changing the structure of any other column.

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). The upload control, parse path, helpers, engine integration, and matrix render fork all live inline in `index.html`.
- [ADR-0002 — Client-side only](../adr/0002-client-side-only.md). The constant-work file is parsed in-browser; nothing is uploaded anywhere.
- [ADR-0003 — CSV as the input format](../adr/0003-csv-input-format.md). The constant-work file is yet another CSV the simulator accepts.
- [ADR-0006 — Monte Carlo with bootstrapped epic sizes](../adr/0006-monte-carlo-with-bootstrapped-sizes.md). The engine this feature shifts produces the stochastic distribution; the shift never reshapes it.
- [ADR-0007 — Lognormal effort distribution per t-shirt size](../adr/0007-lognormal-effort-distribution.md). `tshirtToPersonMonths` evaluates the lognormal *mean* — the closed-form `e^(μ + σ²/2)` — as the deterministic point estimate.
- [ADR-0011 — Overlapping histograms with shared bins](../adr/0011-overlapping-histograms-shared-bins.md). The shared-bin **Global histogram range**'s lower bound moves to `fixedEffort` so the 60 bins concentrate on the actual support of the shifted distribution.
- [ADR-0019 — Per-team independent simulations](../adr/0019-per-team-independent-simulations.md). The team-level Run's `fixedEffort` is the per-team constant-work sum; the org-level Run's `fixedEffort` is the sum across *all* teams.
- [ADR-0020 — Cross-quarter Team Projections tab](../adr/0020-team-projections-cross-quarter-view.md). The **Quick projection Monte Carlo** folds `cwEffort` in deterministically; the band defaults to `{p25: cwEffort, p50: cwEffort, p75: cwEffort}` when the MC is skipped.
- [ADR-0022 — Optional Key Result column](../adr/0022-optional-key-result-column.md). The constant-work row's `kr` field is read via the parallel `r.key_result || r.KR || r.kr` lookup and participates in the `hasKr` gate.
- [ADR-0023 — Constant work as an optional third CSV with deterministic effort and post-sort distribution shift](../adr/0023-constant-work-csv-deterministic-shift.md). The architectural decision for *why* this feature exists in the shape it does (separate CSV, hardcoded schema, deterministic mean, post-sort shift, soft-green matrix tinting).

Glossary terms used below: **Constant work**, **Constant Work CSV**, **Initiative**, **Initiative matrix**, **Projection section**, **Team Projections tab**, **Team Level tab**, **Team**, **Quarter**, **Target quarter**, **T-shirt size**, **Person-month**, **Iteration**, **Run**, **Scenario**, **Stats**, **Histogram**, **Bin**, **Global histogram range**, **Quick projection Monte Carlo**, **Effort projection band**, **Capacity**, **Synthetic parameters**, **Empirical parameters** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user with a normal load (Initiatives + Epics CSV, no Constant Work CSV) sees the simulator behave exactly as it did before this feature: three **Scenario** histograms with the leftmost **Bin** at `globalMin = 0`, a **Stats** table whose P50 reads in the tens of PM range, and a **Team Projections tab** whose **Initiative matrix** rows are all stochastic (no green-tinted rows). The Constant Work CSV input control is visible in the sidebar but reads `Click to upload…` and the `(optional)` annotation; no error is raised by the simulator if it is never used.

A user who uploads a Constant Work CSV — schema `jira_key, epic_name | building_block, key_result | KR | kr, moscow, team, quarter, tshirt_size | t_shirt_size` — sees the `📄 Click to upload…` flip to `✅ <filename>` and a `✕ Remove file` row appears below the control. No **Run** is required for the parse to land; the rows are cached in `parsedConstantWork` immediately. The user then presses **Run Simulation** and reads the org-level histogram: every **Scenario**'s P50 is now shifted up by exactly the sum-across-all-teams `getConstantWorkEffort(targetQs)` PM. The chart's x-axis lower bound is at that shift value (not at `0`); the leftmost **Bin** sits at `globalMin = fixedEffort`. The stats table reports P10/P25/P50/P75/P90 each `fixedEffort` PM higher than the same Run would have produced without the CSV.

The user clicks `Team Level`. Each team's section runs an *independent* Monte Carlo (per-team **Poisson λ** and **Bootstrap pool** governed by the team's **Historical data toggle**); the team's `fixedEffort` is the constant-work sum *for that team only* via `getConstantWorkEffort(targetQuarters, teamName)`. A team with no constant work for the target quarters reads exactly as before; a team with constant work reads its own per-team distribution shifted up by its own per-team `fixedEffort`.

The user clicks `Team Projections`. Each **Projection section**'s **Initiative matrix** now has, appended *after* the sorted Initiative rows, one soft-green-tinted row per constant-work epic in `{team, quarter}` matched cells, of the form: `<jira_key> | (optional KR) | <epic_name> [M · ~2.12 PM] | (per-quarter MoSCoW badge in the matching column)`. The `[M · ~2.12 PM]` annotation in the name cell carries the t-shirt size and the deterministic PM value the simulator computed via `tshirtToPersonMonths`. Each section's `<tfoot>` `Effort P50 (P25–P75)` row still reports the **Effort projection band** values for each quarter — folded in deterministically by the **Quick projection Monte Carlo** with `fixedEffort = cwEffort`. A team that has *only* constant work in a future quarter (no Initiatives) sees that quarter appear in its section as a column with only constant-work rows visible; the band reads `~<cwEffort> PM` with `<cwEffort>–<cwEffort>` below (flat band — the MSC MC is skipped because `kMustShouldCould === 0`).

The user toggles **Synthetic parameters** ↔ **Empirical parameters** and re-presses Run. Every constant-work row's deterministic PM is recomputed against the new `activeParams` map — no per-row edit is required. A row whose t-shirt size has empirical calibration data (e.g. `M` → +0.21 μ shift) reads a higher PM annotation under empirical; a row with a size that has no Q1 data (`2XS`, `XL`, `XL+`) reads the same PM in both modes.

The user clicks `✕ Remove file`. `parsedConstantWork` resets to `null`, the file input is cleared, the control flips back to `📄 Click to upload…`, and the `✕ Remove file` row hides. The *currently rendered* Run still shows the previous fixedEffort shift until the next Run; on the next Run, every surface (org, team, projections) reverts to the no-constant-work state.

There is no error if the CSV has rows that match no `{team, quarter}` cell in the loaded Initiatives/Epics — those rows are simply ignored by the consumer helpers. There is no warning if a row's `tshirt_size` is unrecognised — `tshirtToPersonMonths` returns `0` for unknown sizes, so the row contributes nothing to `fixedEffort` and renders with `~0.00 PM` in its matrix annotation.

## Scope

### In scope
- The sidebar Constant Work upload block (`index.html:861-872`): the `<div class="file-upload-wrapper" id="constant-work-upload">` carrying `<span class="file-icon">📄</span>`, `<span class="file-name" id="constant-work-file-name">Click to upload…</span>`, and `<input type="file" id="constant-work-file" accept=".csv">`, plus the companion `<div class="file-reset-row" id="cw-reset-row">` carrying the `<button class="file-reset-btn" id="cw-reset-btn">✕ Remove file</button>`. The `(optional)` annotation in the label is part of this feature.
- The module-scoped cache `let parsedConstantWork = null;` (`index.html:1500`) and its initialisation contract: `null` (no CSV ever loaded) vs `[]` (CSV loaded but empty — *not* a sentinel, just a parsed-empty array) vs a non-empty array of row objects.
- `loadConstantWorkCSV(text)` (`index.html:1641-1644`): a thin wrapper over `parseCSV(text)` that writes `parsedConstantWork` and logs `[ConstantWork] <n> rows`. No detection, no validation.
- `resetConstantWorkFile()` (`index.html:1631-1639`): clears the cache, the file input, the displayed filename, the icon, and the reset-row visibility — symmetric to the existing `resetEpicsFile` / `resetInitiativesFile`.
- `getConstantWorkEffort(quarters, teamName = null)` (`index.html:1650-1662`): returns the sum of `tshirtToPersonMonths(r.tshirt_size || r.t_shirt_size || '')` over the rows whose `r.quarter` is in `quarters` and (when `teamName !== null`) whose `r.team` matches `teamName` case-insensitively. Returns `0` on null/empty cache.
- `getConstantWorkEpics(quarter, teamName)` (`index.html:1668-1686`): returns the display-formatted rows for one (quarter, team) cell — each carrying `key`, `name`, `kr`, `moscow`, `effort`, `tshirt`, and `isConstant: true`. Returns `[]` on null/empty cache.
- `tshirtToPersonMonths(size)` (`index.html:1272-1276`): the closed-form lognormal *mean* `e^(μ + σ²/2)` evaluated against the *active* parameter set (`activeParams`, not `T_SHIRT_PARAMS` directly), so it follows the **Synthetic parameters** ↔ **Empirical parameters** toggle.
- The new optional parameter `fixedEffort = 0` on `runSimulation` (`index.html:2086`), the `shift` helper inside it (`index.html:2105-2110`), the three `shifted*` arrays passed to `computeStats` / `buildHistogram` (`index.html:2111-2113`, `2122-2137`), the `globalMin = fixedEffort` (`index.html:2117`), and `globalMax = Math.max(p995(...), fixedEffort + 1)` (`index.html:2118`). The `fixedEffort` value is also surfaced on the return object (`index.html:2139`) for downstream surfaces that need it.
- The three call sites that pass `fixedEffort` into `runSimulation`:
  - Org-level Run: `orgFixedEffort = getConstantWorkEffort(targetQs)` then `runSimulation({ ..., fixedEffort: orgFixedEffort })` (`index.html:3343-3344`).
  - Team-level Run: `td.fixedEffort = getConstantWorkEffort(targetQuarters, teamName)` populated in `prepareTeamSimulationData` (`index.html:1900-1901`) then threaded into `renderTeamSection` (`index.html:2431`).
  - Quick projection MC: `cwEffort = cwEpics.reduce((s, e) => s + e.effort, 0)` then `runSimulation({ ..., fixedEffort: cwEffort })` (`index.html:1981`, `1991`).
- The `cwQuarters` union expansion in `buildTeamProjections` (`index.html:1940-1947`): per-team quarter axis becomes `[...new Set([...allQuarters, ...cwQuarters])]` so constant-work-only quarters appear in the section even when the team has no Initiatives in those quarters.
- The skip-and-default block in `buildTeamProjections` (`index.html:1985-1996`): `p25 = cwEffort, p50 = cwEffort, p75 = cwEffort` *before* the optional MC override, so when the MC is skipped (no MSC initiatives, `orgLambda === 0`, or empty bootstrap pool) the band sits flat at `cwEffort`.
- The constant-work row append inside `buildTeamProjections` (`index.html:1973-1974`): `for (const cw of cwEpics) initiatives.push(cw);` *after* the existing Must → Should → Could → Won't → Unknown then alphabetical sort. The constant-work rows therefore appear at the bottom of the section's matrix, in the order returned by `getConstantWorkEpics` (which is the order they appear in the parsed CSV).
- The constant-work row render fork inside `renderTeamProjections` (`index.html:2626-2634`): the `i.isConstant` ternary that produces (a) the soft-green `style="background:#f0fdf4"` row tint, and (b) the `[<tshirt> · ~<effort> PM]` annotation in the name cell, in the green-on-green colour `#16a34a` at `font-size:10px;font-weight:600`.
- The MoSCoW badge CSS class `.mb-constant` (`index.html:651`): `background:#f0fdf4; color:#16a34a; font-size:13px; padding:1px 3px` — used by the constant-work badge in the matrix.
- The event handlers (`index.html:2924-2942`): the `change` listener on `#constant-work-file` (read + parse + flip icon + show reset row) and the `click` listener on `#cw-reset-btn` (call `resetConstantWorkFile`, stop propagation).

### Out of scope
- The Initiatives CSV parse path. [Feature 0001](./0001-csv-upload-ui.md), [feature 0002](./0002-content-based-column-detection.md), [feature 0013](./0013-sensible-csv-format-support.md). The Constant Work CSV does *not* go through the column detector family.
- The Epics CSV parse path. [Feature 0001](./0001-csv-upload-ui.md). Constant work is not an Epic in the simulator's data model.
- The column detector family. [Feature 0002](./0002-content-based-column-detection.md), [feature 0013](./0013-sensible-csv-format-support.md), [feature 0014](./0014-key-result-column.md). The constant-work CSV's column names are hardcoded inline; there is no `detectXxxCol` for any of its columns.
- The Monte Carlo engine itself. [Feature 0003](./0003-monte-carlo-simulation-engine.md). This feature *adds an optional parameter* and a *post-sort shift*; it does not change `runScenario`, `sampleLognormal`, `samplePoisson`, `bootstrapChoice`, the PRNG, or any sampling rule.
- The MoSCoW three-Scenario forecast structure. [Feature 0004](./0004-moscow-three-scenario-forecasting.md). Constant work *adds* to every Scenario uniformly; it does not become a fourth scenario.
- The org-level Histogram chart. [Feature 0006](./0006-org-histogram-chart.md). The chart renders the *shifted* arrays via the existing pipeline; this feature only moves `globalMin` and adjusts `globalMax`.
- The org-level Stats table. [Feature 0007](./0007-org-level-summary-statistics-table.md). The stats table reads `computeStats(shifted*, capacity)`; the percentile and `P(effort > capacity)` math is unchanged.
- The Capacity / Iterations inputs and Capacity marker. [Feature 0008](./0008-configurable-capacity-and-iterations.md). Constant work is a *deterministic load*, not a capacity input.
- The Data preview block (`#data-preview`). [Feature 0009](./0009-sidebar-preview-and-reference-panels.md). The preview reflects the *fitted* model inputs (**Poisson λ**, **Bootstrap pool**, per-Scenario `K`); it does not surface `fixedEffort` because the value is computed at Run time from the *target* quarters, which the preview does not commit to.
- The Quarter selector widget. [Feature 0010](./0010-multi-quarter-selector.md). Constant-work-only quarters expand the **Team Projections tab** axis but do not appear as options in `#hist-ms` or `#target-ms`.
- The Team Level tab structure itself. [Feature 0011](./0011-team-level-tab.md). This feature *passes `fixedEffort` through* `prepareTeamSimulationData` / `renderTeamSection`; it does not change the radio toggle, the per-section chart canvas, or the per-section stats table layout.
- The Team Projections tab structure itself. [Feature 0012](./0012-team-projections-tab.md). This feature *expands the quarter axis* and *appends rows* to the matrix; the two side-by-side charts (`Initiatives by Quarter`, `Effort Projection by Quarter`), the summary table at the top of the tab, and the **Effort projection band** footer row are unchanged.
- The conditional KR column gate. [Feature 0014](./0014-key-result-column.md). The constant-work row's `kr` is read via the parallel `r.key_result || r.KR || r.kr` lookup ([ADR-0022](../adr/0022-optional-key-result-column.md)); constant-work rows participate in `hasKr` via the same `.some(i => i.kr)` rule.
- Validation of the Constant Work CSV. The parser accepts any rows; rows that match no `{team, quarter}` cell are silently ignored; rows with unrecognised `tshirt_size` contribute `0` PM via `tshirtToPersonMonths`'s `if (!p) return 0`.
- Editing constant-work rows on the Initiatives tab. The Initiatives tab ([feature 0019](../../backtracked-features.md#0019)) edits `editedInitiatives` only; constant-work rows are *not* surfaced on that tab.
- Saving / exporting the Constant Work CSV. The user owns the file on disk; the simulator never writes it back.
- A separate "constant work" tab or panel. The constant-work rows live inside the existing **Initiative matrix** (per [ADR-0023](../adr/0023-constant-work-csv-deterministic-shift.md)).
- A vertical chart marker at `fixedEffort` ("0 PM is here, constant work eats X PM"). Listed as a future revision in [ADR-0023](../adr/0023-constant-work-csv-deterministic-shift.md).

## Relevant existing files
Claude may inspect:
- `index.html`, specifically:
  - Sidebar upload block: `index.html:861-872`.
  - `.mb-constant` swatch: `index.html:651`.
  - `parsedConstantWork` cache: `index.html:1500`.
  - `tshirtToPersonMonths`: `index.html:1266-1276`.
  - `activeParams`: `index.html:1263-1264`.
  - `resetConstantWorkFile` / `loadConstantWorkCSV` / `getConstantWorkEffort` / `getConstantWorkEpics`: `index.html:1631-1686`.
  - `prepareTeamSimulationData`'s `td.fixedEffort`: `index.html:1900-1901`.
  - `buildTeamProjections`'s `cwQuarters` / `cwEpics` / `cwEffort` / band default / row append: `index.html:1940-2003`.
  - `runSimulation`'s `fixedEffort` parameter, `shift`, `globalMin`, `globalMax`: `index.html:2086-2141`.
  - `renderTeamSection`'s `td.fixedEffort` thread: `index.html:2431`.
  - `renderTeamProjections`'s constant-work row fork: `index.html:2626-2634`.
  - Run-button handler's `orgFixedEffort`: `index.html:3343-3344`.
  - File-input change/reset handlers: `index.html:2924-2942`.
- `CONTEXT.md` glossary — especially the **Constant work**, **Constant Work CSV**, **T-shirt size**, **Person-month**, **Initiative matrix**, **Projection section**, **Effort projection band**, **Global histogram range**, **Iteration**, **Run**, **Stats**, **Histogram**, **Bin**, **Synthetic parameters**, **Empirical parameters** entries.
- [ADR-0023](../adr/0023-constant-work-csv-deterministic-shift.md) — the architectural decision this feature implements.
- ADRs 0006, 0007, 0011, 0019, 0020, 0022 for the surrounding constraints.
- `docs/plans/0011-team-level-tab.md` and `docs/plans/0012-team-projections-tab.md` for the sibling tabs' acceptance scenarios.

Claude should not inspect unless needed:
- The Monte Carlo samplers, the PRNG, the lognormal/Poisson math — `fixedEffort` is added *after* sampling and does not interact with any inner-loop code.
- The marker system, the **Capacity** plumbing, the **Quarter selector** widget — orthogonal.
- The Initiatives tab's editable-cell wiring — constant-work rows are not edited there.
- `prepareSimulationData`'s historical-quarter logic — the Constant Work CSV does not contribute to **Poisson λ** or the **Bootstrap pool**.

## Existing patterns to follow
- **Layering inside `index.html`**: the upload block lives in the sidebar HTML alongside the Initiatives and Epics blocks; the parse cache and helpers live in Module 3 (CSV parsing); `tshirtToPersonMonths` lives in Module 3 next to `T_SHIRT_PARAMS`; the `fixedEffort` parameter lives on `runSimulation` in Module 5; the matrix render fork lives in `renderTeamProjections` in Module 6. There is *no* new module, *no* helper file, *no* refactor of the existing CSV parsers.
- **Upload-control symmetry**: the constant-work upload uses the same `.file-upload-wrapper` / `.file-reset-row` / `.file-icon` / `.file-name` / `.file-reset-btn` markup and behaviours as the Initiatives and Epics blocks. The `(optional)` annotation in the label is the only structural difference, and it sits in a `<span style="font-size:10px;color:#9ca3af;font-weight:400">` inside the `<label>`.
- **Cache initialisation discipline**: `let parsedConstantWork = null;` — never `let parsedConstantWork = [];`. The `null` state is "no CSV ever loaded"; `[]` is "loaded but parsed to zero rows". Both consumer helpers guard `if (!parsedConstantWork || !parsedConstantWork.length) return …;` so the two states are observationally equivalent at the consumer surface, but the `null` initialiser preserves the "loaded yet?" semantics for any future surface that needs it.
- **No column detection on the constant-work CSV**: column names are read inline (`r.tshirt_size || r.t_shirt_size`, `r.jira_key || r.epic_key`, `r.epic_name || r.building_block`, `r.key_result || r.KR || r.kr`) — the *user's own template* convention. Do *not* invoke `detectXxxCol` against `parsedConstantWork` — see [ADR-0023](../adr/0023-constant-work-csv-deterministic-shift.md).
- **Deterministic effort via the active parameter set**: `tshirtToPersonMonths` reads `activeParams[normalizeSize(size)]`, not `T_SHIRT_PARAMS[…]` directly. Switching the empirical toggle ([feature 0018](../../backtracked-features.md#0018)) automatically re-evaluates every constant-work row on the next Run.
- **Unknown size returns 0, not throws**: `if (!p) return 0;` inside `tshirtToPersonMonths`. The simulator never errors on an unrecognised constant-work row.
- **Post-sort shift preserves invariants**: the `shift` helper inside `runSimulation` (`index.html:2105-2110`) writes a *new* `Float64Array` (does not mutate the input) and adds `fixedEffort` to each element. The result is still sorted because adding a constant to a sorted array preserves order. Every downstream consumer — `computeStats`, `buildHistogram`, `percentileBinarySearch` — works on the shifted array unchanged.
- **`fixedEffort = 0` short-circuit**: when `fixedEffort` is falsy, `shift` returns the original array (no allocation, no copy). The Constant-Work-not-loaded path stays zero-cost.
- **Three independent `fixedEffort` scopes**: org-level (sum across all teams in target quarters), team-level (sum for one team in target quarters), Quick projection MC (sum for one team in one quarter). Each call site computes its own scope; there is no global "the fixedEffort" variable.
- **Per-team quarter-axis expansion**: `activeQuartersForTeam = [...new Set([...allQuarters, ...cwQuarters])]` (`index.html:1947`) — `Set`-deduplication preserves first-seen order, which means constant-work-only quarters appear *after* the Initiatives-driven quarters. This is intentional and preserves the chronological-sort guarantee that `extractQuarters` produces for `allQuarters`.
- **Constant-work rows are appended *after* the sorted Initiatives**: `for (const cw of cwEpics) initiatives.push(cw);` (`index.html:1973-1974`). Their order inside the appended block is the parsed-CSV order returned by `getConstantWorkEpics`. The render uses position alone (plus the green tint) to convey "below this line is deterministic".
- **`isConstant` is the only render-time flag**: the matrix row fork reads `i.isConstant` (`index.html:2627`, `2630`). No other flag, no other code path. Setting `isConstant: true` on a non-constant-work row would tint and annotate it — do not.
- **The `[size · ~PM]` annotation is matrix-only**: the green-on-green `<span style="font-size:10px;color:#16a34a;font-weight:600;white-space:nowrap">[${i.tshirt} · ~${i.effort.toFixed(2)} PM]</span>` lives inside the name cell of the matrix row. It does not appear in any chart tooltip, in the org-level histogram, in the Team Level tab, or in the Data preview.
- **Skip-and-default-to-cwEffort band**: `let p25 = cwEffort, p50 = cwEffort, p75 = cwEffort;` *before* the optional MC override (`index.html:1985`). A team-quarter cell with *only* constant work reads a flat band at `cwEffort` on the effort projection chart.
- **No framework**: vanilla DOM, template literals, single `innerHTML` write per section.
- **Verification command**: there is no automated test harness in this project. Verification is manual: open `index.html`, upload Initiatives + Epics + Constant Work CSVs, press Run, inspect the org chart, the Team Level tab, and the Team Projections tab.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer — this is a client-side-only app ([ADR-0002](../adr/0002-client-side-only.md)). In-memory state surfaced by this feature:

```js
// Module-scoped — declared once near the top of Module 3.
let parsedConstantWork = null;
//   parsedConstantWork: null | RowObject[]
//   null  : no Constant Work CSV ever loaded in this session.
//   []    : loaded a CSV that parsed to zero rows.
//   RowObject[] : loaded a non-empty CSV.

// Per-row raw shape (from PapaParse) — user-authored schema:
type ConstantWorkRow = {
  jira_key?:    string;     // or epic_key (alternative spelling tolerated)
  epic_key?:    string;
  epic_name?:   string;     // or building_block
  building_block?: string;
  key_result?:  string;     // or KR or kr (parallel KR lookup per ADR-0022)
  KR?:          string;
  kr?:          string;
  moscow?:      string;     // free-text, normalised via normalizeMoscow
  team?:        string;     // matched case-insensitively against parsedInitiatives' team column
  quarter?:     string;     // e.g. "Q3 2026"
  tshirt_size?: string;     // or t_shirt_size
  t_shirt_size?: string;
};

// Per-row display shape produced by getConstantWorkEpics:
type ConstantWorkDisplayRow = {
  key:        string;       // jira_key | epic_key, trimmed; '' when both absent
  name:       string;       // epic_name | building_block, trimmed; '' when both absent
  kr:         string;       // key_result | KR | kr, trimmed; '' when all absent
  moscow:     'must' | 'should' | 'could' | 'wont' | 'unknown';
  effort:     number;       // tshirtToPersonMonths(tshirt_size | t_shirt_size); 0 on unknown size
  tshirt:     string;       // normalizeSize(tshirt_size | t_shirt_size); '' on absent
  isConstant: true;         // load-bearing flag — drives the matrix render fork
};

// Extension to ProjectionTeamData (from feature 0011):
type ProjectionTeamData = {
  // ... existing fields from prepareTeamSimulationData ...
  fixedEffort: number;      // getConstantWorkEffort(targetQuarters, teamName); 0 when no CSV
};

// Extension to runSimulation's parameter shape (feature 0003):
type RunSimulationInput = {
  // ... existing fields ...
  fixedEffort?: number;     // default 0; the deterministic PM shift applied to every iteration
};

// Extension to runSimulation's return shape:
type RunSimulationOutput = {
  // ... existing fields ...
  fixedEffort: number;      // echoed back for downstream surfaces (markers, capacity row)
};
```

The `kr` field on `ConstantWorkDisplayRow` is always a string (possibly empty); the empty-string normalisation happens at the read site (`index.html:1680`).

---

## Phase 1: Parse path — CSV upload UI, cache, helpers, and deterministic effort

### Acceptance behavior

Scenario AT-1: Sidebar upload control is present even before any CSV is loaded
Given the user opens `index.html` for the first time in a session
When the sidebar renders
Then the `Constant Work CSV` upload block is visible with `📄 Click to upload…` text
And the `(optional)` annotation in the label reads in a muted grey
And the `✕ Remove file` button is hidden

Scenario AT-2: Uploading a non-empty CSV updates the cache and the visual
Given the user clicks the upload control
And selects a CSV with `team`, `quarter`, `tshirt_size` columns populated
When the file is read
Then `parsedConstantWork` is a non-empty array of row objects
And the file icon flips to `✅`
And the file-name span shows the filename
And the `✕ Remove file` button is visible
And the console log shows `[ConstantWork] <n> rows`

Scenario AT-3: Uploading an empty (header-only) CSV
Given the user uploads a CSV with headers but no data rows
When the file is parsed
Then `parsedConstantWork === []` (empty array, not `null`)
And both consumer helpers return their zero values (`0` for effort, `[]` for epics)
And no error is raised

Scenario AT-4: `✕ Remove file` resets the cache and the UI
Given a Constant Work CSV has been loaded
When the user clicks `✕ Remove file`
Then `parsedConstantWork === null` (cache cleared)
And the file input value is cleared
And the file icon flips back to `📄`
And the file-name span reads `Click to upload…`
And the `✕ Remove file` row hides
And the `cw-reset-row` `display` is `none`

Scenario AT-5: `tshirtToPersonMonths` returns the closed-form lognormal mean
Given the current `activeParams` is `T_SHIRT_PARAMS` (synthetic)
When `tshirtToPersonMonths('M')` is called
Then it returns `Math.exp(p.mu + (p.sigma * p.sigma) / 2)` for `p = T_SHIRT_PARAMS['M']`
(Numerically: `Math.exp(0.7521 + 0.2703² / 2) ≈ 2.20` PM for synthetic `M`.)

Scenario AT-6: `tshirtToPersonMonths` follows the active parameter set
Given the user has toggled to **Empirical parameters** (`activeParams === T_SHIRT_PARAMS_EMPIRICAL`)
When `tshirtToPersonMonths('M')` is called
Then it returns `Math.exp(T_SHIRT_PARAMS_EMPIRICAL['M'].mu + (sigma² / 2))`
(Numerically: `Math.exp(0.9636 + 0.2703² / 2) ≈ 2.70` PM under empirical `M`.)

Scenario AT-7: `tshirtToPersonMonths` returns 0 for unknown sizes
Given any active parameter set
When `tshirtToPersonMonths('XXL')` or `tshirtToPersonMonths('')` or `tshirtToPersonMonths(null)` is called
Then it returns `0` (no error, no warning, no throw)
(The `normalizeSize(null) === ''`, and `''` is not a key in `T_SHIRT_PARAMS` / `T_SHIRT_PARAMS_EMPIRICAL`, so the guard `if (!p) return 0` triggers.)

Scenario AT-8: `getConstantWorkEffort` sums deterministically over matching rows
Given `parsedConstantWork` has three rows: `{team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'M'}`, `{team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'S'}`, `{team: 'Risk', quarter: 'Q3 2026', tshirt_size: 'L'}`
When `getConstantWorkEffort(['Q3 2026'])` is called (org-level: no team filter)
Then it returns `tshirtToPersonMonths('M') + tshirtToPersonMonths('S') + tshirtToPersonMonths('L')`

Scenario AT-9: `getConstantWorkEffort` filters by team case-insensitively
Given the same three rows from AT-8
When `getConstantWorkEffort(['Q3 2026'], 'platform')` is called (lowercase team)
Then it returns `tshirtToPersonMonths('M') + tshirtToPersonMonths('S')` (only the two Platform rows)
And the rows are matched against `(r.team || '').trim().toLowerCase() === teamName.toLowerCase()`

Scenario AT-10: `getConstantWorkEffort` filters by quarter set
Given `parsedConstantWork` has rows in `Q3 2026` and `Q4 2026`
When `getConstantWorkEffort(['Q3 2026'])` is called
Then only the `Q3 2026` rows contribute
And the rows are matched against `qSet.has((r.quarter || '').trim())` (trimming applied)

Scenario AT-11: `getConstantWorkEffort` returns 0 on null/empty cache
Given `parsedConstantWork === null` (no CSV loaded)
Or `parsedConstantWork === []` (parsed to zero rows)
When `getConstantWorkEffort(['Q3 2026'])` or `getConstantWorkEffort(['Q3 2026'], 'Platform')` is called
Then it returns `0`

Scenario AT-12: `getConstantWorkEpics` returns display-formatted rows
Given `parsedConstantWork` has one row: `{jira_key: 'OPS-1', epic_name: 'TLS rotation', key_result: 'KR-7', moscow: 'must', team: 'Platform', quarter: 'Q3 2026', tshirt_size: 'M'}`
When `getConstantWorkEpics('Q3 2026', 'Platform')` is called
Then it returns `[{ key: 'OPS-1', name: 'TLS rotation', kr: 'KR-7', moscow: 'must', effort: ~2.20, tshirt: 'M', isConstant: true }]`

Scenario AT-13: `getConstantWorkEpics` tolerates alternative column spellings
Given a row with `epic_key` instead of `jira_key`, `building_block` instead of `epic_name`, `KR` instead of `key_result`, `t_shirt_size` instead of `tshirt_size`
When `getConstantWorkEpics(quarter, teamName)` is called
Then the returned entry's `key`, `name`, `kr`, `effort`, and `tshirt` are populated from the alternative columns
And the precedence is `jira_key || epic_key`, `epic_name || building_block`, `key_result || KR || kr`, `tshirt_size || t_shirt_size`

Scenario AT-14: `getConstantWorkEpics` returns `[]` for non-matching cells
Given `parsedConstantWork` has rows only in `Q3 2026` for team `Platform`
When `getConstantWorkEpics('Q4 2026', 'Platform')` is called
Or when `getConstantWorkEpics('Q3 2026', 'Risk')` is called
Then it returns `[]`

Scenario AT-15: `getConstantWorkEpics` is case-insensitive on team match but exact on quarter match
Given a row with `team: 'PLATFORM'` and `quarter: 'Q3 2026'`
When `getConstantWorkEpics('Q3 2026', 'platform')` is called
Then the row is included
But when `getConstantWorkEpics('q3 2026', 'platform')` is called (lowercase quarter)
Then the row is *not* included
(Quarter match is via `.trim() === q.trim()`, not `.toLowerCase()`.)

Scenario AT-16: The `isConstant: true` flag is set on every returned entry
Given `getConstantWorkEpics` returns a non-empty array
Then every entry has `isConstant === true` (boolean literal `true`, not `'true'`, not `1`)
(The flag is the only render-time signal that this is a constant-work row.)

### Public entry point

In-code:
- `loadConstantWorkCSV(text: string): void` (`index.html:1641-1644`).
- `resetConstantWorkFile(): void` (`index.html:1631-1639`).
- `tshirtToPersonMonths(size: string): number` (`index.html:1272-1276`).
- `getConstantWorkEffort(quarters: string[], teamName?: string | null): number` (`index.html:1650-1662`).
- `getConstantWorkEpics(quarter: string, teamName: string): ConstantWorkDisplayRow[]` (`index.html:1668-1686`).

UI: the sidebar `#constant-work-upload` block (`index.html:861-872`).

### Expected observable outcomes
- The Constant Work CSV upload control is visible in every session, regardless of whether the user uses it.
- Uploading a CSV flips the icon to `✅`, shows the filename, and reveals the reset row.
- Clicking the reset clears `parsedConstantWork` to `null` and reverts the visual.
- `tshirtToPersonMonths` returns the closed-form lognormal *mean* of the active parameter set, not a sample, not a P50.
- `getConstantWorkEffort` returns a deterministic sum that is invariant across re-calls with the same inputs.
- `getConstantWorkEpics` returns rows with the `isConstant: true` flag set and the alternative-column-spellings normalised.
- All four helpers tolerate the null/empty cache without throwing.

### Test harness

Acceptance tests:
- Location: **N/A — manual.** This project has no automated test suite.
- Manual steps:
  1. Open `index.html` cold. Confirm the Constant Work upload block reads `Click to upload…` and the reset row is hidden (AT-1).
  2. Upload a 3-row constant-work CSV. Confirm icon flip, filename display, reset-row visibility, and console log (AT-2).
  3. Upload a header-only CSV. Confirm `parsedConstantWork === []` in DevTools and no error (AT-3).
  4. Click `✕ Remove file`. Confirm `parsedConstantWork === null` and the visual reverts (AT-4).
  5. From DevTools: call `tshirtToPersonMonths('M')` under the synthetic toggle, then re-call after switching to empirical; confirm both return the corresponding closed-form mean (AT-5, AT-6).
  6. Call `tshirtToPersonMonths('XXL')`, `tshirtToPersonMonths('')`, `tshirtToPersonMonths(null)` — confirm `0` (AT-7).
  7. With a 3-row CSV across two teams in `Q3 2026`, call `getConstantWorkEffort(['Q3 2026'])` and confirm the sum across all teams (AT-8).
  8. Re-call with the team filter; confirm only the matched-team rows contribute (AT-9).
  9. Test quarter-set filtering with a multi-quarter CSV (AT-10).
  10. Reset the CSV and confirm both helpers return their zero values (AT-11).
  11. With a sample row, call `getConstantWorkEpics('Q3 2026', 'Platform')` and inspect the returned entry's fields (AT-12, AT-16).
  12. Construct rows with alternative column spellings and confirm precedence (AT-13).
  13. Confirm non-matching cells return `[]` (AT-14).
  14. Test the case-sensitivity asymmetry: team case-insensitive, quarter case-sensitive (AT-15).

Inner tests: N/A.

Verification: manual.

Fake-injection wiring: N/A — the helpers are pure functions of `parsedConstantWork` plus their arguments.

### Proposed implementation seams

Stable seams a future test suite may target:
- `loadConstantWorkCSV(text)` — pure write to `parsedConstantWork`; idempotent on same input.
- `getConstantWorkEffort(quarters, teamName?)` — pure read; returns a `number`.
- `getConstantWorkEpics(quarter, teamName)` — pure read; returns a `ConstantWorkDisplayRow[]`.
- `tshirtToPersonMonths(size)` — pure read of `activeParams[normalizeSize(size)]`; returns `0` on miss.
- The two `if (!parsedConstantWork || !parsedConstantWork.length) return …;` guards.
- The case-insensitive team match (`(r.team || '').trim().toLowerCase()`).

Do NOT lock in:
- The exact filename of the parsed CSV (the user owns it).
- The exact `[ConstantWork] <n> rows` log line wording — could be enriched in a future revision.
- The presence or absence of `(optional)` in the label — UX call.

### Behavioral rule

The Constant Work CSV is an *optional* third file alongside the Initiatives and Epics CSVs, uploaded via a dedicated sidebar control that mirrors the Initiatives/Epics upload pattern. Uploading caches the parsed rows in `parsedConstantWork` (`null` until first upload, `[]` when a CSV parses to zero rows, `RowObject[]` otherwise) and updates the visual state of the upload control (icon, filename, reset-row visibility). Two consumer helpers — `getConstantWorkEffort(quarters, teamName?)` and `getConstantWorkEpics(quarter, teamName)` — read the cache and return deterministic values: a `number` (the sum of `tshirtToPersonMonths` over matching rows) and a `ConstantWorkDisplayRow[]` (display-formatted rows with the `isConstant: true` flag set). Per-row effort is computed deterministically as the closed-form lognormal *mean* `e^(μ + σ²/2)` of the active parameter set — synthetic or empirical — via `tshirtToPersonMonths`, which returns `0` on unknown sizes. Team matching is case-insensitive; quarter matching is exact (trimmed). The Constant Work CSV is the user's own template with a fixed schema; its column names are hardcoded inline (`tshirt_size | t_shirt_size`, `jira_key | epic_key`, `epic_name | building_block`, `key_result | KR | kr`) and *not* routed through the column detector family.

### Invariants
- `parsedConstantWork` is one of three states: `null` (never loaded), `[]` (loaded but empty), or a non-empty `RowObject[]`. No fourth state.
- Both consumer helpers (`getConstantWorkEffort`, `getConstantWorkEpics`) return their zero values (`0` and `[]`) when `parsedConstantWork` is `null` or `[]`. The two states are observationally equivalent at the consumer surface.
- `tshirtToPersonMonths(size)` is pure: same `size` ⇒ same return, given a fixed `activeParams`. The function reads `activeParams`, not `T_SHIRT_PARAMS` directly.
- `tshirtToPersonMonths(size)` returns `0` for any size that is not a key in the active parameter map. It never throws and never warns (contrast `sampleLognormal`, which warns).
- `getConstantWorkEffort(quarters, teamName?)` returns a non-negative `number`. The team filter is case-insensitive (`(r.team || '').trim().toLowerCase()`); the quarter filter is exact (`qSet.has((r.quarter || '').trim())`).
- `getConstantWorkEpics(quarter, teamName)` returns rows in the same order they appear in `parsedConstantWork` (no internal sort). Each returned entry carries `isConstant: true`.
- The Constant Work CSV does *not* go through `detectInitKeyCol`, `detectMoscowCol`, `detectNameCol`, `detectTeamCol`, `detectEpicLinkCol`, or `detectKrCol`. Its column names are hardcoded inline.

### Counterexamples (must NOT pass)
- A helper that initialises `parsedConstantWork = []` instead of `null` — loses the "loaded yet?" semantics.
- A helper that throws on `parsedConstantWork === null` — every other surface in the file degrades gracefully on a not-yet-loaded CSV; the Constant Work helpers must too.
- A `tshirtToPersonMonths` that returns the lognormal *median* (`Math.exp(p.mu)`) instead of the mean (`Math.exp(p.mu + p.sigma² / 2)`) — would systematically understate deterministic effort due to lognormal right-skew. See [ADR-0023](../adr/0023-constant-work-csv-deterministic-shift.md).
- A `tshirtToPersonMonths` that reads `T_SHIRT_PARAMS[…]` directly instead of `activeParams[…]` — would freeze constant-work rows on the synthetic parameter set, breaking the **Synthetic parameters** ↔ **Empirical parameters** toggle for constant work.
- A `tshirtToPersonMonths` that *samples* the lognormal once per call — would reintroduce Monte Carlo noise into deterministic effort, defeating the "guaranteed work" semantics.
- A `getConstantWorkEffort` that does a *case-sensitive* team match — would silently drop rows whose team-name casing differs from the **Team Level tab**'s rendered name.
- A `getConstantWorkEpics` that pre-sorts the returned rows by MoSCoW — would change the order in which constant-work rows appear at the bottom of the **Initiative matrix** away from the parsed-CSV order, which the user maintains in their own template.
- A helper that invokes `detectKrCol(parsedConstantWork)` to find the KR column — would couple the two CSV schemas; the constant-work CSV is hand-authored and uses one of three exact spellings. See [ADR-0022](../adr/0022-optional-key-result-column.md).

### Forbidden shortcuts
- Do not unify the Constant Work CSV with the Initiatives or Epics parse path. The third file is conceptually separate and structurally independent — see [ADR-0023](../adr/0023-constant-work-csv-deterministic-shift.md).
- Do not route the Constant Work CSV through the column detector family. The user owns the template; the column names are hardcoded.
- Do not migrate `parsedConstantWork`'s default from `null` to `[]`. The two states encode different things at the (future) UI level even if the consumer helpers treat them identically.
- Do not introduce a configuration toggle ("use median / mean / sample for constant work"). The closed-form mean is the documented, single-point estimate — see [ADR-0023](../adr/0023-constant-work-csv-deterministic-shift.md).
- Do not warn-or-throw on unknown `tshirt_size` values. The simulator silently treats unknown sizes as contributing `0` PM; the user reads the per-row annotation (`[ · ~0.00 PM]`) and notices.
- Do not add a "validate constant work CSV" pre-flight step. The simulator is permissive; mismatched rows are silently ignored.

### RED gate

On an unimplemented build:
- Manual step 1: the sidebar has no constant-work upload block at all.
- Manual step 5: `tshirtToPersonMonths` does not exist (`ReferenceError`).
- Manual step 7: `getConstantWorkEffort` does not exist (`ReferenceError`).
- Manual step 11: `getConstantWorkEpics` does not exist (`ReferenceError`).

### Test immutability rule

There are no test files to freeze (manual harness). If a test suite is later introduced for these helpers, those tests would live under `tests/acceptance/` and be off-limits to the implementation session.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-16 all pass.
- [ ] `parsedConstantWork` defaults to `null` and resets to `null` on `resetConstantWorkFile`.
- [ ] `tshirtToPersonMonths` reads `activeParams`, not `T_SHIRT_PARAMS` directly, and returns the closed-form lognormal mean.
- [ ] `getConstantWorkEffort` and `getConstantWorkEpics` guard `null`/empty cache and return their zero values.
- [ ] The Constant Work CSV is *not* routed through any `detectXxxCol`.
- [ ] `git diff` for this phase touches only `index.html` (plus this plan, the ADR, and CONTEXT.md per [ADR-0001](../adr/0001-single-file-html-app.md)).

---

## Phase 2: Engine integration — `fixedEffort` parameter, post-sort shift, and the three call sites

### Acceptance behavior

Scenario AT-1: `runSimulation` accepts an optional `fixedEffort` parameter
Given the existing `runSimulation` signature
When the caller passes `fixedEffort: 5.5`
Then the engine accepts the parameter without error
And when the caller omits `fixedEffort`
Then it defaults to `0` and the engine behaves identically to the pre-feature build
(Default parameter destructure: `fixedEffort = 0`.)

Scenario AT-2: `fixedEffort = 0` short-circuits the shift helper
Given `fixedEffort === 0` (or omitted)
When the `shift` helper runs on a sorted Float64Array
Then it returns the input array *by reference* (no copy, no allocation)
And the resulting `shifted*` arrays are the same references as `sorted*`

Scenario AT-3: Non-zero `fixedEffort` shifts every per-iteration total
Given `fixedEffort === 10.0` and the MSC scenario produced a `sortedMSC` array with values `[5, 8, 12, 20]`
When `shift(sortedMSC)` runs
Then it returns a *new* Float64Array with values `[15, 18, 22, 30]`
And the input `sortedMSC` is not mutated
And the result is still sorted (because adding a constant to a sorted array preserves order)

Scenario AT-4: Stats are computed against the shifted arrays
Given `fixedEffort > 0`
When `computeStats(shiftedMSC, capacity)` runs
Then every reported percentile (P10/P25/P50/P75/P90) equals `<original_percentile> + fixedEffort`
And `pExceed = P(shifted > capacity) = P(original > capacity − fixedEffort)`
(The shift is mathematically equivalent to comparing the original distribution against `capacity − fixedEffort`.)

Scenario AT-5: Histograms are built against the shifted arrays
Given `fixedEffort > 0`
When `buildHistogram(shiftedMSC, globalMin, globalMax, 60)` runs
Then every bin centre is `<original_bin_centre> + fixedEffort`
And `globalMin = fixedEffort` (not `0`)
And `globalMax = Math.max(p995(shiftedMS), p995(shiftedM), p995(shiftedMSC), fixedEffort + 1)`

Scenario AT-6: The simulation return object echoes `fixedEffort`
Given `fixedEffort > 0` is passed in
When `runSimulation` returns
Then the returned object has `fixedEffort` set to the input value
(Useful for downstream surfaces that need to know the shift — currently none, but reserved for future use.)

Scenario AT-7: Org-level Run uses `fixedEffort = getConstantWorkEffort(targetQs)` (no team filter)
Given the user presses **Run Simulation** with target quarters `[Q3 2026]` and a loaded Constant Work CSV with rows for two teams
When the run-button handler runs
Then `orgFixedEffort = getConstantWorkEffort(['Q3 2026'])` (sum across all teams)
And `runSimulation({ ..., fixedEffort: orgFixedEffort })` is invoked
And the org-level histogram and stats reflect the cross-team sum

Scenario AT-8: Team-level Run uses `td.fixedEffort = getConstantWorkEffort(targetQuarters, teamName)`
Given `prepareTeamSimulationData(histQs, targetQs, ...)` runs for a team `Platform` with constant work in the target quarters
When the team data object is constructed
Then `td.fixedEffort` is the per-team sum (`getConstantWorkEffort(targetQs, 'Platform')`)
And `renderTeamSection(idx, useOrg)` reads `td.fixedEffort` and passes it as `fixedEffort` to `runSimulation`

Scenario AT-9: Team-level toggle (org-wide vs this-team-only) does not change `td.fixedEffort`
Given a team has both team-scoped historical data and per-team constant work
When the user toggles the **Historical data toggle** from `This team only` to `All teams — org-wide`
Then `td.fixedEffort` is unchanged (it remains the per-team constant-work sum)
And only `lambda` and `epicSizingDist` are toggled
(The **Historical data toggle** controls *fitting*, not *load*. Constant work belongs to the team regardless of how the team's λ is fit.)

Scenario AT-10: Quick projection MC uses `fixedEffort = cwEffort` (per-team-per-quarter sum)
Given `buildTeamProjections` runs for a team-quarter cell with `cwEpics` containing two rows summing to `cwEffort = 4.2 PM`
When the **Quick projection Monte Carlo** runs for that cell
Then `runSimulation({ ..., fixedEffort: cwEffort })` is invoked
And the resulting `p25`, `p50`, `p75` each include the `4.2 PM` shift

Scenario AT-11: Quick projection MC falls back to `cwEffort` triple when the MC is skipped
Given a team-quarter cell with `kMustShouldCould === 0` (no MSC initiatives) but `cwEpics.length > 0`
When `buildTeamProjections` evaluates the cell
Then the MC is skipped (the `if (kMustShouldCould > 0 && orgEpicSizingDist.length > 0 && orgLambda > 0)` guard is `false`)
And `p25 = cwEffort, p50 = cwEffort, p75 = cwEffort` (the pre-MC default holds)
And the **Effort projection band** for that quarter reads as a *flat* band on the chart and in the matrix footer

Scenario AT-12: Quick projection MC falls back to `cwEffort` when `orgLambda === 0`
Given the loaded historical quarters have `orgLambda === 0`
And the cell has `cwEpics.length > 0`
When `buildTeamProjections` evaluates the cell
Then the MC is skipped and the band sits at `cwEffort`

Scenario AT-13: Quick projection MC falls back to `cwEffort` when `orgEpicSizingDist.length === 0`
Given no in-scope sized epics were found
And the cell has `cwEpics.length > 0`
When `buildTeamProjections` evaluates the cell
Then the MC is skipped and the band sits at `cwEffort`

Scenario AT-14: With no Constant Work CSV loaded, `fixedEffort = 0` everywhere
Given `parsedConstantWork === null`
When the user presses Run
Then `orgFixedEffort === 0` (org-level)
And every team's `td.fixedEffort === 0` (team-level)
And every cell's `cwEffort === 0` (Quick projection MC)
And the engine behaves identically to the pre-feature build (no shift, `globalMin === 0`)

Scenario AT-15: The post-sort shift preserves the binary-search percentile lookup
Given a sorted Float64Array of 10,000 iterations and `fixedEffort = 12.5`
When `computeStats(shifted, capacity)` runs (which performs binary searches over the sorted array)
Then every percentile is read from the same index in the shifted array as it would have been in the original
And `P(shifted > capacity)` equals `P(original > capacity − 12.5)` to within floating-point precision
(The binary search relies on the sort order, which the constant shift preserves.)

Scenario AT-16: `globalMin = fixedEffort` keeps the histogram bins on the actual support
Given `fixedEffort = 12.5` and the shifted distribution spans `[12.5, 60]`
When `buildHistogram` partitions `[globalMin, globalMax]` into 60 bins
Then `globalMin === 12.5` (not `0`)
And the leftmost bin centre sits at `12.5 + binWidth/2`
And no bin is guaranteed-empty due to the lower bound being below the distribution's support

### Public entry point

In-code:
- `runSimulation({ ..., fixedEffort = 0 })` (`index.html:2086`).
- The `shift` helper, `globalMin = fixedEffort`, and `globalMax` line (`index.html:2103-2118`).
- The `fixedEffort` field on the returned object (`index.html:2139`).
- The `orgFixedEffort` thread inside the run-button handler (`index.html:3343-3344`).
- The `fixedEffort: getConstantWorkEffort(targetQuarters, teamName)` on `prepareTeamSimulationData`'s returned shape (`index.html:1900-1901`).
- The `td.fixedEffort || 0` thread inside `renderTeamSection` (`index.html:2431`).
- The `cwEffort` thread inside `buildTeamProjections` (`index.html:1981`, `1985`, `1991`, `2002`).

UI: the org-level histogram, the team-level histograms, and the effort-projection chart all reflect the shifts.

### Expected observable outcomes
- Every `runSimulation` call site passes a *scoped* `fixedEffort`: org-level → sum across all teams; team-level → per-team sum; Quick projection MC → per-team-per-quarter sum.
- The shift preserves every existing invariant: sort order, percentile lookup, `P(effort > capacity)` semantics, the 60-bin histogram structure.
- When `fixedEffort === 0`, the engine is bit-for-bit identical to the pre-feature build (the `shift` helper short-circuits to the input reference).
- The chart's `globalMin` moves with the shift; the leftmost bin sits at the shifted distribution's actual lower bound.

### Test harness

Acceptance tests:
- Location: **N/A — manual.**
- Manual steps:
  1. From DevTools, call `runSimulation({ lambda: 4, epicSizingDist: ['M','M','S'], kMust: 5, kMustShould: 8, kMustShouldCould: 12, capacity: 50, iterations: 10000, fixedEffort: 0 })` and `runSimulation({ ..., fixedEffort: 10 })`. Compare the two: the second's P50 should be ~10 higher than the first's (AT-3, AT-4).
  2. Inspect the second result's `mustShouldCould.hist.binCenters` — the leftmost bin should be at ~`10` (AT-5, AT-16).
  3. Confirm the returned object has `fixedEffort: 10` (AT-6).
  4. Upload Initiatives + Epics + Constant Work CSVs. Press Run. Inspect the org-level histogram x-axis lower bound — should equal `getConstantWorkEffort(targetQs)` (AT-7).
  5. Click `Team Level` and inspect each team's chart x-axis lower bound — should equal the per-team `td.fixedEffort` (AT-8).
  6. Toggle the **Historical data toggle** on a team that has constant work; confirm the x-axis lower bound is unchanged across the toggle (AT-9).
  7. Click `Team Projections`. For a cell with only constant work (no MSC initiatives), confirm the effort projection band reads as a flat `~<cwEffort> PM` with `<cwEffort>–<cwEffort>` below (AT-11).
  8. Reset the Constant Work CSV and confirm the next Run renders with `globalMin = 0` everywhere (AT-14).

Inner tests: N/A.

Verification: manual.

Fake-injection wiring: N/A — the helpers are deterministic, and the engine's RNG is re-seeded per Run.

### Proposed implementation seams

Stable seams a future test suite may target:
- The `runSimulation({ ..., fixedEffort = 0 })` default-parameter contract.
- The `shift` helper's short-circuit on falsy `fixedEffort`.
- The `globalMin = fixedEffort` rule.
- The three call sites and their respective scopes (org / team / per-cell).

Do NOT lock in:
- The variable name `shift` — internal helper.
- The exact `globalMax = Math.max(p995(...), fixedEffort + 1)` formula — could be refined.
- The variable name `cwEffort` — internal to `buildTeamProjections`.

### Behavioral rule

`runSimulation` accepts an optional `fixedEffort` (default `0`) that is added to every per-**Iteration** total *after* the Monte Carlo sort, via a `shift` helper that writes a new `Float64Array` (or returns the input reference when `fixedEffort === 0`). Every downstream consumer — `computeStats`, `buildHistogram`, percentile lookups — operates on the shifted arrays, so every reported percentile equals `<original_percentile> + fixedEffort` and every `P(effort > capacity)` equals `P(original > capacity − fixedEffort)`. The **Global histogram range**'s lower bound moves to `fixedEffort` so the 60 fixed-width bins concentrate on the actual support of the shifted distribution. Three call sites pass a *scoped* `fixedEffort`: the org-level Run sums constant work across all teams in the target quarters (`getConstantWorkEffort(targetQs)`); the team-level Run sums per-team (`getConstantWorkEffort(targetQuarters, teamName)`, threaded via `prepareTeamSimulationData`'s `td.fixedEffort`); the **Quick projection Monte Carlo** sums per-team-per-quarter (`cwEpics.reduce((s, e) => s + e.effort, 0)`). When the Quick projection MC is skipped (no MSC initiatives, `orgLambda === 0`, or empty bootstrap pool), the **Effort projection band** defaults to `{p25: cwEffort, p50: cwEffort, p75: cwEffort}` — a flat band that surfaces "constant-work only" on the chart and in the matrix footer.

### Invariants
- `runSimulation`'s default `fixedEffort` is `0`. Omitting the parameter is equivalent to passing `0`.
- The `shift` helper preserves sort order — adding a constant to a sorted array yields a sorted array.
- The `shift` helper does *not* mutate its input. When `fixedEffort !== 0`, it returns a *new* `Float64Array`; when `fixedEffort === 0`, it returns the input by reference.
- `globalMin === fixedEffort`. The lower bound of the chart x-axis equals the shift.
- `globalMax >= fixedEffort + 1`. The 1-PM-floor guard still holds when the shifted distribution sits at exactly `fixedEffort` for every iteration.
- Every percentile reported by `computeStats(shifted, capacity)` is exactly `<original_percentile> + fixedEffort`, up to floating-point precision.
- `pExceed` is mathematically equivalent to `P(original > capacity − fixedEffort)`.
- The three `fixedEffort` scopes are independent: changing one does not affect another. There is *no* global "the fixedEffort" variable; each call site computes its own scope.
- The **Historical data toggle** does *not* change `td.fixedEffort`. Constant work belongs to the team; the toggle only governs which historical pool fits λ.

### Counterexamples (must NOT pass)
- A `runSimulation` that omits the `fixedEffort` default — would force every caller to pass it, breaking the "Constant Work CSV is optional" contract.
- A `shift` helper that mutates the input array in place — would break the existing rule that `sortedMS`, `sortedM`, `sortedMSC` are observable per-scenario state.
- A `shift` helper that loops over the array even when `fixedEffort === 0` — wastes an `O(n)` pass and a `Float64Array` allocation on every Run that has no Constant Work CSV.
- A `globalMin` that stays at `0` when `fixedEffort > 0` — wastes the leftmost ~`fixedEffort`-wide span of the histogram on bars guaranteed to be empty.
- A `runSimulation` that applies the shift *before* the sort — the post-sort shift relies on sort-order preservation; pre-sort shift would require a re-sort.
- An org-level Run that filters `getConstantWorkEffort` by a team name — the org Run is asking "does the whole org fit?" and must sum across every team.
- A team-level Run that uses the org-level `fixedEffort` — would over-count constant work for a single team's section.
- A Quick projection MC that uses the team-level `fixedEffort` — would over-count by including other quarters' constant work in this quarter's band.
- A **Historical data toggle** path that re-computes `td.fixedEffort` based on the toggle state — the toggle governs fitting, not load.

### Forbidden shortcuts
- Do not introduce a global module-scoped `currentFixedEffort` variable. The three scopes are independent; each call site computes its own.
- Do not move the shift inside `runScenario` or any inner loop. The post-sort placement is the load-bearing decision — see [ADR-0023](../adr/0023-constant-work-csv-deterministic-shift.md).
- Do not pre-sample the constant-work effort once per Run (treating it as a stochastic-with-tight-CV input). The deterministic mean is the documented contract.
- Do not add a third return field for "original distribution" — the engine returns the shifted distribution; downstream surfaces consume the shifted form.
- Do not surface `globalMin` separately for "with constant work" vs "without" — there is one `globalMin` per Run, equal to `fixedEffort`.
- Do not validate that `fixedEffort >= 0`. Negative shifts are nonsensical at the data level (a row's `tshirtToPersonMonths` is always `≥ 0`), so the engine trusts the caller.

### RED gate

On an unimplemented build (no `fixedEffort` parameter):
- Manual step 1: `runSimulation({ ..., fixedEffort: 10 })` either ignores the parameter (no shift) or throws (`Unknown parameter`).
- Manual step 4: the org-level histogram lower bound is `0` despite a loaded Constant Work CSV.
- Manual step 7: the **Effort projection band** for constant-work-only cells reads `~0 PM` instead of `~<cwEffort> PM`.

### Test immutability rule

N/A.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-16 all pass.
- [ ] `runSimulation`'s `fixedEffort` defaults to `0`.
- [ ] The `shift` helper short-circuits on falsy `fixedEffort`.
- [ ] Three independent call sites compute `fixedEffort` at the right scope.
- [ ] `globalMin === fixedEffort`.
- [ ] The **Historical data toggle** does not change `td.fixedEffort`.
- [ ] `git diff` for this phase touches only `index.html`.

---

## Phase 3: Team Projections render — appended green-tinted rows and quarter-axis expansion

### Acceptance behavior

Scenario AT-1: Constant-work rows appear at the bottom of the Initiative matrix
Given a **Projection section** for team `Platform` has 3 Initiatives and 2 constant-work rows in some quarter
When `renderTeamProjections` runs
Then the **Initiative matrix** for `Platform` has 5 body rows
And the 2 constant-work rows appear *after* the sorted Initiatives (which are sorted Must → Should → Could → Won't → Unknown then alphabetical by Jira key)
And the order of the 2 constant-work rows matches the parsed-CSV order

Scenario AT-2: Constant-work rows render with the soft-green tint
Given a row has `i.isConstant === true`
When the row HTML is emitted
Then the `<tr>` carries `style="background:#f0fdf4"` (the soft-green tint)
And no other row in the matrix carries that tint

Scenario AT-3: Constant-work rows annotate the name cell with size and effort
Given a constant-work row has `i.name === 'TLS rotation'`, `i.tshirt === 'M'`, `i.effort === 2.20`
When the row HTML is emitted
Then the name cell reads `TLS rotation <span style="font-size:10px;color:#16a34a;font-weight:600;white-space:nowrap">[M · ~2.20 PM]</span>`
And the annotation colour matches the green tint family (`#16a34a`)
And the effort is formatted with two decimal places via `i.effort.toFixed(2)`

Scenario AT-4: Initiative rows do *not* carry the size/effort annotation
Given a stochastic Initiative row (`i.isConstant !== true`)
When the row HTML is emitted
Then the name cell reads `<i.name or em-dash>` only (no `[size · PM]` annotation)
And the `<tr>` has no inline `style="background:..."` attribute

Scenario AT-5: Per-quarter MoSCoW badge cell still appears for constant-work rows
Given a constant-work row has `i.quarter === 'Q3 2026'` and `i.moscow === 'must'`
When the row HTML is emitted
Then the cell under the `Q3 2026` `<th>` reads `<td class="qcol">${moscowBadge('must')}</td>`
And every other quarter cell for that row reads `<td class="qcol"></td>` (blank)
(*Note*: in the current implementation, `getConstantWorkEpics` does not set `quarter` on the returned row; the row's `moscow` badge appears in every quarter column the section renders. The per-cell `q === i.quarter` check evaluates to `false` for every `q` and so every quarter cell is blank. This is a known limitation; constant-work rows surface their effort via the footer band, not via per-row per-quarter badges.)

Scenario AT-6: Constant-work-only quarters expand the section's quarter axis
Given team `Platform` has Initiatives only in `Q3 2026` but constant work in `Q4 2026`
When `buildTeamProjections` runs
Then the section's `activeQuartersForTeam` includes both `Q3 2026` and `Q4 2026`
And the matrix has `<th>` columns for both quarters
And the `Q4 2026` column shows the constant-work row's contribution in the footer band (`~<cwEffort> PM`)

Scenario AT-7: A team-quarter cell with no Initiatives *and* no constant work is skipped
Given the section's quarter axis includes `Q5 2026`
And team `Platform` has no Initiatives and no constant work for `Q5 2026`
When `buildTeamProjections` evaluates that cell
Then the `if (!qInits.length && !cwEpics.length) continue;` guard fires (`index.html:1952`)
And `byQuarter[q]` is not set for that quarter
And the footer band for that quarter renders the em-dash placeholder (`—`)

Scenario AT-8: The `Effort P50 (P25–P75)` footer reflects the `cwEffort` shift
Given a cell with `cwEffort === 4.2 PM` and a successful Quick projection MC for the MSC scenario
When `renderTeamProjections` renders the footer
Then the footer reads `~<p50> PM` with `<p25>–<p75>` below, where each percentile is the shifted value (i.e. `<original_percentile> + 4.2`)

Scenario AT-9: A constant-work-only cell renders a flat footer band
Given a cell with `cwEffort === 4.2 PM` and zero MSC initiatives (or `orgLambda === 0`, or empty bootstrap pool)
When `renderTeamProjections` renders the footer
Then the footer reads `~4 PM` (rounded to 0 decimal places via `.toFixed(0)`) with `4–4` below
(The Quick projection MC is skipped; the band's `p25 = p50 = p75 = cwEffort`.)

Scenario AT-10: A team with *only* constant work (no Initiatives anywhere) still gets a Projection section
Given the Initiatives CSV has no rows for team `Hosting` in any quarter
And the Constant Work CSV has rows for team `Hosting` in `Q4 2026`
When `buildTeamProjections` runs
Then `teamNames` includes `Hosting` (via the per-team CSV scan that this feature does *not* modify — see [feature 0012](./0012-team-projections-tab.md))
Then `Hosting`'s section has `Q4 2026` in its quarter axis
And the section's matrix has one constant-work row in `Q4 2026`
(*Note*: this scenario depends on `Hosting` being discoverable by the existing team-list extraction. In the current implementation, the team list is bounded by the Initiatives CSV's teams; a team that appears *only* in the Constant Work CSV is *not* surfaced as its own section. This is an acceptable limitation and is documented as a future revision in [ADR-0023](../adr/0023-constant-work-csv-deterministic-shift.md).)

Scenario AT-11: The KR column gate (`hasKr`) includes constant-work rows
Given a section has 0 Initiatives with a `kr` value
And 1 constant-work entry with `key_result: 'KR-12'`
When `renderTeamProjections` runs
Then `hasKr = allInits.some(i => i.kr) === true` (the constant-work row pulls the gate)
And the KR column appears in the section
And the constant-work row's KR cell reads `KR-12`

Scenario AT-12: Constant-work row's KR cell uses the same styling as Initiative KR cells
Given a section has `hasKr === true`
When a constant-work row and an Initiative row both render KR cells
Then both cells carry the `kr-col` class with `white-space:nowrap;font-size:11px;color:#6366f1;font-weight:600`
And the green row tint (`#f0fdf4`) on the constant-work row does *not* override the indigo KR text colour

Scenario AT-13: The `colspan` arithmetic accommodates the KR column when constant-work rows trigger `hasKr`
Given a section where only constant-work rows carry a KR value
When the section's `<tfoot>` renders
Then both footer rows' first `<td>` carries `colspan="3"` (Jira Key + KR + Initiative Name)
And the per-quarter footer cells line up with the `<th class="qcol">` quarter columns

Scenario AT-14: Resetting the Constant Work CSV removes the green rows on the next Run
Given a previous Run rendered constant-work rows in a section
When the user clicks `✕ Remove file` and re-presses **Run Simulation**
Then `parsedConstantWork === null`
And the new render has no constant-work rows in any section
And no section's quarter axis includes any constant-work-only quarters

Scenario AT-15: Constant-work rows do *not* affect either of the two side-by-side charts in a Projection section
Given a section's matrix has constant-work rows
When the `Initiatives by Quarter` count chart and the `Effort Projection by Quarter` chart render
Then the count chart shows only Initiative MoSCoW counts (constant-work rows are *not* a separate stack)
And the effort projection chart's P25/P50/P75 bar includes the `cwEffort` shift via the **Quick projection Monte Carlo**'s `fixedEffort` input (Phase 2)
(*Note*: the `Initiatives by Quarter` chart reads `byQuarter[q].kMust / kShould / kCould` which are populated from the *Initiative* MoSCoW counts only, not from constant-work rows — see `index.html:1957-1970` for the MoSCoW count block which precedes the constant-work append.)

### Public entry point

In-code:
- `buildTeamProjections`'s `cwQuarters` / `activeQuartersForTeam` / `cwEpics` / `cwEffort` / band default / row append (`index.html:1940-2003`).
- `renderTeamProjections`'s `i.isConstant` ternaries (`index.html:2627-2630`).
- The `.mb-constant` CSS class (`index.html:651`).

UI: each **Projection section**'s **Initiative matrix** in the `Team Projections` tab.

### Expected observable outcomes
- A section with constant-work rows renders them at the bottom of its matrix, tinted soft green, with size and effort annotated in the name cell.
- A section without constant-work rows renders no green rows and no annotations — visually identical to the pre-feature build.
- A team-quarter cell with *only* constant work expands the section's quarter axis and renders a flat **Effort projection band** in that quarter.
- The KR column gate (`hasKr`) includes constant-work rows; the per-row KR cell renders identically to Initiative KR cells.
- The two side-by-side charts (`Initiatives by Quarter`, `Effort Projection by Quarter`) are unchanged in structure; the effort chart's band reflects the `cwEffort` shift via Phase 2.

### Test harness

Acceptance tests:
- Location: **N/A — manual.**
- Manual steps:
  1. Load Initiatives + Epics + Constant Work CSVs (the constant-work CSV has rows for at least one team in a target quarter). Press Run. Click `Team Projections`. Confirm the matching team's matrix has green-tinted rows at the bottom (AT-1, AT-2).
  2. Inspect the name cell of a constant-work row; confirm the `[<size> · ~<PM> PM]` annotation (AT-3).
  3. Inspect an Initiative row; confirm no annotation and no green tint (AT-4).
  4. Construct a Constant Work CSV with a row in a quarter *not* present in the Initiatives CSV; confirm the section's axis expands and the cell renders a flat band (AT-6, AT-9).
  5. Set up a team whose Initiatives are only in `Q3` and constant work only in `Q4`; confirm both quarters are columns and the `Q4` cell shows the constant-work-only band (AT-6).
  6. Construct a Constant Work CSV where the only row in a team carries a `key_result` value but no Initiative in that team does; confirm the KR column appears in the section and the constant-work KR cell reads the value (AT-11, AT-12, AT-13).
  7. Reset the Constant Work CSV; re-press Run; confirm no green rows and no annotation in any section (AT-14).
  8. Inspect the `Initiatives by Quarter` chart for a section with constant-work rows; confirm the stack heights are still driven by Initiative counts only (AT-15).

Inner tests: N/A.

Verification: manual.

Fake-injection wiring: N/A.

### Proposed implementation seams

Stable seams a future test suite may target:
- The `i.isConstant` flag as the render-time fork driver.
- The `<tr style="background:#f0fdf4">` tint.
- The `[<size> · ~<PM> PM]` annotation pattern.
- The `cwQuarters` / `activeQuartersForTeam` union expansion.
- The `if (!qInits.length && !cwEpics.length) continue;` skip rule.

Do NOT lock in:
- The exact tint colour `#f0fdf4` — could be replaced with a near-neighbour in a future revision.
- The exact green text colour `#16a34a` — could be replaced.
- The `.toFixed(2)` on `i.effort` — could become `.toFixed(1)` if rows feel too precise.
- The position "after the sorted Initiatives" — could be reconfigured as "above the Initiatives" in a future revision, though that would re-open [ADR-0023](../adr/0023-constant-work-csv-deterministic-shift.md).

### Behavioral rule

`buildTeamProjections` builds each **Projection section**'s per-quarter data by iterating over `activeQuartersForTeam = [...new Set([...allQuarters, ...cwQuarters])]` (the union of the CSV's chronological quarters and the team's constant-work quarters), skipping cells with neither Initiatives nor constant work, and appending the constant-work rows *after* the section's sorted Initiative rows. Each cell carries a `cwEffort = sum of constant-work efforts`; the **Quick projection Monte Carlo** runs with `fixedEffort = cwEffort` (Phase 2) and produces a band that includes the deterministic shift, or — when the MC is skipped — a flat band at `cwEffort`. `renderTeamProjections` reads each row's `i.isConstant` flag and forks the render: constant-work rows carry the soft-green tint `#f0fdf4`, the `[<size> · ~<PM> PM]` annotation in the name cell, and the same KR cell styling as Initiative rows. Constant-work rows participate in the `hasKr = allInits.some(i => i.kr)` gate and contribute to the `colspan` arithmetic on the `<tfoot>` rows.

### Invariants
- Constant-work rows render *only* in the **Initiative matrix** inside a **Projection section** — never in any chart, never in the summary table at the top of the **Team Projections tab**, never in the org-level or team-level histograms, never in the **Data preview**.
- Constant-work rows render *after* the section's sorted Initiative rows. Their relative order is the parsed-CSV order.
- The `<tr>` background tint `#f0fdf4` is set if and only if `i.isConstant === true`.
- The name-cell `[<size> · ~<PM> PM]` annotation is emitted if and only if `i.isConstant === true`.
- The per-section quarter axis is expanded to include constant-work-only quarters (`activeQuartersForTeam`). Without this expansion, a constant-work-only quarter would be hidden from the section even though it carries committed effort.
- The skip rule `!qInits.length && !cwEpics.length` keeps the section free of cells with neither Initiatives nor constant work.
- The **Effort projection band** for a cell is the `runSimulation`-produced triple shifted by `cwEffort` (when MC runs) or the flat triple `(cwEffort, cwEffort, cwEffort)` (when MC is skipped).
- Constant-work rows participate in the `hasKr` gate; a constant-work-only KR triggers the section's KR column to appear.
- The constant-work row's KR cell uses the same `kr-col` styling as Initiative KR cells; the soft-green row tint does not override the indigo KR text colour.

### Counterexamples (must NOT pass)
- A renderer that places constant-work rows *above* the sorted Initiative rows — would invert the "stochastic above the line, deterministic below" reading order. See [ADR-0023](../adr/0023-constant-work-csv-deterministic-shift.md).
- A renderer that tints the *entire row* via a per-cell style instead of `<tr style="...">` — would let the green leak across the KR `<td>` and override the indigo text colour.
- A renderer that omits the `[<size> · ~<PM> PM]` annotation — the user loses the per-row deterministic effort number and must derive it from `cwEffort - <other rows>`.
- A `buildTeamProjections` that drops the `cwQuarters` union — would silently hide constant-work-only quarters from the section's axis.
- A `buildTeamProjections` that skips cells via `if (!qInits.length) continue;` (the pre-feature skip rule) — would hide constant-work-only cells.
- A renderer that mutates `byQuarter[q].initiatives` in place to filter out constant-work rows when `hasKr === false` — would hide constant-work rows that lack a KR.
- A renderer that emits the constant-work row's MoSCoW badge in *every* quarter column (rather than only the matching one) — would visually conflate "this row delivers in Q3" with "this row delivers in every quarter".
- A renderer that uses a different KR cell style for constant-work rows (e.g. green KR text on green background) — would break the uniform-KR-cell-styling rule.
- A renderer that adds the `[<size> · ~<PM> PM]` annotation to the org-level histogram tooltip or the Team Level tab — the annotation is matrix-only.

### Forbidden shortcuts
- Do not lift the constant-work row's `<tr>` markup into a separate helper function. The render fork is two ternaries (`rowStyle`, `nameDisplay`) and one inline `${krCell}` — a helper would obscure the per-row diff.
- Do not add a "Hide constant work" toggle. The user controls visibility via the upload/reset cycle on the Constant Work CSV.
- Do not surface constant-work rows in the count chart (`Initiatives by Quarter`). The chart counts *initiatives*; constant-work rows are *epics*.
- Do not add a fourth axis category to the count chart for "Constant". The MoSCoW Must / Should / Could stack is the documented structure.
- Do not introduce a `hasConstantWork` per-section flag analogous to `hasKr`. The presence of `i.isConstant === true` rows is observable directly; no flag is needed.
- Do not edit `allQuarters` (the CSV-wide chronological list). Per-team expansion happens at the per-team scope only — see [feature 0012](./0012-team-projections-tab.md).

### RED gate

On an unimplemented build (no constant-work render fork):
- Manual step 1: the matrix has no green-tinted rows even when `parsedConstantWork` has matching rows.
- Manual step 4: the section's quarter axis does not include constant-work-only quarters; the `Q4` column is missing.
- Manual step 6: the KR column does not appear in a section whose only KR-carrying row is a constant-work entry.

### Test immutability rule

N/A.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-15 all pass.
- [ ] Constant-work rows render after the sorted Initiative rows, with the soft-green tint and the `[<size> · ~<PM> PM]` annotation.
- [ ] The per-section quarter axis includes constant-work-only quarters.
- [ ] The skip rule (`!qInits.length && !cwEpics.length`) keeps empty cells out.
- [ ] The `Effort projection band` reflects the `cwEffort` shift via Phase 2.
- [ ] The KR column gate includes constant-work rows.
- [ ] `git diff` for this phase touches only `index.html`.
