# Sanity-check the Monte Carlo engine against the per-quarter epic mix

## What you're being asked to do

Verify that the Effort Simulator's Monte Carlo engine produces output
distributions whose mean is consistent with the **inputs derived from the
historical quarter selection**. The hypothesis is straightforward but worth
testing:

> Given a historical pool of epics, the simulated mean total effort for a
> scenario should equal
> `K × λ × E[epic_size_PM]`
> within Monte Carlo noise, where λ is the Poisson rate the engine derives
> from that pool, `E[epic_size_PM]` is the mean of the historical t-shirt-size
> distribution, and K is the engine's per-scenario initiative count.

If that identity holds across multiple historical-quarter selections, the
engine is faithfully reflecting its inputs. If it doesn't, there is a bug or
a hidden bias-correction we need to understand.

> **⚠️ Reminder to the human running this prompt:** attach (or place at
> known paths) the three CSV files listed under "Required inputs" below
> before pasting this prompt to Claude Code. The agent cannot do this work
> without them.

## Background — what the engine does

The simulator (single-file app at [index.html](index.html), function
`prepareSimulationData(histQuarters, targetQuarters)` and the Monte Carlo
loop downstream) builds its inputs in three steps from two CSVs:

1. **Initiatives CSV** (e.g. `initiatives_q3.csv`) — one row per initiative,
   columns include `quarter`, `initiative` key, `category`, `teams`,
   `committed_(yes_or_no)`.
2. **Epics CSV** (e.g. `Epics Q1 Q2 Q3 2026.csv`) — one row per epic, columns
   include `initiative key`, `target_quarter`, `T-shirt size`.
3. **Constant-work CSV** (`constant_work.csv`) — deterministic non-Monte-Carlo
   effort, added on top of the random component per scenario.

The engine then:

- Selects "historical" epics whose `_quarter` ∈ histQuarters (or whose
  initiative-link maps to a historical initiative).
- Computes **λ** = (total in-scope epics with a recognised t-shirt size) /
  (unique in-scope initiative keys).
- Builds an **epic-size pool** = the list of in-scope t-shirt sizes.
- For each Monte Carlo iteration, for each target-quarter initiative (K per
  scenario), draws N ~ Poisson(λ), then draws N sizes from the pool with
  replacement, then maps each size to a PM value via `T_SHIRT_PARAMS` and
  sums. (Look up the exact T-shirt midpoints / sampling logic in
  [index.html](index.html); do not hard-code the values from this document —
  use what the code actually uses.)

So `E[total effort per scenario] = K × λ × E[size]`, where `E[size]` is the
mean of the per-iteration draws from the epic-size pool. With 10 000
iterations this expectation is hit to within a fraction of a percent.

## Why this check matters (the symptom that motivated it)

A user ran the simulator twice with different historical quarters and saw
the probability of exceeding the 270 PM capacity jump dramatically:

| Historical pool        | BK-only P(>270) | BK+ZK P(>270) | BK+Auto P(>270) | BK+ZK+Auto P(>270) |
| ---------------------- | --------------- | ------------- | --------------- | ------------------ |
| Q1 + Q2 2026 (case A)  | 5.1 %           | 20.5 %        | 79.8 %          | 93.4 %             |
| Q1 + Q2 + Q3 2026 (case B) | 17.1 %      | 44.5 %        | 94.5 %          | 98.9 %             |

The corresponding simulated means moved by ~+9 % across all four scenarios
(BK-only: 225.0 → 243.2; BK+ZK: 246.3 → 266.9; BK+Auto: 296.9 → 323.0;
BK+ZK+Auto: 318.4 → 347.0). The hypothesis is that this +9 % matches the
combined shift in the engine's two inputs (λ and `E[size]`) when Q3 2026 is
added to the pool. Quick hand-calc from the CSVs:

- λ:        1.81 → 1.87  (+3 %)
- E[size]:  2.08 → 2.19 PM/epic  (+5.5 %)
- Product:  3.76 → 4.10  (+9 %)  ← matches observed mean shift

This sanity check is to confirm that identity numerically in code, not by
eyeballing screenshots.

## Required inputs (attach or place at known paths)

The agent needs all three of these CSVs to do anything useful. Either attach
them in the chat or confirm they exist on disk and tell the agent the paths:

1. `initiatives_q3.csv` — the initiatives CSV.
2. `Epics Q1 Q2 Q3 2026.csv` — the epics CSV (covers Q1 / Q2 / Q3 2026).
3. `constant_work.csv` — the constant-work CSV.

If the human pasting this prompt has these in `~/Downloads/`, the agent
should still confirm the file paths before running anything.

## The task

Write a small Node script (or a vitest test, whichever is easier to add to
the repo without disturbing the existing test suite) under
`tests/verification/` that:

