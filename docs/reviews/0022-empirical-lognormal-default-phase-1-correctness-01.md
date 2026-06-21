# Correctness review — 0022 empirical-lognormal-default — Phase 1, run 01

- **Task / slug:** 0022 — empirical-lognormal-default
- **Feature-phase:** 1 of 1
- **Run:** 01 (first correctness review; follows integrity review run 02 PASS)
- **Date (UTC):** 2026-06-21T20:20:46Z
- **test_commit:** `f7eb97de2c91eba6cd5b7ec51db1a3364b92f263` (atdd p1)
- **impl_commit:** `62f80b5ff2a7bcc3784bde733444cf6a52ceaba2` (implement p1, retry)
- **Method:** reasoned from the **spec** (plan Phase 1 behavioral rule + invariants + DoD +
  oracle + properties; ADR-0035 / ADR-0026 / ADR-0002; CONTEXT.md glossary) and the
  **production-only** diff — **not** the tests. Single clean pass + judge pass.

## Inputs materialized

- **Plan slice (Phase 1):** behavioral rule, I-1/I-2 (`[test-only]`, no `[contract]`),
  oracle class (a), the per-size empirical-on-load PBT property, counterexamples,
  forbidden shortcuts, DoD — `docs/plans/0022-empirical-lognormal-default.md`.
- **Production-only diff** `f7eb97d..62f80b5` (test paths excluded): `index.html` +
  `package.json` only. `git diff … -- tests features e2e acceptance` is **empty** (no test
  drift, re-confirmed independently of the integrity review).
- **Full changed files** read in place: `index.html` (the param-mode radios at 949–960,
  the `T_SHIRT_PARAMS_EMPIRICAL` table + `activeParams` initializer at 1322–1333, the
  samplers at 1341–1380 that read `activeParams`, and the `change` handler at 4523–4530);
  `package.json` (the `verify` script).
- **Glossary + ADRs:** CONTEXT.md (**Synthetic parameters**, **Empirical parameters**,
  **Recognised t-shirt size**, `activeParams`, `param-mode`); ADR-0035 (the decision
  implemented), ADR-0026 (superseded in part — ephemerality stands), ADR-0002 (no implicit
  cross-session state).

## The production change under review

1. **`index.html` — page-load default flip (six in-place edits):**
   - `#param-label-synthetic` loses `class="active"`; its radio loses `checked` (949–954).
   - `#param-label-empirical` gains `class="active"`; its radio gains `checked` (956–957).
   - the initializer comment flips to `default: empirical` (1332).
   - `let activeParams = T_SHIRT_PARAMS;` → `let activeParams = T_SHIRT_PARAMS_EMPIRICAL;` (1333).
   - The `param-mode` `change` handler (4524–4530) is **byte-for-byte unchanged** (absent from
     the diff — verified): it still reassigns `activeParams` and toggles `.active` both ways.
2. **`package.json` — `verify` self-bootstrap:** `verify` gains a guarded
   `{ [ -e node_modules/.bin/eslint ] || npm ci; } &&` prefix; the rest of the chain
   (`lint → scan:forbidden → scan:deps → secretlint → vitest run`) is identical — same
   tools, same order, same flags.

## Review axes (single clean pass)

- **Logic / off-by-one:** The flip is a direct, correct realization of the behavioral rule.
  On a fresh load with no interaction the empirical radio is `checked`, `#param-label-empirical`
  carries `.active`, the synthetic radio is unchecked and `#param-label-synthetic` lacks
  `.active` (AT-1), and `activeParams === T_SHIRT_PARAMS_EMPIRICAL` by reference (AT-2). The
  `change` handler is untouched and preserves the bidirectional toggle (AT-3). No inverted/
  mis-ordered condition; no unreachable branch. **No defect.**
