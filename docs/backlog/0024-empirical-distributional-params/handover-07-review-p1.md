---
schema: backlog-handover/v1
task_id: "0024"
produced_by_phase: review
feature_phase: 1
for_next_phase: review-correctness
outcome: success
reason: ""
produced_at: 2026-06-23T06:42:55Z
test_commit: e852039a2deffa6951d951c88bf4ecf83caf2455
impl_commit: 4de048104bfc5afef67bbd78c1ed3e7d9846a86e
---
## Summary

Integrity review of feature-phase 1 (engine + baked constants) over the diff
`e852039..4de0481`. **Verdict: PASS** — integrity clean. No test file changed between the
test and implementation commits; no test-gaming pattern, no production import from tests, no
`NODE_ENV`/identity branch, no blanket suppression. The two baked constants match the frozen
calibration exactly (DC-3); the DC-2 RNG isolation holds (the residual draw lives only in the
new mode, lognormal-first per seam S2); the I-4 `[contract]` invariant is present and proven
**live** by a negative control. Mutation is a recorded N/A (ADR-0036); PBT-1/2/3 meet the
structural floor. Per the loop contract, this PASS hands to `review-correctness` (which owns
the advance to Phase 2); the index now reads `stage: review-correctness`, `current_phase: 1`.

## Instructions for the next phase (review-correctness p1)

Run `/stage-review-correctness` for **feature-phase 1**. Reason from the **spec** (plan
behavioral rule + invariants + DoD + Oracle strategy + the cited ADRs/CONTEXT), reading the
**production-only** diff — **not** the tests — to hunt for correctness bugs that pass the green
suite. Derive the diff range from git (same as this review):

- `test_commit = git log -1 --format=%H -- docs/backlog/0024-empirical-distributional-params/handover-04-atdd-p1.md` → `e852039a2deffa6951d951c88bf4ecf83caf2455`
- `impl_commit = git log -1 --format=%H -- docs/backlog/0024-empirical-distributional-params/handover-06-implement-p1.md` → `4de048104bfc5afef67bbd78c1ed3e7d9846a86e`

Spec points worth scrutinising from the correctness angle (the integrity review already cleared
test-gaming / immutability / coverage — do not re-do those):

- **Sampler relation + draw order.** `sampleLognormalWithResidual(sizeLabel) =
  sampleLognormal(sizeLabel) * bootstrapChoice(RATIO_RESIDUALS)` (`index.html:1439-1441`), routed
  through `activeSampler` in the `runScenario` hot loop (`index.html:2600`). Confirm: (a) the
  size draw `bootstrapChoice(epicSizingDist)` stays outside the swapped call so all three modes
  draw the size at the identical PRNG position; (b) the residual draw is the immediately-following
  draw after the lognormal draw (S2); (c) `activeSampler` default `= sampleLognormal` keeps
  Synthetic/Empirical byte-identical and consuming no extra draw (DC-2 / ADR-0038 dec. 7).
- **Baked constants (DC-3).** Calibrated XS/S/M/L `(μ,σ)` == `T_SHIRT_PARAMS_EMPIRICAL` exactly;
  uncalibrated 2XS/XL/XL+ σ == synthetic σ and μ == synthetic μ + ln(1.40) to 4 dp; identical
  7-key set across the three tables; `RATIO_RESIDUALS` (n=23) mean=1.0000, all > 0; not recomputed
  at load.
- **Constant-work path (AC-8).** `tshirtToPersonMonths` reads `activeParams` and returns
  `exp(μ + σ²/2)` — deterministic, residual does NOT apply; uncalibrated mean is 1.40× synthetic.
- **Unknown-size behavior.** `sampleLognormal` returns 0 for an unknown label, so
  `0 × residual = 0` (never negative) — unchanged existing behavior.
- **The `package.json` `lint`-script bootstrap (decision D1)** is the only non-`index.html`
  production change: it self-bootstraps `npm ci` before `eslint index.html --max-warnings 0`
  (invocation unchanged). It is an infrastructure-reliability fix, not a behavioral or
  correctness-layer change — out of scope for correctness bugs, but noted so it isn't mistaken
  for one.

