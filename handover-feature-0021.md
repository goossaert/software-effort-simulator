# Handover — Feature 0021: Editable Constant Work tab + Group-/Quarter-scoped constant work

**Status:** Design grilling complete. **Planning NOT started** (no phases, no task breakdown). This document is the design record for a fresh session that will plan the feature (e.g. via `plan-feature`) and produce `docs/plans/0021-*.md`.

**Session output:** two new ADRs, one amended ADR, and ~20 `CONTEXT.md` glossary edits (see *Artifacts*). The decisions below were each resolved interactively with the user.

---

## 1. Feature goal (user's words, refined)

Expand `index.html` so that constant work becomes a **first-class, editable, category-addressable** body of work:

1. A new **Constant work tab** displays the imported Constant Work CSV with **editable fields** (like the Initiatives tab); edits feed the next simulation.
2. The tab has **Export CSV**, **add row**, and **delete row**.
3. In the **Groups tab**, constant-work **Categories** appear in the addable-category list; a Category appearing in both Initiatives and Constant work is **merged** into one entry.
4. The simulation **adds both** initiatives and constant work to each simulated group — and the old behaviour of adding *all* constant work to *every* group **stops**: constant work is added only to groups whose Categories were selected.
5. Constant-work **quarters** appear in the **target-quarter** selector; only constant work matching the selected quarter(s) is used.

---

## 2. Artifacts created / modified this session

| File | Action |
|---|---|
| `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` | **Created.** Core semantics change — amends ADR-0023. |
| `docs/adr/0034-editable-constant-work-tab.md` | **Created.** Editable tab + add/delete + export — parallels ADR-0027. |
| `docs/adr/0023-constant-work-csv-deterministic-shift.md` | **Amended** (added an "Amended by 0033/0034" note at top; body left intact as historical record). |
| `CONTEXT.md` | **Updated** terms: Constant work, Constant Work CSV, Category, Group, Scenario, Target quarter, Quarter selector, Tab, Groups tab, Data preview, Quick projection Monte Carlo, Effort projection band, Global histogram range, Initiative matrix, Projection group; **added** the new term *Constant work tab*; added two *Flagged ambiguities* and updated the *Relationships* constant-work bullets. |
| `handover-feature-0021.md` | This file. |

> Note on numbering: ADRs continue their own sequence (next was **0033**). The **feature/plan** number is **0021** (plans run `docs/plans/0001`–`0020`); the planning session should create `docs/plans/0021-*.md`. Don't conflate the two sequences.

---

## 3. Resolved design decisions

Each is settled. Rationale is condensed; the ADRs carry the full argument.

### Engine semantics (→ ADR-0033)

1. **Deterministic, per-group shift.** Constant work stays deterministic (closed-form lognormal mean via `tshirtToPersonMonths`, post-sort additive shift, follows the Synthetic↔Empirical toggle). The single global `fixedEffort` *scalar* becomes a **per-Group vector**: for each Group, sum the effort of constant-work rows whose **Category ∈ `group.members`** and apply it as *that* Group's shift. It is **not** sampled into the random pool.
2. **Never affects K / Poisson.** Constant work contributes zero to the epic-count or sizing machinery; `kPerGroup` stays initiatives-only. "Items from both" = stochastic initiatives + deterministic constant-work shift, summed.
3. **All three surfaces.** Org headline, Team Level, and Team Projections all honor category-scoping. Existing scope filters AND-compose with the Category filter: org = (Category ∈ members) across all teams in target quarters; team = + team match (case-insensitive); projection = scoped to the **Projection group's** members per (team, quarter). Consequence: Team Projection cells now show only constant work matching the projection group's Categories.
4. **Category match = case-insensitive** (`trim()` + case-insensitive), consistent with ADR-0028. "Exactly the same" was colloquial. On a merge, Initiative casing wins; a constant-work-only Category keeps its own casing.
5. **Unassigned constant work is excluded but surfaced.** Constant work whose Category is in no Group is dropped from the simulation (the explicit intent) **but never silently**: the Data preview shows per-Group constant-work PM beside each `K`, plus a line for any "constant work in no group … excluded". `(Blank)`-category constant work follows the `(Blank)` sentinel rule (enters only groups whose members include the sentinel).
6. **Safe default.** The auto-default `All` Group (first load, no JSON) takes members from the union of categories across **both** `editedInitiatives` and `editedConstantWork` (incl. `(Blank)`), so a fresh import captures all constant work until the user deliberately narrows groups.
7. **Quarters: target selector only.** Constant-work quarters union into `#target-ms`; `#hist-ms` stays Initiatives+Epics (constant work can't inform λ / bootstrap pool). The two selectors deliberately diverge in source. A target quarter present only in constant work ⇒ a pure-constant-work forecast (`K=0` per group + each group's shift).

