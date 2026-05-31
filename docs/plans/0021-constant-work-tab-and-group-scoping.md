# Feature: Editable Constant work tab + constant work scoped to Groups by Category and quarter

Created at: 2026-05-30T07:22:10Z

## Context

This feature makes **Constant work** a first-class, editable, Category-addressable body of work in the single-file app `index.html`. Today constant work is an upload-only, opaque scalar: every row's deterministic person-months are summed and added identically to *every* **Scenario** (one global `fixedEffort` scalar), and the **Category** on a constant-work row is read only for the **Initiative matrix** badge — it never influences the engine. Two ADRs change that:

- [ADR-0033 — Constant work scoped to Groups by Category](../adr/0033-constant-work-scoped-to-groups-by-category.md) (amends [ADR-0023](../adr/0023-constant-work-csv-deterministic-shift.md)). The deterministic-shift *mechanism* (closed-form lognormal mean via `tshirtToPersonMonths`, applied as a post-sort additive shift that preserves Monte Carlo sort order, following the **Synthetic ↔ Empirical** toggle) is retained unchanged. What changes is the *scope*: the single global `fixedEffort` scalar becomes a per-**Group** vector — for each Group, sum the effort of constant-work rows whose **Category ∈ `group.members`** and apply *that* sum as that Group's shift. Constant work still never enters the K / **Poisson λ** / **Bootstrap pool** machinery. The scoping applies on all three simulation surfaces (org headline, **Team Level tab**, **Team Projections tab**); constant-work quarters become selectable as **Target quarters** (only); and constant work whose Category is in no Group is excluded from the simulation but surfaced (never silently dropped).
- [ADR-0034 — Editable Constant work tab with add/delete rows and CSV export](../adr/0034-editable-constant-work-tab.md) (parallels [ADR-0027](../adr/0027-editable-initiatives-tab-with-csv-export.md)). A new sixth **Tab** — **Constant work** (`#tab-constant-work`) — renders every constant-work row in an editable table under commit-on-Run discipline, with smart per-field editors, `+ Add row`, per-row delete, from-scratch authoring, and `↓ Export CSV`. A new mutable `editedConstantWork` (per-row shallow clone of `parsedConstantWork`) becomes the simulation source of truth.

The feature spans **eight plan-phases**. Each is a thin vertical slice with one user- or system-observable outcome, a clean RED gate, and a standalone-reviewable diff:

1. **`editedConstantWork` substrate (transparent indirection)** — clone at load, reset on clear, migrate the constant-work readers. Output unchanged. (ADR-0034 substrate; mirrors feature 0019 Phase 1.)
2. **Per-Group constant-work shift at the org headline** — `fixedEffortPerGroup` replaces the scalar `fixedEffort`; the auto-default `All` Group unions constant-work Categories. (ADR-0033 core. **Changes the `runSimulation` contract** — see the test-migration note below.)
3. **Team Level surface honors Category-scoping** — per-team `fixedEffortPerGroup` (team match AND Category membership).
4. **Team Projections surface honors Category-scoping** — each (team, quarter) cell's constant work is scoped to the **Projection group**'s members; the degenerate no-Projection-group fallback is resolved.
5. **Constant-work quarters in the Target selector + Data preview surfacing** — constant-work quarters union into `#target-ms` (not `#hist-ms`); the **Data preview** shows per-Group constant-work PM and an "in no group … excluded" line.
6. **Constant work tab — editable table + smart editors + Export CSV** — the sixth Tab rendering `editedConstantWork`, commit-on-Run.
7. **Add row / delete row / from-scratch authoring** — the ADR-0034 delta over the read-only-shaped Initiatives tab.
8. **Groups Members popover lists initiatives ∪ constant-work Categories (merge)** — constant-work Categories become targetable by Groups; a Category in both is merged.

> **Test-contract migration (load-bearing).** This feature deliberately changes two committed contracts, so existing feature-0020 tests must be migrated **during test authoring** (the `/phase-atdd` session for the relevant phase), not during implementation. Per the per-phase *Test immutability rule*, the migrated tests are frozen before that phase's implementation begins, and the implementation session does not touch them.
> - **Phase 1** migrates `tests/acceptance/phase-1-engine.test.js` **AT-21** and **AT-27** (they assign `parsedConstantWork` directly; after the substrate swap the readers read `editedConstantWork`).
> - **Phase 2** migrates `tests/acceptance/phase-1-engine.test.js` **AT-11, AT-12, AT-13, AT-14, AT-25, AT-26, AT-27**, plus `tests/verification/sanity-check-engine-mean.test.js` (the engine-mean identity becomes per-Group: `mean_g ≈ K_g × λ × E[size] + fixedEffortPerGroup[g]`) and `tests/verification/phase-1-2-review-01.test.js` (`fixedEffort: 0` → `fixedEffortPerGroup: [0, …]`). **AT-12 changes semantics**: a zero-member Group's shift is now the sum of constant work in `[]` (i.e. `0`), not the old scalar.
> - **Phase 6** migrates `tests/acceptance/phase-2-groups-tab.test.js`'s tab-count assertion (five → six tabs).
> - **Phase 8** migrates `tests/acceptance/phase-2-groups-tab.test.js` **AT-28** (the Members popover now sources from `editedInitiatives ∪ editedConstantWork`).

Architectural constraints inherited from earlier decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). Every change in every phase lands inline in `index.html` — markup, CSS, data model, render functions, export helpers.
- [ADR-0002 — Client-side only](../adr/0002-client-side-only.md). No backend, no `localStorage`; `editedConstantWork` is ephemeral in-memory state, persisted only via the user-driven `↓ Export CSV`.
- [ADR-0011 — Overlapping histograms with shared bins](../adr/0011-overlapping-histograms-shared-bins.md). The **Global histogram range** is shared across all Group datasets; its `globalMin` changes (see Data models).
- [ADR-0017 — Multi-quarter selectors](../adr/0017-multi-quarter-selectors.md). The `MultiSelect` widget instances `histMS`/`targetMS` are reused; their *sources* diverge in Phase 5.
- [ADR-0018 — Tab-based results layout](../adr/0018-tab-based-results-layout.md). The Constant work tab is the sixth result Tab, pre-rendered per Run, sharing the existing tab-bar / tab-panel skeleton and generic tab-switch handler.
- [ADR-0023 — Constant Work CSV deterministic shift](../adr/0023-constant-work-csv-deterministic-shift.md) (amended by ADR-0033/0034). The deterministic effort mechanism and the fixed CSV schema are retained; the global-scalar scope is replaced.
- [ADR-0027 — Editable Initiatives tab with `editedInitiatives` as source of truth](../adr/0027-editable-initiatives-tab-with-csv-export.md). The editable-tab + commit-on-Run + immutable-substrate pattern this feature copies for constant work.
- [ADR-0028 — Category as generalized MoSCoW](../adr/0028-category-as-generalized-moscow.md). The case-insensitive (`trim` + case-fold) Category comparison and the **(Blank) sentinel** this feature reuses for constant-work bucketing.
- [ADR-0029 — User-defined Groups supersede cumulative MoSCoW](../adr/0029-user-defined-groups-supersede-cumulative-moscow.md). The user-defined Group model this feature extends to constant work.
- [ADR-0030 — JSON persistence for Groups](../adr/0030-json-persistence-for-groups.md). Unchanged; constant work is **not** bundled into `groups.json`.
- [ADR-0031 — Vitest + jsdom test harness](../adr/0031-vitest-jsdom-test-harness.md). All phases are tested through the automated harness (`tests/harness.js`, `npm test`), **not** a manual checklist.
- [ADR-0033](../adr/0033-constant-work-scoped-to-groups-by-category.md), [ADR-0034](../adr/0034-editable-constant-work-tab.md) — the design rationale this plan implements.

Glossary terms used throughout (see [CONTEXT.md](../../CONTEXT.md)): **Constant work**, **Constant Work CSV**, **Constant work tab**, **Initiative**, **Initiatives CSV**, **Initiatives tab**, **Category**, **(Blank) sentinel**, **Group**, **Projection group**, **Scenario**, **Run**, **Iteration**, **Tab**, **Tab panel**, **Groups tab**, **Team Level tab**, **Team Projections tab**, **Initiative matrix**, **Effort projection band**, **Data preview**, **Quick projection Monte Carlo**, **Target quarter**, **Quarter selector**, **MultiSelect**, **Global histogram range**, **Poisson λ**, **Bootstrap pool**, **Recognised t-shirt sizes**, **Synthetic** / **Empirical** parameters.

## User-visible behavior

A user who has loaded a **Constant Work CSV** and pressed **Run Simulation** sees constant work behave as a per-**Group**, Category-scoped commitment rather than a uniform shift applied to every **Scenario**. A constant-work row categorised `Backend` now lifts only the Groups whose **members** include `Backend`; a Group whose members do not include `Backend` is unaffected; a constant-work row whose Category is in *no* Group is counted nowhere (but surfaced — see below). The lift is purely additive deterministic effort: it never changes any Group's `K`, the **Poisson λ**, or the **Bootstrap pool**. This Category-scoping is consistent on the org headline chart/stats, on every per-team section of the **Team Level tab**, and on every (team, quarter) cell of the **Team Projections tab** — where a cell now shows only the constant work whose Category is in the **Projection group**'s members (in the **Effort projection band** and in the appended soft-green **Initiative matrix** rows).

A user who opens the **Target quarter** selector sees quarters that exist only in the **Constant Work CSV** listed as selectable targets; the **Historical quarter** selector does *not* list them (constant work cannot inform λ or the bootstrap pool). Selecting a target quarter that exists only in constant work yields a pure-constant-work forecast — every Group's `K = 0`, each Group sitting at its own deterministic shift.

A user who reads the **Data preview** sees, beside each per-Group `K` row, the constant-work person-months folded into that Group, plus a dedicated line reporting any constant work outside all Groups (e.g. `Constant work in no group: 12 PM across 3 rows — excluded`). Nothing is dropped silently.

A user who clicks the new **Constant work** tab (the sixth tab, after **Initiatives**) sees every constant-work row in a wide editable table. Unlike the **Initiatives tab**, *all* cells are editable: the `tshirt_size` cell is a `<select>` constrained to the seven **Recognised t-shirt sizes** (`2XS … XL+`), closing the silent-0-PM footgun; the `category`, `team`, and `quarter` cells are `<input list>` datalist combos seeded from the observed union of initiatives and constant work (so the user can pick an existing value — the merge path — or type a new one); the `jira_key`, `epic_name`, `key_result`, and any unknown extra columns are free-text inputs. A toolbar `↓ Export CSV` button downloads `constant-work-edited.csv`, echoing the imported file's headers verbatim (alias spellings and extra columns included), so a re-import reproduces the identical model. Edits commit immediately to the in-memory model but the charts and stats lag until the next **Run** — the same rhythm the user already knows from the Initiatives and Groups tabs.

A user can also press `+ Add row` to append a blank row (the canonical constant-work schema when nothing was imported, otherwise the imported header set) and a per-row delete to remove one immediately with no confirmation. With nothing imported at all, the tab shows an empty table plus `+ Add row`, letting the user author constant work from zero and export it.

