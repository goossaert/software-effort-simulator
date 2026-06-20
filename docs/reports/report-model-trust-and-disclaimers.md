# Trusting the Simulator's Outputs — Data Conditions, Quality Levers, and Disclaimers

*How the Monte Carlo actually consumes your data, what your EMs'/POs' low confidence in t‑shirt estimates does and does not affect, and the disclaimers needed to frame the outputs honestly.*

---

## TL;DR — the one thing to internalize first

**The org‑level and team‑level forecasts do not use the t‑shirt size your EMs/POs assign to a *future* epic.** When you forecast a target quarter, the engine takes only the **count of planned initiatives** (bucketed by Category), and then *regenerates* the epics statistically from the **historical** quarter: it samples how many epics each initiative spawns from `Poisson(λ)` and draws each epic's size by bootstrapping from the **historical** size mix ([index.html:2412](index.html) `runScenario`).

So the precision of forward per‑epic sizing — the thing your team has low confidence in — has **essentially no effect** on the headline numbers. That is partly reassuring and partly a warning:

- **Reassuring:** you do not need accurate forward epic estimates to run this model. You need a representative *history* and an accurate *count of planned initiatives*.
- **The warning:** the model's confidence intervals (P10–P90, P(exceed capacity)) measure only the *sampling* spread of the model's own assumptions. They do **not** capture estimation error, scope creep, dependencies, capacity loss, or unplanned work. And the one place the model was checked against reality — the Q1 2026 calibration — shows realized effort ran **24–51% higher** than the model's default ([index.html:1315‑1319](index.html)). Treat the default ("Synthetic") outputs as *optimistic*, and treat the spread as *narrower than reality*.

The rest of this document makes both points precise and gives you ready‑to‑paste disclaimers.

---

## 1. What the model actually consumes (and what it ignores)

A single **Run** produces, per Group/Scenario, a distribution of total effort. Here is exactly what feeds it:

| Input the engine uses | Source | How it enters | Confidence‑sensitive? |
|---|---|---|---|
| **K** = number of target‑quarter initiatives, per Category group | Initiatives CSV, target quarter | Counted directly ([index.html:2108](index.html)) | **Yes — count & categorization must be right** |
| **λ** = mean epics per initiative | **Historical** quarter epics ÷ initiatives ([index.html:2091](index.html)) | Poisson draw per initiative | Yes — depends on historical completeness |
| **Size mix** (bootstrap pool) | **Historical** epic t‑shirt sizes ([index.html:2097‑2105](index.html)) | Uniform draw with replacement | Yes — depends on historical sizing habits |
| **Size → effort** map | `T_SHIRT_PARAMS` (synthetic) or `T_SHIRT_PARAMS_EMPIRICAL` ([index.html:1298, 1322](index.html)) | Lognormal draw | **Yes — this is the calibration** |
| **Constant work** effort | Constant Work CSV, target quarter | Deterministic point value, added after sampling ([index.html:1863](index.html)) | Yes — but only as a fixed shift |
| **Capacity** | Sidebar input (default 120 PM) | Threshold for P(exceed) | Yes — must be true net capacity |
| **Iterations** | Sidebar (default 10,000) | Monte Carlo resolution only | No — affects noise, not bias |

**What the engine never uses:**

- **The t‑shirt size of any *future* (target‑quarter) epic.** Future epics are not read into the forecast at all; they are invented by the Poisson + bootstrap process. The *only* path where a forward‑authored size becomes effort is **Constant work**, and there it is a deterministic point estimate (the lognormal mean `e^(μ+σ²/2)`), never sampled ([CONTEXT.md "Constant work"](CONTEXT.md)).
- **Anything about *which* epics, dependencies between them, or their order.**

> **Reframing for your EMs/POs:** their discomfort is about *forward epic sizing*. For this tool, forward epic sizing precision is **not** a driver of the org/team forecast. What you actually need from forward planning is three things: **(1)** a complete and correctly‑*counted* list of planned initiatives, **(2)** the right **Category** on each (it decides which scenario/Group an initiative lands in), and **(3)** accurate **Constant work** sizing (because that part *is* taken at face value). Redirect estimation energy there.

---

## 2. What your confidence intervals do — and do not — mean

The spread in the output histogram comes from exactly three sources, all *internal* to the model:

1. **Count variance** — `Poisson(λ)` epics per initiative.
2. **Mix variance** — which historical sizes get bootstrapped.
3. **Within‑size effort variance** — the lognormal `σ` for each size.

That is the entire universe of uncertainty the model represents. **Everything below is invisible to it**, which means the true predictive interval is wider than what the tool prints:

