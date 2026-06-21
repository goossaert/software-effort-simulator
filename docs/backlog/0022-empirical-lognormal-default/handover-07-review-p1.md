---
schema: backlog-handover/v1
task_id: "0022"
produced_by_phase: review
feature_phase: 1
for_next_phase: review-correctness
outcome: success
reason: ""
produced_at: 2026-06-21T20:15:08Z
produced_commit: 62f80b5ff2a7bcc3784bde733444cf6a52ceaba2
test_commit: f7eb97de2c91eba6cd5b7ec51db1a3364b92f263
impl_commit: 62f80b5ff2a7bcc3784bde733444cf6a52ceaba2
---

## Summary

**Integrity review PASS** for Phase 1 (run 02), re-run after the human fix that recorded the
mutation layer **N/A** (`mutation.enabled: false`, `toolchain.layers.mutation.status: "n/a"`,
ADR-0036) and removed the run-01 BLOCKED handover. Every integrity axis over
`f7eb97d..62f80b5` is clean:

- **No test-file drift** — `git diff f7eb97d..62f80b5 -- tests features e2e acceptance` is empty.
- **No test-gaming pattern** — `index.html` implements the general rule (no fixture literal, no
  env/identity branch); the second production change (`package.json` `verify`) prepends a guarded
  `npm ci` hermetic precondition and **disables/downgrades/scope-narrows no correctness layer**
  (all five layers identical and in order) — infrastructure, not a goalpost move.
- **Invariants** I-1/I-2 are `[test-only]` and SATISFIED; **no `[contract]` invariants**
  (`contract.enabled: false`).
- **Coverage** — AT-1..AT-4 + the per-size `test.prop` property + calibrated/carry-through/
  negative triangulation examples all map to the plan (oracle (a); parity N/A); the one
  parametric property is generator-based, reads the size set from the loaded window, and is
  non-vacuous on the calibrated sizes. No gap.
- **Negative control PASS** — revert default→synthetic → `exit 1`, 5 failed, property
  counterexample `["XS"]`; restore → `exit 0`, 8 passed; tree clean.
- **Mutation N/A** — skipped, does not block (recorded N/A; not the `mutation-unconfigured` case).
- Full `npm run verify` on the committed tree → `exit 0`, 234 passed | 1 skipped.

Review file: `docs/reviews/0022-empirical-lognormal-default-phase-1-review-02.md`. Per the Loop
contract, this PASS hands to **`review-correctness`** (same `current_phase: 1`); the integrity
review does **not** advance the feature-phase — only the correctness review's PASS does.

## Instructions for the next phase (review-correctness)

Reason from the **spec**, not the tests. The production change you must judge for correctness
bugs that pass a green suite is exactly:

1. `index.html` — the page-load default flip (six in-place edits): synthetic radio loses
   `checked`/`.active`; empirical radio gains `checked`/`.active`; the comment flips to
   `default: empirical`; and `let activeParams = T_SHIRT_PARAMS;` → `let activeParams =
   T_SHIRT_PARAMS_EMPIRICAL;`. The `param-mode` `change` handler (`index.html:4522-4531`) is
   **unchanged** (verify this — it is absent from the diff).
2. `package.json` — the `verify` script self-bootstrap (`{ [ -e node_modules/.bin/eslint ] ||
   npm ci; } && …`). Confirm it weakens no correctness layer (it does not — same tools, same
   order, same flags; only a guarded `npm ci` precondition is prepended).

Derive the diff with `git diff test_commit..impl_commit` (SHAs in the frontmatter, or re-derive
via `git log -1 --format=%H -- docs/backlog/0022-empirical-lognormal-default/handover-04-atdd-p1.md`
for the test commit and `…/handover-06-implement-p1.md` for the impl commit). The production-only
diff is `index.html` + `package.json` — nothing else.

Spec angles worth a correctness look (reason from the plan + ADRs, not from the tests):
- **One-way door fidelity (ADR-0035):** on page-load the active set must *be* the Empirical
  table and the UI selection must agree — confirm no surface (HTML `checked`, `.active`, the
  `activeParams` initializer) was left pointing at synthetic, which would be a silent
  UI↔binding inconsistency a green suite could still miss in some corner.
- **Ephemerality (ADR-0026 surviving part, ADR-0002):** confirm the change introduces no
  persistence (`localStorage`/`sessionStorage`/URL) — the default must come only from the static
  `checked` attribute + the initializer and reset on reload.
