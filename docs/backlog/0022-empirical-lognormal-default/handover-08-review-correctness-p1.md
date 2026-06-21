---
schema: backlog-handover/v1
task_id: "0022"
produced_by_phase: review-correctness
feature_phase: 1
for_next_phase: done
outcome: success
reason: ""
produced_at: 2026-06-21T20:20:46Z
produced_commit: 62f80b5ff2a7bcc3784bde733444cf6a52ceaba2
test_commit: f7eb97de2c91eba6cd5b7ec51db1a3364b92f263
impl_commit: 62f80b5ff2a7bcc3784bde733444cf6a52ceaba2
---

## Summary

**Correctness review PASS** for Phase 1 (run 01), reasoning from the **spec** (plan Phase 1
behavioral rule + I-1/I-2 + DoD + oracle (a) + the per-size PBT property; ADR-0035 / ADR-0026 /
ADR-0002; CONTEXT.md) against the **production-only** diff `f7eb97d..62f80b5` — **not** the
tests. The production change is `index.html` (six in-place edits flipping the page-load default
synthetic→empirical; the `param-mode` `change` handler at 4524–4530 byte-for-byte unchanged) +
`package.json` (the `verify` self-bootstrap). No correctness defect tied to a stated requirement
survived the judge pass. This is the task's **final** feature-phase
(`current_phase == total_phases == 1`), so this PASS advances the task to **done**.

## Verdict & evidence

- **Verdict: PASS** (`backlog-review-correctness/v1`, `verdict: pass`, `findings: []`).
- **Logic / off-by-one:** the flip is a direct, correct realization of the behavioral rule —
  on load the empirical radio is `checked`, `#param-label-empirical` carries `.active`, the
  synthetic radio is unchecked, `#param-label-synthetic` lacks `.active` (AT-1), and
  `activeParams === T_SHIRT_PARAMS_EMPIRICAL` by reference (AT-2). The unchanged `change`
  handler preserves the bidirectional toggle (AT-3).
- **Edge / boundary (PBT domain = 7 Recognised t-shirt sizes):** `activeParams` *is*
  `T_SHIRT_PARAMS_EMPIRICAL` by reference, so the per-size by-value property holds for every
  key, including the calibrated `XS/S/M/L` (non-vacuous) and the carry-through `2XS/XL/XL+`
  (empirical == synthetic by value there — **by design**, ADR-0035; not a bug).
- **Error-handling / leak:** the `package.json` guard runs `npm ci` only when the eslint binary
  is absent; a non-zero `npm ci` aborts the `&&` chain loudly. No swallowed error, no leak; the
  `verify` change weakens **no** correctness layer (same tools/order/flags).
- **Security / complexity:** none — no injection/secrets/auth surface; constant-time edits.
- **One-way-door fidelity (ADR-0035):** all three surfaces (HTML `checked`, `.active`, the
  `activeParams` initializer) point at empirical; none left at synthetic. No on-load code reads
  `input[name="param-mode"]:checked` to re-derive `activeParams`, so UI ↔ binding cannot diverge
  on load (I-1 satisfied).
- **Ephemerality (ADR-0026/0002):** no `localStorage`/`sessionStorage`/URL persistence
  introduced (I-2 / AT-4).
- **No table mutation / scope creep:** neither parameter table nor the sidebar T-shirt size
  reference panel was edited; swap logic intact.
- **No test drift:** `git diff f7eb97d..62f80b5 -- tests features e2e acceptance` is empty
  (re-confirmed independently).

**Boot smoke:** `passed` — `smoke_command` empty (logged no-op; no build step); minimal
`index.html`-present + clean-tree check OK; base healthy (integrity review run 02 recorded
`npm run verify` exit 0, 234 passed | 1 skipped).

## Judge-dropped candidates (auditability)

Three candidates considered and dropped; none survived the judge pass:
1. **bfcache / browser form-state restoration on reload** could re-select synthetic — dropped:
   pre-existing radio-group behavior, not introduced by the diff; ADR-0026/0002 ephemerality
   concerns *explicit* persistence, and the test page-load entry point is a fresh
   `loadSimulator()`. Not a stated-requirement violation.
2. **Stale line numbers in CONTEXT.md glossary** (e.g. `index.html:1264`, `:3293-3300`) —
   dropped: documentation nits in a file outside this stage's production diff; no behavioral
   impact.
3. **I-1 breakable by a future one-sided edit** — dropped: speculative hardening; all three
   surfaces were updated consistently in this change and I-1 holds on load.

## Autonomously-taken (gated) decisions, recorded here (no user — backlog loop mode)

1. **Verdict PASS, no `findings[]`, task → done.** The single clean pass surfaced no defect
   tied to a concrete incorrect behavior or a stated requirement; the three candidates above
   were dropped per the Step-3 scoping rule / Step-5 judge pass. Since `current_phase ==
   total_phases == 1`, this PASS transitions the index to `stage: done`, `status: done`.
2. **Did not re-run the full suite.** Correctness review reasons from the spec, not the tests
   (running tests is the integrity review's domain); the integrity review run 02 already
   recorded a green hermetic `npm run verify` (exit 0). The boot smoke confirmed a healthy base.
3. **Accepted the `package.json` `verify` self-bootstrap as non-defective infrastructure.** It
   prepends a guarded `npm ci` hermetic precondition without disabling/downgrading/
   scope-narrowing any correctness layer — a robustness tightening, not a correctness gap.
4. **Review run / handover numbering.** No prior correctness review exists → this is correctness
   run **01** (`docs/reviews/0022-…-phase-1-correctness-01.md`; the integrity runs are
   `…-review-01/02.md`). Max existing handover = 07 → this is `handover-08-review-correctness-p1.md`.
5. **Cross-family union gate.** `review_correctness.cross_family.enabled` is the default
   (off), so this single Claude pass owns the verdict; no second-family pass is invoked.

## Files read (the spec, not the tests)

- `docs/plans/0022-empirical-lognormal-default.md` — Phase 1 spec (behavioral rule, I-1/I-2,
  oracle (a), the per-size PBT property, counterexamples, forbidden shortcuts, DoD).
- `docs/backlog/0022-empirical-lognormal-default/handover-07-review-p1.md` — the integrity
  review PASS handover (this stage's input).
- `docs/backlog/0022-empirical-lognormal-default/handover-06-implement-p1.md` — the impl
  handover (the two production edits + hermetic-verify root cause).
- `docs/backlog/0022-empirical-lognormal-default/handover-04-atdd-p1.md` — names the test commit.
- `index.html` (changed regions + samplers + change handler), `package.json` — the production diff.
- `CONTEXT.md` — glossary (Synthetic/Empirical parameters, Recognised t-shirt size,
  `activeParams`, `param-mode`).
- `docs/adr/0035-…md` (implemented), `docs/adr/0026-…md` (superseded in part — ephemerality
  stands), `docs/adr/0002-client-side-only.md` (no implicit cross-session state).

## Definition of done (met for this stage)

Correctness review complete and clean: reasoned from the spec, single clean pass + judge pass,
no surviving finding. Review persisted at
`docs/reviews/0022-empirical-lognormal-default-phase-1-correctness-01.md` and appended to
`index.md` `artifacts.reviews`. Index advanced to `stage: done`, `status: done` (final
feature-phase). The feature is complete.
