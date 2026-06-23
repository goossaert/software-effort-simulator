# Correctness review — 0023 Error Report tab, Phase 2 (run 01)

- **Task / slug:** 0023 — error-report-tab
- **Feature-phase:** 2 (codes 3–22 + full presentation contract)
- **Stage:** review-correctness (independent, reasoning from the spec — plan + production
  diff, **not** the tests)
- **Run:** 01
- **Date:** 2026-06-23T21:08:01Z
- **test_commit:** `57b38dc23c39a46a0666a0736cf3466ed3cbf47e`
- **impl_commit:** `cbbabc6b64d749e4eff7fde0d173b32ee1b6d304`
- **Production diff reviewed:** `git diff 57b38dc..cbbabc6 -- index.html` (the only
  production file; the rest of the diff is backlog/log docs)
- **Inputs:** plan `docs/plans/0023-error-report-tab.md` (Phase 2), the production-only
  diff + full changed `index.html`, `CONTEXT.md`, ADR-0037.

## Verdict

**BLOCKED — `suspect-test`.** One correctness deviation survived the single pass and the
judge pass: the `LAMBDA_ZERO` detector (code 6) is guarded so it can never surface in a
rendered Error Report, contradicting the plan's stated `LAMBDA_ZERO ⇔ lambda === 0`
invariant and behavioral rule. The fix is production-only and trivial (drop the
`&& epicSizingDist.length === 0` guard) — **but** a committed, GREEN acceptance test
(AT-5, `0023-phase-2-acc-presentation.test.js`) requires that guard, so production cannot
satisfy **both** the spec and the frozen test. Per `stage-review-correctness` Step 5b this
is a **suspect test** (flag a human; never routed to `implement`), not a production FAIL.

This is the deviation the integrity review (`…phase-2-review-01.md`) explicitly handed to
this stage to adjudicate.

## The finding (the spec deviation)

**`LAMBDA_ZERO` is unreachable / suppressed in exactly the completed run it must warn on.**

- **Location:** `index.html`, `prepareSimulationData` — code-6 block:
  ```js
  if (lambda === 0 && epicSizingDist.length === 0) {
    findings.push(makeFinding({ code: 'LAMBDA_ZERO', severity: 'WARNING', … }));
  }
  ```
- **Stated requirement violated** (plan Phase 2, former-Phase-3 sub-section):
  - `[test-only]` invariant: **"`LAMBDA_ZERO` ⇔ `lambda === 0`."**
  - Behavioral rule: **"When Poisson λ = 0 … a WARNING finding is emitted."**
  - AC-7 / code-table row 6 (`LAMBDA_ZERO` · WARNING · Run parameters); ADR-0037 — the
    report is for **completed** (non-fatal) runs.
- **Why the guard is wrong (domain reasoning):**
  - The engine throws the only fatal stop when `epicSizingDist.length === 0`
    (`index.html` run handler, ~5105), **before** `renderErrorReport` (~5171). So in any
    *rendered* report `epicSizingDist.length > 0` — which makes the guard
    `lambda === 0 && epicSizingDist.length === 0` **structurally unsatisfiable** in a
    rendered report. The `LAMBDA_ZERO` finding is therefore **dead code**: it can never be
    shown to a user.
  - `lambda === 0` with `epicSizingDist.length > 0` **is reachable** in a completed run:
    an in-window **orphan Epic** (blank `_initiative_key`, recognised size) is skipped in
    the `epicCounts` loop (`!link` ⇒ contributes 0 to λ) but **passes** the
    `epicSizingDist` loop (gated only on `!inScope`), so `lambda === 0` while
    `epicSizingDist = [size]`. This is a genuinely degenerate forecast — Poisson(0) draws
    0 epics per initiative ⇒ the epic-derived effort is ~0 regardless of the bootstrap
    pool — exactly the case `LAMBDA_ZERO` exists to warn on. The guard suppresses it.
  - `CONTEXT.md` → **Severity** classifies a λ=0 degenerate run as a `WARNING`
    ("likely-wrong … data"); the spec assigns code 6 = `WARNING`. Suppressing it loses a
    true warning.
- **Concrete incorrect behavior:** a Run with initiatives `I-1` (Q1 2026) + `I-2`
  (Q2 2026), historical = `[Q1 2026]`, and one orphan Epic `{_initiative_key:'',
  _tshirt_size:'M', _quarter:'Q1 2026'}` → `lambda === 0`, `epicSizingDist === ['M']`,
  no fatal throw, report renders — **no `LAMBDA_ZERO` finding** despite λ = 0. The strict
  invariant requires one.