A user who opens the Groups **Members** popover sees constant-work Categories listed alongside initiative Categories; a Category that appears in both is a single merged entry (with the Initiative's casing). Adding a constant-work-only Category to a Group is how the user targets that constant work; until they do, it is surfaced as excluded in the Data preview.

A user who has loaded *no* constant work at all sees no change anywhere: the simulation, the preview, the selectors, and the tabs behave exactly as before this feature (transparent indirection).

## Scope

### In scope

**Phase 1 — `editedConstantWork` substrate:**
- A new module-scoped `let editedConstantWork = null;` beside `parsedConstantWork` (`index.html:1559`).
- `loadConstantWorkCSV` (`index.html:1743`) sets `editedConstantWork = parsedConstantWork.map(r => ({ ...r }))` immediately after `parsedConstantWork = parseCSV(text)`.
- `resetConstantWorkFile` (`index.html:1733`) sets `editedConstantWork = null` (alongside `parsedConstantWork = null`).
- Migration of every *production* constant-work reader to `editedConstantWork`: `getConstantWorkEffort` (`index.html:1752-1763`), `getConstantWorkEpics` (`index.html:1770-1789`), and the `cwQuarters` derivation inside `buildTeamProjections` (`index.html:2109-2114`). `parsedConstantWork` is retained as the immutable substrate for the Phase 6 datalist option pools.

**Phase 2 — Per-Group constant-work shift at the org headline:**
- A per-Group constant-work effort vector: a computation that buckets `editedConstantWork` rows (whose `quarter ∈ targetQuarters`) by **Category** membership — for each Group in `groupsStore`, sum `tshirtToPersonMonths(size)` over rows whose normalised Category ∈ `group.members` (case-insensitive `trim` + the **(Blank) sentinel**), producing a `number[]` aligned index-for-index with `kPerGroup`/`groups`. Seam: implemented either as a new `getConstantWorkEffortPerGroup(quarters, groups, teamName?)` helper or by extending `getConstantWorkEffort` to take a members filter — the contract is the aligned vector.
- `prepareSimulationData` (`index.html:1866-1947`) returns `fixedEffortPerGroup` (org-wide, all teams) alongside `kPerGroup`.
- `runSimulation` (`index.html:2272`) replaces the scalar `fixedEffort = 0` parameter with `fixedEffortPerGroup: number[]`: the per-Group shift block (`index.html:2291-2296`) shifts each Group's distribution by *its own* entry; `globalMin = Math.min(...fixedEffortPerGroup)` (`index.html:2300`); `globalMax = Math.max(...shifted.map(p995), Math.max(...fixedEffortPerGroup) + 1)`; the returned object reports `fixedEffortPerGroup`.
- The org run-button handler (`index.html:4154-4161`) replaces `orgFixedEffort = getConstantWorkEffort(targetQs)` (scalar) with the org-wide `fixedEffortPerGroup` and passes it to `runSimulation`.
- The auto-default `All` Group (`index.html:1583-1591`) derives its `members` from the union of observed Categories across `editedInitiatives` **and** `editedConstantWork` (incl. BLANK), (re)derived on any CSV load (initiatives **or** constant work) while `groupsStore` is still the pristine auto-default; once the user modifies groups (Phase 2 of feature 0020 edit handlers / JSON load), no further auto-sync occurs.

**Phase 3 — Team Level surface:**
- `prepareTeamSimulationData` (`index.html:1960-2060`) replaces the per-team scalar `fixedEffort: getConstantWorkEffort(targetQuarters, teamName)` (`index.html:2057`) with a per-team `fixedEffortPerGroup` (the team match AND-composes with Category membership).
- `renderTeamSection` (`index.html:2611`) and the per-team `runSimulation` call consume `fixedEffortPerGroup` in place of the team scalar.

**Phase 4 — Team Projections surface:**
- `buildTeamProjections` (`index.html:2073-2175`): each (team, quarter) cell scopes its constant work to the **Projection group**'s members — the displayed `cwEpics` (matrix rows, `index.html:2119`/`2143`) and the `cwEffort` band floor (`index.html:2146`) include only constant-work rows whose Category ∈ `projGroup.members` (case-insensitive + BLANK). The single-group projection `runSimulation` call (`index.html:2160-2166`) passes `fixedEffortPerGroup: [scopedCwEffort]`.
- Degenerate fallback (resolves handover open-question): when **no** Projection group exists, or `groupsStore` is empty, the cell falls back to the constant-work-only flat band using **all** constant work for that (team, quarter) — preserving ADR-0023's degenerate behaviour. Category-scoping applies only when a Projection group exists.

**Phase 5 — Quarters + Data preview surfacing:**
- `refreshQuarters` (`index.html:1624-1643`) sources the **target** selector from `initiatives ∪ epics ∪ editedConstantWork` quarters and the **historical** selector from `initiatives ∪ epics` (unchanged) — the two `populate` calls (`index.html:1641-1642`) take different lists.
- `prepareSimulationData`'s `preview` (`index.html:1934-1944`) gains per-Group constant-work PM (the org `fixedEffortPerGroup`) and an "excluded" summary (PM + row count of constant work in target quarters whose Category matches no Group's members).
- `renderPreview` (`index.html:2997-3034`) renders the per-Group constant-work PM beside each per-Group `K` row and a dedicated "Constant work in no group … excluded" line.

**Phase 6 — Constant work tab:**
- A sixth tab button `<button class="tab-btn" data-tab="constant-work">Constant work</button>` inserted **after** the `initiatives` button (`index.html:1019`) and before `groups`.
- A sixth tab panel `<div id="tab-constant-work" class="tab-panel" style="display:none"><div id="constant-work-table-wrap"></div></div>` inserted after `#tab-initiatives` (`index.html:1056`) and before `#tab-groups`.
- CSS for `#constant-work-table-wrap` (mirroring `#initiatives-table-wrap`) and the toolbar.
- `renderConstantWorkTable()` modelled on `renderInitiativesTable` (`index.html:3324-3396`): reads `editedConstantWork`; renders all cells editable; `tshirt_size`/`t_shirt_size` as a `<select>` of the seven **Recognised t-shirt sizes**; `category`/`team`/`quarter` (and recognised aliases) as `<input list>` datalist combos seeded from the observed union of `editedInitiatives` ∪ `editedConstantWork`; `jira_key`/`epic_name`/`key_result` and unknown extra columns as free-text inputs; a `↓ Export CSV` toolbar button.
- `exportConstantWorkCSV()` modelled on `exportInitiativesCSV` (`index.html:3829-3839`): `Papa.unparse(editedConstantWork)` → download `constant-work-edited.csv`, preserving the imported header set verbatim.
- `renderConstantWorkTable()` called inside the run-button handler (`index.html:4179` neighbourhood, after `renderInitiativesTable()`); `#tab-constant-work` added to the visibility-reset block (`index.html:4191-4195`).
- The Constant work tab's edit handlers call `tryUpdatePreview` so the **Data preview** reflects pending edits.

**Phase 7 — Add / delete rows + from-scratch authoring:**
- A `+ Add row` control appending a blank row to `editedConstantWork`: the canonical schema (`jira_key, epic_name, key_result, category, team, quarter, tshirt_size`) when there is no imported header set to mirror, otherwise the imported header set.
- A per-row delete control (immediate, no confirmation).
- From-scratch authoring: with nothing imported, the tab shows an empty table + `+ Add row`; the first add initialises `editedConstantWork = []` then appends (with `parsedConstantWork` remaining `null`).

**Phase 8 — Groups Members popover merge:**
- The Members popover's observed-Categories source (feature 0020 Phase 2's `openMembersPopover` / equivalent, `index.html:3460-3520` neighbourhood) sources from the union of Categories across `editedInitiatives` **and** `editedConstantWork`, computed at popover-open time. A Category present in both is one entry; the Initiative's casing wins on a merge; a constant-work-only Category keeps its own casing; the union dedups case-insensitively.

### Out of scope

- **A Duplicate-row action** on the Constant work tab. Listed as a future revision in ADR-0034. (The Groups tab has one; the Constant work tab does not in this feature.)
- **`localStorage` / browser-storage persistence of `editedConstantWork`.** Persistence is the user-driven `↓ Export CSV` only. Per ADR-0002 / ADR-0034.
- **Any Run-time blocking validation or gate when constant work falls outside all Groups.** The only surfacing is the **Data preview** "excluded" line (Phase 5). No alert, no modal, no Run gate. Per ADR-0033 (lenient-validation philosophy).
- **Promoting constant work to a stochastic-with-tight-CV mode.** Constant work stays deterministic. Would re-open ADR-0023/0033.
- **Surfacing the per-Group constant-work shift as a vertical chart marker.** Additive future revision per ADR-0033; not built here.
- **Back-porting `+ Add row` / delete to the Initiatives tab.** Would require solving the orphaned-key problem with the Epics CSV; would re-open ADR-0027. Per ADR-0034.
- **Constant work informing Poisson λ or the Bootstrap pool.** Constant work never enters the historical selector, λ fitting, or the bootstrap pool. Per ADR-0033 (the two selectors diverge in source).
- **A Group targeting constant work by team or quarter independently of Category.** Category membership is the sole binding between a Group and its constant work. Would re-open ADR-0033.
- **Bundling `editedConstantWork` into `groups.json`.** Each artefact persists independently. Per ADR-0030.
- **Changing the Initiatives tab affordances, the Groups tab edit handlers, the Marker system, the lognormal parameter toggle, or the Monte Carlo engine internals** (`runScenario`, `sampleLognormal`, `Xoshiro128ss`, `computeStats`, `buildHistogram`). Only `runSimulation`'s shift/`globalMin` block and its parameter shape change (Phase 2).
- **Auto-syncing the auto-default `All` Group to constant-work Categories loaded *after* the user has modified Groups.** Once the user touches Groups, auto-sync stops; later-loaded constant-work Categories outside all Groups are surfaced as excluded (Phase 5), not auto-added. (See *Open assumptions*.)

## Relevant existing files

Claude may inspect:
- `index.html`, specifically:
  - `parsedConstantWork` declaration (`index.html:1559`) and `loadConstantWorkCSV` / `resetConstantWorkFile` (`index.html:1733-1746`) — the clone / reset insertion points (Phase 1).
  - `getConstantWorkEffort` (`index.html:1752-1764`) and `getConstantWorkEpics` (`index.html:1770-1789`) — the readers migrating to `editedConstantWork` (Phase 1) and gaining a Category/members dimension (Phases 2-4).
  - `bucketRowsByGroups` (`index.html:1824-1857`) — the **initiative**-row bucketer; the per-Group constant-work effort vector is its sibling (operates on constant-work rows, sums effort instead of counting). Read for the casing-map / BLANK-membership pattern (Phase 2).
  - `collectObservedCategories` (`index.html:1603-1617`) and `buildCategoryCasingMap` (`index.html:1806-1814`) — reused for the auto-default union (Phase 2) and the Members popover union (Phase 8).
  - `prepareSimulationData` (`index.html:1866-1947`) — returns `kPerGroup`/`preview`; gains `fixedEffortPerGroup` + preview surfacing (Phases 2, 5).
  - `prepareTeamSimulationData` (`index.html:1960-2060`), esp. the per-team scalar at `index.html:2057` (Phase 3).
  - `buildTeamProjections` (`index.html:2073-2175`), esp. `projGroup` (`2091`), `cwQuarters` (`2109`), `cwEpics`/`cwEffort` (`2119`, `2146`), and the projection `runSimulation` call (`2160-2166`) (Phases 1, 4).
  - `runSimulation` (`index.html:2272-2321`) — the shift block (`2291-2296`) and `globalMin`/`globalMax` (`2300-2304`) (Phase 2).
  - The auto-default `All` Group block inside `loadInitiativesCSV` (`index.html:1580-1591`) (Phase 2).
  - `refreshQuarters` (`index.html:1624-1643`) and `extractQuarters` (`index.html:1127`) (Phase 5).
  - `renderPreview` (`index.html:2997-3034`) and `tryUpdatePreview` (`index.html:3060-3066`) (Phases 5, 6).
  - The tab bar (`index.html:1015-1021`) and tab panels (`index.html:1023-1068`); the visibility-reset block (`index.html:4191-4196`); the generic tab-switch handler (`index.html:4085-4101`) — *for layout/insertion context* (Phase 6).
  - `renderInitiativesTable` (`index.html:3324-3396`) and `getUniqueColumnValues` (`index.html` Module 7) — the template for `renderConstantWorkTable` (Phases 6, 7).
  - `exportInitiativesCSV` (`index.html:3829-3839`) — the template for `exportConstantWorkCSV` (Phase 6).
  - `T_SHIRT_PARAMS` (`index.html:1283`), `tshirtToPersonMonths` (`index.html:1326`), `normalizeSize` (`index.html:1546`), `normalizeCategory` (`index.html:1539`), `BLANK` (`index.html:1553`) — for the size `<select>` options and bucketing (Phases 2, 6).
  - `escapeHtml` / `escapeAttr` (`index.html:3110-3122` neighbourhood) — every render path uses both.
  - The run-button handler's render sequence (`index.html:4130-4196`) — the render-call insertion point (Phase 6).
  - The Groups Members popover (`openMembersPopover` / equivalent, `index.html:3460-3520` neighbourhood) — the popover-source change (Phase 8).
