---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: atdd
feature_phase: 8
for_next_phase: implement
outcome: success
reason: ""
produced_at: 2026-05-31T23:42:42Z
produced_commit: pending
---
## Summary

Phase 8 ATDD (the final feature-phase) is done. Authored
`tests/acceptance/phase-8-groups-popover-union.test.js` (AT-1…AT-6, 11 `it`s) for the
**Groups Members popover** sourcing its observed-Categories option list from the **union of
`editedInitiatives` ∪ `editedConstantWork`**, computed at popover-open time, and migrated
`tests/acceptance/phase-2-groups-tab.test.js` **AT-28** onto that union. Both RED gates are
confirmed with persisted logs; no production code was written. The plan's `Phase 8` slice is
the contract.

## Instructions for the next phase

`implement` (feature-phase 8):

1. Make the Phase-8 acceptance tests + the migrated AT-28 pass by changing **only**
   `index.html` (ADR-0001 single-file). The behavioral rule: the Members popover's
   observed-Categories list (and the addable-Category source) sources from the
   **union of Categories across `editedInitiatives` AND `editedConstantWork`**, computed
   at popover-open time, so it reflects the current edited state of both tabs.
2. The current source is `_observedCategoriesForPopover()` (`index.html:4029`), which reads
   **only** `editedInitiatives` (sorted alphabetically by first-seen casing). Widen it to the
   union: seed the casing map from `editedInitiatives` first (Initiative casing wins on a
   case-insensitive merge), then add `editedConstantWork` Categories not already present
   (constant-work-only Categories keep their own casing); dedup case-insensitively. Constant
   work's Category lives under the canonical `category` key (use the same
   `category → moscow → emoji` cascade / `normalizeCategory` + **(Blank) sentinel** semantics
   the rest of the feature uses — cf. `collectObservedCategories(editedConstantWork, 'category')`
   in `syncAutoDefaultGroup`, `index.html:1658`). The `(Blank)` row and the free-text input in
   `openMembersPopover` (`index.html:4047`) are **unchanged**.
3. Do NOT edit any test file. Do NOT touch the engine, the per-Group scoping helpers
   (`getConstantWorkEffortPerGroup` / `getConstantWorkExcluded`), or the Constant work tab —
   AT-4 only *reads* those existing seams to confirm that adding a constant-work Category to a
   Group scopes its work on the next Run.
4. Run the Phase-8 verification command, then `npm run verify`; both must exit 0 with no
   regression (expect the 8 RED tests to flip GREEN — full suite → 226 passed / 1 skipped).

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the **Phase 8** slice is the spec
  (behavioral rule, invariants, counterexamples, forbidden shortcuts, RED gate,
  test-immutability rule). Lines ~1182–1289.
- `tests/acceptance/phase-8-groups-popover-union.test.js` — the frozen Phase-8 acceptance tests
  (the contract to satisfy).
- `tests/acceptance/phase-2-groups-tab.test.js` — the migrated **AT-28** (union assertion) plus
  the unchanged popover-behavior guards (AT-10/11/12/29/30) that must stay GREEN.
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-8-acceptance-red.log` — the
  acceptance RED gate (command, UTC timestamp, exit 1, full output).
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-8-inner-red.log` — the focused
  inner RED gate (`-t "AT-1:"`, exit 1).
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-8-verify-ci.log` — full-suite
  RED baseline (8 failed / 218 passed / 1 skipped, exit 1).
- `CONTEXT.md` — glossary (Constant work, Category, Group, (Blank) sentinel, Data preview).
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` — why constant-work Categories
  become targetable by Groups (this popover merge is the affordance).
- `docs/adr/0028-category-as-generalized-moscow.md` — case-insensitive Category comparison +
  the (Blank) sentinel reused for the merge.

Derive the **test commit SHA** (the test-immutability boundary) from:
`git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-25-atdd-p8.md`

## Context the next phase needs

**Autonomously-taken seam decisions (no user in Loop mode):**

- **Popover open + option-list read seam.** Tests open the popover via the established Phase-2
  affordance `#groups-table-wrap .group-add-chip-btn` (`.click()`; inline handlers fire in the
  jsdom harness) and read the option list from the DOM via `.ms-option`/`label` text (the same
  way feature-0020 AT-10/AT-28 do), excluding the dedicated `(Blank)` row and the free-text
  add-row. Per the plan's "Do NOT lock in", the popover DOM is deliberately **not** constrained
  beyond the option-list contents and the `(Blank)`/free-text affordances — implement is free to
  share or not share the union helper with the Phase-6 datalist union.
- **Constant-work Category key.** Tests put the Category under the canonical `category` key
  (consistent with `getConstantWorkEffortPerGroup` and `syncAutoDefaultGroup`'s
  `collectObservedCategories(editedConstantWork, 'category')`). Implement should read the same.
- **AT-4 asserts the scoping *consequence* through existing engine seams**, not new ones:
  after the user checks the `Ops` checkbox (which exists *only* because the popover now sources
  the union), `getConstantWorkEffortPerGroup(['Q3 2026'], groupsStore)[0]` must equal
  `tshirtToPersonMonths('M')` and `getConstantWorkExcluded(['Q3 2026'], groupsStore)` must be
  `{pm:0, rows:0}`. These helpers are already implemented (Phases 2/5); implement must not
  change them.
- **`editedConstantWork` is set directly** in tests via the established `execIn(win,
  'editedConstantWork = …')` idiom (reassigning the `let`), mirroring Phases 2–7 — so the
  auto-default-group sync is bypassed and `groupsStore` is exactly what each test sets.

**Triangulation coverage (so implement knows what's pinned):** AT-1 happy + a negative
(category in neither source absent) + a property (every distinct CW Category appears);
AT-2 happy merge + a multi-variant case-insensitive-dedup property; AT-3 happy + a mixed-case
boundary; AT-4 a before/after pair (excluded → scoped); AT-5 preserved-behavior guard;
AT-6 happy (both tabs' unsaved edits appear) + a recompute-on-reopen property (proving the
union is computed at open time, not cached).

**RED-gate shape (record):** of the 11 Phase-8 `it`s, **7 are RED drivers** (AT-1 happy,
AT-1 property, AT-3 ×2, AT-4, AT-6 ×2) and **4 are preserved-behavior guards GREEN on the
current build** (AT-1 negative, AT-2 ×2, AT-5) — AT-2 trivially holds pre-implementation
because the current popover lists only `editedInitiatives`, so the single `Backend` entry is
already correctly Initiative-cased; it must *stay* GREEN after the union widens. The migrated
AT-28 is the 8th RED test. This GREEN-guard-inside-the-RED-gate shape matches Phases 4 and 5.

## Definition of done (for implement)

- All 11 `it`s in `phase-8-groups-popover-union.test.js` pass, and the migrated
  `phase-2-groups-tab.test.js` AT-28 passes (and AT-10/11/12/29/30 stay GREEN).
- The Members popover sources from `editedInitiatives ∪ editedConstantWork`, computed at open
  time; merge casing = Initiative wins, constant-work-only keeps its own, case-insensitive dedup;
  the `(Blank)` row and free-text input remain.
- `npx vitest run tests/acceptance/phase-8-groups-popover-union.test.js tests/acceptance/phase-2-groups-tab.test.js`
  exits 0, and `npm run verify` exits 0 (226 passed / 1 skipped) with no regression.
- No test file is edited; the only production change is `index.html`.
