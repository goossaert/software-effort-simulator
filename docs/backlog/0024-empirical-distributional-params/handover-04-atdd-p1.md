---
schema: backlog-handover/v1
task_id: "0024"
produced_by_phase: atdd
feature_phase: 1
for_next_phase: implement
outcome: success
reason: ""
produced_at: 2026-06-23T06:11:11Z
produced_commit: 03290c81547701ae4a37e9263c55277da90f3ee3
---
## Summary

atdd for **Phase 1** (engine + baked constants) wrote two committed test files and
confirmed a **stable RED** on the pre-feature base across the configured 5 reruns
(`test_immutability.flakiness_reruns`), both commands exiting non-zero for the stated
reason (the new symbols `T_SHIRT_PARAMS_DISTRIBUTIONAL` / `RATIO_RESIDUALS` /
`activeSampler` / `sampleLognormalWithResidual` are undefined on the base):

- `tests/acceptance/0024-phase-1-distributional-sampler.test.js` — AT-1..AT-5
  (acceptance), 14 tests, **12 failed | 2 passed** every run (the 2 passing are the
  Synthetic/Empirical golden-vector regression guards, which are correctly green on the
  base and stay green after implementation).
- `tests/acceptance/0024-phase-1-distributional-params-property.test.js` — PBT-1/2/3
  (fast-check `test.prop`), 3 tests, **3 failed** every run with stable shrunk
  counterexamples (PBT-1 `["2XS"]`, PBT-2 `[1,"2XS"]`, PBT-3 `["2XS"]`).

**Satisfiability proven (anti-0023 check):** to guarantee the frozen RED set is not
unsatisfiable, I applied a throwaway Phase-1 implementation to `index.html`, ran both
commands plus the full suite (**14/14 + 3/3 green; whole suite 264 passed, 1 pre-existing
skip**), then fully reverted `index.html` (`git checkout`). The commit contains **only**
the two test files, the three RED logs, the index advance, and this handover — **no
production code**.

## Instructions for the next phase (implement p1)

Implement the Phase-1 engine slice in `index.html` so both committed commands go green,
**without editing any file under `tests/**`**. The tests pin these seams (see *Context*
below for the two autonomous decisions and why):

1. **Baked constants** — declare beside `T_SHIRT_PARAMS_EMPIRICAL` (≈`index.html:1335`),
   **verbatim** from the plan's *Data models* (DC-3; do not recompute at load):
   - `T_SHIRT_PARAMS_DISTRIBUTIONAL` (7 sizes; calibrated XS/S/M/L = Empirical `(μ,σ)`
     exactly; uncalibrated 2XS/XL/XL+ = synthetic σ exactly + μ = the 4-dp literal
     ≈ synthetic μ + `Math.log(1.40)`).
   - `RATIO_RESIDUALS` (23 floats, mean = 1.0000 to 4 dp, all > 0).
2. **`let activeSampler = sampleLognormal;`** — a module-scoped function pointer beside
   `let activeParams` (`index.html:1338`); default identity is `sampleLognormal` (DC-2).
3. **`function sampleLognormalWithResidual(sizeLabel)`** — the residual-multiplying
   sampler. **Name is pinned by the tests** (seam decision S1). It MUST compute the
   lognormal draw **first**, then the residual draw (seam decision S2):
   `return sampleLognormal(sizeLabel) * bootstrapChoice(RATIO_RESIDUALS);`
   (an unknown size → `sampleLognormal` returns 0 → `0 × residual = 0`, still ≥ 0).
4. **Hot-loop swap** (`index.html:2544`): change
   `total += sampleLognormal(bootstrapChoice(epicSizingDist));` →
   `total += activeSampler(bootstrapChoice(epicSizingDist));`. The size draw
   `bootstrapChoice(epicSizingDist)` stays **outside** the swapped call so all three modes
   draw the size identically; the residual draw lives only inside the new-mode sampler.
5. **`[contract]` I-4** (plan): add a module-load runtime assertion guarding
   `RATIO_RESIDUALS.length > 0 && every element > 0` (positivity precondition of the new
   sampler / `bootstrapChoice`). `contract.enabled` is false in config so gate (g) does not
   require it, but the plan declares it.
6. Do **not** touch the Synthetic/Empirical paths, the radio markup, or the `change`
   handler — that is Phase 2. `activeSampler` is wired to the UI only in Phase 2; Phase 1
   leaves its default `sampleLognormal`, so Synthetic/Empirical stay byte-identical.

The verify is `npm run verify` (lint + ast-grep forbidden-scan + dep-scan + secretlint +
`vitest run`), run hermetically (network-disabled, lockfile-pinned) — see DoD.

## Files the next phase MUST read

- `docs/plans/0024-empirical-distributional-params.md` — **Phase 1** slice: behavioral
  rule, AT-1..AT-5, invariants, counterexamples, forbidden shortcuts, RED gate, DoD. Primary input.
- `tests/acceptance/0024-phase-1-distributional-sampler.test.js` — the frozen acceptance
  contract (AT-1..AT-5); read its header for the two pinned seam decisions.
- `tests/acceptance/0024-phase-1-distributional-params-property.test.js` — the frozen
  PBT-1/2/3 contract.
