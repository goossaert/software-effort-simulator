---
status: accepted — supersedes in part the uncalibrated-size carry-through decision of ADR-0026 (for the new mode only); ADR-0026's two-table/ephemeral/μ-shift-only decisions and ADR-0035's empirical default both stand
---
# Empirical (distributional) lognormal parameters — a third mode injecting estimation-error spread via a pooled-ratio residual, with cross-size borrowing for uncalibrated sizes

[ADR-0026](./0026-empirical-lognormal-parameters-mode-toggle.md) added a second
per-**T-shirt size** lognormal table (`T_SHIRT_PARAMS_EMPIRICAL`) that bias-corrects each
size's **centre** by shifting `μ` by `ln(avg_ratio)` while **preserving the synthetic σ**,
because the per-size Q1 sample (`n = 3–14`) was too small to re-fit σ without communicating
confidence the data does not support. That decision deliberately threw away the *shape* of
the `actual / estimate` distribution and kept only its mean. The RCF report
(`docs/reports/report-rcf-improvements.md`, §2 "Option 1c" and its 2026-06-22 Addendum)
identifies that discarded shape as the highest-leverage missing piece for a risk tool: the
reported intervals are too narrow because the per-size estimation-error *spread* is absent.

This ADR adds a **third** parameter mode, **Empirical (distributional)** (radio value
`empirical-distributional`), that restores that spread without re-fitting σ — and extends it
to the three sizes (`2XS`, `XL`, `XL+`) that have no Q1 data at all.

## Decision

**1. A third mode, additive to the existing two.** The sidebar **Lognormal Parameters** radio
gains a third option after `synthetic` and `empirical`. **Empirical** remains the page-load
default ([ADR-0035](./0035-default-to-empirical-lognormal-parameters.md)); the new mode is
opt-in. The radio handler keeps reassigning the module-scoped `activeParams` reference (now
across three tables) so `tshirtToPersonMonths` and the deterministic **Constant work** path
follow the mode automatically.

**2. The sampler: synthetic base × per-size centre × bootstrapped mean-1 residual.** In the
new mode a sampled epic effort is `sampleLognormal(size) × bootstrapChoice(RATIO_RESIDUALS)`,
where the lognormal reads a third table `T_SHIRT_PARAMS_DISTRIBUTIONAL` and `RATIO_RESIDUALS`
is a baked pool of `actual / (per-size mean actual)` residuals (mean = 1 by construction).
Multiplying by a mean-1 residual preserves each size's *centre* in expectation while widening
the per-epic distribution — the estimation-error spread Option 1c is for.

**3. Calibrated-size centre = empirical centre (continuity).** For `XS`/`S`/`M`/`L` the
distributional `μ` equals the **Empirical** `μ` unchanged. The new mode is therefore
"Empirical, plus spread, plus pooled coverage for the uncalibrated sizes" — its calibrated-size
*means* match the Empirical mode the operator already trusts, and the only new ingredient there
is the residual spread (a partially-pooled shape, honest at `n = 3–14` where a single size's own
shape is itself mostly noise).

**4. Uncalibrated-size centre = pooled grand mean g = 1.40× (this supersedes ADR-0026 for this
mode).** For `2XS`/`XL`/`XL+` — which have no Q1 epics — the distributional `μ` is the synthetic
`μ` shifted by `ln(1.40)`. `g = 1.40` is the epic-weighted mean of the four calibrated empirical
centres. This **replaces** ADR-0026's "carry the synthetic `(μ, σ)` through" rule (algebraically
a ratio of 1.0) **for the new mode only** — ADR-0026's carry-through still governs the Empirical
mode. The data justifies it two ways: (a) all four measured sizes underestimate by 24–51%, so
modelling the unmeasured sizes as the *only* unbiased ones (ratio 1.0) is the least defensible
option; (b) a variance decomposition of the four per-size mean ratios gives `τ² ≈ 0` (between-size
variance indistinguishable from sampling noise), i.e. `κ → ∞` — the sizes are statistically
consistent with a single shared ratio, which is the empirical-Bayes licence to transplant it onto
the unmeasured sizes.

**5. Borrowing the *ratio*, not the *effort*.** ADR-0026 rightly rejected neighbour-inheritance
— but for the *absolute effort fit*, where deriving an `XL`'s PM distribution from `L`'s `n = 3`
is worse than the synthetic band. The `actual / synthetic_mean` **ratio** is a property of the
*estimation process*, which transfers across size buckets far better than effort does; that is why
borrowing it (decision 4) is sound where borrowing the effort fit was not.