- **Estimation / classification error** — an epic that should have been an `L` recorded as `M`. The model treats every historical size label as ground truth.
- **Scope creep, rework, discovery** — the model samples each epic's effort once, up front; nothing grows. (ADR‑0007 even notes "every engineer has seen an XS turn into a multi‑week saga" — but the model doesn't.)
- **Dependencies & correlated overruns** — epics and initiatives are assumed **independent** (ADR‑0008 samples Poisson *per initiative* precisely to keep them independent). In reality, when one thing slips, related things slip together, which fattens the real tail far beyond the model's.
- **Capacity uncertainty** — capacity is a single fixed line. Sick leave, attrition, incident firefighting, onboarding, and re‑orgs are not modeled.
- **Unplanned work** — incidents and urgent asks that never became an initiative are absent by construction.
- **Non‑stationarity** — the model assumes next quarter statistically resembles the historical quarter you selected. Team growth, a changed product area, or a different work mix breaks that assumption silently.

### The measured optimism (the most important single fact)

The empirical‑calibration block is the only place the model has been checked against reality. Against Q1 2026 actuals (`n = 36` epics), realized effort exceeded the default synthetic mean for **every size that had data** ([index.html:1315‑1319](index.html)):

| Size | n (Q1) | actual ÷ predicted |
|---|---|---|
| XS | 10 | **1.39×** |
| S | 14 | **1.51×** |
| M | 8 | **1.24×** |
| L | 3 | **1.36×** |

Unweighted, that is roughly **+37% effort vs. the default model**. Practical consequence: **a P50 read off the default ("Synthetic") mode is closer to a real‑world P25–P35.** The "Empirical parameters" mode corrects the *center* of each size by this ratio — but note three caveats that limit how far you can trust even the corrected numbers:

1. It **only shifts the center (μ), never the spread (σ)** — by deliberate design, because per‑size samples were too thin to refit `σ` ([ADR‑0026](docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md)). So even corrected, the intervals are no wider.
2. It is based on **one quarter, `n = 36`, with cells as small as `n = 3` (L)** and **zero** data for `2XS`, `XL`, `XL+` (those carry the optimistic synthetic values through unchanged).
3. The toggle is **ephemeral** — it resets to the optimistic "Synthetic" default on **every page reload** ([ADR‑0026](docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md)). It is very easy to present synthetic‑mode numbers by accident.

### The spread is narrowest exactly where reality is widest

The per‑size `σ` *decreases* as size increases — `σ` is 0.43 for XS but only 0.16 for XL and **0.037 for XL+** ([index.html:1298‑1306](index.html)). That means the model is *most* confident about its biggest, riskiest epics (an XL+ is treated as known to within ±5%), which is the opposite of how estimation actually behaves. If your historical mix contains large epics, the model under‑represents their true variability.

---

## 3. Conditions necessary on the data to trust the outputs

Treat these as a pre‑Run checklist. Several failure modes here are **silent** — the tool produces a confident‑looking number anyway.

### A. Representativeness & stationarity (the load‑bearing assumption)
- The **historical quarter(s) you select must resemble the target quarter** in team size, work type, and process. The forecast is "next quarter looks like last quarter, statistically." If the team grew, re‑orged, or shifted product area, the forecast is biased and nothing warns you.
- Prefer **multiple historical quarters** when available, to average out a single anomalous quarter.

### B. Sufficiency of historical data
- **λ denominator:** you need enough historical initiatives that the average epics‑per‑initiative is stable. A handful of initiatives gives a brittle λ. (The Team Level tab already flags this: it recommends org‑wide parameters when a team has ≤ 4 historical initiatives — [CONTEXT.md "Historical data toggle"](CONTEXT.md).)
- **Bootstrap pool:** a small historical size pool makes the size mix brittle. Per ADR‑0006 this is intentional — a thin pool *should* produce a visibly unstable forecast — but you must read that instability as "low trust," not noise to average away.
- An **empty bootstrap pool aborts the Run** ([index.html:4556](index.html)); a nearly‑empty one does not, and is the dangerous case.

