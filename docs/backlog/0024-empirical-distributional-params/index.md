---
schema: backlog-index/v1
id: "0024"
slug: empirical-distributional-params
title: Empirical (distributional) lognormal parameters mode
stage: review-correctness
status: ready
priority: normal
flagged_for_human: false
total_phases: 2
current_phase: 2
retry_count: 0
max_retries: 3
next_handover: handover-11-review-p2.md
updated_at: 2026-06-23T09:40:00Z
created_at: 2026-06-22T18:55:38Z
blocked_reason: ""
artifacts:
  plan: docs/plans/0024-empirical-distributional-params.md
  reviews:
    - docs/reviews/0024-empirical-distributional-params-phase-1-review-01.md
    - docs/reviews/0024-empirical-distributional-params-phase-1-correctness-01.md
    - docs/reviews/0024-empirical-distributional-params-phase-2-review-01.md
---
# 0024 — Empirical (distributional) lognormal parameters mode

Add a **third** option to the sidebar **Lognormal Parameters** radio — "Empirical
(distributional)" (value `empirical-distributional`) — beside the existing
**Synthetic** and **Empirical** modes. It implements Option 1c from
`docs/reports/report-rcf-improvements.md` (§2 Addendum, 2026-06-22): keep the
empirical per-size **centre** for the calibrated sizes (XS/S/M/L), apply a pooled
grand-mean centre (≈1.40×) to the three sizes that had no Q1 data (2XS/XL/XL+), and
multiply every sampled epic effort by a **bootstrapped mean-1 ratio residual** so the
mode injects the estimation-error **spread** the σ-preserving empirical mode omits —
including for the uncalibrated sizes (their spread is borrowed across sizes).

The calibration ships as two baked constants (`T_SHIRT_PARAMS_DISTRIBUTIONAL` +
`RATIO_RESIDUALS`, n=23) computed once from the Q1 2026 Done epics. The existing
**Synthetic** and **Empirical** modes must stay **bit-for-bit unchanged** (sampled
values *and* PRNG draw sequence) so past re-simulations reproduce exactly; the new
mode's extra residual RNG draw happens only when it is selected. Default stays
Empirical (ADR-0035). See ADR-0038, which supersedes in
part ADR-0026's "carry synthetic through for uncalibrated sizes" decision (for the new
mode only).

**Status (plan done, 2026-06-23):** `docs/plans/0024-empirical-distributional-params.md`
written with **total_phases = 2** — Phase 1: the two baked constants
(`T_SHIRT_PARAMS_DISTRIBUTIONAL` + `RATIO_RESIDUALS`) + the `activeSampler` function-pointer
seam + the residual-multiplying sampler path in the `runScenario` hot loop, gated so the
Synthetic/Empirical modes stay byte-identical (values **and** PRNG draw sequence); Phase 2:
the third `empirical-distributional` radio + the tri-state `change` handler (table swap,
sampler swap, single `.active`), ephemeral, default still Empirical, reference panel
untouched. DC-1..4 / ADR-0038 formalised (not re-decided); mutation **N/A** (ADR-0036);
PBT via fast-check.

**Status (atdd p1 done, 2026-06-23):** wrote `tests/acceptance/0024-phase-1-distributional-sampler.test.js`
(AT-1..AT-5) and `tests/acceptance/0024-phase-1-distributional-params-property.test.js` (PBT-1/2/3,
fast-check). **Stable RED** confirmed on the base across 5 reruns (acceptance 12 failed | 2 passed,
property 3 failed; both exit 1) — the new symbols `T_SHIRT_PARAMS_DISTRIBUTIONAL` / `RATIO_RESIDUALS` /
`activeSampler` / `sampleLognormalWithResidual` are undefined on the base. RED logs persisted under
`docs/atdd-logs/0024-empirical-distributional-params-phase-1-*`. Satisfiability verified via a throwaway
implementation (14/14 + 3/3 green, full suite green) then reverted — the commit carries no production code.
Two autonomous seam decisions recorded in handover-04: S1 (residual sampler named
`sampleLognormalWithResidual`) and S2 (lognormal-draw-first-then-residual order). Advanced to
`stage: implement`, `current_phase: 1` — next phase is `implement` p1.

