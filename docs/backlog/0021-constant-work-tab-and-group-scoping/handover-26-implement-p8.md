---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: implement
feature_phase: 8
for_next_phase: review
outcome: success
reason: ""
produced_at: 2026-05-31T23:48:05Z
produced_commit: pending
---
## Summary

Phase 8 implement (the final feature-phase) is done. Made the Phase-8 acceptance tests
(`tests/acceptance/phase-8-groups-popover-union.test.js`, AT-1…AT-6, 11 `it`s) and the
migrated `tests/acceptance/phase-2-groups-tab.test.js` **AT-28** pass by changing **only**
`index.html` (ADR-0001 single-file) — one function, `_observedCategoriesForPopover()`. The
Groups **Members popover** now sources its observed-Categories option list from the **union of
Categories across `editedInitiatives` ∪ `editedConstantWork`**, computed at popover-open time.
Targeted run 45/45 GREEN; `npm run verify` exits 0 (**226 passed / 1 skipped**, no regression).
No test file was edited.

## Instructions for the next phase

`review` (feature-phase 8) — independent verification for test gaming, overfitting, and
missing cases. Read the plan's **Phase 8** slice and the diff **before** reading the tests.

1. **Derive the diff boundary** (`test_commit..impl_commit`):
   ```bash
   git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-25-atdd-p8.md   # test commit
   git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-26-implement-p8.md # impl commit
   ```
   The test commit is `a67340c` (the atdd-p8 commit); the impl commit is **this** commit.
2. **Verify the general rule, not the literals.** The single production change widens
   `_observedCategoriesForPopover()` (`index.html`, formerly line ~4029) from an
   `editedInitiatives`-only source to the **case-insensitive union** of `editedInitiatives` and
   `editedConstantWork` Categories: it calls `collectObservedCategories(editedInitiatives,
   detectedCols.categoryCol)` and `collectObservedCategories(editedConstantWork, 'category')`
   (the same helper `syncAutoDefaultGroup` uses), seeds the lowercase→casing map from the
   **initiatives first** (Initiative casing wins on a merge), adds constant-work Categories not
   already present (constant-work-only keeps its own casing), **excludes the BLANK sentinel**
   (the popover renders a dedicated `(Blank)` row), and sorts alphabetically (case-insensitive).
3. **Confirm the open-time recompute.** `openMembersPopover` (`index.html` ~line 4047) calls
   `_observedCategoriesForPopover()` on **every** open — the union is recomputed at open time, not
   cached from render (AT-6 second `it`). Confirm nothing memoises it.
4. **Confirm the untouched surfaces.** The `(Blank)` row + free-text input in `openMembersPopover`
   are unchanged; the engine, the per-Group scoping helpers
   (`getConstantWorkEffortPerGroup` / `getConstantWorkExcluded`), and the Constant work tab are
   **not** touched — AT-4 only *reads* those existing seams. The diff should be `index.html`-only
   and confined to `_observedCategoriesForPopover()`.
5. **Run** `npx vitest run tests/acceptance/phase-8-groups-popover-union.test.js
   tests/acceptance/phase-2-groups-tab.test.js` (expect 45 pass) then `npm run verify`
   (expect 226 passed / 1 skipped); both must exit 0. Confirm **no test file drifted** across
   `test_commit..impl_commit`.
6. **This is feature-phase 8 of 8** (`total_phases: 8`). On **PASS**, advance per LOOP-MODE.md
   to `stage: done`, `status: done` (k = N), append the review path to `artifacts.reviews`. On
   FAIL, write `handover-NN-review-p8.md` with the findings and bump `retry_count`.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the **Phase 8** slice (lines
  ~1182–1289): behavioral rule, 4 invariants, 4 counterexamples, forbidden shortcuts, RED gate,
  test-immutability rule.
- `tests/acceptance/phase-8-groups-popover-union.test.js` — the frozen Phase-8 acceptance tests
  (AT-1…AT-6, 11 `it`s): the contract satisfied.
- `tests/acceptance/phase-2-groups-tab.test.js` — the migrated **AT-28** (union assertion, lines
  ~587–611) plus the unchanged popover-behavior guards AT-10/11/12/29/30 that stay GREEN.