**6. The calibration is a baked artefact, computed once — not the dataset, not computed at load.**
The mode ships two module-load constants alongside the existing tables:
`T_SHIRT_PARAMS_DISTRIBUTIONAL` (all seven sizes) and `RATIO_RESIDUALS` (23 floats). They are the
*output* of a one-time calibration of the Q1 2026 **Done** epics (recipe: Realized Effort > 0;
the single `XS`-at-5.7-PM mis-sized outlier — ratio ≈ 12 — dropped; ratios computed against the
synthetic lognormal mean `exp(μ + σ²/2)`; `n = 23` = XS 5 / S 11 / M 6 / L 1). The raw CSV is
**not** committed and the constants are **not** recomputed on page-load — exactly the "pinned,
source-reviewable modelling artefact" discipline of [ADR-0026](./0026-empirical-lognormal-parameters-mode-toggle.md),
the single-file rule of [ADR-0001](./0001-single-file-html-app.md), and the no-fetch rule of
[ADR-0002](./0002-client-side-only.md). Inline comments document the recipe + per-size `n`.

**7. The existing two modes stay bit-for-bit reproducible, including the PRNG stream.** The
residual multiply consumes an extra RNG draw; it must occur **only** in the new mode. Selecting
**Synthetic** or **Empirical** must produce results byte-identical to the pre-feature app for the
same seed and inputs — no change to sampled values and **no change to the PRNG draw sequence**.
The recommended implementation mirrors ADR-0026's `activeParams` pattern: swap a function-pointer
sampler reference on radio change (e.g. an `activeSampler` that is the plain `sampleLognormal` in
the two existing modes and the residual-multiplying variant in the new mode), so the hot loop gains
no per-sample branch and the two existing modes draw exactly as before.

**8. The residual pool is applied to every size; the spread is partially pooled.** A single shared
`RATIO_RESIDUALS` pool feeds all seven sizes (calibrated sizes get a partially-pooled shape rather
than their own brittle `n = 1–11` shape; uncalibrated sizes get the pooled shape entirely).

**9. The sidebar T-shirt size reference panel is unchanged** when the new mode is selected,
consistent with [ADR-0026](./0026-empirical-lognormal-parameters-mode-toggle.md) and
[ADR-0035](./0035-default-to-empirical-lognormal-parameters.md): the band column is
band-as-definition (the synthetic input to the lognormal formula), not band-as-current-sampling-window.

## Consequences

- The operator gets, for the first time, the per-size *estimation-error spread* in the forecast,
  and gets it for `2XS`/`XL`/`XL+` too (borrowed) — the sizes most likely to drive the upper tail,
  which the Empirical mode leaves at the pure synthetic inside-view.
- The new mode's calibrated-size *means* match the Empirical mode (continuity); the visible change
  there is wider intervals. For `2XS`/`XL`/`XL+` the means rise to 1.40× synthetic (vs 1.0× in
  Empirical) and gain spread.
- **Constant work** in the new mode uses `T_SHIRT_PARAMS_DISTRIBUTIONAL`'s deterministic mean via
  `tshirtToPersonMonths` (uncalibrated sizes get the 1.40× centre; calibrated sizes match
  Empirical). The mean-1 residual does not affect the deterministic constant-work mean.
- The borrowing rests on multiplicative estimation error being roughly size-homogeneous. The weak
  point is the *extremes*: `2XS`/`XL`/`XL+` sit at the ends of the range, where estimation error is
  often worst; the transplanted spread should be read as a floor, not a ceiling, on their
  uncertainty. (A future revision could inflate the uncalibrated-size residual spread.)
- The calibration is still a single quarter (`n = 23` after filtering, `L` is `n = 1`). When more
  realised data arrives, the two constants are re-derived together — additive, no ADR re-open,
  mirroring ADR-0026's "re-fit empirically" future revision.
- Adding a third mode without perturbing the existing two depends entirely on the PRNG-isolation
  discipline (decision 7); a naive shared-path implementation that draws a residual in every mode
  would silently break every past synthetic/empirical re-simulation.

## Considered alternatives

- **Re-fit (μ, σ) jointly per size (Option 1a)** — rejected for the same reason ADR-0026 gave: at
  `n = 1–11` the σ estimate is dominated by sample noise.
- **Bootstrap realised PM directly per size (Option 1b)** — rejected: a size with `n = 1` (L) can
  produce one value; brittle tails. Pooling the *residuals* across sizes (decision 8) is the fix.
- **Keep ratio = 1.0 for uncalibrated sizes** (ADR-0026's carry-through) — rejected for the new
  mode (decision 4): it asserts the unmeasured sizes are unbiased while every measured size is
  biased the same way.
- **Full-pool the centre to one ~1.45× multiplier** (since `κ → ∞`) — rejected: it collapses the
  per-size centre signal and the t-shirt-size lever; continuity with the Empirical centres is more
  interpretable. (`κ → ∞` is used only as the *licence to borrow onto the unmeasured sizes*, not to
  flatten the measured ones.)
- **Parameterize the residual spread** (assume a lognormal σ for the ratio) — rejected: reintroduces
  exactly the parametric-σ guess ADR-0026 refused and undercuts Option 1c's zero-distributional-
  assumption virtue. The author provided raw ratios so the pool is a true bootstrap.
- **Replace the Empirical mode in place** — rejected: the operator must keep reproducing past
  Empirical (and Synthetic) runs exactly (decision 7).
