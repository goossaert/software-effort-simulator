# Feature: Empirical lognormal parameters mode — parallel table, sidebar radio toggle, global `activeParams` reference

Created at: 2026-04-14T00:00:00Z

## Context

This feature introduces a second per-**T-shirt size** lognormal parameter table — `T_SHIRT_PARAMS_EMPIRICAL` (`index.html:1253-1261`), bias-corrected from Q1 2026 realised effort — alongside the existing **Synthetic parameters** ([feature 0005](./0005-synthetic-lognormal-parameters.md), [ADR-0007](../adr/0007-lognormal-effort-distribution.md)). Which of the two tables the simulator samples against is governed by a single module-scoped mutable reference, `activeParams` (`index.html:1264`), that every sampler reads through. The user toggles between the two tables via a two-option radio group in the sidebar (`<input name="param-mode">`, `index.html:907-919`); the `change` handler reassigns `activeParams` and toggles the `.active` class on the wrapper label. The toggle is *ephemeral*: no persistence, default `synthetic` on every page-load, no run-config metadata stamped onto **Run** output. The feature owns three narrow surfaces: (a) the new `T_SHIRT_PARAMS_EMPIRICAL` constant and the `activeParams` indirection layer in Module 2 (Statistical Samplers), (b) the sidebar radio markup and its CSS in Module 1 (Layout), and (c) the radio-change handler in Module 9 (UI Glue) — see [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).

The feature is deliberately *zero-engine-change* in the same sense [feature 0016](./0016-2xs-t-shirt-size.md) was: the Monte Carlo engine (`runScenario`, `runSimulation`), the **Bootstrap pool** ingestion (`prepareSimulationData`, `prepareTeamSimulationData`), the within-file epic dedup tie-breaker, and every chart / stats / matrix surface absorb the new table transparently because they all already read `activeParams[size]` (the read sites that previously named `T_SHIRT_PARAMS` directly are migrated to `activeParams` as part of this feature). No engine signature changes; no parameter is threaded through any function's argument list; the table swap is a single reference reassignment. The empirical table preserves the synthetic `σ` per size and shifts `μ` by `ln(avg_ratio)`, where `avg_ratio = mean(actual / synthetic_mean)` over the per-size Q1 epics — see [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md) for the methodology trade-offs. Sizes lacking Q1 calibration (`2XS`, `XL`, `XL+`) carry the synthetic `(μ, σ)` through unchanged so the `Object.keys(T_SHIRT_PARAMS_EMPIRICAL)` set matches `Object.keys(T_SHIRT_PARAMS)` exactly — preserving the "every size in both tables" invariant that downstream guards rely on.

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). Both parameter tables, the radio markup, the CSS, and the `change` handler live inline in `index.html`.
- [ADR-0002 — Client-side only](../adr/0002-client-side-only.md). The toggle is ephemeral; the empirical calibration is pinned in source code, not loaded from anywhere at runtime.
- [ADR-0006 — Monte Carlo with bootstrapped historical sizes](../adr/0006-monte-carlo-with-bootstrapped-sizes.md). The Bootstrap pool ingestion gates each epic on `T_SHIRT_PARAMS[size]` truthiness; this feature migrates that read to `activeParams[size]` (functionally identical when the toggle is `synthetic`, the default).
- [ADR-0007 — Lognormal effort distribution, parameterised per t-shirt size](../adr/0007-lognormal-effort-distribution.md). The per-size lognormal contract this feature honours by introducing a *parallel* table rather than mutating the synthetic one.
- [ADR-0024 — Extending the t-shirt size set downward with `2XS`](../adr/0024-2xs-t-shirt-size-extension.md). The `2XS` row in the empirical table is the synthetic carry-through; the calibration window had no `2XS` data.
- [ADR-0026 — Empirical lognormal parameters as a sidebar-toggleable alternative](../adr/0026-empirical-lognormal-parameters-mode-toggle.md). The architectural decision for *why* this feature exists in the shape it does (parallel constant tables, mutable `activeParams` singleton, μ-shift-only calibration, synthetic carry-through for uncalibrated sizes, ephemeral toggle, unchanged reference panel).

Glossary terms used below: **T-shirt size**, **Person-month (PM)**, **Synthetic parameters**, **Empirical parameters**, **Recognised t-shirt size**, **Bootstrap pool**, **Data preview**, **T-shirt size reference**, **Iteration**, **Run**, **Constant work** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user who opens `index.html` cold sees a new **Lognormal Parameters** field group in the sidebar — a labelled `<div>` containing two stacked radio rows. The first row reads `Synthetic lognormal parameters` and is checked by default; its wrapping `<label>` carries the `.active` class (indigo background, indigo border). The second row reads `Empirical lognormal parameters` with a smaller note underneath: `Bias-corrected from Q1 2026 actuals`. The field group sits between the **Iterations** input and the **Run Simulation** button.

A user who clicks the **Empirical** radio sees the indigo `.active` highlight move from the synthetic row to the empirical row; the synthetic row reverts to the default transparent-border style. No simulation re-runs, no chart re-renders, no preview re-paints — the visible state changes are entirely sidebar-local. The next press of **Run Simulation** samples lognormal effort from the empirical `(μ, σ)` table.

A user who presses **Run Simulation** while **Empirical** is selected sees the org-level **Histogram** and **Stats** table reflect the empirical sample distribution — typically a *higher* mean and `P(effort > capacity)` than the synthetic run on the same CSVs, because the Q1 bias-correction shifted `μ` upward for the sizes it could calibrate (`XS`, `S`, `M`, `L`). The **Team Level tab**, the **Team Projections tab**'s **Quick projection Monte Carlo** runs, and every per-team **Effort projection band** all sample against the same active table.

A user who has loaded a **Constant Work CSV** ([feature 0015](./0015-constant-work-csv-upload.md)) sees the constant-work `fixedEffort` shift change when the toggle flips: `tshirtToPersonMonths(size)` reads `activeParams`, so the closed-form mean `e^(μ + σ²/2)` it returns is `e^(μ_synth + σ²/2)` under synthetic and `e^(μ_emp + σ²/2)` under empirical. The `[<size> · ~<PM> PM]` annotation in the **Initiative matrix** updates on the next **Run**.

A user whose CSV contains only `2XS` / `XL` / `XL+` epics (sizes with no Q1 calibration) sees *no visible difference* between the two toggle states — the empirical table carries the synthetic `(μ, σ)` through for those sizes, so `sampleLognormal('2XS')` produces the same per-**Iteration** distribution under either mode.

A user who reloads the page sees the radio reset to **Synthetic** — there is no `localStorage`, no URL parameter, no session memory. A user who toggles to **Empirical**, presses Run, and then reloads loses the toggle state and must re-click to return to empirical. This is the documented behaviour and matches the simulator's overall "no implicit state across sessions" stance ([ADR-0002](../adr/0002-client-side-only.md), [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md)).

