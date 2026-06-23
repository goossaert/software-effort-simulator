---
schema: backlog-index/v1
id: "0024"
slug: empirical-distributional-params
title: Empirical (distributional) lognormal parameters mode
stage: implement
status: ready
priority: normal
flagged_for_human: false
total_phases: 2
current_phase: 1
retry_count: 0
max_retries: 3
next_handover: handover-04-atdd-p1.md
updated_at: 2026-06-23T06:11:11Z
created_at: 2026-06-22T18:55:38Z
blocked_reason: ""
artifacts:
  plan: docs/plans/0024-empirical-distributional-params.md
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