### C. Cleanliness — the silent‑drop traps
- **T‑shirt sizes must be one of the seven recognized labels** (`2XS, XS, S, M, L, XL, XL+`). A typo or an unmapped size is **silently dropped** from both λ and the bootstrap pool ([index.html:2088, 2104](index.html)); for Constant work it silently contributes **0 PM** ([CONTEXT.md "Constant Work CSV"](CONTEXT.md)). This shrinks your forecast without warning.
- **Epic → initiative linkage must be intact.** An epic that neither carries an in‑scope `quarter` tag nor links to an in‑scope initiative is excluded from λ ([index.html:2081‑2089](index.html)). **Orphan epics** (empty parent) are explicitly unhandled (README, CONTEXT).
- **A historical quarter with initiatives but no loaded epics** has its initiatives excluded from the λ denominator ([index.html:2061‑2076](index.html)) — make sure you actually loaded epic data for every historical quarter you select.
- **Duplicate initiatives or duplicate quarters** are unhandled (README) and will distort counts.

### D. Completeness & correctness of the target‑quarter plan
- Because **K is a direct count**, the target initiative list must be **complete** (missing initiatives → under‑forecast) and **correctly Categorized** (Category decides which Group/Scenario an initiative counts toward — [CONTEXT.md "Scenario"](CONTEXT.md)).
- **Constant work** is taken at face value as deterministic effort — its sizes must be as accurate as you can make them, since this is the one input the model does *not* hedge.

### E. Calibration freshness
- If you rely on **Empirical** mode, remember it is anchored to **Q1 2026 only**. Re‑fit it as each quarter's actuals land (README explicitly lists this as the plan). Until then, sizes with no Q1 data (`2XS/XL/XL+`) are uncorrected and optimistic.

### F. Capacity integrity
- **Capacity must be true *net available* person‑months** — actual delivery capacity after leave, on‑call, meetings, hiring ramp, and support load — not nominal headcount × months. `P(effort > capacity)` is only as meaningful as this number. Default is 120 PM; do not ship the default.

### G. Monte Carlo resolution (minor)
- Keep iterations at the default 10,000 or higher; below that, tail percentiles wobble. This affects *noise*, not *bias* — it cannot fix any of A–F. The tool deliberately does not report P95/P99 because they are MC‑noisy at default iterations ([ADR‑0012](docs/adr/0012-percentile-summary-and-probability-of-exceedance.md)).

---

## 4. What you can do to improve output quality (ranked by leverage)

1. **Calibrate the whole forecast against actuals — the single highest‑leverage move.** Run the model *retrospectively*: feed it a past quarter's initiative count, run the forecast, and check where that quarter's **actual** total effort fell on the predicted distribution. Near P50? In the body? Out in the tail? Repeat for every quarter you have. This validates the model at the **aggregate** level — which is the only level that matters for a capacity decision — and it completely sidesteps the per‑epic estimate debate. If actuals keep landing above P75, your model is optimistic and you have the number to prove it.

2. **Default to Empirical mode and keep re‑calibrating.** It already corrects the +24–51% center bias for XS/S/M/L. As Q2/Q3 actuals arrive, re‑fit `T_SHIRT_PARAMS_EMPIRICAL` (and extend it to `2XS/XL/XL+`). Build the habit of switching it on every session, since it resets to the optimistic default on reload.

3. **Widen `σ` from realized variance once you have the data.** Today `σ` is fit to documented bands, not measured spread, and ADR‑0026 kept it fixed only because samples were thin. Once per‑size `n` supports it, re‑fit `σ` from actuals — it will almost certainly widen (especially L/XL), making the intervals honest. This directly addresses "the bands are too narrow."

4. **Apply an explicit capacity haircut, or model capacity as a distribution.** The cheapest honest fix: reduce the capacity line by your historical "lost capacity" fraction (incidents, leave, attrition). Better: run the forecast at several capacity values and report the range.

5. **Run sensitivity / scenario sweeps instead of a single number.** Re‑run with λ ±20%, with a deliberately heavier size mix, and across single vs. multiple historical quarters. If the P(exceed) verdict flips under plausible perturbations, that *is* the finding — report the range, not a point.

6. **Account, qualitatively or with a buffer, for what the model omits** — dependencies, correlated slippage, scope creep, unplanned/incident work. None are in the model; a flat risk buffer on top is more honest than pretending they're zero.

7. **De‑prioritize forward per‑epic sizing.** Counterintuitive but true for *this* model: forward epic sizes don't drive the org/team forecast (§1). Spend that estimation effort on (a) getting the **count and Category** of planned initiatives right, (b) keeping **historical** data clean and recognized, and (c) **Constant work** sizing. Tell your EMs/POs their low confidence in forward epic sizing is largely moot here — which should reduce, not increase, their anxiety about the outputs.

8. **Communicate the distribution, never the point.** Lead with `P(effort > capacity)` and the P10–P90 range; avoid quoting P50 as "the plan." The tool's own risk tiers (green ≤ 25%, orange ≤ 50%, red > 50% — [ADR‑0013](docs/adr/0013-three-tier-risk-colouring.md)) are the right unit of communication.

