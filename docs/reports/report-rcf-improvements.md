# Improving the Monte Carlo simulator with Reference Class Forecasting

*Analysis report — 2026-06-17*

## 1. What the simulator does today

The engine forecasts total delivery effort (person-months, PM) for a target quarter's plan
by Monte Carlo. Per **Iteration** (`runScenario`, [index.html:2412](index.html:2412)):

1. For each of the `K` **Initiatives** in a **Scenario** (`K` = count of target-quarter
   initiatives whose **Category** ∈ the **Group**'s members):
   - sample `numEpics ~ Poisson(λ)`, where `λ` = mean epics-per-initiative observed in the
     **Historical quarter** (`prepareSimulationData`, [index.html:2047](index.html:2047));
   - for each epic, draw a **T-shirt size** label uniformly with replacement from the historical
     **Bootstrap pool**, then sample effort `~ Lognormal(μ_size, σ_size)`
     (`sampleLognormal`, [index.html:1376](index.html:1376));
   - sum.
2. Sum across the `K` initiatives → one **Iteration** total.
3. After sorting, add each Group's deterministic **Constant work** shift.

10,000 iterations produce an empirical distribution → percentiles + `P(effort > capacity)`.

### The simulator already contains an embryonic RCF

This matters, because the question is not "should we add RCF" but "how do we deepen the RCF
that is already half-built". Three of its channels are already *outside-view* (data-driven from
history) rather than *inside-view* (expert/theoretical):

| Channel | Mechanism | RCF status |
|---|---|---|
| **Size mix** | **Bootstrap pool** of historical size labels ([ADR-0006](docs/adr/0006-monte-carlo-with-bootstrapped-sizes.md)) | Empirical distribution ✅ |
| **Epic fan-out** | `λ` fit from historical epics/initiative ([ADR-0008](docs/adr/0008-poisson-epic-count.md)) | Empirical **point** estimate ⚠️ |
| **Per-size effort centre** | **Empirical parameters** mode shifts `μ` by `ln(avg_ratio)` from Q1 2026 actuals ([ADR-0026](docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md)) | Empirical **point** uplift ⚠️ |
| **Per-size effort spread** | `σ` held at the synthetic value, *even in empirical mode* | **Inside view only** ❌ |

The **Empirical parameters** mode is, conceptually, exactly an RCF *uplift*: it took a reference
class (Q1 2026 epics, `n = 36`), measured `actual / estimate` per size, and corrected the model
toward reality. But it deliberately collapsed that reference class to a **single number per size**
(the mean ratio) and threw away its *shape*, because at `n = 3–14` per size a parametric σ re-fit
would have been noise ([ADR-0026](docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md),
§"μ-shift-only"). That is a reasonable v1 decision — and it is precisely the seam where deeper RCF
plugs in.

### The structural gap

RCF (Kahneman/Tversky → Flyvbjerg) exists to defeat the **planning fallacy**: the systematic,
right-tailed gap between what a plan says and what reality delivers, including the work nobody
wrote down. Its core artefact is the **empirical distribution of the `actual / estimate` ratio**
across a reference class — you then forecast at the percentile of *that* distribution matching the
confidence you want ("to be 80% sure, multiply the plan by 1.4×").

Today's engine captures the **centre** of one slice of that (per-size `μ`) but not:

- the **spread** of estimation error (the σ it keeps synthetic),
- the **overdispersion** of fan-out (Poisson forces variance = mean — [ADR-0008](docs/adr/0008-poisson-epic-count.md) flags this),
- the **parameter uncertainty** from a 36-epic sample (treated as if `λ` and the size mix were known exactly),
- **scope growth / unknown-unknowns** (initiatives & epics that materialise but were never planned).

Each of these makes the reported intervals **too narrow** — the most dangerous failure mode for a
risk tool, because it reads as confidence the data does not support.

---

## 2. Three ways to deepen RCF — compared

The real design decision is the **granularity of the reference class**: at what unit do you
measure `actual` vs `estimate` and resample? The three options below are ordered coarse-to-fine
inverted — fine to coarse — and are **not mutually exclusive** (Option 3 can wrap Options 1–2).

### Option 1 — Per-size effort distribution (fine granularity)

