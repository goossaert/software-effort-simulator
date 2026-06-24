# Correctness review — 0023 Error Report tab, Phase 2 (run 02)

- **Task / slug:** 0023 — error-report-tab
- **Feature-phase:** 2 (codes 3–22 + full presentation contract)
- **Stage:** review-correctness (independent, reasoning from the spec — plan + production
  diff, **not** the tests)
- **Run:** 02
- **Date:** 2026-06-24T08:30:00Z
- **test_commit:** `056c7b3a9267d26980019e72b402405503ecadc1`
- **impl_commit:** `6734696366cd4dd58c8df74375dc764df8954c0f`
- **Production diff reviewed:** `git diff 056c7b3..6734696 -- index.html` (the only
  production file; the rest of the diff is backlog/log docs)
- **Inputs:** plan `docs/plans/0023-error-report-tab.md` (Phase 2, former-Phase-3
  sub-section), the production-only diff + full changed `index.html`, `CONTEXT.md`
  (Poisson λ / Severity / Error Report / Data-quality finding), ADR-0037.

## Verdict

**PASS** (correctness clean). No correctness defect tied to a stated requirement survived
the single clean pass and the judge pass. This is the **terminal** review for the task:
`current_phase (2) == total_phases (2)`, so feature-phase 2 — and the whole task —
advances to **`done`**.

This run re-reviews the narrow `056c7b3..6734696` diff: the single production line that
drops the spurious `&& epicSizingDist.length === 0` conjunct from the code-6 `LAMBDA_ZERO`
detector (`index.html:2353`), the exact production-only fix run-01 identified. Run-01
adjudicated this as `suspect-test` (the old guard contradicted I-2, but the then-frozen
AT-5 asserted `1 WARNING`, which *required* the guard). The human chose **Option 1 —
honor the spec** (handover-15), migrating AT-5 to a `2 WARNING` badge; this implement drops
the guard. The previously-blocking contradiction is now resolved on both sides.

## What changed (the whole production delta)

```diff
  // ── Code 6: LAMBDA_ZERO ──────────────────────────────────────────────────────
- if (lambda === 0 && epicSizingDist.length === 0) {
+ if (lambda === 0) {
    findings.push(makeFinding({
      code: 'LAMBDA_ZERO', severity: 'WARNING', category: 'Run parameters',
      locators: [{ kind: 'run', id: 'lambda' }],
      message: 'Poisson λ = 0: all historical in-scope Initiatives had zero sized Epics.',
    }));
  }
```

`LAMBDA_ZERO` is emitted in exactly **one** place (verified: `grep -n LAMBDA_ZERO
index.html` → only the code-6 block), so this `if` is the sole gate on the finding.

## Spec conformance (reasoning from the plan, not the tests)

- **Invariant I-2** (`[test-only]`, plan former-Phase-3 sub-section, line 718):
  **"`LAMBDA_ZERO` ⇔ `lambda === 0`."** The code is now the literal biconditional —
  `if (lambda === 0) push LAMBDA_ZERO`, pushed once, only here, only when `lambda === 0`.
  Holds exactly.
- **Behavioral rule** (plan line 707): **"When Poisson λ = 0 … a WARNING finding is
  emitted."** Satisfied: any completed Run with `lambda === 0` now emits the WARNING,
  regardless of `epicSizingDist`.
- **Counterexample that must NOT pass** (plan line 738): "Reporting `LAMBDA_ZERO` when λ is
  a tiny positive number (must be exact `=== 0`)." The code uses the **exact** `=== 0`
  comparison. `lambda` is computed (`index.html:2210–2212`) as `countArray.length ?
  sum/length : 0`, where `sum` is an integer epic-count total and `length` a positive
  integer — so `lambda === 0` is true **iff** `sum === 0` (or there are no in-scope
  initiatives), with no IEEE-754 rounding (`0 / n === 0` exactly) and never `NaN`. A tiny
  positive λ never equals `0`. The counterexample stays excluded.
- **Code/severity/locator contract** (code table row 6; I-4): `severity: 'WARNING'`,
  `category: 'Run parameters'`, single run-level locator `{ kind: 'run', id: 'lambda' }`,
  routed through `makeFinding` (so I-3/I-4 stay live). Matches AT-1's "a `run` locator
  referencing `λ = 0`".
