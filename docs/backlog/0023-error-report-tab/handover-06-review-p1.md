---
schema: backlog-handover/v1
task_id: "0023"
produced_by_phase: review
feature_phase: 1
for_next_phase: implement
outcome: fail
reason: "I-3/I-4 are tagged [contract] but production builds findings as bare literals with no runtime assertion — Step 6 negative control proves the contract is dead (invalid severity caught only by a test expectation, not a runtime abort); add a finding factory that asserts severity-enum + locators.length>=1 and route both detectors through it"
produced_at: 2026-06-22T23:05:00Z
produced_commit: ""
test_commit: 36d5b1c8c94e2e40c62787d660a2354622655daa
impl_commit: d77e0abc6f340e4915560b91bf4fad942839c8ee
review_file: docs/reviews/0023-error-report-tab-phase-1-review-01.md
---
## Summary

Integrity review of Phase 1 (feature 0023 error-report-tab) over the production-only
diff `36d5b1c..d77e0ab`. The implementation is otherwise clean — no test gaming, test
immutability intact, both required PBT properties present, the advisory I-1 invariant
satisfied, and the behavioral negative control killed. It **FAILs** one integrity check:
the plan tags invariants **I-3** (every finding's `severity` ∈ {ERROR,WARNING,INFO}) and
**I-4** (every item-level finding has `locators.length >= 1`) as **`[contract]`** and
prescribes asserting them "in the finding constructor", but the production code
constructs `Data-quality finding`s as **bare object literals with no runtime assertion**.
Step 6's contracted-invariant negative control (NC-2) proves the **dead contract**: a
deliberately-invalid `severity: 'BOGUS'` was caught **only** by a downstream test
expectation (`expect([...]).toContain` at `finding-model-property.test.js:149`), never by
a runtime abort inside `prepareSimulationData`. Per stage-review Step 5/Step 6 a
`[contract]` invariant with no in-code assertion is a **production-code gap → FAIL routed
to `/stage-implement`**.

This is a **production fix only** — no test edits. The existing Phase-1 tests stay green;
the change is purely additive defensive enforcement.

## Instructions for the next phase (re-implement, production-only)

Re-enter `/stage-implement` at Step 2. Make exactly these production changes in
`index.html` (page `<script>` scope, reachable by `prepareSimulationData`):

1. **Add a finding factory carrying the I-3/I-4 runtime assertions:**
   ```js
   function makeFinding({ code, severity, category, locators, impact = '', message }) {
     if (severity !== 'ERROR' && severity !== 'WARNING' && severity !== 'INFO') {
       throw new Error(`[finding] invalid severity "${severity}" for code "${code}"`); // I-3
     }
     if (!Array.isArray(locators) || locators.length < 1) {
       throw new Error(`[finding] code "${code}" must carry >= 1 locator`);            // I-4
     }
     return { code, severity, category, locators, impact, message };
   }
   ```
2. **Route both Phase-1 detectors through it.** Replace the two `findings.push({ ... })`
   object literals with `findings.push(makeFinding({ ... }))`:
   - `UNRECOGNIZED_SIZE_EPIC` (the `else` branch of `if (T_SHIRT_PARAMS[size])`, ~`index.html:2114`).
   - `UNRECOGNIZED_SIZE_CONSTANT_WORK` (the target-quarter constant-work loop, ~`index.html:2168`).
   Phases 2-6 and `collectRunLevelFindings` reuse the same factory, so the contract then
   guards all 22 detectors — exactly the defense-in-depth the `[contract]` tag exists for.
3. **Do NOT edit any test file** (`tests/**` is frozen). The existing Phase-1 tests
   remain valid and green after the change.
4. Re-confirm the Phase-1 suite is green and `npm run verify` passes under the hermetic
   checkout before writing `outcome: success`.

**Self-check that the contract is now LIVE** (do not commit this — it is the proof, not
a change): temporarily set one detector's `severity` to an invalid value and confirm the
`makeFinding` `throw` fires **inside `prepareSimulationData`** (a runtime abort), not only
the vitest `expect(...).toContain`; then revert.

## Files the next phase MUST read

- `docs/reviews/0023-error-report-tab-phase-1-review-01.md` — the full review; Step 5
  (invariant table) + Step 6 (NC-1/NC-2 negative controls) carry the evidence and the
  exact fix.
- `docs/plans/0023-error-report-tab.md` — Phase 1 *Invariants* (I-3/I-4 `[contract]`),
  *Behavioral rule*, *Forbidden shortcuts*, *Data models → Finding*.
- `docs/backlog/0023-error-report-tab/handover-04-atdd-p1.md` — the committed Phase-1
  test contract + RED logs (the tests this fix must keep green; `test_commit = 36d5b1c`).
- `docs/backlog/0023-error-report-tab/handover-05-implement-p1.md` — what was already
  implemented (`impl_commit = d77e0ab`); the new factory layers onto it.
- `tests/acceptance/0023-phase-1-finding-model-property.test.js` — the test-only I-3/I-4
  check (lines 140-163) the runtime contract complements (read-only; do not edit).
- `index.html` — `prepareSimulationData` (the two finding-construction sites) + the
  region after `bucketRowsByGroups` where `makeFinding` belongs.

## Context the next phase needs

- **Boot smoke:** passed (`smoke_command` empty → minimal load check; base GREEN, 13/13
  Phase-1 tests pass at HEAD).
- **Test immutability:** the reviewed range `36d5b1c..d77e0ab` is production-only (zero
  test-file changes). The human-fix commit `fdbb375` (descendant of `d77e0ab`) migrated
  the brittle 0020/0021 tab-bar count assertions to the 7-tab reality and touches **only
  test files + index.md (no `index.html`)** — it is outside the reviewed range and hides
  no bug; the immutability rule is satisfied. **Do not re-touch 0020/0021 tests.**
- **Why FAIL and not PASS:** `contract.enabled` is `false`, so the host gate's opt-in
  structural sub-check (g) does not run — but stage-review Step 5 states the reviewer's
  per-invariant judgement "remains the real check" regardless, and forbids hand-waving a
  FAIL into PASS. The plan deliberately tags I-3/I-4 `[contract]` (vs I-1/I-2 which it
  tags `[test-only]`); 0023 is the first plan in the repo to use `[contract]` at all, so
  there is no precedent treating it as documentation-only.
- **Scope discipline:** this is the ONLY change required. Do not refactor the detectors,
  rename seams, or alter `renderErrorReport`/markup/wiring — all of those passed review.
- **Negative-control evidence (already run by the reviewer, reverted):** NC-1 (break the
  detector → 5 tests fail; suite kills it) PASS; NC-2 (invalid severity → caught only by
  the test, no runtime abort) confirms the dead contract.
- **Mutation:** N/A (`mutation.enabled:false`, ADR-0036).

## Definition of done (for the re-implement)

- A finding factory with runtime assertions for I-3 (severity enum) and I-4
  (`locators.length >= 1`) exists in production, and both Phase-1 detectors construct
  findings through it.
- A deliberate invalid-severity / empty-locators value triggers the factory's `throw`
  inside `prepareSimulationData` (the contract is LIVE, not test-only).
- All 13 Phase-1 tests still pass; `npm run verify` is green under the hermetic checkout.
- No test file changed. Then the slice re-enters `review` (integrity) for re-verification.
