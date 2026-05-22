# Feature: Extend the t-shirt size set with `2XS` (band 0.10–0.25 PM)

Created at: 2026-04-07T00:00:00Z

## Context

This feature is a *narrow band extension* to the per-size lognormal parameter table established by [feature 0005](./0005-synthetic-lognormal-parameters.md). It adds one new **T-shirt size** — `2XS`, band `[0.10, 0.25]` PM — appended below `XS` on the synthetic parameter table, the sidebar **T-shirt size reference** panel, and the **Data preview**'s size-distribution sort order. Every downstream surface (the Monte Carlo engine, the **Bootstrap pool** ingestion, the **Column detectors**, `normalizeSize`, the within-file epic dedup tie-breaker, the **Constant work** effort helper, the Initiatives-tab size dropdown, the **Column-detection debug** panel) absorbs the new size *without code change* because they all gate on `T_SHIRT_PARAMS[size]` truthiness or read `Object.keys(T_SHIRT_PARAMS)` at runtime — see [ADR-0024](../adr/0024-2xs-t-shirt-size-extension.md). The single user-facing error message that enumerates the valid sizes in text (`"recognised t_shirt_size (XS, S, M, L, XL, XL+)"`, `index.html:3332`) is updated by hand.

The feature is deliberately the smallest possible band extension. It does not change the lognormal fit *formula* (`μ = (ln min + ln max) / 2`, `σ = (ln max − ln min) / (2 · Φ⁻¹(0.9))` from [ADR-0007](../adr/0007-lognormal-effort-distribution.md)); it applies that formula to one new band and inlines the result. It does not introduce a new spelling rule, a new size-related allow-list, a normalisation alias, or a configuration UI. It does not touch the **Empirical parameters** table — the `2XS` entry there is added later by [feature 0018](../../backtracked-features.md#0018), which carries the synthetic `(μ, σ)` through unchanged because there is no Q1 realised effort for sub-`XS` epics. The within-file epic dedup that prefers "the row with a **Recognised t-shirt size**" (`index.html:1587-1588`) becomes `2XS`-aware automatically.

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). The parameter entry, the reference-table row, the sort-order array, and the error literal all live inline in `index.html`.
- [ADR-0006 — Monte Carlo with bootstrapped historical sizes](../adr/0006-monte-carlo-with-bootstrapped-sizes.md). The Bootstrap pool ingestion gates each epic on `T_SHIRT_PARAMS[size]`; the new key joins the eligible set automatically.
- [ADR-0007 — Lognormal effort distribution, parameterised per t-shirt size](../adr/0007-lognormal-effort-distribution.md). The per-size lognormal fit contract this feature honours by deriving `(μ, σ)` from the closed-form P10/P90 formula.
- [ADR-0024 — Extending the t-shirt size set downward with `2XS`](../adr/0024-2xs-t-shirt-size-extension.md). The architectural decision for *why* this feature exists in the shape it does (downward extension, `2XS` spelling, derived `(μ, σ)`, zero engine change, hand-edited error enumeration).

Glossary terms used below: **T-shirt size**, **Person-month (PM)**, **Synthetic parameters**, **Empirical parameters**, **Recognised t-shirt size**, **Bootstrap pool**, **Data preview**, **T-shirt size reference**, **Iteration**, **Run** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user who opens `index.html` and expands the sidebar **T-shirt size reference** panel now sees seven rows — `2XS`, `XS`, `S`, `M`, `L`, `XL`, `XL+` — instead of six, with `2XS` listed *first* and showing `Min PM = 0.10`, `Max PM = 0.25`. The footer continues to read `Min ≈ P10, Max ≈ P90 of lognormal distribution`. The user reads the new row and understands that the band sits below `XS`'s `0.25–0.75` PM — there is no gap and no overlap with the existing `XS` band.

A user who uploads an **Epics CSV** with `2XS`-labelled rows (in any casing — `2xs`, `2XS`, `2Xs`) now sees those epics counted into the **Data preview**'s size-distribution breakdown ("`2XS × 4, XS × 12, S × 18, …`"), with `2XS` listed *first* in the breakdown sort order. Before this feature, `2XS`-labelled rows were silently dropped from the **Bootstrap pool** (they failed the `T_SHIRT_PARAMS[size]` truthiness guard during ingestion); after this feature, they are first-class **Recognised t-shirt size** values and contribute to every per-**Iteration** sample.

