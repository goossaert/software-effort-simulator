---
schema: backlog-handover/v1
task_id: "0024"
produced_by_phase: plan
feature_phase: null
for_next_phase: atdd
outcome: success
reason: ""
produced_at: 2026-06-23T08:35:00Z
produced_commit: d26e7e894b06dc0014bda3117a90b21530d1c395
---
## Summary

The plan phase wrote `docs/plans/0024-empirical-distributional-params.md` with
**total_phases = 2** (authoritative). The plan formalises — does **not** re-decide —
DC-1..4 and ADR-0038 into the *Data models*, identifiers, entry-point, and reproducibility
sections.

- **Phase 1 — engine:** the two baked constants `T_SHIRT_PARAMS_DISTRIBUTIONAL` (7 sizes) +
  `RATIO_RESIDUALS` (23 floats), declared verbatim from the grill block; a module-scoped
  function-pointer **`activeSampler`** (default `sampleLognormal`); the residual-multiplying
  sampler path; and the one-line `runScenario` hot-loop swap
  (`sampleLognormal(bootstrapChoice(epicSizingDist))` → `activeSampler(bootstrapChoice(epicSizingDist))`).
  Gated so Synthetic/Empirical stay byte-identical (values **and** PRNG draw sequence — DC-2/I-1).
  Also covers AC-8 (constant work follows the table via the unchanged `tshirtToPersonMonths`).
- **Phase 2 — UI:** the third `<input value="empirical-distributional">` radio (placed last,
  Empirical stays default-checked) + the tri-state `change` handler (table swap, `activeSampler`
  swap, single `.active`), ephemeral (no `localStorage`), reference panel untouched.

This handover is the input to **every** atdd cycle (Phase 1 **and** Phase 2): read the plan's
`Phase <current_phase>` slice each time. `current_phase` is now **1**.

**Boot smoke:** `smoke_command` is empty in `backlog.config.json` ⇒ logged no-op. This was a
docs-only `plan` phase on a clean working tree at HEAD `d26e7e8`; `index.html` is present and
loads under the jsdom harness. Result: **passed** (nothing to build/boot; base healthy).

## Instructions for the next phase (atdd p1)

1. Operate on the plan's **Phase 1** slice. Write acceptance tests to
   `tests/acceptance/0024-phase-1-distributional-sampler.test.js` and property tests to
   `tests/acceptance/0024-phase-1-distributional-params-property.test.js` (both filenames begin
   `0024-`). Use vitest + jsdom via `tests/harness.js` (`loadSimulator`/`read`/`evalIn`/`execIn`),
   and `@fast-check/vitest` (`test.prop`) for PBT — exactly as the 0022 tests do.
2. **Determinism:** before any sampling assertion, seed the in-process RNG with
   `execIn(win, 'rng = new Xoshiro128ss(<fixed seed>); resetBoxMuller();')` and call
   `runScenario`/the samplers **directly** — never via the run-button (it reseeds from `Date.now()`).
3. **Golden capture for AC-4/I-1:** capture the Synthetic and Empirical `runScenario` result
   arrays from the **pre-feature tree** (this commit, HEAD `d26e7e8`) for a fixed seed + inputs,
   and embed them as constants in the acceptance test — they must reproduce byte-for-byte after
   implementation (the swap leaves those paths untouched).
4. **Numeric tolerances (from DC-3 baked 4-dp literals):** assert calibrated `(μ,σ)` `toEqual`
   `T_SHIRT_PARAMS_EMPIRICAL[size]` **exactly**; assert uncalibrated σ `toBe` synthetic σ
   exactly and uncalibrated μ `toBeCloseTo(synthetic μ + Math.log(1.40), 3)` (NOT `toBe` — the
   literals are rounded). `mean(RATIO_RESIDUALS)` `toBeCloseTo(1, 4)`.
5. **Read constants/sizes from the loaded window**, never hand-list them (mirror the 0022
   property test reading `T_SHIRT_PARAMS_EMPIRICAL`).
6. Honour the plan's RED-gate reasons: on the base, `T_SHIRT_PARAMS_DISTRIBUTIONAL`,
   `RATIO_RESIDUALS`, and `activeSampler` are undefined → the tests must fail for that reason.
   Confirm a **stable** RED across 5 reruns and persist the `*-red.log` artifacts under
   `docs/atdd-logs/0024-empirical-distributional-params-phase-1-*` with their `command:` headers
   (the gate re-runs them verbatim).