## Step 5b — production bug vs. suspect test (high bar)

Sanctioned read of the committed tests that pin this exact behavior (to classify, never
to edit):

- `tests/acceptance/0023-phase-2-acc-run-parameters.test.js` **AT-1** seeds λ=0 via an
  **unrecognised**-size epic (`'XXL'`), so `epicSizingDist` stays **empty** and the guard
  is satisfied — `LAMBDA_ZERO` fires. AT-1 passes under **both** the guard and the strict
  rule, so it is **consistent** with the spec (not the suspect test).
- `tests/acceptance/0023-phase-2-acc-presentation.test.js` **AT-5** seeds λ=0 via an
  **orphan** epic with a **recognised** size (`{_initiative_key:'', _tshirt_size:'M',
  _quarter:'Q1 2026'}`), so `lambda === 0` **and** `epicSizingDist === ['M']`, then asserts
  the by-severity badge:
  ```js
  expect(text).toContain('1 ERROR');
  expect(text).toContain('1 WARNING');   // ORPHAN_EPIC only
  expect(text).toContain('1 INFO');
  ```
  The single WARNING is `ORPHAN_EPIC`. Under the strict `LAMBDA_ZERO ⇔ lambda === 0` rule
  a second WARNING (`LAMBDA_ZERO`) fires ⇒ the badge reads `2 WARNING` ⇒
  `toContain('1 WARNING')` **fails**. So AT-5's GREEN assertion **requires** the guard.

**Irreconcilability (the suspect-test bar):** `LAMBDA_ZERO`'s severity is fixed at
`WARNING` (code table, AT-1, I-3) and the strict rule requires it present whenever
λ = 0. AT-5's scenario has λ = 0. Therefore **no** production-only change can both satisfy
the spec invariant and keep AT-5's `1 WARNING` — emitting `LAMBDA_ZERO` necessarily yields
`2 WARNING`. Routing a "drop the guard" fix to `implement` is doomed: it would have to
break a frozen test `implement` may not edit (and the post-stage gate's hermetic re-run
would reject the failing committed test). This meets Step 5b's high bar:

- **Quoted test assertion:** `expect(text).toContain('1 WARNING')` in AT-5, in a Run where
  `lambda === 0` and `epicSizingDist === ['M']` (an orphan Epic with recognised size).
- **Quoted contradicted spec clause:** plan Phase 2 `[test-only]` invariant
  "`LAMBDA_ZERO` ⇔ `lambda === 0`" + behavioral rule "When Poisson λ = 0 … a WARNING
  finding is emitted."

Both are explicit and citable; the contradiction is direct (λ=0 present, `LAMBDA_ZERO`
absent). ⇒ **confirmed suspect test.** Only a human may change a frozen test; the slice
re-enters via `/stage-atdd` after a human approves the resolution.

> **Both GREEN on HEAD (substantiation):** `npx vitest run` of
> `0023-phase-2-acc-presentation.test.js` + `0023-phase-2-acc-run-parameters.test.js`
> → 6/6 passed. The suspect-test assertion is a *committed, GREEN* contract.

### Human decision needed (named so the flag is actionable)

The plan invariant and the frozen test disagree. A human picks the resolution; both are
plausible, and either re-enters via `/stage-atdd`:

1. **Honor the spec (recommended): make `LAMBDA_ZERO` reachable.** Drop the
   `&& epicSizingDist.length === 0` guard so `LAMBDA_ZERO ⇔ lambda === 0`, and **migrate
   AT-5** to expect `2 WARNING` (or seed AT-5 so λ > 0, isolating the presentation
   contract from the degenerate-run signal). This restores the only λ=0 warning a
   completed run can ever show.
2. **Honor the test: amend the plan.** If the team decides a λ=0 run that *did* yield a
   non-empty bootstrap pool should **not** warn, then the `[test-only]` invariant must be
   rewritten away from the strict biconditional (and the dead-code consequence — code 6
   never renders — accepted/justified in ADR-0037). This is a plan/spec change, also a
   human call.

## Other axes — single clean pass (no other surviving defect)

Reasoned from the plan's behavioral rules + invariants + generator domains; all faithful:

- **Codes 3-4, 16** (`EPIC_OUT_OF_SCOPE`/`ORPHAN_EPIC`/`DANGLING_EPIC_LINK`): partition is
  correct (`!link` ⇒ ORPHAN; else out-of-scope ⇒ EPIC_OUT_OF_SCOPE; non-blank link ∉
  `allInitKeys` ⇒ DANGLING), matching I-2's ORPHAN⊕EPIC_OUT_OF_SCOPE and the
  DANGLING/ORPHAN disjointness.
