# Feature: Category as generalized MoSCoW, user-defined Groups supersede the cumulative three-scenario engine, and `groups.json` persistence

Created at: 2026-05-26T15:00:00Z

## Context

This feature retires the simulator's hardcoded MoSCoW priority axis and the matching hardcoded three cumulative Scenarios, and replaces both with two new concepts surfaced through `index.html`:

- **Category** — a free-form per-Initiative label carrying whichever bucketing convention the user's planning uses (legacy `Must / Should / Could / Won't`, key-result-style `KR1 / KR2 / KR3`, project-style `Automation / Project ABC`, or arbitrary strings). The canonical CSV header is `category`; the detector cascade is `category → moscow → emoji` (header-name only, no content scan). Empty / whitespace values normalise to a reserved **(Blank) sentinel** (in-memory: the JavaScript `null` value; UI: the literal `(Blank)` with parentheses; JSON: the `null` literal).
- **Group** — a user-defined named subset of Category values that determines exactly one **Scenario** in a **Run**. Each Group carries `{ name: string, color: string, members: (string | null)[], isProjection: boolean }`. Groups are flat (not nested-by-construction), independent (overlap is allowed and is exactly how cumulative semantics is recovered), and lenient (empty / duplicate names, zero-member Groups, and references to categories absent from the loaded CSV are allowed; the single strict rule is exactly-one `isProjection`).

The feature spans three plan-phases that map onto two **releases**: Release 1 ships **Phase 1 + Phase 2** together (the engine substrate and the Groups tab UI — these are mutually load-bearing per HANDOFF.md); Release 2 ships **Phase 3** separately (the `groups.json` save/load). Each plan-phase is still individually verifiable: Phase 1 produces a single Scenario containing every observed Category; Phase 2 lets the user split that into multiple Scenarios via the Groups tab; Phase 3 adds disk persistence on top of Phase 2.

Architectural constraints inherited from earlier decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). Every change in every phase lands inline in `index.html` — markup, CSS, data model, render functions, persistence helpers.
- [ADR-0002 — Client-side only](../adr/0002-client-side-only.md). No backend, no `localStorage`; Group definitions are ephemeral in-memory state, persisted only via the Phase 3 user-driven `groups.json` save/load.
- [ADR-0005 — Content-based column detection](../adr/0005-content-based-column-detection.md). The **Content scan** branch is retained for the **Initiative key** detector but no longer used for the category column — see [ADR-0028](../adr/0028-category-as-generalized-moscow.md).
- [ADR-0011 — Overlapping histograms with shared bins](../adr/0011-overlapping-histograms-shared-bins.md). The chart's shared **Global histogram range** and shared bin count now span N datasets instead of three.
- [ADR-0017 — Multi-quarter selectors](../adr/0017-multi-quarter-selectors.md). The `MultiSelect` widget is reused for the Members popover.
- [ADR-0018 — Tab-based results layout](../adr/0018-tab-based-results-layout.md). The Groups tab is the fifth result tab, pre-rendered per Run, sharing the existing tab-bar / tab-panel skeleton.
- [ADR-0020 — Team Projections cross-quarter view](../adr/0020-team-projections-cross-quarter-view.md). The **Quick projection Monte Carlo** now reads `groupsStore.find(g => g.isProjection)?.members` instead of the hardcoded MSC bucket.
- [ADR-0021 — Sensible / Quirky CSV format dual support](../adr/0021-sensible-csv-format-dual-support.md). Both formats continue to load; the cascade preserves `moscow` and `emoji` legacy header names.
- [ADR-0022 — Optional Key Result column](../adr/0022-optional-key-result-column.md). The KR column is unchanged; the new Category column does not displace it.
- [ADR-0023 — Constant Work CSV deterministic shift](../adr/0023-constant-work-csv-deterministic-shift.md). Zero-member or no-match Groups fall back to `cwEffort`; the **(Blank) sentinel** sentinel pathway through `getConstantWorkEpics` follows the same `category → moscow → emoji` cascade as the Initiatives CSV but inline-coded.
- [ADR-0025 — Per-context Marker system](../adr/0025-per-context-marker-system.md). The Marker store keys (`'org'`, `'team-{idx}'`) are unchanged; Group selection is orthogonal to marker context. The `COLOR_PALETTE` (80 swatches) is reused for the Group Color cell.
- [ADR-0027 — Editable Initiatives tab with `editedInitiatives` as source of truth](../adr/0027-editable-initiatives-tab-with-csv-export.md). The commit-on-Run discipline is the same pattern; the Initiatives-tab category cell becomes an `<input list>` datalist combo seeded from `getUniqueColumnValues(parsedInitiatives)`.
- [ADR-0028 — Category as generalized MoSCoW with backward-compat header cascade](../adr/0028-category-as-generalized-moscow.md). Phase 1's contract.
- [ADR-0029 — User-defined Groups supersede the cumulative MoSCoW three-scenario forecasting](../adr/0029-user-defined-groups-supersede-cumulative-moscow.md). Phase 1's engine contract + Phase 2's tab contract.
- [ADR-0030 — JSON persistence for Groups via user-driven `groups.json` save / load](../adr/0030-json-persistence-for-groups.md). Phase 3's contract.
- [ADR-0010 — Three-scenario MoSCoW forecasting](../adr/0010-three-scenario-moscow-forecasting.md) — **superseded** by ADR-0029; retained for historical context only.

Glossary terms used throughout (see [CONTEXT.md](../../CONTEXT.md)): **Initiative**, **Initiatives CSV**, **Constant Work CSV**, **Category**, **(Blank) sentinel**, **Group**, **Projection group**, **Scenario**, **Run**, **Iteration**, **Tab**, **Tab panel**, **Groups tab**, **Initiatives tab**, **Team Projections tab**, **Initiative matrix**, **Effort projection band**, **Column detector**, **Content scan**, **Detection fallback**, **MoSCoW** (now a Category vocabulary, no longer an engine concept), **Sensible format**, **Quirky format**, **Data preview**, **Column-detection debug**, **MultiSelect**, **Marker**, **Marker store**, **Bootstrap pool**, **Poisson λ**, **Quick projection Monte Carlo**, **Groups JSON**.

## User-visible behavior

A user who has loaded an **Initiatives CSV** sees one of three header rotations recognised in the cascade: their CSV's column called `category` (preferred), or `moscow` (legacy MoSCoW Sensible-format), or `emoji` (legacy Quirky-format). The cell values are surfaced verbatim, modulo whitespace trimming and case-folding for *equality*: a CSV with rows `Automation`, `automation`, `Automation ` resolves to one Category named `Automation` (the first-seen casing) with three Initiatives in it. Empty / whitespace cells render in the **Initiative matrix** as `(Blank)` in italic grey; non-empty cells render as a neutral grey label carrying the Category text. No per-Category colour appears anywhere.

A user who has not yet defined any Groups sees a fifth tab — **Groups** (`#tab-groups`) — appear after **Initiatives** in the tab bar. On first load (no JSON yet, no user-defined groups), the simulator has auto-created exactly one Group named `All` whose members are every unique Category present in the loaded CSV including the **(Blank) sentinel**, flagged `isProjection`, with an indigo colour. Pressing **Run Simulation** produces a single chart series, a single column in the org-level stats table labelled `■ All`, and a single per-Group row labelled `All` in the **Data preview**. No more `Must Only / Must + Should / Must + Should + Could` columns or chart series anywhere.

A user who clicks the Groups tab sees a wide table with one editable row per Group and columns `[Name | Color | Members | Projection | Duplicate | Delete]` plus a `+ New group` row at the bottom and a toolbar above the table with `↓ Save groups (JSON)` and `↑ Load groups (JSON)` buttons (Phase 3). The Name cell is a plain `<input>`; the Color cell shows a coloured swatch that on click opens the same 80-colour palette swatch the **Marker dialog** already uses; the Members cell is a horizontal chip strip with `×` per chip plus a `+` button that opens a **MultiSelect** popover listing every observed **Category** plus a `(Blank)` row plus a free-text input for adding categories not yet in the CSV; the Projection cell is a single-select radio enforcing exactly-one `isProjection` across the table; the Duplicate button clones the row with name `<original> (copy)`; the Delete button removes the row (transferring the `isProjection` flag to the next-available row if it had it).