### Editable tab (→ ADR-0034)

8. **Commit-on-Run + edited copy.** New mutable `editedConstantWork` (shallow-cloned per-row from `parsedConstantWork` on load) is the simulation source of truth; `getConstantWorkEffort` / `getConstantWorkEpics` read from it. `parsedConstantWork` stays as the dropdown/datalist substrate. Edits land immediately; charts/stats lag until next Run. (Mirrors ADR-0027.)
9. **Smart per-field idioms.** All cells editable (no Epics join to protect). `tshirt_size` = `<select>` of the 7 canonical sizes (closes the silent-0-PM footgun). `category`/`team`/`quarter` = `<input list>` datalist combos seeded from the observed **union** of initiatives + constant work. `jira_key`/`epic_name`/`key_result` = free text. Unknown extra columns = free text.
10. **Always-present tab + from-scratch authoring.** Pre-rendered every Run like Initiatives/Groups. With nothing imported it shows an empty table + `+ Add row`; from-scratch rows use the canonical schema (`jira_key, epic_name, key_result, category, team, quarter, tshirt_size`), otherwise rows mirror the imported header set.
11. **Add row = blank + lenient; delete = immediate, no confirm.** No Run gate; blank size→0 PM, blank quarter→excluded, blank category→`(Blank)`. Matches the app's lenient-validation philosophy.
12. **Export = round-trip, preserve input headers.** `Papa.unparse(editedConstantWork)` → `constant-work-edited.csv`, echoing imported headers verbatim (aliases + extra columns), canonical when authored from scratch. Re-import reproduces the identical model/Run. (Mirrors ADR-0027.)

### Settled consequences (no separate decision)

- Groups Members popover (`_observedCategoriesForPopover`-equivalent) now lists `editedInitiatives ∪ editedConstantWork` categories.
- Multi-target-quarter sums constant work across **all** selected target quarters (like initiatives).
- `globalMin` in the shared histogram range: since scenarios no longer share one shift, it becomes the **minimum** per-group shift across the Run (often 0). (Flagged for implementation in ADR-0033.)

---

## 4. Current-code touchpoints the planner inherits

Context only — *not* a task list. Anchored on function names (line numbers in this single-file app drift).

**Data model**
- `parsedConstantWork` (module-scoped cache; states `null` / `[]` / `RowObject[]`). Add `editedConstantWork` alongside, following the `parsedInitiatives` → `editedInitiatives` pattern (ADR-0027).
- `groupsStore: Group[]` — `{ name, color, members: (string|BLANK)[], isProjection }`. `BLANK` sentinel = JS `null`.

**Constant-work helpers** (today read `parsedConstantWork`; must read `editedConstantWork` and gain a Category filter):
- `loadConstantWorkCSV(text)`, `resetConstantWorkFile()`
- `getConstantWorkEffort(quarters, teamName?)` — today sums all matching; needs per-group / per-category bucketing.
- `getConstantWorkEpics(quarter, teamName)` — display rows; needs projection-group filtering at the projection surface.