- **Severity choice** (CONTEXT.md → *Severity*): WARNING = "likely-wrong or
  partially-excluded data". A completed λ=0 Run forecasts ~0 work — likely-wrong data —
  so WARNING is the correct triage level.
- **Advisory / single-source** (ADR-0037; CONTEXT.md → *Data-quality finding*, *Error
  Report*): the report "can never disagree with what the simulation computed." The old
  guard made the report **disagree** (λ=0 was computed but never reported); the fix makes
  it agree. The two existing hard stops are untouched (I-1 advisory invariant intact —
  `runSimulation` reads no `findings`).

## Why the old guard was wrong and the fix is reachable (run-handler ordering)

The run handler (`index.html:5099–5171`) is unchanged and confirms the structural argument:

1. `prepareSimulationData(...)` returns `findings` (now including `LAMBDA_ZERO` when
   `lambda === 0`).
2. **Fatal stop, `index.html:5105`:** `if (epicSizingDist.length === 0) throw …` — aborts
   before any render. So in **every rendered report** `epicSizingDist.length >= 1`.
3. `lambda === 0` is only a `console.warn` (`5114`), **not** a stop — a completed Run can
   have `lambda === 0` and still render.
4. **Report render, `index.html:5171`:** `renderErrorReport(findings.concat(runLevel))`.

The old conjunct required `epicSizingDist.length === 0`, but step 2 guarantees that is
**false** in any rendered report — so the old `LAMBDA_ZERO` branch was **structurally dead**
and the finding could never surface (run-01's analysis). The genuine boundary case
(AT-5: an in-window **orphan Epic** with a recognised size ⇒ contributes to `epicSizingDist`
but not to `epicCounts`, so `epicSizingDist = ['M']` non-empty **and** `lambda === 0`) now
correctly yields ORPHAN_EPIC + LAMBDA_ZERO. The fix is reachable and correct.

The remaining true-degenerate case (`epicSizingDist` empty **and** `lambda === 0`) hits the
fatal stop and never renders — and the `LAMBDA_ZERO` now present in the (un-rendered)
`findings` array is harmless and still I-2-consistent (I-2 is unconditional on
`epicSizingDist`; the fatal stop is a separate, unchanged gate). No spec contradiction.

## Scope note

The diff is a single production line; all other detectors (codes 3–5, 7, 8–9, 10–22) are
byte-unchanged from the state run-01 reviewed clean, so they are out of scope for this
re-review. I-1 (advisory) and the `makeFinding` contract are unaffected by a guard-clause
deletion.

## Machine-readable findings (`backlog-review-correctness/v1`)

```json
{
  "schema": "backlog-review-correctness/v1",
  "verdict": "pass",
  "findings": [],
  "judge_dropped": [
    {
      "candidate": "Dropping the `&& epicSizingDist.length === 0` conjunct could let LAMBDA_ZERO fire in a non-degenerate run.",
      "why_dropped": "`lambda === 0` IS the degenerate condition the spec requires emitting on (I-2: LAMBDA_ZERO ⇔ lambda === 0; behavioral rule; AC-7). Firing whenever lambda === 0 is exactly correct, not a defect."
    },
    {
      "candidate": "Float precision: a tiny non-zero lambda might compare equal to 0 and produce a spurious LAMBDA_ZERO.",
      "why_dropped": "lambda = integer-sum / positive-integer-length; 0/n === 0 exactly in IEEE-754 and any positive sum yields a value > 0 that never equals 0. No precision path to a false positive; the exact `=== 0` comparison satisfies the plan counterexample."
    },
    {
      "candidate": "When epicSizingDist is empty and lambda === 0, findings now carries LAMBDA_ZERO but the report does not render (fatal stop) — possible spec violation.",
      "why_dropped": "I-2 is unconditional on epicSizingDist, so LAMBDA_ZERO belonging to prepareSimulationData(...).findings whenever lambda === 0 is spec-correct. The fatal stop (index.html:5105, unchanged) independently prevents rendering, and the Error Report glossary's 'a fatal Run renders no report' still holds (renderErrorReport is never called on that path). No contradiction."
    }
  ]
}
```
