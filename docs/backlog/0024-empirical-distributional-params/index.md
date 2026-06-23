---
schema: backlog-index/v1
id: "0024"
slug: empirical-distributional-params
title: Empirical (distributional) lognormal parameters mode
stage: atdd
status: ready
priority: normal
flagged_for_human: false
total_phases: 2
current_phase: 1
retry_count: 0
max_retries: 3
next_handover: handover-03-plan.md
updated_at: 2026-06-23T08:35:00Z
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
PBT via fast-check. Advanced to `stage: atdd`, `current_phase: 1` — next phase is `atdd` p1.