- `CONTEXT.md` glossary — the terms listed in the *Context* section.
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md`, `docs/adr/0034-editable-constant-work-tab.md`, and the amended `docs/adr/0023-constant-work-csv-deterministic-shift.md` — the design rationale this plan implements.
- `docs/plans/0019-editable-initiatives-tab.md` and `docs/plans/0020-category-and-groups.md` — prior plans, for plan-document shape and the `editedInitiatives` / `groupsStore` / Groups-tab touchpoints this feature extends.
- `tests/harness.js` — the test harness (`loadSimulator`, `read`, `typeOf`, `evalIn`, `execIn`, `csv`); `tests/acceptance/phase-1-engine.test.js` and `tests/acceptance/phase-2-groups-tab.test.js` — the engine/tab tests this feature extends and migrates.

Claude should not inspect unless needed:
- The Monte Carlo engine internals (`runScenario`, `sampleLognormal`, `Xoshiro128ss`, `computeStats`, `buildHistogram`).
- The CSV parsing helpers (`parseCSV`, PapaParse usage) beyond the constant-work load path.
- The chart marker plugin internals beyond the dataset list.
- The lognormal parameter mode toggle (ADR-0026 territory) — read only to confirm `activeParams` still drives `tshirtToPersonMonths`.
- The Groups tab JSON save/load (ADR-0030) — unchanged by this feature.

## Existing patterns to follow

- **One-file layering inside `index.html`.** Every change lands inline. The `editedConstantWork` binding lives next to `parsedConstantWork` in the Data Cache module. The per-Group constant-work helper lives near `getConstantWorkEffort` / `bucketRowsByGroups`. `renderConstantWorkTable` / `exportConstantWorkCSV` live in a new sub-module mirroring the Initiatives-tab module. The tab markup lives in the `#results-content` block; CSS in the Module 1 `<style>` block. No new file is created.
- **Two parallel arrays, never a merged structure.** `parsedConstantWork` is the immutable parse output; `editedConstantWork` is the mutable simulation source of truth. Do not introduce a third "merged view" or a getter that resolves edits-over-parsed lazily — mirrors ADR-0027.
- **`editedConstantWork` is a `let`, not a `const`.** Reassigned on every `loadConstantWorkCSV` (fresh clone) and on `resetConstantWorkFile` (`null`); set to `[]` on first from-scratch `+ Add row` (Phase 7). Its *contents* are mutated by the inline edit handlers; the array itself is wholesale-reassigned only at the file-lifecycle boundaries.
- **Shallow-clone-per-row at load time:** `parsedConstantWork.map(r => ({ ...r }))`. CSV cells are strings; no deep clone, no `structuredClone`, no `JSON.parse(JSON.stringify(...))`.
- **Engine reads `editedConstantWork`; datalists read `parsedConstantWork` for stable option pools** — mirrors the ADR-0027 `editedInitiatives` / `parsedInitiatives` split. (The Members popover (Phase 8) and the Constant-work-tab datalists (Phase 6) deliberately source from the *edited* union so the user can target the current edited state; the *immutable* `parsedConstantWork` substrate is retained for any stable-pool needs.)
- **`null` is the (Blank) sentinel** (`const BLANK = null;`, `index.html:1553`). `members.includes(BLANK)` is the membership test. No `(Blank) ↔ null` mapping function.
- **Case-insensitive Category matching with first-seen casing for display** — `trim` + `toLowerCase()` for equality (per ADR-0028), consulting a transient per-call `Map<lowercased, firstSeenCasing>` built via `buildCategoryCasingMap`. On a merge of initiative + constant-work Categories, seed the casing map from initiatives first (Initiative casing wins).
- **Commit-on-Run discipline** (ADR-0027, ADR-0029, ADR-0034): edits commit to `editedConstantWork` immediately via inline `onchange`/`onclick` handlers, but the chart, stats table, **Data preview**, **Team Level**, and **Team Projections** surfaces do not update until the user presses **Run Simulation**. The Constant work tab is re-rendered as part of the Run cycle.
- **Inline `onchange` / `onclick` handlers writing directly to `editedConstantWork[rowIdx][col] = this.value`** — no delegated listener, no virtual-DOM diff, no per-cell controller. The Initiatives-tab pattern (`index.html:3373`) is the template.
- **Single-`innerHTML`-assignment render**: `renderConstantWorkTable` builds the whole table as a string and assigns to `#constant-work-table-wrap.innerHTML` once. Re-render after every add/delete and on every Run.
- **`escapeHtml` for cell text, `escapeAttr` for attribute values** — every render path uses both; the inline-handler `safeCol` is `escapeAttr`'d.
- **Toolbar buttons reuse `.add-marker-btn`** — the `↓ Export CSV` button shares the chart-card export-button styling, consistent with the Initiatives tab and Marker CSV buttons.
- **`fixedEffortPerGroup` is a plain `number[]` aligned with the `groups` snapshot** — same length and order as `kPerGroup`. The Run captures `groupsStore.slice()` as the snapshot (`index.html:4155`); the vector is computed against that snapshot order.
- **Test harness (ADR-0031):** automated. Tests live under `tests/acceptance/phase-N-<slug>.test.js`, load the page via `loadSimulator()` from `tests/harness.js`, reach lexical bindings via `read(win, name)`, call functions via `evalIn(win, expr)`, mutate state via `execIn(win, stmt)`, and build CSV fixtures via `csv(rows, headers)`. The verification command is `npm test` (`vitest run`) or a single file via `npx vitest run tests/acceptance/phase-N-<slug>.test.js`.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.
> Use **Constant work**, **Constant work tab**, **Category**, **Group**,
> **Projection group**, **(Blank) sentinel**, **Scenario**, **Run**,
> **Target quarter**, **Effort projection band** throughout. The one engine
> field being *introduced* is `fixedEffortPerGroup` (replacing the scalar
> `fixedEffort`); the one being *removed* is the scalar `fixedEffort` on
> `runSimulation`.

## Data models

No persistence layer beyond the user-driven `constant-work-edited.csv` export (a user artefact, not application-managed). In-memory state owned by this feature:

```js
// Module 4 — Data Cache.

let parsedConstantWork = null;   // existing — immutable parse output. Retained as the
                                 //   datalist option-pool substrate (Phase 6).
let editedConstantWork = null;   // ← NEW (Phase 1): per-row shallow clone of
                                 //   parsedConstantWork; the simulation source of truth.
                                 //   `null` when no CSV loaded; `[]` when authored from
                                 //   scratch (Phase 7); RowObject[] when loaded/edited.

// A constant-work row object (RowObject) carries whatever columns the imported
// CSV had. The canonical schema (used for from-scratch rows, Phase 7) is:
//   { jira_key, epic_name, key_result, category, team, quarter, tshirt_size }
// Recognised alias spellings (read by the consumers) include:
//   tshirt_size | t_shirt_size ; epic_name | building_block ; jira_key | epic_key ;
//   key_result | KR | kr ; category | moscow | emoji  (the ADR-0023 cascade).
```

The per-Group constant-work effort vector (Phases 2-4):

```js
// Sum tshirtToPersonMonths(size) over editedConstantWork rows whose quarter ∈ quarters
// (and, for team scope, whose team matches teamName case-insensitively), bucketed by
// Category membership: one entry per Group in `groups`, aligned with kPerGroup.
//   members match: trim + case-fold on strings; BLANK ∈ members matches a BLANK Category.
// Seam: a new getConstantWorkEffortPerGroup(quarters, groups, teamName = null): number[]
//   OR an extension of getConstantWorkEffort with a members filter. Contract = the vector.
```

`runSimulation` signature change (Phase 2) — the scalar `fixedEffort` becomes a per-Group vector:

```js
// BEFORE:
//   runSimulation({ lambda, epicSizingDist, kPerGroup, groups, capacity, iterations,
//                   fixedEffort = 0 })
//     → shifts EVERY Group's distribution by the single scalar `fixedEffort`;
//       globalMin = fixedEffort; returns { results, globalMin, globalMax, fixedEffort }.
//
// AFTER:
//   runSimulation({ lambda, epicSizingDist, kPerGroup, groups, capacity, iterations,
//                   fixedEffortPerGroup = [] })
//     → shifts results[i].sorted by fixedEffortPerGroup[i] (default 0 if absent);
//       globalMin = min(fixedEffortPerGroup) (or 0 when empty);
//       globalMax = max(p995 across shifted, max(fixedEffortPerGroup) + 1);
//       returns { results, globalMin, globalMax, fixedEffortPerGroup }.
//   Constant work contributes ZERO to kPerGroup / λ / the bootstrap pool — the vector is
//   purely an additive post-sort shift, applied per Group.
```

The `preview` object (Phase 5) gains:

```js
// preview.fixedEffortPerGroup : number[]  — org-wide per-Group constant-work PM (aligned
//                                            with kPerGroup/groupNames).
// preview.cwExcludedPM        : number     — total PM of target-quarter constant work whose
//                                            Category is in no Group's members.
// preview.cwExcludedRows      : number     — count of such rows.
```

The export (Phase 6): `Papa.unparse(editedConstantWork)` → `constant-work-edited.csv`, header order = `Object.keys(editedConstantWork[0])` (the imported header set, or the canonical schema for from-scratch rows). No alias normalisation, no column reordering.

No new module file, no new class, no new event bus. The state is one new binding (`editedConstantWork`), the rename of `runSimulation`'s scalar parameter to a vector, and the new render/export functions.

---

## Phase 1: `editedConstantWork` substrate — clone at load, reset on clear, migrate the constant-work readers

### Acceptance behavior

Scenario AT-1: Loading a **Constant Work CSV** creates `editedConstantWork` as a per-row shallow clone of `parsedConstantWork`
Given the user loads a valid **Constant Work CSV** (via `loadConstantWorkCSV(text)`)
Then `editedConstantWork` is a new top-level array with the same length as `parsedConstantWork`
And for every index `i`: `editedConstantWork[i] !== parsedConstantWork[i]` (different object references)
And for every index `i` and key `k`: `editedConstantWork[i][k] === parsedConstantWork[i][k]` (same values)
And `Object.keys(editedConstantWork[i])` equals `Object.keys(parsedConstantWork[i])` in the same order

Scenario AT-2: Mutating `editedConstantWork[i][k]` does not mutate `parsedConstantWork[i][k]`
Given `loadConstantWorkCSV(text)` has run
When `editedConstantWork[0].tshirt_size` is reassigned to `XL`
Then `parsedConstantWork[0].tshirt_size` is the original CSV value (unchanged)

Scenario AT-3: `resetConstantWorkFile` sets both `parsedConstantWork` and `editedConstantWork` to `null`
Given a **Constant Work CSV** is loaded
When `resetConstantWorkFile()` runs
Then `parsedConstantWork === null` and `editedConstantWork === null`

Scenario AT-4: `getConstantWorkEffort` reads `editedConstantWork`
Given a **Constant Work CSV** is loaded with one row (`quarter: Q3 2026`, `tshirt_size: M`)
And `editedConstantWork[0].tshirt_size` is edited to `XL`
When `getConstantWorkEffort(['Q3 2026'])` is called
Then the returned PM reflects `XL` (the edited value), not the original `M`
And `parsedConstantWork[0].tshirt_size` is still `M`

Scenario AT-5: `getConstantWorkEpics` reads `editedConstantWork`
Given a **Constant Work CSV** is loaded with one row (`team: Platform`, `quarter: Q3 2026`)
And `editedConstantWork[0].epic_name` is edited to `Edited name`
When `getConstantWorkEpics('Q3 2026', 'Platform')` is called
Then the returned epic's `name` is `Edited name`

Scenario AT-6: `buildTeamProjections` derives constant-work quarters from `editedConstantWork`
Given a **Constant Work CSV** is loaded with a row for team `Platform` in `Q4 2026`
And `editedConstantWork[0].quarter` is edited to `Q1 2027`
When `buildTeamProjections(...)` runs
Then the `Platform` team's projection includes `Q1 2027` (the edited quarter) and not `Q4 2026`

Scenario AT-7: With no **Constant Work CSV** loaded, the readers return their empty values
Given `parsedConstantWork === null` and `editedConstantWork === null`
When `getConstantWorkEffort(['Q3 2026'])` and `getConstantWorkEpics('Q3 2026', 'Platform')` are called
Then `getConstantWorkEffort` returns `0`
And `getConstantWorkEpics` returns `[]`

Scenario AT-8: A freshly-loaded **Constant Work CSV** with no edits produces identical Run output to a pre-feature build (transparent indirection)
Given a **Constant Work CSV** is loaded and not edited
When a Run completes
Then the org headline, **Team Level**, and **Team Projections** output match a build that read `parsedConstantWork` directly (bit-for-bit, modulo Monte Carlo seed)

Scenario AT-9: Re-loading a **Constant Work CSV** rebuilds the clone wholesale
Given a **Constant Work CSV** `A` is loaded and `editedConstantWork[0]` is edited
When a different **Constant Work CSV** `B` is loaded via `loadConstantWorkCSV`
Then `editedConstantWork` equals `parsedConstantWork.map(r => ({ ...r }))` for `B`
And the edits from `A` are gone

### Public entry point

In-code: a new `editedConstantWork` binding (a `let` initially `null`). The migrated read sites are inside `getConstantWorkEffort`, `getConstantWorkEpics`, and `buildTeamProjections`' `cwQuarters` derivation. UI: none in this phase.

### Expected observable outcomes

- A module-scoped `editedConstantWork` array exists alongside `parsedConstantWork`, created at load as a per-row shallow clone.
- Every production constant-work reader reads `editedConstantWork`; `parsedConstantWork` is read only as the option-pool substrate (Phase 6).
- The two arrays are independent at the per-row level.
- A fresh load with no edits produces identical Run output (transparent).
- File-clear nulls both; file-replace rebuilds the clone.

### Test harness