A user who expands the sidebar **T-shirt size reference** panel sees the same six (or seven, with `2XS`) rows regardless of toggle state — the panel documents the *synthetic* `[P10, P90]` bands and does not re-render when the radio flips ([ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md)). The user reads the panel as the *definition* of what each size means at ticket-entry time, not as a preview of the current sampling distribution.

There is no user-visible failure mode at this layer. The radio is always interactive (it is not disabled while CSVs are missing or while a Run is in flight); flipping it before pressing Run is a no-op until Run reads `activeParams`. Flipping it during a Run cannot happen in practice because the Run is synchronous within one event-loop tick.

## Scope

### In scope

- The `T_SHIRT_PARAMS_EMPIRICAL` constant (`index.html:1253-1261`): an `Object` with the same key set as `T_SHIRT_PARAMS` (`2XS`, `XS`, `S`, `M`, `L`, `XL`, `XL+`), each value a `{ mu, sigma }` pair. For `XS`, `S`, `M`, `L`: `μ` is the synthetic `μ` shifted by `ln(avg_ratio)`, with `σ` carried through unchanged. For `2XS`, `XL`, `XL+`: `(μ, σ)` is the synthetic carry-through, with a trailing inline comment `// no Q1 data; same as synthetic`. The per-size calibration metadata (`n`, `avg_ratio`, μ-shift) is documented in the leading JSDoc block (`index.html:1239-1252`).
- The `activeParams` mutable binding (`index.html:1264`): `let activeParams = T_SHIRT_PARAMS;` declared once, in the same module-scope as the two constants, immediately following `T_SHIRT_PARAMS_EMPIRICAL`. Default points at the synthetic table.
- Migration of `tshirtToPersonMonths` (`index.html:1272-1276`) to read `activeParams[normalizeSize(size)]` instead of `T_SHIRT_PARAMS[normalizeSize(size)]`.
- Migration of `sampleLognormal` (`index.html:1307-1314`) to read `activeParams[sizeLabel]` instead of `T_SHIRT_PARAMS[sizeLabel]`.
- The sidebar field-group markup (`index.html:907-919`): `<div class="field-group">` containing the `Lognormal Parameters` label and a nested `<div class="param-mode-options" id="param-mode-options">` with two `<label>` wrappers, each wrapping an `<input type="radio" name="param-mode">` and its visible text. The `synthetic` label carries `id="param-label-synthetic" class="active"`; the `empirical` label carries `id="param-label-empirical"` and contains a nested `<span>` with the option text and a `<br>` followed by a `<span class="param-mode-note">` for the `Bias-corrected from Q1 2026 actuals` sub-text.
- The CSS rules for `.param-mode-options`, `.param-mode-options label`, `.param-mode-options label:hover`, `.param-mode-options label.active`, `.param-mode-options input[type=radio]`, and `.param-mode-note` (`index.html:172-199`). Border-radius `5px`, transparent border by default, indigo border + dark indigo background on `.active`.
- The radio `change` handler (`index.html:3293-3300`): a `forEach` over `document.querySelectorAll('input[name="param-mode"]')` that, on `change`, reassigns `activeParams` to `T_SHIRT_PARAMS_EMPIRICAL` if the checked value is `empirical` and to `T_SHIRT_PARAMS` otherwise, then toggles the `.active` class on both `#param-label-synthetic` and `#param-label-empirical`.
- The JSDoc block documenting the empirical calibration methodology (`index.html:1239-1252`): inline source-of-truth for the per-size `n`, `avg_ratio`, and `μ`-shift values, so the calibration is reviewable in code.

### Out of scope

- The synthetic table `T_SHIRT_PARAMS` ([feature 0005](./0005-synthetic-lognormal-parameters.md), [ADR-0007](../adr/0007-lognormal-effort-distribution.md)). This feature does *not* modify any synthetic entry; the synthetic table is the documented baseline the user-facing **T-shirt size reference** panel mirrors.
- The lognormal sampler's *algorithm* (Marsaglia polar Box-Muller + `μ + σ·z`). The sampler reads from `activeParams` but its math is unchanged.
- The **Bootstrap pool** ingestion (`prepareSimulationData` `index.html:1761-1762`, `prepareTeamSimulationData` `index.html:1874-1875`). The truthiness guards (`if (T_SHIRT_PARAMS[size])` → `if (activeParams[size])` — *if* they previously named `T_SHIRT_PARAMS` directly, migrate; otherwise unchanged). The key set is identical between the two tables, so the guard outcome is identical under either mode.
- The within-file epic dedup tie-breaker (`index.html:1587-1588`). Already reads `T_SHIRT_PARAMS[normalizeSize(...)]`; the migration to `activeParams` is part of the in-scope read-site migration above. The dedup outcome is identical under either mode (same key set).
- `normalizeSize` (`index.html:1493`). Unchanged — the function is `(raw || '').trim().toUpperCase()` and does not know which table the result will be looked up against.
- The Monte Carlo engine (`runScenario`, `runSimulation`, `buildTeamProjections`). Engine signatures and bodies are unchanged.
- The sidebar **T-shirt size reference** panel (`index.html:929-949`). Documents the *synthetic* `[P10, P90]` bands and does not re-render on toggle — see [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).
- The **Data preview** (`renderPreview`, `index.html:2818`). Reads the **Bootstrap pool** (size labels) and per-**Initiative** count; neither depends on the active parameter table.
- The org-level **Histogram**, **Stats**, **Marker** system, **Team Level tab**, **Team Projections tab**, **Initiative matrix**. All consume the *output* of `runSimulation`; the active parameter table is encoded in the samples that flow through, not in any of these surfaces' code.
- Persisting the toggle (`localStorage`, URL parameters, session memory). Listed as a future revision in [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).
- Stamping the active mode onto **Run** output (e.g. a `Mode: Synthetic`/`Mode: Empirical` badge). Listed as a future revision in [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).
- A "Custom mode" that lets the user upload a calibration CSV. Listed as a future revision in [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md); would re-open the ADR because the "two parallel constant tables" rule is load-bearing.
- Re-rendering the **T-shirt size reference** panel under empirical mode to show the empirical `[P10, P90]`. Listed as a future revision in [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).
- Disabling the radio while CSVs are missing or while a Run is in flight. The radio is always interactive; the Run reads `activeParams` once it starts.
- A "Reset to synthetic" button or a confirmation prompt before switching to empirical. The radio itself *is* the reset; the toggle is one click in either direction.
- Per-team or per-Key-Result empirical tables. Listed as a future revision in [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).

## Relevant existing files

Claude may inspect:
- `index.html`, specifically:
  - `T_SHIRT_PARAMS` declaration and its preceding JSDoc block (`index.html:1210-1237`) — *for context only*; this feature does not modify the table.
  - `tshirtToPersonMonths` (`index.html:1272-1276`) — *for migration*: change the lookup to read `activeParams` instead of `T_SHIRT_PARAMS` if not already.
  - `sampleLognormal` (`index.html:1307-1314`) — *for migration*: same.
  - `normalizeSize` (`index.html:1493`) — *for context only*; unchanged.
  - The **Iterations** field-group (`index.html:902-905`) — *for context only*; the new field group sits immediately after this.
  - The **Run Simulation** button (`index.html:921`) — *for context only*; the new field group sits immediately before this.
  - Module 1's existing field-group CSS conventions (around `index.html:90-200`) — the new `.param-mode-options` rules slot into the same module.
  - Module 9's existing input-change handlers (`index.html:3275-3300`) — the new radio handler slots into the same module.
