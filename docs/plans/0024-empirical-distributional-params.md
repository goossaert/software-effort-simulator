# Feature: Empirical (distributional) lognormal parameters mode

Created at: 2026-06-23T08:30:00Z

## Context

This feature adds a **third** `param-mode` option, **Empirical (distributional)**
(radio `value="empirical-distributional"`), to the sidebar **Lognormal Parameters**
group, beside **Synthetic parameters** and **Empirical parameters**. It implements
Option 1c of `docs/reports/report-rcf-improvements.md` (§2 + 2026-06-22 Addendum).

Bounded context / glossary (`CONTEXT.md`, cite — do not re-narrate):
- **Empirical (distributional) parameters** — the new mode; centre = empirical for
  `XS/S/M/L`, `synthetic μ + ln(1.40)` for `2XS/XL/XL+`, plus a bootstrapped mean-1
  residual multiply for spread.
- **Ratio residual pool** — `RATIO_RESIDUALS` (n=23, mean=1), drawn with replacement
  to inject estimation-error spread.
- Builds on **Synthetic parameters**, **Empirical parameters**, **T-shirt size**,
  **Constant work**, **Iteration**, **Run**.

ADRs that constrain this design (look them up; do not duplicate):
- **ADR-0038** (`docs/adr/0038-empirical-distributional-parameters-mode.md`) — the nine
  decisions: third additive mode (1); sampler = `sampleLognormal × bootstrapped residual`
  (2); calibrated centre = empirical (3); uncalibrated centre = `× 1.40` (4); borrow the
  *ratio* not the effort (5); baked artefact, not recomputed (6); **PRNG isolation** (7);
  pool applied to every size (8); reference panel unchanged (9).
- **ADR-0026** — two-table / `activeParams` / μ-shift-only / σ-preserving / carry-through
  (this mode supersedes carry-through **for itself only**; ADR-0026 still governs Empirical).
- **ADR-0035** — Empirical is the page-load default (must stay).
- **ADR-0009** — the seeded `Xoshiro128ss` PRNG (makes the AC-4/I-1 reproducibility test writable).
- **ADR-0007** — synthetic `(μ, σ)` derivation (the distributional base + `ln(1.40)` shift build on it).
- **ADR-0001 / ADR-0002** — single-file HTML, client-side only (no fetch, no recompute at load).
- **ADR-0036** — single-file multi-`<script>` HTML ⇒ mutation testing is **N/A** for this repo.

### Decision constraints carried from the grill handover (formalised here, not re-decided)

- **DC-1 (externally-visible identifier):** radio `value="empirical-distributional"`; label
  visible text contains **"Empirical (distributional)"**; placed **last** in the
  **Lognormal Parameters** group; **Empirical** stays `checked`. Ephemeral (no
  `localStorage`/URL). The value string is a **test contract** (formalised in *Data models*
  and Phase 2 *Public entry point*).
- **DC-2 (reproducibility / RNG isolation):** the residual multiply **and** its RNG draw
  occur **only** in the new mode; the Synthetic/Empirical paths and their `rng` consumption
  are untouched. Mechanism: a module-scoped function-pointer **`activeSampler`** swapped on
  radio change (mirroring `activeParams`). Formalised in Phase 1 *Proposed implementation
  seams* + *Behavioral rule*.
- **DC-3 (baked artefact / numeric representation):** ships two module-load constants —
  `T_SHIRT_PARAMS_DISTRIBUTIONAL` (7 sizes) and `RATIO_RESIDUALS` (23 floats) — declared
  beside the existing tables, **verbatim** from the grill handover. The raw CSV is **not**
  committed; the constants are **not** recomputed at load. Formalised in *Data models* +
  *Authoritative references*.
- **DC-4 (default unchanged):** page-load default stays Empirical (ADR-0035). Formalised in
  Phase 2.

No decision constraint conflicts with the requested behaviour — all are honoured below.

## Authoritative references

This feature does not mirror a *live* external protocol/API. Its only mirrored artefact is
the **frozen calibration output** (the two baked constants), whose canonical source is the
grill handover (the CSV was parsed once at grill and is **not** in the repo, by DC-3). The
"parity" here is an **exact-value assertion** (AC-3) against those frozen values plus an
internal consistency oracle (I-2: `mean(RATIO_RESIDUALS) = 1`).

