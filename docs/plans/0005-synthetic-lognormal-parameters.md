# Feature: Synthetic lognormal parameters per t-shirt size (XS–XL+)

Created at: 2026-05-21T00:00:00Z

## Context

This feature establishes the *parameter set* that the Monte Carlo engine ([feature 0003](./0003-monte-carlo-simulation-engine.md)) samples from. Where feature 0003 owns the sampler (`sampleLognormal`) and the engine (`runScenario`), and where feature [0004](./0004-moscow-three-scenario-forecasting.md) orchestrates the three MoSCoW **Scenarios**, this feature owns the *data*: the hand-fit table `T_SHIRT_PARAMS` that maps every **Recognised t-shirt size** to a `(μ, σ)` pair derived from the size's documented P10/P90 band. It also owns two thin consumers of that table — the deterministic mean helper `tshirtToPersonMonths(size)` (used by feature [0015](../../backtracked-features.md#0015)'s constant-work shift) and the sidebar t-shirt size reference panel that exposes the bands to the user.

The original scope is the six sizes `XS`, `S`, `M`, `L`, `XL`, `XL+` — the canonical band set at the time the simulator was first built. The later `2XS` addition is owned by [feature 0016](../../backtracked-features.md#0016), and the **Empirical parameters** alternative parameter set + its radio toggle is owned by [feature 0018](../../backtracked-features.md#0018). This feature is the foundation both extensions build on.

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). The parameter table lives as a literal object in `index.html`; no JSON file, no fetch, no build step.
- [ADR-0002 — Client-side only, no backend](../adr/0002-client-side-only.md). The table is shipped with the page; nothing fetches it.
- [ADR-0006 — Monte Carlo with bootstrapped historical sizes](../adr/0006-monte-carlo-with-bootstrapped-sizes.md). The reason there is a per-size parameter at all: each Epic's effort is keyed by the size drawn from the **Bootstrap pool**.
- [ADR-0007 — Lognormal effort distribution, parameterised per t-shirt size](../adr/0007-lognormal-effort-distribution.md). The architectural decision this feature implements: the family is lognormal, the parameters are per-size, the synthetic fit targets P10/P90.

Glossary terms used below: **Epic**, **T-shirt size**, **Person-month (PM)**, **Synthetic parameters**, **Empirical parameters**, **Recognised t-shirt size**, **Constant work**, **Iteration**, **Run** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user who opens `index.html` and expands the sidebar **T-shirt size reference** panel sees a small table listing every supported size — `XS`, `S`, `M`, `L`, `XL`, `XL+` — and, for each, a `Min PM` and `Max PM` column corresponding to the P10/P90 band that defines the lognormal fit. The footer of the panel explains the convention: `Min ≈ P10, Max ≈ P90 of lognormal distribution`. This is the user-facing surface of the parameter table — there is no slider, no editor, and no way to override the fit from the UI; the bands are deliberately exposed as documentation, not configuration.

When the user presses **Run Simulation**, every sampled **Epic** effort flows from this table through `sampleLognormal(size)` (feature 0003), so the bands above are not decorative — they are the parameter values the simulator is actually sampling against. When the user later loads **Constant work** (feature 0015), the deterministic PM per constant-work epic is computed from this same table via `tshirtToPersonMonths(size)` — the lognormal *mean*, not a midpoint of the band — so the constant-work shift respects the right-skew the bands imply.

There is no user-visible failure mode at this layer: the table is a static literal, populated at page load. An `index.html` shipped with a malformed table would surface as a `console.warn` from `sampleLognormal` (`[sampler] Unknown size label: "…"`) the first time the engine sees a label whose key is absent — not as a thrown error.

## Scope