- `CONTEXT.md` glossary — the **Synthetic parameters**, **Empirical parameters**, **T-shirt size**, **Recognised t-shirt size**, **T-shirt size reference**, and **Constant work** entries.
- [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md) — the architectural decision this feature implements.
- [ADR-0007](../adr/0007-lognormal-effort-distribution.md) — the per-size lognormal contract the parallel table honours.
- [ADR-0024](../adr/0024-2xs-t-shirt-size-extension.md) — the rationale for the `2XS` synthetic carry-through.
- `docs/plans/0005-synthetic-lognormal-parameters.md` — the prior plan that established the parameter-table pattern.

Claude should not inspect unless needed:
- The Monte Carlo engine internals (`runScenario`, `runSimulation`).
- The CSV parsing / **Column detector** family — orthogonal data flow.
- The chart, stats-table, **Marker** system, **Team Level tab**, **Team Projections tab**, **Initiative matrix** code — all consume `runSimulation` output and are agnostic to the parameter table.
- The **Constant Work CSV** parsing — orthogonal data flow; `tshirtToPersonMonths` (which it consumes) is the read-through point.

## Existing patterns to follow

- **Layering inside `index.html`**: the two parameter tables and the `activeParams` binding live in Module 2 (Statistical Samplers), in the same neighbourhood as `sampleLognormal` and `tshirtToPersonMonths`. The radio markup lives in the sidebar HTML in Module 1, immediately after the **Iterations** field-group and immediately before the **Run Simulation** button. The CSS rules live in Module 1's `<style>` block, near the other field-group conventions. The `change` handler lives in Module 9 (UI Glue), near the other input-event listeners. There is *no* new module, *no* new helper file, *no* refactor of the engine.
- **Parallel constant tables, never a merged table with a "mode" column**: the two tables are declared independently and named distinctly. A merged structure (e.g. `{ XS: { synthetic: {…}, empirical: {…} } }`) would force every sampler to thread a mode-key through every lookup; the parallel-tables-plus-`activeParams`-reference pattern reads as one indirection at the read site — see [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).
- **`activeParams` is a `let`, not a `const`**: the binding is reassigned on every radio change. Reassigning the reference is the *only* mutation the toggle performs; the contents of either table are never mutated.
- **`activeParams` is read directly by every sampler**: do not pre-cache a destructured `(μ, σ)` outside the call stack; every sample reads `activeParams[size]` fresh so a mid-Run reassignment (which is impossible in practice but cheap to be safe against) would still produce a coherent table lookup.
- **Object literal documented at declaration**: the JSDoc above `T_SHIRT_PARAMS_EMPIRICAL` documents the per-size `n`, `avg_ratio`, and `μ`-shift values so the calibration is reviewable without leaving the file. The trailing inline comments on each entry mirror the synthetic table's `// range [<min>, <max>] PM` convention with a calibration-summary line instead (e.g. `// n=14, avg ratio 1.51`).
- **CSS scoping**: the new `.param-mode-options` rules use a unique class name not shared with any other surface. The `.param-mode-note` class is similarly unique. The `.active` class is applied on a child selector (`.param-mode-options label.active`) so it does not collide with the tab bar's `.active` class.
- **Radio ↔ label visual coupling via `.active`**: the wrapper `<label>` carries the `.active` class to drive the highlighted-row styling. The radio's `checked` state is the canonical truth (it determines `activeParams`); the `.active` class on the wrapper is a visual mirror updated by the `change` handler. This matches the pattern used by the **Historical data toggle** on the **Team Level tab**.
- **`change` handler reads `radio.value`, not `radio.checked`**: the handler attaches to *both* radios; whichever fires the `change` event is the now-selected radio (radio groups only fire `change` on the radio gaining `checked`). Reading `radio.value` makes the handler's intent self-documenting.
- **No framework, no library**: vanilla DOM, the existing Module 2 sampler bindings, vanilla CSS. The toggle is one DOM event listener and one reference reassignment.
- **Verification command**: manual. Open `index.html`, observe the radio, toggle it, press Run under each mode, evaluate `activeParams` in DevTools, and confirm the per-size sample distributions shift as documented.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer — this is a client-side-only app ([ADR-0002](../adr/0002-client-side-only.md)). The in-memory state owned by this feature is one new constant, one new mutable binding, and one DOM input the `change` handler reads:

```js
// Module 2 — Statistical Samplers.

// Synthetic table (existing; [feature 0005], [ADR-0007]). Unchanged by this feature.
const T_SHIRT_PARAMS = { /* ... existing seven entries ... */ };

// Empirical table — bias-corrected from Q1 2026 realised effort (n = 36 epics).
// μ shifted by ln(avg_ratio); σ preserved from synthetic.
// 2XS, XL, XL+: no Q1 data → synthetic carry-through.
const T_SHIRT_PARAMS_EMPIRICAL = {
  '2XS': { mu: -1.8444, sigma: 0.3575 }, // no Q1 data; same as synthetic
  'XS':  { mu: -0.5093, sigma: 0.4286 }, // n=10, avg ratio 1.39
  'S':   { mu:  0.4704, sigma: 0.2703 }, // n=14, avg ratio 1.51
  'M':   { mu:  0.9636, sigma: 0.2703 }, // n=8,  avg ratio 1.24
  'L':   { mu:  1.7550, sigma: 0.2703 }, // n=3,  avg ratio 1.36
  'XL':  { mu:  1.9945, sigma: 0.1582 }, // no Q1 data; same as synthetic
  'XL+': { mu:  2.3503, sigma: 0.0372 }, // no Q1 data; same as synthetic
};

// Active parameter set — reassigned by the sidebar radio handler.
let activeParams = T_SHIRT_PARAMS;
```

The DOM input:
```html
<!-- Module 1 — sidebar field-group -->
<div class="field-group">
  <label>Lognormal Parameters</label>
  <div class="param-mode-options" id="param-mode-options">
    <label id="param-label-synthetic" class="active">
      <input type="radio" name="param-mode" value="synthetic" checked>
      Synthetic lognormal parameters
    </label>
    <label id="param-label-empirical">
      <input type="radio" name="param-mode" value="empirical">
      <span>Empirical lognormal parameters<br>
        <span class="param-mode-note">Bias-corrected from Q1 2026 actuals</span>
      </span>
    </label>
  </div>
</div>
```

No new function, no new module, no new type. The per-size `μ` shifts are precomputed and inlined:

