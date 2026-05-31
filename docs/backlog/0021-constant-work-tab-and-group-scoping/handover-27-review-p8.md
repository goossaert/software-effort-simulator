---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: review
feature_phase: 8
for_next_phase: done
outcome: success
reason: ""
produced_at: 2026-05-31T23:55:15Z
produced_commit: pending
test_commit: a67340c59099470b10b1a420ad3793e845607838
impl_commit: 19689faf4fd801b4d57ae8b61f93123e0ad1de67
---
## Summary

Phase 8 review — **the final feature-phase** — verdict **PASS**. Independent verification
(diff `a67340c..19689fa`) confirmed the single production change (`index.html`-only, confined to
`_observedCategoriesForPopover()`) implements the general union rule: the Groups **Members
popover** option list is the **case-insensitive union of `editedInitiatives` ∪
`editedConstantWork`** Categories, computed at **popover-open time**, with **Initiative casing
winning** on a merge and a constant-work-only Category keeping its own casing, reusing the shared
`collectObservedCategories` helper (same trim + case-fold + (Blank)-sentinel semantics as
`syncAutoDefaultGroup`). All 4 invariants hold; none of the 4 counterexamples is realizable; no
test file drifted across `test_commit..impl_commit`; no gaming pattern. Two negative controls each
flipped exactly the predicted ATs to RED and reverted to 45/45 GREEN. Targeted (45 pass) +
`npm run verify` (226 passed / 1 skipped) both exit 0. **Transitioned to `stage: done`,
`status: done` (k = N = 8). Feature 0021 is complete.**

## Instructions for the next phase

None — this is feature-phase 8 of `total_phases: 8`. The task is **done** (`stage: done`,
`status: done`). No further atdd/implement/review cycle runs. The loop terminates this task.

## Files the next phase MUST read

(n/a — task complete) For the human record:
- `docs/reviews/0021-constant-work-tab-and-group-scoping-phase-8-review-01.md` — the full Phase 8
  review (Steps 1–7, verdict, both negative controls).
- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the Phase 8 slice (lines ~1182–1289).
- `index.html` — `_observedCategoriesForPopover()` (the union) + `openMembersPopover` (open-time
  recompute; untouched `(Blank)`/free-text).

## Context the next phase needs

**Autonomously-taken decisions (no user in Loop mode):**

- **Verdict PASS, no findings.** The diff is `index.html`-only and confined to
  `_observedCategoriesForPopover()`; every invariant is satisfied by construction and every
  counterexample is non-realizable (each pinned by an AT and reproduced by a negative-control
  mutation). No production fix required; no test edits (none allowed).
- **Negative controls chosen.** (1) `cwCats = []` (drop the constant-work side of the union) →
  8 fail: AT-1 happy+property, AT-3 ×2, AT-4, AT-6 ×2, and the migrated AT-28 — reproduces
  counterexample 1 ("lists only `editedInitiatives` Categories"). (2) iterate
  `[...cwCats, ...initCats]` (constant work seeded first) → AT-2 ×2 fail (`backend` not `Backend`)
  — reproduces counterexample 3 (constant-work casing overrides Initiative casing). Both reverted;
  working tree byte-identical to HEAD; 45/45 GREEN restored.
- **`'category'` literal is not a fixture.** It is the canonical constant-work schema key, the same
  one `getConstantWorkEffortPerGroup` (`index.html:1863`) and `syncAutoDefaultGroup`
  (`index.html:1658`) read — not a test artifact.
- **State transition (review owns it).** PASS at k = N → `stage: done`, `status: done`, appended
  `docs/reviews/0021-…-phase-8-review-01.md` to `artifacts.reviews`, refreshed `updated_at`,
  `current_phase` left at 8, `retry_count` left at 0.

**Commit SHAs (derived):** `test_commit = a67340c` (atdd-p8), `impl_commit = 19689fa` (implement-p8).

**Green evidence:**
- `npx vitest run tests/acceptance/phase-8-groups-popover-union.test.js tests/acceptance/phase-2-groups-tab.test.js` → 45 passed, exit 0.
- `npm run verify` → 226 passed / 1 skipped, exit 0 (the 1 skipped is the pre-existing
  self-skipping `sanity-check-engine-mean.test.js`).

## Definition of done

Met. This is the terminal phase of the task:
- Diff implements the general union rule (`index.html`-only, confined to
  `_observedCategoriesForPopover()`); Initiative casing wins; constant-work-only keeps its own;
  open-time recompute; `(Blank)` row + free-text input remain.
- All 4 invariants hold; none of the 4 counterexamples is realizable.
- No fixture literals / test-keyed branches / env checks / `tests/` imports; no test file drifted.
- Targeted (45 pass) + `npm run verify` (226 pass / 1 skip) both exit 0.
- Task transitioned to `stage: done`, `status: done`.