- `docs/atdd-logs/0024-empirical-distributional-params-phase-1-acceptance-red.log` and
  `…-inner-red.log` — the exact RED commands (the gate re-runs the `command:` headers) + full output.
- `docs/atdd-logs/0024-empirical-distributional-params-phase-1-flakiness.log` — proves the
  RED is stable across 5 reruns.
- `CONTEXT.md` — glossary: **Empirical (distributional) parameters**, **Ratio residual
  pool**, **Synthetic/Empirical parameters**, **T-shirt size**, **Constant work**.
- `docs/adr/0038-empirical-distributional-parameters-mode.md` — decisions 2 (sampler),
  4 (uncalibrated 1.40× centre), 6 (baked artefact), 7 (PRNG isolation).
- `docs/adr/0009-custom-seeded-prng.md` — the `Xoshiro128ss`/Box-Muller seam.
- `index.html` anchors (HEAD `03290c8`, identical to `d26e7e8` for `index.html`):
  `T_SHIRT_PARAMS` 1303–1311; `T_SHIRT_PARAMS_EMPIRICAL` 1327–1335; `activeParams` 1338;
  `tshirtToPersonMonths` 1346–1350; `sampleLognormal` 1381–1385; `bootstrapChoice` 1407;
  `runScenario` hot-loop line **2544**.

## Context the next phase needs

- **total_phases = 2, current_phase = 1.** Pipeline: atdd → implement → review →
  review-correctness, then advance to p2's atdd.
- **Boot smoke:** `smoke_command` empty in `backlog.config.json` ⇒ logged no-op. Base
  health was confirmed directly: `index.html` loads under the jsdom harness, the existing
  264-test suite is green, and the new symbols are absent on the base (clean RED). **Result:
  passed** (no build/boot step; single-file HTML).
- **Two autonomous atdd seam decisions** (Loop mode — no user; recorded here per the
  contract). Both are reversible and affect only the new mode:
  - **S1 — residual sampler name pinned to `sampleLognormalWithResidual`.** The plan said
    *not to lock* the private name, but Phase 1 has **no UI handler** to populate
    `activeSampler`, so the test must name the function to enter the new mode at the module
    level. I chose the plan's own *suggested* name. implement MUST define a function by this
    exact name; renaming it breaks the frozen tests (which may not be edited).
  - **S2 — draw order pinned to lognormal-first, then residual.** AC-2/PBT-2 require a
    *directly-computable* oracle, which is only well-defined once the order is fixed; I chose
    the plan's recommended order. The tests reconstruct the expected value by re-seeding and
    replaying `sampleLognormal(size)` then `bootstrapChoice(RATIO_RESIDUALS)` in that order,
    so implement MUST draw the lognormal first.
- **Determinism:** every sampling assertion does
  `rng = new Xoshiro128ss(<seed>); resetBoxMuller();` immediately before sampling and calls
  the samplers/`runScenario` **directly** (never via the run button, which reseeds from
  `Date.now()`). Fixed seed 424242 throughout; AT-4 golden inputs `K=5, λ=3, iters=50,
  dist=['XS','S','M','L','XL']`.
- **AT-4 golden vectors** were captured from the **pre-feature tree** (this commit's parent
  state) and embedded as constants; Phase 1 leaves the Synthetic/Empirical paths untouched
  so they reproduce byte-for-byte. The AT-4 round-trip test is the RED driver in that file
  (the two plain golden-reproduction tests are green on the base by design).
- **Generator domain** in the property file is read from the window via
  `Object.keys(T_SHIRT_PARAMS_EMPIRICAL)` (valid on the base, identical key set to the
  distributional table by I-3, which AT-2 asserts) — deliberately not the distributional
  table's keys, so the RED is a crisp per-property assertion failure rather than a
  module-load crash.
- **Mutation N/A** (`mutation.enabled: false`, layer recorded N/A; ADR-0036). **PBT** =
  fast-check; the plan declares PBT-1/2/3 (all parametric) and all three are committed as
  `test.prop`, satisfying the gate's (f) PBT floor. **oracle_free** N/A (oracle class (a)).
- **Test commit SHA derivation** (for review/implement):
  `git log -1 --format=%H -- docs/backlog/0024-empirical-distributional-params/handover-04-atdd-p1.md`.

## Definition of done (for implement p1)

- Both committed Phase-1 commands pass:
  `npx vitest run tests/acceptance/0024-phase-1-distributional-sampler.test.js` (14/14) and
  `npx vitest run tests/acceptance/0024-phase-1-distributional-params-property.test.js`
  (3/3), on every rerun and in randomized order (stable green).
- `npm run verify` passes under a hermetic, network-disabled, lockfile-pinned checkout with
  no `correctness_gate` layer disabled/downgraded (typecheck N/A; lint; SAST; sanitizer N/A;
  dep-scan; secret-scan; ast-grep forbidden-pattern all pass).
- The implement commit stages **no** file under `tests/**` (gate sub-check (a)); the only
  production file changed is `index.html`.
- Mutation: **N/A** (ADR-0036). Adequacy is carried by the per-size PBT, the byte-identical
  golden (AC-4), and the ast-grep forbidden-pattern negative control.