- `XS`:  `μ_emp = -0.8370 + ln(1.39) ≈ -0.8370 + 0.3293 ≈ -0.5077` (declared as `-0.5093` reflecting the source-of-truth `avg_ratio` to more precision than the comment's `1.39`).
- `S`:   `μ_emp =  0.0589 + ln(1.51) ≈  0.0589 + 0.4121 ≈  0.4710` (declared as `0.4704`).
- `M`:   `μ_emp =  0.7521 + ln(1.24) ≈  0.7521 + 0.2151 ≈  0.9672` (declared as `0.9636`).
- `L`:   `μ_emp =  1.4452 + ln(1.36) ≈  1.4452 + 0.3075 ≈  1.7527` (declared as `1.7550`).

These small discrepancies between the comment's two-decimal ratio and the table's four-decimal `μ_emp` reflect that the comment's `avg_ratio` is rounded for readability while the declared `μ_emp` uses the un-rounded source value; both are accurate within the calibration's intrinsic noise (per-size `n ≤ 14`).

---

## Phase 1: Parallel empirical table and `activeParams` indirection layer

### Acceptance behavior

Scenario AT-1: `T_SHIRT_PARAMS_EMPIRICAL` is declared with the same key set as `T_SHIRT_PARAMS`
Given the page has loaded
When `Object.keys(T_SHIRT_PARAMS_EMPIRICAL)` is evaluated in DevTools
Then it equals `['2XS', 'XS', 'S', 'M', 'L', 'XL', 'XL+']` (the same order and the same set as `T_SHIRT_PARAMS`)
(The "every size in both tables" invariant from [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).)

Scenario AT-2: `T_SHIRT_PARAMS_EMPIRICAL`'s `σ` per size matches the synthetic `σ` exactly
Given the page has loaded
When each key `k` in `T_SHIRT_PARAMS_EMPIRICAL` is read
Then `T_SHIRT_PARAMS_EMPIRICAL[k].sigma === T_SHIRT_PARAMS[k].sigma`
(The `σ`-preserving μ-shift contract from [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).)

Scenario AT-3: For sizes with Q1 calibration data, empirical `μ` is approximately `synthetic μ + ln(avg_ratio)`
Given the page has loaded
When the per-size shifts are evaluated for `XS`, `S`, `M`, `L`
Then `|T_SHIRT_PARAMS_EMPIRICAL.XS.mu - (T_SHIRT_PARAMS.XS.mu + Math.log(1.39))| < 0.02`
And similarly for `S` against `1.51`, `M` against `1.24`, `L` against `1.36` (within `0.01–0.02` of the documented ratio)
(The small discrepancy reflects the rounded `avg_ratio` in the comments; the declared `μ` uses the source-of-truth ratio.)

Scenario AT-4: For sizes lacking Q1 data, empirical `(μ, σ)` equals synthetic `(μ, σ)` exactly
Given the page has loaded
When `T_SHIRT_PARAMS_EMPIRICAL[k]` is read for `k` in `['2XS', 'XL', 'XL+']`
Then `T_SHIRT_PARAMS_EMPIRICAL[k].mu === T_SHIRT_PARAMS[k].mu`
And `T_SHIRT_PARAMS_EMPIRICAL[k].sigma === T_SHIRT_PARAMS[k].sigma`
(The synthetic carry-through rule from [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).)

Scenario AT-5: The empirical table's JSDoc documents the calibration source and per-size summary
Given the source of `index.html` around line 1239
When the user reads the JSDoc block immediately above `T_SHIRT_PARAMS_EMPIRICAL`
Then it explains the bias-correction method (`shift μ by ln(avg_ratio)`, preserve σ)
And it lists per-size `n` and `avg_ratio` for the calibrated sizes
And it notes which sizes are synthetic carry-through

Scenario AT-6: `activeParams` is a `let` binding initialised to `T_SHIRT_PARAMS`
Given the page has loaded
When `activeParams` is evaluated in DevTools
Then `activeParams === T_SHIRT_PARAMS` (identity, not deep-equal)
(The default-synthetic rule from [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).)

Scenario AT-7: `activeParams` can be reassigned to point at the empirical table
Given `activeParams === T_SHIRT_PARAMS`
When `activeParams = T_SHIRT_PARAMS_EMPIRICAL` is evaluated in DevTools
Then `activeParams === T_SHIRT_PARAMS_EMPIRICAL` (the binding is `let`, not `const`)

Scenario AT-8: `sampleLognormal` reads through `activeParams`
Given `activeParams === T_SHIRT_PARAMS_EMPIRICAL`
When `sampleLognormal('XS')` is called
Then the sample is drawn from `Lognormal(T_SHIRT_PARAMS_EMPIRICAL.XS.mu, T_SHIRT_PARAMS_EMPIRICAL.XS.sigma)`
(Verifiable by sampling 10,000 times and confirming the mean is approximately `e^(μ_emp + σ²/2) ≈ e^(-0.5093 + 0.4286²/2) ≈ 0.66` PM, vs the synthetic `~0.47` PM.)

Scenario AT-9: `tshirtToPersonMonths` reads through `activeParams`
Given `activeParams === T_SHIRT_PARAMS_EMPIRICAL`
When `tshirtToPersonMonths('XS')` is called
Then it returns `Math.exp(T_SHIRT_PARAMS_EMPIRICAL.XS.mu + T_SHIRT_PARAMS_EMPIRICAL.XS.sigma**2 / 2)`, approximately `0.66` PM
(Vs the synthetic value `~0.47` PM.)

Scenario AT-10: `sampleLognormal` on a size lacking Q1 calibration produces the same distribution under either mode
Given `activeParams === T_SHIRT_PARAMS_EMPIRICAL`
When `sampleLognormal('2XS')` is called 10,000 times
Then the sample mean and quantiles match the synthetic mode's `sampleLognormal('2XS')` 10,000-sample distribution within Monte Carlo precision
(The synthetic carry-through means `T_SHIRT_PARAMS_EMPIRICAL['2XS']` and `T_SHIRT_PARAMS['2XS']` are identity-equal in `(μ, σ)`.)

Scenario AT-11: Reassigning `activeParams` mid-DevTools does not corrupt `T_SHIRT_PARAMS` or `T_SHIRT_PARAMS_EMPIRICAL`
Given the user reassigns `activeParams = T_SHIRT_PARAMS_EMPIRICAL` in DevTools
When the user inspects `T_SHIRT_PARAMS` and `T_SHIRT_PARAMS_EMPIRICAL`
Then both objects are still their original declared shape
And no entry was deleted, added, or mutated
(`activeParams` is a reference, not a copy; reassigning the reference does not touch either backing object.)

Scenario AT-12: The **Bootstrap pool** ingestion and within-file dedup work identically under either mode
Given an Epics CSV with a mix of `XS`, `S`, `M`, `L`, `XL` rows
When the pool is ingested under `activeParams === T_SHIRT_PARAMS`
And the pool is re-ingested under `activeParams === T_SHIRT_PARAMS_EMPIRICAL`
Then the resulting **Bootstrap pool** arrays are identical (same size labels, same length, same order)
(The guards key on `activeParams[size]` truthiness; both tables have the same key set.)

Scenario AT-13: A **Constant work** row's `[<size> · ~<PM> PM]` annotation reflects the active table
Given a **Constant Work CSV** row with `tshirt_size: 'XS'`
When `activeParams === T_SHIRT_PARAMS` and Run is pressed
Then the matrix row's name cell reads `[XS · ~0.47 PM]` (synthetic mean)
When `activeParams === T_SHIRT_PARAMS_EMPIRICAL` and Run is pressed
Then the matrix row's name cell reads `[XS · ~0.66 PM]` (empirical mean)
(`tshirtToPersonMonths` reads through `activeParams` → the formatted PM updates with the toggle on the next **Run**.)

Scenario AT-14: An Epics CSV with no `XS`/`S`/`M`/`L` rows produces near-identical org-level Stats under either mode
Given an Epics CSV whose in-scope epics are only `2XS`, `XL`, `XL+` (all synthetic carry-through sizes)
When Run is pressed under either mode
Then the org-level **Stats** tuple (`p10, p25, p50, p75, p90, mean`) differs only by per-Run Monte Carlo noise
(Because the active table's entries for those sizes are identity-equal to the synthetic table's entries.)

### Public entry point

In-code: none new at the API surface. The new declarations are:
- `T_SHIRT_PARAMS_EMPIRICAL` (a `const Object`).
- `activeParams` (a `let` binding).

The migrated read sites are `sampleLognormal` (`index.html:1307-1314`) and `tshirtToPersonMonths` (`index.html:1272-1276`). Both now read `activeParams[...]` instead of `T_SHIRT_PARAMS[...]`.

UI: none in this phase (the radio markup is Phase 2).

### Expected observable outcomes

- A second per-size parameter table exists alongside the synthetic one, with identical key set and σ values, and shifted μ for the four sizes calibrated against Q1 2026 actuals.
- A mutable `activeParams` reference defaults to the synthetic table and can be reassigned by external code.
- Every sampler (`sampleLognormal`, `tshirtToPersonMonths`) reads through `activeParams` rather than naming a specific table.
- A DevTools reassignment of `activeParams` immediately changes which table the next sample is drawn from, *without* a page reload or an additional re-binding step.

### Test harness

Acceptance tests:
- Location: **N/A — manual.** This project has no automated test suite.
- Manual steps:
  1. Open `index.html` cold. In DevTools, evaluate `Object.keys(T_SHIRT_PARAMS_EMPIRICAL)` and confirm `['2XS','XS','S','M','L','XL','XL+']` (AT-1).
  2. Evaluate `T_SHIRT_PARAMS_EMPIRICAL.XS.sigma === T_SHIRT_PARAMS.XS.sigma` and similarly for `S`, `M`, `L`, `2XS`, `XL`, `XL+`; confirm all true (AT-2).
  3. Compute `Math.abs(T_SHIRT_PARAMS_EMPIRICAL.XS.mu - (T_SHIRT_PARAMS.XS.mu + Math.log(1.39)))` and confirm `< 0.02`; repeat for `S`, `M`, `L` (AT-3).
  4. Confirm `T_SHIRT_PARAMS_EMPIRICAL['2XS'].mu === T_SHIRT_PARAMS['2XS'].mu` and similarly for `XL`, `XL+` (AT-4).
  5. Read the JSDoc block at `index.html:1239-1252` and confirm it documents method + per-size `n`/`avg_ratio` (AT-5).
  6. Evaluate `activeParams === T_SHIRT_PARAMS`; confirm true (AT-6).
  7. Assign `activeParams = T_SHIRT_PARAMS_EMPIRICAL` in DevTools; confirm the assignment succeeds (AT-7).
  8. While `activeParams === T_SHIRT_PARAMS_EMPIRICAL`, call `sampleLognormal('XS')` in a loop of 10,000 and confirm the sample mean is approximately `0.66` PM, materially above the synthetic mean (`~0.47` PM) (AT-8).
  9. Call `tshirtToPersonMonths('XS')`; confirm `~0.66` (AT-9).
  10. Call `sampleLognormal('2XS')` 10,000 times under both modes; confirm the empirical-mode mean matches the synthetic-mode mean within Monte Carlo precision (AT-10).
  11. Reassign `activeParams` back to `T_SHIRT_PARAMS`; confirm both backing objects are unmodified (AT-11).
  12. Upload an Epics CSV with mixed sizes; run `prepareSimulationData` under each mode; confirm the **Bootstrap pool** arrays are identical (AT-12).
  13. Upload a **Constant Work CSV** with an `XS` row; press Run under each mode; confirm the matrix annotation changes from `[XS · ~0.47 PM]` to `[XS · ~0.66 PM]` (AT-13).
  14. Upload an Epics CSV whose in-scope epics are only `2XS`/`XL`/`XL+`; press Run under each mode; confirm the **Stats** tuples differ only by Monte Carlo noise (AT-14).

Inner tests: N/A.

Verification: manual.

### Behavioral rule

Two per-**T-shirt size** lognormal parameter tables exist in module scope: `T_SHIRT_PARAMS` (the **Synthetic parameters** introduced by [feature 0005](./0005-synthetic-lognormal-parameters.md), unchanged) and `T_SHIRT_PARAMS_EMPIRICAL` (the **Empirical parameters**, bias-corrected from Q1 2026 actuals). Both tables share the exact same key set — `Object.keys` returns the same array in the same order — so every consumer that gates on key presence behaves identically under either active table. The empirical table preserves the synthetic `σ` per size and shifts `μ` by `ln(avg_ratio)` for the four sizes with calibration data (`XS`, `S`, `M`, `L`); the three sizes lacking Q1 data (`2XS`, `XL`, `XL+`) carry the synthetic `(μ, σ)` through unchanged. A single mutable reference `activeParams` (declared `let`, initialised to `T_SHIRT_PARAMS`) points at whichever of the two tables is currently live; `sampleLognormal` and `tshirtToPersonMonths` dereference `activeParams[size]` on every call, so a reassignment of `activeParams` is immediately observable in the next sample without any other re-binding.

### Invariants

- `Object.keys(T_SHIRT_PARAMS_EMPIRICAL)` deep-equals `Object.keys(T_SHIRT_PARAMS)`. The "every size in both tables" invariant is the contract every downstream key-presence guard depends on.
- For every `k` in either table, `T_SHIRT_PARAMS_EMPIRICAL[k].sigma === T_SHIRT_PARAMS[k].sigma`. σ is never re-fit in the empirical table — see [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).
- For `k ∈ {'2XS', 'XL', 'XL+'}` (sizes with no Q1 calibration), `T_SHIRT_PARAMS_EMPIRICAL[k]` is identity-equal to the synthetic-band fit; in particular `T_SHIRT_PARAMS_EMPIRICAL[k].mu === T_SHIRT_PARAMS[k].mu`.
- For `k ∈ {'XS', 'S', 'M', 'L'}` (calibrated sizes), `T_SHIRT_PARAMS_EMPIRICAL[k].mu` is greater than `T_SHIRT_PARAMS[k].mu` (every Q1 `avg_ratio` was `> 1`, so the shift is upward).
- `activeParams` is declared `let activeParams = T_SHIRT_PARAMS;` — default-synthetic. The binding is the only mutable state introduced by this feature.
- Both backing objects (`T_SHIRT_PARAMS`, `T_SHIRT_PARAMS_EMPIRICAL`) are *never* mutated by the toggle. Only the `activeParams` reference is reassigned.
- `sampleLognormal` and `tshirtToPersonMonths` read `activeParams[size]` on every call — no caching outside the call stack.
- The Monte Carlo engine, the **Bootstrap pool** ingestion, the within-file epic dedup tie-breaker, the **Column detector** family, `normalizeSize`, the **T-shirt size reference** panel, the **Data preview**, and every chart/stats/matrix surface are *not* modified by this phase. The migration of any `T_SHIRT_PARAMS`-direct read sites to `activeParams` is purely additive and observably identical under the default `activeParams === T_SHIRT_PARAMS`.

### Counterexamples (must NOT pass)

- A `T_SHIRT_PARAMS_EMPIRICAL` whose key set differs from `T_SHIRT_PARAMS` (e.g. missing `2XS` or `XL+`) — would silently drop samples of those sizes under empirical mode, contradicting [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).
- A `T_SHIRT_PARAMS_EMPIRICAL` whose `σ` for any size differs from the synthetic `σ` — contradicts the σ-preserving μ-shift contract; would communicate confidence in σ that the per-size `n` does not support.
- A `T_SHIRT_PARAMS_EMPIRICAL` whose entry for `2XS` / `XL` / `XL+` differs from the synthetic entry — contradicts the synthetic carry-through rule for uncalibrated sizes.
- A `T_SHIRT_PARAMS_EMPIRICAL` declared as `const = { ...T_SHIRT_PARAMS, XS: {...} }` (spread-then-override) — *would technically satisfy* the key-set invariant but obscures the calibration intent; declare each entry inline with its own calibration comment instead.
- A merged single-table shape (e.g. `{ XS: { synthetic: {…}, empirical: {…} } }`) — would force every sampler to thread a mode through every lookup; contradicts the parallel-tables-plus-`activeParams`-reference pattern.
- An `activeParams` declared `const` — would prevent the radio handler from reassigning it; the feature does not work.
- An `activeParams` initialised to `T_SHIRT_PARAMS_EMPIRICAL` — contradicts the default-synthetic rule and would silently change every Run's behaviour on a fresh page-load.
- A `sampleLognormal` or `tshirtToPersonMonths` that names `T_SHIRT_PARAMS` directly after this feature lands — would silently ignore the toggle; the read sites must go through `activeParams`.
- A `sampleLognormal` that destructures `activeParams[size]` outside the call (e.g. into a module-scoped cache) — would defeat the reassignment-takes-effect-immediately semantics; the read must happen inside the call.
- A toggle handler that mutates either `T_SHIRT_PARAMS` or `T_SHIRT_PARAMS_EMPIRICAL` instead of reassigning `activeParams` — would corrupt the backing tables irreversibly.

### Forbidden shortcuts

- Do not derive the empirical `μ` values at runtime from a `Math.log(avg_ratio)` computation. The `μ_emp` values are precomputed and inlined; the comment's `avg_ratio` is illustrative metadata, not the source of truth.
- Do not introduce a `mode: 'synthetic' | 'empirical'` global string. The `activeParams` reference *is* the mode; deriving the mode from the reference (or vice-versa) is unnecessary indirection.
- Do not migrate the engine signature to accept a `params` argument. The mutable singleton is the documented integration point — see [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).
- Do not introduce a `getActiveParams()` helper. Every reader names `activeParams` directly; the read sites are short enough that a helper is needless indirection.
- Do not pre-compute lognormal sample arrays under each mode. Sampling happens inside the Monte Carlo hot loop; pre-computing would defeat the per-iteration independence that [ADR-0006](../adr/0006-monte-carlo-with-bootstrapped-sizes.md) depends on.
- Do not introduce a third "calibration neighbour" rule that maps `XL`-empirical to `L`-empirical (or any other neighbour-based inference). The synthetic carry-through is the documented and ADR-pinned rule — see [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).
- Do not validate `T_SHIRT_PARAMS_EMPIRICAL`'s shape at runtime (e.g. assert that every synthetic key has an empirical entry). The tables are hand-maintained and trusted; a runtime check would flag developer-time errors at user-time.

### RED gate

On an unimplemented build (the feature has not landed):
- Manual step 1: `T_SHIRT_PARAMS_EMPIRICAL` is `undefined` (`ReferenceError`).
- Manual step 6: `activeParams` is `undefined`.
- Manual step 7: assigning `activeParams = ...` throws (`activeParams is not defined`) or has no effect on the samplers (they still name `T_SHIRT_PARAMS` directly).
- Manual step 8: `sampleLognormal('XS')` produces the synthetic distribution under either reassignment attempt.

### Test immutability rule

There are no test files to freeze (manual harness). If a test suite is later introduced, tests for the empirical table's shape (key set, σ preservation, calibrated-vs-carry-through partition) would live under `tests/acceptance/` and be off-limits to the implementation session.

### Definition of done

- [ ] Manual scenarios AT-1 through AT-14 all pass.
- [ ] `T_SHIRT_PARAMS_EMPIRICAL` is declared with the documented key set and entries.
- [ ] `T_SHIRT_PARAMS_EMPIRICAL[k].sigma === T_SHIRT_PARAMS[k].sigma` for every `k`.
- [ ] `T_SHIRT_PARAMS_EMPIRICAL[k] === T_SHIRT_PARAMS[k]` deep-equal for `k ∈ {'2XS','XL','XL+'}`.
- [ ] `activeParams` is declared `let`, initialised to `T_SHIRT_PARAMS`.
- [ ] `sampleLognormal` and `tshirtToPersonMonths` read through `activeParams`.
- [ ] No engine code, no detection code, no chart/stats/matrix code is modified.
- [ ] `git diff` for this phase touches only `index.html` (plus this plan, the ADR, and CONTEXT.md per [ADR-0001](../adr/0001-single-file-html-app.md)).

---

## Phase 2: Sidebar radio toggle that reassigns `activeParams`

### Acceptance behavior

Scenario AT-1: The sidebar carries a Lognormal Parameters field group between Iterations and Run Simulation
Given the user opens `index.html`
When the user looks at the sidebar
Then the field-group sequence reads: `Capacity` → `Iterations` → `Lognormal Parameters` → `Run Simulation`
And the `Lognormal Parameters` group's label reads exactly that
And the group contains two stacked radio rows

Scenario AT-2: The radio group's options are `synthetic` (checked) and `empirical`
Given the page has loaded
When the user inspects the radio inputs
Then `document.querySelectorAll('input[name="param-mode"]').length === 2`
And the first input has `value="synthetic"` and `checked === true`
And the second input has `value="empirical"` and `checked === false`

Scenario AT-3: The synthetic row's label text reads exactly `Synthetic lognormal parameters`
Given the page has loaded
Then the `<label id="param-label-synthetic">`'s text content includes the string `Synthetic lognormal parameters`
And it does *not* include a sub-note

Scenario AT-4: The empirical row's label text reads `Empirical lognormal parameters` plus a sub-note
Given the page has loaded
Then the `<label id="param-label-empirical">`'s text content includes the string `Empirical lognormal parameters`
And it includes the sub-note `Bias-corrected from Q1 2026 actuals` in a `<span class="param-mode-note">`

Scenario AT-5: The synthetic row carries the `.active` class by default
Given the page has loaded cold
Then `document.getElementById('param-label-synthetic').classList.contains('active')` is true
And `document.getElementById('param-label-empirical').classList.contains('active')` is false

Scenario AT-6: Clicking the empirical radio reassigns `activeParams` to the empirical table
Given the page has loaded cold and `activeParams === T_SHIRT_PARAMS`
When the user clicks the empirical radio
Then a `change` event fires on the empirical radio
And `activeParams === T_SHIRT_PARAMS_EMPIRICAL`

Scenario AT-7: Clicking the empirical radio toggles the `.active` class to the empirical wrapper label
Given the synthetic radio was previously selected
When the user clicks the empirical radio
Then `param-label-synthetic.classList.contains('active')` is false
And `param-label-empirical.classList.contains('active')` is true

Scenario AT-8: Clicking the synthetic radio reassigns `activeParams` back to the synthetic table
Given the empirical radio was previously selected and `activeParams === T_SHIRT_PARAMS_EMPIRICAL`
When the user clicks the synthetic radio
Then `activeParams === T_SHIRT_PARAMS`
And `param-label-synthetic.classList.contains('active')` is true
And `param-label-empirical.classList.contains('active')` is false

Scenario AT-9: Toggling the radio does *not* trigger a Run
Given the user has loaded CSVs and pressed Run once (so the chart and stats are populated)
When the user clicks either radio
Then `runSimulation` is *not* called
And the chart and stats table are *not* re-rendered
(The toggle is a value change only; the user must press Run to see its effect.)

Scenario AT-10: Toggling the radio does *not* re-paint the Data preview
Given the **Data preview** is visible with a current Bootstrap pool breakdown
When the user clicks either radio
Then `renderPreview` is *not* called
And the Data preview is *not* updated
(The Data preview reads CSV-derived data; the parameter table does not enter the preview.)

Scenario AT-11: Toggling the radio does *not* re-render the T-shirt size reference panel
Given the user has expanded the **T-shirt size reference** `<details>`
When the user clicks either radio
Then the panel's rows are unchanged
And the band columns continue to show the synthetic `[P10, P90]` values
(The panel is band-as-definition, not band-as-current-sampling-window — see [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).)

Scenario AT-12: Pressing Run after toggling to empirical produces a higher mean than the synthetic baseline on the same CSV
Given the user has loaded CSVs with a representative mix of `XS`/`S`/`M`/`L` epics
And the user has pressed Run under the default synthetic mode and recorded the org-level mean
When the user toggles to empirical and presses Run again
Then the new org-level mean is materially higher than the synthetic baseline (typically by a factor of `~1.3` to `~1.5`)
And the new `P(effort > capacity)` for each scenario is higher than the synthetic baseline
(The Q1 `avg_ratio`s were all `> 1`, so empirical samples are larger on expectation.)

Scenario AT-13: Pressing Run on a CSV containing only `2XS`/`XL`/`XL+` epics produces near-identical Stats under either mode
Given the user has loaded an Epics CSV whose in-scope epics are only synthetic carry-through sizes
When the user runs under each mode
Then the org-level Stats differ only by per-Run Monte Carlo noise
(Synthetic and empirical entries for those sizes are identity-equal.)

Scenario AT-14: Reloading the page resets the radio to synthetic
Given the user has clicked the empirical radio and runs are reflecting empirical parameters
When the user reloads the page
Then the synthetic radio is checked by default
And `activeParams === T_SHIRT_PARAMS`
And no `localStorage` key holds the toggle state
(The toggle is ephemeral — see [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).)

Scenario AT-15: The radio is interactive even before CSVs are loaded
Given the user has opened `index.html` cold with no CSVs uploaded
When the user clicks the empirical radio
Then the radio change succeeds (`activeParams` reassigns; `.active` class moves)
And no error is thrown
(The radio does not gate on CSV state.)

Scenario AT-16: The radio's keyboard interaction matches a standard HTML radio group
Given the synthetic radio has keyboard focus
When the user presses the Down arrow key
Then the empirical radio becomes checked (browser-native radio-group keyboard behaviour)
And the `change` event fires and the handler runs

Scenario AT-17: Toggling repeatedly does not accumulate stale `.active` classes or duplicate event listeners
Given the user toggles synthetic ↔ empirical fifty times in succession
When the page state is inspected
Then exactly one of the two labels carries `.active` at any moment
And the `change` handlers are still attached once each (not multiplied)
And `activeParams` references the currently-checked option's table

### Public entry point

In-code:
- The `change` event handler installed at module-load (`index.html:3293-3300`).

UI: the sidebar `Lognormal Parameters` field group and its two radios.

### Expected observable outcomes

- The sidebar carries a discoverable two-option toggle for the lognormal parameter set.
- Flipping the toggle is a one-click, no-modal, no-confirmation interaction.
- The toggle's only effect is to reassign `activeParams`; nothing else re-renders.
- The next Run reflects the active table; the previous Run's output stays visible until a fresh Run is pressed.
- The toggle resets on page reload — no implicit state across sessions.

### Test harness

Acceptance tests:
- Location: **N/A — manual.**
- Manual steps:
  1. Open `index.html` cold. Inspect the sidebar; confirm the field-group sequence `Capacity → Iterations → Lognormal Parameters → Run Simulation` (AT-1).
  2. Open DevTools; evaluate `document.querySelectorAll('input[name="param-mode"]').length` and confirm `2` (AT-2).
  3. Read the label text of each row and confirm the exact strings (AT-3, AT-4).
  4. Confirm the synthetic wrapper has `.active` (AT-5).
  5. Click the empirical radio; in DevTools confirm `activeParams === T_SHIRT_PARAMS_EMPIRICAL` (AT-6) and that the `.active` class has moved to the empirical wrapper (AT-7).
  6. Click the synthetic radio; confirm the reverse (AT-8).
  7. With CSVs loaded and a Run pressed, click each radio; confirm no chart re-render, no stats re-render, no Data-preview re-paint, no T-shirt-size-reference re-render (AT-9, AT-10, AT-11).
  8. Load CSVs with a mix of calibrated sizes. Press Run under synthetic; note the org-level mean and `P(effort > capacity)`. Toggle to empirical and Run again; confirm the new mean is materially higher (`~1.3×–1.5×`) (AT-12).
  9. Load a CSV containing only `2XS`/`XL`/`XL+` epics. Run under each mode; confirm Stats differ only by Monte Carlo noise (AT-13).
  10. Toggle to empirical, then reload the page; confirm the synthetic radio is checked and `activeParams === T_SHIRT_PARAMS` (AT-14).
  11. Open cold (no CSVs), click empirical, confirm the radio change succeeds without error (AT-15).
  12. Focus the synthetic radio with Tab + click, press Down arrow; confirm the empirical radio becomes checked and the handler fires (AT-16).
  13. Toggle synthetic ↔ empirical fifty times; confirm `.active` class membership and `activeParams` are coherent throughout (AT-17).

Inner tests: N/A.

Verification: manual.

### Behavioral rule

A sidebar field-group between **Iterations** and **Run Simulation** carries a two-option radio group `<input name="param-mode">` with values `synthetic` (the default checked option) and `empirical`. A single `change` listener installed on both radios reassigns the module-scoped `activeParams` to whichever table corresponds to the now-checked option, then toggles the `.active` CSS class on the two wrapper `<label>`s (`#param-label-synthetic`, `#param-label-empirical`) so the UI mirrors the binding. The toggle's effect is bounded to that reassignment and that class swap; it does not call `runSimulation`, does not call `renderPreview`, does not re-render the **T-shirt size reference** panel, and does not write to `localStorage`. The next **Run** the user presses reads `activeParams` once at the start and samples accordingly. On a page reload, the radio resets to `synthetic` by virtue of the HTML's `checked` attribute, and the `let activeParams = T_SHIRT_PARAMS` declaration restores the default binding.

### Invariants

- The HTML radio markup uses `name="param-mode"` so the browser enforces single-selection within the group.
- Exactly one of `#param-label-synthetic` and `#param-label-empirical` carries the `.active` class at any moment after the handler has run at least once.
- The `change` handler reassigns `activeParams` only; it does not call `runSimulation`, `renderPreview`, `tryUpdatePreview`, `renderChart`, `renderStatsTableInto`, or any other render or compute function.
- The handler reads `radio.value === 'empirical'` to choose `T_SHIRT_PARAMS_EMPIRICAL`, falling through to `T_SHIRT_PARAMS` for any other value. Adding a third option in HTML without updating the handler would silently default that option to synthetic.
- The radio's `checked` state and the `.active` class are kept in sync exclusively by the `change` handler — no other code path mutates either.
- The `change` handler is installed *once* per radio at module-load time; it is not re-attached on Run, on tab switch, on CSV load, or on any other event.
- A page reload restores `activeParams === T_SHIRT_PARAMS` deterministically because the HTML's `checked` attribute pins the default selection and the JS declaration `let activeParams = T_SHIRT_PARAMS` runs before the handler can fire.
- The toggle has no `localStorage`, no URL parameter, no cookie, and no session memory — see [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).

### Counterexamples (must NOT pass)

- A handler that calls `runSimulation()` or clicks `#run-btn` on radio change — would burn a full **Run** on every toggle, contradicting the "toggle is value-change only" rule.
- A handler that calls `renderPreview` or `tryUpdatePreview` on radio change — would re-render a panel whose contents are unaffected by the toggle.
- A handler that mutates `T_SHIRT_PARAMS` or `T_SHIRT_PARAMS_EMPIRICAL` instead of reassigning `activeParams` — would corrupt one of the backing tables.
- A handler that swaps `activeParams` without updating the `.active` class — would leave the UI lying about which mode is live.
- A handler that updates the `.active` class without reassigning `activeParams` — the inverse failure; the UI would be honest but the next Run would still sample from the old table.
- A handler that installs itself in a place that fires *after* a Run has started — would create a race window where the table changes mid-Run.
- A handler attached to `click` instead of `change` — would not respond to keyboard interaction (arrow keys / Space) and would fire on click-to-the-already-checked-radio (a no-op the `change` event correctly suppresses).
- A `param-mode` radio group whose default option is `empirical` — contradicts the default-synthetic rule.
- A `param-mode` radio group with three options (e.g. `synthetic` / `empirical` / `custom`) shipped under this feature — would expand scope; the "Custom" mode is a future revision in [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).
- A `localStorage.setItem('paramMode', ...)` call in the handler — contradicts the ephemeral-toggle rule.
- A handler that disables the radio while a Run is in flight — unnecessary (Run is synchronous within one event-loop tick) and adds a state-machine the rest of the simulator does not have.
- A `Reset` button or a confirmation prompt before switching — adds friction without addressing any user-error mode.

### Forbidden shortcuts

- Do not introduce a `setParamMode(mode: 'synthetic' | 'empirical')` API. The radio's `change` event is the documented entry point; lifting it to a function would create a parallel surface the radio's `change` handler still has to call.
- Do not bind the `.active` class via CSS `:has()` or `:checked` selectors on the wrapper labels. JavaScript-driven class management matches the existing **Historical data toggle**'s convention on the **Team Level tab**.
- Do not centralise the radio markup into a reusable component. There is exactly one such radio group in the simulator; abstraction is premature.
- Do not move `activeParams` out of Module 2 — the parameter tables live there and the read sites are co-located.
- Do not enable the radio only when CSVs are loaded. The toggle is a modelling-config knob; it can be set before, between, or after Runs without contradiction.
- Do not persist the toggle via the **Marker CSV** schema or any other CSV roundtrip. Marker CSVs are per-chart-context artefacts; the parameter mode is a global session state.
- Do not stamp the active mode onto the **Run** output (chart title, stats-table header). Listed as a future revision in [ADR-0026](../adr/0026-empirical-lognormal-parameters-mode-toggle.md).

### RED gate

On an unimplemented build:
- Manual step 1: the sidebar has no `Lognormal Parameters` field group.
- Manual step 2: `document.querySelectorAll('input[name="param-mode"]').length === 0`.
- Manual step 5: clicking on either radio either does nothing (no handler) or throws a `ReferenceError` (handler references `activeParams` which is undefined).
- Manual step 8: the empirical run produces the same distribution as the synthetic run (no toggle effect).

### Test immutability rule

There are no test files to freeze (manual harness).

### Definition of done

- [ ] Manual scenarios AT-1 through AT-17 all pass.
- [ ] The sidebar carries the `Lognormal Parameters` field group between Iterations and Run Simulation.
- [ ] The radio group has two options with the documented strings and `synthetic` checked by default.
- [ ] The empirical row's sub-note reads `Bias-corrected from Q1 2026 actuals`.
- [ ] Clicking either radio reassigns `activeParams` and moves the `.active` class.
- [ ] Toggling does not trigger a Run, a preview repaint, or a reference-panel re-render.
- [ ] A page reload resets the toggle to synthetic.
- [ ] `git diff` for this phase touches only `index.html` (plus this plan, the ADR, and CONTEXT.md).
