---
schema: backlog-handover/v1
task_id: "0024"
produced_by_phase: grill
feature_phase: null
for_next_phase: apply-docs
outcome: success
reason: ""
produced_at: 2026-06-22T18:55:38Z
produced_commit: 209dcafd75389fcb9fb93b8004bc6bc2142a978d
---
## Summary

Grill birthed task 0024: a **third** sidebar **Lognormal Parameters** mode,
"Empirical (distributional)" (radio value `empirical-distributional`), implementing
Option 1c from `docs/reports/report-rcf-improvements.md` (§2 Addendum, 2026-06-22).
The mode keeps the empirical per-size **centre** for calibrated sizes (XS/S/M/L),
applies a pooled grand-mean centre (g = 1.40×) to the three sizes that had no Q1 data
(2XS/XL/XL+), and multiplies every sampled epic effort by a **bootstrapped mean-1 ratio
residual**, injecting the estimation-error **spread** the σ-preserving empirical mode
omits — borrowing that spread across sizes so 2XS/XL/XL+ get it too.

Five decisions were settled with the author: **(1)** the residual pool needs raw
per-epic Q1 ratios (the empirical mode only kept per-size *means*) — the author
provided them as `JIRA_filtered_q1.csv`; **(2)** calibration recipe = **Done-only,
Realized Effort > 0, drop the one XS at 5.7 PM** (ratio ≈ 12, a mis-sized epic) —
this recipe nearly reproduces the existing empirical means, confirming it as the
original recipe; **(3)** calibrated-size **centres** reuse the existing empirical
μ-shifts (continuity) rather than re-deriving or full-pooling; **(4)** the label is
"Empirical (distributional)" / value `empirical-distributional`; **(5)** the
calibration is **baked as constants** (not the CSV, not computed at load), and the
existing two modes stay **bit-for-bit unchanged** including their PRNG draw sequence.
The variance decomposition (τ² ≈ 0, κ → ∞) shows the four calibrated sizes are
statistically indistinguishable from one shared ratio — the empirical-Bayes green
light for borrowing the ratio onto the uncalibrated sizes. Acceptance criteria were
linted (clean — no contradictions, ambiguities, or unaligned one-way doors). apply-docs
must apply the CONTEXT.md glossary additions, create ADR-0038, add the supersession
banner to ADR-0026, then advance to plan.

## Instructions for the next phase (apply-docs)

1. Apply the **## CONTEXT.md edits to apply** verbatim into the repo-root `CONTEXT.md`,
   matching the surrounding glossary house style (bold term, colon, definition, an
   `_Avoid_:` line, bold cross-references, ADR links). Place the new **Empirical
   (distributional) parameters** entry immediately after the **Empirical parameters**
   entry, and **Ratio residual pool** immediately after it.
2. Create the ADR in **## ADRs to create** at
   `docs/adr/0038-empirical-distributional-parameters-mode.md` with the full text given.
3. Apply the small **ADR-0026 supersession-banner edit** in **## ADRs to create**
   (add the ADR-0038 line beside the existing ADR-0035 banner).
4. The mechanical toolchain is already selected (`toolchain.selected: true`) — see
   **## Mechanical toolchain to apply**; record the no-op
   (`toolchain_applied: "already-selected"`) and apply nothing.
5. Advance the task to `stage: plan`, write `handover-02-apply-docs.md`, and hand the
   plan phase the **## Plan logistics** below (lint-cleared AC-* / I-* / DC-*).

## CONTEXT.md edits to apply

Add the following glossary entries to repo-root `CONTEXT.md`, in house style (bold
term, colon, definition, `_Avoid_:` line, bold cross-references, ADR links). These
define every new term the acceptance criteria use, so they MUST land before plan.

Insert immediately **after** the **Empirical parameters** entry (currently ~line 39-41):

