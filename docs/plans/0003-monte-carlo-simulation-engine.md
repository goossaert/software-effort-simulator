# Feature: Monte Carlo simulation engine

Created at: 2026-05-21T00:00:00Z

## Context

This feature is the modelling core of the simulator. Given a fitted Poisson λ and a bootstrap pool of t-shirt sizes (the outputs of `prepareSimulationData`, owned by feature [0001 — CSV upload UI](./0001-csv-upload-ui.md) and [0002 — Content-based column detection](./0002-content-based-column-detection.md)), this feature turns a single `(K, λ, pool, iterations)` tuple into the empirical distribution of total effort over `iterations` independent Monte Carlo draws. Everything user-visible downstream — the org-level histogram (feature 0006), the stats table (feature 0007), the MoSCoW three-scenario layout (feature 0004), the Team Level forecast (feature 0011), the constant-work shift (feature 0015) — calls into this layer.

Relevant cross-cutting decisions:
- [ADR-0001 — Single-file HTML app, no build step](../adr/0001-single-file-html-app.md). The samplers and the engine all live as module-scoped functions in `index.html`; no stats library is loaded.
- [ADR-0002 — Client-side only, no backend](../adr/0002-client-side-only.md). All randomness, sampling, and aggregation runs in the browser; nothing leaves the page.
- [ADR-0006 — Monte Carlo simulation with bootstrapped historical sizes](../adr/0006-monte-carlo-with-bootstrapped-sizes.md). The architectural decision that this feature implements.
- [ADR-0007 — Lognormal effort distribution, parameterised per t-shirt size](../adr/0007-lognormal-effort-distribution.md). The per-Epic effort distribution the engine samples from.
- [ADR-0008 — Poisson distribution for epic count per initiative](../adr/0008-poisson-epic-count.md). The per-Initiative count distribution the engine samples.
- [ADR-0009 — Custom seeded PRNG (Xoshiro128**) over Math.random()](../adr/0009-custom-seeded-prng.md). The single randomness source for every sampler.

Glossary terms used below: **Initiative**, **Epic**, **T-shirt size**, **Person-month (PM)**, **Iteration**, **Run**, **Scenario**, **Synthetic parameters**, **Empirical parameters**, **Historical quarter**, **Target quarter**, **Poisson λ**, **Bootstrap pool**, **Recognised t-shirt size** (see [CONTEXT.md](../../CONTEXT.md)).

## User-visible behavior

A user who has loaded both CSVs, picked a historical quarter, picked a target quarter, and pressed **Run Simulation** sees three histograms appear within a second (at the default 10,000 iterations on a typical laptop) and a stats table that reports P10/P25/P50/P75/P90, the mean, and `P(effort > capacity)` for each **Scenario**. Pressing **Run Simulation** again on the same inputs produces *visibly similar but not byte-identical* histograms — because the **Run** is re-seeded from the wall clock each time, and the empirical distribution converges to the true distribution as iterations grow but does not reproduce the same samples.

The simulation has no user-visible failure mode at this layer: there is no "the simulator threw" path. Unknown t-shirt size labels are logged at `console.warn` level and contribute 0 PM to that epic. An empty bootstrap pool combined with a positive λ would produce `undefined` size picks and propagate `NaN` — guarded against by upstream `prepareSimulationData` returning `λ = 0` when no historical epics are in scope, which the engine handles by producing the all-zeros distribution.

## Scope

### In scope
- The 32-bit Xoshiro128** PRNG (`Xoshiro128ss`, `index.html:1157`) and the module-scoped `rng` instance it is constructed into.
- The Marsaglia-polar Box-Muller standard-normal sampler (`sampleStdNormal`, `index.html:1284`) with its single-spare cache (`_bmSpare`) and the `resetBoxMuller()` invariant.
- The lognormal effort sampler `sampleLognormal(sizeLabel)` (`index.html:1307`) reading from the active parameter set.
- The Poisson epic-count sampler `samplePoisson(lambda)` (`index.html:1319`) with the documented Knuth / Gaussian split at λ = 30.
- The bootstrap pick `bootstrapChoice(arr)` (`index.html:1333`).
- The single-scenario engine `runScenario(K, lambda, epicSizingDist, iterations)` (`index.html:2028`) — the function that turns one `(K, λ, pool, n)` tuple into a sorted `Float64Array` of length `n` containing total-effort samples in person-months.
- Re-seeding discipline: every external entry into this layer that runs new iterations re-seeds the global `rng` and resets the Box-Muller spare before any sampling begins.

