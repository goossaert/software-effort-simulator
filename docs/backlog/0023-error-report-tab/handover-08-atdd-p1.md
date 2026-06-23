---
schema: backlog-handover/v1
task_id: "0023"
produced_by_phase: atdd
feature_phase: 1
for_next_phase: atdd
outcome: blocked
reason: "atdd RED gate unsatisfiable: inherited base (HEAD 2b3fe7f) is post-implementation — committed phase-1 *-red.log commands now exit 0 (GREEN); atdd cannot restore a pre-impl RED base without editing production code. (Underlying pbt-floor: whole-plan floor=12 vs 4 committed.)"
produced_at: 2026-06-23T05:43:02Z
produced_commit: 2b3fe7f66a7b3a89654b0ac1dbd360ba2fc763f3
test_commit: 36d5b1c8c94e2e40c62787d660a2354622655daa
---
## Summary
This is the atdd p1 re-run the orchestrator dispatched after the post-stage gate
rejected implement p1 on `pbt-floor` (handover-07-gate-p1.md) and rewound `stage`
to `atdd`. The boot base-health check found the inherited working tree is a
**post-implementation** tree: HEAD `2b3fe7f` has the phase-1 implementation
(`d77e0ab`) in its ancestry, so the two **committed** phase-1 RED-log commands now
exit **0 (GREEN)** — acceptance 6/6, inner 7/7 (evidence:
`docs/atdd-logs/0023-error-report-tab-phase-1-base-health.log`). The post-stage gate
sub-check **(c)** re-runs those exact `*-red.log` command headers against the atdd
commit and **requires a non-zero (RED) exit**; on this base they pass, so **no atdd
commit made here can be confirmed RED**. The skill's contract is explicit ("if RED
cannot be confirmed, emit BLOCKED"; status must not be PASS without two non-zero RED
gates), and atdd may **not** modify production code to restore a pre-impl base.
Outcome: **blocked** — no tests authored, `stage` not advanced, flagged for a human.

## Instructions for the next phase
A human must repair the base/config before atdd can run; this is **not**
autonomously resolvable and **not** a production-code FAIL. Pick ONE remedy, then
re-dispatch:

1. **Restore a pre-implementation base for the atdd re-run, then front-load phase-1
   properties (recommended — minimal change, unblocks the whole pipeline).**
   - Reset the production tree (`index.html`) to the **test commit `36d5b1c`** state
     (pre-impl) so the committed phase-1 RED-log commands fail again (genuine RED).
     This undoes the auth-failure-recovery leak that left `d77e0ab`'s code in HEAD
     while `stage` was reset to `atdd`. (The frozen 0020/0021 tab-bar migrations in
     `fdbb375` are in test files and stay; only `index.html` is reset.)
   - Then re-run atdd p1 and **add ≥8 additional phase-1 property tests** in a NEW
     file (e.g. `tests/acceptance/0023-phase-1-detection-properties.test.js` — do
     NOT edit the frozen `0023-phase-1-*.test.js`). Triangulate phase-1's parametric
     behavior from more angles (all green-able by the phase-1 impl, all RED pre-impl):
     UNRECOGNIZED_SIZE_EPIC cardinality/uniqueness; UNRECOGNIZED_SIZE_CONSTANT_WORK
     partition (AT-4, code 2); the finding contract I-3 (severity ∈ enum) / I-4
     (locators.length ≥ 1) over generated finding-producing inputs; the I-5
     normalisation property (recognised variants never flagged); the I-1
     advisory/read-only metamorphic property. This brings cumulative
     `fc.property|test.prop|it.prop` invocations from **4 → ≥12**, satisfying the
     **whole-plan** pbt-floor (12) for THIS and EVERY subsequent phase's implement
     gate (cumulative count only grows).
2. **Re-plan task 0023 as a single feature-phase (`total_phases: 1`).** The pbt-floor
   (f) counts the WHOLE plan's parametric rules (12), but the plan is 6 thin slices of
   2 properties each, so implement phases 1–5 can never meet a 12-floor on their own.
   Collapsing to one phase authors all 12 property tests together and implements all
   22 codes together — aligning the slice model with the whole-plan floor.
3. **Make the pbt-floor per-phase.** If the orchestrator/gate can scope sub-check (f)
   to the current phase's declared parametric rules (phase 1 = 2), each thin slice's 2
   properties satisfy it and the thin-slice plan works unchanged.