### In scope
- The `T_SHIRT_PARAMS` object literal (`index.html:1229-1237`) with one entry per **Recognised t-shirt size** in the original six-size set: `XS`, `S`, `M`, `L`, `XL`, `XL+`. Each entry is a `{ mu, sigma }` pair derived from the size's documented P10/P90 band via the formula `μ = (ln min + ln max) / 2`, `σ = (ln max − ln min) / (2 · Φ⁻¹(0.9))`, with `Φ⁻¹(0.9) ≈ 1.28155`.
- The convention that the **band** (`min PM`, `max PM`) is the documented input and `(μ, σ)` is the *derived* output. The band lives in the sidebar reference table and in the trailing comment on each `T_SHIRT_PARAMS` entry; `(μ, σ)` is what the sampler reads.
- The module-scoped `activeParams` binding (`index.html:1264`), initialised to `T_SHIRT_PARAMS`. This is the *indirection* that every consumer reads through — `sampleLognormal`, `tshirtToPersonMonths`, and any future per-size effort consumer must read `activeParams[size]`, not `T_SHIRT_PARAMS[size]` directly. The reassignment of `activeParams` to an alternative set is owned by feature 0018; this feature owns the *contract* that there is exactly one indirection variable.
- The deterministic mean helper `tshirtToPersonMonths(size)` (`index.html:1272-1276`): returns `exp(μ + σ²/2)` for the given size — the true expectation of the lognormal, which is the *right* point estimate for adding known, fixed work and the property feature 0015 depends on.
- The sidebar **T-shirt size reference** panel (`index.html:929-949`): a collapsible `<details>` block listing each size's `Min PM` / `Max PM` band, with the P10/P90 footnote.