- **Edge / boundary (PBT domain = the 7 Recognised t-shirt sizes):** Because `activeParams`
  *is* `T_SHIRT_PARAMS_EMPIRICAL` (reference identity), the per-size by-value property
  (`activeParams[s].mu/sigma === T_SHIRT_PARAMS_EMPIRICAL[s].mu/sigma`) holds for **every**
  key, including the calibrated sizes `XS/S/M/L` (the non-vacuous driver) and the
  carry-through sizes `2XS/XL/XL+` (empirical equals synthetic *by value* there — **by design**
  per ADR-0035 consequences and the plan's *Properties* note, not a bug). **No missed edge.**
- **Error-handling / resource leak:** No runtime app error path changed (samplers at 1341/1377
  keep their existing `if (!p) …` guards; untouched). The `package.json` guard runs `npm ci`
  only when the eslint binary is absent and a non-zero `npm ci` aborts the `&&` chain **loudly**
  (verify fails) — no swallowed error, no success-on-failure, no leak. **No defect.**
- **Security:** No injection (SQL/command/path/template), no secrets, no unsafe
  deserialization, no auth surface, no new external input crossing a trust boundary. The
  build-time `[ -e … ] || npm ci` guard is not user-controlled. **No defect.**
- **Algorithmic complexity:** Constant-time HTML/initializer edits; no new loop, scan, or
  unbounded growth. **No defect.**

## Spec-angle checks (from the handover + ADRs)

- **One-way-door fidelity (ADR-0035):** on load the active set *is* the Empirical table **and**
  the UI agrees — all three surfaces (HTML `checked`, `.active`, the `activeParams` initializer)
  point at empirical; **none** was left at synthetic. I-1 (UI ⇔ binding consistency) holds on
  load. The only writes to `activeParams` are the line-1333 initializer (empirical) and the
  user-driven `change` handler; **no on-load code reads `input[name="param-mode"]:checked` and
  re-derives `activeParams`**, so the two surfaces cannot diverge on load (verified by grep over
  all `activeParams` / `param-mode` references).
- **Ephemerality (ADR-0026 surviving part, ADR-0002):** the diff introduces **no**
  `localStorage` / `sessionStorage` / URL persistence; the default derives only from the static
  `checked` attribute + the initializer and resets to empirical on every reload (AT-4, I-2).
- **No table mutation / scope creep:** neither `T_SHIRT_PARAMS_EMPIRICAL` (1322–1330) nor
  `T_SHIRT_PARAMS` was edited; the sidebar **T-shirt size reference** panel is untouched; the
  swap logic is intact.

## Judge pass — candidates dropped (none survived)

See the machine-readable object below. Three candidates were considered and dropped; **zero**
findings survive. **Verdict: PASS.**

```json
{
  "schema": "backlog-review-correctness/v1",
  "verdict": "pass",
  "findings": [],
  "judge_dropped": [
    {
      "candidate": "Browser form-state restoration on reload (bfcache) could re-select the synthetic radio, diverging from the empirical default.",
      "why_dropped": "Pre-existing characteristic of any radio group, not introduced by this diff. ADR-0026/ADR-0002 ephemerality concerns *explicit* persistence (localStorage/sessionStorage/URL), and the spec's page-load entry point in tests is a fresh loadSimulator() window. Not tied to a concrete incorrect behavior of this change nor a stated requirement."
    },
    {
      "candidate": "CONTEXT.md glossary cites stale line numbers (e.g. activeParams at index.html:1264, change handler at :3293-3300, T_SHIRT_PARAMS_EMPIRICAL at :1253-1261).",
      "why_dropped": "Documentation nits in a file outside this stage's production diff (CONTEXT.md is not in test_commit..impl_commit). No behavioral impact; not a correctness defect or a stated-requirement violation in the reviewed change."
    },
    {
      "candidate": "I-1 (UI<->binding consistency) could be broken by a future engineer editing one surface (HTML checked / .active / the initializer) without the others.",
      "why_dropped": "Speculative hardening for a hypothetical future edit. In this change all three surfaces were updated consistently and I-1 holds on load; not a concrete incorrect behavior of the diff under review."
    }
  ]
}
```

## Verdict

**PASS** — no correctness defect tied to a stated requirement survived the judge pass. The
production change is a faithful, minimal realization of the Phase-1 behavioral rule and
ADR-0035; ephemerality (ADR-0026/0002) is preserved; no table or handler logic was altered;
the `package.json` `verify` change weakens no correctness layer. This is the task's final
feature-phase (`current_phase == total_phases == 1`), so this PASS advances the task to
**done**.