> **Empirical (distributional) parameters**:
> A third per-**T-shirt size** parameter mode (beside **Synthetic parameters** and
> **Empirical parameters**), selectable via the **Lognormal Parameters** sidebar radio
> (`<input name="param-mode" value="empirical-distributional">`). It implements Option
> 1c of the RCF report (`docs/reports/report-rcf-improvements.md` §2 Addendum) — see
> [ADR-0038](docs/adr/0038-empirical-distributional-parameters-mode.md). Unlike the
> **Empirical parameters** mode (which corrects only the per-size *centre* and keeps the
> synthetic `σ`), this mode also injects the **estimation-error spread**: each sampled
> **Epic** effort is multiplied by a value drawn uniformly with replacement from the
> **Ratio residual pool**. Per-size *centre*: for the calibrated sizes (`XS`/`S`/`M`/`L`)
> the `μ` equals the **Empirical parameters** `μ` unchanged (continuity); for the sizes
> with no Q1 data (`2XS`/`XL`/`XL+`) the `μ` is shifted by `ln(1.40)` — the pooled
> grand-mean ratio borrowed across the calibrated sizes — *replacing* the synthetic
> carry-through the **Empirical parameters** mode uses for those three sizes (this is the
> part of [ADR-0026](docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md) that
> [ADR-0038](docs/adr/0038-empirical-distributional-parameters-mode.md) supersedes, for
> this mode only). Lives at `T_SHIRT_PARAMS_DISTRIBUTIONAL` + `RATIO_RESIDUALS`. Selecting
> it is *ephemeral* and leaves the **Synthetic parameters** and **Empirical parameters**
> sampling paths — and their PRNG draw sequence — byte-for-byte unchanged (the extra
> residual draw happens only in this mode). Not the page-load default — **Empirical
> parameters** remains the default ([ADR-0035](docs/adr/0035-default-to-empirical-lognormal-parameters.md)).
> _Avoid_: distributional mode, RCF mode, spread mode, Option 1c.

> **Ratio residual pool**:
> The baked array `RATIO_RESIDUALS` (n = 23, mean = 1 by construction) of
> `actual / (per-size mean actual)` residuals pooled across the calibrated **T-shirt
> size**s, used by the **Empirical (distributional) parameters** mode to inject
> estimation-error spread: `effort = sampleLognormal(size) × bootstrapChoice(RATIO_RESIDUALS)`.
> Derived once from the Q1 2026 **Done** epics (Realized Effort > 0, one mis-sized
> `XS`-at-5.7-PM outlier dropped); the same pool is applied to *every* size, so the
> uncalibrated sizes borrow the calibrated sizes' spread — see
> [ADR-0038](docs/adr/0038-empirical-distributional-parameters-mode.md). Because its mean
> is 1, multiplying by a residual preserves each size's centre in expectation while
> widening the per-epic distribution.
> _Avoid_: uplift pool, ratio pool, spread pool, bootstrap pool (which is the pool of
> historical *size labels* — a different thing).

## ADRs to create

### `docs/adr/0038-empirical-distributional-parameters-mode.md`

```markdown
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
```

### ADR-0026 supersession-banner edit

In `docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md`, the file currently opens
with one supersession blockquote (the ADR-0035 banner). Add a second blockquote line directly
after it, so the top reads:

```markdown
> **Superseded in part by [ADR-0035](./0035-default-to-empirical-lognormal-parameters.md)**: the page-load default is now empirical, not synthetic. The ephemeral-toggle / no-persistence decision below still stands.
>
> **Superseded in part by [ADR-0038](./0038-empirical-distributional-parameters-mode.md)**: the "carry the synthetic `(μ, σ)` through for `2XS`/`XL`/`XL+`" decision (paragraph 4 below) is replaced by a pooled grand-mean centre **in the new Empirical (distributional) mode only**. This Empirical mode's carry-through, the two-table structure, the ephemeral toggle, and the μ-shift-only (σ-preserving) calibration all still stand.
```

## Mechanical toolchain to apply

N/A — toolchain already selected (`toolchain.selected: true`, selected 2026-06-21,
searched 2026-06-20). PBT = fast-check + @fast-check/vitest; mutation = N/A (single-file
multi-`<script>` HTML, see ADR-0036); lint = ESLint 9 flat; sast = eslint-plugin-security;
dep_scan = npm audit (wrapped); secret_scan = secretlint; forbidden_matcher = ast-grep;
verify = `npm run verify`. apply-docs records `toolchain_applied: "already-selected"` and
applies nothing.