---

## 5. Disclaimers to attach to the outputs

Ready to paste under any chart, deck slide, or exported result.

### Headline banner (always show this)

> **This is a probabilistic planning aid, not a prediction.** The numbers show how planned work *could* fall out **if the coming quarter behaves statistically like the historical quarter used to calibrate the model.** They are calibrated to historical patterns, not to the specific epics in this plan. Use the *probability of exceeding capacity* and the *P10–P90 range* — never a single number — to inform decisions.

### The specific caveats (tie each to the relevant decision)

1. **Outputs are based on historical patterns, not on this quarter's estimates.** The forecast is driven by the *count* of planned initiatives plus historical epic‑count and size patterns. **The t‑shirt sizes assigned to upcoming epics are not used** in the org/team forecast. So low confidence in forward epic estimates does *not* undermine these numbers — but accuracy of the **initiative count and Category** does.

2. **The model is known to be optimistic.** The only calibration against actuals (Q1 2026) showed real effort running **24–51% above** the default model. Unless "Empirical" mode is active, **add ~30–40% mentally** to central estimates. A default‑mode P50 is roughly a real‑world P25–P35.

3. **The stated range is narrower than reality.** The intervals capture only count, mix, and within‑size sampling variation. They **exclude** estimation error, scope creep, rework, dependencies between teams/epics, staff availability, and unplanned/incident work. **True uncertainty is wider** than shown — especially for large epics, where the model is artificially over‑confident.

4. **Valid only if the future resembles the past.** If the team's size, composition, process, or type of work has changed since the historical quarter, these numbers are biased and should be re‑based on a more representative period.

5. **Capacity is an assumption, not a measurement.** `P(effort > capacity)` is only as good as the capacity figure entered. It should reflect **net available** delivery capacity (after leave, on‑call, meetings, ramp‑up), not nominal headcount.

6. **Silent data gaps may have shrunk this forecast.** Unrecognized t‑shirt sizes, orphan epics, missing epic data for a selected quarter, and duplicate rows are **dropped without warning**. Confirm the Data preview's initiative/epic counts match what you expect before trusting the result.

7. **Calibration is thin and dated.** The empirical correction rests on 36 Q1‑2026 epics (as few as 3 for size L) and **no data** for 2XS/XL/XL+. It will improve as more quarters are realized.

### "What this number is NOT" (good for a footer)

> This is **not** a delivery commitment, **not** a deadline, **not** a per‑project estimate, and **not** a statement about any specific epic. It is the distribution of *aggregate* quarterly effort implied by your historical data and your planned initiative count, under the assumptions above.

---

## Appendix — where each claim lives

| Claim | Location |
|---|---|
| Forecast loop: Poisson count + bootstrap size + lognormal effort | [index.html:2412‑2426](index.html) `runScenario` |
| Forward epic sizes not used; K is a direct count of target initiatives | [index.html:2108‑2109](index.html); [CONTEXT.md "Target quarter"](CONTEXT.md) |
| λ computed from historical epics ÷ initiatives | [index.html:2091‑2094](index.html); [ADR‑0008](docs/adr/0008-poisson-epic-count.md) |
| Bootstrap pool built from historical sizes only | [index.html:2097‑2105](index.html); [ADR‑0006](docs/adr/0006-monte-carlo-with-bootstrapped-sizes.md) |
| Synthetic lognormal params + decreasing σ with size | [index.html:1298‑1306](index.html); [ADR‑0007](docs/adr/0007-lognormal-effort-distribution.md) |
| Empirical bias 1.24–1.51×; μ‑shift only, σ fixed; ephemeral toggle | [index.html:1315‑1330](index.html); [ADR‑0026](docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md) |
| Constant work = deterministic, taken at face value | [index.html:1863‑1897](index.html); [CONTEXT.md "Constant work"](CONTEXT.md) |
| Unrecognized sizes / unlinked epics silently dropped | [index.html:2088, 2104](index.html) |
| Independence of initiatives/epics (no dependencies) | [ADR‑0008](docs/adr/0008-poisson-epic-count.md) |
| Percentiles reported; no P95/P99; risk tiers | [ADR‑0012](docs/adr/0012-percentile-summary-and-probability-of-exceedance.md), [ADR‑0013](docs/adr/0013-three-tier-risk-colouring.md) |
| Capacity default 120 PM; iterations default 10,000 | [CONTEXT.md "Capacity"/"Iteration"](CONTEXT.md) |
| Orphan epics, duplicate initiatives/quarters unhandled | [README.md](README.md) |