### Out of scope
- The three-**Scenario** MoSCoW orchestration (Must / Must+Should / Must+Should+Could). That is feature [0004](./../../backtracked-features.md#0004) and lives in `runSimulation` (`index.html:2086`). This feature's contract ends at the single-scenario `runScenario`.
- The constant-work effort shift (`fixedEffort`) applied after sorting. That is feature [0015](./../../backtracked-features.md#0015).
- Histogram binning, percentile lookup, and stats-table assembly. Those are features 0006 / 0007 (`buildHistogram`, `computeStats`).
- Per-team scoping of λ and the bootstrap pool. That is feature [0011](./../../backtracked-features.md#0011).
- The **Synthetic** ↔ **Empirical** parameter-set toggle. That is feature [0018](./../../backtracked-features.md#0018); this feature just reads whatever `activeParams` points to.
- The `prepareSimulationData` data-prep step (lambda fitting, pool collection, MoSCoW counting). That belongs to features 0001/0004; this feature consumes its outputs.

## Relevant existing files
Claude may inspect:
- `index.html`, specifically:
  - Module 1 — PRNG block (`index.html:1149-1207`).
  - Module 2 — Statistical Samplers block (`index.html:1210-1334`): `T_SHIRT_PARAMS`, `T_SHIRT_PARAMS_EMPIRICAL`, `activeParams`, `tshirtToPersonMonths`, Box-Muller, `sampleLognormal`, `samplePoisson`, `bootstrapChoice`.
  - The single-scenario engine `runScenario` (`index.html:2020-2042`).
  - The orchestrator `runSimulation` (`index.html:2086-2141`) — *for context only*; only its re-seed and `resetBoxMuller` calls are in this feature's scope.
- `CONTEXT.md` glossary, especially the "Sizing and effort" and "Planning vocabulary" groups.
- ADRs 0006–0009 for the constraints these samplers must respect.

Claude should not inspect unless needed:
- The CSV parsing / column detection blocks — those are upstream and produce the inputs we read.
- The chart, stats-table, and marker code — those are downstream consumers.
- The Team Level and Team Projections sections — they call `runScenario` but do not change its contract.

## Existing patterns to follow
- **Layering inside `index.html`**: Module 1 owns the PRNG class and the module-scoped `rng` instance; Module 2 owns the four samplers; Module 5 owns `runScenario`. Each layer reads only from the layer above, never the layer below. Do not move sampler code into `runScenario` and do not call `runScenario` from inside a sampler.
- **Single randomness source**: every sampler reads from the module-scoped `rng` (`index.html:1206`). Never call `Math.random()` from anywhere in the modelling code.
- **Active parameter indirection**: `sampleLognormal` and `tshirtToPersonMonths` look up `activeParams[size]`, never `T_SHIRT_PARAMS[size]` directly. This is the contract that lets the **Synthetic ↔ Empirical** toggle swap the parameter set globally without touching this feature's code.
- **Box-Muller spare hygiene**: `_bmSpare` is a module-scoped `NaN` sentinel. Every caller that *resets* the PRNG (i.e. constructs a new `Xoshiro128ss`) must also call `resetBoxMuller()` immediately afterwards. Failing to do so leaks one stale standard normal into the next Run's first lognormal sample.
- **Float64Array for outputs**: `runScenario` returns a sorted `Float64Array`, not a plain array. `Float64Array.sort()` is numeric by default — do not pass a comparator (which would silently degrade to string sort if you forget the `(a,b)=>a-b`).
- **Sorted-output contract**: the array is sorted ascending on return. Downstream binary-search percentile lookup ([feature 0007](./../../backtracked-features.md#0007)) and constant-work shift ([feature 0015](./../../backtracked-features.md#0015)) both rely on this. Do not "optimise" by returning unsorted.
- **No framework, no library**: vanilla JS. No NumPy.js, no D3 randomness, no jStat. The samplers are written in primitive operations on `Math` and the PRNG.
- **Verification command**: there is no automated test harness in this project. Verification is manual: open `index.html` in a browser (`open index.html` on macOS), load known-good CSVs, press Run, and inspect the stats table and chart against expectations.

> **Ubiquitous-language rule — applies to all sections from here down:**
> Every entity, field, and behavior name used in Data models, acceptance
> scenarios (Given/When/Then), Behavioral rules, and Invariants must match
> `CONTEXT.md` glossary terms verbatim. Do not introduce synonyms,
> abbreviations, or implementation-layer names that differ from the glossary.

## Data models

No persistence layer — this is a client-side-only app (ADR-0002). In-memory state populated and read by this feature:

```js
// Module 1 — PRNG (always exactly one instance, re-seeded per Run)
let rng = new Xoshiro128ss();

// Module 2 — Box-Muller spare slot (one cached N(0,1) per call pair)
let _bmSpare = NaN;

// Module 2 — Active lognormal parameter set; toggled by feature 0018,
// read by sampleLognormal and tshirtToPersonMonths in this feature.
let activeParams = T_SHIRT_PARAMS;
```

Function contracts:
- `Xoshiro128ss(seed?: number) → { nextUint32(), nextFloat(), nextInt(n) }`. Period 2¹²⁸ − 1. State is internal and inspectable only via private field (`#s`).
- `sampleStdNormal() → number`. One draw from `N(0, 1)`. Pairs draws via Marsaglia-polar, caching the spare.
- `sampleLognormal(sizeLabel: string) → number`. One draw from `Lognormal(μ, σ)` where `(μ, σ) = activeParams[sizeLabel]`. Returns `0` and logs a warning for unknown labels.
- `samplePoisson(lambda: number) → integer ≥ 0`. Knuth for `λ < 30`, Gaussian approximation for `λ ≥ 30`. Returns `0` for `λ ≤ 0`.
- `bootstrapChoice(arr: T[]) → T`. Uniform random pick with replacement. Caller's responsibility to ensure `arr.length > 0`.
- `runScenario(K: int, lambda: number, epicSizingDist: string[], iterations: int) → Float64Array(iterations)`. Sorted ascending. Total effort per **Iteration**, in person-months.

The `Float64Array` return is the load-bearing shape: percentile lookup, histogram binning, and constant-work shift all assume an indexable, sorted, numeric buffer.

---

## Phase 1: PRNG and statistical samplers

### Acceptance behavior

Scenario AT-1: Xoshiro128** produces deterministic output for a fixed seed
Given a `new Xoshiro128ss(42)` instance `A` and a `new Xoshiro128ss(42)` instance `B`
When 1,000 `nextUint32()` calls are taken from each in sequence
Then the two sequences are byte-identical
(Note: this is the only contract that guarantees we *could* expose seed-reproducible Runs later if we choose.)

Scenario AT-2: Box-Muller spare is consumed on the next call, not skipped
Given a freshly reset state (`resetBoxMuller()` just called)
When `sampleStdNormal()` is invoked twice
Then both calls return numbers
And only the *first* call advances the PRNG through the Marsaglia-polar loop (the second call returns the cached spare and advances the PRNG zero times)

Scenario AT-3: Lognormal sample respects the active parameter set
Given `activeParams === T_SHIRT_PARAMS`
And the PRNG has been re-seeded
When `sampleLognormal('M')` is called 10,000 times into an array
Then the sample mean is within ±5% of `exp(μ + σ²/2)` for `('M')` — i.e. ~2.18 PM
And every sample is strictly positive
And no sample is `NaN` or `Infinity`

Scenario AT-4: Lognormal sample swaps with the parameter set
Given `activeParams` is reassigned to `T_SHIRT_PARAMS_EMPIRICAL` (the **Empirical parameters** mode)
When `sampleLognormal('S')` is called 10,000 times
Then the sample mean follows the **Empirical** μ shift documented in `T_SHIRT_PARAMS_EMPIRICAL` (~1.61 PM, not the synthetic ~1.10)
(Verifies the active-params indirection contract — even though the toggle UI is feature 0018, the *sampler's* read path is in this feature.)

Scenario AT-5: Lognormal sample rejects unknown size labels gracefully
Given `activeParams === T_SHIRT_PARAMS`
When `sampleLognormal('XXL')` is called (a label absent from `activeParams`)
Then the return value is `0`
And exactly one `console.warn` line is emitted of the form `[sampler] Unknown size label: "XXL"`
And no exception is thrown

Scenario AT-6: Poisson sample uses Knuth below λ=30, Gaussian above
Given a re-seeded PRNG
When `samplePoisson(5)` is called 100,000 times into an array
Then the sample mean is within ±1% of 5
And every sample is a non-negative integer
When `samplePoisson(100)` is called 100,000 times into an array
Then the sample mean is within ±1% of 100
And every sample is a non-negative integer

Scenario AT-7: Poisson sample short-circuits non-positive λ
Given any PRNG state
When `samplePoisson(0)` or `samplePoisson(-1)` is called
Then the return value is `0`
And the PRNG state is unchanged (no `nextFloat()` call is made)

Scenario AT-8: Bootstrap pick is uniform with replacement
Given an array `['A', 'B', 'C', 'D']`
When `bootstrapChoice(arr)` is called 100,000 times into a frequency map
Then each of `A, B, C, D` appears with frequency within ±2% of 25,000

### Public entry point

In-code (this layer has no UI surface):
- `new Xoshiro128ss(seed?)` — Module 1.
- `sampleStdNormal()`, `sampleLognormal(sizeLabel)`, `samplePoisson(lambda)`, `bootstrapChoice(arr)`, `resetBoxMuller()` — Module 2.
- `tshirtToPersonMonths(size)` is *not* in this feature's scope (it is the deterministic mean used by feature 0015's constant-work shift) but lives in the same module and shares the `activeParams` read path.

UI: none. The samplers are observable only through their effects on `runScenario`'s output distribution.

### Expected observable outcomes
- `Xoshiro128ss` constructed with the same seed produces identical `nextUint32`/`nextFloat`/`nextInt` sequences.
- `sampleStdNormal()` returns values whose empirical mean → 0 and standard deviation → 1 over large samples.
- `sampleLognormal(s)` for any **Recognised t-shirt size** `s` returns a positive number drawn from `Lognormal(activeParams[s].mu, activeParams[s].sigma)`.
- `samplePoisson(λ)` returns a non-negative integer with empirical mean → λ over large samples.
- `bootstrapChoice(arr)` returns one element of `arr`, never `undefined`, with uniform frequency.
- No call into Module 2 calls `Math.random()` directly.
- Constructing a new `Xoshiro128ss` and *not* calling `resetBoxMuller()` afterwards is a defect (see Counterexamples below); the orchestrator that re-seeds owns that pairing.

### Test harness

Acceptance tests:
- Location: **N/A — this project has no automated test suite.** Manual acceptance is performed via the DevTools console after opening `index.html`. The verification steps below replace the test runner.
- Manual steps:
  1. Open `index.html` in a browser. In DevTools console, type:
     ```js
     const a = new Xoshiro128ss(42), b = new Xoshiro128ss(42);
     Array.from({length: 10}, () => a.nextUint32() === b.nextUint32()).every(Boolean)
     ```
     Confirm `true`.
  2. From the same console: `resetBoxMuller(); rng = new Xoshiro128ss(7);` then
     `const ns = Array.from({length: 10000}, () => sampleStdNormal());`
     and confirm `ns.reduce((a,b)=>a+b)/ns.length` is in `[-0.05, 0.05]` and the sample stddev is in `[0.97, 1.03]`.
  3. From the same console: `activeParams = T_SHIRT_PARAMS;`
     `const ms = Array.from({length: 10000}, () => sampleLognormal('M'));`
     and confirm `ms.reduce((a,b)=>a+b)/ms.length` is within ±5% of `Math.exp(T_SHIRT_PARAMS.M.mu + T_SHIRT_PARAMS.M.sigma**2/2)` (~2.18).
  4. Repeat step 3 with `activeParams = T_SHIRT_PARAMS_EMPIRICAL;` and confirm the empirical mean shifts to the documented value.
  5. From the same console: `sampleLognormal('XXL')` → returns `0` and prints exactly one warning line. (`'XXL'` is intentionally absent from both parameter sets.)
  6. From the same console: `const ps5 = Array.from({length: 100000}, () => samplePoisson(5));`
     and confirm `ps5.reduce((a,b)=>a+b)/ps5.length` is within ±1% of 5; repeat for `λ = 100` and confirm ±1% of 100.
  7. From the same console: `samplePoisson(0)` and `samplePoisson(-1)` both return `0`.
  8. From the same console: feed `['A','B','C','D']` into `bootstrapChoice` 100,000 times into a frequency map; confirm each entry is within ±2% of 25,000.

Inner tests:
- Location: **N/A — no test harness.** The seams listed below are pure and would be trivially fuzzable if a harness were added.

Verification:
- Manual: walk the DevTools console steps above after opening `index.html`. The samplers' module-scoped functions are global (single-file app, no module system — ADR-0001), so they are reachable directly from the console.

Fake-injection wiring:
- N/A. The samplers' only dependency is the module-scoped `rng`; the test seam is "assign a different `rng` instance before calling the sampler."

### Proposed implementation seams

Stable seams a future test suite may target:
- `Xoshiro128ss(seed)` — pure constructor, deterministic output for a fixed seed.
- `sampleStdNormal()` — depends on `rng` and `_bmSpare`. Replace `rng` with a stub `{ nextFloat: () => ... }` to inject known uniforms.
- `sampleLognormal(sizeLabel)` — depends on `activeParams` and `sampleStdNormal`.
- `samplePoisson(lambda)` — depends on `rng.nextFloat` (Knuth path) and `sampleStdNormal` (Gaussian path).
- `bootstrapChoice(arr)` — depends on `rng.nextInt(arr.length)`.
- `resetBoxMuller()` — sets `_bmSpare = NaN`; idempotent.

Do NOT lock in:
- The exact PRNG (Xoshiro128** is the documented choice in [ADR-0009](../adr/0009-custom-seeded-prng.md), but the *contract* is the `nextFloat`/`nextInt` API).
- The Poisson switch threshold (currently `λ = 30`); it is an optimisation knob.
- The Marsaglia-polar implementation of Box-Muller; it could become a Ziggurat or table method without changing the sampler's contract.

### Behavioral rule

The simulator's modelling layer draws every random value from a single seeded PRNG instance. Standard normals, lognormals, Poisson counts, and bootstrap picks are pure transforms of that PRNG's output: same PRNG state in → same sample out. Unknown size labels degrade to `0` PM with a single warning line, never throw.

### Invariants
- Every sampler call in Module 2 reads from the module-scoped `rng` and from no other randomness source.
- `sampleLognormal(s)` returns `0` iff `s` is not a key of `activeParams`; otherwise it returns a strictly positive finite number.
- `samplePoisson(λ)` returns `0` for any `λ ≤ 0`; for `λ > 0` it returns a non-negative integer.
- `bootstrapChoice(arr)` returns `arr[i]` for some `0 ≤ i < arr.length`; never `undefined` as long as `arr.length > 0`.
- After `resetBoxMuller()`, `_bmSpare` is `NaN` and the next `sampleStdNormal()` call advances the PRNG.

### Counterexamples (must NOT pass)
- A `sampleLognormal` that throws on an unknown size — feature [0001](./0001-csv-upload-ui.md)'s loader cannot guarantee every Epic carries a **Recognised t-shirt size**, and a throw would propagate out of `runScenario`'s tight loop.
- A `samplePoisson` that calls `Math.random()` instead of `rng.nextFloat()` — would silently bypass the seeded PRNG and produce non-reproducible Runs even when (in the future) we seed deterministically.
- A `Xoshiro128ss` constructor that allows the all-zero state — the generator's period collapses to 0. The constructor's guard `if (!(s[0] | s[1] | s[2] | s[3])) s[0] = 1` exists exactly to prevent this.
- A Box-Muller that recomputes both normals every call (ignoring the spare slot) — wastes half the PRNG output and inflates per-iteration cost by ~2× in the lognormal path.
- A `bootstrapChoice` that uses `Math.floor(Math.random() * arr.length)` — bypasses `rng`.

### Forbidden shortcuts
- Do not import a stats library (jStat, simple-statistics, math.js, etc.) for any of these samplers. The single-file constraint ([ADR-0001](../adr/0001-single-file-html-app.md)) forbids the additional CDN dependency, and the implementations here are short enough to maintain.
- Do not replace Xoshiro128** with `Math.random()` "for simplicity" — see [ADR-0009](../adr/0009-custom-seeded-prng.md).
- Do not refactor `sampleLognormal` to read `T_SHIRT_PARAMS` directly. It must read `activeParams`, so the Synthetic ↔ Empirical toggle ([feature 0018](./../../backtracked-features.md#0018)) works without touching this code.
- Do not memoise sampler output — the *point* is independence per call.
- Do not assert / throw on `λ ≤ 0` in `samplePoisson`. Upstream `prepareSimulationData` legitimately returns `λ = 0` when no historical epics are in scope; this layer's job is to honour that as the all-zeros distribution.

### RED gate

On an un-implemented build (e.g. the samplers are stubs returning `0` or `Math.random()`):
- Manual step 1 (deterministic Xoshiro): the two instances return different `nextUint32()` sequences (or both throw), so `.every(Boolean)` is `false`.
- Manual step 3 (Lognormal M): the empirical mean is far from 2.18 (e.g. ~0.5 if stubbed to `Math.random()` or `0` if stubbed to `return 0`).
- Manual step 5 (unknown size): an exception is thrown, or `Infinity`/`NaN` is returned, or no warning is logged.
- Manual step 6 (Poisson 5): the empirical mean is far from 5.

### Test immutability rule

There are no test files to freeze in this project (manual harness). If a test suite is later introduced and Phase 1's acceptance steps are codified, those tests live under `tests/unit/` and are off-limits to the implementation session — only the test-writing session may edit them.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-8 all pass via the DevTools console.
- [ ] No occurrence of `Math.random(` anywhere in the modelling code (Modules 1, 2, 5). `grep -n "Math.random" index.html` returns no hits in those line ranges.
- [ ] `sampleLognormal`, `tshirtToPersonMonths`, and any future per-size effort consumer all read `activeParams[…]`, not `T_SHIRT_PARAMS[…]` directly.
- [ ] `git diff` touches only `index.html` (ADR-0001).

---

## Phase 2: Single-scenario engine — `runScenario`

### Acceptance behavior

Scenario AT-1: K=0 produces the all-zeros distribution
Given any λ, any non-empty `epicSizingDist`, and any positive `iterations`
When `runScenario(0, lambda, epicSizingDist, iterations)` is called
Then the returned `Float64Array` has length `iterations`
And every element equals `0`
And the array is sorted (trivially)

Scenario AT-2: λ=0 produces the all-zeros distribution
Given any K, any non-empty `epicSizingDist`, and any positive `iterations`
When `runScenario(K, 0, epicSizingDist, iterations)` is called
Then the returned `Float64Array` has length `iterations`
And every element equals `0`
(Because `samplePoisson(0)` returns 0 for every per-initiative draw, so the inner lognormal loop runs zero times.)

Scenario AT-3: Mean total effort approximates `K · λ · E[lognormal]`
Given `K = 10`, `λ = 5`, `epicSizingDist` consisting of 1,000 `'M'` entries (a degenerate **Bootstrap pool** of one size), `iterations = 10,000`
And the PRNG re-seeded immediately before the call
And `activeParams = T_SHIRT_PARAMS`
When `runScenario(10, 5, dist, 10000)` is called
Then the mean of the returned array is within ±2% of `10 × 5 × exp(μ_M + σ_M²/2)` ≈ `10 × 5 × 2.18` ≈ `109.0` PM

Scenario AT-4: Empirical mean shifts with the active parameter set
Given the inputs from AT-3
And `activeParams = T_SHIRT_PARAMS_EMPIRICAL`
When `runScenario(10, 5, dist, 10000)` is called
Then the mean of the returned array is within ±2% of `10 × 5 × exp(μ_M_empirical + σ_M_empirical²/2)`
And specifically *not* within 5% of the synthetic-parameter mean from AT-3
(Verifies the active-params indirection flows through the engine end-to-end.)

Scenario AT-5: Output is sorted ascending
Given any valid inputs that produce a non-zero distribution
When `runScenario(...)` is called
Then for every adjacent pair `i, i+1` in the returned array, `arr[i] ≤ arr[i+1]`
And the array is a `Float64Array` (not a plain `Array`)

Scenario AT-6: Bootstrap pool is sampled with replacement
Given `K = 1`, `λ = 1000` (large enough that ~1000 epics are sampled per iteration), `epicSizingDist = ['XS', 'XS', 'L']` (a 2/3 vs 1/3 mix), `iterations = 1`
And the PRNG re-seeded
When the inner loop runs (we instrument by patching `sampleLognormal` to count size frequencies for the duration of the call)
Then `'XS'` is picked roughly 2× as often as `'L'`
And `'XS'` is picked many more times than 2 (proving replacement is in effect)

Scenario AT-7: Two successive Runs produce non-identical but similarly-shaped distributions
Given the same `(K, λ, dist, iterations)` inputs to two back-to-back calls
And the global `rng` is re-seeded between them via the orchestrator (`new Xoshiro128ss(...)` + `resetBoxMuller()`)
When both calls complete
Then the two returned arrays are not byte-identical (different seeds in)
And both P50s are within ±5% of each other (large `iterations` makes the empirical distribution stable)
And neither array contains `NaN` or `Infinity`

### Public entry point

In-code: `runScenario(K, lambda, epicSizingDist, iterations)` (`index.html:2028`). Called from `runSimulation` (feature 0004), from `prepareTeamSimulationData`-fed Team Level runs (feature 0011), and from the Team Projections quick-Monte-Carlo path (feature 0012).

UI: none. The user-visible surface of this function is whatever the caller does with the returned distribution — histogramming (feature 0006), percentile lookup (feature 0007), or constant-work shifting (feature 0015).

### Expected observable outcomes
- `runScenario(K, λ, dist, n)` returns a `Float64Array` of length exactly `n`, sorted ascending.
- All values are finite, non-negative person-month totals.
- The empirical mean equals `K · λ · E[lognormal]` (drawing sizes uniformly from `dist`) to within Monte Carlo noise at the given `iterations`.
- The empirical distribution shape (right-skewed, positive support) matches the convolution of `K` independent compound-Poisson-lognormal totals.
- No `Math.random()` calls. No `console.warn` lines unless the bootstrap pool contains a label not in `activeParams` (in which case `sampleLognormal` warns and contributes 0).

### Test harness

Acceptance tests:
- Location: **N/A — manual.** Same rationale as Phase 1.
- Manual steps:
  1. Open `index.html` and load known-good CSVs that produce a stable preview (e.g. ≥ 20 historical initiatives, ≥ 100 epics). Press **Run Simulation**.
  2. Inspect the org-level stats table for the Must-only scenario. Compute by hand: `K · λ · mean(activeParams over the bootstrap pool)` ≈ the table's reported `mean` column. Allow ±5%.
  3. In DevTools console, call `runScenario(0, 1, ['M'], 100)` and confirm the returned `Float64Array` is all zeros.
  4. In DevTools console, call `runScenario(5, 0, ['M'], 100)` and confirm the returned `Float64Array` is all zeros.
  5. In DevTools console, call `const r = runScenario(10, 5, Array(1000).fill('M'), 10000);` and confirm `r.length === 10000`, `r.constructor === Float64Array`, and `r.reduce((a,b)=>a+b)/r.length` is within ±2% of 109.0 (synthetic) or the empirical equivalent (after toggling **Empirical parameters**).
  6. From the same console: `for (let i = 1; i < r.length; i++) if (r[i] < r[i-1]) throw 'not sorted';` — no throw.
  7. Toggle the sidebar's **Empirical parameters** radio (feature 0018) and re-run the simulation; confirm the org-level P50 shifts up by the documented per-size factor, *not* unchanged.

Inner tests:
- Location: **N/A.** If a harness is added, `runScenario` is a pure function of `(K, λ, dist, iterations, activeParams)` plus the PRNG state, and is straightforward to drive.

Verification:
- Manual: `open index.html` and walk the steps above.

Fake-injection wiring:
- N/A. To inject a deterministic PRNG, reassign the module-scoped `rng` before the call: `rng = new Xoshiro128ss(specificSeed); resetBoxMuller();`.

### Proposed implementation seams

Stable seams:
- `runScenario(K, lambda, epicSizingDist, iterations) → Float64Array` — pure function of inputs + PRNG state. The contract is the four arguments and the sorted-`Float64Array` return.

Do NOT lock in:
- The order of the inner loops (over K, then over `numEpics`) — it is the most cache-friendly given the data shape but is an implementation detail.
- The use of `Float64Array.sort()` (which is numeric-by-default in V8/JSC); a future change to `arr.sort((a,b)=>a-b)` is allowed iff the array becomes a plain `Array`, but that would be a regression we should resist.

### Behavioral rule

`runScenario` realises one **Scenario** at a single point in the (K, λ, pool) space: it draws `iterations` independent total-effort samples, where each sample is the sum over `K` **Initiatives** of `Poisson(λ)` **Epic** efforts, each Epic's effort drawn as `Lognormal(activeParams[bootstrap_choice(pool)])`. The output is a sorted `Float64Array` ready for percentile lookup, histogram binning, or a fixed-effort shift by the downstream consumer.

### Invariants
- `runScenario(K, λ, dist, n).length === n` for all valid inputs.
- The return value is a `Float64Array` (not a plain `Array`).
- The return value is sorted ascending.
- Every element is a finite, non-negative number.
- `runScenario(0, λ, dist, n)` is the all-zeros `Float64Array(n)` for any λ, any non-empty `dist`, any `n`.
- `runScenario(K, 0, dist, n)` is the all-zeros `Float64Array(n)` for any K, any non-empty `dist`, any `n`.
- Re-running with the same inputs (and the same PRNG seed) produces the same output — *given* that the orchestrator passes the same seed in. The seed is the orchestrator's responsibility, not `runScenario`'s.
- `runScenario` does not mutate its `epicSizingDist` argument.

### Counterexamples (must NOT pass)
- A `runScenario` that returns an unsorted `Float64Array` — downstream `computeStats` (feature 0007) uses *binary search* over the sorted buffer for the `P(exceed)` calculation; an unsorted input silently produces wrong percentiles and wrong P(exceed) values.
- A `runScenario` that returns a plain `Array` instead of a `Float64Array` — `Array.prototype.sort()` is *lexicographic* by default and would mis-order values like `[10, 2, 100]` to `[10, 100, 2]`. The numeric-by-default `Float64Array.sort()` is load-bearing.
- A `runScenario` that re-seeds the PRNG itself — re-seeding belongs to the *orchestrator* (`runSimulation`, feature 0004) so that three scenarios in the same Run share a coherent randomness stream. Re-seeding inside `runScenario` would couple every scenario to the same initial state and destroy independence.
- A `runScenario` that returns a *new* `Float64Array` longer than `iterations` "to be safe" — downstream binary search uses `n = sorted.length` directly and would compute wrong percentiles.
- An inner-loop refactor that hoists `bootstrapChoice(epicSizingDist)` out of the per-epic loop (drawing once per initiative and reusing) — would collapse every initiative's epics to the same size and destroy the size-mix realism.
- An inner-loop refactor that hoists `samplePoisson(lambda)` out of the per-initiative loop (drawing once per iteration and reusing for all K) — would shrink the per-iteration variance significantly and produce dishonestly narrow forecasts; see [ADR-0008](../adr/0008-poisson-epic-count.md).

### Forbidden shortcuts
- Do not parallelise via Web Workers as part of this feature. The single-file constraint ([ADR-0001](../adr/0001-single-file-html-app.md)) and the empirical wall-clock at 10,000 iterations make this unnecessary. A future "fast mode" might add workers; that would be a separate feature.
- Do not memoise the output of `runScenario` keyed on inputs — every Run is intentionally a fresh draw.
- Do not pre-sort `epicSizingDist` or otherwise mutate it. The pool is the caller's data.
- Do not call `runScenario` from inside Phase 1's samplers. The layering is strict (Module 5 → Module 2 → Module 1).
- Do not switch the inner loop's order to "iterations innermost" — the current `for (iter) { for (K) { for (numEpics) { ... } } }` order is the locality-friendly choice given the `Float64Array` write pattern, and matches how the rest of the engine is organised.

### RED gate

On an un-implemented build (e.g. `runScenario` is a stub returning `new Float64Array(iterations)` zero-filled):
- Manual step 2 (org-level table sanity check): the `mean` column reads exactly `0` for every scenario, against expectations.
- Manual step 5 (10×5×1000×M smoke test): `r.reduce((a,b)=>a+b)` is `0`, not ~1.09 million.
- Manual step 7 (Empirical toggle): no shift in P50 because the engine returns zeros either way.

### Test immutability rule

Same as Phase 1: N/A in the current project.

### Definition of done
- [ ] Manual scenarios AT-1 through AT-7 all pass.
- [ ] `runScenario` is the *only* callable that runs Monte Carlo iterations; no caller inlines the per-iteration loop.
- [ ] The K=0 and λ=0 short-circuits work as documented (verified via DevTools).
- [ ] Output sortedness is checked in at least one manual run (the `for` loop in manual step 6).
- [ ] The **Synthetic ↔ Empirical** toggle (feature 0018) flows through this engine without code changes in this layer.
- [ ] `git diff` touches only `index.html` (ADR-0001).