- `index.html` — the single production change: `_observedCategoriesForPopover()` (union) and its
  caller `openMembersPopover` (open-time recompute, untouched `(Blank)`/free-text).
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` — why constant-work Categories
  become targetable by Groups (this popover merge is the affordance).
- `docs/adr/0028-category-as-generalized-moscow.md` — the case-insensitive Category comparison +
  (Blank) sentinel semantics reused for the merge.
- `CONTEXT.md` — glossary (Constant work, Category, Group, (Blank) sentinel, Data preview).

## Context the next phase needs

**Autonomously-taken decisions (no user in Loop mode):**

- **Reused the established union helper.** Rather than write a fresh union, I reused
  `collectObservedCategories(rows, categoryCol)` — the exact helper `syncAutoDefaultGroup` uses
  for the auto-default `All` union — applied to `editedInitiatives` (via `detectedCols.categoryCol`)
  and `editedConstantWork` (via the canonical `'category'` key). This guarantees the popover's
  union uses the **same** trim + case-fold + (Blank) sentinel semantics as the rest of the feature.
  The plan explicitly leaves "whether the union helper is shared with the Phase 6 datalist union"
  unlocked; I chose to share the Phase-2 auto-default helper (closest semantic match).
- **BLANK is excluded from the option list.** `collectObservedCategories` pushes the BLANK
  sentinel last when any source has a blank Category; the popover drops it (`if (cat === BLANK)
  continue;`) because the popover already renders a **dedicated `(Blank)` checkbox row** — exactly
  the pre-Phase-8 behavior (AT-5 guard stays GREEN).
- **Dropped the `editedInitiatives`-empty early return.** The old code returned `[]` when
  `editedInitiatives` was empty; that would have hidden constant-work-only Categories with no
  initiatives loaded. Removing it makes the union honest (and `collectObservedCategories` is
  null/empty-safe, returning `[]` per source). All Phase-8 tests load at least one initiative, so
  this is a correctness widening, not a test-driven branch.
- **Casing-merge order = Initiative wins.** The map is seeded by iterating
  `[...initCats, ...cwCats]` and `if (!firstSeen.has(lc))` — initiatives first → Initiative casing
  wins on a case-insensitive merge (AT-2); a constant-work-only Category keeps its own casing
  (AT-3). Identical to `syncAutoDefaultGroup`'s seed order.

**RED→GREEN shape (record):** of the 11 Phase-8 `it`s, 7 were RED drivers (AT-1 happy, AT-1
property, AT-3 ×2, AT-4, AT-6 ×2) and 4 were preserved-behavior guards already GREEN
(AT-1 negative, AT-2 ×2, AT-5); the migrated AT-28 was the 8th RED test. After the union widen
all 8 RED tests flipped GREEN and the 4 guards stayed GREEN. Full suite went 218 → **226**
(8 flips), 1 skipped unchanged (the self-skipping `sanity-check-engine-mean.test.js`).

**Suggested negative control for review:** revert `_observedCategoriesForPopover()` to read only
`collectObservedCategories(editedInitiatives, …)` (drop the `cwCats` union) → AT-1 happy/property,
AT-3, AT-4, AT-6, and AT-28 fail (constant-work-only Categories absent); restore → 45/45 GREEN.
A second control: seed the map from `cwCats` first (constant work wins casing) → AT-2 fails
(`backend` instead of `Backend`); restore → GREEN.

## Definition of done (for review — verdict PASS)

- The diff implements the general union rule (`index.html`-only, confined to
  `_observedCategoriesForPopover()`): the popover option list = case-insensitive union of
  `editedInitiatives` ∪ `editedConstantWork` Categories, Initiative casing wins on a merge,
  constant-work-only keeps its own, computed at open time; `(Blank)` row + free-text input remain.
- None of the 4 counterexamples is realizable; all 4 invariants hold.
- No fixture literals / test-keyed branches / env checks / `tests/` imports.
- No test file drifted across `test_commit..impl_commit`.
- `npx vitest run tests/acceptance/phase-8-groups-popover-union.test.js
  tests/acceptance/phase-2-groups-tab.test.js` (45 pass) and `npm run verify`
  (226 passed / 1 skipped) both exit 0.