- **Code 5** (`QUARTER_NO_EPICS`): count = initiatives in the quarter (all excluded when
  `!quartersWithEpicData.has(q)`), matching "count of its excluded initiatives."
- **Code 7** (`TOTAL_K_ZERO`): `sum(kPerGroup) === 0` — matches the invariant; reachable in
  a completed run (unlike code 6).
- **Codes 8-9** (`CAPACITY_COERCED`/`ITERATIONS_CLAMPED`): emitted iff `entered !== used`,
  with `used` = the run handler's `parseFloat||120` / clamp — matches the plan's exact
  `(parseFloat(raw)||120) !== parseFloat(raw)` formula and the single-source rule (no
  re-read of `#capacity`/`#iterations` inside the collector).
- **Codes 10-15, 17-18, 19-22**: duplicate-key counts, quarter-norm variants,
  hist∩target overlap, missing key / bad quarter / missing team-or-category, target
  quarter with no initiatives, constant-work-excluded (reuses `getConstantWorkExcluded`),
  forward double-count (`qSet.size >= 2` over distinct normalised target quarters),
  partial-window / multi-quarter-historical, init↔epic quarter mismatch — each matches its
  AT scenario, property, and `.trim()`/detected-column normalisation (I-5).
- **I-1 (advisory):** the diagnostics block only reads engine arrays/Sets and pushes to a
  local `findings`; it assigns no engine value and the return adds only `findings`.
  `MQ_FORWARD_DOUBLE_COUNT` is reported at ERROR without touching `kPerGroup` (DC-5).

## Findings object (machine-readable)

```json
{
  "schema": "backlog-review-correctness/v1",
  "verdict": "blocked",
  "blocked_subtype": "suspect-test",
  "suspect_test": {
    "test_file": "tests/acceptance/0023-phase-2-acc-presentation.test.js",
    "test_assertion": "expect(text).toContain('1 WARNING') — AT-5, in a Run seeding an orphan Epic {_initiative_key:'', _tshirt_size:'M', _quarter:'Q1 2026'} where lambda === 0 and epicSizingDist === ['M']; the single WARNING is ORPHAN_EPIC, so the test requires LAMBDA_ZERO to be suppressed despite lambda === 0.",
    "contradicted_requirement": "docs/plans/0023-error-report-tab.md Phase 2 (former Phase 3): [test-only] invariant 'LAMBDA_ZERO ⇔ lambda === 0' and behavioral rule 'When Poisson λ = 0 … a WARNING finding is emitted'."
  },
  "findings": [],
  "judge_dropped": [
    { "candidate": "CAPACITY_COERCED not emitted for a negative entered capacity (e.g. '-5'): parseFloat('-5')=-5 is truthy ⇒ used=-5=entered ⇒ no finding.", "why_dropped": "Matches the plan's stated formula exactly: CAPACITY_COERCED iff (parseFloat(raw)||120) !== parseFloat(raw); for -5 both sides equal -5. The run actually used -5 (single source of truth, ADR-0037), so no coercion occurred — not a spec violation." },
    { "candidate": "MQ_FORWARD_DOUBLE_COUNT impact reports '~qSet.size× effort' (distinct target quarters) while the engine double-counts per row, so 3 rows across 2 quarters reads '~2×' not '~3×'.", "why_dropped": "The plan pins this finding to '≥2 distinct selected target quarters' (property + AT-1 example wording); the per-row vs per-key unit-consistency bug is explicitly deferred by DC-5. Faithful to the stated contract." },
    { "candidate": "Code 5 (QUARTER_NO_EPICS) trims histQuarters for its iteration set but compares against quartersWithEpicData, which holds raw (untrimmed) histQSet values.", "why_dropped": "histQuarters come from the multi-select getSelected() as canonical labels (no stray whitespace) — the generator domains never produce a divergence; no concrete wrong behavior demonstrable. Out of scope (speculative)." },
    { "candidate": "iters uses parseInt(value) (no radix) in the run handler while enteredIterations uses parseInt(value, 10); a '0x'-prefixed string could differ.", "why_dropped": "The #iterations field is a numeric input; no realistic input reaches the divergence, and the plan's clamp formula is the reference. No concrete incorrect behavior." }
  ]
}
```

## Routing

`blocked: suspect-test` → the loop flags a human immediately (no retry, no advance);
`stage`/`status`/`current_phase`/`retry_count` left unchanged. The slice re-enters via
`/stage-atdd` once a human approves the resolution above. **Never** routed to `implement`.