A user who presses **Run Simulation** with a `2XS`-labelled epic in scope sees that epic's effort sampled from `Lognormal(-1.8444, 0.3575)` (the synthetic parameters derived from the new band). The resulting per-epic samples cluster around the median `e^(-1.8444) ≈ 0.158` PM with a mean of `e^(-1.8444 + 0.3575²/2) ≈ 0.169` PM, materially smaller than `XS`'s `~0.49` PM mean. The org-level histogram, the per-team **Team Level tab** charts, and the **Team Projections tab**'s **Effort projection band** all reflect the new size's contribution automatically — no surface needs to special-case `2XS`.

A user who uploads a **Constant Work CSV** ([feature 0015](../../backtracked-features.md#0015)) row with `tshirt_size: '2XS'` sees the deterministic effort computed as `e^(-1.8444 + 0.3575²/2) ≈ 0.17` PM via `tshirtToPersonMonths`. The `[2XS · ~0.17 PM]` annotation in the matrix row's name cell reads sensibly, and the row's contribution to the per-cell `cwEffort` shifts the **Effort projection band** by that amount.

A user who uploads an Epics CSV missing every sized epic and triggers the empty-pool error sees the updated message: `"recognised t_shirt_size (2XS, XS, S, M, L, XL, XL+)"`. The size list reads `2XS` at the head, matching the order on the sidebar reference panel.

A user who toggles the **Synthetic parameters** ↔ **Empirical parameters** radio (added later by [feature 0018](../../backtracked-features.md#0018)) sees `2XS` epics sample from the *synthetic* parameters in both modes — the empirical table carries the synthetic `(μ, σ)` through because no Q1 realised data exists for sub-`XS` epics. The user reads no visible difference for `2XS` rows across the toggle.

There is no user-visible failure mode at this layer. A CSV that contains *no* `2XS` rows reads exactly as before this feature. A CSV with `2XS` rows but loaded before this feature was deployed would have silently dropped those rows from the pool; this feature is what makes them count.

## Scope

### In scope
- The `T_SHIRT_PARAMS['2XS']` entry (`index.html:1230`): `{ mu: -1.8444, sigma: 0.3575 }` with the trailing band comment `// range [0.1,  0.25] PM`. The `(μ, σ)` values are derived from the band via the [ADR-0007](../adr/0007-lognormal-effort-distribution.md) formula and *inlined* — not computed at runtime. The entry is positioned as the *first* key in the object literal so the insertion-order traversal (`Object.keys`, `Object.entries`) yields `2XS` ahead of `XS`.
- The sidebar **T-shirt size reference** panel's new row (`index.html:936`): `<tr><td>2XS</td><td>0.10</td><td>0.25</td></tr>`, inserted *above* the existing `XS` row so the user reads the table top-to-bottom in ascending PM order.
- The `renderPreview` sort-order array (`index.html:2821`): `['2XS','XS','S','M','L','XL','XL+']` — the `'2XS'` element appended at the head of the previous `['XS',...,'XL+']`. Used to order the per-size count display in the **Data preview**.
- The run-button handler's empty-pool error enumeration (`index.html:3332`): `"recognised t_shirt_size (2XS, XS, S, M, L, XL, XL+)"` — `2XS` prepended to the previous list, so the user reads the same order as on the sidebar reference panel.

### Out of scope
- `normalizeSize` (`index.html:1493`). The function is already `(raw || '').trim().toUpperCase()` and passes `'2XS'` through verbatim; this feature does not modify it.
- The lognormal sampler `sampleLognormal` (`index.html:1307-1311`). The sampler reads `activeParams[sizeLabel]` and produces a sample for any key that exists in the active parameter set; no change needed.
- `tshirtToPersonMonths` (`index.html:1272-1276`). The helper reads `activeParams[normalizeSize(size)]`; it picks up the new key automatically.
- The Bootstrap pool ingestion in `prepareSimulationData` (`index.html:1761-1762`) and `prepareTeamSimulationData` (`index.html:1874-1875`). Both gate on `T_SHIRT_PARAMS[size]` truthiness; the new entry joins the eligible set automatically.
- The within-file epic dedup tie-breaker (`index.html:1587-1588`). Already keyed on `T_SHIRT_PARAMS[normalizeSize(...)]`.
- The Monte Carlo engine (`runScenario`, `runSimulation`). Engine code never enumerates size labels.
- The **Empirical parameters** table `T_SHIRT_PARAMS_EMPIRICAL`. Owned by [feature 0018](../../backtracked-features.md#0018); the `2XS` carry-through there is part of that feature's landing, not this one.
- The **Column detector** family. Sizes are not detected; only their values are normalised.
- The Initiatives tab's editable-cell dropdowns ([feature 0019](../../backtracked-features.md#0019)). The dropdown is populated from observed values in the CSV, not from `T_SHIRT_PARAMS`; `2XS` appears there only when a CSV row carries it.
- The **Column-detection debug** panel. It displays detected column *names*, not size *values*.
- The **Empirical parameters** ↔ **Synthetic parameters** radio toggle. Owned by [feature 0018](../../backtracked-features.md#0018).
- An `XXS` spelling alias or any other spelling-rule normalisation. The single canonical spelling is `2XS` — see [ADR-0024](../adr/0024-2xs-t-shirt-size-extension.md).
- A configurable size set (UI for adding/removing sizes at runtime). The table is a maintenance artefact, not a user knob — see [ADR-0007](../adr/0007-lognormal-effort-distribution.md).
- An `XL++` or `2XL` upper-end band. Listed as a future revision in [ADR-0024](../adr/0024-2xs-t-shirt-size-extension.md).

## Relevant existing files
Claude may inspect:
- `index.html`, specifically:
  - `T_SHIRT_PARAMS` declaration and its preceding documentation block (`index.html:1210-1237`).
  - The sidebar reference table markup (`index.html:929-949`).
  - `renderPreview`'s sort-order array (`index.html:2819-2823`).
  - The run-button handler's empty-pool error block (`index.html:3326-3334`).
  - `normalizeSize` (`index.html:1492-1493`) — *for context only*; this feature does not modify it.
  - `sampleLognormal` (`index.html:1307-1311`) and `tshirtToPersonMonths` (`index.html:1272-1276`) — *for context only*; they consume the parameter table.
- `CONTEXT.md` glossary, especially the **T-shirt size**, **Recognised t-shirt size**, **Synthetic parameters**, **Empirical parameters**, **T-shirt size reference**, and **Bootstrap pool** entries.
- [ADR-0024](../adr/0024-2xs-t-shirt-size-extension.md) — the architectural decision this feature implements.
- [ADR-0007](../adr/0007-lognormal-effort-distribution.md) — the per-size lognormal contract the new band honours.
- `docs/plans/0005-synthetic-lognormal-parameters.md` — the prior plan that established the parameter-table pattern.

Claude should not inspect unless needed:
- The Monte Carlo engine internals (`runScenario`, `runSimulation`).
- The CSV parsing / column detection blocks.
- The chart, stats-table, and marker code.
- The Team Level / Team Projections sections (they re-use the same parameter table).

## Existing patterns to follow
- **Layering inside `index.html`**: the `T_SHIRT_PARAMS` entry lives in Module 2 (Statistical Samplers) alongside its siblings; the sidebar row lives in the sidebar HTML; the sort-order array lives in `renderPreview` in Module 6; the error literal lives in the run-button handler in Module 9. There is *no* new module, *no* new helper, *no* refactor.
- **Band-then-`(μ, σ)` convention**: each `T_SHIRT_PARAMS` entry carries the band as a trailing comment (`// range [0.1,  0.25] PM`) and the inlined `(μ, σ)` as the value. The band column on the sidebar reference panel mirrors the comment. When sizes change, both the parameter entry and the sidebar row update together; the `(μ, σ)` is *always* the closed-form derivation, never a hand-tuned value — see [ADR-0007](../adr/0007-lognormal-effort-distribution.md) and [ADR-0024](../adr/0024-2xs-t-shirt-size-extension.md).
- **Object-literal insertion order is the canonical size order**: JavaScript preserves insertion order for non-numeric string keys, and every surface that displays size labels reads either from `Object.keys(T_SHIRT_PARAMS)` (implicitly ordered) or from a hand-maintained array (`renderPreview`'s sort-order array, the error enumeration). The hand-maintained arrays must mirror the object-literal order.
- **Zero-engine-change extension**: no downstream code path enumerates the eligible size set explicitly. Every guard is `T_SHIRT_PARAMS[size]` (truthy on hit, falsy on miss); every consumer reads `activeParams[size]`. The new key joins the **Recognised t-shirt size** set the moment it is declared.
- **`normalizeSize` is a pure uppercase trim**: do not add an allow-list, an alias map, or any spelling normalisation. `'2xs'`, `' 2XS '`, `'2Xs'` all land on the canonical `'2XS'` key by virtue of the trim-and-uppercase pipeline.
- **Hand-edited error enumeration**: the literal at `index.html:3332` is the only place that lists size labels in user-facing text. Update it in lock-step with `T_SHIRT_PARAMS` changes. A future revision could replace the literal with `${Object.keys(T_SHIRT_PARAMS).join(', ')}` — additive, not required by this feature.
- **No framework, no library**: vanilla JS literal. The `1.28155` constant from the documentation block is used by hand to compute `(μ, σ)` once, off-line.
- **Verification command**: there is no automated test harness in this project. Verification is manual: open `index.html`, inspect the sidebar reference panel, upload an Epics CSV containing `2XS` rows, press Run, and confirm the per-size breakdown and the engine's behaviour.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer — this is a client-side-only app ([ADR-0002](../adr/0002-client-side-only.md)). The in-memory state owned by this feature is one new entry on a previously-existing literal:

```js
// Module-scoped — declared once in Module 2 (Statistical Samplers).
const T_SHIRT_PARAMS = {
  '2XS': { mu: -1.8444, sigma: 0.3575 }, // range [0.1,  0.25] PM   ← NEW (this feature)
  'XS':  { mu: -0.8370, sigma: 0.4286 }, // range [0.25, 0.75] PM
  'S':   { mu:  0.0589, sigma: 0.2703 }, // range [0.75, 1.5]  PM
  'M':   { mu:  0.7521, sigma: 0.2703 }, // range [1.5,  3]    PM
  'L':   { mu:  1.4452, sigma: 0.2703 }, // range [3,    6]    PM
  'XL':  { mu:  1.9945, sigma: 0.1582 }, // range [6,    9]    PM
  'XL+': { mu:  2.3503, sigma: 0.0372 }, // range [10,  11]    PM
};

// (Module 6 — Chart & Stats Rendering)
// renderPreview's per-size sort order — hand-maintained mirror of the
// T_SHIRT_PARAMS insertion order.
const order = ['2XS','XS','S','M','L','XL','XL+'];   // ← NEW: '2XS' prepended
```

No new function, no new module, no new type, no new state. The `(μ, σ)` for `2XS` is `(-1.8444, 0.3575)`:

- `μ = (ln 0.10 + ln 0.25) / 2 = (-2.3026 + -1.3863) / 2 = -1.8444`
- `σ = (ln 0.25 − ln 0.10) / (2 · 1.28155) = 0.9163 / 2.5631 = 0.3575`

These values are precomputed and inlined; the runtime does not re-derive them.

---

## Phase 1: Add `2XS` as a Recognised t-shirt size

### Acceptance behavior

Scenario AT-1: The parameter table includes `2XS` as its first key
Given the page has loaded
When `Object.keys(T_SHIRT_PARAMS)` is evaluated in DevTools
Then it equals `['2XS', 'XS', 'S', 'M', 'L', 'XL', 'XL+']` in that order
(Insertion order is the canonical size order; `2XS` is the first key.)

Scenario AT-2: The `2XS` parameters match the closed-form P10/P90 fit
Given `T_SHIRT_PARAMS['2XS']` is read in DevTools
Then `Math.abs(p.mu - (-1.8444)) < 1e-4`
And `Math.abs(p.sigma - 0.3575) < 1e-4`
(Within floating-point precision of the closed-form derivation from the band `[0.10, 0.25]`.)

Scenario AT-3: The trailing comment documents the band
Given the line `index.html:1230`
Then it carries `// range [0.1,  0.25] PM` (or the equivalent, mirroring the convention of the other entries)

Scenario AT-4: The sidebar T-shirt size reference panel lists `2XS` first
Given the user expands the **T-shirt size reference** `<details>` panel
When the panel renders
Then the first row of the table reads `2XS | 0.10 | 0.25`
And the subsequent rows are `XS | 0.25 | 0.75`, `S | 0.75 | 1.5`, `M | 1.5 | 3`, `L | 3 | 6`, `XL | 6 | 9`, `XL+ | 10 | 11`
And the footer reads `Min ≈ P10, Max ≈ P90 of lognormal distribution`

Scenario AT-5: The Data preview's per-size breakdown sorts `2XS` first
Given a loaded Epics CSV with a mix of `2XS`, `S`, `M` rows
When the **Data preview** renders the `sizeDist` string
Then the string starts with `2XS×<n>` and proceeds in the canonical order `[2XS, XS, S, M, L, XL, XL+]`
(The order array in `renderPreview` is `['2XS','XS','S','M','L','XL','XL+']`.)

Scenario AT-6: `normalizeSize` returns `'2XS'` for any reasonable input casing
Given the user-supplied size label is `'2xs'`, `' 2XS '`, `'2Xs'`, or `'2XS'`
When `normalizeSize(label)` runs
Then it returns the canonical string `'2XS'`
(The function is `(raw || '').trim().toUpperCase()`; no allow-list, no alias map, no change required for this feature.)

Scenario AT-7: A `2XS`-labelled epic enters the Bootstrap pool
Given the loaded Epics CSV has a row with `t_shirt_size: '2XS'` linked to an in-scope **Initiative**
When `prepareSimulationData` ingests the epic
Then the **Bootstrap pool** (`epicSizingDist`) contains the string `'2XS'` (`index.html:1761-1762`)
And the per-initiative epic count includes the row (`index.html:1745-1746`)

Scenario AT-8: A `2XS`-labelled epic in the team-scoped pool participates in the Team Level tab Run
Given the loaded Epics CSV has a `2XS` epic on team `Platform`
When `prepareTeamSimulationData` runs for `Platform`
Then `teamEpicSizingDist` contains `'2XS'` (`index.html:1874-1875`)
And the per-team Run samples `2XS` lognormal effort during its iterations

Scenario AT-9: `sampleLognormal('2XS')` produces samples in the expected range
Given `activeParams === T_SHIRT_PARAMS`
When `sampleLognormal('2XS')` is called 10,000 times
Then approximately 10% of samples fall below 0.10 PM (P10)
And approximately 10% of samples fall above 0.25 PM (P90)
And approximately 80% of samples fall inside `[0.10, 0.25]`
(Within Monte Carlo precision of the closed-form P10/P90 fit, plus or minus a few percentage points.)

Scenario AT-10: `tshirtToPersonMonths('2XS')` returns the lognormal mean
Given `activeParams === T_SHIRT_PARAMS`
When `tshirtToPersonMonths('2XS')` is called
Then it returns `Math.exp(-1.8444 + 0.3575**2 / 2)`, approximately `0.169` PM
(The closed-form lognormal mean; the value [feature 0015](../../backtracked-features.md#0015) consumes for the **Constant work** deterministic shift.)

Scenario AT-11: A `2XS` row in the Constant Work CSV produces the right `[2XS · ~PM]` annotation
Given a **Constant Work CSV** row with `team`, `quarter`, `tshirt_size: '2XS'`
When the row is rendered inside its team's **Projection section**'s **Initiative matrix**
Then the name cell carries `[2XS · ~0.17 PM]` (or the value of `tshirtToPersonMonths('2XS').toFixed(2)`)
And the row carries the soft-green tint (`background:#f0fdf4`)
([Feature 0015](../../backtracked-features.md#0015)'s render fork picks up the new size without change.)

Scenario AT-12: The empty-pool error message lists `2XS` first
Given the user uploads CSVs whose epics produce an empty **Bootstrap pool**
When the run-button handler throws
Then the error message contains the literal substring `"recognised t_shirt_size (2XS, XS, S, M, L, XL, XL+)"`

Scenario AT-13: A CSV with `2XS` epics passing through within-file dedup picks the `2XS` row over an unrecognised-size duplicate
Given the Epics CSV has two rows with the same `_epic_key` — one with `t_shirt_size: '2XS'` and one with `t_shirt_size: 'huge'` (unrecognised)
When `loadEpicsFile` runs the within-file dedup
Then the `2XS` row wins the tie-break (`index.html:1587-1588` — `T_SHIRT_PARAMS[normalizeSize(...)]` is truthy for `2XS`, falsy for `huge`)

Scenario AT-14: A CSV with `2XS` epics influences the org-level Stats and Histogram
Given an Epics CSV whose **Bootstrap pool** has a non-trivial fraction of `2XS` rows
When the user presses **Run Simulation**
Then the per-**Iteration** total effort distribution has a lower P10 / P25 / P50 than the same CSV would have produced before this feature (when `2XS` rows were silently dropped)
And the **Histogram** still binds correctly into 60 fixed-width **Bin**s on `[globalMin, globalMax]`
(No Histogram or Stats code change is needed; the shift is purely a function of the new lognormal samples.)

Scenario AT-15: Toggling Synthetic ↔ Empirical leaves `2XS` samples on the synthetic curve
Given the user toggles to **Empirical parameters** (added by [feature 0018](../../backtracked-features.md#0018))
When `sampleLognormal('2XS')` is called under the empirical toggle
Then the sample is drawn from `Lognormal(-1.8444, 0.3575)` — identical to the synthetic curve
(Because `T_SHIRT_PARAMS_EMPIRICAL['2XS']` carries the synthetic `(μ, σ)` through.)

Scenario AT-16: A CSV with *no* `2XS` rows is unaffected by this feature
Given an Epics CSV containing only `XS`, `S`, `M`, `L`, `XL`, `XL+` rows
When the user presses Run
Then the per-**Iteration** distribution is bit-for-bit identical to what the same CSV would have produced before this feature
(The new parameter entry is never read; no surface enumerates it explicitly.)

### Public entry point

In-code: none new. The new entry on `T_SHIRT_PARAMS` is a data declaration, not a function. The surfaces that *implicitly* expose the change are:
- `sampleLognormal('2XS')` — returns a lognormal sample.
- `tshirtToPersonMonths('2XS')` — returns the lognormal mean.
- `normalizeSize('2xs')` — returns `'2XS'`.
- The **Bootstrap pool** ingestion guards (`prepareSimulationData`, `prepareTeamSimulationData`).
- The within-file epic dedup tie-breaker.

UI: the sidebar **T-shirt size reference** panel's new row; the **Data preview**'s per-size breakdown order; the empty-pool error message; every chart and stats surface that consumes simulation output containing `2XS` samples.

### Expected observable outcomes
- The sidebar reference panel lists `2XS` as the first row.
- The Data preview's size breakdown sorts `2XS` first.
- A `2XS`-labelled epic now flows through the engine; before this feature, it was silently dropped from the Bootstrap pool.
- The per-Iteration effort distribution shifts down by a small amount when the CSV contains `2XS` epics.
- The empty-pool error message lists `2XS` at the head of the size enumeration.
- No CSV that lacks `2XS` rows observes any behavioural change.

### Test harness

Acceptance tests:
- Location: **N/A — manual.** This project has no automated test suite.
- Manual steps:
  1. Open `index.html` cold. Expand the **T-shirt size reference** panel. Confirm the first row reads `2XS | 0.10 | 0.25` and the subsequent rows are unchanged (AT-4).
  2. From DevTools: evaluate `Object.keys(T_SHIRT_PARAMS)` and confirm `['2XS','XS','S','M','L','XL','XL+']` (AT-1).
  3. Evaluate `T_SHIRT_PARAMS['2XS']` and confirm `{ mu: -1.8444, sigma: 0.3575 }` (AT-2).
  4. Evaluate `normalizeSize('2xs')`, `normalizeSize(' 2XS ')`, `normalizeSize('2Xs')`; confirm each returns `'2XS'` (AT-6).
  5. Construct an Epics CSV with `2XS`, `S`, `M` epics linked to in-scope initiatives. Upload. Inspect the **Data preview** and confirm the size breakdown starts with `2XS×<n>` (AT-5, AT-7).
  6. Press Run. Inspect the org-level Histogram and Stats: P10 / P25 should sit slightly below where they would be without the `2XS` rows (AT-14).
  7. Click `Team Level`. For a team that has `2XS` rows, confirm the per-team Run incorporates them (AT-8).
  8. From DevTools: call `sampleLognormal('2XS')` 10,000 times in a tight loop and bucket the results; confirm approximately 10% below 0.10, approximately 10% above 0.25 (AT-9).
  9. Evaluate `tshirtToPersonMonths('2XS')`; confirm approximately `0.169` (AT-10).
  10. Upload a **Constant Work CSV** with a `2XS` row. Press Run. Click `Team Projections`. Confirm the matrix row's name cell carries `[2XS · ~0.17 PM]` and the soft-green tint (AT-11).
  11. Construct an Epics CSV where the in-scope epics have no recognised size. Press Run. Confirm the error message contains `"recognised t_shirt_size (2XS, XS, S, M, L, XL, XL+)"` (AT-12).
  12. Construct an Epics CSV with two rows sharing an `_epic_key` — one `2XS`, one `huge`. Confirm the within-file dedup keeps the `2XS` row (AT-13).
  13. Upload a CSV with no `2XS` rows, run, then add a `2XS` row to the same CSV and re-run; confirm the no-2XS run was unchanged (AT-16).
  14. Toggle to **Empirical parameters** and re-run; confirm `2XS` samples still hit the synthetic curve (AT-15).

Inner tests: N/A.

Verification: manual.

Fake-injection wiring: N/A. The change is a pure data extension to a literal.

### Proposed implementation seams

Stable seams a future test suite may target:
- `T_SHIRT_PARAMS['2XS']` existence and the `(μ, σ)` value matching the closed-form fit of `[0.10, 0.25]` PM.
- `Object.keys(T_SHIRT_PARAMS)[0] === '2XS'` (insertion-order contract).
- The sidebar reference table's first body row reads `2XS | 0.10 | 0.25`.
- `renderPreview`'s order array starts with `'2XS'`.
- The empty-pool error literal contains `(2XS, XS, S, M, L, XL, XL+)`.

Do NOT lock in:
- The exact band values `[0.10, 0.25]` — a future revision could widen or narrow the `2XS` band; the contract is that the band-then-`(μ, σ)` convention is preserved, not that this specific band is canonical.
- The trailing-comment format (`// range [0.1,  0.25] PM`) — purely documentation.
- The order in which `2XS` appears in the sidebar table — descending or ascending could change; the contract is that the panel mirrors `T_SHIRT_PARAMS`' insertion order.
- The exact spelling of the error message string outside of the `(…)` enumeration.

### Behavioral rule

The simulator's **T-shirt size** vocabulary includes `2XS` as a first-class **Recognised t-shirt size**, derived from the documented band `[0.10, 0.25]` PM via the closed-form `(μ, σ)` formula every other size uses. The entry is the *first* key in `T_SHIRT_PARAMS`, the *first* row in the sidebar **T-shirt size reference** panel, the *first* element in `renderPreview`'s sort-order array, and the *first* label in the run-handler's empty-pool error enumeration — preserving the "smallest band at the top, largest at the bottom" reading order across every surface that lists sizes. Every downstream surface (`normalizeSize`, the lognormal sampler, the deterministic-mean helper, the **Bootstrap pool** ingestion, the within-file epic dedup tie-breaker, the **Constant work** render fork) absorbs the new size *without code change* because none of them enumerates the eligible size set; they all gate on `T_SHIRT_PARAMS[size]` truthiness or read from `activeParams[size]`.

### Invariants
- `Object.keys(T_SHIRT_PARAMS)` is `['2XS', 'XS', 'S', 'M', 'L', 'XL', 'XL+']` in that order. JavaScript object-literal insertion order is the canonical size order.
- `T_SHIRT_PARAMS['2XS']` equals `{ mu: -1.8444, sigma: 0.3575 }` (within `1e-4`), the closed-form fit of `[0.10, 0.25]` PM.
- The sidebar **T-shirt size reference** panel's first body row reads `2XS | 0.10 | 0.25`.
- `renderPreview`'s sort-order array starts with `'2XS'` and continues `'XS','S','M','L','XL','XL+'`.
- The run-handler's empty-pool error message lists size labels in the same order as the sidebar reference panel.
- `normalizeSize` is *unchanged* by this feature. It remains `(raw || '').trim().toUpperCase()` — no allow-list, no alias map, no `'XXS' → '2XS'` rule.
- No engine code (`sampleLognormal`, `tshirtToPersonMonths`, `runScenario`, `runSimulation`) is modified.
- The **Empirical parameters** table (`T_SHIRT_PARAMS_EMPIRICAL`) is *not* modified by this feature; its `2XS` entry — synthetic carry-through — is owned by [feature 0018](../../backtracked-features.md#0018).
- A CSV containing zero `2XS` rows produces bit-for-bit identical engine output before and after this feature.

### Counterexamples (must NOT pass)
- A `T_SHIRT_PARAMS['2XS']` entry inserted *after* `XS` in the object literal — would break the "smallest band at the top" insertion-order contract that downstream UIs rely on.
- A `T_SHIRT_PARAMS['XXS']` entry instead of `'2XS'` — would require a `normalizeSize` alias or a parallel parameter set; either contradicts [ADR-0024](../adr/0024-2xs-t-shirt-size-extension.md).
- A `T_SHIRT_PARAMS['2XS']` entry whose `(μ, σ)` is hand-tuned away from the closed-form `(-1.8444, 0.3575)` fit — would silently desynchronise the band column (the user-facing contract) from the parameters the sampler is actually using. See [ADR-0007](../adr/0007-lognormal-effort-distribution.md).
- A `T_SHIRT_PARAMS['2XS']` entry with a `band` field on the value object — would break the "band lives in the trailing comment, `(μ, σ)` lives in the value" convention.
- A `normalizeSize` change that adds `'XXS' → '2XS'` aliasing — out of scope, and contradicts the "single canonical spelling" rule.
- A `normalizeSize` change that adds a `2XS` allow-list filter — would change `normalizeSize`'s shape from a pure transformer into a validator and could reject legitimate user inputs.
- An engine-code change that enumerates `['2XS', 'XS', …]` anywhere outside of `renderPreview`'s sort-order array and the run-handler's error literal — every other surface must remain enumeration-free.
- A `T_SHIRT_PARAMS_EMPIRICAL['2XS']` entry shipped in this feature — that entry is owned by [feature 0018](../../backtracked-features.md#0018) and must not appear here.
- A sidebar row whose `Min PM` / `Max PM` does not mirror the band comment — silent drift between the user-facing documentation and the sampler's inputs.

### Forbidden shortcuts
- Do not introduce a runtime size-derivation helper (`deriveLognormalParams(min, max)`). The `(μ, σ)` values are precomputed and inlined.
- Do not refactor the order arrays (sidebar table, `renderPreview` array, error literal) into a single shared constant. The duplication is intentional — each surface mirrors `T_SHIRT_PARAMS`' insertion order and can be re-derived from it at maintenance time.
- Do not migrate the error literal to `${Object.keys(T_SHIRT_PARAMS).join(', ')}`. Additive in a future revision (per [ADR-0024](../adr/0024-2xs-t-shirt-size-extension.md)); not required by this feature.
- Do not seed an `XL++` or `2XL` band as a companion change. Listed as a future revision in [ADR-0024](../adr/0024-2xs-t-shirt-size-extension.md); out of scope here.
- Do not add a `Min PM ≥ 0` validator or any band-range sanity check. The table is hand-maintained and trusted.
- Do not change `normalizeSize` for any reason. The trim-and-uppercase pipeline already handles `2XS`.
- Do not surface a "fit `(μ, σ)` from a custom band" UI. The table is a maintenance artefact — see [ADR-0007](../adr/0007-lognormal-effort-distribution.md).

### RED gate

On an unimplemented build (the feature has not landed):
- Manual step 1: the sidebar reference panel has only six rows (`XS` through `XL+`); no `2XS` row.
- Manual step 2: `Object.keys(T_SHIRT_PARAMS)` returns `['XS','S','M','L','XL','XL+']`.
- Manual step 5: an Epics CSV with `2XS` rows produces a Data preview that omits `2XS` from the size breakdown; the `2XS` epics are silently dropped from the **Bootstrap pool**.
- Manual step 11: the empty-pool error message lists `(XS, S, M, L, XL, XL+)` — no `2XS`.

### Test immutability rule

There are no test files to freeze (manual harness). If a test suite is later introduced for the parameter table, those tests would live under `tests/acceptance/` and be off-limits to the implementation session.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-16 all pass in a fresh browser tab.
- [ ] `T_SHIRT_PARAMS` keys are `['2XS', 'XS', 'S', 'M', 'L', 'XL', 'XL+']` in that order.
- [ ] `T_SHIRT_PARAMS['2XS']` is `{ mu: -1.8444, sigma: 0.3575 }` (within `1e-4`).
- [ ] The sidebar **T-shirt size reference** panel's first row is `2XS | 0.10 | 0.25`.
- [ ] `renderPreview`'s sort-order array begins with `'2XS'`.
- [ ] The empty-pool error literal contains `(2XS, XS, S, M, L, XL, XL+)`.
- [ ] `normalizeSize`, `sampleLognormal`, `tshirtToPersonMonths`, and the engine are *not* modified.
- [ ] The **Empirical parameters** table is *not* modified by this feature.
- [ ] `git diff` for this feature touches only `index.html` (plus this plan, the ADR, and CONTEXT.md per [ADR-0001](../adr/0001-single-file-html-app.md)).
