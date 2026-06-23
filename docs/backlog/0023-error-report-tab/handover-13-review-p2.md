---
schema: backlog-handover/v1
task_id: "0023"
produced_by_phase: review
feature_phase: 2
for_next_phase: review-correctness
outcome: success
reason: ""
produced_at: 2026-06-23T20:55:01Z
produced_commit: ""
test_commit: 57b38dc23c39a46a0666a0736cf3466ed3cbf47e
impl_commit: cbbabc6b64d749e4eff7fde0d173b32ee1b6d304
review_path: docs/reviews/0023-error-report-tab-phase-2-review-01.md
---
## Summary

Integrity review of feature-phase 2 (codes 3-22 + full presentation contract):
**PASS**. Test immutability holds, no test gaming, all `[contract]` invariants are live
through the `makeFinding` factory (proven by a contract negative control), PBT coverage
meets the whole-plan floor (12 ≥ 12), and both negative controls ran with real failing
exit codes and clean reverts. Advancing to **review-correctness** (same feature-phase 2).

Full report: `docs/reviews/0023-error-report-tab-phase-2-review-01.md`.

## Gated decisions taken autonomously (no user)

- **Verdict = PASS (integrity).** Mandate is test↔production integrity only; correctness
  from spec is the next stage. No gaming/tamper/dead-contract/PBT-gap → not a FAIL; both
  negative controls ran → not BLOCKED.
- **Step 7 mutation skipped.** `mutation.enabled: false` with a **recorded N/A**
  (`toolchain.layers.mutation.status: "n/a"`, ADR-0036) — a deliberate selection, not a
  misconfiguration, so no `mutation-unconfigured` block; the loop does not block on a
  score.
- **No additive verification tests written.** The integrity surface is clean; the one
  substantive observation is a spec question for the correctness stage (below), and the
  reviewer authors no committed tests.

## Carry-forward for the correctness review (reason from the spec, not the tests)

**LAMBDA_ZERO guard — adjudicate whether the spec is satisfied.** Production implements
`LAMBDA_ZERO` as `lambda === 0 && epicSizingDist.length === 0` (index.html, code-6
block), but the plan's `[test-only]` invariant (former Phase 3) states
`LAMBDA_ZERO ⇔ lambda === 0`. The extra guard suppresses the warning when `lambda === 0`
yet in-scope sizing data exists — reachable via an **in-window orphan epic** (blank
`_initiative_key`, recognised size): it is pushed to `epicSizingDist` but contributes 0
to `epicCounts`, so `lambda === 0` while `epicSizingDist.length > 0`. The committed
presentation test `tests/acceptance/0023-phase-2-acc-presentation.test.js` (AT-5)
**requires** this guard (it seeds exactly that orphan and asserts the badge shows `1
WARNING`; a strict `lambda===0` rule would add a second WARNING and fail it). Integrity
view: a general, non-gamed refinement faithful to the frozen tests — **not** an integrity
defect. Correctness view (yours): decide whether a λ=0 run with orphan sizing data is
genuinely degenerate (Poisson(0) ⇒ 0 epics drawn ⇒ empty forecast) and therefore *should*
warn. If you conclude the guard is wrong, note that the AT-5 test encodes the opposite, so
the resolution may be a `suspect-test` block (frozen test contradicts the spec) rather
than a plain production FAIL — see `stage-review-correctness` Step 5b.

Other than that, no open risks: I-1 (engine output unchanged) holds — the diagnostics
block reads engine arrays/Sets and only pushes to a local `findings`, assigning no engine
value; `prop-presentation` P2 asserts `kPerGroup` byte-equality. `MQ_FORWARD_DOUBLE_COUNT`
is reported at ERROR without touching the math (DC-5).

## Verification performed

- Test immutability: `git diff 57b38dc..cbbabc6 -- tests features e2e acceptance` → **empty**.
- Gaming scan over added production lines (suppression tokens, env branches, fixture ids, test imports) → **none**.
- GREEN baseline: `npx vitest run tests/acceptance/0023-phase-2-*.test.js` → **11 files, 33 passed**.
- Negative control A (behavioral): `qSet.size >= 2` → `>= 3` ⇒ MQ acceptance + property **failed**; reverted ⇒ GREEN.
- Negative control B (contract I-3): `ORPHAN_EPIC` severity → `'CRITICAL'` ⇒ `makeFinding` threw `[finding] invalid severity "CRITICAL" for code "ORPHAN_EPIC"`; reverted ⇒ GREEN.
- PBT: 10 Phase-2 `test.prop` rows (one per plan property) + 2 Phase-1 = **12 ≥ pbt-floor 12**.
- `index.html` confirmed byte-identical to `cbbabc6` after the review (mutations reverted; no production edits committed by this phase).

## Files the next phase MUST read

- Plan (spec to reason from): `docs/plans/0023-error-report-tab.md` (Phase 2)
- atdd-p2 handover (derives `test_commit`): `docs/backlog/0023-error-report-tab/handover-10-atdd-p2.md`
- implement-p2 handover (derives `impl_commit`): `docs/backlog/0023-error-report-tab/handover-12-implement-p2.md`
- This integrity review: `docs/reviews/0023-error-report-tab-phase-2-review-01.md`
- Glossary: `CONTEXT.md`
- ADRs cited by the plan: `docs/adr/0037-error-report-advisory-diagnostics.md`,
  `docs/adr/0018-tab-based-results-layout.md`, `docs/adr/0002-client-side-only.md`,
  `docs/adr/0001-single-file-html-app.md`, `docs/adr/0023-*` / `docs/adr/0033-*`
  (constant-work / per-group scoping), `docs/adr/0029-*` (user-defined Groups),
  `docs/adr/0036-*` (mutation N/A rationale).

Derive the diff range with:
`git log -1 --format=%H -- docs/backlog/0023-error-report-tab/handover-10-atdd-p2.md` (test_commit)
and `… handover-12-implement-p2.md` (impl_commit).