**Reference class:** historical epics of the same **T-shirt size**.
Replace the point μ-shift with the *full* empirical distribution of realized per-size effort.
Three implementation variants, in increasing fidelity / data-hunger:

- **1a — Re-fit (μ, σ) jointly** from log-actuals per size (MLE). Cleanest parametrically, but
  this is exactly what [ADR-0026](docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md)
  rejected at `n = 3–14`: σ would swing wildly between calibration windows.
- **1b — Empirical bootstrap of actual PM** per size: drop the lognormal entirely for calibrated
  sizes and bootstrap realized effort values directly. Zero distributional assumption, but a
  size with `n = 3` can only ever produce 3 distinct values — brittle tails.
- **1c — Multiplicative uplift bootstrap (recommended within Option 1).** Keep the synthetic
  lognormal as the inside-view base, then multiply each sampled epic effort by an
  `actual / synthetic_mean` ratio **drawn from the empirical ratio pool for that size**:
  `effort = sampleLognormal(size) × bootstrapChoice(ratioPool[size])`.
  This reuses the *exact* data ADR-0026 already collected (the per-size ratios), but injects the
  ratios' **whole distribution** instead of just their mean — restoring the estimation-error
  spread that the σ-preserving decision removed, **without** committing to a parametric σ at small
  n. It is the smallest, most faithful step from where the code already is.

### Option 2 — Per-initiative total (medium granularity)