| Behavior mirrored | Canonical source (pinned) | Verification |
|---|---|---|
| `T_SHIRT_PARAMS_DISTRIBUTIONAL` (7 × `{mu, sigma}`) | `docs/backlog/0024-empirical-distributional-params/handover-01-grill.md` → *Baked constants* block (computed at grill 2026-06-22 from author-provided `JIRA_filtered_q1.csv`) | VERIFIED (values copied verbatim; cross-checked: uncalibrated μ ≈ `T_SHIRT_PARAMS[size].mu + Math.log(1.40)` to 4 dp; calibrated `(μ,σ)` = `T_SHIRT_PARAMS_EMPIRICAL[size]` exactly) |
| `RATIO_RESIDUALS` (23 floats, mean=1) | same grill handover *Baked constants* block | VERIFIED (values copied verbatim; Σ = 23.0000 ⇒ mean = 1.0000 to 4 dp) |
| Design rationale (Option 1c, shrinkage, extremes caveat) | `docs/reports/report-rcf-improvements.md` §2 + 2026-06-22 Addendum | VERIFIED (in repo) |

Rule honoured: the constants ship as **literal baked values** from the VERIFIED grill block;
they are **not** recomputed at load (DC-3 / ADR-0038 decision 6). The implementation MUST use
these exact literals — see *Data models*.

## User-visible behavior

After this feature ships, an operator can select a third **Lognormal Parameters** radio,
**"Empirical (distributional)"**, and press **Run**. The forecast then:
- centres each calibrated size (`XS/S/M/L`) exactly where the **Empirical** mode does, and
  each uncalibrated size (`2XS/XL/XL+`) at **1.40×** its synthetic mean; **and**
- carries the estimation-error **spread** the Empirical mode omits — each sampled **Epic**
  effort is multiplied by a bootstrapped mean-1 **Ratio residual** — for *every* size,
  so intervals widen.

Selecting **Synthetic** or **Empirical** continues to produce results **byte-identical** to
the pre-feature app (same sampled values **and** same PRNG draw sequence). The default on
page-load stays **Empirical**; selecting the new mode is ephemeral (a reload resets to
Empirical) and does not re-render the sidebar **T-shirt size reference** panel.

## Scope

### In scope
- The two baked constants `T_SHIRT_PARAMS_DISTRIBUTIONAL` + `RATIO_RESIDUALS`.
- A function-pointer **`activeSampler`** seam and the residual-multiplying sampler path,
  swapped into the `runScenario` hot loop, gated so the other two modes are untouched.
- The third radio option + its `change`-handler wiring (table swap, sampler swap, `.active`
  toggle), ephemeral, default unchanged.
- The **Constant work** deterministic mean following the new table via `tshirtToPersonMonths`
  (no new code — it already reads `activeParams`).

### Out of scope
- Any change to **Synthetic** or **Empirical** modes (values, μ/σ tables, RNG consumption) —
  they must reproduce past runs bit-for-bit.
- Changing the page-load default (stays Empirical — ADR-0035 / DC-4).
- Re-fitting σ per size; bootstrapping raw actual PM per size (Options 1a/1b — ADR-0038
  rejected alternatives).
- Shipping the raw `JIRA_filtered_q1.csv`; computing the calibration at load (DC-3).
- Re-rendering the sidebar **T-shirt size reference** panel for the new mode (ADR-0038 dec. 9).
- A "Run config" badge / surfacing the active mode in output (ADR-0026 future revision).
- Negative-Binomial fan-out, parameter-uncertainty, backtesting, Option 2/3.

## Relevant existing files

Claude may inspect:
- `index.html` — the single-file app. Confirmed anchors at HEAD `d26e7e8`:
  - `T_SHIRT_PARAMS` (synthetic) — `1303–1311`
  - `T_SHIRT_PARAMS_EMPIRICAL` — `1327–1335`
  - `let activeParams = T_SHIRT_PARAMS_EMPIRICAL` — `1338`
  - `tshirtToPersonMonths` — `1346–1350` (reads `activeParams`; unchanged)
  - `class Xoshiro128ss` / `let rng` — `1231–1280`; `resetBoxMuller` — `1356`
  - `sampleLognormal` — `1381–1385`; `bootstrapChoice` — `1407`
  - `runScenario` hot loop, the `total += sampleLognormal(bootstrapChoice(epicSizingDist))`
    line — **`2544`**
  - `normalizeSize` — `1566`
  - radio markup (`param-mode-options`) — `949–961`
  - **T-shirt size reference** `<details>` panel (static, never re-rendered) — `971–991`
  - param-mode `change` handler — `4649–4655`
- `CONTEXT.md` — glossary (the two new entries already present).
- `docs/adr/0038-…md`, `…0026-…md`, `…0035-…md`, `…0009-…md`, `…0007-…md`.
- `docs/reports/report-rcf-improvements.md` §2 + Addendum.
- `tests/harness.js`; `tests/acceptance/0022-empirical-default-on-load.test.js` +
  `0022-empirical-default-params-property.test.js` — the closest harness pattern (they drive
  `activeParams` + the `param-mode` radio).

Claude should not inspect unless needed: the rest of `tests/`, the CSV-parsing and
charts/rendering modules (unrelated to the sampler/table seam).