Acceptance tests:
- Location: `tests/acceptance/phase-1-constant-work-substrate.test.js`.
- Pattern: `loadSimulator()` per test; build fixtures with `csv(...)`; call `loadConstantWorkCSV` via `execIn`; read bindings via `read`; call readers via `evalIn`; mutate via `execIn`. One `describe('AT-N: …')` per scenario.
- Representative assertions: AT-1 `read(win,'editedConstantWork').length === read(win,'parsedConstantWork').length` and per-row reference/value/key-order checks; AT-4 `evalIn(win, "getConstantWorkEffort(['Q3 2026'])")` after editing `editedConstantWork[0].tshirt_size`.

Inner tests: covered by the same acceptance file (the substrate has no separate inner-loop seam).

**Existing-test migration (part of this phase's RED authoring):** update `tests/acceptance/phase-1-engine.test.js` **AT-21** and **AT-27**, which assign `parsedConstantWork = [...]` directly and expect `getConstantWorkEpics` / `buildTeamProjections` to see it. After this phase the readers read `editedConstantWork`, so those tests must assign `editedConstantWork = [...]` (or call `loadConstantWorkCSV`). These edits are made in the test-authoring session and frozen before implementation.

Verification: `npx vitest run tests/acceptance/phase-1-constant-work-substrate.test.js tests/acceptance/phase-1-engine.test.js`.

### Proposed implementation seams

Stable seams the tests may target:
- The module-scoped `editedConstantWork` binding.
- `getConstantWorkEffort` / `getConstantWorkEpics` reading `editedConstantWork`.
- The clone in `loadConstantWorkCSV` and the null in `resetConstantWorkFile`.

Do NOT lock in:
- Whether `buildTeamProjections`' `cwQuarters` reads `editedConstantWork` via the existing inline expression or a small helper (either is fine, as long as it reads the edited array).
- The exact spread idiom (`{ ...r }` vs equivalent) — any per-row shallow clone preserving key order.

### Behavioral rule

A second module-scoped constant-work array `editedConstantWork` is created at **Constant Work CSV** load time as a per-row shallow clone of `parsedConstantWork` (`parsedConstantWork.map(r => ({ ...r }))`) and becomes the *simulation source of truth* for constant work: every production reader of constant-work rows — `getConstantWorkEffort`, `getConstantWorkEpics`, and the `cwQuarters` derivation in `buildTeamProjections` — reads `editedConstantWork`. `parsedConstantWork` remains the immutable parsed input, retained only for the Phase 6 datalist option pools. `resetConstantWorkFile` sets both arrays to `null`; a re-load rebuilds the clone wholesale and discards prior edits. With no constant work loaded both are `null`, and each reader's existing null-guard returns its empty value (`0` / `[]`). Mirrors ADR-0027 / feature 0019 Phase 1.

### Invariants

- `editedConstantWork` is declared `let editedConstantWork = null;` immediately after `parsedConstantWork`.
- Whenever `parsedConstantWork !== null` (loaded from a CSV), `editedConstantWork !== null` with the same length. (From-scratch authoring in Phase 7 may set `editedConstantWork = []` while `parsedConstantWork === null` — that is the only divergence, introduced later.)
- After load, for every `i`: `editedConstantWork[i] !== parsedConstantWork[i]`; for every `i,k`: values equal; key order equal.
- `parsedConstantWork` is never mutated by any reader; edits land only in `editedConstantWork`.
- `getConstantWorkEffort`, `getConstantWorkEpics`, and `buildTeamProjections`' `cwQuarters` all name `editedConstantWork`. They never name `parsedConstantWork`.
- `resetConstantWorkFile` nulls both arrays.

### Counterexamples (must NOT pass)

- An `editedConstantWork` built via `JSON.parse(JSON.stringify(parsedConstantWork))` (deep clone, coerces non-string values).
- An `editedConstantWork` built via `parsedConstantWork.slice()` (rows shared by reference — mutating one mutates the other).
- An `editedConstantWork` built lazily on first edit (downstream readers would see `parsedConstantWork` before the first edit).
- A reader left on `parsedConstantWork` (silent partial-edit state — some surfaces reflect edits, others do not).
- A `resetConstantWorkFile` that nulls only `parsedConstantWork` (orphans `editedConstantWork`).
- A `getConstantWorkEffort` / `getConstantWorkEpics` that defensively re-clones `parsedConstantWork` before reading (breaks "edits flow into next Run").

### Forbidden shortcuts

- Do not unify `parsedConstantWork` and `editedConstantWork` into one mutable array. The two-array shape is the contract (ADR-0027/0034).
- Do not introduce a `getConstantWork()` helper that returns "the right one" based on context.
- Do not deep-clone or memoize the clone across CSV swaps.
- Do not migrate the *option-pool* reads (Phase 6 datalists) to `editedConstantWork` — those read `parsedConstantWork` for a stable pool.

### RED gate

On the current build (before this phase):
- AT-1: `editedConstantWork` is `undefined` (`typeOf(win,'editedConstantWork') === 'undefined'`).
- AT-4: editing `editedConstantWork[0]` (a `ReferenceError` today) has no path; `getConstantWorkEffort` reads `parsedConstantWork`.
- Migrated `phase-1-engine.test.js` AT-21/AT-27 (rewritten to set `editedConstantWork`) fail because the readers still read `parsedConstantWork`.

### Test immutability rule

`tests/acceptance/phase-1-constant-work-substrate.test.js` and the migrated `phase-1-engine.test.js` AT-21/AT-27 are authored and frozen before implementation. The implementation session does not edit any test file.

### Definition of done

- [ ] Acceptance scenarios AT-1 … AT-9 pass.
- [ ] `editedConstantWork` is declared as a `let` initially `null`, next to `parsedConstantWork`.
- [ ] `loadConstantWorkCSV` writes `editedConstantWork = parsedConstantWork.map(r => ({ ...r }))`.
- [ ] `resetConstantWorkFile` nulls both arrays.
- [ ] `getConstantWorkEffort`, `getConstantWorkEpics`, and `buildTeamProjections`' `cwQuarters` read `editedConstantWork`.
- [ ] A fresh load with no edits produces bit-for-bit identical Run output.
- [ ] Migrated `phase-1-engine.test.js` AT-21/AT-27 pass.
- [ ] `git diff` touches only `index.html` (plus this plan / ADRs / CONTEXT.md if material clarifications surface) and the test files authored in the ATDD session.

---

## Phase 2: Per-Group constant-work shift at the org headline — `fixedEffortPerGroup` replaces the scalar, auto-default `All` unions constant-work Categories

### Acceptance behavior

Scenario AT-1: A constant-work row's effort lifts only the Groups whose members include its Category
Given `groupsStore` is `[{name:'Backend', members:['Backend']}, {name:'Frontend', members:['Frontend']}]`
And a **Constant Work CSV** has one row `{category:'Backend', quarter:'Q3 2026', tshirt_size:'M'}`
And `Q3 2026` is the selected **Target quarter**
When the org-wide per-Group constant-work vector is computed
Then `fixedEffortPerGroup[0]` (Backend) equals `tshirtToPersonMonths('M')`
And `fixedEffortPerGroup[1]` (Frontend) equals `0`

Scenario AT-2: A constant-work row whose Category is in no Group lifts nothing
Given `groupsStore` is `[{name:'Backend', members:['Backend']}]`
And a constant-work row has `{category:'Ops', quarter:'Q3 2026', tshirt_size:'L'}`
When the vector is computed
Then `fixedEffortPerGroup[0]` equals `0` (the `Ops` row is excluded from every Group's shift)

Scenario AT-3: Category matching is case-insensitive and trimmed
Given a Group has `members:['Backend']`
And a constant-work row has `{category:' backend ', quarter:'Q3 2026', tshirt_size:'S'}`
When the vector is computed
Then `fixedEffortPerGroup[0]` equals `tshirtToPersonMonths('S')`

Scenario AT-4: A constant-work row with a blank Category lifts only Groups whose members include the **(Blank) sentinel**
Given Group `A` has `members:[BLANK]` and Group `B` has `members:['Backend']`
And a constant-work row has `{category:'', quarter:'Q3 2026', tshirt_size:'M'}`
When the vector is computed
Then `fixedEffortPerGroup` for `A` equals `tshirtToPersonMonths('M')` and for `B` equals `0`

Scenario AT-5: `runSimulation` shifts each Group's distribution by its own `fixedEffortPerGroup` entry
Given `groups` is two Groups with `kPerGroup:[0, 0]`
And `fixedEffortPerGroup:[5, 12]`
When `runSimulation(...)` returns
Then `results[0].sorted` is all `5` and `results[1].sorted` is all `12`
And `results[0].stats.p50 === 5` and `results[1].stats.p50 === 12`

Scenario AT-6: The shared **Global histogram range** floor is the minimum per-Group shift
Given `fixedEffortPerGroup:[0, 8]` with non-zero K on both Groups
When `runSimulation(...)` returns
Then `globalMin === 0` (the minimum entry)
And `results[0].hist.binCenters` equals `results[1].hist.binCenters` (shared bins)

Scenario AT-7: Constant work does not change any Group's K, λ, or the bootstrap pool
Given an org Run with and without a constant-work row in the **Target quarter**
When `prepareSimulationData` runs in both cases
Then `kPerGroup`, `lambda`, and `epicSizingDist` are identical in both cases
(Only `fixedEffortPerGroup` differs.)

Scenario AT-8: A constant-work Category present in multiple Groups lifts each of them (overlap)
Given Group `A` has `members:['Backend','Shared']` and Group `B` has `members:['Shared']`
And a constant-work row has `{category:'Shared', quarter:'Q3 2026', tshirt_size:'M'}`
When the vector is computed
Then both `A` and `B` are lifted by `tshirtToPersonMonths('M')`

Scenario AT-9: The auto-default `All` Group's members union initiative and constant-work Categories (load-order independent)
Given no `groupsStore` exists yet
And initiatives carry Categories `{A, B}` and constant work carries Category `{C}`
When both CSVs have loaded (in either order)
Then the single auto-default `All` Group's `members` is a superset of `{A, B, C}` (plus BLANK if any source has a blank Category)

Scenario AT-10: The auto-default stops auto-syncing once the user modifies Groups
Given the auto-default `All` Group exists
And the user has renamed it (or added/deleted a Group)
When a further **Constant Work CSV** introduces a new Category
Then `groupsStore` is unchanged (no auto-sync) — the new Category is surfaced as excluded (Phase 5), not auto-added

Scenario AT-11: A Run with `totalK === 0` but constant work present sits each Group at its own shift
Given the **Target quarter** has no Initiatives in any Group's members (so `kPerGroup` is all 0)
And constant work exists for some Groups' Categories
When the user presses Run
Then each Group's distribution is flat at its own `fixedEffortPerGroup` entry (pure-constant-work-per-Group)

### Public entry point

In-code: the per-Group constant-work effort vector helper (seam: `getConstantWorkEffortPerGroup(quarters, groups, teamName=null)` or an extension of `getConstantWorkEffort`); `prepareSimulationData` returning `fixedEffortPerGroup`; `runSimulation` taking `fixedEffortPerGroup`; the auto-default union in `loadInitiativesCSV` / `loadConstantWorkCSV`. UI: the **Run Simulation** button — the org chart and stats table reflect per-Group constant-work shifts.

### Expected observable outcomes

- A `Backend`-categorised constant-work row lifts only Backend-member Groups; the old uniform shift is gone.
- Constant work in no Group lifts nothing.
- `runSimulation` applies a per-Group shift; `globalMin` is the minimum per-Group shift.
- `kPerGroup`, λ, and the bootstrap pool are unaffected by constant work.
- The auto-default `All` Group captures constant-work Categories on a fresh import.

### Test harness

Acceptance tests:
- Location: `tests/acceptance/phase-2-constant-work-org-scoping.test.js`.
- Pattern: construct `groupsStore` via `execIn`/`setGroups`; construct `editedConstantWork` via `execIn` (or `loadConstantWorkCSV`); call the vector helper and `runSimulation` via `evalIn`; assert per-Group entries and `globalMin`.

**Existing-test migration (part of this phase's RED authoring):** migrate every test that calls `runSimulation` with the scalar `fixedEffort` or asserts the scalar contract, to `fixedEffortPerGroup`:
- `tests/acceptance/phase-1-engine.test.js` **AT-11, AT-12, AT-13, AT-14, AT-25** (replace `fixedEffort: N` with `fixedEffortPerGroup: [...]`; **AT-12** is rewritten — a zero-member Group's shift is now `0`, the sum of constant work in `[]`, not the old scalar `5`).
- `tests/acceptance/phase-1-engine.test.js` **AT-26, AT-27** (the `buildTeamProjections` band — see Phase 4 for the scoped-`cwEffort` semantics; here only the internal `runSimulation` call's parameter shape changes).
- `tests/verification/sanity-check-engine-mean.test.js` — the engine-mean identity becomes per-Group: `mean_g ≈ K_g × λ × E[size] + fixedEffortPerGroup[g]`.
- `tests/verification/phase-1-2-review-01.test.js` — `fixedEffort: 0` → `fixedEffortPerGroup: [0, …]` (aligned with its `groups`/`kPerGroup`).

Inner tests: the vector helper is exercised directly in the acceptance file.

Verification: `npx vitest run tests/acceptance/phase-2-constant-work-org-scoping.test.js tests/acceptance/phase-1-engine.test.js tests/verification/sanity-check-engine-mean.test.js tests/verification/phase-1-2-review-01.test.js`.

### Proposed implementation seams

Stable seams the tests may target:
- The per-Group constant-work effort vector helper's return: a `number[]` aligned with the passed `groups`/`kPerGroup`.
- `runSimulation`'s `fixedEffortPerGroup` parameter and the per-Group shift / `globalMin` behaviour.
- `prepareSimulationData`'s return shape including `fixedEffortPerGroup`.
- The auto-default `All` Group unioning both sources.

Do NOT lock in:
- Whether the vector is a standalone helper or an extension of `getConstantWorkEffort` (the contract is the aligned vector).
- The exact "pristine auto-default" detection mechanism (a module flag, or a structural check that `groupsStore` is the single auto-derived `All` Group) — implementer's choice.
- Whether `globalMax` uses `Math.max(...fixedEffortPerGroup) + 1` exactly or an equivalent guard — the contract is that the axis accommodates the tallest shift.

### Behavioral rule

The single global constant-work shift becomes a per-**Group** vector. For each Group in the Run snapshot, sum `tshirtToPersonMonths(size)` over `editedConstantWork` rows whose `quarter ∈ targetQuarters` and whose normalised **Category** ∈ `group.members` (compared `trim` + case-insensitively, with the **(Blank) sentinel** matching blank-Category rows), producing `fixedEffortPerGroup: number[]` aligned index-for-index with `kPerGroup`/`groups`. `runSimulation` replaces its scalar `fixedEffort` parameter with `fixedEffortPerGroup`: each Group's sorted distribution is shifted by *its own* entry (a constant added to a sorted array preserves sort order — the ADR-0023 mechanism, now per Group); the shared `globalMin` is `min(fixedEffortPerGroup)` (often `0`, since Groups no longer share one floor); `globalMax` accommodates the tallest shift. Constant work contributes **zero** to `kPerGroup`, **Poisson λ**, and the **Bootstrap pool** — it is purely additive deterministic effort. The org run-button handler computes the org-wide vector (all teams, target quarters) and passes it to `runSimulation`. The auto-default `All` Group's `members` are the union of observed Categories across `editedInitiatives` and `editedConstantWork` (incl. BLANK), (re)derived on any CSV load while `groupsStore` remains the pristine auto-default; once the user modifies Groups, no further auto-sync occurs. The ADR-0023 behaviour (one scalar added to every Scenario) is removed entirely.

### Invariants

- `fixedEffortPerGroup.length === groups.length` and is aligned with `kPerGroup`; entry `i` is the constant-work PM for Group `i`.
- `runSimulation` shifts `results[i].sorted` by `fixedEffortPerGroup[i]` (default `0` when the array is shorter / absent).
- `globalMin === Math.min(...fixedEffortPerGroup)` (or `0` when the array is empty).
- Constant work never changes `kPerGroup`, `lambda`, or `epicSizingDist`.
- The per-Group constant-work bucketing uses the same `trim` + case-fold + BLANK-membership semantics as `bucketRowsByGroups`.
- The auto-default `All` Group's members include every observed Category across both sources, plus BLANK iff any source has a blank Category.
- The auto-default (re)derives only while `groupsStore` is the pristine auto-default; user modification freezes it.

### Counterexamples (must NOT pass)

- A `runSimulation` that retains the scalar `fixedEffort` parameter and applies one shift to every Group.
- A `runSimulation` whose `globalMin` is a single Group's shift (or the first Group's, or the max) rather than the minimum.
- A per-Group vector that buckets *initiative* rows (it must bucket `editedConstantWork` rows).
- A vector that adds constant-work effort into `kPerGroup` or the bootstrap pool.
- A bucketing that is case-sensitive, or that treats `''`/whitespace Category as a non-BLANK string.
- An auto-default `All` Group built from initiatives only (constant-work-only Categories would be silently excluded on a fresh import).
- An auto-default that re-syncs after the user has renamed/added/deleted a Group.

### Forbidden shortcuts

- **Do not keep the scalar `fixedEffort` as a back-compat alias on `runSimulation`** to avoid migrating the feature-0020 tests. The migration is the deliberate contract change; the vector is the only contract.
- Do not apply the org-wide vector uniformly to teams/projections "for now" (Phases 3/4 own those surfaces; do not pre-empt them with a wrong uniform shift).
- Do not sample constant work into the random pool or feed it to the Poisson count.
- Do not introduce a separate "(Blank)" string key in the constant-work bucketing — BLANK is `null`.

### RED gate

On the build after Phase 1:
- AT-1/AT-2: there is no per-Group constant-work vector; `getConstantWorkEffort` returns a scalar summed across all rows regardless of Category.
- AT-5/AT-6: `runSimulation` has no `fixedEffortPerGroup` parameter; passing it is ignored and the scalar `fixedEffort` shifts every Group uniformly; `globalMin` is the scalar.
- AT-9: the auto-default `All` Group is built from initiatives only.
- Migrated `phase-1-engine.test.js` AT-11…AT-14/AT-25 and the verification tests fail against the scalar contract.

### Test immutability rule

`tests/acceptance/phase-2-constant-work-org-scoping.test.js` and the migrated engine/verification tests are authored and frozen before implementation. The implementation session does not edit any test file (notably, it may not re-introduce the scalar `fixedEffort` to make an un-migrated test pass).

### Definition of done

- [ ] Acceptance scenarios AT-1 … AT-11 pass.
- [ ] The per-Group constant-work effort vector is aligned with `kPerGroup`/`groups` and uses ADR-0028 Category semantics.
- [ ] `runSimulation` takes `fixedEffortPerGroup`, shifts per Group, sets `globalMin = min(fixedEffortPerGroup)`, and reports `fixedEffortPerGroup`.
- [ ] `prepareSimulationData` returns `fixedEffortPerGroup`; the org run handler passes it.
- [ ] Constant work does not affect `kPerGroup` / λ / the bootstrap pool.
- [ ] The auto-default `All` Group unions both sources and freezes on user modification.
- [ ] All migrated engine/verification tests pass against the vector contract; the scalar `fixedEffort` parameter is gone.
- [ ] `git diff` touches only `index.html` (plus this plan / ADRs / CONTEXT.md) and the ATDD-session test files.

---

## Phase 3: Team Level surface honors Category-scoping — per-team `fixedEffortPerGroup`

### Acceptance behavior

Scenario AT-1: A team section lifts only the Groups whose members include a matching-team constant-work row's Category
Given `groupsStore` is `[{name:'Backend', members:['Backend']}, {name:'Frontend', members:['Frontend']}]`
And a constant-work row is `{team:'Platform', category:'Backend', quarter:'Q3 2026', tshirt_size:'M'}`
When `prepareTeamSimulationData(...)` builds the `Platform` entry for the **Target quarter** `Q3 2026`
Then the `Platform` entry's `fixedEffortPerGroup[0]` (Backend) equals `tshirtToPersonMonths('M')`
And `fixedEffortPerGroup[1]` (Frontend) equals `0`

Scenario AT-2: A constant-work row for another team does not lift this team
Given the constant-work row above is for team `Platform`
When the `Risk` team entry is built
Then every entry of `Risk`'s `fixedEffortPerGroup` is `0`

Scenario AT-3: The per-team vector is aligned with `groups` and team-scoped AND Category-scoped
Given a team has constant work in Categories `Backend` (M) and `Ops` (L), and `groupsStore` is `[{members:['Backend']}]`
When the team entry is built
Then `fixedEffortPerGroup` has length 1 and equals `[tshirtToPersonMonths('M')]` (the `Ops` row, in no Group, is excluded)

Scenario AT-4: The **Team Level tab** stats reflect the per-Group team shift
Given a team has a constant-work row in a Group's Category
When the team section renders after Run
Then that Group's column for the team shows the distribution shifted by the team's per-Group constant-work PM (e.g. `p50` lifted accordingly)
And other Groups' columns for the team are not lifted by that row

Scenario AT-5: Case-insensitive team match (existing convention preserved)
Given a constant-work row has `team:'platform'` and the initiative team is `Platform`
When the `Platform` team vector is built
Then the row contributes to `Platform`'s `fixedEffortPerGroup` (case-insensitive team match)

### Public entry point

In-code: `prepareTeamSimulationData` returning a per-team `fixedEffortPerGroup` (replacing the per-team scalar `fixedEffort`); `renderTeamSection` / the per-team `runSimulation` call consuming it. UI: the **Team Level tab** — per-team Group columns reflect Category-scoped constant work.

### Expected observable outcomes

- Constant work lifts a team's Group columns only where team AND Category both match.
- The per-team vector is aligned with `groups`.
- A constant-work row in no Group, or for another team, lifts nothing here.

### Test harness

Acceptance tests:
- Location: `tests/acceptance/phase-3-team-level-constant-work-scoping.test.js`.
- Pattern: load initiatives + epics (so teams resolve) via `loadInitiativesCSV` + `setEpics`; set `editedConstantWork` and `groupsStore` via `execIn`; call `prepareTeamSimulationData` via `evalIn`; assert per-team `fixedEffortPerGroup`.

Inner tests: covered in the acceptance file.

**Existing-test migration:** `phase-1-engine.test.js` **AT-25** (Team Level stats) had its `runSimulation` parameter migrated in Phase 2; confirm it still passes with the team wiring. No new migration is expected to be unique to this phase.

Verification: `npx vitest run tests/acceptance/phase-3-team-level-constant-work-scoping.test.js`.

### Proposed implementation seams

Stable seams the tests may target:
- `prepareTeamSimulationData` returning `fixedEffortPerGroup` per team entry.
- The reuse of the Phase 2 per-Group vector helper with a `teamName` argument.

Do NOT lock in:
- Whether the team vector is computed by the shared helper with a `teamName` filter or inline — the contract is the team-scoped, Category-scoped, group-aligned vector.

### Behavioral rule

`prepareTeamSimulationData` replaces its per-team scalar constant-work effort (`getConstantWorkEffort(targetQuarters, teamName)`) with a per-team `fixedEffortPerGroup`: for each team and each Group, sum `tshirtToPersonMonths(size)` over `editedConstantWork` rows whose `team` matches the team (case-insensitive, existing convention), whose `quarter ∈ targetQuarters`, and whose Category ∈ `group.members`. The team match AND-composes with the Category filter. `renderTeamSection` and the per-team `runSimulation` call consume `fixedEffortPerGroup` exactly as the org headline does (Phase 2). Constant work still contributes zero to the team's `kPerGroup` / λ / bootstrap pool.

### Invariants

- Each team entry's `fixedEffortPerGroup.length === groups.length` and is aligned with the team's `kPerGroup`.
- A constant-work row contributes to a team's vector only if its team matches (case-insensitive) AND its Category ∈ the Group's members.
- The team vector uses the same Category semantics (trim + case-fold + BLANK) as the org vector.
- Constant work does not change the team's `kPerGroup` / λ / sizing pool.

### Counterexamples (must NOT pass)

- A team section that retains the scalar `fixedEffort` (lifts every Group uniformly).
- A team vector that ignores the team filter (org-wide constant work lifting every team).
- A team vector that ignores the Category filter (all the team's constant work lifting every Group).
- A team match that is case-sensitive (diverging from the existing convention).

### Forbidden shortcuts

- Do not reuse the org-wide vector for all teams (it is not team-scoped).
- Do not pre-empt the **Team Projections** surface (Phase 4 owns it).

### RED gate

On the build after Phase 2:
- AT-1: `prepareTeamSimulationData` returns a scalar `fixedEffort` per team; there is no per-team `fixedEffortPerGroup`.
- AT-2: the team scalar sums all the team's constant work regardless of Group; no Category scoping at team level.

### Test immutability rule

`tests/acceptance/phase-3-team-level-constant-work-scoping.test.js` is authored and frozen before implementation. The implementation session does not edit any test file.

### Definition of done

- [ ] Acceptance scenarios AT-1 … AT-5 pass.
- [ ] `prepareTeamSimulationData` returns a per-team `fixedEffortPerGroup` (team AND Category scoped, group-aligned).
- [ ] `renderTeamSection` / the per-team `runSimulation` call consume the vector.
- [ ] Constant work does not affect any team's `kPerGroup` / λ / bootstrap pool.
- [ ] `git diff` touches only `index.html` (plus this plan / ADRs / CONTEXT.md) and the ATDD-session test file.

---

## Phase 4: Team Projections surface honors Category-scoping — Projection-group-scoped constant work, degenerate fallback resolved

### Acceptance behavior

Scenario AT-1: A projection cell shows only constant work whose Category is in the **Projection group**'s members
Given the **Projection group** has `members:['Backend']`
And a (team, quarter) cell has constant-work rows in Categories `Backend` (M) and `Ops` (L)
When `buildTeamProjections(...)` builds the cell
Then the cell's appended constant-work **Initiative matrix** rows include only the `Backend` row
And the `Ops` row does not appear in the cell

Scenario AT-2: The cell's `cwEffort` band floor is scoped to the Projection group's members
Given the cell above
When the cell is built
Then `cell.cwEffort` equals `tshirtToPersonMonths('M')` (the `Backend` row only), not the `Backend`+`Ops` total

Scenario AT-3: A zero-member Projection group collapses the band to a scoped `cwEffort` of `0`
Given the **Projection group** has `members:[]`
And a (team, quarter) cell has a constant-work row in Category `Backend`
When the cell is built
Then `cell.cwEffort === 0` and the **Effort projection band** is the flat triple `(0, 0, 0)`

Scenario AT-4: With no Projection group (or empty `groupsStore`), the cell falls back to all constant work for that (team, quarter)
Given `groupsStore === []` (no Groups)
And a (team, quarter) cell has constant-work rows totalling `5` PM
When the cell is built
Then `cell.cwEffort === 5` (all constant work; degenerate fallback per ADR-0023)
And the band is `(5, 5, 5)`

Scenario AT-5: A Projection group with the **(Blank) sentinel** in its members includes blank-Category constant work in the cell
Given the **Projection group** has `members:[BLANK]`
And a (team, quarter) cell has a constant-work row with a blank Category (M)
When the cell is built
Then `cell.cwEffort` equals `tshirtToPersonMonths('M')` and that row appears in the cell

### Public entry point

In-code: `buildTeamProjections` scoping `cwEpics` / `cwEffort` to the Projection group's members and passing `fixedEffortPerGroup: [scopedCwEffort]` to the single-group projection `runSimulation`. UI: the **Team Projections tab** — each cell's band and constant-work matrix rows reflect the Projection group's Category scope.

### Expected observable outcomes

- A projection cell shows only Projection-group-scoped constant work in its band and matrix.
- A zero-member Projection group scopes constant work to `0`.
- No Projection group / empty `groupsStore` falls back to all constant work (degenerate).

### Test harness

Acceptance tests:
- Location: `tests/acceptance/phase-4-projections-constant-work-scoping.test.js`.
- Pattern: as for the engine tests — load initiatives/epics, set `editedConstantWork` and `groupsStore` (with one `isProjection: true`), call `buildTeamProjections` via `evalIn`, assert `cell.cwEffort` and the band.

Inner tests: covered in the acceptance file.

**Existing-test migration:** `phase-1-engine.test.js` **AT-26** (no constant work → `cwEffort` `0` regardless) and **AT-27** (empty `groupsStore` → all-constant-work fallback) keep their semantics under the degenerate-fallback decision; only their Phase-2 `runSimulation`-parameter migration applies. Confirm both still pass; add a new scoped case (AT-1/AT-2 above) for the Projection-group-present path.

Verification: `npx vitest run tests/acceptance/phase-4-projections-constant-work-scoping.test.js tests/acceptance/phase-1-engine.test.js`.

### Proposed implementation seams

Stable seams the tests may target:
- `buildTeamProjections`' per-cell `cwEffort` (scoped to the Projection group when one exists; all constant work otherwise).
- The cell's constant-work matrix rows being filtered to the Projection group's members.

Do NOT lock in:
- Whether the scoping reuses the Phase 2 vector helper (with `[projGroup]` as `groups`) or filters `getConstantWorkEpics`' output inline — the contract is the scoped `cwEffort` and scoped matrix rows.

### Behavioral rule

On the **Team Projections tab**, each (team, quarter) cell scopes its constant work to the **Projection group**'s members: the appended constant-work **Initiative matrix** rows and the `cwEffort` band floor include only constant-work rows (for that team, that quarter) whose Category ∈ `projGroup.members` (case-insensitive + BLANK). The single-group projection `runSimulation` call passes `fixedEffortPerGroup: [scopedCwEffort]`. **Degenerate fallback:** when no Projection group exists (or `groupsStore` is empty), the cell falls back to the constant-work-only flat band using **all** constant work for that (team, quarter), preserving ADR-0023's behaviour for the no-groups-model case. Category-scoping applies only when a Projection group exists. This is the intended reversal of ADR-0023's "all constant work, every cell".

### Invariants

- When a Projection group exists, `cell.cwEffort` is the sum of `tshirtToPersonMonths(size)` over the cell's constant-work rows whose Category ∈ `projGroup.members`.
- When a Projection group exists, the cell's appended constant-work matrix rows are exactly those scoped rows.
- When no Projection group exists (or `groupsStore` is empty), `cell.cwEffort` is the sum over **all** the cell's constant-work rows (degenerate fallback).
- The projection `runSimulation` call passes `fixedEffortPerGroup: [scopedCwEffort]` (a one-element vector for the single Projection-group scenario).
- Initiative-side projection behaviour (the `kProj` count, the band when `kProj > 0`) is unchanged except for the scoped `cwEffort` floor.

### Counterexamples (must NOT pass)

- A cell that shows all constant work (every Category) when a Projection group exists.
- A cell whose `cwEffort` is the unscoped total when a Projection group exists.
- A zero-member Projection group that still lifts the band by all constant work (it must scope to `0`).
- A projection `runSimulation` call still passing the scalar `fixedEffort: cwEffort`.

### Forbidden shortcuts

- Do not drop the degenerate fallback (no Projection group / empty `groupsStore` must still surface constant work in the band, per ADR-0023).
- Do not scope by the *first* Group when no `isProjection` Group exists — the fallback is all-constant-work, not first-Group.

### RED gate

On the build after Phase 3:
- AT-1/AT-2: the cell shows all constant work regardless of the Projection group; `cwEffort` is the unscoped total.
- AT-3: a zero-member Projection group does not scope `cwEffort` to `0`.

### Test immutability rule

`tests/acceptance/phase-4-projections-constant-work-scoping.test.js` is authored and frozen before implementation. The implementation session does not edit any test file.

### Definition of done

- [ ] Acceptance scenarios AT-1 … AT-5 pass.
- [ ] Each projection cell scopes its constant work to the Projection group's members (band + matrix) when a Projection group exists.
- [ ] The degenerate fallback (no Projection group / empty `groupsStore`) uses all constant work for the cell.
- [ ] The projection `runSimulation` call passes `fixedEffortPerGroup: [scopedCwEffort]`.
- [ ] `phase-1-engine.test.js` AT-26/AT-27 still pass.
- [ ] `git diff` touches only `index.html` (plus this plan / ADRs / CONTEXT.md) and the ATDD-session test file.

---

## Phase 5: Constant-work quarters in the Target selector + Data preview surfacing of per-Group constant-work PM and exclusions

### Acceptance behavior

Scenario AT-1: A constant-work-only quarter appears in the **Target quarter** selector but not the **Historical** selector
Given initiatives + epics span `Q2 2026`, `Q3 2026`
And constant work has a row in `Q4 2026` (a quarter absent from initiatives/epics)
When `refreshQuarters()` runs
Then the **Target** selector's options include `Q4 2026`
And the **Historical** selector's options do not include `Q4 2026`

Scenario AT-2: Selecting a constant-work-only **Target quarter** yields a pure-constant-work forecast
Given `Q4 2026` (constant-work only) is the selected **Target quarter**
And constant work for `Q4 2026` matches some Groups' Categories
When the user presses Run
Then every Group's `kPerGroup` entry is `0` (no Initiatives in `Q4 2026`)
And each Group's distribution is flat at its own `fixedEffortPerGroup` entry

Scenario AT-3: The **Historical** selector source is unchanged (initiatives ∪ epics)
Given constant work has quarters not present in initiatives/epics
When `refreshQuarters()` runs
Then the **Historical** selector lists exactly the initiative ∪ epic quarters (no constant-work-only quarters)

Scenario AT-4: The **Data preview** shows per-Group constant-work PM beside each per-Group `K` row
Given two Groups `A` and `B`, and constant work lifting `A` by `7` PM and `B` by `0`
And initiatives + epics + a **Target quarter** are selected
When `tryUpdatePreview()` (or a Run) refreshes the preview
Then the preview's `A` row shows its `K` and `7` PM of constant work
And the `B` row shows its `K` and `0` PM

Scenario AT-5: The **Data preview** shows an "in no group … excluded" line when constant work matches no Group
Given a constant-work row in the **Target quarter** has Category `Ops` and no Group has `Ops` in its members
When the preview refreshes
Then the preview shows a line reporting the excluded constant work (PM and row count), e.g. `Constant work in no group: <PM> PM across <N> rows — excluded`

Scenario AT-6: No excluded constant work → no excluded line (or a zero/absent line)
Given every constant-work row's Category is in at least one Group
When the preview refreshes
Then no non-zero "excluded" line is shown

### Public entry point

In-code: `refreshQuarters` sourcing the target selector from `initiatives ∪ epics ∪ editedConstantWork` quarters; `prepareSimulationData`'s `preview` gaining `fixedEffortPerGroup` + `cwExcludedPM`/`cwExcludedRows`; `renderPreview` rendering them. UI: the **Target** `MultiSelect` (`#target-ms`) and the **Data preview**.

### Expected observable outcomes

- Constant-work-only quarters are selectable as targets, not as historical.
- A pure-constant-work target quarter yields `K = 0` per Group + each Group's shift.
- The Data preview surfaces per-Group constant-work PM and an excluded summary.

### Test harness

Acceptance tests:
- Location: `tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js`.
- Pattern: load initiatives/epics + set `editedConstantWork`; call `refreshQuarters` then read the `MultiSelect` options (via the widget's exposed options / DOM); call `prepareSimulationData` and assert `preview.fixedEffortPerGroup` / `preview.cwExcludedPM` / `preview.cwExcludedRows`; call `renderPreview` and assert the `#preview-grid` / `#data-preview` text contains the per-Group PM and the excluded line.

Inner tests: covered in the acceptance file.

Verification: `npx vitest run tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js`.

### Proposed implementation seams

Stable seams the tests may target:
- `refreshQuarters` populating `targetMS` from a list that includes constant-work quarters and `histMS` from one that does not.
- `preview.fixedEffortPerGroup`, `preview.cwExcludedPM`, `preview.cwExcludedRows`.
- The presence of per-Group PM and an "excluded" line in the rendered preview text.

Do NOT lock in:
- The exact wording / formatting of the per-Group PM and the excluded line (must be present and informative).
- Whether the excluded summary is computed inside `prepareSimulationData` or a small helper.

### Behavioral rule

The **Target quarter** selector's source becomes `initiatives ∪ epics ∪ editedConstantWork` quarters; the **Historical quarter** selector's source stays `initiatives ∪ epics` (constant work cannot inform λ or the bootstrap pool). The two `MultiSelect` instances are populated from different lists in `refreshQuarters`, preserving the existing selection-preservation logic. A **Target quarter** that exists only in constant work yields a pure-constant-work forecast (`kPerGroup` all `0`, each Group at its own shift). The **Data preview** surfaces the constant-work allocation: each per-Group `K` row also reports the constant-work PM folded into that Group (the org-wide `fixedEffortPerGroup` from Phase 2), and a dedicated line reports any constant work in the target quarters whose Category matches no Group's members (PM + row count, "excluded"). This is the visibility mitigation for the exclusion rule — no Run gate, no blocking, pure surfacing.

### Invariants

- `targetMS` options ⊇ `histMS` options; the difference is exactly the constant-work-only quarters.
- `histMS` options never include a quarter present only in constant work.
- `preview.fixedEffortPerGroup` is aligned with `preview.kPerGroup`/`groupNames`.
- `preview.cwExcludedPM` / `cwExcludedRows` count target-quarter constant-work rows whose Category ∈ no Group's members (overlap-aware: a row counts as excluded only if it is in *no* Group).
- The preview's per-Group PM and excluded line refresh on quarter-selection change (`tryUpdatePreview`) and on Run.

### Counterexamples (must NOT pass)

- A `refreshQuarters` that adds constant-work quarters to the **Historical** selector.
- A `refreshQuarters` that populates both selectors from the same (target) list.
- A preview that omits the per-Group constant-work PM.
- An "excluded" count that includes constant work that *is* in some Group (overlap mishandled).
- A Run gate / alert when constant work is excluded (the surfacing is preview-only).

### Forbidden shortcuts

- Do not block or warn at Run time on excluded constant work — surfacing is the Data preview only.
- Do not change the selection-preservation defaults beyond sourcing the two selectors differently.

### RED gate

On the build after Phase 4:
- AT-1: `refreshQuarters` populates both selectors from `initiatives ∪ epics`; a constant-work-only quarter appears in neither.
- AT-4/AT-5: the preview has no per-Group constant-work PM and no excluded line.

### Test immutability rule

`tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js` is authored and frozen before implementation. The implementation session does not edit any test file.

### Definition of done

- [ ] Acceptance scenarios AT-1 … AT-6 pass.
- [ ] The Target selector includes constant-work quarters; the Historical selector does not.
- [ ] A constant-work-only target quarter yields `K = 0` per Group + each Group's shift.
- [ ] The Data preview shows per-Group constant-work PM and an excluded summary line.
- [ ] `git diff` touches only `index.html` (plus this plan / ADRs / CONTEXT.md) and the ATDD-session test file.

---

## Phase 6: Constant work tab — editable table with smart per-field editors and CSV export

### Acceptance behavior

Scenario AT-1: A sixth tab button `Constant work` appears after `Initiatives`
Given the user has completed a Run
When the user looks at the tab bar
Then there are six `.tab-btn` elements in order: `Organization Level`, `Team Level`, `Team Projections`, `Initiatives`, `Constant work`, `Groups`
And the fifth button has `data-tab="constant-work"` and text `Constant work`

Scenario AT-2: The `#tab-constant-work` panel is hidden immediately after a Run
Given the user has just pressed Run
When the visibility-reset block completes
Then `#tab-constant-work.style.display === 'none'` and the active tab is `Organization Level`

Scenario AT-3: Clicking the Constant work tab reveals the table with one row per `editedConstantWork` row
Given `editedConstantWork` has `N` rows
When the user clicks the `Constant work` tab
Then `#tab-constant-work.style.display === 'flex'`
And the table `<tbody>` has `N` `<tr>` elements

Scenario AT-4: The `tshirt_size` cell is a `<select>` of exactly the seven **Recognised t-shirt sizes**
Given a row has `tshirt_size: 'M'`
When the table renders
Then that cell is a `<select>` whose options are exactly `2XS, XS, S, M, L, XL, XL+`
And the option `M` is selected

Scenario AT-5: The `category`, `team`, and `quarter` cells are `<input list>` datalist combos seeded from the observed union
Given initiatives have Categories `{A, B}` and constant work has Category `{C}`
When the table renders
Then each row's `category` cell is `<input list="…">` whose datalist options include `A`, `B`, `C` (the union)
And the `team` and `quarter` cells are datalist combos seeded from the observed union of initiative + constant-work values

Scenario AT-6: The `jira_key`, `epic_name`, `key_result`, and unknown extra columns are free-text inputs
Given a row has those columns (plus an extra `notes` column)
When the table renders
Then those cells are `<input type="text">` (no `<select>`, no datalist)

Scenario AT-7: Editing the `tshirt_size` `<select>` writes through to `editedConstantWork` and flows into the next Run
Given the table is rendered and a row's `tshirt_size` shows `M`
When the user selects `XL`
Then `editedConstantWork[rowIdx].tshirt_size === 'XL'` immediately
And the chart/stats do not change until the next Run
And after the next Run, that row contributes `tshirtToPersonMonths('XL')` to its Group(s)' shift

Scenario AT-8: `↓ Export CSV` downloads `constant-work-edited.csv` preserving the imported header set
Given a **Constant Work CSV** was imported with headers `epic_key, building_block, t_shirt_size, category, team, quarter, notes`
When the user clicks `↓ Export CSV`
Then a download named `constant-work-edited.csv` is triggered
And its header row is exactly the imported headers (including aliases `epic_key`/`building_block`/`t_shirt_size` and the extra `notes`), in their original order

Scenario AT-9: The exported CSV round-trips
Given the user edits a few cells and exports
When the exported file is re-imported via `loadConstantWorkCSV`
Then `parsedConstantWork` reproduces the edited model (same columns, same edited values)

Scenario AT-10: Editing a Constant work cell triggers a preview refresh but not a Run
Given the user is on the Constant work tab after a Run
When the user changes a cell
Then `tryUpdatePreview` is invoked (the **Data preview** reflects the pending edit on the next recompute)
And `runSimulation` is not called; the chart/stats/Team tabs do not update

Scenario AT-11: Cell values are escaped (`escapeHtml` / `escapeAttr`)
Given a constant-work cell contains `<script>alert('x')</script>`
When the table renders
Then the rendered DOM contains the escaped text and no `<script>` element is added

### Public entry point

In-code: `renderConstantWorkTable()`, `exportConstantWorkCSV()`; the render call inside the run-button handler; `#tab-constant-work` in the visibility-reset block. UI: the sixth tab button + panel, the size `<select>`, the datalist combos, the `↓ Export CSV` button.

### Expected observable outcomes

- A sixth `Constant work` tab renders `editedConstantWork` with smart per-field editors.
- Edits commit immediately; charts lag until Run; export round-trips.
- The size `<select>` closes the silent-0-PM footgun.

### Test harness

Acceptance tests:
- Location: `tests/acceptance/phase-6-constant-work-tab.test.js`.
- Pattern: `loadConstantWorkCSV` (and `loadInitiativesCSV` for the union); call `renderConstantWorkTable()` via `execIn`; query `#constant-work-table-wrap` DOM for the size `<select>`, datalist combos, and free-text inputs; dispatch a `change` event and assert `editedConstantWork` updates; assert tab-bar markup.

Inner tests: covered in the acceptance file (the render + export functions are the seams).

**Existing-test migration:** `tests/acceptance/phase-2-groups-tab.test.js`'s tab-count scenario (asserting five `.tab-btn`) is updated to six tabs with `Constant work` in the fifth position and `Groups` in the sixth. Authored and frozen in this phase's ATDD session.

Verification: `npx vitest run tests/acceptance/phase-6-constant-work-tab.test.js tests/acceptance/phase-2-groups-tab.test.js`.

### Proposed implementation seams

Stable seams the tests may target:
- The sixth tab markup: `<button class="tab-btn" data-tab="constant-work">Constant work</button>` and `<div id="tab-constant-work" class="tab-panel"><div id="constant-work-table-wrap"></div></div>`.
- `renderConstantWorkTable()` writing a single `<table>` into `#constant-work-table-wrap`.
- The size `<select>` option set (the seven Recognised t-shirt sizes); the datalist combos for category/team/quarter.
- `exportConstantWorkCSV()` producing `constant-work-edited.csv` from `Papa.unparse(editedConstantWork)`.

Do NOT lock in:
- The exact CSS class names / datalist `id`s.
- The exact set of columns treated as datalist-combo vs free-text beyond the documented rule (size = select; category/team/quarter = datalist; keys/name/kr/extra = free text).
- Whether the datalist union helper is shared with the Members-popover union (Phase 8) or separate.

### Behavioral rule

A sixth **Tab** — **Constant work** (`#tab-constant-work`) — is inserted after **Initiatives** in the tab bar and renders `editedConstantWork` via `renderConstantWorkTable()`, modelled on `renderInitiativesTable`. Unlike the Initiatives tab, *all* cells are editable. The `tshirt_size` (and `t_shirt_size`) cell is a `<select>` constrained to the seven **Recognised t-shirt sizes** (`2XS, XS, S, M, L, XL, XL+`), closing the silent-0-PM footgun. The `category`, `team`, and `quarter` cells (and recognised aliases) are `<input list>` datalist combos seeded from the observed union of `editedInitiatives` and `editedConstantWork` values. The `jira_key`, `epic_name`, `key_result`, and any unknown extra columns are free-text inputs. Edits commit to `editedConstantWork` immediately via inline `onchange` handlers (which also call `tryUpdatePreview`), but charts/stats lag until the next **Run** (commit-on-Run). A `↓ Export CSV` toolbar button calls `exportConstantWorkCSV()` → `Papa.unparse(editedConstantWork)` → download `constant-work-edited.csv`, preserving the imported header set verbatim (aliases + extra columns). The tab is pre-rendered every Run (`renderConstantWorkTable()` in the run-button handler) and its panel is added to the visibility-reset block. With nothing imported, the empty state is an empty table (the `+ Add row` authoring affordance is Phase 7).

### Invariants

- The tab bar has six `.tab-btn` elements; `Constant work` (`data-tab="constant-work"`) is fifth, `Groups` is sixth.
- `renderConstantWorkTable` writes `#constant-work-table-wrap.innerHTML` exactly once per call.
- The `tshirt_size` cell's options are exactly the seven Recognised t-shirt sizes; the current value is selected (an unrecognised imported size is shown as a current-value option but the seven canonical options are always present).
- The `category`/`team`/`quarter` datalist options are the observed union of `editedInitiatives` ∪ `editedConstantWork` values.
- Inline `onchange` handlers write `this.value` (a string) to `editedConstantWork[rowIdx][col]` and call `tryUpdatePreview`; no Run fires.
- `exportConstantWorkCSV` is a no-op when `editedConstantWork` is null/empty; otherwise downloads `constant-work-edited.csv` with the imported header order.
- Cell text is `escapeHtml`'d; attribute values are `escapeAttr`'d.
- `renderConstantWorkTable()` is called in the run-button handler; `#tab-constant-work` is reset to `display:none` in the visibility-reset block.

### Counterexamples (must NOT pass)

- A `tshirt_size` cell rendered as a free-text input or a dropdown of *observed* sizes (it is a `<select>` of the seven canonical sizes).
- A `category`/`team`/`quarter` cell that is a plain `<select>` (it is an `<input list>` combo, free-text-friendly).
- A `jira_key`/`epic_name` cell rendered read-only (the Constant work tab has no join to protect — all cells are editable).
- An export that normalises alias headers to canonical names (breaks round-trip) or reorders columns.
- An edit handler that triggers a Run, or that does not call `tryUpdatePreview`.
- A datalist seeded only from `editedConstantWork` (it must union with `editedInitiatives` for the merge path).

### Forbidden shortcuts

- Do not protect any cell as read-only (no Epics join exists for constant work).
- Do not normalise/reorder headers on export.
- Do not source the datalist from `parsedConstantWork` only — the union must reflect the current edited state of both tabs.
- Do not place the Constant work tab before Initiatives or after Groups — it is the fifth button (between Initiatives and Groups).

### RED gate

On the build after Phase 5:
- AT-1: there are five tabs; no `Constant work` button.
- AT-3: `renderConstantWorkTable` is `undefined`; `#tab-constant-work` does not exist.
- AT-8: `exportConstantWorkCSV` is `undefined`.
- The migrated `phase-2-groups-tab.test.js` tab-count scenario (six tabs) fails (only five exist).

### Test immutability rule

`tests/acceptance/phase-6-constant-work-tab.test.js` and the migrated `phase-2-groups-tab.test.js` tab-count scenario are authored and frozen before implementation. The implementation session does not edit any test file.

### Definition of done

- [ ] Acceptance scenarios AT-1 … AT-11 pass.
- [ ] The sixth `Constant work` tab + panel exist (fifth button, before `Groups`).
- [ ] `renderConstantWorkTable` renders all-editable cells with the documented per-field editors.
- [ ] `exportConstantWorkCSV` round-trips with the imported header set.
- [ ] Edits commit to `editedConstantWork`, call `tryUpdatePreview`, and flow into the next Run.
- [ ] `renderConstantWorkTable()` is called every Run; `#tab-constant-work` is in the visibility-reset block.
- [ ] The migrated tab-count scenario passes.
- [ ] `git diff` touches only `index.html` (plus this plan / ADRs / CONTEXT.md) and the ATDD-session test files.

---

## Phase 7: Add row / delete row / from-scratch authoring on the Constant work tab

### Acceptance behavior

Scenario AT-1: `+ Add row` appends a blank canonical-schema row when nothing was imported
Given `editedConstantWork === null` (or `[]`) and `parsedConstantWork === null`
When the user clicks `+ Add row`
Then `editedConstantWork` has one new row with keys `jira_key, epic_name, key_result, category, team, quarter, tshirt_size`, all blank
And the table re-renders with that row

Scenario AT-2: `+ Add row` uses the imported header set when a CSV was imported
Given a **Constant Work CSV** with headers `epic_key, building_block, t_shirt_size, category, team, quarter, notes` was imported
When the user clicks `+ Add row`
Then the new row has exactly those keys (blank), so all rows share columns

Scenario AT-3: Per-row delete removes the row immediately with no confirmation
Given `editedConstantWork` has 3 rows
When the user clicks the delete control on row 1
Then `editedConstantWork` has 2 rows (the others, in order)
And the table re-renders
And no confirmation dialog appears

Scenario AT-4: From-scratch authoring with no CSV loaded feeds the simulation
Given no **Constant Work CSV** is loaded
When the user clicks `+ Add row` and fills `category`, `quarter`, `tshirt_size` (matching a Group + the **Target quarter**)
And presses Run
Then that authored row contributes to its Group's `fixedEffortPerGroup` shift
And `parsedConstantWork` remains `null` (only `editedConstantWork` is populated)

Scenario AT-5: Lenient blanks — blank size → 0 PM, blank quarter → excluded, blank Category → BLANK
Given an authored row with blank `tshirt_size`, blank `quarter`, and blank `category`
When the simulation runs
Then the row contributes `0` PM (blank size)
And it is excluded from every target-quarter sum (blank quarter)
And its Category is the **(Blank) sentinel** (matches only Groups whose members include BLANK)

Scenario AT-6: An added row's editors match the imported-row editors
Given an added row
When the table renders
Then its `tshirt_size` cell is the seven-size `<select>` and its `category`/`team`/`quarter` cells are datalist combos

Scenario AT-7: The export includes added rows
Given the user adds two rows and edits them
When the user clicks `↓ Export CSV`
Then the exported CSV includes those rows

### Public entry point

In-code: the `+ Add row` handler (appends to `editedConstantWork`, initialising it to `[]` when null) and the per-row delete handler; `renderConstantWorkTable` rendering the `+ Add row` control and per-row delete. UI: the `+ Add row` control and per-row delete on the Constant work tab.

### Expected observable outcomes

- `+ Add row` appends a blank row (canonical schema or imported header set).
- Per-row delete removes immediately.
- From-scratch authoring (no CSV) works and feeds the simulation; lenient blanks behave as documented.

### Test harness

Acceptance tests:
- Location: `tests/acceptance/phase-7-constant-work-add-delete.test.js`.
- Pattern: with no CSV, call the add-row handler via `execIn` and assert `editedConstantWork` is `[{canonical schema}]`; with an imported CSV, assert the imported header set; call delete and assert the row is removed; author a row and call `prepareSimulationData`/the vector helper to assert the shift; assert lenient-blank behaviour.

Inner tests: covered in the acceptance file.

Verification: `npx vitest run tests/acceptance/phase-7-constant-work-add-delete.test.js`.

### Proposed implementation seams

Stable seams the tests may target:
- The add-row handler producing the canonical schema (no import) or the imported header set (import), and initialising `editedConstantWork` to `[]` when null.
- The delete handler splicing `editedConstantWork` and re-rendering.

Do NOT lock in:
- The exact control markup (`+ Add row` button placement; delete as `×`/`Delete`).
- Whether the canonical schema constant is shared or inline (the key set is the contract).

### Behavioral rule

The Constant work tab gains a `+ Add row` control and a per-row delete control. `+ Add row` appends a blank row to `editedConstantWork`: when there is no imported header set to mirror (`parsedConstantWork === null`), the row carries the canonical schema (`jira_key, epic_name, key_result, category, team, quarter, tshirt_size`); otherwise it carries the imported file's header set, so all rows share columns. When `editedConstantWork` is `null`, the first add initialises it to `[]` then appends — enabling from-scratch authoring with no CSV loaded (`parsedConstantWork` stays `null`). Per-row delete splices the row immediately with no confirmation (matching the Groups tab's delete). Validation is lenient: a blank `tshirt_size` is `0` PM, a blank `quarter` is excluded from every simulation, a blank `category` is the **(Blank) sentinel**. The table re-renders after add and delete.

### Invariants

- After `+ Add row` with no import, `editedConstantWork` is non-null and the new row's keys are exactly the canonical schema.
- After `+ Add row` with an import, the new row's keys equal the imported header set.
- Delete removes exactly the targeted row, preserving the order of the rest, with no confirmation.
- From-scratch rows feed the simulation identically to imported rows (the engine reads `editedConstantWork` regardless of `parsedConstantWork`).
- Lenient blanks: blank size → `0` PM; blank quarter → excluded; blank Category → BLANK.

### Counterexamples (must NOT pass)

- An `+ Add row` that requires a CSV to be loaded first (from-scratch authoring must work).
- An added row whose keys differ from the other rows' (breaks the shared-columns contract and the export).
- A delete that prompts for confirmation, or that reorders the remaining rows.
- A blank `tshirt_size` that throws or contributes a non-zero PM.

### Forbidden shortcuts

- Do not gate `+ Add row` behind a loaded CSV.
- Do not add a confirmation to delete (immediate, per ADR-0034).
- Do not coerce blank cells to defaults other than the documented lenient behaviour.

### RED gate

On the build after Phase 6:
- AT-1: there is no `+ Add row` control; `editedConstantWork` cannot be authored from scratch.
- AT-3: there is no per-row delete control.

### Test immutability rule

`tests/acceptance/phase-7-constant-work-add-delete.test.js` is authored and frozen before implementation. The implementation session does not edit any test file.

### Definition of done

- [ ] Acceptance scenarios AT-1 … AT-7 pass.
- [ ] `+ Add row` appends a blank row (canonical schema or imported header set) and initialises `editedConstantWork` to `[]` when null.
- [ ] Per-row delete removes immediately with no confirmation.
- [ ] From-scratch authoring feeds the simulation; lenient blanks behave as documented.
- [ ] `git diff` touches only `index.html` (plus this plan / ADRs / CONTEXT.md) and the ATDD-session test file.

---

## Phase 8: Groups Members popover lists initiatives ∪ constant-work Categories (merge)

### Acceptance behavior

Scenario AT-1: The Members popover lists a constant-work-only Category
Given initiatives have Categories `{A, B}` and constant work has Category `{C}` (absent from initiatives)
When the user opens the Members popover on a Group
Then the popover's option list includes `A`, `B`, and `C`

Scenario AT-2: A Category present in both sources appears once, with the Initiative casing
Given initiatives have Category `Backend` and constant work has Category `backend`
When the popover opens
Then the option list has a single `Backend` entry (Initiative casing wins), not two entries

Scenario AT-3: A constant-work-only Category keeps its own casing
Given constant work has Category `Ops` (absent from initiatives)
When the popover opens
Then the option list includes `Ops` (its own casing)

Scenario AT-4: Adding a constant-work-only Category to a Group scopes that constant work to the Group on the next Run
Given a constant-work row has Category `Ops` and `Ops` is in no Group
When the user adds `Ops` to Group `A` via the popover and presses Run
Then Group `A`'s `fixedEffortPerGroup` entry includes that row's PM
And the Data preview no longer lists that row as excluded

Scenario AT-5: The popover still lists the `(Blank)` row and the free-text input
Given the popover opens
Then a dedicated `(Blank)` row and a free-text input are present (unchanged from feature 0020)

Scenario AT-6: The union reflects the current edited state of both tabs (computed at open time)
Given the user edits an initiative's Category to `KR9` and a constant-work row's Category to `KR8` (without pressing Run)
When the user opens the Members popover
Then both `KR9` and `KR8` appear in the option list

### Public entry point

In-code: the Members popover's observed-Categories source (`openMembersPopover` / equivalent) sourcing from `editedInitiatives ∪ editedConstantWork`. UI: the Groups tab Members popover.

### Expected observable outcomes

- Constant-work Categories (including constant-work-only ones) appear in the Members popover.
- A Category in both sources is merged (Initiative casing wins); a constant-work-only Category keeps its own casing.
- Adding a constant-work Category to a Group scopes that constant work to the Group.

### Test harness

Acceptance tests:
- Location: `tests/acceptance/phase-8-groups-popover-union.test.js`.
- Pattern: `loadInitiativesCSV` + set `editedConstantWork`; render the Groups tab; open the Members popover (via its open function / simulated click) and read the option list from the DOM; assert the union, the merge casing, and the `(Blank)`/free-text presence.

Inner tests: covered in the acceptance file.

**Existing-test migration:** `tests/acceptance/phase-2-groups-tab.test.js` **AT-28** (the popover sources options from `editedInitiatives`) is updated to assert the popover sources from `editedInitiatives ∪ editedConstantWork`. Authored and frozen in this phase's ATDD session.

Verification: `npx vitest run tests/acceptance/phase-8-groups-popover-union.test.js tests/acceptance/phase-2-groups-tab.test.js`.

### Proposed implementation seams

Stable seams the tests may target:
- The Members popover's option list = the union of `editedInitiatives` and `editedConstantWork` Categories.
- The merge casing rule (Initiative casing wins; constant-work-only keeps its own).

Do NOT lock in:
- Whether the union helper is shared with the Phase 6 datalist union or separate.
- The exact popover DOM beyond the option-list contents and the `(Blank)`/free-text affordances.

### Behavioral rule

The Groups **Members** popover's observed-Categories list (and the addable-Category source) sources from the union of Categories across `editedInitiatives` **and** `editedConstantWork`, computed at popover-open time (so it reflects the current edited state of both tabs). A Category present in both sources is a single entry; the Initiative's casing wins on a merge; a constant-work-only Category keeps its own casing; the union dedups case-insensitively (seed the casing map from `editedInitiatives` first, then add constant-work Categories not already present). The `(Blank)` row and the free-text input are unchanged. This is the affordance by which the user targets constant-work Categories with Groups (which then scopes that constant work per Phases 2-4).

### Invariants

- The popover option list is the case-insensitive union of `editedInitiatives` and `editedConstantWork` Categories.
- On a merge, the displayed casing is the Initiative's; a constant-work-only Category keeps its own casing.
- The union is recomputed at popover-open time (not cached from render).
- The `(Blank)` row and free-text input remain present.

### Counterexamples (must NOT pass)

- A popover that lists only `editedInitiatives` Categories (constant-work-only Categories missing).
- A popover that lists a duplicate entry for a Category present in both sources.
- A merge where the constant-work casing overrides the Initiative casing.
- A union computed once at render time and stale when the user edits a tab before opening the popover.

### Forbidden shortcuts

- Do not source the union from `parsedInitiatives` / `parsedConstantWork` (it must reflect the edited state).
- Do not drop the `(Blank)` row or free-text input.

### RED gate

On the build after Phase 7:
- AT-1: the popover lists only `editedInitiatives` Categories; constant-work-only Categories are absent.
- AT-2: a Category in both sources may appear inconsistently (the union does not consider constant work at all).
- The migrated `phase-2-groups-tab.test.js` AT-28 (union assertion) fails.

### Test immutability rule

`tests/acceptance/phase-8-groups-popover-union.test.js` and the migrated `phase-2-groups-tab.test.js` AT-28 are authored and frozen before implementation. The implementation session does not edit any test file.

### Definition of done

- [ ] Acceptance scenarios AT-1 … AT-6 pass.
- [ ] The Members popover sources from `editedInitiatives ∪ editedConstantWork`, computed at open time.
- [ ] Merge casing: Initiative wins; constant-work-only keeps its own; case-insensitive dedup.
- [ ] The `(Blank)` row and free-text input remain.
- [ ] The migrated `phase-2-groups-tab.test.js` AT-28 passes.
- [ ] `git diff` touches only `index.html` (plus this plan / ADRs / CONTEXT.md) and the ATDD-session test files.

---

## Open assumptions (verify before the test-authoring session)

1. **Auto-default `All` Group + load order (Phase 2).** Decision: the auto-default unions `editedInitiatives ∪ editedConstantWork` Categories and (re)derives on any CSV load *while `groupsStore` is the pristine auto-default*; once the user modifies Groups, no auto-sync. Constant-work Categories loaded after the user has customised Groups are surfaced as excluded (Phase 5), not auto-added. (Alternative considered and rejected for complexity: auto-add to a "pristine + user-touched" hybrid.) If you prefer the auto-default to fire *only* on initiative-load (not constant-work-load), say so — it simplifies Phase 2 at the cost of the safe-default for the common "initiatives first, constant work later" order.

2. **Team Projections degenerate fallback (Phase 4).** Decision: when **no** Projection group exists or `groupsStore` is empty, the cell falls back to **all** constant work for that (team, quarter) (preserving ADR-0023). Category-scoping applies only when a Projection group exists. (Alternative: scope to `0` when no Projection group — more "pure" but hides guaranteed work in a degenerate state and would change `phase-1-engine.test.js` AT-27's expectation.)

3. **Constant work tab position (Phase 6).** Decision: the `Constant work` tab is the **fifth** button (after `Initiatives`, before `Groups`), grouping the two editable-CSV tabs. (Alternative: append after `Groups` as the rightmost sixth button.) Either way the existing five-tab assertion in `phase-2-groups-tab.test.js` is migrated.

4. **`fixedEffortPerGroup` parameter name (Phase 2).** Decision: the `runSimulation` scalar `fixedEffort` is renamed to `fixedEffortPerGroup: number[]` (no scalar back-compat alias). If you'd rather keep `fixedEffort` accepting either a scalar or an array (to reduce test migration), that contradicts the ADR-0033 "in place of the scalar" wording and is not recommended.
