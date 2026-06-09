# Sanity-check verdict — `0003-sanity-check-engine-mean.test.js`

## Result: PASS ✅

The Monte Carlo engine is consistent with its inputs.

- λ_engine equals an independently-computed λ to 9 decimal places for all
  four historical-pool selections (the standalone-epics union and the
  quartersWithEpicData filter are correctly applied).
- For every (historical_pool × scenario) pair, the simulated mean matches
  `K × λ × E[size] + fixedEffort` to within Monte Carlo noise.

| Metric | Value |
|---|---|
| Iterations per scenario | 10 000 |
| Scenarios checked | 4 historical pools × 4 Groups = 16 |
| Worst \|rel_error\| | **0.196 %** |
| Assertion threshold | 1.5 % |

`E[size]` is computed via `tshirtToPersonMonths()` over the in-scope epic
sizing pool, so the **Empirical Lognormal Parameters** bias correction
(`T_SHIRT_PARAMS_EMPIRICAL`) is baked into both the prediction and the
simulation. No residual discrepancy remains — i.e. cause (1) "empirical bias
correction" from the handoff is the *only* thing the simple
`K × λ × E[size]` identity would miss if you mistakenly computed `E[size]`
from `T_SHIRT_PARAMS` (synthetic) while the simulator runs on
`T_SHIRT_PARAMS_EMPIRICAL`. Use the active param set on both sides and the
identity holds exactly.

## Interpreting the +9 % claim in the bug report

The handoff hand-calc was:

| Pool | λ | E[size] | Product |
|---|---|---|---|
| {Q1, Q2} 2026 (case A) | 1.81 | 2.08 | 3.76 |
| {Q1, Q2, Q3} 2026 (case B) | 1.87 | 2.19 | 4.10 |
| Shift | +3 % | +5.5 % | **+9 %** |

This script, reading the attached CSVs, gets:

| Pool | λ | E[size] | Product |
|---|---|---|---|
| {Q1, Q2} 2026 | **1.8500** | **2.3411** | 4.331 |
| {Q1, Q2, Q3} 2026 | **2.0755** | **2.5363** | 5.265 |
| Shift | +12.2 % | +8.3 % | **+21.5 %** |

The shapes match (both λ and E[size] grow when Q3 is added; the product is
the K-dependent component of the scenario mean), but the magnitudes are
larger than the hand-calc estimated. The simulated case-A → case-B mean
shifts in this run are +15 to +18 % across the four scenarios (e.g. BK-only
229.11 → 264.10 = +15.3 %, BK+ZK+Auto 324.07 → 380.78 = +17.5 %), and they
match the engine's own `K × λ × E[size] + CW` prediction to within 0.2 %.

So:

- **No engine bug.** The engine is producing exactly what the inputs
  dictate.
- The hand-calc in the original bug report underestimated both λ and
  E[size] for the larger pool, presumably by counting epics or initiative
  keys differently (e.g. excluding the standalone-epics-only initiative
  keys, or using midpoints other than `tshirtToPersonMonths`). The actual
  shift when Q3 2026 is folded into the pool is larger than +9 % — the
  user's observation of a substantial increase in P(>270) is the expected
  consequence of the underlying inputs, not a hidden bias.

## How to reproduce

```sh
npx vitest run tests/verification/0003-sanity-check-engine-mean.test.js
```

The test reads three CSVs from `~/Downloads/` by default. Override the
paths via env vars:

- `SIM_INITIATIVES_CSV`
- `SIM_EPICS_CSV`
- `SIM_CONSTANT_WORK_CSV`

The console output includes the per-pool λ / E[size] / CW table and the
16-row predicted-vs-simulated comparison.