## Existing patterns to follow
- Acceptance tests live in: `tests/acceptance/` (vitest + jsdom via `tests/harness.js`'s
  `loadSimulator()` / `read()` / `evalIn()` / `execIn()`).
- Inner tests: co-located in `tests/acceptance/` per the existing layout (e.g.
  `0022-…-property.test.js`); there is no separate `tests/unit/` dir.
- PBT: `@fast-check/vitest` (`import { test, fc } from '@fast-check/vitest'`), `test.prop([...])`.
  Read the **Recognised t-shirt size** set and the constants **from the loaded window**
  (`read(win, 'T_SHIRT_PARAMS_DISTRIBUTIONAL')`), never hand-listed, exactly as the 0022
  property test reads `T_SHIRT_PARAMS_EMPIRICAL`.
- Param-mode pattern: the radio dispatches a bubbling `change` event; the handler reassigns a
  module-scoped reference and toggles label `.active`. (The 0022 tests are the template.)
- Verification command: `npm run verify` (lint + ast-grep forbidden-scan + dep-scan +
  secretlint + `vitest run`).

> **Ubiquitous-language rule (applies below):** entity/field/behavior names match `CONTEXT.md`
> verbatim — **Empirical (distributional) parameters**, **Ratio residual pool**, **T-shirt
> size**, **Epic**, **Iteration**, **Run**, **Constant work**, **Synthetic/Empirical parameters**.

## Data models

No persistence layer (client-side only, ADR-0002; ephemeral toggle, ADR-0026/0035). The data
models here are the two baked module-load constants and the two module-scoped selector
references. These **formalise DC-1/DC-2/DC-3** — they do not re-decide them.

**`T_SHIRT_PARAMS_DISTRIBUTIONAL`** — declared beside `T_SHIRT_PARAMS_EMPIRICAL`, **verbatim**
literal values (DC-3; do **not** recompute at load). Same key set as the other two tables (I-3):

```js
const T_SHIRT_PARAMS_DISTRIBUTIONAL = {
  '2XS': { mu: -1.5079, sigma: 0.3575 }, // no Q1 data; pooled centre 1.40× (synthetic μ + ln 1.40)
  'XS':  { mu: -0.5093, sigma: 0.4286 }, // = empirical (centre 1.39×)
  'S':   { mu:  0.4704, sigma: 0.2703 }, // = empirical (centre 1.51×)
  'M':   { mu:  0.9636, sigma: 0.2703 }, // = empirical (centre 1.24×)
  'L':   { mu:  1.7550, sigma: 0.2703 }, // = empirical (centre 1.36×)
  'XL':  { mu:  2.3310, sigma: 0.1582 }, // no Q1 data; pooled centre 1.40× (synthetic μ + ln 1.40)
  'XL+': { mu:  2.6868, sigma: 0.0372 }, // no Q1 data; pooled centre 1.40× (synthetic μ + ln 1.40)
};
```

**`RATIO_RESIDUALS`** — declared beside it, **verbatim** (23 floats; mean = 1.0000 to 4 dp;
all > 0). Inline comment documents the recipe + per-size `n` (XS 5 / S 11 / M 6 / L 1):

```js
const RATIO_RESIDUALS = [
  0.3692, 0.4286, 0.5714, 0.5714, 0.5714, 0.7353, 0.7353, 0.7385, 0.8571, 0.8571,
  0.8571, 0.8824, 1.0000, 1.1077, 1.1077, 1.1429, 1.1429, 1.1765, 1.2000, 1.4706,
  1.4769, 1.7143, 2.2857,
];
```

**Numeric-representation note (consequence of DC-3):** the uncalibrated μ are **rounded 4-dp
literals**, so the AC-3 relation `μ ≈ T_SHIRT_PARAMS[size].mu + Math.log(1.40)` holds only to
**4 dp** (e.g. `-1.5079` vs the full-precision `-1.50793`) — assert it with `toBeCloseTo(…, 3)`.
The calibrated `(μ, σ)` equal `T_SHIRT_PARAMS_EMPIRICAL[size]` **exactly** (same baked source) —
assert with `toEqual` / `toBe`. The σ of every uncalibrated size equals the synthetic σ exactly.

**Selector references** (module scope, ephemeral, reset on every page-load):
- `activeParams` (`index.html:1338`) — extended to also take `T_SHIRT_PARAMS_DISTRIBUTIONAL`.
- **`activeSampler`** (new) — a function pointer, default `sampleLognormal`; set to the
  residual-multiplying sampler only in the new mode. This is the DC-2 isolation seam.

---

## Phase 1: The distributional parameter set drives effort (engine + baked constants)

### Acceptance behavior

Each scenario is observable from outside via the loaded-window globals and a seeded **Run** —
not by reading the diff. Phase 1 activates the new mode **directly through the module seam**
(`activeParams` / `activeSampler`) — the radio UI arrives in Phase 2.