A user who edits a Group sees the row update immediately — the chip strip re-renders, the Name input keeps the new value, the radio toggles — but the chart, stats table, **Data preview** per-Group `K` rows, **Team Projections** sections, and **Effort projection band** values stay reflecting the *previous* Run until the user presses **Run Simulation** again. On pressing Run, the chart re-renders with one dataset per Group in `groupsStore` (each in the Group's colour), the org-level stats table re-renders with one column per Group, the **Data preview** re-renders with one `K` row per Group, every per-team section's stats table re-renders with one column per Group, and the **Effort projection band** in every **Projection section** re-reads the (possibly new) **Projection group**'s members. The active tab resets to `Organization Level`.

A user who has assembled a set of Groups they want to keep clicks `↓ Save groups (JSON)`. A file named `groups.json` downloads immediately, carrying `{ "schemaVersion": 1, "groups": [...] }` with one entry per Group. The **(Blank) sentinel** in any `members` array serialises as the JSON literal `null` — distinct from any user-typed string. Opening the file in a text editor shows readable two-space-indented JSON; the user can hand-edit it safely.

A user who has a saved `groups.json` clicks `↑ Load groups (JSON)`. A file picker opens; the user selects the file. If the current `groupsStore` is non-trivial (more than just the auto-default `All` Group), a confirmation modal interposes warning that the current Groups will be replaced. On confirmation (or on a trivial current store), `groupsStore` is replaced **wholesale** with the loaded set. The loaded Groups land in memory immediately but the chart and stats stay on the previous Run's output until the user presses Run. A file with `schemaVersion > 1` surfaces an inline error `"This file was saved by a newer version of the simulator."` and does not load. A file with a parse error surfaces the raw parse-error string in the same inline-error surface. A file referencing categories absent from the currently-loaded **Initiatives CSV** loads cleanly; those member entries survive verbatim in the Group and silently match zero initiatives at Run time.

A user who has *not* loaded an **Initiatives CSV** can still load a `groups.json` (the Groups tab is gated on `#results-content` visibility, but the load handler does not require a CSV). On the next CSV load, the loaded Groups apply to the new CSV's observed categories — members that match are counted, members that don't are silent-zero.

A user who has more than ~5 Groups sees the chart's overlapping datasets become legibility-noisy and the stats table widen past a comfortable scroll point — this is the soft-cap signal and not enforced; the user can prune Groups to recover legibility.

A legacy MoSCoW user who loads their existing CSV sees the file load cleanly via the `category → moscow → emoji` cascade (their column called `moscow` is the second cascade entry). They see one auto-default Group named `All` with members `[Must, Should, Could, Won't]` (and `(Blank)` if any row is empty). To recover their previous cumulative-three view, they redefine three overlapping Groups manually — `Must`, `Must+Should`, `Must+Should+Could` — and save the set to `groups.json` for reuse on later sessions (Phase 3).

## Scope

### In scope

**Phase 1 — Engine substrate:**
- Renaming `detectMoscowCol` (`index.html:1376`) → `detectCategoryCol` (header-name cascade `category → moscow → emoji`; no **Content scan** branch; returns `string | null`).
- Renaming `normalizeMoscow` (`index.html:1482`) → `normalizeCategory` (`trim + case-fold for comparison, first-seen casing preserved`; empty / whitespace returns `null` — the **(Blank) sentinel**; emojis preserved).
- Renaming `moscowBadge` (`index.html:2530`) → `categoryBadge` (uniform neutral grey; `(Blank)` rendered as italic grey).
- The `getConstantWorkEpics` (`index.html:1668`) category lookup cascade — replacing `normalizeMoscow(r.moscow || '')` (`index.html:1681`) with the same `r.category || r.moscow || r.emoji || ''` cascade followed by `normalizeCategory`.
- A new module-scoped `let groupsStore = []` binding next to `parsedInitiatives` / `editedInitiatives` (`index.html:1496-1497` neighbourhood). On the first successful `loadInitiativesCSV` call that finds `groupsStore.length === 0`, the simulator auto-creates exactly one Group `{ name: 'All', color: '#4f46e5', members: [...everyObservedCategoryIncludingBlank], isProjection: true }`.
- Migration of every downstream consumer of MoSCoW bucketing to read `groupsStore`:
  - `prepareSimulationData` (`index.html:1705-1788`): replace the `moscowGroups = { must, should, could, wont, unknown }` count with a `categoryCounts: Map<categoryStringOrNull, number>` and emit `kPerGroup: number[]` (one value per Group in `groupsStore`, computed as `groupsStore.map(g => sum of categoryCounts for c in g.members)`).
  - `prepareTeamSimulationData` (`index.html:1802-1916`): same migration, team-scoped.
  - `runSimulation` (`index.html:2086-2141`): accept `kPerGroup: number[]` (replacing `kMust / kMustShould / kMustShouldCould`); loop over `groupsStore` returning an array of `{ name, color, sorted, stats, hist }` objects (replacing the three named fields `mustOnly / mustShould / mustShouldCould`).
  - `buildTeamProjections` (`index.html:1917-2070`): replace the MSC `kMustShouldCould`-driven projection with the `isProjection` Group's count; fall back to `(cwEffort, cwEffort, cwEffort)` band when no Projection group exists or its K is zero.
- The org-level chart datasets (`index.html:2250-2278`): replace the three hardcoded datasets with `groupsStore.map(g => ({ label: g.name, data: results.find(r => r.name === g.name).hist.counts, backgroundColor: hexWithAlpha(g.color, 0.5), ... }))`.
- The `#stats-table` header row (`index.html:1003-1008`) and `renderStatsTableInto` (`index.html:2357-2403`) — replace the three hardcoded columns with `groupsStore.map(g => ...)` columns.
- The CSS rules `.col-m`, `.col-ms`, `.col-msc` (`index.html:483-485`, `629-631`) — superseded by per-Group inline colour; the rules are removed.
- The `renderInitiativesTable` (`index.html:3136-3189`) category-cell rendering — for the *detected* category column, replace the `<select>` dropdown with an `<input list="category-options">` datalist combo seeded from `getUniqueColumnValues(parsedInitiatives)[categoryCol]`. The datalist element `<datalist id="category-options">` is emitted inline at the top of the rendered HTML.
- The `markersPlugin` plugin definition (`index.html:2174-2243`) — unchanged in body; the calling site that constructs the chart consumes the new dataset array.
- The `renderPreview` (`index.html:2818`) per-Group K row block — replace the three hardcoded `K_must / K_must+should / K_must+should+could` rows with `groupsStore.map(g => row(g.name, g.color, K))`.
- The **Column-detection debug** panel (`#debug-pre`) — replace any `moscowGroups`-keyed output with the `categoryBreakdown: Record<categoryStringOrBlank, number>` map; the `detectedCols` JSON section automatically picks up the renamed key (`categoryCol` replaces `moscowCol`).
- The `detectedCols` shape (`index.html:1501`) — replace `moscowCol` with `categoryCol`; `detectTeamCol` (`index.html:1416`) is updated to take `categoryColHeader` in place of `moscowColHeader`.
- Every console.log / comment / variable name referencing MoSCoW in non-public contexts (e.g. the `_quarter` comments, the Module 4 header at `index.html:1690-1697`) is updated to use Category vocabulary.

**Phase 2 — Groups tab UI:**
- The fifth tab button `<button class="tab-btn" data-tab="groups">Groups</button>` slotted after `<button class="tab-btn" data-tab="initiatives">Initiatives</button>` (`index.html:986`).
- The fifth tab panel `<div id="tab-groups" class="tab-panel" style="display:none"><div id="groups-table-wrap"></div></div>` slotted after the Initiatives tab panel (`index.html:1027-1029`).
- The CSS rules for `#groups-table-wrap`, `#groups-table-wrap table`, `#groups-table-wrap th`, `#groups-table-wrap td`, `#groups-table-wrap input`, `.group-chip`, `.group-chip-remove`, `.group-add-chip-btn`, `.group-color-swatch`, `.groups-toolbar` — slotted after the existing `#initiatives-table-wrap` rules (`index.html:539-548` neighbourhood).
- A `renderGroupsTab()` function modelled on `renderInitiativesTable` (`index.html:3136-3189`): reads `groupsStore` and writes a `<table>` into `#groups-table-wrap`. Per row, six cells:
  - **Name** — `<input type="text" value="…" onchange="groupsStore[idx].name = this.value">`.
  - **Color** — a clickable `<span class="group-color-swatch" style="background:…">` that on click opens the same 80-colour palette (`COLOR_PALETTE`, `index.html:2955`) overlay the **Marker dialog** uses; on swatch-click the new colour is written to `groupsStore[idx].color`.
  - **Members** — a horizontal chip strip with one `<span class="group-chip" style="background:lightgrey">…<button class="group-chip-remove">×</button></span>` per member (the `(Blank)` sentinel renders as `(Blank)` in italic grey), followed by a `+` button (`<button class="group-add-chip-btn">+</button>`) that opens a **MultiSelect**-style popover listing every observed **Category** in `editedInitiatives` plus a `(Blank)` row plus a free-text input for adding categories not yet in the CSV.
  - **Projection** — a `<input type="radio" name="proj-group" checked={isProjection}>` that on change sets `groupsStore[idx].isProjection = true` and clears every other row's flag.
  - **Duplicate** — a `<button>` that pushes a clone with name `<original> (copy)` and re-renders the table.
  - **Delete** — a `<button>` that splices the row from `groupsStore` and, if the deleted row had `isProjection`, sets the first remaining row's `isProjection = true`.
- A `+ New group` row at the bottom: clicking pushes `{ name: '', color: COLOR_PALETTE[groupsStore.length % COLOR_PALETTE.length], members: [], isProjection: groupsStore.length === 0 }` and re-renders.
- The single render call inside the run-button handler, slotted right after `renderInitiativesTable()` (`index.html:3362`).
- The tab-switch handler (`index.html:3276-3290`) is generic and requires no modification — it iterates `document.querySelectorAll('.tab-btn')` and `data-tab` mapping.

**Phase 3 — JSON save/load:**
- Two toolbar buttons inside the Groups tab's `.groups-toolbar`: `<button class="add-marker-btn" onclick="saveGroupsJSON()">↓ Save groups (JSON)</button>` and `<button class="add-marker-btn" onclick="triggerLoadGroupsJSON()">↑ Load groups (JSON)</button>`.
- A hidden `<input type="file" accept=".json" id="groups-json-input">` adjacent to the buttons, with an `onchange` handler that reads the file and calls the load function.
- `saveGroupsJSON()` — serialises `{ schemaVersion: 1, groups: groupsStore.map(g => ({ name: g.name, color: g.color, members: g.members, isProjection: g.isProjection })) }` via `JSON.stringify(..., null, 2)` (the **(Blank) sentinel** is JavaScript `null` and serialises as the JSON literal `null` with no special mapping), wraps in a `Blob`, downloads as `groups.json` using the `URL.createObjectURL` + anchor-click pattern from `saveMarkersToCSV` (`index.html:3204` neighbourhood).
- `loadGroupsJSON(text)` — parses, validates the wrapper shape and `schemaVersion`, replaces `groupsStore` wholesale. Version policy: `schemaVersion === 1` parses known fields and silently ignores unknown; `schemaVersion > 1` surfaces an inline error `"This file was saved by a newer version of the simulator."` and does not load; missing `schemaVersion` is treated as `1`. Parse errors surface the raw error string.
- A confirmation modal (`#groups-load-confirm-overlay`) interposes the wholesale-replace if `groupsStore` is non-trivial (more than just an auto-default `All` Group — detected by `groupsStore.length > 1 || (groupsStore.length === 1 && groupsStore[0].name !== 'All')`).
- An inline error surface (`#groups-load-error`) styled like the existing `#csv-error`-style red banner, mounted inside `#tab-groups` above the table.

### Out of scope

- **MoSCoW auto-detection on first load.** The user explicitly overrode the "auto-create 3 classic MoSCoW Groups for MoSCoW data" recommendation. The default is one Group named `All` with all observed categories including the **(Blank) sentinel**. Legacy MoSCoW users recreate their three overlapping Groups manually (or via Phase 3 JSON).
- **Per-Category colour.** Categories carry no colour. Colour lives on the **Group** that contains the Category. Per ADR-0028.
- **Hard cap on the number of Groups.** A soft cap of ~5 is the design intent (above it the overlapping-datasets chart and N-column stats table degrade visually); there is no enforcement. Per ADR-0029.
- **Stripping emojis from Category values during normalisation.** The legacy `normalizeMoscow` strip-non-ASCII step is *not* carried into `normalizeCategory`. A user who deliberately types `📊 Analytics` as a Category gets a Category named exactly `📊 Analytics`. Per ADR-0028.
- **Persisting Markers, sidebar inputs (capacity, iterations, parameter mode), or `editedInitiatives` via the Groups JSON path.** Each artefact persists independently — Markers via the per-context **Marker CSV** ([ADR-0025](../adr/0025-per-context-marker-system.md)), editable initiatives via `initiatives-edited.csv` ([ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md)). Per ADR-0030.
- **Live re-running on Group edits.** Edits commit to `groupsStore` immediately but charts and stats wait for the next **Run Simulation** press — same commit-on-Run discipline as [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md). Per ADR-0029.
- **Additive-merge JSON load.** Load is wholesale-replace only. Users who want to combine two Group sets do so by loading one, manually adding the others, and saving the union. Per ADR-0030.
- **`localStorage` persistence of `groupsStore`.** All Group persistence is via the explicit user-driven `groups.json` save/load only. Per ADR-0002 / ADR-0030.
- **Multiple `isProjection` Groups.** Exactly one Group at any time has `isProjection === true` — enforced by the UI's single-select radio. Per ADR-0029.
- **Nested-by-construction or cumulative-by-construction Groups.** Groups are flat and independent. Overlap is the mechanism for recovering cumulative semantics. Per ADR-0029.
- **A "Reset to default `All` Group" button.** The auto-default fires only on first CSV load when `groupsStore.length === 0`; recreating it manually requires deleting every Group first. Listed as a possible future revision in ADR-0029.
- **Drag-drop reorder of Groups.** Groups render in `groupsStore` order, which is insertion order. Reordering is a possible additive future revision per ADR-0029.
- **Per-Group `description: string` field.** Possible additive future revision per ADR-0029.
- **A column-chooser UI on the Groups tab.** The six columns (`Name | Color | Members | Projection | Duplicate | Delete`) are fixed.
- **A pre-CSV "draft mode" load UX.** The Groups tab is gated on `#results-content` visibility (which appears post-Run); the Phase 3 load handler is reachable any time after a Run. A user who wants to define Groups against a CSV they haven't loaded yet edits `groups.json` by hand and uses the load path. Per ADR-0029 / ADR-0030.
- **Auto-numeric column carve-out on the Groups tab.** None of the Group columns are numeric; the Initiatives-tab `numericCols` set is unchanged and unrelated.
- **The MoSCoW-specific bucket variable name `moscowGroups`.** It is renamed to `categoryCounts` (or equivalent — see the *Existing patterns to follow* section for the rule about engine vocabulary).
- **Any UI surfacing of `Won't` / `unknown` as engine-special values.** Post-Phase-1 the engine treats every Category as a string addressable by Group `members`; there are no hardcoded exclusions.
- **Changes to `editedInitiatives` Initiatives-tab editing affordances *except* the category cell.** The category cell becomes a datalist combo per ADR-0028; every other cell's affordance is unchanged.

## Relevant existing files

Claude may inspect:
- `index.html`, specifically:
  - The MoSCoW detector (`detectMoscowCol`, `index.html:1376-1414` neighbourhood) — rewrite as header-name cascade.
  - The MoSCoW normaliser (`normalizeMoscow`, `index.html:1482-1494` neighbourhood) — rewrite per ADR-0028.
  - The MoSCoW badge (`moscowBadge`, `index.html:2530-2533`) — rewrite as neutral.
  - The MoSCoW bucketing inside `prepareSimulationData` (`index.html:1705-1788`) — replace with per-Group K.
  - The MoSCoW bucketing inside `prepareTeamSimulationData` (`index.html:1802-1916`) — same.
  - The MoSCoW bucketing inside `buildTeamProjections` (`index.html:1917-2070`) — same.
  - The hardcoded three-scenario `runSimulation` (`index.html:2086-2141`) — rewrite to loop over Groups.
  - The hardcoded three-dataset chart in `renderChartOnCanvas` (`index.html:2159-2350` neighbourhood; the `datasets:[]` literal at `2250-2278`) — replace with dynamic N datasets.
  - The hardcoded three-column `#stats-table` (`index.html:1001-1011`) — make header dynamic.
  - The hardcoded three-column `renderStatsTableInto` (`index.html:2357-2403`) — make body dynamic.
  - The hardcoded `.col-m / .col-ms / .col-msc` CSS rules (`index.html:483-485, 629-631`) — remove.
  - The constant-work category lookup in `getConstantWorkEpics` (`index.html:1681`) — cascade.
  - The `detectedCols` field shape (`index.html:1501, 1507-1513`) — rename `moscowCol → categoryCol`.
  - `detectTeamCol`'s parameter (`index.html:1416`) — rename the parameter.
  - The Initiatives-tab category cell branch in `renderInitiativesTable` (`index.html:3172-3182`) — replace `<select>` with `<input list>` datalist combo for the detected category column only.
  - The auto-default-Group creation point inside `loadInitiativesCSV` (`index.html:1503-1516` neighbourhood) — add the `if (groupsStore.length === 0) groupsStore = [...]` step.
  - The `renderPreview` per-Group K block (`index.html:2818` neighbourhood).
  - The `#debug-pre` write site (the `tryUpdatePreview` neighbourhood, `index.html:2873` and onwards) — surface `categoryBreakdown` instead of `moscowGroups`.
  - The tab bar (`index.html:982-987`) and the existing four tab panels (`index.html:990-1029`) — for layout context only.
  - The tab-switch handler (`index.html:3275-3291`) — unchanged but referenced.
  - The `renderInitiativesTable` whole-function (`index.html:3136-3189`) — for shape reference when writing `renderGroupsTab`.
  - The `exportInitiativesCSV` whole-function (`index.html:3191-3201`) — for blob/anchor pattern reference when writing `saveGroupsJSON`.
  - The `MultiSelect` class (`index.html:1083-1143`) — reused for the Members popover. Read the class shape to understand how to instantiate.
  - The `COLOR_PALETTE` (`index.html:2955-2972`) and the Marker dialog's palette rendering (`index.html:3020-3039` and onwards) — reused for the Color cell.
  - `openMarkerDialog` and `saveMarkersToCSV` (`index.html:3020-3039`, `3204-3219` neighbourhoods) — reference patterns for the confirmation modal (Phase 3) and the save-blob/anchor (Phase 3).
  - The `<datalist>` pattern in the Initiatives-tab category cell (after Phase 1) — reference for any future datalist needs.
  - The `escapeHtml` / `escapeAttr` helpers (`index.html:3112-3122`) — every render path uses both.
  - The `loadMarkersFromCSV` change-handler pattern (`index.html:3231-3265`) — reference for the JSON load (Phase 3) confirmation + parse-error surface.
  - The `parsedConstantWork` lifecycle — reference for the `groupsStore` lifecycle (lives across CSV reloads; reset only on explicit user action).
  - The run-button handler's render sequence (`index.html:3340-3375`) — for the Groups-render and Groups-stats insertion point.

- `CONTEXT.md` glossary — the entries listed in the *Context* section above.

- `docs/adr/0028-category-as-generalized-moscow.md`, `docs/adr/0029-user-defined-groups-supersede-cumulative-moscow.md`, `docs/adr/0030-json-persistence-for-groups.md` — the design rationale this plan implements.

- `docs/adr/0010-three-scenario-moscow-forecasting.md` (header-superseded) — for the prior contract being retired.

- `docs/plans/0019-editable-initiatives-tab.md` — the prior plan, *not* for behavior but for plan-document shape and the **Initiatives tab** integration touchpoints this feature extends.

Claude should not inspect unless needed:
- The Monte Carlo engine internals (`runScenario`, `tshirtToPersonMonths`, `sampleLognormal`, `Xoshiro128ss`).
- The CSV parsing helpers (`parseCSV`, PapaParse usage).
- The chart's marker plugin internals beyond the dataset list.
- The lognormal parameter mode toggle code (ADR-0026 territory).
- The **Constant Work CSV** body parsing (only the category cascade line at `index.html:1681` is in scope).
- The empirical-parameters surface and the T-shirt size reference panel.

## Existing patterns to follow

- **One-file layering inside `index.html`.** Every change lands inline. The data model lives in Module 4 next to `parsedInitiatives` (`index.html:1496` neighbourhood). The detector / normaliser / badge functions live where their predecessors live. The Groups-tab render and the JSON save/load helpers live in a new sub-module after the Initiatives-tab Module 7, before the marker system. CSS goes in the Module 1 `<style>` block. No new file is created.
- **No build step, no library beyond Chart.js + PapaParse.** All save/load is `JSON.stringify`, `JSON.parse`, `Blob`, `FileReader.readAsText`, `URL.createObjectURL`, anchor-click. No JSON-schema validator, no immer, no MobX, no React.
- **String values everywhere in `editedInitiatives`.** The category field on an Initiative is the *normalised* category — a string or `null` (the **(Blank) sentinel**). Engine code reads `row[detectedCols.categoryCol]` and pipes it through `normalizeCategory` at the point of bucketing.
- **First-seen casing dedup** for Category strings, matching the existing team-name dedup convention in `prepareTeamSimulationData` (`index.html:1802` neighbourhood) — a per-call transient `Map<lowercased, firstSeenCasing>` that the bucketing loop consults. Two Category values that differ only in case map to one canonical bucket.
- **`null` as the (Blank) sentinel in JS memory.** Module-scoped `const BLANK = null;` for readability. `members.includes(BLANK)` is the membership test. Engine and JSON layers use the same value — no `(Blank) ↔ null` mapping function is needed because the in-memory and on-disk representations are already identical.
- **Module-scoped `let groupsStore = []`** declared next to `parsedInitiatives` and `editedInitiatives`. Mutated in place by the Groups-tab inline edit handlers (Phase 2), the JSON load handler (Phase 3), and the auto-default-Group creation in `loadInitiativesCSV` (Phase 1). Never deep-cloned; the array's identity is stable across reads.
- **Auto-default Group on first CSV load.** Inside `loadInitiativesCSV`, immediately after the `detectedCols` are computed and `editedInitiatives` is cloned, the check `if (groupsStore.length === 0) groupsStore = [{ name: 'All', color: '#4f46e5', members: uniqueCategoriesInLoadedCsv, isProjection: true }]` fires. The auto-default does *not* fire on subsequent CSV loads (the previous Groups survive); the user can recover the auto-default by deleting every Group manually.
- **Engine reads from `editedInitiatives`, dropdowns read from `parsedInitiatives`** (the existing ADR-0027 rule). The Members popover (Phase 2) sources observable categories from `editedInitiatives` so the user can target the *current* edited state of the Initiatives tab; this is a deliberate departure from the Initiatives-tab dropdown which sources from `parsedInitiatives` for stable option pools. The Members popover allows free-text addition, so the *current vs. immutable* distinction is less load-bearing — but the popover's "observed Categories" list is computed at popover-open time, not at render time.
- **Commit-on-Run** discipline (ADR-0027, ADR-0029): edits commit to `groupsStore` immediately, but the chart, stats table, **Data preview** per-Group K rows, and **Team Projections** sections do not update until the user presses Run.
- **Inline `onchange` / `onclick` handlers writing directly to `groupsStore[idx][field] = this.value`** — no delegated event listener, no virtual-DOM diff, no per-cell controller object. The Initiatives-tab pattern from feature 0019 is the template.
- **Single-`innerHTML`-assignment render**: `renderGroupsTab` builds the entire table as a string and assigns to `#groups-table-wrap.innerHTML` in one write. No incremental DOM updates. Re-rendering is cheap (≤5 Groups in practice).
- **Render-once-per-Run, not lazy on tab activation.** `renderGroupsTab` is called inside the run-button handler immediately after `renderInitiativesTable` (`index.html:3362`).
- **Cell content always goes through `escapeHtml` (text) or `escapeAttr` (attribute values).** No unescaped user-supplied strings reach the DOM.
- **Verification command**: manual. Open `index.html`, load CSVs, press Run, exercise the new surfaces (Groups tab, Save / Load JSON, datalist combo on the Initiatives-tab category cell, neutral category badges on the Team Projections matrix), observe DevTools state where applicable.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.
> The single exception is the historical engine variable name `moscowGroups`
> (the per-MoSCoW-bucket count map inside `prepareSimulationData` and
> `prepareTeamSimulationData`) — that name is *being removed* by this plan in
> favour of `categoryCounts` or equivalent. Use the glossary names
> **Category**, **Group**, **(Blank) sentinel**, **Projection group**,
> **Scenario**, **Run** throughout.

## Data models

No persistence layer beyond the Phase 3 `groups.json` file (a user-driven artefact, not application-managed).

In-memory state owned by this feature:

```js
// Module 4 — Data Cache.

const BLANK = null;                        // The (Blank) sentinel — used in `members` arrays
                                           //   and as the return value of `normalizeCategory`
                                           //   for empty / whitespace cells. JS `null` matches
                                           //   the JSON `null` literal exactly — no mapping needed.

let parsedInitiatives = null;              // existing — immutable parse output (ADR-0027).
let editedInitiatives = null;              // existing — per-row clone, simulation source of truth.
let parsedEpics       = null;              // existing.

let detectedCols      = null;              // existing — shape changes: { initKeyCol, categoryCol, … }.
                                           //   `categoryCol` replaces `moscowCol`. May be `null`
                                           //   when no `category` / `moscow` / `emoji` header
                                           //   exists in the CSV (in that case every initiative's
                                           //   category resolves to BLANK).

let groupsStore       = [];                // ← NEW: ordered array of Group records.

// Per-Group shape (the Group entry):
// {
//   name: string,                          // user-editable; may be empty or duplicate (lenient validation).
//   color: string,                         // CSS-hex (e.g. '#4f46e5'); chosen from COLOR_PALETTE.
//   members: (string | null)[],            // category strings (with first-seen casing) and/or BLANK.
//   isProjection: boolean,                 // exactly one Group has isProjection === true at any time
//                                           //   (UI-enforced via single-select radio).
// }
```

CSV cell normalisation:

```js
// Module 3 — CSV Parsing / Detection.

function normalizeCategory(raw) {
  // raw: string from the category-column cell, or undefined/null.
  // Returns: BLANK for empty / whitespace; otherwise the trimmed string with
  // first-seen casing preserved (consulting a transient per-batch map).
  //
  // Comparison semantics: trim + case-fold; display: first-seen casing.
  // Emojis are preserved (the legacy normalizeMoscow strip-non-ASCII step
  // is dropped; see ADR-0028).
}

function detectCategoryCol(rows) {
  // Returns: string (the header name) or null (no header matched).
  // Strategy: pure header-name cascade `category → moscow → emoji`.
  // No Content scan branch (legacy regex match retired per ADR-0028).
}

function categoryBadge(cat) {
  // cat: string or BLANK.
  // Returns: HTML for a uniform neutral grey label carrying the Category text,
  // or italic-grey `(Blank)` when cat === BLANK. No per-Category colour.
}
```

JSON persistence (Phase 3 only):

```js
// On-disk shape:
// {
//   "schemaVersion": 1,
//   "groups": [
//     {
//       "name":         "Must",
//       "color":        "#ea7c2c",
//       "members":      ["Must"],          // (string | null)[] — null for the (Blank) sentinel.
//       "isProjection": false
//     },
//     {
//       "name":         "Must + Should",
//       "color":        "#4f46e5",
//       "members":      ["Must", "Should", null],
//       "isProjection": true
//     }
//   ]
// }
```

Engine output shape change (one entry per Group, replacing the three named fields):

```js
// runSimulation returns:
// {
//   results: [
//     { name: 'All', color: '#4f46e5', sorted: Float64Array, stats: { p10, p25, …, pExceed }, hist: { counts, binCenters, binWidth } },
//     …                                  // one per Group in groupsStore
//   ],
//   globalMin: number,
//   globalMax: number,
//   fixedEffort: number,
// }
```

No new module file, no new class, no new event bus. The state is three new bindings (`BLANK`, `groupsStore`) plus the rename of `detectedCols.moscowCol` → `detectedCols.categoryCol`.

---

## Phase 1: Engine substrate — Category cascade, `groupsStore` with auto-default `All` Group, engine readers and rendering loop over Groups

### Acceptance behavior

Scenario AT-1: Loading an **Initiatives CSV** with a `category` header detects it via the first cascade entry
Given an **Initiatives CSV** has headers `jira_key`, `name`, `category`, `teams`, `quarter`
When `loadInitiativesCSV(text)` runs
Then `detectedCols.categoryCol === 'category'`
And the **Column-detection debug** JSON shows `"categoryCol": "category"`

Scenario AT-2: Loading a legacy MoSCoW **Sensible-format** CSV detects the `moscow` header as the second cascade entry
Given an **Initiatives CSV** has headers `jira_key`, `building_block`, `moscow`, `teams`, `quarter` (no `category` header)
When `loadInitiativesCSV(text)` runs
Then `detectedCols.categoryCol === 'moscow'`

Scenario AT-3: Loading a legacy **Quirky-format** CSV detects the `emoji` header as the third cascade entry
Given an **Initiatives CSV** has the **Quirky format** layout where `emoji` carries MoSCoW values (no `category`, no `moscow` header)
When `loadInitiativesCSV(text)` runs
Then `detectedCols.categoryCol === 'emoji'`

Scenario AT-4: An **Initiatives CSV** with none of `category` / `moscow` / `emoji` headers yields `categoryCol === null`
Given an **Initiatives CSV** has no `category` / `moscow` / `emoji` header
When `loadInitiativesCSV(text)` runs
Then `detectedCols.categoryCol === null`
And every Initiative's effective category is the **(Blank) sentinel**

Scenario AT-5: `normalizeCategory` trims whitespace and folds case for equality but preserves first-seen casing for display
Given the CSV has Category values `Automation`, `automation`, `Automation ` across three rows
When `prepareSimulationData` runs
Then the three rows are bucketed under the same canonical Category string `Automation` (the first-seen casing)
And the **Column-detection debug**'s `categoryBreakdown` shows `{ "Automation": 3, … }` (one entry, count 3)

Scenario AT-6: `normalizeCategory` resolves empty / whitespace-only cells to the **(Blank) sentinel**
Given an Initiative's category cell is `''`, `'   '`, or absent
When the value is normalised
Then the result is `BLANK` (the JavaScript `null` value)
And the **Initiative matrix** renders the badge as `(Blank)` in italic grey

Scenario AT-7: `normalizeCategory` preserves emoji characters in Category values
Given an Initiative's category cell is `📊 Analytics`
When the value is normalised
Then the result is `📊 Analytics` (verbatim, modulo trim)
And the **Column-detection debug**'s `categoryBreakdown` includes the literal `"📊 Analytics"` key
And the **(Blank) sentinel** logic is unaffected

Scenario AT-8: The first load of a CSV (with `groupsStore.length === 0`) auto-creates one Group named `All`
Given `groupsStore === []` at module init
And no `groups.json` has been loaded (Phase 3 path)
When `loadInitiativesCSV(text)` completes successfully
Then `groupsStore.length === 1`
And `groupsStore[0].name === 'All'`
And `groupsStore[0].color === '#4f46e5'`
And `groupsStore[0].isProjection === true`
And `groupsStore[0].members` is exactly the set of distinct Categories observed in `editedInitiatives` (including `BLANK` if any row's category resolves to `BLANK`)

Scenario AT-9: A subsequent CSV load with a non-empty `groupsStore` does *not* overwrite the existing Groups
Given `groupsStore` has user-defined Groups (e.g. `[ { name: 'KR1' }, { name: 'KR2' } ]`)
When the user uploads a different **Initiatives CSV**
Then `groupsStore` remains the user's two Groups (the auto-default `All` is *not* re-created)
And Categories present in the new CSV but absent from any Group's `members` array are silently excluded from every **Scenario** at next Run

Scenario AT-10: `prepareSimulationData` returns `kPerGroup: number[]` of length `groupsStore.length`
Given `groupsStore` has three Groups `A`, `B`, `C` with members `[Must]`, `[Should]`, `[Could]`
And the **Target quarter** has `editedInitiatives` rows categorised `Must`, `Must`, `Should`, `Could`, `Could`, `Could`, `Won't`
When `prepareSimulationData(histQs, targetQs)` runs
Then the returned `kPerGroup === [2, 1, 3]` (one count per Group, in `groupsStore` order)
And the `Won't` row is excluded (no Group has `Won't` in `members`)

Scenario AT-11: `runSimulation` produces one `{ name, color, sorted, stats, hist }` entry per Group
Given `groupsStore` has two Groups `Must` and `All`
And the run inputs include `kPerGroup: [3, 7]`
When `runSimulation(...)` returns
Then the returned `results` array has length 2
And `results[0].name === 'Must'`, `results[1].name === 'All'`
And each entry carries its Group's `color` and a `sorted`, `stats`, `hist` populated by the engine
And both entries' `hist.binCenters` are equal (shared **Global histogram range**)

Scenario AT-12: A Group with zero `members` (or whose members match no Initiatives) yields an all-zero distribution shifted by `fixedEffort`
Given `groupsStore` has a Group `Empty` with `members: []`
And `fixedEffort === 5`
When `runSimulation(...)` returns
Then `results.find(r => r.name === 'Empty').sorted` is a `Float64Array` of length `iterations`, all values `=== 5`
And `results.find(r => r.name === 'Empty').stats.p50 === 5`

Scenario AT-13: The org-level chart renders one dataset per Group in `groupsStore` order, each in its Group's colour
Given `groupsStore` has two Groups `Must` (colour `#ea7c2c`) and `All` (colour `#4f46e5`)
When the user presses Run
Then the chart at `#results-chart` has exactly two datasets
And dataset 0 has `label === 'Must'` and `backgroundColor` derived from `#ea7c2c`
And dataset 1 has `label === 'All'` and `backgroundColor` derived from `#4f46e5`
And no dataset is named `Must Only`, `Must + Should`, or `Must + Should + Could`

Scenario AT-14: The org-level stats table renders one column per Group
Given `groupsStore` has three Groups `Must`, `Must+Should`, `All`
When the user presses Run
Then `#stats-table thead` has 4 `<th>` elements: `Metric`, then one per Group in `groupsStore` order
And the column headers carry the Group's `name` prefixed by `■` in the Group's `color`
And the body rows (P10, P25, Median (P50), P75, P90, Mean, `P(effort > <cap> PM)`) have 4 cells each
And no header reads `Must Only`, `Must + Should`, or `Must + Should + Could`

Scenario AT-15: The legacy CSS classes `.col-m`, `.col-ms`, `.col-msc` are removed
When inspecting the loaded stylesheet
Then no rule selector references `.col-m`, `.col-ms`, or `.col-msc`
(They are superseded by per-Group inline `color: <g.color>` on the `<th>` element.)

Scenario AT-16: The **Data preview** surfaces one per-Group K row
Given the user has loaded both CSVs and selected at least one Historical and Target quarter
And `groupsStore` has two Groups `A` (members `[Must, Should]`) and `B` (members `[Could]`)
And the **Target quarter** has 3 `Must`, 2 `Should`, 4 `Could` Initiatives
When `tryUpdatePreview` runs
Then the **Data preview** shows two K rows: one for `A` reading `K = 5` and one for `B` reading `K = 4`
And each row's name label carries the Group's colour
And no row labels `K_must`, `K_must+should`, or `K_must+should+could` are present

Scenario AT-17: The **Initiative matrix** renders neutral grey category badges, not red/orange/green per-MoSCoW
Given the **Target quarter** has Initiatives categorised `Must`, `Should`, `Could`, `Won't`
When the **Team Projections tab** renders
Then every row's Category badge has the same neutral grey background and no class-specific colour (`mb-must`, `mb-should`, `mb-could`, `mb-wont`, `mb-unknown` are not applied)
And the badge text is the *Category* string verbatim (no abbreviation)

Scenario AT-18: An empty-category Initiative renders as `(Blank)` in italic grey in the Initiative matrix
Given an Initiative has an empty `category` cell
When the **Team Projections tab** renders
Then that Initiative's badge reads `(Blank)` (literal, with parentheses) in italic grey

Scenario AT-19: The Initiatives tab's category cell is an `<input list>` datalist combo
Given the user has loaded an **Initiatives CSV** with a `category` column
And the user is on the **Initiatives tab**
When `renderInitiativesTable()` runs
Then every row's category cell is `<td><input list="category-options" value="<current>" onchange="editedInitiatives[<idx>]['<col>'] = this.value"></td>`
And exactly one `<datalist id="category-options">` element is present in the rendered HTML
And the datalist's options are the unique observed Category strings sorted alphabetically (case-insensitive)
And the (Blank) sentinel is *not* listed as an option (empty values are entered by clearing the input)

Scenario AT-20: Typing a new Category value into the datalist combo writes the raw typed string to `editedInitiatives[rowIdx].category`
Given the user is on the Initiatives tab
And the user types `Project ABC` into a row's category input (a value not yet in the CSV)
Then `editedInitiatives[rowIdx][detectedCols.categoryCol] === 'Project ABC'` after the `onchange` fires
And the next Run's `normalizeCategory` produces `Project ABC` as the canonical Category (first-seen casing)
And the **Column-detection debug**'s `categoryBreakdown` includes `Project ABC` with the appropriate count

Scenario AT-21: The **Constant Work CSV** category lookup follows the same `category → moscow → emoji` cascade
Given a **Constant Work CSV** row carries `category: KR1` (and no `moscow` / `emoji` column)
And the row's team and quarter match a **Projection section**
When the **Team Projections tab** renders that section's **Initiative matrix**
Then the constant-work row's badge reads `KR1` (the raw category value)

Scenario AT-22: The auto-default `All` Group's `members` include the **(Blank) sentinel** when any Initiative has an empty Category
Given an **Initiatives CSV** has rows with Categories `Must`, `(empty)`, `Could`
And no prior `groupsStore` exists
When `loadInitiativesCSV` completes
Then `groupsStore[0].members` contains exactly `['Must', 'Could', BLANK]` (in some stable order, the (Blank) sentinel last per the **Initiative matrix** sort convention)

Scenario AT-23: The auto-default `All` Group's first Run produces a single Scenario covering every Initiative in the Target quarter
Given the auto-default `All` Group exists with all observed Categories as members
And the **Target quarter** has 10 Initiatives across mixed Categories
When the user presses Run
Then `results[0].name === 'All'`
And `kPerGroup[0] === 10` (every Initiative counted)
And the chart has one dataset, the stats table has one Group-column

Scenario AT-24: Buckets that no Group references contribute zero to every Scenario's `K`
Given `groupsStore` has one Group `Critical` with `members: ['Must']`
And the **Target quarter** has 3 `Must` and 7 `Should` Initiatives
When `prepareSimulationData` runs
Then `kPerGroup === [3]`
And the 7 `Should` Initiatives do not influence any Scenario

Scenario AT-25: The **Team Level tab** sections render one column per Group in `groupsStore`
Given `groupsStore` has Groups `A`, `B`
And the user is on the **Team Level tab**
When the team sections render
Then each team's `team-stats-table` has 3 `<th>` (Metric + A + B) with the Group colours applied inline
And each team's chart has 2 datasets matching the Group set

Scenario AT-26: `buildTeamProjections` reads the **Projection group** for the per-(team, quarter) **Effort projection band**
Given `groupsStore` has Groups `A` (isProjection: true), `B`
And the user presses Run
When the **Team Projections tab** renders
Then every **Projection section**'s **Effort projection band** is computed against `A`'s `members` (not against MSC, not against all Groups)

Scenario AT-27: An empty `groupsStore` (no Groups at all) yields a `cwEffort`-only flat band in every **Projection section**
Given no Initiatives CSV is loaded *or* every Group has been deleted
When the user presses Run (with at least one Constant Work CSV row)
Then every **Effort projection band** is the triple `(cwEffort, cwEffort, cwEffort)` (the constant-work-only fallback per ADR-0023)

Scenario AT-28: A categorised row whose Category appears in *multiple* Groups counts in *each* Group's K (overlap)
Given `groupsStore` has Groups `A` (members `[Must, Should]`) and `B` (members `[Should, Could]`)
And the **Target quarter** has one Initiative with category `Should`
When `prepareSimulationData` runs
Then `kPerGroup[0] === 1` *and* `kPerGroup[1] === 1` (the row is counted in both Groups; overlap is by-design)

Scenario AT-29: An **Initiatives CSV** reload (replace) recomputes the auto-default Group's members from the new CSV (only if `groupsStore` was empty pre-load)
Given the auto-default `All` Group was created on the first CSV load
And the user removes the file (`resetInitiativesFile`) then loads a different CSV
Then since `groupsStore` is not empty on the second load (the `All` Group still exists), the auto-default does *not* re-create
And the existing `All` Group's `members` are *not* re-synced to the new CSV's categories

Scenario AT-30: `resetInitiativesFile` does *not* reset `groupsStore`
Given Groups have been defined
When the user clicks `✕ Remove file` on the initiatives upload
Then `parsedInitiatives === null`, `editedInitiatives === null`, `detectedCols === null`
And `groupsStore` is unchanged
(Group definitions are user-managed state; CSV reset does not invalidate them.)

### Public entry point

Surfaces visible to the user:
- The Initiatives CSV file picker (unchanged) — a successful load auto-creates the `All` Group on first ever load.
- The Initiatives-tab category cell — the user types or selects a Category via the `<input list>` datalist combo.
- The Run Simulation button — produces N Scenarios where N = `groupsStore.length`.

In-code entry points (new or renamed):
- `detectCategoryCol(rows): string | null` (`index.html:1376` neighbourhood, renamed from `detectMoscowCol`).
- `normalizeCategory(raw): string | null` (`index.html:1482` neighbourhood, renamed from `normalizeMoscow`; the (Blank) sentinel is the JS `null` return).
- `categoryBadge(cat): string` (`index.html:2530` neighbourhood, renamed from `moscowBadge`).
- `prepareSimulationData(histQs, targetQs): { lambda, epicSizingDist, kPerGroup, preview }` (signature change: `kMust / kMustShould / kMustShouldCould` are replaced by `kPerGroup: number[]`).
- `runSimulation({ lambda, epicSizingDist, kPerGroup, capacity, iterations, fixedEffort, groups }): { results: GroupResult[], globalMin, globalMax, fixedEffort }` (signature change: takes `kPerGroup` and `groups` (a snapshot of `groupsStore` at Run time), returns a `results: GroupResult[]` array instead of the three named fields).

UI: no new tab in Phase 1 — the Groups tab is Phase 2. The auto-default Group is created silently inside `loadInitiativesCSV`; the user observes it only via the **Data preview**'s K row and the chart's single dataset.

### Expected observable outcomes

- Any **Initiatives CSV** with a `category`, `moscow`, or `emoji` header loads cleanly.
- A first-load CSV produces exactly one Group `All` and a Run produces exactly one Scenario.
- A subsequent CSV load against an existing `groupsStore` preserves the user's Groups.
- Chart datasets and stats-table columns are dynamic, one per Group, in `groupsStore` order.
- Category badges in the **Initiative matrix** are uniform neutral grey; `(Blank)` is italic grey.
- The Initiatives-tab category cell is a datalist combo (free-text-friendly).
- The legacy MSC three-column headers and CSS classes are gone.
- The **Data preview** lists one per-Group `K` row per Group.
- The **Column-detection debug** shows `categoryCol` and `categoryBreakdown`.
- `buildTeamProjections` reads the **Projection group**'s `members` for the **Effort projection band**.
- `getConstantWorkEpics` resolves its category column via the same cascade.

### Test harness

Acceptance tests:
- Location: **N/A — manual.** This project has no automated test suite.
- Manual steps (each maps to one or more AT scenarios):
  1. Cold-load `index.html`. In DevTools evaluate `groupsStore`; confirm `[]`. Evaluate `BLANK`; confirm `null`. Evaluate `detectedCols`; confirm `null`. (AT-8 baseline.)
  2. Upload a **Sensible-format Initiatives CSV** with a `category` header carrying values `Automation`, `KR1`, `KR2`, and one empty cell. Evaluate `detectedCols.categoryCol === 'category'` (AT-1). Evaluate `groupsStore.length === 1` and `groupsStore[0].name === 'All'` and `groupsStore[0].isProjection === true` (AT-8). Evaluate `groupsStore[0].members` includes `'Automation'`, `'KR1'`, `'KR2'`, and `null` (AT-22).
  3. Reset the file (`✕ Remove file`). Evaluate `parsedInitiatives === null`, `editedInitiatives === null`, `detectedCols === null`. Evaluate `groupsStore` — should *not* be reset (AT-30).
  4. Upload a different CSV (different column shape). Evaluate `groupsStore[0]` — should still be the previous `All` Group, *not* re-synced (AT-9, AT-29).
  5. Cold-load again (refresh page). Upload a legacy **Sensible-format MoSCoW CSV** (header `moscow` but no `category`). Confirm `detectedCols.categoryCol === 'moscow'` (AT-2). Confirm `groupsStore[0].members` contains `'Must'`, `'Should'`, `'Could'`, `'Won't'`.
  6. Cold-load. Upload a **Quirky-format CSV** (header `emoji` with MoSCoW values). Confirm `detectedCols.categoryCol === 'emoji'` (AT-3).
  7. Cold-load. Upload a CSV with *no* `category` / `moscow` / `emoji` header. Confirm `detectedCols.categoryCol === null`. After Run, confirm every Initiative has effective category `BLANK` (AT-4).
  8. Cold-load. Upload a CSV with category values `Automation`, `automation`, `Automation ` across three rows. After Run, open the **Column-detection debug** and confirm `categoryBreakdown` has exactly one key `Automation` with value `3` (AT-5).
  9. Same CSV — confirm `normalizeCategory('')`, `normalizeCategory('   ')`, `normalizeCategory(undefined)` all return `null` (the **(Blank) sentinel**) in DevTools (AT-6).
  10. Cold-load. Upload a CSV with category `📊 Analytics`. Confirm `categoryBreakdown` shows `📊 Analytics` verbatim (AT-7).
  11. Cold-load. Upload a CSV. In DevTools, push two extra Groups into `groupsStore`: `{ name: 'KR1', color: '#ea7c2c', members: ['KR1'], isProjection: false }` and `{ name: 'KR2', color: '#059669', members: ['KR2'], isProjection: false }`. Press Run. Confirm the chart has 3 datasets (`All`, `KR1`, `KR2`) (AT-13). Confirm `#stats-table thead` has 4 `<th>` elements (AT-14). Confirm no CSS `.col-m / .col-ms / .col-msc` rule matches (AT-15).
  12. Same setup — open the **Data preview**; confirm 3 K rows are present, each labelled with the Group name (AT-16).
  13. Cold-load. Upload a CSV with Categories `Must`, `Should`, `Could`, `Won't`. Click the **Team Projections tab**. Inspect badge colour: should be neutral grey on all rows (AT-17). Inspect a `(Blank)`-category row's badge: italic grey reading `(Blank)` (AT-18).
  14. Cold-load. Upload a CSV. Go to **Initiatives tab**. Confirm the category cell is `<input list="category-options" ...>` (AT-19). Type `Project ABC` (a new value); blur; confirm `editedInitiatives[rowIdx][detectedCols.categoryCol] === 'Project ABC'` (AT-20). Press Run; confirm `Project ABC` appears in `categoryBreakdown`.
  15. Cold-load. Upload an **Initiatives CSV**. Upload a **Constant Work CSV** with one row carrying `category: KR1` (and the matching team / quarter). Press Run; on the **Team Projections tab**, find the constant-work row in the matching team's section; confirm the badge reads `KR1` (AT-21).
  16. Cold-load. Upload a CSV. In DevTools, replace `groupsStore` with two Groups `A` (members `['Must', 'Should']`) and `B` (members `['Should', 'Could']`). Confirm one Initiative with category `Should` is counted in *both* `kPerGroup[0]` and `kPerGroup[1]` after Run (AT-28).
  17. With same setup but a Group `C` with `members: []`, evaluate `results.find(r => r.name === 'C').sorted` — should be all `fixedEffort` (or `0` if no constant work) (AT-12).
  18. Cold-load. Upload a CSV. In DevTools, set `groupsStore = []`. Press Run; on the **Team Projections tab**, confirm every band is the flat triple `(cwEffort, cwEffort, cwEffort)` (AT-27).
  19. Cold-load. Upload a CSV. Define two Groups `A` (isProjection: true) and `B`. Press Run. On the **Team Projections tab**, confirm the **Effort projection band** values are computed against `A`'s members only — verify by removing all `A`-Category Initiatives from `editedInitiatives` and pressing Run again; the band should fall back to `(cwEffort, cwEffort, cwEffort)` (AT-26).
  20. Compare a fresh-load CSV's Run output (with the auto-default `All` Group) against an earlier hand-crafted Run with a single overlapping-everything Group; should be numerically identical (within seed determinism) (AT-23).

Inner tests: N/A.

Verification: manual.

### Proposed implementation seams

Stable seams the tests may target:
- Module-scoped `groupsStore: Group[]` binding.
- `detectCategoryCol`, `normalizeCategory`, `categoryBadge` (the renamed Category infrastructure).
- `prepareSimulationData` return shape — `kPerGroup: number[]` parameter and the matching engine input.
- `runSimulation` return shape — `results: GroupResult[]`.
- The auto-default-Group creation inside `loadInitiativesCSV`.

Do NOT lock in:
- The exact storage shape of the `first-seen casing` map inside `normalizeCategory` (transient, per-batch, or module-scoped — implementation choice).
- The exact JS hex-with-alpha helper used to derive `backgroundColor` from `g.color` (any reasonable string concatenation or `#RRGGBB + 88` style is fine).
- The exact `categoryBadge` HTML wrapper class (`.cat-badge`, `.category-badge`, anything consistent).
- The exact storage form of `kPerGroup` (a plain `number[]` is required by the API contract; whether it's pre-allocated to length `groupsStore.length` or pushed-into is implementation choice).
- The exact path of how the auto-default Group's color (`#4f46e5`) is derived (literal, `COLOR_PALETTE[0]`, or wherever — as long as it's a deterministic default).

### Behavioral rule

The simulator's per-Initiative priority axis is the **Category** column — a free-form string detected via a header-name cascade `category → moscow → emoji` (no **Content scan** branch) and normalised by `trim + case-fold for equality, first-seen casing preserved for display`. Empty / whitespace cells normalise to the **(Blank) sentinel** — the JavaScript `null` value, surfaced in the UI as `(Blank)` with parentheses. The simulator's per-Run side-by-side **Scenarios** are determined by `groupsStore: Group[]` — a module-scoped ordered array of `{ name, color, members, isProjection }` entries; each Group's `K = #initiatives in editedInitiatives in the Target quarter whose normalised Category ∈ group.members`. A Run produces one `{ name, color, sorted, stats, hist }` entry per Group; the chart renders one dataset per Group in `groupsStore` order, each in the Group's colour; the stats table renders one column per Group; the **Data preview** lists one `K` row per Group. The **Projection group** — the single Group with `isProjection === true` — drives the per-(team, quarter) **Quick projection Monte Carlo** and every **Effort projection band**. Categories carry no colour; the **Initiative matrix** renders every Category badge as uniform neutral grey (italic grey for `(Blank)`). On the first successful `loadInitiativesCSV` call that finds `groupsStore.length === 0`, the simulator auto-creates exactly one Group `{ name: 'All', color: '#4f46e5', members: <every distinct observed Category including BLANK>, isProjection: true }`; subsequent loads do not overwrite the user's `groupsStore`. The hardcoded three cumulative Scenarios `Must Only / Must + Should / Must + Should + Could` and the `Won't` / `unknown` engine exclusion are removed entirely; inclusion is purely a function of Group membership.

### Invariants

- `BLANK = null` is module-scoped and immutable. No code creates an alternative sentinel.
- `normalizeCategory` returns `BLANK` for *every* empty / whitespace input and returns a non-empty string for every non-empty input (no other sentinel values, no `undefined`, no symbols).
- `groupsStore` is a module-scoped `let`, initially `[]`. It is only mutated by: (a) the Phase 1 auto-default-Group creation inside `loadInitiativesCSV`, (b) the Phase 2 inline edit handlers, (c) the Phase 3 JSON load handler. Never deep-cloned; the array identity is reassigned on Phase 3 wholesale-replace but mutated in place by other paths.
- The auto-default Group fires *only* when `groupsStore.length === 0` at the moment of `loadInitiativesCSV` completion. It does *not* fire on subsequent loads.
- `groupsStore[i].members` is `(string | null)[]` — strings are normalised Category values (first-seen casing); `null` is the **(Blank) sentinel**. Mixing both is allowed.
- The `isProjection` invariant — exactly one Group at any time has `isProjection === true` — is upheld by Phase 1's auto-default creation (the `All` Group is flagged) and Phase 2's UI radio. The engine code is *not* defensively re-checking; the **Quick projection Monte Carlo** reads `groupsStore.find(g => g.isProjection)?.members ?? []` and tolerates the no-projection case as the `cwEffort`-only fallback.
- `detectedCols.categoryCol` is `string | null`. Every reader handles `null` by treating every Initiative's category as `BLANK`.
- `detectCategoryCol` uses *only* header-name matching against the cascade — there is no **Content scan** branch. `MoSCoW`-regex matching is gone.
- `normalizeCategory` does *not* strip emoji or any non-ASCII character. The legacy `normalizeMoscow` strip-non-ASCII step is removed.
- `prepareSimulationData`, `prepareTeamSimulationData`, `buildTeamProjections` all read `editedInitiatives` (the ADR-0027 contract) and bucket via `normalizeCategory`.
- `runSimulation` accepts `kPerGroup: number[]` of length `groupsStore.length` (or the equivalent snapshot passed in) and returns `results: GroupResult[]` of the same length. The order is `groupsStore` order at Run time.
- The chart's `datasets` array length equals `groupsStore.length`; each dataset's `label` equals the Group's `name`; each dataset's `backgroundColor` is derived from the Group's `color` (a translucent variant); `borderColor` is fully transparent.
- The stats table's `thead` has `1 + groupsStore.length` `<th>` elements (`Metric` + one per Group, in `groupsStore` order). The body rows have the same column count.
- `categoryBadge(BLANK)` returns the italic grey `(Blank)` HTML; `categoryBadge('Must')` returns the neutral grey `Must` HTML. No per-Category colour class is applied.
- The Initiatives-tab category cell is `<input list="category-options">`. The `category-options` `<datalist>` is emitted exactly once per render, before the table.
- The Initiatives-tab non-category cells are unchanged (the dropdown / non-editable / numeric carve-outs from feature 0019 are preserved).
- The constant-work category cascade inside `getConstantWorkEpics` mirrors the **Initiatives CSV** cascade: `r.category || r.moscow || r.emoji || ''` followed by `normalizeCategory`. The Constant Work CSV's fixed schema (per CONTEXT.md L130) gains the canonical `category` slot at the head of that cascade.
- `detectedCols.categoryCol` flows through `prepareSimulationData`, `prepareTeamSimulationData`, `buildTeamProjections` (replacing every prior `moscowCol` reference). No reader names `detectedCols.moscowCol`.
- The variable name `moscowGroups` (the per-MoSCoW-bucket count map at `index.html:1768`, `1880`, `1958`) is renamed to `categoryCounts` (a `Map<string|null, number>`). The renamed map keys by the normalised Category (string or `BLANK`).
- The CSS rules `.col-m`, `.col-ms`, `.col-msc` (`index.html:483-485, 629-631`) are removed. Group-colour styling is inline (`style="color: <g.color>"`) on the `<th>` elements.
- The chart's three hardcoded datasets at `index.html:2250-2278` are removed. The new chart construction reads `groupsStore` and the `results` array.
- The `#stats-table` thead literal at `index.html:1003-1008` becomes a placeholder (e.g. `<thead id="stats-thead"></thead>`) populated by `renderStatsTableInto` per Run.
- The auto-default Group's `members` array includes `BLANK` if any Initiative in the loaded CSV resolves to `BLANK`.

### Counterexamples (must NOT pass)

- A `detectCategoryCol` that retains the **Content scan** branch (the `/must|should|could|won.t/i` regex from `detectMoscowCol`). The branch is *removed* per ADR-0028.
- A `normalizeCategory` that strips emoji or non-ASCII characters (carries over the legacy `normalizeMoscow` step). The strip is *dropped* per ADR-0028.
- A `normalizeCategory` that lowercases the returned string (loses first-seen casing). The cased display value must survive.
- A `normalizeCategory` that returns the literal string `'(Blank)'` for empty input. The (Blank) sentinel is the JS `null` value; the `(Blank)` string is the *display form*, not the in-memory form.
- A `normalizeCategory` that returns the literal string `'unknown'` for unparseable input. There is no `unknown` bucket post-ADR-0029.
- A `categoryBadge` that applies per-Category colour classes (`mb-must`, `mb-should`, `mb-could`, `mb-wont`, `mb-unknown`). The badge is uniform neutral grey per ADR-0028.
- A `prepareSimulationData` that retains `kMust / kMustShould / kMustShouldCould` in its return value. The contract is `kPerGroup: number[]`.
- A `runSimulation` that retains the three named result fields `mustOnly / mustShould / mustShouldCould`. The contract is `results: GroupResult[]`.
- A `runSimulation` that loops a hardcoded 3 times. The loop count is `groupsStore.length` (or the snapshot's length).
- An engine reader that excludes `Won't` or `unknown` from any Group's count. Inclusion is purely a function of Group membership per ADR-0029.
- An auto-default-Group creation that fires on *every* CSV load (overwriting user Groups). The check is `if (groupsStore.length === 0)`.
- An auto-default-Group creation that *also* fires when the Initiatives CSV is reset (clearing then re-creating). The reset path does not touch `groupsStore`.
- An auto-default-Group creation that fires *before* `editedInitiatives` is populated. The check fires after the clone (so observed Categories are available).
- A `resetInitiativesFile` that *also* clears `groupsStore`. Groups are user-managed state; CSV reset does not invalidate them.
- A chart construction that retains the three hardcoded datasets. The datasets array is `groupsStore.map(...)`.
- A `#stats-table` that keeps the literal `Must Only / Must + Should / Must + Should + Could` thead. The thead is dynamic.
- A category-cell rendering in the Initiatives tab that keeps the `<select>` dropdown for the detected category column. The category column uses `<input list>`; other columns retain their existing affordance.
- A `<datalist>` emitted multiple times per render (one per row). The datalist is emitted *once*, before the table.
- A datalist whose options include the `(Blank)` sentinel display string `(Blank)`. The (Blank) sentinel is *not* listed; empty values are entered by clearing the input.
- A `getConstantWorkEpics` that hardcodes a single field name (`r.moscow`) for the category. The cascade is `r.category || r.moscow || r.emoji || ''`.
- A `prepareTeamSimulationData` that retains the `moscowGroups` bucketing while the org-level path migrates. Both must migrate together.
- A `buildTeamProjections` that reads `kMustShouldCould` as the projection K. The projection K is `groupsStore.find(g => g.isProjection)`-driven.
- A `buildTeamProjections` that falls back to the *first* Group when no `isProjection` Group exists. The fallback is `cwEffort`-only per ADR-0023.
- A `categoryBreakdown` keyed by lower-case strings (the engine bucketing is case-insensitive but the display uses first-seen casing — the breakdown should display the cased form).
- A renamed `detectedCols.categoryCol` field that retains a legacy `moscowCol` alias next to it. The rename is wholesale; `moscowCol` is gone.
- A `runSimulation` that takes the global `groupsStore` reference instead of a snapshot. The Run captures a snapshot at the start so concurrent edits do not interleave; engine reads work against the snapshot only.
- A `categoryCounts` map whose key for the (Blank) sentinel is the string `'(Blank)'` rather than the JS `null`. The key is `null` to match the membership-test path.
- A chart whose datasets array is recomputed for every chart `update` call rather than rebuilt on Run. The pattern matches the existing org-level chart: built once at Run, destroyed before next Run.
- A category-cell rendering that auto-completes `(Blank)` as a literal option. The user clears the field to assign (Blank).

### Forbidden shortcuts

- Do not retain a `moscowCol` field on `detectedCols` for backward-compat. The migration is wholesale; the field is renamed.
- Do not retain `kMust / kMustShould / kMustShouldCould` as aliases on `prepareSimulationData`'s return value. The new contract is the only contract.
- Do not retain `mustOnly / mustShould / mustShouldCould` on `runSimulation`'s return value as aliases. Same.
- Do not retain the three CSS classes `.col-m / .col-ms / .col-msc`. They are removed.
- Do not retain the `mb-must / mb-should / mb-could / mb-wont / mb-unknown` badge CSS classes (or their JS-side class application). They are removed; the badge is one neutral class.
- Do not infer the `isProjection` Group lazily ("first Group if none flagged"). The fallback is the `cwEffort`-only band per ADR-0023.
- Do not strip emojis from Category values "to keep the rendering consistent with the historical badge style". The badge style is now neutral; emojis are part of the user's data.
- Do not lowercase `categoryBreakdown` keys. Display uses first-seen casing; the breakdown shows the display form.
- Do not introduce a `Won't` exclusion when the auto-default `All` Group's `members` are computed from observed Categories. Every observed Category goes in, including `Won't` and `(Blank)`.
- Do not write a separate "MoSCoW shape detector" that pre-classifies CSVs and pre-creates 3 Groups. The user explicitly chose against this default per HANDOFF.md.
- Do not change the default `iterations` or `capacity` values. Both are unchanged.
- Do not change the chart's overlapping-datasets shape (ADR-0011). The shape stays; only the dataset *count* changes.
- Do not change the per-context **Marker store** keys (`'org'`, `'team-{idx}'`). They remain the same; Group selection is orthogonal.
- Do not add a "show on chart" per-Group toggle. Listed as a future revision in ADR-0029.

### RED gate

Before the implementation session starts (on the current unimplemented build):
- Manual step 1: `groupsStore` is `undefined` (`ReferenceError` on first DevTools eval).
- Manual step 2: `detectedCols.moscowCol` exists; `detectedCols.categoryCol` is `undefined`.
- Manual step 5: `detectedCols.categoryCol` is `undefined` for a CSV with `moscow` header (the legacy detector returns it as `moscowCol`).
- Manual step 8: `categoryBreakdown` does not exist on the preview output; the **Column-detection debug** still shows `moscowGroups`.
- Manual step 11: pushing 3 groups into `groupsStore` has no effect; the chart still shows 3 hardcoded MSC datasets.
- Manual step 14: the Initiatives-tab category cell is a `<select>`, not an `<input list>`.
- Manual step 17: a Group with empty members causes `runSimulation` to crash (no `kPerGroup` handling) or returns the wrong shape.
- Manual step 19: the **Team Projections tab**'s band is computed from `kMustShouldCould` regardless of `groupsStore`.

### Test immutability rule

There are no test files to freeze (manual harness). If a test suite is later introduced, tests for `detectCategoryCol`, `normalizeCategory`, the `groupsStore` auto-default lifecycle, and the engine's `kPerGroup` / `results: GroupResult[]` contract would live under `tests/acceptance/` and be off-limits to the implementation session.

### Definition of done

- [ ] Manual scenarios AT-1 through AT-30 all pass.
- [ ] `detectMoscowCol` is renamed to `detectCategoryCol` with the header-name cascade and no **Content scan** branch.
- [ ] `normalizeMoscow` is renamed to `normalizeCategory` with `trim + case-fold + first-seen casing, no emoji strip`.
- [ ] `moscowBadge` is renamed to `categoryBadge` with uniform neutral grey.
- [ ] `BLANK` is module-scoped and equals `null`.
- [ ] `groupsStore` is declared as `let groupsStore = []` next to `parsedInitiatives` / `editedInitiatives`.
- [ ] `loadInitiativesCSV` auto-creates the `All` Group iff `groupsStore.length === 0` at completion.
- [ ] `resetInitiativesFile` does *not* mutate `groupsStore`.
- [ ] `prepareSimulationData`, `prepareTeamSimulationData`, `buildTeamProjections`, `getConstantWorkEpics` migrated to the Category cascade and per-Group bucketing.
- [ ] `runSimulation` accepts `kPerGroup` and returns `results: GroupResult[]`.
- [ ] The chart's datasets are dynamic, one per Group.
- [ ] `#stats-table` thead and body are dynamic, one column per Group.
- [ ] The `.col-m / .col-ms / .col-msc` CSS rules and the `mb-*` badge classes are removed.
- [ ] The Initiatives-tab category cell is an `<input list>` datalist combo.
- [ ] The **Data preview** lists per-Group K rows.
- [ ] The **Column-detection debug** shows `categoryCol` and `categoryBreakdown`.
- [ ] `categoryBadge(BLANK)` renders italic grey `(Blank)`.
- [ ] Manual scenarios involving legacy MoSCoW CSVs continue to produce a usable simulation (a single `All` Group containing every observed Category).
- [ ] No engine code, marker code, lognormal-parameter code, or chart-marker plugin code is modified beyond the dataset-construction call site.
- [ ] `git diff` for this phase touches only `index.html` (plus this plan, the ADRs, and CONTEXT.md if material clarifications are needed during implementation per ADR-0001).

---

## Phase 2: Groups tab — fifth result Tab with editable Group rows, Members popover, projection radio, soft-cap signal

### Acceptance behavior

Scenario AT-1: The fifth tab button appears in the tab bar after `Initiatives`
Given the user has completed a Run after Phase 1 ships
When the user looks at the tab bar
Then there are exactly five `.tab-btn` elements: `Organization Level`, `Team Level`, `Team Projections`, `Initiatives`, `Groups`
And the fifth button has `data-tab="groups"` and text `Groups`

Scenario AT-2: The `#tab-groups` panel is `display:none` immediately after a Run
Given the user has just pressed Run
When the run-button handler's visibility-reset block completes
Then `#tab-groups.style.display === 'none'`
And the active tab is `Organization Level`

Scenario AT-3: Clicking the Groups tab button reveals the Groups table
Given the Run has completed and the user is on the Organization Level tab
When the user clicks the `Groups` tab button
Then `#tab-groups.style.display === 'flex'`
And the Groups table is visible

Scenario AT-4: The Groups table has one row per Group in `groupsStore` order plus a `+ New group` row at the bottom
Given `groupsStore` has 3 Groups
When the Groups tab renders
Then the table's `<tbody>` has 3 Group rows + 1 `+ New group` row = 4 `<tr>` elements
And the Group rows render in `groupsStore` order (not alphabetical, not by name)

Scenario AT-5: Each Group row has six cells: `Name | Color | Members | Projection | Duplicate | Delete`
Given a Group `{ name: 'KR1', color: '#ea7c2c', members: ['KR1', null], isProjection: false }`
When the row renders
Then the row has 6 `<td>` elements in the documented column order
And the Name cell is `<input type="text" value="KR1">`
And the Color cell is a clickable swatch with `background: #ea7c2c`
And the Members cell is a chip strip with two chips: `KR1` and `(Blank)` (italic grey for the latter), followed by a `+` button
And the Projection cell is `<input type="radio" name="proj-group">` unchecked
And the Duplicate cell is `<button>Duplicate</button>` (or icon)
And the Delete cell is `<button>Delete</button>` (or icon)

Scenario AT-6: Editing a Group's Name writes through to `groupsStore` immediately
Given the user is on the Groups tab
And the Name cell of Group 0 currently shows `All`
When the user changes the input value to `Critical only` and blurs (or fires `change`)
Then `groupsStore[0].name === 'Critical only'`
And the chart, stats table, **Data preview**, **Team Projections** sections do *not* update
And no Run fires

Scenario AT-7: Clicking the Color swatch opens the 80-colour palette overlay
Given the user is on the Groups tab
When the user clicks Group 0's Color swatch
Then a modal / overlay opens displaying the `COLOR_PALETTE` swatches in an 8 × 10 grid (matching the Marker dialog's layout)
And clicking a swatch in the overlay writes the chosen colour to `groupsStore[0].color` and closes the overlay
And the Groups table re-renders to show the new swatch background on the Color cell
And no Run fires

Scenario AT-8: The Members cell renders one chip per member with `×` and a `+` button
Given Group 0 has `members: ['Must', 'Should', null]`
When the row renders
Then the chip strip has 3 chips: `Must`, `Should`, `(Blank)`
And each chip has a small `×` button that on click removes that member
And there is a `+` button to the right of the chips

Scenario AT-9: Clicking a chip's `×` removes that member from `groupsStore[idx].members`
Given Group 0 has `members: ['Must', 'Should']`
When the user clicks the `×` on the `Should` chip
Then `groupsStore[0].members === ['Must']`
And the chip strip re-renders showing only `Must`
And no Run fires

Scenario AT-10: Clicking the `+` button on the Members cell opens a MultiSelect popover
Given Group 0 has `members: ['Must']`
And `editedInitiatives` observable Categories are `Must`, `Should`, `Could`
When the user clicks the Members cell's `+` button
Then a **MultiSelect**-style popover opens
And the popover lists every observed Category (`Must`, `Should`, `Could`) plus a `(Blank)` row plus a free-text input at the bottom
And the `Must` option is checked (since it's a current member)
And other options are unchecked

Scenario AT-11: Toggling an option in the popover writes through to `groupsStore[idx].members`
Given the popover is open and `Should` is unchecked
When the user clicks the `Should` checkbox
Then `groupsStore[0].members` contains `Should` (in addition to whatever was there)
And the chip strip re-renders with the new chip

Scenario AT-12: Adding a free-text Category in the popover creates a member that may not match any current Initiative
Given the popover is open
When the user types `KR4` in the free-text input and presses Enter (or clicks Add)
Then `groupsStore[0].members` contains `'KR4'`
And the chip strip re-renders with a `KR4` chip
And no error fires (lenient validation per ADR-0029)
And the popover does *not* close (the user can continue adding)

Scenario AT-13: The Projection cell is a single-select radio enforcing exactly-one `isProjection`
Given `groupsStore` has 3 Groups; Group 0 is the current Projection group
When the user clicks Group 1's radio
Then `groupsStore[0].isProjection === false`
And `groupsStore[1].isProjection === true`
And `groupsStore[2].isProjection === false`
And the Groups table re-renders to reflect the new radio state
And no Run fires

Scenario AT-14: The Duplicate button clones the row with `name: '<original> (copy)'`
Given `groupsStore` has 1 Group `{ name: 'KR1', color: '#ea7c2c', members: ['KR1'], isProjection: true }`
When the user clicks the Duplicate button on that row
Then `groupsStore.length === 2`
And `groupsStore[1] === { name: 'KR1 (copy)', color: '#ea7c2c', members: ['KR1'], isProjection: false }`
(The clone never copies the `isProjection` flag.)
And the table re-renders with the new row inserted after the original

Scenario AT-15: The Delete button removes the row
Given `groupsStore` has 2 Groups `A` (isProjection: true), `B`
When the user clicks Delete on row `B`
Then `groupsStore.length === 1`
And `groupsStore[0]` is the unchanged `A`
And the table re-renders

Scenario AT-16: Deleting the current Projection group transfers `isProjection` to the next-available row
Given `groupsStore === [{ name: 'A', isProjection: true }, { name: 'B', isProjection: false }, { name: 'C', isProjection: false }]`
When the user clicks Delete on row `A`
Then `groupsStore.length === 2`
And `groupsStore[0].name === 'B'` and `groupsStore[0].isProjection === true` (the flag transferred to the new first row)
And `groupsStore[1].name === 'C'` and `groupsStore[1].isProjection === false`

Scenario AT-17: Deleting the last Group leaves `groupsStore === []`
Given `groupsStore` has exactly one Group
When the user clicks Delete on that row
Then `groupsStore.length === 0`
And the table renders only the `+ New group` row
And the next Run's chart and stats table render the empty-`groupsStore` state (no datasets, no per-Group columns) — the **Effort projection band** falls back to `cwEffort` per ADR-0023

Scenario AT-18: The `+ New group` row at the bottom appends a default Group on click
Given `groupsStore` has 1 Group `A`
When the user clicks the `+ New group` row's button
Then `groupsStore.length === 2`
And the new row is `{ name: '', color: <COLOR_PALETTE[1] or similar>, members: [], isProjection: false }`
And the table re-renders with the new (empty-name) row above the `+ New group` row

Scenario AT-19: Edits to Groups commit to `groupsStore` immediately but do not re-render charts or stats
Given the user is on the Groups tab and has performed several edits (renamed a Group, added a member, toggled the projection flag)
When the user clicks back to `Organization Level`
Then the chart, stats table, **Data preview** are unchanged (reflecting the *previous* Run, not the edits)
And the user must press Run Simulation to see the new shape

Scenario AT-20: Pressing Run after Group edits renders the new shape
Given the user has edited `groupsStore` (added a Group, deleted another, renamed a third)
When the user presses Run Simulation
Then the chart renders one dataset per current Group in current order
And the stats table renders one column per current Group
And the **Data preview** lists one K row per current Group
And the **Team Projections** sections re-render against the current `isProjection` Group

Scenario AT-21: An empty-named Group renders fine and produces a Scenario labelled by the empty name
Given a Group has `name: ''`
When the user presses Run
Then the chart's dataset for that Group has `label: ''`
And the stats table's column for that Group has empty header text (just the `■` swatch)
And no error fires (lenient validation per ADR-0029)

Scenario AT-22: Duplicate-named Groups disambiguate in the legend by their position
Given two Groups both named `KR1`
When the user presses Run
Then the chart renders both datasets with `label: 'KR1'`
And the stats table renders two `KR1` columns (the user reads positionally)
And no error fires

Scenario AT-23: A zero-member Group renders a `K = 0` row in the Data preview
Given a Group `Empty` has `members: []`
When the user presses Run
Then the **Data preview** shows a K row for `Empty` reading `K = 0`
And the chart's dataset for `Empty` is a flat at-`fixedEffort` distribution
And the stats table's column for `Empty` shows `p10 = p50 = p90 = fixedEffort`

Scenario AT-24: A Group referencing a category absent from the CSV silently matches zero
Given the CSV has Categories `Must`, `Should`, `Could`
And a Group has `members: ['KR1']` (not in the CSV)
When the user presses Run
Then `kPerGroup` for that Group is `0`
And the **Data preview** shows `K = 0` for that Group
And no error fires

Scenario AT-25: Adding the **(Blank) sentinel** to a Group's `members` includes (Blank)-categorised Initiatives in that Group's Scenario
Given the CSV has 3 Initiatives with empty `category` cells (all normalise to BLANK)
And a Group has `members: [BLANK]`
When the user presses Run
Then `kPerGroup` for that Group is `3`

Scenario AT-26: The Groups tab is re-rendered as part of every Run
Given the user has pressed Run once
And the user then edits a Group's name (e.g. `A` → `A2`)
And the user does *not* press Run again
When the user clicks the Groups tab
Then the row shows `A2` (the in-memory edit)
And the Groups tab DOM is *not* re-rebuilt on this tab-switch
When the user then presses Run
Then `renderGroupsTab` is called inside the run-button handler
And the row still shows `A2`

Scenario AT-27: Tab-switching does not lose mid-edit state
Given the user is on the Groups tab and has typed `Critical` into a Name input but not yet blurred (the `change` event has not fired)
When the user clicks another tab without blurring
Then `groupsStore[idx].name` is still the *previous* committed value (the unblurred typed-in value is browser-form state, not yet committed)
(This matches the Initiatives-tab `onchange` semantics from feature 0019.)

Scenario AT-28: The Members popover sources its option list from `editedInitiatives` (the current edited state), not `parsedInitiatives`
Given the user has edited an Initiative's category from `Must` to `KR99` in the Initiatives tab
And the user has not yet pressed Run
And the user opens the Members popover on a Group
Then the popover lists `KR99` as an available Category
(This is a deliberate departure from the Initiatives-tab dropdown which sources from `parsedInitiatives` for stable option pools — the Members popover targets the current edited state.)

Scenario AT-29: The Members popover does not close on member-toggle (multi-select is the contract)
Given the popover is open and the user has just checked one option
When the user moves the mouse to check another option
Then the popover remains open and the click on the second option toggles it cleanly

Scenario AT-30: The Members popover closes on outside-click or `Esc`
Given the popover is open
When the user clicks outside the popover's bounding box
Then the popover closes
When the user (with the popover open) presses `Esc`
Then the popover closes
(Both behaviours match the existing **MultiSelect** widget's contract per ADR-0017.)

Scenario AT-31: A Group with more than ~5 entries is *not* rejected; the chart and stats render with degraded legibility
Given the user defines 8 Groups
When the user presses Run
Then the chart renders 8 overlapping datasets (visually crowded)
And the stats table renders 9 `<th>` (Metric + 8 Group columns; horizontally scrollable)
And no warning, error, or modal interposes

Scenario AT-32: The Groups tab's per-row `onchange` handlers write `this.value` (always a string) to `groupsStore[idx].name`
Given the Name input fires `onchange`
Then `groupsStore[idx].name` is the `this.value` string
And no coercion is applied
And empty strings are accepted

Scenario AT-33: The Groups tab handles the `groupsStore === []` state (no auto-default, all deleted) without crashing
Given `groupsStore.length === 0` (every Group was deleted)
When `renderGroupsTab()` runs
Then the table renders with only the `+ New group` row
And clicking `+ New group` pushes a default empty Group with `isProjection: true` (since it is the only Group)

### Public entry point

UI:
- The Groups tab button and panel.
- Per-row Name input, Color swatch, Members chip strip + `+` button + popover, Projection radio, Duplicate button, Delete button.
- The `+ New group` row.

In-code:
- `renderGroupsTab(): void` — single-`innerHTML`-assignment render into `#groups-table-wrap`.
- Inline `onchange` / `onclick` handlers writing directly to `groupsStore[idx][field]`.
- A `openMembersPopover(groupIdx)` function modelled on `openMarkerDialog` (the Marker dialog pattern) that mounts and unmounts a popover anchored to the Members cell's `+` button.
- A `openColorPalette(groupIdx)` function modelled on the Marker dialog's palette block.

### Expected observable outcomes

- A new fifth tab appears in the tab bar.
- The Groups tab table renders one row per Group in `groupsStore` order.
- Inline edits write through to `groupsStore` immediately.
- Edits do *not* trigger a Run; pressing Run re-renders the chart, stats table, and per-team sections to reflect the new Group set.
- The Members popover allows free-form add of categories not yet in the CSV.
- The Projection radio enforces exactly-one across the table.
- Duplicate / Delete behave per ADR-0029.
- Validation is lenient — empty names, duplicates, zero-member, and absent-category references are all accepted.

### Test harness

Acceptance tests:
- Location: **N/A — manual.**
- Manual steps (each maps to one or more AT scenarios):
  1. After Phase 1 lands and Run is pressed once, confirm the fifth tab button appears reading `Groups` (AT-1).
  2. Confirm `#tab-groups.style.display === 'none'` and the active tab is `Organization Level` (AT-2).
  3. Click `Groups`; confirm the panel becomes visible and the table renders (AT-3).
  4. Confirm the row count is `groupsStore.length + 1` (one Group row per Group + the `+ New group` row) (AT-4).
  5. Confirm each Group row has 6 cells in the documented column order (AT-5).
  6. Edit Group 0's Name input; confirm `groupsStore[0].name` matches after blur; confirm no other tab updates (AT-6).
  7. Click Group 0's Color swatch; confirm the palette overlay opens; click a colour; confirm the swatch updates and `groupsStore[0].color` matches (AT-7).
  8. Confirm Group 0's Members cell shows chips for every member including `(Blank)` italic-grey if BLANK is a member (AT-8).
  9. Click `×` on a chip; confirm the chip disappears and `groupsStore[0].members` no longer contains that value (AT-9).
  10. Click `+` on a Members cell; confirm the MultiSelect popover opens with observed Categories + (Blank) row + free-text input (AT-10).
  11. Toggle a checkbox in the popover; confirm `groupsStore[idx].members` updates (AT-11). Confirm popover stays open (AT-29).
  12. Type a new Category in the free-text input + Enter; confirm a new chip appears (AT-12).
  13. Click outside the popover; confirm it closes (AT-30). Reopen, press `Esc`; confirm it closes (AT-30).
  14. Click Group 1's Projection radio; confirm exactly-one `isProjection` invariant (AT-13).
  15. Click Duplicate on Group 0; confirm a new row appears with name `<original> (copy)` and `isProjection: false` (AT-14).
  16. Click Delete on a non-Projection Group; confirm row disappears (AT-15). Click Delete on the Projection Group; confirm the flag transfers to the next remaining row (AT-16).
  17. Delete every Group; confirm only the `+ New group` row remains (AT-17). Press Run; confirm the chart / stats render the empty state (AT-17).
  18. Click `+ New group`; confirm a default empty Group is pushed (AT-18). With the empty state, click `+ New group`; confirm the pushed Group has `isProjection: true` (AT-33).
  19. With several Groups defined, edit several; confirm charts / stats / data preview stay on previous Run (AT-19). Press Run; confirm everything refreshes (AT-20).
  20. Define an empty-named Group; press Run; confirm the chart legend / stats column has empty header text but renders (AT-21).
  21. Define two same-named Groups; press Run; confirm both render (AT-22).
  22. Define an empty-members Group; press Run; confirm K = 0 row in Data preview and the chart shows a flat distribution at fixedEffort (AT-23).
  23. Define a Group referencing a Category absent from the CSV (e.g. `KR99` when CSV has `Must`); press Run; confirm `kPerGroup` is 0 for that Group (AT-24).
  24. Add BLANK to a Group's members; press Run; confirm Initiatives with empty Category are counted (AT-25).
  25. Edit a Group's name; switch to Organization Level; switch back to Groups; confirm the edit persists (AT-26). Then press Run; confirm `renderGroupsTab` re-runs as part of the Run.
  26. Edit an Initiative's category in the Initiatives tab to a new value; without pressing Run, open the Members popover in Groups; confirm the new value appears in the popover (AT-28).
  27. Define 8 Groups; press Run; confirm the chart and stats render without errors but visually crowded (AT-31).
  28. Type into a Name input but switch tabs before blurring; confirm `groupsStore[idx].name` is the previous committed value (AT-27).
  29. Edit a Name to an empty string; confirm `groupsStore[idx].name === ''` after blur (AT-32).

Inner tests: N/A.

Verification: manual.

### Proposed implementation seams

Stable seams the tests may target:
- `renderGroupsTab()` — the function exists and writes a single `<table>` into `#groups-table-wrap`.
- The Groups tab markup: `<button class="tab-btn" data-tab="groups">Groups</button>` and `<div id="tab-groups" class="tab-panel"><div id="groups-table-wrap"></div></div>`.
- The Members popover's option list source: `editedInitiatives` (current edited state).
- The `Color swatch → palette overlay` lifecycle.

Do NOT lock in:
- The exact HTML class names (`group-chip`, `group-add-chip-btn`, etc.). These may change as long as behaviour is preserved.
- The exact popover implementation (whether it reuses the `MultiSelect` class verbatim or builds an inline `<div>` overlay matching the same UX contract). The contract is: chips render outside the popover; the popover lists options + (Blank) row + free-text input; toggle does not close; outside-click and Esc close.
- The exact swatch overlay implementation (whether it reuses the Marker dialog's palette block verbatim or rolls a smaller standalone overlay).
- The exact `data-` attribute scheme for inline handlers.

### Behavioral rule

The **Groups tab** (`#tab-groups`) is the fifth result **Tab**, slotted after **Initiatives** in the tab bar. The tab renders a single table whose body is one editable row per Group in `groupsStore` (in `groupsStore` order) plus a `+ New group` row at the bottom; the toolbar above the table (Phase 3) carries save / load buttons. Each Group row has six cells: `Name | Color | Members | Projection | Duplicate | Delete`. The Name cell is a plain text input writing `this.value` to `groupsStore[idx].name`. The Color cell is a clickable swatch that opens an overlay rendering the same `COLOR_PALETTE` the Marker dialog uses; selecting a swatch writes the hex to `groupsStore[idx].color` and closes the overlay. The Members cell is a horizontal chip strip with one chip per current member (the **(Blank) sentinel** rendered as italic grey `(Blank)`); each chip has a `×` button that removes the member; the trailing `+` button opens a MultiSelect-style popover listing every observed **Category** in `editedInitiatives` plus a `(Blank)` row plus a free-text input; toggling an option writes through to `groupsStore[idx].members`; the popover remains open across toggles and closes on outside-click or `Esc`. The Projection cell is a `<input type="radio" name="proj-group">` whose `checked` mirrors `groupsStore[idx].isProjection`; clicking sets `isProjection: true` on the target row and clears it on every other row. The Duplicate button pushes a clone with name `<original> (copy)`, the same color and members, and `isProjection: false`. The Delete button splices the row from `groupsStore`; if the deleted row was the Projection group, the flag transfers to the next-available row (the new first remaining row). The `+ New group` row pushes `{ name: '', color: COLOR_PALETTE[groupsStore.length % COLOR_PALETTE.length], members: [], isProjection: groupsStore.length === 0 }`. Every edit commits to `groupsStore` immediately; the chart, stats table, **Data preview** per-Group K rows, **Team Projections** sections, and **Effort projection band** values do *not* update until the user presses **Run Simulation** — same commit-on-Run discipline as the **Initiatives tab** per ADR-0027 and ADR-0029. Validation is lenient: empty names, duplicate names, zero-member Groups, and references to Categories absent from the loaded CSV are all accepted; the only strict rule is exactly-one `isProjection`, enforced by the single-select radio. The table is pre-rendered as part of every Run via `renderGroupsTab()` called inside the run-button handler immediately after `renderInitiativesTable()`.

### Invariants

- The tab bar has exactly five `.tab-btn` elements after Phase 2 lands; `Groups` is the fifth and is always the rightmost.
- `renderGroupsTab` writes to `#groups-table-wrap.innerHTML` exactly once per call — no incremental DOM updates.
- Every Group row's six cells appear in the documented order: `Name | Color | Members | Projection | Duplicate | Delete`.
- The Name cell is a `<input type="text">`. Empty values are allowed.
- The Color cell renders the swatch as a small fixed-size element with `background: <groupsStore[idx].color>`. Clicking it opens the palette overlay.
- The Members chip strip renders one chip per member: a non-null string member renders as `<chip>{escapeHtml(member)}</chip>`; the BLANK member renders as italic grey `(Blank)`.
- The Members popover sources its option list from `editedInitiatives` (the current edited state), not `parsedInitiatives`. The popover does not include the BLANK sentinel as a checkbox option for Categories — it lists a dedicated `(Blank)` row.
- The popover's `(Blank)` row toggles BLANK in/out of `groupsStore[idx].members`.
- The Projection radio has `name="proj-group"`; exactly one radio in the table is `checked` at any time — guaranteed by the single-select radio semantics + the inline handler that writes `isProjection: true` on the target and `false` on every other Group.
- The Duplicate button never copies `isProjection: true`; the clone is always `isProjection: false`.
- The Delete button transfers `isProjection` to the next-available row (the new first remaining row) iff the deleted row had `isProjection: true`. If no rows remain, the flag is lost (the empty `groupsStore` state).
- The `+ New group` row pushes a Group with `isProjection: groupsStore.length === 0` (true only if it's the first Group, false otherwise).
- Edits commit to `groupsStore` immediately; no charts, stats, data preview, or team-projections surface re-renders until the next Run.
- The Groups tab is pre-rendered inside the run-button handler at the same cadence as the Initiatives tab.
- The Groups tab's tab-button click is handled by the existing generic tab-switch handler; no per-tab special case is added.
- Inline `onchange` / `onclick` / `oninput` handlers write `this.value` (always a string) or call a named function with the row index. No coercion.
- Cell content is always escaped via `escapeHtml` (text) or `escapeAttr` (attribute values).
- The `+ New group` row's button has a distinct visual style (e.g. `+` icon or `+ New group` text) and is never confused with a Group row.

### Counterexamples (must NOT pass)

- A `renderGroupsTab` that incrementally updates rows via DOM mutation instead of single-`innerHTML` assignment.
- A Group row with cells in a different order or count.
- A Name cell that auto-trims `this.value` (the lenient-validation rule allows whitespace-padded names).
- A Color swatch that uses a colour picker (`<input type="color">`) instead of the `COLOR_PALETTE` overlay. The palette is the contract; the colour picker would diverge from the Marker dialog UX.
- A Members popover that closes on every checkbox toggle (the contract is "remains open across toggles").
- A Members popover that sources options from `parsedInitiatives` (the contract is `editedInitiatives` — the current edited state).
- A Members popover that excludes the `(Blank)` row (the contract is to list it explicitly).
- A Members popover whose free-text input commits on every keystroke (the contract is on Enter / `Add` click).
- A Projection radio that allows zero selected (the contract is exactly-one; pressing the current radio again does *not* unselect — radios in a group never unselect).
- A Delete that fails to transfer `isProjection` (would violate the exactly-one invariant on the next Run).
- A Duplicate that copies `isProjection: true` (would temporarily violate the exactly-one invariant).
- An edit handler that calls `runSimulation` or `renderChartOnCanvas` (would burn a Run on every edit).
- A `+ New group` row that doesn't exist (the user can't add Groups without it).
- A `+ New group` that pushes `isProjection: true` when `groupsStore` is non-empty (would silently steal the flag from the current Projection Group).
- A render path that hardcodes 5 columns or 7 columns (the contract is 6: `Name | Color | Members | Projection | Duplicate | Delete`).
- A render path that uses `<select>` for the Name cell (Name is free-text input, not a dropdown).
- A render path that uses `<input type="color">` for the Color cell (the contract is the 80-swatch palette overlay).
- A render path that emits the BLANK sentinel in the popover's checkbox list as the literal string `"null"` or `"(Blank)"` or `"BLANK"` (the popover renders a dedicated `(Blank)` row that on toggle adds/removes BLANK to/from `members`).
- A re-render path that *also* re-renders the org-level chart or stats table (the Groups-tab render is independent).
- A re-render path triggered by every keystroke on the Name input (the commit is `onchange`, not `oninput`).
- A Groups tab that auto-creates a `+ New group` row labelled with a Group-like name (the row is a control affordance, not a Group).
- An `openMembersPopover` that destroys and re-creates the entire Groups table on close (it just unmounts the popover and re-renders the affected row).

### Forbidden shortcuts

- Do not move the Groups tab to a different position (e.g. before `Initiatives`). The fifth-tab position is the contract per ADR-0029.
- Do not embed the Groups tab inside the Initiatives tab as a sub-section. They are independent tabs.
- Do not introduce drag-drop reordering of Group rows. Listed as a future revision in ADR-0029.
- Do not introduce per-Group `description` / `tags` / `showOnChart` fields. Listed as additive future revisions in ADR-0029.
- Do not introduce hard-cap enforcement on the number of Groups. The soft cap is a visual signal, not a UI rule.
- Do not introduce a "Reset to default `All` Group" button on the Groups tab. The auto-default fires only when `groupsStore` is empty at CSV load.
- Do not migrate the existing `MultiSelect` class (`index.html:1083`) — reuse it as-is. If a thin wrapper is needed to handle the BLANK row + free-text input, build a small adapter inline; do not modify the class.
- Do not migrate the Marker dialog's palette block — extract a shared helper if needed (e.g. `renderColorPaletteOverlay(currentColor, onPick)`) only if the duplication is genuinely uncomfortable. Otherwise, accept the inline duplication.
- Do not introduce a debounce on the Name input's `change` handler. The commit-on-Run discipline already insulates the rest of the UI; debouncing adds invisible delay.
- Do not introduce auto-save to `localStorage` on Group edits. Persistence is Phase 3's JSON save/load only.

### RED gate

Before the implementation session starts (after Phase 1 has landed):
- Manual step 1: there is no fifth tab button.
- Manual step 3: clicking nowhere reveals a `#tab-groups` panel — the element doesn't exist.
- Manual step 4: `renderGroupsTab` is `undefined`.
- Manual step 6: editing a Name input has no effect (there are no Name inputs).
- Manual step 7: clicking on a (non-existent) Color swatch does nothing.
- Manual step 10: clicking on a (non-existent) Members `+` button does nothing.
- Manual step 14: there is no Projection radio.
- Manual step 18: there is no `+ New group` row.

### Test immutability rule

There are no test files to freeze (manual harness).

### Definition of done

- [ ] Manual scenarios AT-1 through AT-33 all pass.
- [ ] The tab bar has the fifth `Groups` tab button.
- [ ] `#tab-groups` panel renders the Groups table when `groupsStore.length > 0` and an empty `+ New group`-only state when `groupsStore.length === 0`.
- [ ] Every Group row's six cells behave per ADR-0029.
- [ ] The Members popover sources options from `editedInitiatives` and lists the `(Blank)` row + free-text input.
- [ ] The Projection radio enforces exactly-one across the table.
- [ ] Duplicate clones with `name + ' (copy)'` and `isProjection: false`.
- [ ] Delete transfers `isProjection` to the next-available row when needed.
- [ ] The `+ New group` row appends a default Group.
- [ ] Edits commit to `groupsStore` immediately and do not trigger a Run.
- [ ] `renderGroupsTab()` is called inside the run-button handler immediately after `renderInitiativesTable()`.
- [ ] No engine code, no Phase 1 substrate code, no chart-marker plugin code is modified.
- [ ] `git diff` for this phase touches only `index.html` (plus this plan and CONTEXT.md if material clarifications surface).

---

## Phase 3: Groups JSON persistence — `↓ Save groups (JSON)` / `↑ Load groups (JSON)` with `schemaVersion: 1` and wholesale-replace load

### Acceptance behavior

Scenario AT-1: The Groups tab toolbar has two buttons: `↓ Save groups (JSON)` and `↑ Load groups (JSON)`
Given the user is on the Groups tab
When the user looks at the toolbar above the Groups table
Then there are exactly two `<button>` elements visible: `↓ Save groups (JSON)` and `↑ Load groups (JSON)`
And both use the `add-marker-btn` class (matching the Marker CSV save/load buttons per ADR-0025)

Scenario AT-2: Clicking `↓ Save groups (JSON)` downloads `groups.json`
Given `groupsStore` has 2 Groups `A` (color `#ea7c2c`, members `[Must]`, isProjection true) and `B` (color `#4f46e5`, members `[Should, null]`, isProjection false)
When the user clicks `↓ Save groups (JSON)`
Then a file download is triggered with name `groups.json`
And the file's content is `{ "schemaVersion": 1, "groups": [ { "name": "A", "color": "#ea7c2c", "members": ["Must"], "isProjection": true }, { "name": "B", "color": "#4f46e5", "members": ["Should", null], "isProjection": false } ] }` (modulo two-space indentation from `JSON.stringify(..., null, 2)`)

Scenario AT-3: The **(Blank) sentinel** serialises as the JSON literal `null`
Given Group `X` has `members: [BLANK]` (i.e. `[null]` in JS)
When the user saves
Then the saved file contains `"members": [null]` (or `[\n  null\n]` with indentation) — *not* the string `"null"` or `"(Blank)"` or `"BLANK"`

Scenario AT-4: Saving with empty `groupsStore` produces a file with `"groups": []`
Given `groupsStore === []`
When the user clicks Save
Then the saved file is `{ "schemaVersion": 1, "groups": [] }` (with whitespace)
And no error fires

Scenario AT-5: Clicking `↑ Load groups (JSON)` opens a file picker
Given the user is on the Groups tab
When the user clicks `↑ Load groups (JSON)`
Then a file picker dialog opens with `accept=".json"`

Scenario AT-6: Loading a valid `groups.json` with `schemaVersion: 1` replaces `groupsStore` wholesale
Given the current `groupsStore` is `[{ name: 'OldGroup', members: [], isProjection: true }]`
And the user selects a `groups.json` file containing `{ "schemaVersion": 1, "groups": [{ "name": "NewA", "color": "#000", "members": ["Must"], "isProjection": true }, { "name": "NewB", "color": "#fff", "members": [null], "isProjection": false }] }`
When the file is parsed and applied
Then `groupsStore === [{ name: 'NewA', color: '#000', members: ['Must'], isProjection: true }, { name: 'NewB', color: '#fff', members: [null], isProjection: false }]`
And `OldGroup` is gone
And the Groups table re-renders to show the new state
And the chart / stats / data preview do *not* update until the next Run (commit-on-Run)

Scenario AT-7: Loading a `groups.json` with `schemaVersion > 1` surfaces an inline error and does not load
Given the current `groupsStore` is non-empty
And the user selects a `groups.json` file containing `{ "schemaVersion": 2, "groups": [] }`
When the file is parsed
Then an inline error appears reading `"This file was saved by a newer version of the simulator."`
And `groupsStore` is unchanged
And the Groups table is unchanged

Scenario AT-8: Loading a `groups.json` with missing `schemaVersion` is treated as version 1 (loads cleanly)
Given the user selects a `groups.json` file containing `{ "groups": [{ "name": "X", "color": "#000", "members": [], "isProjection": true }] }` (no `schemaVersion` field)
When the file is parsed
Then `groupsStore === [{ name: 'X', color: '#000', members: [], isProjection: true }]`
And no error fires

Scenario AT-9: Loading a malformed JSON surfaces the raw parse-error string
Given the user selects a file with invalid JSON content (e.g. `{ "schemaVersion": 1, "groups": [unfinished` truncated)
When the file is parsed
Then an inline error appears reading the raw `JSON.parse` error message (e.g. `"SyntaxError: Unexpected token u in JSON at position …"`)
And `groupsStore` is unchanged

Scenario AT-10: Loading a `groups.json` whose top-level shape is wrong surfaces an inline error
Given the user selects a file with content `[1, 2, 3]` (an array, not an object)
When the file is parsed
Then an inline error appears reading `"Invalid groups.json: expected an object with a 'groups' array."`
And `groupsStore` is unchanged

Scenario AT-11: A non-trivial existing `groupsStore` interposes a confirmation modal on load
Given `groupsStore` has 3 user-defined Groups (i.e. `length > 1` or `length === 1 && name !== 'All'`)
And the user selects a valid `groups.json`
When the file picker resolves
Then a confirmation modal appears: `"This will replace your current {N} group(s). Continue?"` (with `{N}` filled in)
And the modal has `Cancel` and `Replace` buttons
And until the user clicks `Replace`, `groupsStore` is unchanged

Scenario AT-12: A trivial `groupsStore` (only the auto-default `All` Group) skips the confirmation modal
Given `groupsStore === [{ name: 'All', isProjection: true, ... }]` (the auto-default state)
And the user selects a valid `groups.json`
When the file picker resolves
Then no modal appears
And `groupsStore` is replaced immediately

Scenario AT-13: Cancelling the confirmation modal leaves `groupsStore` unchanged
Given the modal is open
When the user clicks `Cancel` (or presses `Esc`, or clicks the backdrop)
Then the modal closes
And `groupsStore` is unchanged
And no parse / load logic runs

Scenario AT-14: Confirming the replace applies the load
Given the modal is open with a successfully-parsed file's groups ready
When the user clicks `Replace`
Then `groupsStore` is replaced wholesale
And the Groups table re-renders
And the modal closes

Scenario AT-15: Loading a `groups.json` with `null` in a member position deserialises to BLANK
Given the file contains `"members": ["Must", null, "Should"]`
When loaded
Then `groupsStore[0].members === ['Must', null, 'Should']` (i.e. the JS `null` is preserved as BLANK)
And the Members chip strip renders `Must`, `(Blank)` (italic grey), `Should`

Scenario AT-16: Loading a `groups.json` referencing a Category absent from the currently-loaded CSV preserves the member verbatim
Given the loaded CSV has Categories `[Automation, KR1]`
And the `groups.json` has a Group with `members: ['Must']` (a Category not present in the CSV)
When loaded and Run is pressed
Then `kPerGroup` for that Group is `0`
And no error fires
And the Members chip strip continues to show the `Must` chip even though no Initiative matches

Scenario AT-17: A `schemaVersion === 1` file with an unknown field in a Group is parsed; the unknown field is silently dropped
Given the file contains `{ "schemaVersion": 1, "groups": [{ "name": "A", "color": "#000", "members": [], "isProjection": true, "futureField": "foo" }] }`
When loaded
Then `groupsStore[0]` has the known fields (`name`, `color`, `members`, `isProjection`) and not `futureField`
And no error fires

Scenario AT-18: Loaded Groups land in `groupsStore` immediately but no chart re-renders until Run
Given a load is applied
When the user looks at the chart / stats / data preview
Then they reflect the *previous* Run's `groupsStore`, not the loaded one
When the user presses Run
Then the chart, stats, data preview, **Team Projections** sections all reflect the loaded `groupsStore`

Scenario AT-19: A loaded Group with `isProjection: true` becomes the new Projection group
Given the loaded file has Group `X` with `isProjection: true`
And the previously-loaded Projection group was a different Group
When the user presses Run after load
Then every **Effort projection band** is computed against `X`'s `members`

Scenario AT-20: Loading two files in a row is wholesale-replace each time
Given the user loads file `A`
And the user then loads file `B`
When the second load is confirmed
Then `groupsStore` matches file `B`'s contents
And file `A`'s Groups are gone

Scenario AT-21: The Save button is reachable any time the Groups tab is visible (including when `groupsStore` is empty)
Given `groupsStore === []`
When the user clicks Save
Then the saved file contains `"groups": []`
And no error fires
And no warning fires

Scenario AT-22: The Load path is reachable any time the Groups tab is visible (including before any CSV load)
Given no **Initiatives CSV** has been loaded yet
And the user navigates to the Groups tab (assume `#results-content` is somehow visible — usually requires a Run, but DevTools can force it)
When the user clicks Load and selects a valid file
Then `groupsStore` is populated
And on subsequent CSV load + Run, the loaded Groups are applied to the new CSV's categories

Scenario AT-23: A loaded file whose `groups` array is missing entirely surfaces an inline error
Given the file is `{ "schemaVersion": 1 }` (no `groups` field)
When loaded
Then an inline error appears reading `"Invalid groups.json: expected an object with a 'groups' array."`
And `groupsStore` is unchanged

Scenario AT-24: A loaded file with the wrong `members` shape (e.g. a string instead of an array) is rejected
Given the file has `{ "schemaVersion": 1, "groups": [{ "name": "X", "color": "#000", "members": "not an array", "isProjection": true }] }`
When loaded
Then an inline error appears
And `groupsStore` is unchanged
(Strict-on-shape, lenient-on-content per ADR-0030.)

Scenario AT-25: A loaded file with multiple `isProjection: true` Groups normalises to exactly one
Given the file has 3 Groups, all with `isProjection: true`
When loaded
Then `groupsStore[0].isProjection === true`
And `groupsStore[1].isProjection === false`
And `groupsStore[2].isProjection === false`
(The first occurrence wins; the rest are demoted. Strict invariant upheld at load time.)

Scenario AT-26: A loaded file with zero `isProjection: true` Groups normalises to the first Group having it
Given the file has 3 Groups, all with `isProjection: false`
When loaded
Then `groupsStore[0].isProjection === true`
And `groupsStore[1].isProjection === false`
And `groupsStore[2].isProjection === false`
(The first row gets the flag by default; strict invariant upheld at load time.)

Scenario AT-27: A loaded file with `groups: []` (zero Groups) sets `groupsStore = []`
Given the file is `{ "schemaVersion": 1, "groups": [] }`
When loaded
Then `groupsStore === []`
And no error fires
And the Groups tab renders with only the `+ New group` row

Scenario AT-28: Round-trip: save + load on the same file yields a `groupsStore` byte-identical to the saved one (modulo non-significant whitespace)
Given an arbitrary `groupsStore` with mixed members (strings + BLANK) and varied colors / projection flag
When the user saves to a file and then loads that same file
Then `JSON.stringify(groupsStore) === JSON.stringify(loadedGroupsStore)` (after the load completes)

Scenario AT-29: The inline error surface clears when a subsequent successful load completes
Given an error is showing from a previous failed load
When the user successfully loads a valid file
Then the inline error surface is hidden

Scenario AT-30: Save / Load do not trigger a Run
Given the user is post-Run, mid-edit on the Groups tab
When the user clicks Save (with edits in `groupsStore`)
Then no Run fires
And the chart / stats / data preview are unchanged
When the user then clicks Load and applies a file
Then no Run fires
And the chart / stats / data preview continue to reflect the *previous* Run until the user presses Run again

### Public entry point

UI:
- The Groups tab toolbar's two buttons.
- The (hidden) file input element that the Load button programmatically clicks.
- The confirmation modal `#groups-load-confirm-overlay`.
- The inline error surface `#groups-load-error`.

In-code:
- `saveGroupsJSON(): void` — serialises `groupsStore` and triggers the download.
- `triggerLoadGroupsJSON(): void` — programmatically clicks the hidden `<input type="file">`.
- The file-input's `change` handler — reads the file via `FileReader.readAsText`, then calls `loadGroupsJSON(text)`.
- `loadGroupsJSON(text): { ok: boolean, error?: string, groups?: Group[] }` — parses, validates, normalises `isProjection` (first-wins or first-by-default), returns either the new groups or an error string.
- `confirmLoadGroupsReplacement(loadedGroups): void` — opens the modal if `groupsStore` is non-trivial; on confirm, replaces `groupsStore` and re-renders the Groups tab; on cancel, no-op.

### Expected observable outcomes

- A `↓ Save groups (JSON)` button downloads `groups.json` with the documented schema.
- A `↑ Load groups (JSON)` button opens a file picker and applies the file (wholesale-replace).
- The **(Blank) sentinel** survives round-trip as `null` in JSON.
- Schema version policy: `1` accepted; `> 1` rejected; missing treated as `1`.
- Parse errors and shape errors surface inline.
- Confirmation modal interposes only on non-trivial replace.
- The `isProjection` invariant is enforced at load time (first-wins or first-by-default).
- Load semantics are commit-on-Run: charts / stats / data preview lag until next Run.

### Test harness

Acceptance tests:
- Location: **N/A — manual.**
- Manual steps (each maps to one or more AT scenarios):
  1. Confirm the Groups tab toolbar has both buttons (AT-1).
  2. Define a few Groups; click Save; open the downloaded `groups.json`; confirm shape and contents (AT-2).
  3. Define a Group with BLANK in `members`; save; confirm the file shows `null` literal (AT-3).
  4. Delete every Group; save; confirm file shows `"groups": []` (AT-4).
  5. Click Load; confirm file picker opens with `.json` accept (AT-5).
  6. Cold-load with two Groups; load a `groups.json` with different Groups; confirm wholesale replace (AT-6).
  7. Load a file with `schemaVersion: 2`; confirm inline error and no replace (AT-7).
  8. Load a file with missing `schemaVersion`; confirm successful load (AT-8).
  9. Load a malformed file; confirm raw parse error surfaces (AT-9).
  10. Load `[1,2,3]`; confirm shape-error inline (AT-10).
  11. With non-trivial `groupsStore`, load a file; confirm modal interposes; cancel; confirm no replace (AT-11, AT-13). Confirm; confirm replace (AT-14).
  12. With trivial `groupsStore` (just auto-default `All`), load a file; confirm no modal (AT-12).
  13. Load a file with `null` in members; confirm chip strip shows `(Blank)` (AT-15).
  14. Load Groups referencing categories absent from CSV; press Run; confirm K=0 and chip shows verbatim (AT-16).
  15. Load file with unknown field; confirm field is dropped and no error (AT-17).
  16. Load file with `isProjection: true` on a different Group than current; press Run; confirm projection band updates (AT-19).
  17. Load file `A`, then file `B`; confirm wholesale-replace on each (AT-20).
  18. Save with empty `groupsStore`; confirm file with `groups: []` (AT-21).
  19. Define Groups, save; modify, save; load the older file; confirm older state restored (round-trip — AT-28).
  20. Load file with missing `groups` field; confirm shape-error inline (AT-23).
  21. Load file with `members: "not an array"`; confirm shape-error inline (AT-24).
  22. Load file with multiple `isProjection: true`; confirm only the first survives (AT-25).
  23. Load file with no `isProjection: true`; confirm the first row gets it (AT-26).
  24. Load file with empty `groups: []`; confirm `groupsStore === []` and only `+ New group` row visible (AT-27).
  25. After an inline error is showing, load a valid file; confirm error clears (AT-29).
  26. Save / Load and confirm no Run fires throughout (AT-30).

Inner tests: N/A.

Verification: manual.

### Proposed implementation seams

Stable seams the tests may target:
- `saveGroupsJSON()` and the resulting `groups.json` schema.
- `loadGroupsJSON(text)` return shape (`{ ok, error?, groups? }`).
- The confirmation modal's DOM (`#groups-load-confirm-overlay`).
- The inline error surface's DOM (`#groups-load-error`).
- The Groups-tab toolbar's two `add-marker-btn` buttons.

Do NOT lock in:
- The exact identity of the hidden `<input type="file">` element (id may be `groups-json-input` or similar).
- The exact phrasing of error messages (must be present and informative; minor wording differences are fine).
- The exact modal layout (must offer Cancel + Replace; visual styling matches the existing Marker-related modals).
- The exact serialisation order of object keys inside each Group (`JSON.stringify` doesn't guarantee key order; tests should compare via `JSON.parse` round-trip, not byte-equal).

### Behavioral rule

The Groups tab toolbar gains two buttons: `↓ Save groups (JSON)` and `↑ Load groups (JSON)`. The Save button serialises `{ schemaVersion: 1, groups: groupsStore.map(g => ({ name: g.name, color: g.color, members: g.members, isProjection: g.isProjection })) }` via `JSON.stringify(..., null, 2)`, wraps the string in a `Blob`, and triggers a download to `groups.json` via the `URL.createObjectURL` + synthetic anchor-click pattern from `saveMarkersToCSV`. The **(Blank) sentinel** — the JavaScript `null` value — serialises natively to the JSON literal `null`; no mapping function is invoked. The Load button programmatically clicks a hidden `<input type="file" accept=".json">`; the file is read via `FileReader.readAsText`, then `JSON.parse` runs against the result. On parse error, the raw error string is surfaced in `#groups-load-error` and `groupsStore` is unchanged. On parse success, the top-level shape is validated: it must be an object with a `groups` array; failure surfaces an inline shape error. The `schemaVersion` field is validated: `schemaVersion === 1` accepts the file; `schemaVersion > 1` surfaces `"This file was saved by a newer version of the simulator."` and rejects the file; missing `schemaVersion` is treated as `1` (back-compat with hand-authored files). Each Group entry's shape is validated: `name: string`, `color: string`, `members: (string | null)[]`, `isProjection: boolean`; failure on any Group surfaces an inline shape error and rejects the file. Unknown fields on a Group are silently ignored (forward-compat). After successful parse + validation, the `isProjection` invariant is normalised at load time: if multiple Groups carry `isProjection: true`, only the first one's flag is preserved (the rest are demoted to `false`); if zero Groups carry the flag, the first Group is promoted to `isProjection: true`. If the *current* `groupsStore` is non-trivial (more than just an auto-default `All` Group — detected by `groupsStore.length > 1 || (groupsStore.length === 1 && groupsStore[0].name !== 'All')`), a confirmation modal interposes: `Cancel` aborts the load; `Replace` writes the parsed groups to `groupsStore` wholesale and re-renders the Groups tab. On a trivial current store, the replace happens immediately without modal. After the replace, the chart, stats table, **Data preview**, **Team Projections** sections do *not* re-render; the user must press **Run Simulation** to see the new shape (commit-on-Run discipline). The Save and Load actions never trigger a Run.

### Invariants

- The `groups.json` schema is `{ schemaVersion: 1, groups: { name, color, members, isProjection }[] }`.
- The **(Blank) sentinel** serialises as the JSON `null` literal in `members` arrays. No magic strings, no wrapper objects.
- `JSON.stringify(..., null, 2)` is the canonical serialisation form (two-space indent).
- The downloaded filename is the literal `'groups.json'`. No timestamp, no Run count, no user prompt.
- The hidden `<input type="file" accept=".json">` exists exactly once in the DOM (inside `#tab-groups`).
- The file-input's `change` handler reads via `FileReader.readAsText` and dispatches `loadGroupsJSON(text)`.
- `loadGroupsJSON` returns `{ ok: false, error: <string> }` on any parse / shape / version failure, and `{ ok: true, groups: Group[] }` on success.
- The version policy is read-permissive within major: `schemaVersion === 1` parses; `schemaVersion > 1` rejects; missing `schemaVersion` is treated as `1`.
- Unknown fields on Group entries are silently dropped during parse — forward-compat for additive schema evolution.
- The `isProjection` invariant is enforced at load time: if zero Groups carry `isProjection: true`, the first Group is promoted; if multiple carry it, only the first wins.
- The confirmation modal interposes iff `groupsStore.length > 1 || (groupsStore.length === 1 && groupsStore[0].name !== 'All')`. Empty store or single auto-default `All` Group skips the modal.
- The modal's `Cancel` (and backdrop click and `Esc`) leaves `groupsStore` unchanged.
- The modal's `Replace` writes the parsed groups to `groupsStore` and re-renders the Groups tab.
- Successful load clears any pre-existing inline error in `#groups-load-error`.
- Save and Load never call `runSimulation` or any rendering function other than `renderGroupsTab`.
- An empty `groupsStore` serialises cleanly to `{ schemaVersion: 1, groups: [] }`.
- Loading `groups: []` sets `groupsStore = []` (the empty state); the Groups tab renders the `+ New group`-only state.

### Counterexamples (must NOT pass)

- A save that omits the `schemaVersion` field. The field is mandatory in the serialised form.
- A save that serialises the (Blank) sentinel as the string `"null"` or `"(Blank)"`. The contract is the JSON literal `null`.
- A save that pretty-prints with non-2-space indentation (e.g. 4-space, tabs, or no indent). The contract is 2-space.
- A save that filters out a Group with `members: []`. Lenient-validation is preserved on save.
- A save that re-orders Groups (e.g. alphabetical by name). The contract is `groupsStore` order.
- A load that accepts `schemaVersion: "1"` (string instead of integer). The contract is integer (or missing → treated as 1).
- A load that silently drops a Group whose shape is invalid instead of rejecting the whole file. The contract is "reject the file on any shape error".
- A load that automatically attempts to migrate a `schemaVersion: 2` file. The contract is to reject with the "newer version" message.
- A load that fails on unknown fields. Unknown fields are silently dropped (forward-compat).
- A load that retains the previous `groupsStore`'s `isProjection: true` flag when the loaded file specifies a different Group's flag. The loaded file's `isProjection` wins.
- A load that interposes the modal on a trivial store. The trivial-skip is the contract.
- A load that fails to interpose the modal on a non-trivial store. The modal is mandatory there.
- A load that triggers a Run after applying. Save / Load never trigger Runs.
- A save that triggers a download even when `groupsStore === []` — actually allowed, this *is* the contract (saves `{ "groups": [] }`).
- A load that *also* mutates `editedInitiatives` (e.g. to add referenced-but-absent categories). The Initiatives CSV is the source of truth for categories present; loaded Group members may reference absent categories silently.
- A load that *also* sets the chart to a "preview" state showing the loaded Groups before the user presses Run. Commit-on-Run is the contract.
- A save that prompts the user for a filename. The filename is hardcoded `groups.json`.
- A confirmation modal that does not appear inside a backdrop overlay (visual contract matches the Marker dialog's overlay style).
- A confirmation modal whose `Replace` button is the default focus / `Enter`-bound action without an explicit Cancel-first focus (Safety-first; the user must consciously confirm).
- A load that does not clear the inline error on subsequent success.

### Forbidden shortcuts

- Do not introduce a `localStorage` cache as a "convenience" auto-load on page reload. Persistence is user-driven file save/load only per ADR-0002 and ADR-0030.
- Do not introduce auto-save on Group edits. Save is user-driven.
- Do not introduce a "preview before replace" overlay. The modal is Cancel/Replace only.
- Do not introduce an additive-merge mode behind a toggle. Wholesale-replace is the only mode per ADR-0030.
- Do not bundle Markers, sidebar inputs, or `editedInitiatives` into the saved file. Each artefact persists independently per ADR-0030.
- Do not invent a separate `BlankSentinel` magic string. The (Blank) sentinel is `null` end-to-end (JS memory + JSON disk).
- Do not introduce a schema-version migration shim for a hypothetical v2. Listed as a future revision in ADR-0030; when v2 lands, the shim is added then.
- Do not introduce a per-file checksum / signature / encryption. The file is plain JSON readable / editable by hand.
- Do not introduce drag-drop file upload to the Groups tab. Listed as a future revision in ADR-0030.
- Do not migrate the **Marker CSV** to `markers.json` as part of this feature. Listed as a future revision in ADR-0030.

### RED gate

Before the implementation session starts (after Phases 1 + 2 have landed):
- Manual step 1: there are no `↓ Save groups (JSON)` / `↑ Load groups (JSON)` buttons.
- Manual step 2: `saveGroupsJSON` is `undefined`.
- Manual step 5: clicking nothing opens any file picker for JSON.
- Manual step 9: there is no inline error surface for parse errors.
- Manual step 11: there is no confirmation modal.

### Test immutability rule

There are no test files to freeze (manual harness).

### Definition of done

- [ ] Manual scenarios AT-1 through AT-30 all pass.
- [ ] The Groups tab toolbar has both `↓ Save groups (JSON)` and `↑ Load groups (JSON)` buttons.
- [ ] `saveGroupsJSON()` serialises `{ schemaVersion: 1, groups: [...] }` and downloads `groups.json`.
- [ ] The (Blank) sentinel survives the round-trip as JSON `null` and JS `null`.
- [ ] `loadGroupsJSON(text)` returns the documented result shape and handles parse / shape / version errors.
- [ ] The confirmation modal interposes iff the current `groupsStore` is non-trivial.
- [ ] `isProjection` invariant is enforced at load time (first-wins or first-by-default).
- [ ] Unknown fields on Group entries are silently dropped during parse.
- [ ] Save / Load never trigger a Run.
- [ ] Loaded categories absent from the current CSV are preserved verbatim in `members` and silently match zero at Run time.
- [ ] No engine code, no Phase 1 substrate code, no Phase 2 Groups-tab edit-handler code is modified beyond adding the toolbar buttons and the load-replace hook.
- [ ] `git diff` for this phase touches only `index.html` (plus this plan and CONTEXT.md if material clarifications surface).
