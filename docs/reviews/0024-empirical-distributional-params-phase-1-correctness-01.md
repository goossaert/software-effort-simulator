# Correctness review — 0024 Empirical (distributional) parameters · Phase 1 · run 01

- **Slug:** `0024-empirical-distributional-params`
- **Feature-phase:** 1 (engine + baked constants)
- **Run:** 01
- **Date:** 2026-06-23
- **test_commit:** `e852039a2deffa6951d951c88bf4ecf83caf2455` (`handover-04-atdd-p1.md`)
- **impl_commit:** `4de048104bfc5afef67bbd78c1ed3e7d9846a86e` (`handover-06-implement-p1.md`)
- **Diff reviewed:** `e852039..4de0481`, **production files only** (`index.html`, `package.json`); tests excluded by method.
- **Stage:** `/stage-review-correctness` — reasoning from the spec (plan Phase 1 behavioral
  rule + invariants + DoD + Oracle strategy + cited ADRs/CONTEXT) over the production diff,
  hunting correctness bugs that pass the green suite. The integrity review
  (`…-review-01.md`) already cleared test-gaming / immutability / coverage; not re-done here.

## Verdict: **PASS**

A single clean pass over the spec + production diff produced **zero** candidate findings;
the judge pass therefore dropped nothing and nothing survived. No correctness defect tied to
a stated requirement. Step 5b (suspect-test disambiguation) was not reached (no surviving
finding). PASS advances the task to feature-phase 2 (`atdd`).

## What was checked (spec point → production reasoning)

- **Sampler relation + draw order (behavioral rule; ADR-0038 dec. 2; seam S2).**
  `sampleLognormalWithResidual(sizeLabel) = sampleLognormal(sizeLabel) * bootstrapChoice(RATIO_RESIDUALS)`
  (`index.html:1439–1441`). JS evaluates the `*` left operand fully before the right, so the
  lognormal draw happens first and the residual draw immediately after — lognormal-first / S2,
  as recorded. The residual is an actual element of `RATIO_RESIDUALS`
  (`bootstrapChoice` returns `arr[rng.nextInt(arr.length)]`), and `nextInt(23)` consumes exactly
  one `rng` draw. Matches the rule: effort = lognormal × mean-1 residual, applied uniformly to
  every size (no `if (size === …)` special-casing). **Correct.**

- **Size draw stays outside the swapped call; PRNG isolation (DC-2 / ADR-0038 dec. 7).**
  Hot loop `total += activeSampler(bootstrapChoice(epicSizingDist))` (`index.html:2600`)
  evaluates `bootstrapChoice(epicSizingDist)` (the size draw) as the argument *before* invoking
  `activeSampler` — identically to the pre-feature `sampleLognormal(bootstrapChoice(…))`. So all
  three modes draw the size at the identical PRNG position. `activeSampler` defaults to
  `sampleLognormal` (`index.html:1380`), so the Synthetic/Empirical paths call the same function
  with no extra draw and stay byte-identical (the residual draw lives only inside
  `sampleLognormalWithResidual`, assigned to `activeSampler` only in the new mode). The
  `let activeSampler = sampleLognormal` reference resolves correctly — `sampleLognormal` is a
  hoisted `function` declaration in the same `<script>`, so no temporal-dead-zone error.
  **Correct (DC-2 / AC-4 holds by construction).**

- **Baked constants (DC-3 / AC-3 / I-2 / I-3).** `index.html:1346–1366`.
  - Calibrated XS/S/M/L `(μ,σ)` equal `T_SHIRT_PARAMS_EMPIRICAL[size]` **exactly**
    (−0.5093/0.4286, 0.4704/0.2703, 0.9636/0.2703, 1.7550/0.2703).
  - Uncalibrated 2XS/XL/XL+ σ equals the **synthetic** σ exactly (0.3575, 0.1582, 0.0372) and
    μ = synthetic μ + ln(1.40) to 4 dp: −1.8444+0.33647=−1.50793≈**−1.5079**;
    1.9945+0.33647=2.33097≈**2.3310**; 2.3503+0.33647=2.68677≈**2.6868**.
  - Identical 7-key set `{2XS,XS,S,M,L,XL,XL+}` across all three tables.
  - `RATIO_RESIDUALS` (n=23): Σ = 23.0000 ⇒ mean = 1.0000 to 4 dp; every element > 0; baked
    literal, not recomputed at load. **Correct.**

- **Constant-work path (AC-8).** `tshirtToPersonMonths` (`index.html:1388–1392`) reads
  `activeParams` and returns `exp(μ + σ²/2)`; the residual does **not** apply. Under the
  distributional table an uncalibrated mean = `exp(synthμ + ln1.40 + σ²/2)` = 1.40× synthetic
  mean; a calibrated mean matches Empirical. **Correct.**

- **Unknown-size behavior (Expected observable outcomes).** `sampleLognormal` returns 0 for an
  unknown label, so `0 × residual = 0` — never negative; unchanged existing behavior. **Correct.**

- **`[contract]` I-4 (module-load assertion).** `index.html:1371–1373` throws unless
  `RATIO_RESIDUALS.length > 0 && every(r > 0)`. The predicate is logically correct (throws on
  an empty pool or any non-positive residual) and does not fire for the real pool. **Correct.**

- **`package.json` `lint`-script bootstrap (impl decision D1).**
  `{ [ -e node_modules/.bin/eslint ] || npm ci; } && eslint index.html --max-warnings 0`.
  Self-bootstraps `npm ci` only when eslint is absent; the eslint invocation and
  `--max-warnings 0` are unchanged, so the lint layer is not weakened. An invocation-reliability
  fix, not a behavioral/correctness change — **out of correctness scope** (noted, not a finding).

## Review axes (no defect found on any)
- **logic / off-by-one:** sampler relation, draw order, default sampler, hot-loop swap — all
  match the behavioral rule. None.
- **edge-case:** unknown size (→0), empty/non-positive pool (guarded by I-4), XL+ near-deterministic
  σ (residual dominates, still lognormal × residual) — all covered. None.
- **error-handling / resource leak:** pure computation; no resources, no error paths. N/A.
- **security:** no external input / injection surface in the diff. N/A.
- **complexity:** new sampler is O(1) per epic; no blowup. None.

## Machine-readable findings (`backlog-review-correctness/v1`)

```json
{
  "schema": "backlog-review-correctness/v1",
  "verdict": "pass",
  "findings": [],
  "judge_dropped": []
}
```

## Autonomous decisions (Loop mode — no user)
1. Verdict **PASS** taken autonomously per the Loop-mode contract.
2. Boot smoke: `smoke_command` is empty → logged no-op (single-file HTML, no build step);
   base = HEAD = `2e1d665` (review PASS); healthy per the prior phases' hermetic green (264).
3. Tests **not** read and **not** run for the verdict — this stage reasons from the spec, not the
   suite (Step 1); Step 5b was not reached, so no committed test was opened.
4. No additional verification tests written (no correctness gap found); the commit carries only
   this review file + the index advance + the handover.