Scenario AT-1: New-mode per-epic effort = lognormal(distributional) × residual
Given a window loaded and `rng` seeded to a fixed value (Box-Muller reset),
  with `activeParams = T_SHIRT_PARAMS_DISTRIBUTIONAL` and `activeSampler` set to the
  residual sampler,
When one per-epic effort is sampled for a size,
Then it equals `sampleLognormal(size)` (under the distributional table) multiplied by the
  exact `RATIO_RESIDUALS` element `bootstrapChoice` returns for that seed (a directly
  computable value), and is `> 0`.

Scenario AT-2: Baked constants match the frozen calibration (AC-3, AC-6, I-2, I-4)
Given the loaded window,
When `T_SHIRT_PARAMS_DISTRIBUTIONAL` and `RATIO_RESIDUALS` are read,
Then for `XS/S/M/L` the `(μ, σ)` equals `T_SHIRT_PARAMS_EMPIRICAL[size]` exactly; for
  `2XS/XL/XL+` the σ equals the synthetic σ exactly and the μ ≈ `T_SHIRT_PARAMS[size].mu +
  Math.log(1.40)` to 4 dp; the three tables share an identical key set; `mean(RATIO_RESIDUALS)
  = 1` to 4 dp; every residual is `> 0`.

Scenario AT-3: Uncalibrated-size centre uplift + spread injection (AC-5)
Given the new mode active and `rng` seeded, for an uncalibrated size (`2XS`, `XL`, `XL+`),
When a large N of per-epic efforts is sampled,
Then the sample mean ≈ **1.40 ×** the synthetic-mode mean for that size (within an
  N-appropriate tolerance) **and** the sample variance is **strictly greater** than the
  Empirical-mode lognormal-only variance for that size.

Scenario AT-4: Synthetic and Empirical modes are byte-identical to the pre-feature app (AC-4, I-1)
Given `rng` seeded to a fixed value and fixed `runScenario` inputs,
When a scenario is run in **Synthetic** mode and in **Empirical** mode (with
  `activeSampler` left at its default `sampleLognormal`),
Then each result array is byte-identical to the **golden vector captured from the pre-feature
  tree** for the same seed/inputs; and a round-trip (synthetic Run → new-mode Run → synthetic
  Run, each re-seeded) reproduces the synthetic golden exactly (the new mode leaves no residual
  state and consumes no draw in the other two modes).

Scenario AT-5: Constant work follows the distributional table (AC-8)
Given `activeParams = T_SHIRT_PARAMS_DISTRIBUTIONAL`,
When `tshirtToPersonMonths(size)` is called,
Then it returns `exp(μ_distributional + σ²/2)` for that size — i.e. an uncalibrated size's
  constant-work mean is 1.40× its synthetic mean and a calibrated size's matches the Empirical
  mode; the mean-1 residual does **not** change this deterministic value.

### Public entry point

- Library/seam API exercised by tests (no UI in this phase):
  - module globals `T_SHIRT_PARAMS_DISTRIBUTIONAL`, `RATIO_RESIDUALS`, `activeParams`,
    **`activeSampler`** (read via `read(win, …)`);
  - `runScenario(K, lambda, epicSizingDist, iterations)` (the hot loop);
  - `sampleLognormal(sizeLabel)`, `bootstrapChoice(arr)`, `tshirtToPersonMonths(size)`;
  - `rng = new Xoshiro128ss(seed)` + `resetBoxMuller()` to pin determinism.

### Expected observable outcomes
- New-mode `runScenario` / per-epic sample: effort = `sampleLognormal(size) × residual`, `> 0`.
- `tshirtToPersonMonths` under the distributional table: `exp(μ_dist + σ²/2)`.
- Synthetic/Empirical `runScenario`: byte-identical to the captured golden vectors.
- No persisted state; no DOM mutation in this phase.
- Error behavior: an unknown size label still returns `0` from `sampleLognormal` (existing
  behavior, unchanged); the new sampler multiplies `0 × residual = 0` (still non-negative).

### Test harness

> **Test-file naming — REQUIRED.** Every test file begins with `0024-`.

Acceptance tests:
- Location + filename: `tests/acceptance/0024-phase-1-distributional-sampler.test.js`
- Command: `npx vitest run tests/acceptance/0024-phase-1-distributional-sampler.test.js`

Inner / property tests:
- Location + filename: `tests/acceptance/0024-phase-1-distributional-params-property.test.js`
- Command: `npx vitest run tests/acceptance/0024-phase-1-distributional-params-property.test.js`

Verification:
- `npm run verify` (full static stack + `vitest run`), under a hermetic, network-disabled,
  lockfile-pinned checkout.