**Bucketing & engine**
- `bucketRowsByGroups(rows, categoryCol)` → `kPerGroup` (+ `categoryBreakdown`). Natural home for also producing the per-group constant-work effort vector.
- `runSimulation({ lambda, epicSizingDist, kPerGroup, groups, capacity, iterations, fixedEffort })` — `fixedEffort` scalar → `fixedEffortPerGroup` vector; the post-sort shift block and `globalMin`/`globalMax` computation change accordingly.

**Surfaces** (all three group-aware today):
- Org headline: run-button handler → `prepareSimulationData(histQs, targetQs)` → `runSimulation`.
- Team Level: `prepareTeamSimulationData` → `renderTeamSection(idx, useOrg)` (per-team `kPerGroup`, per-team `getConstantWorkEffort`).
- Team Projections: `buildTeamProjections` / `renderTeamProjections`; `projGroup = groupsStore.find(g => g.isProjection)`; per-cell `cwEffort`. Already merges `cwQuarters` into its per-team axis.

**Quarter selectors**
- `MultiSelect` instances `histMS` (`#hist-ms`), `targetMS` (`#target-ms`); `extractQuarters(rows)`; populate via `refreshQuarters` / `targetMS.populate(...)`. Target source must union `editedConstantWork` quarters; historical must NOT.

**Tabs / UI**
- `.tab-btn` + `data-tab`; panels `#tab-*`; `renderInitiativesTable` is the template to mirror for a `renderConstantWorkTable` and `#tab-constant-work`.
- `exportInitiativesCSV` (`Papa.unparse`) is the export template.
- File inputs `#constant-work-file`, `#initiatives-file`.

**Effort / normalization**
- `tshirtToPersonMonths`, `T_SHIRT_PARAMS` / `activeParams`, `normalizeSize`, `normalizeCategory`, `BLANK`. The 7 canonical sizes (`2XS, XS, S, M, L, XL, XL+`) drive the size `<select>`.

**Data preview**
- `renderPreview` from `prepareSimulationData().preview` (per-Group `K` rows). Extend to show per-group constant-work PM and the "in no group / excluded" line. `tryUpdatePreview` triggers must include constant-work-tab edits.

---

## 5. Open questions / considerations deferred to planning

- **`runSimulation` signature**: introduce `fixedEffortPerGroup: number[]` vs. compute shifts outside and pass aligned with `kPerGroup`. (Implementation choice — not a product decision.)
- **`globalMin` with heterogeneous per-group shifts**: confirm `min(per-group shift)` reads well on the shared-bin chart; consider whether a per-group floor needs surfacing.
- **Empty-`groupsStore` projection fallback**: ADR-0023 specified a `(cwEffort, cwEffort, cwEffort)` flat band when no groups exist. With no projection group there is no Category to scope by — decide whether the fallback uses all constant work or none. (Degenerate case.)
- **Datalist refresh timing**: when a constant-work row introduces a new quarter/category, when do `#target-ms` and the Groups popover refresh — on edit, or on next Run? (Lean: same `tryUpdatePreview`/commit-on-Run rhythm.)
- **Preview wording / placement** of the per-group constant-work PM and the excluded line.
- **Test coverage**: `tests/acceptance/phase-1-engine.test.js` already constructs `parsedConstantWork`; engine tests will need per-group constant-work cases and an exclusion case.

---

## 6. Out of scope for this session (and explicitly not done)

- No feature plan, no phase decomposition, no task breakdown (the user reserved this for the next session).
- No production code changes to `index.html`.
- No Duplicate-row action, no browser-storage persistence, no Run-time blocking validation (noted as possible future revisions in the ADRs).

---

## 7. Suggested next step

Start a fresh session, read this handover + ADR-0033 + ADR-0034 (and the amended ADR-0023), then run `plan-feature` to produce `docs/plans/0021-*.md` with behavioral rules, invariants, and forbidden shortcuts.