7. PBT floor: Phase 1 declares **PBT-1/PBT-2/PBT-3** (all parametric) — write a `test.prop`
   (`fc.property`/`test.prop`) for each. Phase 2 declares **PBT-4**.
8. Mutation is **N/A** (`mutation.enabled: false`; ADR-0036) — do not author a mutation pass;
   `oracle_free` is N/A (both phases are oracle class **(a)** — no marker needed).

## Files the next phase MUST read

- `docs/plans/0024-empirical-distributional-params.md` — the behavioral rules, acceptance
  scenarios, invariants (tagged), counterexamples, forbidden shortcuts, RED gate, Properties to
  PBT, Oracle strategy, and per-phase Definition of done. **The primary input.**
- `CONTEXT.md` — glossary: **Empirical (distributional) parameters**, **Ratio residual pool**,
  **Synthetic/Empirical parameters**, **T-shirt size**, **Constant work**, **Iteration**, **Run**.
- `docs/adr/0038-empirical-distributional-parameters-mode.md` — the nine decisions (esp. 2
  sampler, 4 uncalibrated 1.40× centre, 6 baked artefact, 7 PRNG isolation).
- `docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md` — two-table / `activeParams` /
  ephemeral / σ-preserving (partly superseded for this mode).
- `docs/adr/0035-default-to-empirical-lognormal-parameters.md` — Empirical default (DC-4, stays).
- `docs/adr/0009-custom-seeded-prng.md` — the `Xoshiro128ss` seam the AC-4/I-1 test seeds.
- `docs/adr/0007-lognormal-effort-distribution.md` — synthetic `(μ,σ)` derivation (the base).
- `docs/backlog/0024-empirical-distributional-params/handover-01-grill.md` — the verbatim baked
  constants + the lint-cleared AC-*/I-*/DC-* the plan formalised.
- `tests/harness.js` + `tests/acceptance/0022-empirical-default-on-load.test.js` +
  `tests/acceptance/0022-empirical-default-params-property.test.js` — the harness + param-mode
  + PBT pattern to mirror.
- `index.html` — confirmed anchors (HEAD `d26e7e8`): `T_SHIRT_PARAMS` 1303–1311;
  `T_SHIRT_PARAMS_EMPIRICAL` 1327–1335; `activeParams` 1338; `tshirtToPersonMonths` 1346–1350;
  `Xoshiro128ss`/`rng` 1231–1280, `resetBoxMuller` 1356; `sampleLognormal` 1381–1385;
  `bootstrapChoice` 1407; `runScenario` hot-loop line **2544**; radio markup 949–961; reference
  `<details>` panel 971–991; param-mode `change` handler 4649–4655.

## Context the next phase needs

- **total_phases = 2**, `current_phase = 1`. The pipeline per feature-phase is
  atdd → implement → review → review-correctness, then advance to p2's atdd.
- **All decisions are settled** (DC-1..4 + ADR-0038); the plan formalised them. No gated/one-way
  decision was re-opened or required during planning — **no `blocked`**. The single autonomous,
  reversible choice the plan recorded for implement: the residual draw order **inside** the
  new-mode sampler (recommended: lognormal draw first, then the residual draw) — it affects only
  the new mode's own values for a given seed and no past run depends on it.
- **Highest-risk constraint:** DC-2/I-1 (PRNG isolation). The `activeSampler` function-pointer
  swap keeps the residual draw — and only that draw — inside the new mode; the size draw
  (`bootstrapChoice(epicSizingDist)`) stays outside the swapped call so all three modes draw the
  size identically.
- **Numeric representation:** constants are baked 4-dp literals (DC-3); see the tolerance rules
  above so RED/GREEN is stable.
- **Toolchain:** PBT = fast-check (`pbt.enabled: true`, `import_symbol`
  `fc.property|test.prop|it.prop`); mutation N/A; verify = `npm run verify`.

## Definition of done (for atdd p1)

- `tests/acceptance/0024-phase-1-distributional-sampler.test.js` and
  `tests/acceptance/0024-phase-1-distributional-params-property.test.js` exist, encode the plan's
  Phase 1 acceptance scenarios + PBT-1/2/3, and are **stably RED** on this base for the reasons
  the plan's RED gate states (undefined `T_SHIRT_PARAMS_DISTRIBUTIONAL` / `RATIO_RESIDUALS` /
  `activeSampler`).
- The `*-red.log` artifacts are persisted under `docs/atdd-logs/` with verbatim `command:`
  headers, RED confirmed across `test_immutability.flakiness_reruns` (5).
- `index.md` advanced to `stage: implement` with `handover-04-atdd-p1.md` written for implement.