Parity test:
- The AC-3 assertions in `0024-phase-1-distributional-params-property.test.js` **are** the
  parity check against the frozen calibration (the canonical source per *Authoritative
  references*): exact-value match for the constants, plus `mean(RATIO_RESIDUALS) = 1`. There is
  no live external source to call (DC-3 froze the CSV out of the repo by design).

Fake-injection wiring:
- N/A — no external adapter; determinism is controlled by seeding the in-process `rng`.

Determinism harness (REQUIRED — randomness):
- **Randomness:** production draws only from the module-scoped seedable `rng`
  (`Xoshiro128ss`, ADR-0009). Each test does
  `execIn(win, 'rng = new Xoshiro128ss(<fixed seed>); resetBoxMuller();')` immediately before
  sampling, so draws are reproducible. Tests call `runScenario` / the samplers **directly** —
  never through the run-button handler (`index.html:2611–2612` reseeds from `Date.now()`).
- **Ordering:** `runScenario` already sorts its `Float64Array` numerically — deterministic.
- **Golden capture:** the atdd session captures the AT-4 golden vectors by running the
  **pre-feature** tree (HEAD `d26e7e8`) with the fixed seed/inputs and embedding the resulting
  arrays as constants in the test; since Phase 1 does not change the Synthetic/Empirical paths,
  they reproduce after implementation.
- **Clock / Concurrency:** N/A (no clock in the sampler path; single-threaded).

### Proposed implementation seams

Stable seams the tests may target:
- The two module constants `T_SHIRT_PARAMS_DISTRIBUTIONAL` / `RATIO_RESIDUALS`.
- The module-scoped function pointer **`activeSampler`** (default `sampleLognormal`).
- The `runScenario` hot-loop call site (`index.html:2544`): change
  `sampleLognormal(bootstrapChoice(epicSizingDist))` → `activeSampler(bootstrapChoice(epicSizingDist))`.
  `bootstrapChoice(epicSizingDist)` (the size draw) stays **outside** the swapped call, so all
  three modes draw the size identically; only the residual draw is new and lives inside the
  new-mode sampler.

Do NOT lock in:
- The private name of the residual-multiplying sampler function (a suggestion is
  `sampleLognormalWithResidual`); tests target the **behavior** (effort = lognormal × residual)
  and the **`activeSampler`** seam, not the helper's identifier.
- The exact draw order **inside** the new-mode sampler (residual draw before vs after the
  lognormal draw). It only affects the new mode's own values for a given seed and no past run
  depends on it (reversible) — record the chosen order in the implement handover. The
  recommended order is **lognormal draw first, then the residual draw**.

### Behavioral rule

When the **Empirical (distributional)** parameter set is active, effort is computed from
`T_SHIRT_PARAMS_DISTRIBUTIONAL`: stochastically as `sampleLognormal(size) ×
bootstrapChoice(RATIO_RESIDUALS)` (a mean-1 residual that injects spread) and deterministically
(constant work) as the lognormal mean `exp(μ + σ²/2)`. The residual multiply and its extra RNG
draw occur **only** in this mode; **Synthetic** and **Empirical** keep their exact sampled values
and PRNG draw sequence (DC-2 / ADR-0038 decision 7).

### Invariants
- **`[contract]`** `RATIO_RESIDUALS.length > 0` and every element `> 0` (I-4) — cheap, local,
  always-true; compile as a module-load runtime assertion guarding the new-mode sampler's
  positivity (and the `arr.length ≥ 1` precondition of `bootstrapChoice`/`nextInt`).
- **`[test-only]`** `mean(RATIO_RESIDUALS) = 1` to 4 dp (I-2) — a property of the frozen pool;
  verified by tests, not asserted per call.
- **`[test-only]`** the three parameter tables share an identical key set (I-3 / AC-6) —
  whole-table property, left to tests.
- **`[test-only]`** Synthetic/Empirical byte-for-byte reproducibility (I-1 / AC-4) — a
  whole-Run property no single function can assert locally.

### Properties / invariants to PBT