- **No table mutation / scope creep:** confirm neither parameter table nor the sidebar T-shirt
  size reference panel was edited, and the swap logic is intact (carry-through sizes
  `2XS/XL/XL+` equal synthetic by value by design — not a bug).

## Files the next phase MUST read

- `docs/plans/0022-empirical-lognormal-default.md` — the spec: behavioral rule, AT-1..AT-4,
  invariants I-1/I-2, oracle class (a), counterexamples, forbidden shortcuts, DoD.
- `docs/backlog/0022-empirical-lognormal-default/handover-04-atdd-p1.md` — the **test commit**
  source (`git log -1 --format=%H -- …/handover-04-atdd-p1.md` = `f7eb97d`).
- `docs/backlog/0022-empirical-lognormal-default/handover-06-implement-p1.md` — the newest
  **implement** handover; its commit is the **impl commit** (`git log -1 --format=%H --
  …/handover-06-implement-p1.md` = `62f80b5`). Records the two production edits and the
  hermetic-verify root cause.
- `CONTEXT.md` — glossary entries **Synthetic parameters**, **Empirical parameters**,
  **Recognised t-shirt size**, `activeParams`, `param-mode` (spec vocabulary).
- `docs/adr/0035-default-to-empirical-lognormal-parameters.md` — the decision implemented
  (the one-way door; do not re-open).
- `docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md` — superseded **in part**; its
  ephemeral-toggle / no-persistence decision still constrains the feature.
- `docs/adr/0002-client-side-only.md` — "no implicit state across sessions" (why the toggle
  must stay ephemeral).
- `docs/adr/0007-…md` — the synthetic-fit hand-recompute contract; untouched, read for context.
- `docs/reviews/0022-empirical-lognormal-default-phase-1-review-02.md` — this integrity review
  (full step-by-step evidence).

## Context the next phase needs

**Verdict & evidence (all command/exit-code backed):**
- Integrity verdict: **PASS**. Negative control: PASS (`exit 1` on injected synthetic default,
  5 failed, property counterexample `["XS"]`; `exit 0`/8 passed on restore). Full `npm run
  verify`: `exit 0`, 234 passed | 1 skipped.
- Test-file drift: none. Gaming patterns: none. Invariant gaps: none. Missing coverage: none.
  Additional verification tests written: none. Mutation: N/A (recorded; does not block).

**Boot smoke:** `passed` — `smoke_command` empty (logged no-op; `toolchain.layers.smoke: n/a`,
no build step); minimal `index.html`-present check OK; base healthy (`npm run verify` exit 0).

**Autonomously-taken (gated) decisions, recorded here (no user — backlog loop mode):**
1. **Treated mutation as N/A, not a blocker.** `mutation.enabled: false` carries a *recorded*
   N/A (`toolchain.layers.mutation.status: "n/a"` + ADR-0036), so per `/stage-review` Step 7 the
   step is skipped entirely and the phase is **not** emitted `blocked: mutation-unconfigured`
   (that block applies only with *no* recorded N/A). This is the intended consumption of the
   human fix that resolved run-01's BLOCKED. The behavioral guarantee is carried by the passing
   negative control + the per-size PBT property.
2. **Accepted the `package.json` `verify` change as non-gaming infrastructure.** It adds a
   guarded `npm ci` hermetic precondition without disabling/downgrading/scope-narrowing any
   correctness layer (same tools, order, flags; a failed `npm ci` aborts `verify` loudly). Under
   the Step 3 patched-config rule this is a *robustness tightening*, not a goalpost move → not a
   FAIL.
3. **Wrote no additional verification tests (Step 8).** No missing case/edge/invariant gap was
   found; the committed suite covers the rule and every counterexample, so an additive probe
   would add nothing. (And the reviewer never authors the phase's committed tests.)
4. **Review run / handover numbering.** Existing review = run 01 (the BLOCKED run) → this is run
   **02**. Max existing handover = 06 → this is `handover-07-review-p1.md` (the run-01 review's
   `handover-07` was removed by the human fix, so 07 is free again).

## Definition of done (met for this stage)

Integrity review complete and clean: no test-file drift, no gaming pattern, invariants
satisfied, coverage complete (AT-1..AT-4 + per-size PBT property), negative control PASS,
mutation a recorded N/A. Review persisted and appended to `index.md` `artifacts.reviews`. Index
advanced to `stage: review-correctness` (same `current_phase: 1`), `next_handover:
handover-07-review-p1.md`. The feature-phase is **not** complete until `/stage-review-correctness`
also PASSes.
