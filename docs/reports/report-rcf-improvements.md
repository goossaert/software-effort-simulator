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