| Universally-quantified property (∀ inputs in domain) | Generator domain — valid ranges **and** adversarial edges |
|---|---|
| **PBT-1 (centre table, AC-3):** ∀ size ∈ `Object.keys(T_SHIRT_PARAMS_DISTRIBUTIONAL)`, the entry follows the rule — calibrated (`XS/S/M/L`): `(μ,σ)` `toEqual` `T_SHIRT_PARAMS_EMPIRICAL[size]`; uncalibrated (`2XS/XL/XL+`): σ `toBe` synthetic σ and μ `toBeCloseTo(synthetic μ + Math.log(1.40), 3)`. | `fc.constantFrom(...Object.keys(read(win,'T_SHIRT_PARAMS_DISTRIBUTIONAL')))` (all 7); adversarial edges = the calibrated/uncalibrated boundary (both classes covered). |
| **PBT-2 (sampler relation, AC-2):** ∀ size and ∀ seed, the new-mode per-epic effort equals `sampleLognormal(size)` × the exact residual `bootstrapChoice(RATIO_RESIDUALS)` returns, recomputed under the same seed — and is `> 0`. | `fc.tuple(fc.integer({min:1,max:2**31-1}) /*seed*/, fc.constantFrom(...sizes))`; adversarial: smallest seed, `XL+` (σ≈0.037, near-deterministic lognormal so the residual dominates). |
| **PBT-3 (centre uplift + spread, AC-5):** ∀ uncalibrated size, over a large fixed N with a fixed seed, sample-mean ≈ 1.40× the synthetic-mode mean (tolerance band for N) **and** sample-variance `>` the Empirical-mode lognormal-only variance for that size. | `fc.constantFrom('2XS','XL','XL+')`; adversarial edge = `XL+` (tightest synthetic band, where injected spread is most visible). N fixed (e.g. 20000) with a fixed seed so the property is deterministic. |

(I-1/AC-4 reproducibility and I-2/I-3/AC-6 are example/whole-Run assertions in the acceptance
file, not parametric PBT rows.)

### Oracle strategy

**Oracle class:** (a)

Cheap oracle throughout: the baked constants are a hand-verifiable frozen table (AC-3 exact
values); with a pinned seed each per-epic effort is **exactly computable** as `lognormal-draw ×
residual-draw` (AT-1/PBT-2); the Synthetic/Empirical golden vectors are captured directly from
the pre-feature tree (AC-4). The statistical AC-5/PBT-3 is anchored to the **known synthetic
mean** (a 1.40× ratio relation) with an N-appropriate tolerance — still a direct oracle, not
oracle-free. No metamorphic/differential construction required; `oracle_free` stays N/A.

### Counterexamples (must NOT pass)
- A new-mode sampler that ignores `RATIO_RESIDUALS` (returns the plain lognormal) — fails AT-1/
  PBT-2 and the AC-5 variance check.
- Drawing the residual in the **shared** path so Synthetic/Empirical also consume it — fails AT-4
  (their golden/PRNG sequence shifts).
- Hard-coding `T_SHIRT_PARAMS_DISTRIBUTIONAL` values that don't match the frozen block, or
  recomputing them from the CSV at load — fails AT-2 / violates DC-3.
- Reading the wall clock or an unseeded RNG in the sampler path (would break stable RED/green).
- Any production import from `tests/`, `__mocks__/`, `fixtures/`, `fakes/`.

### Forbidden shortcuts
- Do not draw the residual (or otherwise alter draws) in the Synthetic/Empirical code paths —
  the residual multiply lives **only** in the new-mode `activeSampler` (DC-2).
- Do not recompute the constants at load or read any CSV; bake the literal values (DC-3).
- Do not special-case a size with `if (size === …)` to fake the centre/spread; the table +
  pooled residual must drive all sizes uniformly.
- Do not read the wall clock or an unseeded RNG inside the sampler; randomness is the injected
  seedable `rng` seam.
- No env-keyed branches in the sampler. (No fake-adapter wiring exists or is sanctioned here.)

### RED gate
Before implementation:
- The acceptance command fails because `T_SHIRT_PARAMS_DISTRIBUTIONAL`, `RATIO_RESIDUALS`, and
  `activeSampler` are **not defined** in the page realm (`read` returns `undefined` /
  `typeOf` is `'undefined'`), so AT-1/AT-2/AT-3/AT-5 throw or assert against `undefined`; AT-4's
  round-trip half references the new mode and therefore also fails on the base.
- The property command fails because the constants it reads from the window are `undefined`, so
  the generators/assertions error.
- The failures must be **stable** across `test_immutability.flakiness_reruns` (5) — deterministic
  because every sampling assertion pins the seed and resets Box-Muller (no flakiness source).

### Test immutability rule
After the test commit, the implementation session may NOT edit `tests/**`, `features/**`,
`e2e/**`, `acceptance/**` unless a separate test-fix phase approves it.

### Definition of done
- [ ] Acceptance tests (`0024-phase-1-distributional-sampler.test.js`) pass.
- [ ] Property/inner tests (`0024-phase-1-distributional-params-property.test.js`) pass on every
  rerun and in randomized order (stable green).
- [ ] **Mutation score: N/A — `mutation.enabled: false`; mutation layer recorded N/A for this
  repo (StrykerJS cannot scope to one inline `<script>` in a multi-`<script>` single-file HTML —
  ADR-0036).** Adequacy is carried by the per-size PBT + the byte-identical golden (AC-4) + the
  ast-grep forbidden-pattern negative control.