**Reference class:** historical **Initiatives** (optionally stratified by Category / Team).
For each past initiative, compute its *total realized effort* (sum of its epics' actual PM). To
forecast, bootstrap **whole realized initiative totals** — collapsing the Poisson × lognormal
compound into a single empirical draw per initiative.

This is the most "outside-view" of the three at the unit users actually plan in. Crucially it
captures **joint structure** the current independent sampling destroys: in reality, big
initiatives tend to have *both* more epics *and* bigger epics (positive correlation), so summing
independent Poisson-counts of independent lognormals understates the upper tail. A whole-initiative
bootstrap preserves that correlation for free.

### Option 3 — Per-plan / per-quarter uplift (coarse, classic Flyvbjerg)

**Reference class:** past quarters / plans. Take the team's *bottom-up planned estimate* for the
target quarter and apply an uplift read off the empirical distribution of
`actual_total / planned_total` across past quarters. Output: "for 80% confidence, plan × 1.4".

This is the most literal Flyvbjerg RCF and the only one that natively captures **scope growth and
unknown-unknowns** (because `actual` includes work that was never in the plan). It is best used as
a **wrapper / sanity rail around** the Monte Carlo, not a replacement: show the simulation's P80
next to the reference-class uplift's P80 and flag when they diverge.

### Comparison

| Dimension | **Opt 1** — per-size | **Opt 2** — per-initiative | **Opt 3** — per-plan uplift |
|---|---|---|---|
| Bias corrected | Per-size effort centre **+ spread** | Fan-out × size-mix **joint** + correlation | Whole-system optimism, incl. **scope growth** |
| Data needed | Realized PM per epic, by size (✅ *have it* — the ADR-0026 dataset) | Realized PM per initiative (derivable from epic actuals) | Paired **planned vs actual** per quarter (❌ likely not captured today) |
| Robust at small n | **1c yes** (bootstrap ratios); 1a no | Medium — needs enough initiatives per stratum | Weak — few quarters = few data points |
| Composes with current MC | **Drop-in** — one multiply in the hot loop | Replaces the inner epic loop | Wraps the whole Run (orthogonal) |
| Keeps t-shirt-size lever | ✅ | ❌ (loses per-size sampling) | ✅ (untouched) |
| Captures unknown-unknowns | ❌ | Partially (if actuals include unplanned epics) | ✅ |
| Interpretability | High ("XL effort is 1.3× our band, ±spread") | High ("an initiative like this ran X PM") | Highest ("multiply your plan by 1.4×") |
| Implementation cost | **Low** | Medium | Low–medium (needs a new data input) |
| Re-opens ADRs | [0007](docs/adr/0007-lognormal-effort-distribution.md), [0026](docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md) | [0006](docs/adr/0006-monte-carlo-with-bootstrapped-sizes.md), [0007](docs/adr/0007-lognormal-effort-distribution.md) | New ADR (new input + output surface) |

### Recommendation — a layered path, not a single pick

1. **Now: Option 1c.** It restores the estimation-error *spread* the model is missing, reuses data
   already in hand, drops into one line of the hot loop, and slots beside the existing
   synthetic/empirical radio as a third "Empirical (distributional)" mode — a natural extension of
   [ADR-0026](docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md)'s own "future revision"
   note about fitting σ once data supports it.
2. **As data matures: Option 2**, stratified per Category/Team, once each stratum has enough
   realized initiatives to bootstrap honestly. This is where the biggest *tail* accuracy gain lives
   (correlation), and the README already anticipates richer per-team modelling.
3. **In parallel: Option 3 as a validation rail.** Even a handful of planned-vs-actual quarter
   pairs gives an independent uplift to display next to the simulation — the cheapest way to catch
   the case where the bottom-up MC is *systematically* optimistic because of scope growth it
   structurally cannot see.

The three are complementary: 1c fixes per-size spread, 2 fixes joint/correlation structure, 3
catches the unknown-unknowns none of the bottom-up channels can.

### Addendum (2026-06-22) — extending 1c to uncalibrated sizes (2XS / XL / XL+)

As written, 1c samples `effort = sampleLognormal(size) × bootstrapChoice(ratioPool[size])`, and the
ratio pools only exist for the four sizes with Q1 2026 data — `XS, S, M, L`
([index.html:1322](index.html:1322)). `2XS`, `XL`, and `XL+` have **empty** pools, so the multiply
has nothing to draw and 1c is a no-op for exactly the sizes (`XL`) most likely to drive the tail.
[ADR-0026](docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md) handled the same gap by
carrying the synthetic params through for those sizes — algebraically a ratio of **1.0**. This
addendum sketches how to give them 1c's *spread* (and, optionally, its *centre* correction) by
**borrowing the estimation-error distribution across sizes**.

**Borrow the ratio, not the effort.** [ADR-0026](docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md)
rejected neighbour-inheritance — but for the *absolute effort fit*, where deriving an `XL`'s PM
distribution from `L`'s `n=3` is genuinely worse than the synthetic band. The
`actual / synthetic_mean` **ratio** is a different quantity: it measures the *estimation process*,
which plausibly transfers across size buckets far better than effort does. The four observed mean
ratios — `1.39, 1.51, 1.24, 1.36` — sit in a tight band with no monotone trend in size, which is
weak-but-real evidence that a *shared* ratio distribution is a defensible reference class for the
sizes we never measured.

**Two separable benefits, different justification strength.**

- *Spread* — pool it. This is what 1c is for, and it is the safe part: transplant the shape of
  estimation error onto 2XS/XL/XL+, which today carry none.
- *Centre* — a judgment call this addendum resolves toward the pooled mean. ADR-0026's carry-through
  asserts 2XS/XL are **unbiased** (ratio 1.0), yet all four measured sizes underestimate by 24–51%.
  Modelling the unmeasured sizes as the only optimism-free ones is the least defensible option on the
  table; the pooled centre (≈ 1.40×) is a better prior.

**Shrinkage formula (centre).** Shrink each size's mean ratio toward the pooled grand mean `g`, with
weight set by its sample size:

```
B_i = n_i / (n_i + κ)                 # 0 ≤ B_i ≤ 1 — weight on the size's own data
c_i = B_i · r_i + (1 − B_i) · g       # shrunk centre for size i
g   = Σ nᵢrᵢ / Σ nᵢ  ≈  1.40          # epic-weighted pooled ratio (size-weighted: 1.375)
```

`κ` is a pseudo-count — the number of observations' worth of pull toward `g` — formally
`κ = σ²_within / τ²` (within-size ratio variance over between-size variance). A size with
**`n_i = 0` collapses to `B_i = 0`, i.e. `c_i = g`** — exactly the fallback we want for 2XS/XL/XL+:
no data ⇒ adopt the pooled centre, not 1.0.

Worked against the four ratios, with `g = 1.40` and an illustrative `κ = 8`:

| Size | n | raw ratio `r_i` | `B_i` | shrunk centre `c_i` |
|---|---|---|---|---|
| XS | 10 | 1.39 | 0.56 | **1.39** |
| S  | 14 | 1.51 | 0.64 | **1.47** |
| M  | 8  | 1.24 | 0.50 | **1.32** |
| L  | 3  | 1.36 | 0.27 | **1.39** |
| 2XS / XL / XL+ | 0 | — | 0.00 | **1.40** (= g) |

Shrinkage pulls the noisy outliers in — `S` (1.51, n=14) eases to 1.47, `M` (1.24, n=8) lifts to
1.32, and `L`'s 1.36 barely moves because it already sits near `g`. The pull strengthens as `κ`
grows (`κ=4` → 1.39 / 1.49 / 1.29 / 1.38; `κ=15` → 1.40 / 1.45 / 1.34 / 1.39); every column
converges on 1.40.

**Picking κ — and a green light for pooling.** Estimate `τ²` by subtracting sampling noise from the
observed scatter of the means: `τ² ≈ Var(rᵢ) − σ²_within · mean(1/nᵢ)`. The four means have
`Var ≈ 0.012` and `mean(1/nᵢ) ≈ 0.16`, so for any plausible within-size spread (ratio SD ≈ 0.25–0.30,
`σ²_within ≈ 0.06–0.09` — typical for estimation error) the subtraction drives `τ²` to between ≈ 0.004
and ≈ 0, giving `κ = σ²_within/τ²` of **≈ 12 up to ∞**. Either way `κ` is large relative to the
per-size `n`s — heavy pooling — and at the upper end the between-size differences are statistically
indistinguishable from sampling noise: **the data cannot reject a single shared ratio**, which is
precisely the licence to transplant it onto the unmeasured sizes. (The `κ = 8` worked above is, if
anything, *conservative* — less shrinkage than the data likely warrants. Recompute `κ` for real once
the 35 raw ratios are pulled.)

**Sampling mechanism.** Decompose each observed ratio into centre × residual,
`r_ij = r_i · (r_ij / r_i)`, and pool the **mean-1 residuals** across all four sizes into one shape
pool `R` (≈ 35 values capturing the estimation-error spread). Then for *every* size:

```
effort = sampleLognormal(size) × c_size × bootstrapChoice(R)
```

For calibrated sizes this reproduces 1c with a shrunk centre and a partially-pooled shape — honest
at `n = 3–14`, where a single size's own shape is itself mostly noise. For 2XS/XL/XL+, `c = 1.40`
and the shape comes entirely from `R`: they inherit both the pooled centre and the pooled spread.
*Refinement as data grows:* draw the residual from a `B_i`-weighted mixture of the size's own
residuals and `R`, so well-sampled sizes recover their own shape.

**Caveats.**

- *Extremes are the weak point.* 2XS and XL sit at the ends of the range, where estimation error is
  often worst (tiny tasks rounded up, huge tasks hardest to scope). Pooling extrapolates the interior
  to the tails. Hedge by inflating the residual spread for uncalibrated sizes (scale `R`'s
  deviations-from-1 by ≈ 1.2–1.5) and treat the transplanted spread as a **floor, not a ceiling**.
- *This re-opens [ADR-0026](docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md).* Its
  "carry synthetic through" rule (ratio 1.0 for uncalibrated sizes) is load-bearing; replacing it
  with shrink-to-`g` is a deliberate revision, and it directly implements the §3C
  shrinkage / partial-pooling hygiene point below. Unlike 1c proper, this is **not** a free drop-in.
- *Borrowing is not data.* This buys a defensible prior, not knowledge. The real fix remains the §3C
  ingestion path actually capturing 2XS/XL actuals; until it does, flag those sizes in the **Data
  preview** as *pooled-prior* rather than self-calibrated.

---

## 3. Other improvements for more accurate / trustable outputs

These are largely *independent* of which RCF option you choose, and several matter more for
**trust** than for point accuracy.

### A. Honest interval width (highest priority for a risk tool)

- **Negative-Binomial fan-out.** Poisson forces `variance = mean`; real epic fan-out is
  overdispersed, so the current tails are too tight. [ADR-0008](docs/adr/0008-poisson-epic-count.md)
  already names NB as the upgrade. Fit it from the *same* historical counts (mean + observed
  variance) and the per-initiative sampling discipline is unchanged.
- **Parameter (epistemic) uncertainty.** `λ` and the size mix are point-estimated from `n = 36`
  but consumed as if exact. Wrap each Run in an outer bootstrap (resample the historical epic pool,
  re-fit `λ` and the size mix per outer draw) or use conjugate posteriors (Gamma→NB on `λ`,
  Dirichlet on size mix). This is the single biggest *honesty* fix: it widens the forecast to
  reflect "we only have one quarter of data," which today's intervals silently hide.
- **Cross-unit correlation / common shocks.** Epics within an initiative, and initiatives within a
  quarter, share risks (a platform migration, a key departure). Independent sampling underestimates
  the joint tail. A simple shared multiplicative shock per Run, or Option 2's whole-initiative
  bootstrap, addresses this.

### B. Validation & provenance (turns "plausible" into "trusted")

- **Backtesting / out-of-sample coverage.** The only check today is a *mean* sanity test
  ([tests/verification/0003-sanity-check-engine-mean.md](tests/verification/0003-sanity-check-engine-mean.md)).
  Add a holdout: fit on quarter *t*, forecast quarter *t+1*, and check whether realized total fell
  where predicted (PIT histogram / coverage of the P10–P90 band across several quarters). Calibrated
  intervals are the whole value proposition of a probabilistic forecast — prove they're calibrated.
- **Monte Carlo error bars on the reported percentiles.** At 10,000 iterations, P90 and
  `P(>capacity)` carry sampling noise. Report a ± on each (batch-means or a quick bootstrap of the
  sorted array) so users don't over-read a 2-point P90 move between Runs.
- **Surface effective sample size & a "thin data" warning.** `λ` from 5 initiatives is not `λ` from
  500. The **Team Level tab** already nudges this with its "only N historical initiatives" chip
  ([Historical data toggle](docs/adr/0019-per-team-independent-simulations.md)); generalise it to a
  first-class data-confidence indicator on every forecast.
- **Reproducible seed.** [ADR-0009](docs/adr/0009-custom-seeded-prng.md) notes the machinery exists
  but the seed isn't surfaced. Exposing "Run with seed X" makes any reported number independently
  reproducible — cheap, pure trust.

### C. Reference-class hygiene (sharpens whichever RCF option you pick)

- **Stratification vs pooling.** A per-Team / per-Category / per-KR reference class is more
  homogeneous (more accurate) but has smaller `n` (noisier). Both
  [ADR-0007](docs/adr/0007-lognormal-effort-distribution.md) and
  [ADR-0026](docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md) flag per-team/per-KR
  parameter sets as future work; pair any such split with a shrinkage/partial-pooling default
  (fall back toward the org-wide fit when a stratum is thin — the Team tab's `≤4 initiatives`
  rule is a crude version of this already).
- **Recency weighting.** A 2026-Q4 forecast should weight recent realized quarters more than a
  year-old one. Trivially layered onto any bootstrap (weighted resampling).
- **A realized-effort ingestion path.** All of the above presume realized actuals keep flowing in.
  The empirical table is a one-off hand-fit of Q1 2026 baked into source
  ([ADR-0026](docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md)); the README's "re-run
  the adjustments … when future quarter data is known" note is the manual version of what should
  become a repeatable calibration step (an uploaded actuals CSV → recomputed ratio pools), which is
  also the natural home for Option 1c's ratio pools and Option 3's plan-vs-actual pairs.

### Priority ordering

If I had to sequence: **(1)** parameter uncertainty + NB fan-out (fixes the too-narrow intervals
that undermine every other number), **(2)** Option 1c distributional uplift (restores per-size
spread, cheap, data in hand), **(3)** backtesting/coverage (proves the intervals are now honest),
then **(4)** Option 2 and stratification as the realized-data corpus grows.

---

## 4. One-line summary

The simulator already does RCF on size-mix and per-size *centre*; the highest-leverage next steps
are to make it do RCF on the *spread* too (Option 1c, drop-in), to stop pretending its 36-epic
parameters are exact (parameter-uncertainty + Negative-Binomial), and to *prove* the resulting
intervals are calibrated (backtesting) — with whole-initiative (Option 2) and plan-level
(Option 3) reference classes as the corpus deepens.