## Files the next phase MUST read

- `docs/plans/0024-empirical-distributional-params.md` — Phase 1 slice: behavioral rule,
  invariants, counterexamples, Oracle strategy, Definition of done (the spec to reason from).
- `index.html` — the production diff: `T_SHIRT_PARAMS_DISTRIBUTIONAL` + `RATIO_RESIDUALS` +
  the I-4 `[contract]` (≈ lines 1340-1373); `activeSampler` (`:1380`); `sampleLognormalWithResidual`
  (`:1439-1441`); the hot-loop swap in `runScenario` (`:2600`).
- `package.json` — the `lint`-script bootstrap (decision D1).
- `CONTEXT.md` — glossary (Empirical (distributional) parameters; Ratio residual pool).
- `docs/adr/0038-empirical-distributional-parameters-mode.md` — the nine decisions
  (esp. dec. 2 sampler, dec. 3/4 centres, dec. 7 PRNG isolation).
- `docs/adr/0026-…`, `docs/adr/0035-…`, `docs/adr/0009-…`, `docs/adr/0007-…` — the constraining
  ADRs the plan cites (two-table/`activeParams`, Empirical default, seeded PRNG, synthetic (μ,σ)).
- `docs/backlog/0024-empirical-distributional-params/handover-04-atdd-p1.md` — the frozen seam
  contract (S1/S2) and the test inventory (to derive `test_commit`).
- `docs/backlog/0024-empirical-distributional-params/handover-06-implement-p1.md` — the
  implementation summary + decision D1 (to derive `impl_commit`).
- `docs/reviews/0024-empirical-distributional-params-phase-1-review-01.md` — this integrity
  review (what was already cleared, so the correctness pass does not duplicate it).

## Context the next phase needs

- **Boot smoke:** `smoke_command` is empty (toolchain `smoke: n/a` — single-file HTML, no build
  step). Stage-start smoke = logged no-op; base = HEAD = the impl commit `4de0481`. Result: passed.
- **Test-drift check:** `git diff e852039..4de0481 -- tests features e2e acceptance` is **empty**.
- **Negative controls (this review):** (A) dropping the residual multiply fails AT-1 (M + XL+) and
  PBT-2, reverts to 14/14 + 3/3 green; (B) a forbidden residual value (`-0.3692`) fires the I-4
  `[contract]` module-load assertion (`Uncaught [Error: [contract] RATIO_RESIDUALS must be a
  non-empty pool of strictly positive residuals]`) and aborts module load. Working tree restored
  clean after both.
- **Observation (not a defect):** the AC-5 variance check (AT-3/PBT-3) does not isolate the
  residual on its own — the centre uplift (μ + ln1.40) inflates a lognormal's variance ~1.40²
  even with no residual — but the residual relation is fully pinned by the deterministic AT-1/PBT-2.
- **Mutation:** N/A, recorded (`mutation.enabled:false`, `toolchain.layers.mutation.status:"n/a"`,
  ADR-0036). **PBT floor:** met (PBT-1/2/3 committed as `test.prop`). **oracle_free:** N/A (class (a)).
- Autonomous gated decisions taken this phase: (1) verdict PASS taken autonomously per the Loop
  contract — no user; (2) two negative controls run and reverted before commit; (3) no additional
  verification tests written (no gap found), so the commit carries only the review file + index +
  this handover.

## Definition of done (for review-correctness p1)

- Reason from the spec over the production diff (`e852039..4de0481`), tests excluded.
- Emit a `backlog-review-correctness/v1` verdict. PASS (k=1 < N=2) advances `current_phase: 2`,
  `stage: atdd`, `retry_count: 0`; FAIL routes to `implement` (production fix); a committed test
  contradicting the spec is `blocked: suspect-test` (human-flagged, never routed to implement).