Whichever remedy is chosen, also ensure the atdd session is dispatched onto a
**pre-implementation tree** (remedy 1) or the slice is structured so its tests are
genuinely RED on the dispatched base — otherwise gate (c) will reject again.

## Files the next phase MUST read
- docs/atdd-logs/0023-error-report-tab-phase-1-base-health.log — the blocker
  evidence: both committed phase-1 RED commands exit 0 on HEAD 2b3fe7f, plus the
  pbt-floor arithmetic (4 vs 12).
- docs/backlog/0023-error-report-tab/handover-07-gate-p1.md — the gate rejection that
  triggered this rewind (failed_check: pbt-floor; the 12 parametric rules listed).
- docs/plans/0023-error-report-tab.md — the 6-phase plan; "Properties / invariants to
  PBT" (2 per phase = 12) and the phase-1 slice (AT-1…AT-5, I-1…I-5, codes 1–2).
- docs/backlog/0023-error-report-tab/index.md — scheduling state (stage atdd,
  current_phase 1, test_commit 36d5b1c, impl_commit d77e0ab).
- backlog.config.json — `pbt` block (enabled, framework fast-check,
  import_symbol `fc.property|test.prop|it.prop`, min_per_rule 1) and the gate config.

## Context the next phase needs
- **Root cause (base inconsistency).** The auth-failure recovery (`01d8397`
  "recover 0023/0024 from auth failure — reset to ready status") reset `stage`→`atdd`
  but left the implement code (`d77e0ab`) in the working tree at HEAD. Separately, the
  implement re-run that the gate actually examined — `d9a720d`
  ("makeFinding factory enforces I-3/I-4") — is **NOT** in HEAD's ancestry, so HEAD
  carries the OLDER impl (`d77e0ab`, without the I-3/I-4 runtime assertions from the
  review FAIL). So the atdd re-run inherited a post-impl tree that is *also* missing
  the review fix. Verified: phase-1 acceptance 6/6 + inner 7/7 pass on HEAD;
  `renderErrorReport`×2, `collectRunLevelFindings`×1, `findings`×15 present in
  index.html.
- **Why no autonomous atdd commit works on this base.** (a) New phase-1 property
  tests would be GREEN (impl present) → gate (c) rejects. (b) Even committing nothing
  new, gate (c) re-runs the EXISTING phase-1 `*-red.log` commands (still committed)
  which are now GREEN → rejects. (c) Writing RED tests for not-yet-implemented codes
  3–22 (phases 2–6) would satisfy (c) but then implement p1's hermetic-green gate (b)
  fails on them and pollutes the frozen set across phases. There is no atdd commit that
  satisfies (c) + sets up (f) + keeps (b) achievable.
- **pbt-floor arithmetic (the original gate failure).** committed property
  invocations = 4 (`0023-phase-1-finding-model-property.test.js`: 2 `test.prop`;
  `0022-empirical-default-params-property.test.js`: 2); whole-plan parametric rules =
  12; `min_per_rule` = 1 ⇒ floor 12 > 4. Resolvable only by remedy 1/2/3 above.
- **Seam decision (recorded for the eventual atdd re-run, taken autonomously per Loop
  mode).** The phase-1 tests target only the plan's named stable seams —
  `prepareSimulationData(histQs, targetQs).findings`, `renderErrorReport(findings)`,
  and the rendered `#tab-error-report` DOM — never private detector helper names. The
  ≥8 additional phase-1 property tests in remedy 1 must use the **same** seams.
- **Boot smoke:** `smoke_command` is empty (n/a) ⇒ logged no-op; the base "builds",
  but is wrong for atdd in the deeper sense documented above (`blocked`, not
  `passed`/`repaired`).

## Definition of done
For the human-repaired re-dispatch: the atdd p1 commit confirms a **stable RED**
(both `*-red.log` commands exit non-zero across `flakiness_reruns`=5 on the
dispatched pre-impl base), AND the cumulative committed property-test invocation
count satisfies the active pbt-floor (≥12 for the whole-plan floor as configured, or
≥ the current phase's parametric-rule count if the floor is made per-phase). No
frozen test file is edited; no production code is touched by the atdd phase.