- [ ] `npm run verify` passes under a hermetic, network-disabled, lockfile-pinned checkout, with
  no `correctness_gate` layer disabled/downgraded:
  - [ ] Type check — **N/A** (vanilla JS; no TypeScript — toolchain `typecheck: n/a`).
  - [ ] Lint at error level (`eslint index.html --max-warnings 0`) passes.
  - [ ] SAST (`eslint-plugin-security`) passes with no new high-severity findings.
  - [ ] Sanitizer — **N/A** (managed/interpreted language).
  - [ ] Dependency scan (`npm run scan:deps`) passes (no new high/critical advisory).
  - [ ] Secret scan (`npx secretlint`) passes.
  - [ ] Forbidden-pattern scan (`ast-grep`) passes (no prod import from tests/fixtures; no
    env-keyed/identity special-casing).
- [ ] Clean CI/container verification passes; command, exit code, and log recorded as artifacts.

---

## Phase 2: Selecting the third radio swaps the mode end-to-end (UI + change handler)

### Acceptance behavior

Scenario AT-1: The third radio option is present, labelled, and placed last (AC-1, DC-1)
Given a fresh page-load,
When the **Lognormal Parameters** group is inspected,
Then it contains a third `<input name="param-mode" value="empirical-distributional">` whose
  visible label contains **"Empirical (distributional)"**, placed **after** Synthetic and
  Empirical; **Empirical** remains the `checked` default (Synthetic and the new option
  unchecked).

Scenario AT-2: Selecting the new radio swaps table + sampler + highlight (AC-1, DC-2)
Given a loaded window,
When the `empirical-distributional` radio is `checked` and dispatched a bubbling `change`,
Then `activeParams === T_SHIRT_PARAMS_DISTRIBUTIONAL`, `activeSampler` is the residual sampler
  (a new-mode Run now multiplies by a residual), and **exactly one** label carries `.active` —
  the new option's (`param-label-empirical-distributional`) — with the other two cleared.
  Re-selecting Empirical restores `activeParams === T_SHIRT_PARAMS_EMPIRICAL`, `activeSampler ===
  sampleLognormal`, and moves `.active` back (regression on the existing two).

Scenario AT-3: Ephemeral + reference panel untouched (AC-7, DC-4, ADR-0038 dec. 9)
Given a window where the new mode was just selected,
When a brand-new page-load is created and `localStorage` is inspected,
Then the new load defaults to **Empirical** (`empirical` checked, `activeParams ===
  T_SHIRT_PARAMS_EMPIRICAL`); `localStorage` stays empty (no `param-mode` key written by any of
  the three selections); and the sidebar **T-shirt size reference** `<details>` panel's rows are
  unchanged after selecting the new mode (it is not re-rendered).

### Public entry point
- UI: the user clicks the **"Empirical (distributional)"** radio in the sidebar **Lognormal
  Parameters** group (`index.html:949–961`), firing the `change` handler (`index.html:4649–4655`).

### Expected observable outcomes
- DOM: a third radio/label present and placed last; `.active` is single-valued and follows the
  selection across all three options; default-checked stays Empirical.
- Module state: `activeParams` and `activeSampler` follow the selected mode.
- No persisted state (`localStorage` empty); reload resets to Empirical.
- The static **T-shirt size reference** panel DOM is byte-unchanged after selection.
- Error behavior: N/A (a radio group always has exactly one selection).

### Test harness

> Test files begin with `0024-`.

Acceptance tests:
- Location + filename: `tests/acceptance/0024-phase-2-radio-wiring.test.js`
- Command: `npx vitest run tests/acceptance/0024-phase-2-radio-wiring.test.js`

Inner / property tests:
- Location + filename: `tests/acceptance/0024-phase-2-mode-toggle-property.test.js`
- Command: `npx vitest run tests/acceptance/0024-phase-2-mode-toggle-property.test.js`

Verification: `npm run verify` (hermetic, as Phase 1).

Parity test: N/A — no external source mirrored in this phase.

Fake-injection wiring: N/A.

Determinism harness:
- **Randomness:** AT-2's "a new-mode Run now multiplies by a residual" sub-assertion seeds `rng`
  (as Phase 1) before any sampling; the DOM assertions are deterministic. **Ordering/Clock/
  Concurrency:** N/A. Radio `change` is dispatched via `new win.Event('change', { bubbles: true })`
  exactly as the 0022 tests do.

### Proposed implementation seams
- Radio markup: add a third `<label id="param-label-empirical-distributional">` containing
  `<input type="radio" name="param-mode" value="empirical-distributional">` **after** the
  Empirical label (`index.html:959`). Empirical keeps `checked`.
- `change` handler (`index.html:4649–4655`): extend to set `activeParams` and `activeSampler`
  from `radio.value` across **three** modes, and toggle `.active` on all three labels (exactly
  one active). It MUST NOT re-render the reference panel or write `localStorage`.