## Plan logistics

- **slug:** `empirical-distributional-params`
- **user-visible goal:** A third "Empirical (distributional)" option in the sidebar
  **Lognormal Parameters** radio that, when selected and Run, produces a forecast whose
  per-size effort centre matches the Empirical mode for XS/S/M/L (and is 1.40× synthetic
  for 2XS/XL/XL+) **and** carries the estimation-error spread the Empirical mode lacks —
  for every size — while leaving the Synthetic and Empirical modes' results unchanged.
- **out of scope:**
  - Changing the **Synthetic** or **Empirical** modes in any way (values, μ/σ tables,
    RNG consumption). They must reproduce past runs bit-for-bit.
  - Changing the page-load default (stays Empirical — ADR-0035).
  - Re-fitting σ per size, or bootstrapping raw actual PM per size (Options 1a/1b — see
    ADR-0038 "Considered alternatives").
  - Shipping the raw `JIRA_filtered_q1.csv`, or computing the calibration at page-load.
    The two constants are baked, computed once (this grill).
  - Re-rendering the sidebar **T-shirt size reference** panel for the new mode.
  - Surfacing the active mode in the Run output / a "Run config" badge (ADR-0026 future
    revision; not here).
  - Negative-Binomial fan-out, parameter-uncertainty, backtesting, Option 2/3 (separate
    report items).
- **entry point:** the sidebar **Lognormal Parameters** radio group (`index.html:950-961`)
  gains a third `<input name="param-mode" value="empirical-distributional">`; the `change`
  handler (`index.html:4524-4530`) is extended to select the third table **and** swap the
  active sampler (DC-2). The Monte Carlo seam is `runScenario` (`index.html:2412-2426`,
  the `total += sampleLognormal(bootstrapChoice(epicSizingDist))` line at ~2419).
- **relevant files/dirs the plan may inspect:**
  - `index.html` — the whole single-file app. Anchors (HEAD `209dcaf`; line numbers drift,
    re-confirm): synthetic table `T_SHIRT_PARAMS` `1298-1306`; empirical table
    `T_SHIRT_PARAMS_EMPIRICAL` `1322-1330`; `activeParams` binding `1333`;
    `tshirtToPersonMonths` `1341-1345`; `sampleLognormal` `1376-1380`; `bootstrapChoice`
    `1402`; bootstrap-pool build in `prepareSimulationData` `2097-2105`; hot loop
    `runScenario` `2412-2426`; radio markup `950-961`; param-mode `change` handler
    `4524-4530`; `normalizeSize` (~`1561`).
  - `CONTEXT.md` — glossary (with the two new entries above).
  - `docs/reports/report-rcf-improvements.md` — §2 "Option 1c" + the 2026-06-22 Addendum:
    the full design, the shrinkage formula, the worked numbers, and the caveats.
  - `docs/adr/0038-…` (new), `docs/adr/0026-…`, `docs/adr/0035-…`, `docs/adr/0007-…`,
    `docs/adr/0006-…`, `docs/adr/0024-…`, `docs/adr/0009-custom-seeded-prng.md` (the
    seeded PRNG that makes bit-for-bit reproducibility testable).
  - `tests/acceptance/` — existing acceptance tests (`0020-phase-1-engine.test.js`,
    `0020-phase-2-groups-tab.test.js`) as the harness pattern (vitest + jsdom loading
    `index.html`); `@fast-check/vitest` for property tests.
- **acceptance + inner test locations:** acceptance tests under
  `tests/acceptance/0024-phase-<k>-*.test.js`; inner/unit tests co-located per the existing
  layout. Property tests via `@fast-check/vitest`.
- **verify command:** `npm run verify`.
- **phase-count estimate (hint only; plan sets authoritative `total_phases`):** ~2 —
  e.g. (1) add the two baked constants + the third-table/active-sampler mechanism + the new
  sampler path (synthetic-base × bootstrapped residual), gated so the other two modes'
  values + PRNG stream are untouched; (2) the radio UI + `change` handler + `.active`
  toggle + ephemeral reset, plus presentation wiring (constant-work follows the table).

