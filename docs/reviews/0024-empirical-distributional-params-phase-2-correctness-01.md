# Correctness review — 0024 Empirical (distributional) parameters · Phase 2 · run 01

- **Slug:** empirical-distributional-params
- **Feature-phase:** 2 (UI slice — the third `empirical-distributional` radio + the tri-state `param-mode` `change` handler)
- **Stage:** review-correctness (independent; reasons from the **spec**, tests excluded)
- **Run:** 01
- **Date:** 2026-06-23
- **test_commit:** `f9ceb3cebd76215160d1d8c8dbdaccbd04abcb04` (atdd p2 — `handover-09-atdd-p2.md`)
- **impl_commit:** `57876478564e78cd8a32589e7e5db8133c3b698b` (implement p2 — `handover-10-implement-p2.md`)
- **Diff reviewed:** `test_commit..impl_commit`, production-only (`index.html`, +20/-4); tests excluded from reasoning.
- **Cross-family second pass:** disabled (`review_correctness.cross_family.enabled: false`) ⇒ this single Claude pass owns the verdict.

## Verdict: **PASS** (zero findings)

A single clean pass over the Phase-2 spec (plan behavioral rule + invariants + DoD +
Oracle strategy + PBT-4 + counterexamples + the cited ADRs + `CONTEXT.md` glossary) and
the production diff produced **zero** candidate findings; the skeptical judge pass
dropped nothing; Step 5b (suspect-test) was not reached. The implementation is a
faithful, minimal realisation of the tri-state selector rule.

## What was reviewed (the production change)

1. **Third radio markup** (`index.html:960–963`) — a `<label
   id="param-label-empirical-distributional">` wrapping `<input type="radio"
   name="param-mode" value="empirical-distributional">` with visible text **"Empirical
   (distributional) lognormal parameters"**, placed **last** (after the Empirical
   label). The new option carries **no** `checked` and the label carries **no**
   `class="active"`; the Empirical radio keeps `checked` (`:957`) and
   `param-label-empirical` keeps `class="active"` (`:956`).
2. **Tri-state `change` handler** (`index.html:4708–4729`) — on `change`:
   `empirical → {T_SHIRT_PARAMS_EMPIRICAL, sampleLognormal}`;
   `empirical-distributional → {T_SHIRT_PARAMS_DISTRIBUTIONAL, sampleLognormalWithResidual}`;
   else (`synthetic`) `→ {T_SHIRT_PARAMS, sampleLognormal}`; then three
   `classList.toggle('active', radio.value === '<mode>')` lines, one per label.

## Axis-by-axis reasoning (Step 2), scoped to correctness + stated requirements (Step 3)

- **logic — clean.** The mapping value→table→sampler matches the Phase-2 behavioral
  rule exactly (plan §"Behavioral rule", lines 500–504; ADR-0038 dec. 1–2). The binding
  (`if/else if/else` on `radio.value`) and the highlight (three independent
  `classList.toggle` keyed on `radio.value`) are evaluated synchronously in the **same**
  handler invocation off the **same** `radio.value`, so they cannot desync. The three
  radio values are mutually exclusive, so condition order is irrelevant and exactly one
  label receives `.active === true` (the other two `false`) — the "exactly one `.active`"
  invariant holds. No inverted/mis-ordered condition, no precedence error, no off-by-one
  (no indexing/loops).
- **edge-case — clean.** *Initial page-load* fires no `change` event, so the default
  state rests on markup + module defaults: Empirical radio `checked` (`:957`),
  `param-label-empirical` `.active` (`:956`), `activeParams = T_SHIRT_PARAMS_EMPIRICAL`
  (`:1380`), `activeSampler = sampleLognormal` (`:1384`) — a fully consistent Empirical
  default (DC-4 / ADR-0035, which requires `empirical` checked + its label `.active` +
  `activeParams` initialised to the empirical table). *Re-selecting the same mode* is
  idempotent (full rebind, no accumulated state). *Round-tripping back to Empirical*
  restores `{T_SHIRT_PARAMS_EMPIRICAL, sampleLognormal}` and the highlight — no residual
  sampler leak into the pre-existing two modes (DC-2 / ADR-0038 dec. 7). The handler
  writes no `localStorage`/URL (AC-7) and never touches the `.size-table` reference
  panel (ADR-0038 dec. 9). `radio.value` is always one of the three fixed strings; the
  `else` arm correctly catches `synthetic` — a hypothetical fourth value is ruled out by
  the fixed radio set, so defensive handling of it is out of scope (Step 3).
- **error-handling — N/A.** The handler performs no I/O and acquires no
  file/socket/lock/handle; there is no error path or resource to leak.
- **security — N/A.** No injection surface: the handler reads `radio.value`, assigns
  two module references, and calls `classList.toggle`; no `eval`, no `innerHTML` with
  external input, no secrets, no privileged path.
- **complexity — N/A.** `O(1)` per `change`; the one-time
  `querySelectorAll('input[name="param-mode"]')` enumerates three elements at load. No
  nested scans, no unbounded growth.

## Cross-checks against the counterexamples (plan §"Counterexamples")

- Two labels `.active`, or `activeParams` set but `activeSampler` forgotten — **not
  present** (both refs bound every arm; exactly one `.active`).
- `param-mode` written to `localStorage`, or the new mode made default-checked —
  **not present** (no persistence; Empirical keeps `checked`).
- Reference panel re-rendered/mutated on selection — **not present**.
- New option placed before Empirical, or Empirical default changed — **not present**
  (placed last; default unchanged).

## Scope notes

- The Phase-1 engine slice (`T_SHIRT_PARAMS_DISTRIBUTIONAL`, `RATIO_RESIDUALS`,
  `sampleLognormalWithResidual`, the `activeSampler` hot-loop swap, the `[contract]` I-4
  module-load assertion) was reviewed and PASSed under review-correctness p1; it is
  unchanged in this diff and out of Phase-2 scope. Confirmed only that the Phase-2
  handler binds the **already-correct** Phase-1 references — which it does.
- All consumers of the swapped references are accounted for: `activeParams` is read by
  `tshirtToPersonMonths` (`:1393`) and `sampleLognormal` (`:1428`); `activeSampler` is
  invoked by the `runScenario` hot loop (`:2604`). There is no other enumeration of the
  three modes (no display label / export / "run config") that Phase 2 would leave stale.

## Findings object (`backlog-review-correctness/v1`)

```json
{
  "schema": "backlog-review-correctness/v1",
  "verdict": "pass",
  "findings": [],
  "judge_dropped": []
}
```