**Status (gate p1 rejected, 2026-06-23):** the post-stage gate rewound the first implement
commit (`b9c4c7d4`) — not for any code defect (its hermetic `npm run verify` passed, 264 green)
but because the gate's standalone `analysis` sub-check ran `npm run lint` on a fresh worktree
with no `node_modules` and exited 127 (`sh: eslint: command not found`). The standalone `lint`
script lacked the `npm ci` self-bootstrap guard that `verify` already had.

**Status (implement p1 done, 2026-06-23):** re-applied the Phase-1 engine slice to `index.html`
(the two baked constants, the `[contract]` I-4 module-load assertion, the `activeSampler`
function-pointer seam, `sampleLognormalWithResidual`, and the `runScenario` hot-loop swap) **and**
fixed the gate's 127 by making the `lint` npm script self-bootstrap `npm ci` like `verify`
(production-only; eslint still runs `--max-warnings 0` — the layer is not weakened). Inner tests
stable-green (acceptance 14/14, property 3/3 across 3 default reruns + 1 randomized-order run each);
`npm run verify` exits 0 (264 passed, 1 pre-existing skip) under a hermetic fresh-checkout, where the
standalone `npm run lint` (the gate's `analysis` command) now exits 0 instead of 127. No `tests/**`
drift. Advanced to `stage: review`, `current_phase: 1` — next phase is `review` p1.

**Status (review p1 PASS, 2026-06-23):** integrity review clean — diff `e852039..4de0481`.
No test file changed between test/impl commits; no test-gaming pattern, no production import
from tests, no env/identity branch, no blanket suppression. The baked constants match the
frozen calibration exactly (calibrated = Empirical; uncalibrated = synthetic σ + μ shifted by
ln1.40 to 4 dp; mean-1 positive residual pool); DC-2 isolation holds (`activeSampler` default
= `sampleLognormal`, residual drawn only in the new mode, lognormal-first/S2). The
`package.json` `lint` bootstrap is an invocation-reliability fix, not a weakening. Two negative
controls passed: dropping the residual fails AT-1×2 + PBT-2 (revert → 14/14 + 3/3 green), and a
forbidden residual value fires the live I-4 `[contract]` module-load assertion (load aborts).
Mutation N/A (ADR-0036, recorded); PBT-1/2/3 meet the structural floor; no additional tests
needed. Review file: `docs/reviews/0024-empirical-distributional-params-phase-1-review-01.md`.
Advanced to `stage: review-correctness`, `current_phase: 1` — next phase is `review-correctness`
p1 (it owns the advance to Phase 2).

**Status (review-correctness p1 PASS, 2026-06-23):** independent correctness review clean — diff
`e852039..4de0481`, production-only (`index.html` + `package.json`), reasoning from the spec, tests
excluded. A single clean pass produced **zero** candidate findings; the judge pass dropped nothing;
Step 5b (suspect-test) not reached. Confirmed: the sampler computes `sampleLognormal(size) ×
bootstrapChoice(RATIO_RESIDUALS)` with the lognormal draw first then the residual (S2); the size
draw `bootstrapChoice(epicSizingDist)` stays outside the swapped `activeSampler` call so all three
modes draw the size at the identical PRNG position; `activeSampler` defaults to `sampleLognormal`
(byte-identical Synthetic/Empirical, no extra draw — DC-2); the baked constants satisfy AC-3
(calibrated = empirical exactly; uncalibrated σ = synthetic σ and μ = synthetic μ + ln1.40 to 4 dp;
mean(RATIO_RESIDUALS)=1.0000, all >0); `tshirtToPersonMonths` returns `exp(μ+σ²/2)` with no residual
(AC-8); unknown size → `0 × residual = 0`; the I-4 `[contract]` predicate is logically correct. The
`package.json` lint bootstrap is an invocation-reliability fix, out of correctness scope. Review
file: `docs/reviews/0024-empirical-distributional-params-phase-1-correctness-01.md`. **Verdict PASS**
advances the feature-phase — `stage: atdd`, `current_phase: 2`, `retry_count: 0`, `next_handover:
handover-03-plan.md` — next phase is `atdd` p2 (the third radio + tri-state `change` handler).

**Status (atdd p2 done, 2026-06-23):** wrote `tests/acceptance/0024-phase-2-radio-wiring.test.js`
(AT-1..AT-3, 10 tests) and `tests/acceptance/0024-phase-2-mode-toggle-property.test.js` (PBT-4,
fast-check). **Stable RED** confirmed on the current base (HEAD `851045d`, post-Phase-1) across 5
reruns (acceptance 10 failed; property 1 failed, stable shrunk counterexample `["synthetic"]`; both
exit 1) — the third `empirical-distributional` radio + the `param-label-empirical-distributional`
label do not exist and the base `change` handler maps only `empirical`↔`synthetic` and never assigns
`activeSampler`. RED logs persisted under `docs/atdd-logs/0024-empirical-distributional-params-phase-2-*`.
Satisfiability verified via a throwaway implementation (10/10 + 1/1 green, full suite 275 passed/1
skip) then reverted — the commit carries no production code. Three autonomous seam decisions recorded
in handover-09: S3 (label id `param-label-empirical-distributional`), S4 (handler reassigns
`activeSampler` on every mode), S5 (reference-panel invariance pinned to `.size-table` `outerHTML`).
Advanced to `stage: implement`, `current_phase: 2` — next phase is `implement` p2.

**Status (implement p2 done, 2026-06-23):** wired the Phase-2 UI slice in `index.html` only —
the third `empirical-distributional` radio (placed last; label id
`param-label-empirical-distributional`; Empirical keeps `checked`) and the tri-state `param-mode`
`change` handler that binds **both** `activeParams` and `activeSampler` per mode (residual sampler
only in the new mode — DC-2) and toggles exactly one `.active` label. Both committed Phase-2
commands pass (`0024-phase-2-radio-wiring.test.js` **10/10**,
`0024-phase-2-mode-toggle-property.test.js` **1/1**), **stable green** across 3 default reruns + 1
randomized-order run each. `npm run verify` exits 0 (275 passed, 1 pre-existing skip) in the working
tree **and** under a hermetic, network-disabled (`npm ci --offline`), lockfile-pinned fresh worktree;
per-layer logs persisted under `docs/atdd-logs/0024-…-phase-2-*`. No `tests/**` drift; only
`index.html` changed; Phase-1 engine untouched. One reversible recorded decision: the handler uses an
explicit `if/else` (control-flow left free by the plan). Advanced to `stage: review`,
`current_phase: 2` — next phase is `review` p2.

**Status (review p2 PASS, 2026-06-23):** integrity review clean — diff `f9ceb3c..5787647`,
production-only (`index.html`, +20/-4). No test file changed between test/impl commits
(`git diff … -- tests features e2e acceptance` empty); no config/threshold patch
(`'*.config.*' '*.json' tsconfig* .ast-grep/* package.json` diff empty); no test-gaming pattern, no
production import from tests, no env/identity branch, no blanket suppression. The third
`empirical-distributional` radio is placed last with Empirical keeping `checked` (DC-1/DC-4); the
tri-state `change` handler binds **both** `activeParams` **and** `activeSampler` per mode (residual
sampler only in the new mode — DC-2) and toggles exactly one `.active` label. The committed suite
covers AT-1..AT-3, all four plan counterexamples, and PBT-4 (table + sampler + single highlight, with
a seeded behavioral check that the residual binding takes effect); PBT structural floor met
(`test.prop`). All three invariants are `[test-only]` and SATISFIED; no `[contract]` invariant this
phase (contract floor skipped by config). Negative control — dropping the residual sampler binding —
fails 3 tests (exit 1: PBT-4 + AT-2 sampler-ref + AT-2 seeded residual-multiply) and green restores
on revert (11/11). Mutation N/A (ADR-0036, recorded). Review file:
`docs/reviews/0024-empirical-distributional-params-phase-2-review-01.md`. Advanced to
`stage: review-correctness`, `current_phase: 2` — next phase is `review-correctness` p2 (it owns the
advance to `done`, the last feature-phase).