### Baked constants (computed this grill — provenance under "External sources mirrored")

The plan/implement phase MUST use these exact values (do not recompute; the source CSV is
not in the repo):

```js
// μ = empirical for calibrated sizes; synthetic μ + ln(1.40) for uncalibrated (2XS/XL/XL+).
const T_SHIRT_PARAMS_DISTRIBUTIONAL = {
  '2XS': { mu: -1.5079, sigma: 0.3575 }, // no Q1 data; pooled centre 1.40× (synthetic μ + ln 1.40)
  'XS':  { mu: -0.5093, sigma: 0.4286 }, // = empirical (centre 1.39×)
  'S':   { mu:  0.4704, sigma: 0.2703 }, // = empirical (centre 1.51×)
  'M':   { mu:  0.9636, sigma: 0.2703 }, // = empirical (centre 1.24×)
  'L':   { mu:  1.7550, sigma: 0.2703 }, // = empirical (centre 1.36×)
  'XL':  { mu:  2.3310, sigma: 0.1582 }, // no Q1 data; pooled centre 1.40× (synthetic μ + ln 1.40)
  'XL+': { mu:  2.6868, sigma: 0.0372 }, // no Q1 data; pooled centre 1.40× (synthetic μ + ln 1.40)
};
// mean-1 ratio residuals, pooled across XS/S/M/L Done epics (n=23); mean = 1.0000, sd = 0.4327
const RATIO_RESIDUALS = [
  0.3692, 0.4286, 0.5714, 0.5714, 0.5714, 0.7353, 0.7353, 0.7385, 0.8571, 0.8571,
  0.8571, 0.8824, 1.0000, 1.1077, 1.1077, 1.1429, 1.1429, 1.1765, 1.2000, 1.4706,
  1.4769, 1.7143, 2.2857,
];
```

### Acceptance criteria (lint-cleared)

- **AC-1** The sidebar **Lognormal Parameters** group shows a third radio option, label
  "Empirical (distributional)", `<input name="param-mode" value="empirical-distributional">`,
  placed after Synthetic and Empirical. Empirical stays the default-checked option
  (ADR-0035 unchanged). Selecting it toggles the `.active` class onto its label and off the
  others, exactly like the existing two.
- **AC-2** When `empirical-distributional` is selected and a **Run** executes, each sampled
  epic's effort equals a lognormal draw using `T_SHIRT_PARAMS_DISTRIBUTIONAL[size]`'s `(μ, σ)`
  multiplied by one value drawn uniformly with replacement from `RATIO_RESIDUALS`.
- **AC-3** `T_SHIRT_PARAMS_DISTRIBUTIONAL` equals the values baked above: for XS/S/M/L the
  `(μ, σ)` equals `T_SHIRT_PARAMS_EMPIRICAL`'s; for 2XS/XL/XL+ the `μ` equals
  `T_SHIRT_PARAMS[size].mu + Math.log(1.40)` (σ unchanged from synthetic). `RATIO_RESIDUALS`
  equals the 23 values baked above (mean = 1 to 4 dp).
- **AC-4** With a fixed PRNG seed and identical inputs, a **Run** in **Synthetic** mode and a
  **Run** in **Empirical** mode each produce a results array byte-identical to the pre-feature
  app — i.e. neither the sampled values nor the PRNG draw sequence changes. (The new mode does
  not perturb the existing two.)
- **AC-5** In the new mode, for an uncalibrated size (2XS, XL, or XL+) sampled in isolation
  over a large N: (a) the mean per-epic effort ≈ 1.40 × the synthetic-mode mean for that size
  (centre uplift; Empirical mode would be ≈ 1.0×), and (b) the variance of per-epic effort is
  strictly greater than the Empirical mode's lognormal-only variance for that size (spread
  injection; Empirical mode adds none). Use a tolerance band appropriate to N.
- **AC-6** `Object.keys(T_SHIRT_PARAMS_DISTRIBUTIONAL)` equals `Object.keys(T_SHIRT_PARAMS)`
  and `Object.keys(T_SHIRT_PARAMS_EMPIRICAL)` exactly (all seven sizes present in each).