1. **Loads the three CSVs** using the same parsing path the app uses. The
   simplest way is to import / lift the CSV parsing and column-detection
   functions out of [index.html](index.html). If they are not exported,
   replicate the minimum needed to produce the same `editedInitiatives` /
   `parsedEpics` shapes the engine expects. Do not re-implement the engine —
   call the engine's own `prepareSimulationData` and Monte Carlo functions.
2. **Runs the simulation 4 times** with these historical-quarter selections,
   keeping target quarters and capacity identical to the user's setup:
   - `{Q1 2026}`
   - `{Q2 2026}`
   - `{Q1 2026, Q2 2026}`                ← case A in the bug report
   - `{Q1 2026, Q2 2026, Q3 2026}`       ← case B in the bug report
   Target quarters: `{Q3 2026, Q4 2026, Q1 2027, Q2 2027, Q3 2027}`. Capacity:
   270 PM. Iterations: 10 000. Use the **Empirical Lognormal Parameters**
   path (the default in the UI screenshots).
3. **For each run, compute the predicted mean** for each scenario
   independently of the engine:
   - λ_predicted = (total in-scope sized epics) / (unique in-scope initiative
     keys, counted the same way the engine counts them — see
     `prepareSimulationData` lines around the `epicCounts` Map).
   - E[size]_predicted = mean of `T_SHIRT_PARAMS[size]` over the in-scope
     sized epics. Use the engine's `T_SHIRT_PARAMS` object — do **not**
     hard-code midpoints.
   - K_scenario from `kPerGroup` in `prepareSimulationData`'s `preview`
     (already a per-scenario array).
   - predicted_mean_scenario = K_scenario × λ_predicted × E[size]_predicted
     + constant_work_for_scenario.
4. **For each run, capture the simulated mean** for each scenario from the
   Monte Carlo output (the same `Mean` row the UI shows in its summary
   statistics).
5. **Print a comparison table** with columns:
   `historical_pool | scenario | predicted_mean | simulated_mean | rel_error_pct`
   where `rel_error_pct = (simulated - predicted) / predicted * 100`.
6. **Make the check pass / fail explicitly.** With 10 000 iterations, the
   relative error per scenario should be < 1 % in absolute value if the
   engine matches the model. Use 1.5 % as the assertion threshold to leave
   slack for Monte Carlo noise and any small effects from the
   bias-correction the Empirical Lognormal path applies (if the bias
   correction is meaningful, surface that as a finding rather than padding
   the threshold further — see "Expected outcomes" below).

The script should be reproducible: seed the RNG if the engine accepts a
seed; otherwise run enough iterations that the variance is below the
threshold.

## Expected outcomes

Two acceptable results:

- **Engine is consistent with its inputs.** All rel_error_pct values are
  within ±1 % (or ±1.5 % with the slack). The case A → case B mean shift
  matches `1.87 × 2.19 / (1.81 × 2.08) − 1 ≈ +9.0 %` to within Monte Carlo
  noise. Report this as a green check and we're done.

- **Engine deviates systematically.** rel_error_pct is consistently non-zero
  in one direction across scenarios. Likely causes (investigate in this
  order):
  1. **Empirical bias correction.** The UI labels the Empirical Lognormal
     path as `BIAS-CORRECTED FROM Q1 2026 ACTUALS`. Find that correction in
     the engine code, describe what it does, and compute the predicted mean
     *with* the correction applied. The corrected prediction should match
     the simulated mean — if it does, the engine is fine and the simple
     `K × λ × E[size]` identity just doesn't account for the bias correction.
  2. **Standalone-epics path.** `prepareSimulationData` counts initiative
     keys discovered only in the epics CSV (the `// initiative from
     standalone epics file` comment, around line ~1905). Make sure your
     hand-rolled `λ_predicted` uses the same union.
  3. **Sampling with vs without replacement** in the epic-size pool, and
     whether the engine fits a lognormal to the pool rather than sampling
     directly. Read the Monte Carlo loop and reconcile.

If you find a real deviation (i.e. category 1 doesn't explain it), produce
a one-paragraph diagnosis of the source and stop there — do NOT change
engine code in this task. The point of this script is purely diagnostic.

## Deliverables

- The new script / test under `tests/verification/`, runnable with a single
  `node …` or `npx vitest run …` invocation.
- The printed comparison table for the 4 historical-pool selections × 4
  scenarios = 16 rows.
- A short markdown summary (could be at the bottom of the script as a
  comment, or a separate `.md` next to it) stating whether the engine
  passed the check, and if not, which of the three causes above was
  responsible.

## Out of scope

- Do **not** modify engine code. This is a verification task; any fix
  belongs in a separate change with its own justification.
- Do **not** touch the existing test files. Add a new file.
- Do **not** introduce a new dependency for CSV parsing; the existing
  parser in [index.html](index.html) is sufficient (lift it or read it
  with `fs.readFileSync` and split manually if needed).