Do NOT lock in: the precise handler control-flow (if/else vs map) — only the observable state
(value→table, value→sampler, single `.active`) is the contract.

### Behavioral rule
The `param-mode` radio is a tri-state selector: selecting `synthetic` / `empirical` /
`empirical-distributional` binds `activeParams` to `T_SHIRT_PARAMS` / `T_SHIRT_PARAMS_EMPIRICAL`
/ `T_SHIRT_PARAMS_DISTRIBUTIONAL` and `activeSampler` to `sampleLognormal` (first two) or the
residual sampler (third), and highlights exactly the selected label. The selection is ephemeral
(no persistence; reload resets to Empirical) and never re-renders the reference panel.

### Invariants
- **`[test-only]`** Exactly one `param-mode` label has `.active` at all times (whole-DOM property).
- **`[test-only]`** No `localStorage`/URL key is written by any selection (whole-system, AC-7).
- **`[test-only]`** The reference-panel DOM is invariant across selection (whole-DOM, ADR-0038 dec. 9).

(No `[contract]` invariant in this phase — the wiring has no cheap local per-call precondition to
assert at runtime. The Phase 1 module-load assertion already guards the sampler's positivity.)

### Properties / invariants to PBT

| Universally-quantified property (∀ inputs in domain) | Generator domain |
|---|---|
| **PBT-4 (tri-state toggle):** ∀ mode ∈ {`synthetic`,`empirical`,`empirical-distributional`}, dispatching `change` on that radio binds `activeParams` to the matching table **and** `activeSampler` to the matching function **and** leaves exactly one label `.active` (the matching one). | `fc.constantFrom('synthetic','empirical','empirical-distributional')`; adversarial: re-selecting the same mode twice (idempotent), and round-tripping back to `empirical` (must restore the default binding + highlight). |

### Oracle strategy

**Oracle class:** (a)

Cheap oracle: the correct output is the directly-assertable DOM/module state (which radio is
checked, which label is `.active`, which table/function the references point to, `localStorage`
length). No external source, no metamorphic construction; `oracle_free` stays N/A.

### Counterexamples (must NOT pass)
- A handler that leaves two labels `.active`, or sets `activeParams` but forgets `activeSampler`
  (so a new-mode Run draws no residual) — fails AT-2/PBT-4.
- Writing a `param-mode` key to `localStorage`, or making the new mode the default-checked option
  — fails AT-3 (violates DC-4/AC-7).
- Re-rendering or mutating the reference panel on selection — fails AT-3 (ADR-0038 dec. 9).
- Placing the new option before Empirical, or changing the Empirical default — violates DC-1/DC-4.

### Forbidden shortcuts
- Do not persist the selection to `localStorage`/URL (ephemeral — ADR-0026/0035).
- Do not change which option is `checked` on load (stays Empirical — DC-4).
- Do not re-render the **T-shirt size reference** panel (ADR-0038 dec. 9).
- No env-keyed/identity special-casing in the handler.

### RED gate
Before implementation:
- The acceptance command fails because the third `<input value="empirical-distributional">`
  does **not exist** on the base (the query returns `null`), and the base handler only maps
  `empirical`↔`synthetic`, so selecting the new value never binds `activeParams` /`activeSampler`
  to the distributional table/sampler and never sets `param-label-empirical-distributional`
  `.active`.
- The property command fails on the `empirical-distributional` case for the same reason.
- AT-3's "localStorage stays empty" and "reference panel unchanged" sub-assertions are
  already-green regression guards; each file is RED overall via the new-option assertions.
- Failures are **stable** across 5 reruns (deterministic DOM; seeded RNG for the one sampling
  sub-assertion).

### Test immutability rule
After the test commit, the implementation session may NOT edit `tests/**`, `features/**`,
`e2e/**`, `acceptance/**` unless a separate test-fix phase approves it.

### Definition of done
- [ ] Acceptance tests (`0024-phase-2-radio-wiring.test.js`) pass.
- [ ] Property/inner tests (`0024-phase-2-mode-toggle-property.test.js`) pass on every rerun and
  in randomized order (stable green).
- [ ] **Mutation score: N/A — `mutation.enabled: false` (ADR-0036; see Phase 1).** Adequacy via
  the tri-state PBT + the bidirectional toggle regression + the ast-grep negative control.
- [ ] `npm run verify` passes under a hermetic, network-disabled, lockfile-pinned checkout, with
  no `correctness_gate` layer disabled/downgraded:
  - [ ] Type check — N/A (vanilla JS). Lint passes. SAST passes. Sanitizer — N/A. Dep scan
    passes. Secret scan passes. Forbidden-pattern (`ast-grep`) passes.
- [ ] Clean CI/container verification passes; command, exit code, and log recorded as artifacts.