- **AC-7** Selecting the new mode is ephemeral — a page reload resets the radio to **Empirical**
  (no `localStorage` / URL persistence) — and does **not** re-render the sidebar **T-shirt size
  reference** panel.
- **AC-8** With the new mode selected, **Constant work** effort for a size (via
  `tshirtToPersonMonths`) equals `exp(μ_distributional + σ²/2)` for that size — i.e. an
  uncalibrated size's constant work is 1.40× its synthetic mean and a calibrated size's matches
  the Empirical mode; the mean-1 residual does not change the deterministic constant-work value.

### Invariants (author-asserted)

- **I-1** The **Synthetic** and **Empirical** modes are bit-for-bit unchanged versus the
  pre-feature app: for identical seed + inputs the sampled values **and** the PRNG draw sequence
  are identical (the new mode's residual draw is consumed only when the new mode is active).
- **I-2** `mean(RATIO_RESIDUALS) = 1` (to 4 dp), so the new mode preserves each size's centre
  (`exp(μ + σ²/2) × 1`) in expectation while widening its per-epic distribution.
- **I-3** All three parameter tables share an identical key set (I-1 of ADR-0026 extended to
  three tables).
- **I-4** `RATIO_RESIDUALS` is non-empty and every element is > 0, so the new mode's sampled
  effort is always positive.

### Decision constraints (one-way doors, no ADR — plan formalises, does not re-decide)

- **DC-1 (externally-visible identifier):** the new radio's `value` is `empirical-distributional`
  (the test-facing identifier the acceptance/PBT tests assert on); label "Empirical
  (distributional)"; placed last in the **Lognormal Parameters** group; Empirical stays
  default-checked. Ephemeral — not persisted to `localStorage`/URL (ADR-0026/0035), so low-stakes,
  but the value string is fixed as a contract for tests.
- **DC-2 (reproducibility / RNG isolation):** the residual multiply and its RNG draw occur **only**
  in the new mode; the Synthetic/Empirical code paths and their `rng` consumption are untouched
  (enforces I-1). Suggested mechanism: a function-pointer `activeSampler` swapped on radio change
  (mirroring `activeParams`), so the hot loop gains no per-sample branch and no extra draw in the
  other two modes. The plan may pick the exact mechanism but MUST preserve I-1.
- **DC-3 (baked artefact / numeric representation):** the calibration ships as two module-load
  constants — `T_SHIRT_PARAMS_DISTRIBUTIONAL` (7 sizes) and `RATIO_RESIDUALS` (the 23 floats given)
  — declared alongside the existing tables. The raw CSV is NOT committed and the constants are NOT
  recomputed at load (ADR-0026/0001/0002). Recipe + per-size `n` documented in inline comments and
  ADR-0038.
- **DC-4 (default unchanged):** page-load default stays Empirical (ADR-0035); the new mode is
  opt-in via the radio.

### External sources mirrored

- **Q1 2026 calibration dataset** — author-provided `JIRA_filtered_q1.csv` (34 data rows;
  columns incl. `Estimated T-shirt Size`, `Realized Effort`, `Status`). Status: **VERIFIED**
  (parsed + computed this grill, 2026-06-22). The CSV is **not** in the repo; only the recipe
  output (the two baked constants) ships. Recipe: keep `Status = Done` rows with
  `Realized Effort > 0`; drop the one `XS` at 5.7 PM (ratio ≈ 12, mis-sized); ratio per epic =
  `actual / exp(μ_synthetic + σ_synthetic²/2)`; pool residuals = `ratio / (per-size mean ratio)`;
  `n = 23` (XS 5, S 11, M 6, L 1). `g = 1.40` = epic-weighted mean of the four calibrated
  empirical centres `(10·1.39 + 14·1.51 + 8·1.24 + 3·1.36)/35 ≈ 1.40`. NOTE the dataset does not
  reproduce the Empirical mode's baked means exactly under any filter (it is a later/different
  extract); this recipe nearly reproduces them (XS 1.43, S 1.59, M 1.23, L 1.36 vs baked
  1.39/1.51/1.24/1.36), which is why the calibrated *centres* are taken from the existing
  Empirical table, not re-derived (decision 3 of ADR-0038).