### Out of scope
- The lognormal sampler `sampleLognormal` itself. That is feature [0003](./0003-monte-carlo-simulation-engine.md); this feature only provides the parameter table the sampler reads.
- The `2XS` band. That is feature [0016](../../backtracked-features.md#0016), added later. This feature's scope is the original six-size set.
- The **Empirical parameters** alternative table `T_SHIRT_PARAMS_EMPIRICAL` and the radio toggle that swaps `activeParams`. That is feature [0018](../../backtracked-features.md#0018).
- The size-normalisation function `normalizeSize`. That is feature [0002](./0002-content-based-column-detection.md) (column detection + value normalisation); this feature consumes its output as the key into `T_SHIRT_PARAMS`.
- The CSV ingestion that produces size labels in the first place. That is feature [0001](./0001-csv-upload-ui.md).
- The constant-work shift that consumes `tshirtToPersonMonths`. That is feature [0015](../../backtracked-features.md#0015); this feature only owns the helper itself, not the shift logic.
- The Poisson `λ` and the **Bootstrap pool**. Those are feature 0003's data-prep side.
- Any future "per-team t-shirt parameter set" or "per-Key-Result band" — ADR-0007 explicitly defers these.

## Relevant existing files
Claude may inspect:
- `index.html`, specifically:
  - `T_SHIRT_PARAMS` and its preceding documentation block (`index.html:1210-1237`).
  - `activeParams` declaration (`index.html:1264`).
  - `tshirtToPersonMonths` (`index.html:1272-1276`).
  - Sidebar reference table markup (`index.html:929-949`).
  - `sampleLognormal` (`index.html:1307-1311`) — *for context only*; this feature does not own the sampler, but the parameter-read contract is shared with it.
- `CONTEXT.md` glossary, especially the "Sizing and effort" group (**T-shirt size**, **Person-month (PM)**, **Synthetic parameters**, **Empirical parameters**, **Recognised t-shirt size**).
- ADRs 0006 and 0007 for the constraints this feature must respect.

Claude should not inspect unless needed:
- The Monte Carlo engine internals (`runScenario`, `runSimulation`) — downstream consumers of the table.
- The CSV parsing / column detection blocks — they produce the size labels but do not interpret them.
- The chart, stats-table, and marker code — they have no opinion on parameter values.
- The Team Level / Team Projections sections — they re-use the same parameter table without modification.

## Existing patterns to follow
- **Layering inside `index.html`**: this feature lives entirely in Module 2 (Statistical Samplers) and the sidebar markup. Module 2 declares the parameter table; the sampler in the same module reads from `activeParams`. No other module should read `T_SHIRT_PARAMS` directly.
- **Single indirection variable**: every consumer reads `activeParams[size]`. There is exactly one place that resolves the parameter set — the module-scoped `activeParams` binding — and the contract for swapping it (feature 0018) depends on this. Do not introduce a second lookup path.
- **Band is the input, `(μ, σ)` is the derived output**: when a size's band changes, update the band comment *and* recompute `(μ, σ)` via the documented formula. Do not hand-tune `(μ, σ)` away from the formula without also updating the band and the sidebar reference table — drift here would silently desynchronise the user-visible documentation from what the simulator is actually sampling.
- **Lognormal mean, not band midpoint, for the deterministic helper**: `tshirtToPersonMonths` returns `exp(μ + σ²/2)`. This is intentionally not the midpoint of `[min, max]` — the lognormal mean sits above the median for any `σ > 0`, which is the honest expectation for right-skewed effort and the property feature 0015 relies on.
- **Sidebar reference panel mirrors the table**: the `<table class="size-table">` rows are hand-authored to mirror the band comments in `T_SHIRT_PARAMS`. When sizes change, both update together. The panel exposes the *band*, not `(μ, σ)` — the latter is implementation, the former is the contract the user is opting into.
- **No framework, no library**: vanilla JS literal. No JSON file, no fetch, no stats library to compute `Φ⁻¹(0.9)`. The `1.28155` constant is in the documentation block; the per-size `(μ, σ)` values are pre-computed and inlined.
- **No tooltips, no editor, no validation UI**: the table is read-only documentation. There is no "edit band" surface — see ADR-0007 on why per-size parameters are intentionally a maintenance artefact, not a user knob.
- **Verification command**: there is no automated test harness in this project. Verification is manual: open `index.html` in a browser (`open index.html` on macOS), inspect the sidebar reference panel, load known-good CSVs, press Run, and confirm the engine's empirical means match the lognormal means derived from this table.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer — this is a client-side-only app (ADR-0002). In-memory state owned by this feature:

```js
// The synthetic per-size lognormal parameter set.
// Keys are Recognised t-shirt size labels (uppercase, normalised).
// Values are { mu, sigma } pairs derived from the size's P10/P90 band via
//   μ = (ln min + ln max) / 2
//   σ = (ln max − ln min) / (2 · Φ⁻¹(0.9)),  Φ⁻¹(0.9) ≈ 1.28155
const T_SHIRT_PARAMS = {
  'XS':  { mu: -0.8370, sigma: 0.4286 }, // range [0.25, 0.75] PM
  'S':   { mu:  0.0589, sigma: 0.2703 }, // range [0.75, 1.5]  PM
  'M':   { mu:  0.7521, sigma: 0.2703 }, // range [1.5,  3]    PM
  'L':   { mu:  1.4452, sigma: 0.2703 }, // range [3,    6]    PM
  'XL':  { mu:  1.9945, sigma: 0.1582 }, // range [6,    9]    PM
  'XL+': { mu:  2.3503, sigma: 0.0372 }, // range [10,  11]    PM
};

// The active parameter set — read by every consumer. Initialised to the
// synthetic set; feature 0018 reassigns this binding when the user toggles
// the Empirical parameters radio.
let activeParams = T_SHIRT_PARAMS;
```

Function contracts:
- `tshirtToPersonMonths(size: string) → number`. Returns `exp(μ + σ²/2)` for `activeParams[normalizeSize(size)]`, or `0` if the normalised size is not a key of `activeParams`. Never throws.

The `T_SHIRT_PARAMS` literal is *frozen by convention* (not by `Object.freeze`): no code path mutates it after declaration. The `activeParams` *binding* is reassignable by feature 0018; the *contents* of either parameter set are not.

---

## Phase 1: The synthetic parameter table `T_SHIRT_PARAMS` and the `activeParams` indirection

### Acceptance behavior

Scenario AT-1: The table contains exactly the six original sizes
Given the page has loaded
When `Object.keys(T_SHIRT_PARAMS).sort()` is evaluated in the DevTools console
Then it equals `['L', 'M', 'S', 'XL', 'XL+', 'XS']`
(The `2XS` size is not in scope for this feature — see feature 0016.)

Scenario AT-2: Each entry has the documented `(μ, σ)` shape
Given the page has loaded
When each value in `T_SHIRT_PARAMS` is inspected
Then it is an object with exactly the two numeric keys `mu` and `sigma`
And `sigma > 0` for every entry
And `mu` and `sigma` are finite numbers

Scenario AT-3: `(μ, σ)` is derived from the band by the P10/P90 fit formula
Given the band `[min, max]` for some **Recognised t-shirt size** in the original six-size set (e.g. `'M' → [1.5, 3]`)
When `μ_expected = (ln(min) + ln(max)) / 2` and `σ_expected = (ln(max) − ln(min)) / (2 × 1.28155)` are computed
Then `Math.abs(T_SHIRT_PARAMS['M'].mu − μ_expected) < 1e-4`
And `Math.abs(T_SHIRT_PARAMS['M'].sigma − σ_expected) < 1e-4`
And the same equality holds for every other size in the original six-size set

Scenario AT-4: `activeParams` is initialised to `T_SHIRT_PARAMS`
Given the page has just loaded (no UI toggle has been operated)
When `activeParams === T_SHIRT_PARAMS` is evaluated
Then it is `true`
(The **Synthetic parameters** mode is the default — see ADR-0007.)

Scenario AT-5: `activeParams` is the *single* read path for parameter consumers
Given the page has loaded
When `index.html` is grepped for `T_SHIRT_PARAMS[` (with an open bracket, i.e. a literal lookup)
Then the only matches are inside the declaration block and inside the **Empirical parameters** declaration block (feature 0018) — never inside a sampler or a helper
And every sampler / helper that needs a per-size parameter reads `activeParams[size]` instead

Scenario AT-6: The synthetic table is not mutated at runtime
Given the page has loaded
When the user runs any number of simulations, edits initiatives, toggles tabs, loads constant work, opens / closes the t-shirt reference panel
Then `T_SHIRT_PARAMS` is byte-identical to its declaration (verifiable by `JSON.stringify(T_SHIRT_PARAMS)` returning the same string across the lifetime of the page)

### Public entry point

In-code: `T_SHIRT_PARAMS` (a module-scoped `const`, `index.html:1229`) and `activeParams` (a module-scoped `let`, `index.html:1264`). Both are global in the single-file app — no module boundary.

UI: none. The table itself is not user-editable; its *bands* are surfaced via the sidebar reference panel (owned by Phase 2 of this feature).

### Expected observable outcomes
- `T_SHIRT_PARAMS` has exactly six keys: `XS`, `S`, `M`, `L`, `XL`, `XL+`.
- Each `(μ, σ)` satisfies the P10/P90 fit formula to within `1e-4` of the documented band.
- `activeParams` points to `T_SHIRT_PARAMS` at page load and remains so until feature 0018 reassigns it.
- No call into Module 2's samplers reads `T_SHIRT_PARAMS` directly — every read goes through `activeParams`.

### Test harness

Acceptance tests:
- Location: **N/A — this project has no automated test suite.** Manual acceptance is performed via the DevTools console after opening `index.html`.
- Manual steps:
  1. Open `index.html` in a browser. In DevTools console:
     ```js
     Object.keys(T_SHIRT_PARAMS).sort()
     ```
     Confirm the result is `['L', 'M', 'S', 'XL', 'XL+', 'XS']`.
  2. From the same console, for each size, confirm the P10/P90 fit:
     ```js
     const bands = { XS:[0.25,0.75], S:[0.75,1.5], M:[1.5,3], L:[3,6], XL:[6,9], 'XL+':[10,11] };
     const Z = 1.28155;
     Object.entries(bands).every(([k,[lo,hi]]) => {
       const mu = (Math.log(lo) + Math.log(hi)) / 2;
       const sg = (Math.log(hi) - Math.log(lo)) / (2 * Z);
       return Math.abs(T_SHIRT_PARAMS[k].mu - mu) < 1e-4
           && Math.abs(T_SHIRT_PARAMS[k].sigma - sg) < 1e-4;
     });
     ```
     Confirm `true`.
  3. Confirm `activeParams === T_SHIRT_PARAMS` immediately after page load.
  4. Grep the file: `grep -n 'T_SHIRT_PARAMS\[' index.html` should return only matches inside the declaration blocks (and *not* inside `sampleLognormal`, `tshirtToPersonMonths`, or any other consumer).

Inner tests:
- Location: **N/A — no test harness.** If a harness is added, this layer is trivially testable: assert table shape, assert the fit formula, assert `activeParams === T_SHIRT_PARAMS` at boot.

Verification:
- Manual: walk the DevTools console steps above after `open index.html`.

Fake-injection wiring:
- N/A. The table is a static literal; there is no injection seam.

### Proposed implementation seams

Stable seams a future test suite may target:
- `T_SHIRT_PARAMS` (the literal) — its set of keys, the shape of each value, and the fit-formula equality.
- `activeParams` (the binding) — must point to `T_SHIRT_PARAMS` at boot.

Do NOT lock in:
- The specific numeric values of `(μ, σ)` for any size — those follow from the bands and the formula. The contract is the *formula relationship*, not the constants.
- The order of keys in the literal — `Object.keys` order is not load-bearing because every consumer indexes by label, not position.

### Behavioral rule

The simulator's **Synthetic parameters** are a hand-fit lognormal `(μ, σ)` per **Recognised t-shirt size**, derived from the size's documented P10/P90 band via the standard inverse-cdf formula. The active parameter set is read by every consumer through a single module-scoped indirection (`activeParams`), so that the **Synthetic ↔ Empirical** toggle (feature 0018) can swap the entire set without touching the consumers.

### Invariants
- `T_SHIRT_PARAMS` has exactly the six keys `XS`, `S`, `M`, `L`, `XL`, `XL+` (this feature's scope; `2XS` is owned by feature 0016).
- For every key `k`, `T_SHIRT_PARAMS[k]` is `{ mu: Number, sigma: Number }`, `Number.isFinite(mu) && Number.isFinite(sigma) && sigma > 0`.
- For every key `k` with band `[min, max]`, `T_SHIRT_PARAMS[k].mu = (ln(min) + ln(max)) / 2 ± 1e-4` and `T_SHIRT_PARAMS[k].sigma = (ln(max) − ln(min)) / (2 × 1.28155) ± 1e-4`.
- `T_SHIRT_PARAMS` is never mutated after declaration.
- `activeParams === T_SHIRT_PARAMS` at page load (default = **Synthetic parameters** mode).
- Every per-size parameter lookup outside the declaration block goes through `activeParams[size]`, never `T_SHIRT_PARAMS[size]`.

### Counterexamples (must NOT pass)
- A `T_SHIRT_PARAMS` entry whose `(μ, σ)` does not satisfy the P10/P90 fit formula for its documented band — would silently desync the sidebar reference panel from the simulator. The user would read "S is P10 0.75 / P90 1.5 PM" but the simulator would sample from a different distribution.
- A consumer that reads `T_SHIRT_PARAMS[size]` directly instead of `activeParams[size]` — breaks the feature 0018 toggle. Visible symptom: switching to **Empirical parameters** has no effect on the consumer's output.
- A `T_SHIRT_PARAMS` literal that includes a `2XS` entry as part of this feature's scope — that addition is feature 0016. (The *current* file does have `2XS` because that later feature has shipped; the *plan for feature 0005* scopes itself to the original six.)
- A `T_SHIRT_PARAMS` literal that includes the **Empirical** μ shifts — that is feature 0018. The two parameter sets are separate literals.
- An `Object.freeze(T_SHIRT_PARAMS)` call that would also freeze `activeParams` indirectly — feature 0018 needs to reassign `activeParams`, not mutate `T_SHIRT_PARAMS`. Freezing the literal is fine; freezing the binding is wrong.
- A `T_SHIRT_PARAMS` declared inside a function scope rather than module scope — would hide it from feature 0018's reassignment site and from the DevTools console-driven verification path.

### Forbidden shortcuts
- Do not load the parameter table from a JSON file, an external URL, or a `<script src="…">`. The single-file constraint ([ADR-0001](../adr/0001-single-file-html-app.md)) and the offline-by-default goal ([ADR-0002](../adr/0002-client-side-only.md)) require the literal to live in `index.html`.
- Do not compute `(μ, σ)` at runtime from the bands. Pre-compute and inline the values; the bands live as comments. Runtime computation would add no benefit and would obscure the audit trail (you cannot eyeball "is `μ_M = 0.7521?`" if the value is the result of a computation).
- Do not introduce a second indirection layer (e.g. `getParams(size)` that returns `activeParams[size]`). One indirection (`activeParams`) is enough; a wrapper function would invite divergence between the wrapper and its callers.
- Do not add a "fallback" parameter set that fires when a size is unknown. `sampleLognormal` handles the unknown-size case with a `console.warn` and `return 0` (feature 0003); silently substituting another size's parameters would mask data quality issues.
- Do not parameterise the table by team or by Key Result "in preparation for" feature 0014 / 0011. ADR-0007 explicitly defers per-team parameters.

### RED gate

On an un-implemented build (e.g. `T_SHIRT_PARAMS` is an empty object `{}` or contains stub `{mu: 0, sigma: 1}` values):
- Manual step 1 (key set): `Object.keys` returns `[]` or the wrong set.
- Manual step 2 (fit formula): the equality check returns `false` for every size.
- The org-level simulation's empirical mean diverges wildly from the expected `K · λ · E[lognormal]` (Phase 2 below makes this concrete via `tshirtToPersonMonths`).

### Test immutability rule

There are no test files to freeze in this project (manual harness). If a test suite is later introduced and Phase 1's acceptance steps are codified, those tests live under `tests/unit/` and are off-limits to the implementation session — only the test-writing session may edit them.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-6 all pass.
- [ ] `T_SHIRT_PARAMS` has exactly the six original keys (within this feature's scope); each `(μ, σ)` satisfies the P10/P90 fit formula to within `1e-4`.
- [ ] `activeParams` is declared once at module scope and initialised to `T_SHIRT_PARAMS`.
- [ ] `grep -n 'T_SHIRT_PARAMS\[' index.html` returns no hits inside any sampler or helper (only inside the declaration blocks).
- [ ] `git diff` touches only `index.html` (ADR-0001).

---

## Phase 2: Deterministic mean helper `tshirtToPersonMonths` and the sidebar reference panel

### Acceptance behavior

Scenario AT-1: `tshirtToPersonMonths` returns the lognormal mean, not the band midpoint
Given `activeParams === T_SHIRT_PARAMS`
When `tshirtToPersonMonths('M')` is called
Then the result equals `Math.exp(T_SHIRT_PARAMS['M'].mu + T_SHIRT_PARAMS['M'].sigma**2 / 2)` exactly (no floating-point tolerance — same expression)
And this value is strictly greater than the band median (≈ `exp(μ_M)` ≈ `2.12`)
And this value is *not* equal to the band midpoint `(1.5 + 3) / 2 = 2.25` (it is `≈ 2.18`)
(The mean of a right-skewed lognormal sits above its median but is not the band midpoint — using the midpoint instead would systematically understate effort. See feature 0015.)

Scenario AT-2: `tshirtToPersonMonths` normalises its input
Given `activeParams === T_SHIRT_PARAMS`
When `tshirtToPersonMonths('m')` (lowercase), `tshirtToPersonMonths(' M ')` (whitespace), or `tshirtToPersonMonths('M')` is called
Then all three return the same value (i.e. `exp(μ_M + σ_M²/2)`)
(Normalisation is delegated to `normalizeSize` — feature 0002 — but the helper invokes it on the way in.)

Scenario AT-3: Unknown sizes return `0` without throwing
Given `activeParams === T_SHIRT_PARAMS`
When `tshirtToPersonMonths('XXL')`, `tshirtToPersonMonths('')`, or `tshirtToPersonMonths(undefined)` is called
Then the return value is `0`
And no exception is thrown
And no `console.warn` is emitted (this helper is silent on unknown sizes — the warning belongs to `sampleLognormal`, feature 0003)

Scenario AT-4: The helper respects the active parameter set
Given `activeParams` is reassigned to `T_SHIRT_PARAMS_EMPIRICAL` (the **Empirical parameters** mode introduced by feature 0018)
When `tshirtToPersonMonths('M')` is called
Then the result equals `Math.exp(T_SHIRT_PARAMS_EMPIRICAL['M'].mu + T_SHIRT_PARAMS_EMPIRICAL['M'].sigma**2 / 2)`
And specifically this value differs from the **Synthetic** value
(Verifies the active-params indirection flows through the helper, mirroring `sampleLognormal`.)

Scenario AT-5: The sidebar reference panel renders one row per in-scope size
Given the page has loaded
When the user clicks the **T-shirt size reference** `<details>` summary in the sidebar
Then the panel expands and shows a table with exactly the six rows `XS`, `S`, `M`, `L`, `XL`, `XL+` (within this feature's scope) plus the column headers `Size`, `Min PM`, `Max PM`
And each row's `Min PM` and `Max PM` cells match the band comment on the corresponding `T_SHIRT_PARAMS` entry
And the footer text reads `Min ≈ P10, Max ≈ P90 of lognormal distribution`

Scenario AT-6: The sidebar reference panel is collapsed by default
Given the page has just loaded
When the user looks at the sidebar
Then the **T-shirt size reference** panel is collapsed (its `<details>` element has no `open` attribute)
And the panel's content is not visible until the user clicks the summary

### Public entry point

In-code: `tshirtToPersonMonths(size)` (`index.html:1272-1276`). Called by feature [0015](../../backtracked-features.md#0015) (constant-work effort computation) and by feature [0012](../../backtracked-features.md#0012) (Team Projections quick-Monte-Carlo path, indirectly via the same helper).

UI: the sidebar `<details>` block at `index.html:929-949`. The user-visible surface is the size reference table and its P10/P90 footnote.

### Expected observable outcomes
- `tshirtToPersonMonths(size)` returns `exp(μ + σ²/2)` for `activeParams[normalizeSize(size)]`, or `0` for unknown sizes.
- The helper is silent on unknown sizes (no `console.warn`); diagnostics for unknown sizes are owned by `sampleLognormal`.
- The helper picks up `activeParams` reassignments instantly — there is no caching, no memoisation.
- The sidebar reference panel renders the in-scope sizes as a static HTML table, collapsed by default, expandable on click. The bands shown match the comments in `T_SHIRT_PARAMS`.

### Test harness

Acceptance tests:
- Location: **N/A — manual.** Same rationale as Phase 1.
- Manual steps:
  1. Open `index.html` in a browser. In DevTools console:
     ```js
     tshirtToPersonMonths('M')
     ```
     Confirm the value matches `Math.exp(T_SHIRT_PARAMS.M.mu + T_SHIRT_PARAMS.M.sigma**2 / 2)` exactly. Note: the result is ≈ `2.18`, *not* the band midpoint `2.25`.
  2. From the same console: `tshirtToPersonMonths('m') === tshirtToPersonMonths('M')` and `tshirtToPersonMonths(' M ') === tshirtToPersonMonths('M')` both return `true`.
  3. From the same console: `tshirtToPersonMonths('XXL')`, `tshirtToPersonMonths('')`, and `tshirtToPersonMonths(undefined)` all return `0` and no exception is thrown.
  4. (Cross-feature with 0018:) toggle the **Empirical parameters** radio in the sidebar. In the console, confirm `tshirtToPersonMonths('M')` now returns a different (larger, for `M`) value matching `Math.exp(T_SHIRT_PARAMS_EMPIRICAL.M.mu + T_SHIRT_PARAMS_EMPIRICAL.M.sigma**2 / 2)`.
  5. Click the **T-shirt size reference** summary in the sidebar. Confirm the panel expands and shows exactly the in-scope size rows with the documented bands; confirm the footer reads `Min ≈ P10, Max ≈ P90 of lognormal distribution`.
  6. Reload the page. Confirm the panel is collapsed again on fresh load (no `open` attribute persisted).
  7. (Cross-feature with 0015:) load a Constant Work CSV with a `M`-sized epic. In the rendered Team Projections matrix, confirm the displayed PM annotation equals `tshirtToPersonMonths('M')` (≈ `2.18`).

Inner tests:
- Location: **N/A — no test harness.** If a harness is added, `tshirtToPersonMonths` is a pure function of `(size, activeParams)` and is trivially testable; the sidebar panel is a static DOM block testable via a snapshot.

Verification:
- Manual: walk the DevTools console steps above after `open index.html`.

Fake-injection wiring:
- N/A. To exercise the helper against a different parameter set, reassign `activeParams = T_SHIRT_PARAMS_EMPIRICAL` (or any custom object) before the call. Restore by reassigning back, or by toggling the radio.

### Proposed implementation seams

Stable seams a future test suite may target:
- `tshirtToPersonMonths(size: string) → number` — pure function of input + `activeParams`. Returns `0` for unknown sizes, `exp(μ + σ²/2)` otherwise.
- The sidebar `<details id="t-shirt-reference">` (or equivalent) — a static DOM block whose rows mirror `T_SHIRT_PARAMS`'s band comments.

Do NOT lock in:
- The implementation detail of whether `normalizeSize` runs inside `tshirtToPersonMonths` or at the call site — currently it runs inside. The contract is "the helper accepts un-normalised size labels"; the *where* of normalisation is mutable.
- The exact text of the panel footer — but if it changes, update the band convention prose in this plan and CONTEXT.md's **Synthetic parameters** entry.
- The `<details>` vs. `<section>` choice for the panel — `<details>` is the current implementation (semantic collapse), but the contract is "collapsed by default, expandable on click".

### Behavioral rule

The deterministic per-size effort `tshirtToPersonMonths(size)` is the *mean* of the lognormal `Lognormal(μ_size, σ_size)` for the active parameter set — `exp(μ + σ²/2)`, the true expectation. This value is what every "I need a single number for this size" call site uses (e.g. constant work). Unknown sizes resolve to `0` silently; the diagnostic warning is owned by `sampleLognormal`, not by this helper. The sidebar **T-shirt size reference** panel exposes the per-size *band* (P10/P90) — not `(μ, σ)`, not the lognormal mean — so the user sees the documented contract they are opting into.

### Invariants
- `tshirtToPersonMonths(size) > 0` for every **Recognised t-shirt size** under the active parameter set.
- `tshirtToPersonMonths(size) === 0` iff `normalizeSize(size)` is not a key of `activeParams`.
- `tshirtToPersonMonths` is a pure function of `(size, activeParams)`: same inputs → same output, no side effects, no `console.*`, no global mutation.
- `tshirtToPersonMonths(size) === Math.exp(activeParams[normalizeSize(size)].mu + activeParams[normalizeSize(size)].sigma ** 2 / 2)` for every recognised size.
- The sidebar panel's rows are in 1-to-1 correspondence with the sizes in `T_SHIRT_PARAMS` (within this feature's scope).
- The sidebar panel is collapsed on fresh page load.

### Counterexamples (must NOT pass)
- A `tshirtToPersonMonths` that returns the band midpoint `(min + max) / 2` — would systematically understate effort for right-skewed sizes, biasing the constant-work shift downward. Visible symptom: a constant-work `M` would add `2.25` PM instead of `2.18` PM; the discrepancy compounds across many constant-work epics.
- A `tshirtToPersonMonths` that returns `exp(μ)` (the *median*, not the mean) — same family of bug, smaller magnitude. The right value is the mean.
- A `tshirtToPersonMonths` that reads `T_SHIRT_PARAMS[size]` directly instead of `activeParams[size]` — breaks feature 0018's toggle. Visible symptom: constant-work PM values do not shift when the user switches to **Empirical parameters**.
- A `tshirtToPersonMonths` that throws on an unknown size — would crash the constant-work code path (feature 0015) whenever the user supplies a typo'd or empty size. The `return 0` contract degrades gracefully and lets the data-quality issue surface elsewhere (the same row's `console.warn` from `sampleLognormal` when the sampler sees the same label).
- A `tshirtToPersonMonths` that logs `console.warn` on unknown sizes — duplicates the diagnostic owned by `sampleLognormal`. The user would see the warning twice per Run per unknown size.
- A sidebar reference panel that shows `(μ, σ)` instead of `(Min PM, Max PM)` — the user-facing contract is the band, not the parameters. Showing `(μ, σ)` would be technically truthful and pragmatically useless (no product or engineering lead reads `μ = 0.7521` as "M".)
- A sidebar reference panel that is `open` by default — clutters the sidebar at first paint and competes with the data-preview block for vertical space.

### Forbidden shortcuts
- Do not cache or memoise `tshirtToPersonMonths` output. The function is called rarely (once per constant-work epic) and the cost of `Math.exp` is negligible; caching would create a stale-cache risk across feature 0018's `activeParams` reassignment.
- Do not introduce a separate `tshirtToPersonMonthsEmpirical(size)` for the empirical path. The active-params indirection is the entire point — one helper, one read path.
- Do not render the sidebar reference panel via JavaScript (loop over `T_SHIRT_PARAMS`). The panel is hand-authored HTML; it doubles as documentation that survives a JS error. This intentionally accepts the maintenance cost of dual-authoring (table + literal) — see the *band is the input* pattern above.
- Do not add unit toggles (PM ↔ hours, PM ↔ FTE-months) to the sidebar panel. **Person-month (PM)** is the canonical unit throughout (CONTEXT.md); a unit toggle here would invite divergence with the chart axes and the stats table.
- Do not add a tooltip on hover that shows `(μ, σ)`. The same reasoning as the counterexample above — the band is the contract, the parameters are implementation detail.

### RED gate

On an un-implemented build (e.g. `tshirtToPersonMonths` is a stub returning `0`, or the sidebar panel is missing):
- Manual step 1 (`tshirtToPersonMonths('M')`): returns `0` instead of ≈ `2.18`.
- Manual step 5 (panel expand): the panel does not exist or shows no rows.
- Manual step 7 (constant-work cross-check): the displayed PM annotation for an `M`-sized constant-work epic is `0`, not `2.18`.

### Test immutability rule

Same as Phase 1: N/A in the current project.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-6 all pass.
- [ ] `tshirtToPersonMonths` reads `activeParams[normalizeSize(size)]` (verified by inspection of `index.html:1272-1276`).
- [ ] `tshirtToPersonMonths` returns `0` for unknown sizes silently — no `console.warn` from this helper.
- [ ] The sidebar `<details>` panel renders all in-scope sizes with their documented bands, collapsed by default, footnoted with `Min ≈ P10, Max ≈ P90 of lognormal distribution`.
- [ ] Toggling the **Empirical parameters** radio (feature 0018) changes `tshirtToPersonMonths('M')`'s return value without any code change in this feature's files.
- [ ] `git diff` touches only `index.html` (ADR-0001).
