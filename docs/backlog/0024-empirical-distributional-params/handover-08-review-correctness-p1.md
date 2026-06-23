---
schema: backlog-handover/v1
task_id: "0024"
produced_by_phase: review-correctness
feature_phase: 1
for_next_phase: atdd
outcome: success
reason: ""
produced_at: 2026-06-23T06:49:52Z
test_commit: e852039a2deffa6951d951c88bf4ecf83caf2455
impl_commit: 4de048104bfc5afef67bbd78c1ed3e7d9846a86e
---
## Summary

Independent correctness review of feature-phase 1 (engine + baked constants) over the
**production-only** diff `e852039..4de0481` (`index.html` + `package.json`), reasoning from the
spec (plan Phase 1 behavioral rule + invariants + DoD + Oracle strategy + cited ADRs/CONTEXT) —
tests excluded by method. **Verdict: PASS.** A single clean pass produced **zero** candidate
findings; the judge pass dropped nothing and nothing survived; Step 5b (suspect-test) was not
reached. No correctness defect tied to a stated requirement. Per the Loop contract this PASS
**advances the feature-phase**: `stage: atdd`, `current_phase: 2`, `retry_count: 0`,
`next_handover: handover-03-plan.md`. Review file:
`docs/reviews/0024-empirical-distributional-params-phase-1-correctness-01.md`.

## Verdict object (`backlog-review-correctness/v1`)

```json
{
  "schema": "backlog-review-correctness/v1",
  "verdict": "pass",
  "findings": [],
  "judge_dropped": []
}
```

## What was verified (spec point → production reasoning)

- **Sampler relation + draw order (behavioral rule; ADR-0038 dec. 2; seam S2).**
  `sampleLognormalWithResidual(sizeLabel) = sampleLognormal(sizeLabel) * bootstrapChoice(RATIO_RESIDUALS)`
  (`index.html:1439–1441`). The `*` left operand evaluates fully first ⇒ lognormal draw first,
  residual draw immediately after (S2). `bootstrapChoice` returns a real pool element
  (`arr[rng.nextInt(arr.length)]`) and consumes exactly one `rng` draw. Applied uniformly to every
  size, no `if (size === …)` special-casing. **Correct.**
- **Size draw outside the swapped call; PRNG isolation (DC-2 / ADR-0038 dec. 7).** In the
  hot loop `total += activeSampler(bootstrapChoice(epicSizingDist))` (`index.html:2600`) the size
  draw is the argument, evaluated before the call — identical to the pre-feature
  `sampleLognormal(bootstrapChoice(…))`, so all three modes draw the size at the same PRNG
  position. `activeSampler` defaults to `sampleLognormal` (`index.html:1380`; a hoisted function
  decl, no TDZ), so Synthetic/Empirical consume no extra draw and stay byte-identical; the residual
  draw lives only in `sampleLognormalWithResidual`. **Correct (AC-4 holds by construction).**
- **Baked constants (DC-3 / AC-3 / I-2 / I-3)** (`index.html:1346–1366`): calibrated XS/S/M/L
  `(μ,σ)` == `T_SHIRT_PARAMS_EMPIRICAL` exactly; uncalibrated 2XS/XL/XL+ σ == synthetic σ and
  μ = synthetic μ + ln(1.40) to 4 dp (−1.5079 / 2.3310 / 2.6868); identical 7-key set across the
  three tables; `RATIO_RESIDUALS` Σ=23.0000 ⇒ mean 1.0000, all >0; baked literal, not recomputed.
  **Correct.**
- **Constant-work (AC-8):** `tshirtToPersonMonths` reads `activeParams`, returns `exp(μ+σ²/2)`,
  residual not applied; uncalibrated = 1.40× synthetic, calibrated = Empirical. **Correct.**
- **Unknown size:** `sampleLognormal` returns 0 ⇒ `0 × residual = 0`, non-negative. **Correct.**
- **`[contract]` I-4** (`index.html:1371–1373`): `!(length>0 && every(r>0))` throws on an invalid
  pool, does not fire for the real pool. **Logically correct.**
- **`package.json` lint bootstrap (impl D1):** `{ [ -e … ] || npm ci; } && eslint … --max-warnings 0`
  — eslint invocation unchanged, layer not weakened; invocation-reliability fix, **out of
  correctness scope** (noted, not a finding).

## Instructions for the next phase (atdd p2)

Run `/stage-atdd` for **feature-phase 2** (the plan's *Phase 2: Selecting the third radio swaps
the mode end-to-end*). Author the acceptance + property tests from the **plan**, confirm a stable
RED gate, and freeze them. Phase 2 is the **UI + tri-state `change` handler** slice:

- Add a third `<input name="param-mode" value="empirical-distributional">` (label text contains
  **"Empirical (distributional)"**) placed **last** in the Lognormal Parameters group; **Empirical**
  stays `checked` (DC-1 / DC-4).
- The `change` handler binds `activeParams` → the matching table **and** `activeSampler` → the
  matching function across **three** modes (the new mode → `T_SHIRT_PARAMS_DISTRIBUTIONAL` +
  `sampleLognormalWithResidual`), and keeps exactly one label `.active`.
- Ephemeral: no `localStorage`/URL key written by any selection; reload resets to Empirical. The
  sidebar **T-shirt size reference** `<details>` panel is **not** re-rendered (ADR-0038 dec. 9).
- Tests: `tests/acceptance/0024-phase-2-radio-wiring.test.js` (AT-1..AT-3) and
  `tests/acceptance/0024-phase-2-mode-toggle-property.test.js` (PBT-4, `@fast-check/vitest`).
  Read tables/symbols from the loaded window; dispatch `change` via
  `new win.Event('change', { bubbles: true })` (the 0022 tests are the template). Seed `rng`
  before the one sampling sub-assertion in AT-2.

The Phase 1 engine seam (`T_SHIRT_PARAMS_DISTRIBUTIONAL`, `RATIO_RESIDUALS`, `activeSampler`
default `sampleLognormal`, `sampleLognormalWithResidual`) is now merged and correctness-clean —
Phase 2 only wires the UI to it; it must **not** edit the Phase 1 engine or re-draw in the
shared path.

## Files the next phase MUST read

- `docs/plans/0024-empirical-distributional-params.md` — **Phase 2** slice (behavioral rule,
  invariants, counterexamples, Oracle strategy, Properties, DoD, RED gate). The spec to test from.
- `docs/backlog/0024-empirical-distributional-params/handover-03-plan.md` — the plan handover
  (`next_handover`); plan context + `DC-1..4`.
- `index.html` — radio markup `param-mode-options` (~`949–961`), the **T-shirt size reference**
  `<details>` panel (~`971–991`, must stay invariant), the param-mode `change` handler
  (~`4649–4655`), and the Phase 1 seam (`T_SHIRT_PARAMS_DISTRIBUTIONAL` `:1346`; `activeSampler`
  `:1380`; `sampleLognormalWithResidual` `:1439`).
- `CONTEXT.md` — glossary (Empirical (distributional) parameters; Ratio residual pool).
- `docs/adr/0038-…md` (esp. dec. 1 radio, dec. 9 reference panel), `docs/adr/0026-…md`,
  `docs/adr/0035-…md` (Empirical default) — the constraining decisions.
- `tests/harness.js`; `tests/acceptance/0022-empirical-default-on-load.test.js` +
  `0022-empirical-default-params-property.test.js` — the closest harness pattern (param-mode radio
  + `activeParams`).

## Context the next phase needs

- **Boot smoke:** `smoke_command` empty (toolchain `smoke: n/a` — single-file HTML, no build step).
  Stage-start smoke = logged no-op; base = HEAD = the review PASS commit `2e1d665` (the impl commit
  `4de0481` is its ancestor). Healthy per the prior phases' hermetic green (264 passed, 1 skip).
  Result: passed.
- **Test-drift / diff scope:** the reviewed diff `e852039..4de0481` touched production only
  (`index.html`, `package.json`) plus docs/logs; no `tests/**` changed (confirmed by the integrity
  review).
- **PBT floor:** Phase 2 declares PBT-4 (tri-state toggle) — atdd must commit it via `test.prop`
  using `@fast-check/vitest` (`pbt.import_symbol`), or the gate's (f) floor rewinds to atdd.
- **Mutation:** N/A, recorded (`mutation.enabled:false`, ADR-0036). **oracle_free:** N/A (class (a)).
- **No `[contract]` invariant in Phase 2** (the plan states the wiring has no cheap per-call
  precondition; the Phase 1 module-load assertion already guards sampler positivity) — so the
  gate's (g) contract-floor does not apply to the Phase 2 commit.
- Autonomous gated decisions taken this phase: (1) verdict **PASS** taken autonomously per the
  Loop contract — no user; (2) tests neither read nor run for the verdict (spec-only reasoning,
  Step 1); Step 5b not reached; (3) no additional verification tests written (no gap found), so the
  commit carries only the correctness review file + the index advance + this handover.

## Definition of done (for atdd p2)

- Write the Phase 2 acceptance + property tests per the plan's *Test harness*; achieve a **stable
  RED** across `test_immutability.flakiness_reruns` (5) on the current base (the new radio value /
  three-way handler do not yet exist), with the RED logs persisted under `docs/atdd-logs/`.
- Freeze the tests (no further edits), emit the atdd handover (`handover-NN-atdd-p2.md`), and
  advance `stage: implement`, `current_phase: 2`.