- **Design source** — `docs/reports/report-rcf-improvements.md` §2 "Option 1c" + 2026-06-22
  Addendum. Status: **VERIFIED** (in repo).
- **Code anchors** cited above — **VERIFIED** against `index.html` at HEAD `209dcaf` (line
  numbers approximate; re-confirm at plan/implement).
- No third-party API / protocol / upstream is mirrored.

## Files the next phase MUST read

- `docs/backlog/0024-empirical-distributional-params/handover-01-grill.md` (this file) — the
  prepared CONTEXT.md edits, ADR-0038 text + ADR-0026 banner edit, the baked constants, and the
  lint-cleared AC-* / I-* / DC-*.
- `docs/reports/report-rcf-improvements.md` — §2 "Option 1c" and the 2026-06-22 Addendum: the
  design rationale, the shrinkage formula, the worked numbers, and the extremes caveat.
- `docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md` — the two-table / `activeParams` /
  μ-shift-only / σ-preserving / carry-through decisions this mode builds on and partly supersedes.
- `docs/adr/0035-default-to-empirical-lognormal-parameters.md` — the empirical default (must stay).
- `docs/adr/0009-custom-seeded-prng.md` — the seeded PRNG that makes the bit-for-bit
  reproducibility test (AC-4 / I-1) writable.
- `docs/adr/0007-lognormal-effort-distribution.md` — the synthetic `(μ, σ)` derivation the
  distributional base + the uncalibrated `ln(1.40)` shift build on.
- `CONTEXT.md` — the glossary, including the two new entries (Empirical (distributional)
  parameters; Ratio residual pool).
- `index.html` — the single-file app; the anchors under "relevant files/dirs" are where the
  third table, the active-sampler swap, the new sampler path, and the radio live.

## Context the next phase needs

- The five settled decisions (raw ratios provided; Done-only + drop-outlier recipe; calibrated
  centres = empirical; label/value `empirical-distributional`; baked constants + bit-for-bit
  reproducibility of the other two modes) are recorded in ADR-0038 + DC-1..4 — plan must honour
  them, not re-open them.
- The PRNG-isolation constraint (DC-2 / I-1) is the single highest-risk part: a naive
  implementation that draws a residual in the shared sampler path would shift the PRNG stream and
  silently break every past Synthetic/Empirical re-simulation. The function-pointer sampler swap
  is the recommended way to keep the other two modes' draw sequence byte-identical.
- `κ → ∞` (from the variance decomposition) is used only as the *licence to borrow the ratio onto
  the uncalibrated sizes*, NOT to flatten the calibrated centres — those are kept per-size for
  continuity (ADR-0038 decision 4 vs the rejected full-pool alternative).
- The lint over AC-1..8 / I-1..4 / DC-1..4 found **no** defects (no contradictions, ambiguities,
  undefined terms, or unaligned one-way doors): AC-4/I-1 pin the reproducibility one-way door via
  DC-2; the radio value identifier via DC-1; the baked numeric representation via DC-3; no
  persisted keys (ephemeral, DC-4 / ADR-0026).
- Task id is **0024** and the ADR is **0038** (both author-chosen): 0023 is the next free backlog
  number but is taken by the in-flight `error-report-tab` task, which has already reserved ADR-0037
  in its unapplied grill handover — so 0024/0038 avoid the collision.

## Definition of done (for apply-docs)

- The two glossary entries (**Empirical (distributional) parameters**, **Ratio residual pool**)
  are present in repo-root `CONTEXT.md`, in house style, after the **Empirical parameters** entry.
- `docs/adr/0038-empirical-distributional-parameters-mode.md` exists with the text above.
- `docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md` carries the added ADR-0038
  supersession-banner blockquote beside the existing ADR-0035 one.
- No toolchain install/changes (already selected); `toolchain_applied: "already-selected"` recorded.
- `index.md` advanced to `stage: plan` with `handover-02-apply-docs.md` written, carrying the Plan
  logistics (the baked constants + AC-* / I-* / DC-*) forward to the plan phase.
