---
schema: backlog-handover/v1
task_id: "0023"
produced_by_phase: implement
feature_phase: 1
for_next_phase: review
outcome: blocked
reason: "frozen tests 0020-AT-1 / 0021-AT-1 assert toHaveLength(6) and an exact slug array ending in groups — any 7th .tab-btn in .tab-bar breaks them; cannot satisfy alongside 0023-AT-1 (error-report must be last .tab-btn in .tab-bar) without editing frozen test files"
produced_at: 2026-06-22T22:05:00Z
produced_commit: ""
total_phases: 6
---
## Summary

implement for Phase 1 (feature 0023 error-report-tab) is **BLOCKED** by a conflict
between the newly committed 0023 Phase-1 tests and two older frozen test suites
(`0020-phase-2-groups-tab.test.js` and `0021-phase-6-constant-work-tab.test.js`).

The Phase-1 production code is **functionally complete and correct**: all 13
Phase-1 tests (6 acceptance + 7 inner/property) pass stably across 4 reruns
including a randomized-order run. However `npm run verify` exits 1 because the two
older suites also run as part of `vitest run` and their AT-1 assertions break with
the new tab.

## Conflict detail

### What 0023 AT-1 requires (frozen — cannot be changed by implement)

```javascript
// tests/acceptance/0023-phase-1-error-report-tab.test.js AT-1
const btns = win.document.querySelectorAll('.tab-bar .tab-btn');
expect(btns.length).toBeGreaterThan(0);
const last = btns[btns.length - 1];
expect(last.dataset.tab).toBe('error-report');          // error-report MUST be last
expect(last.textContent.trim()).toBe('Error Report');
```

This requires a `<button class="tab-btn" data-tab="error-report">` INSIDE `.tab-bar`
and as the LAST `.tab-bar .tab-btn`.

### What 0020 AT-1 requires (frozen — cannot be changed by implement)

```javascript
// tests/acceptance/0020-phase-2-groups-tab.test.js AT-1
const buttons = Array.from(win.document.querySelectorAll('.tab-btn'));
expect(buttons).toHaveLength(6);                        // EXACTLY 6 buttons
expect(buttons.map(b => b.dataset.tab)).toEqual([
  'org', 'teams', 'projections', 'initiatives', 'constant-work', 'groups',
]);                                                     // groups MUST be last
```

### What 0021 AT-1 requires (frozen — cannot be changed by implement)

```javascript
// tests/acceptance/0021-phase-6-constant-work-tab.test.js AT-1
const buttons = Array.from(win.document.querySelectorAll('.tab-btn'));
expect(buttons).toHaveLength(6);                        // EXACTLY 6 buttons
expect(buttons.map(b => b.dataset.tab)).toEqual([
  'org', 'teams', 'projections', 'initiatives', 'constant-work', 'groups',
]);
```

### Why they are irreconcilable

`querySelectorAll('.tab-btn')` (0020/0021) and `querySelectorAll('.tab-bar .tab-btn')`
(0023) both select via the `.tab-btn` class. A `<button class="tab-btn" …>` inside
`.tab-bar` is found by BOTH selectors. Adding any 7th `.tab-btn` inside `.tab-bar`
therefore:

- satisfies `last.dataset.tab === 'error-report'` (0023 AT-1) ✓
- breaks `toHaveLength(6)` (0020/0021 AT-1) ✗
- breaks `.toEqual([…, 'groups'])` (0020/0021 AT-1) ✗

No production-only change can satisfy all three constraints simultaneously.

## What was implemented

The production changes ARE committed and the Phase-1 tests pass:

1. **Tab button** — `<button class="tab-btn" data-tab="error-report">Error Report</button>`
   added as last child of `.tab-bar` (after `groups`).
2. **Tab panel** — `<div id="tab-error-report" class="tab-panel" style="display:none">`
   added after the `#tab-groups` panel.
3. **`renderErrorReport(findings)`** — new top-level function: renders the empty-state
   text when `findings` is empty; groups by category, sorts `ERROR → WARNING → INFO`
   then code then first-locator id (explicit sort), shows a by-severity count badge.
4. **`prepareSimulationData` additively returns `findings`** — collects
   `UNRECOGNIZED_SIZE_EPIC` (ERROR) findings from the epicSizingDist loop and
   `UNRECOGNIZED_SIZE_CONSTANT_WORK` (WARNING) findings from target-quarter constant
   work rows; all existing return values unchanged (I-1 advisory invariant satisfied).
5. **Run-handler wired** — destructures `findings` from `prepareSimulationData`,
   calls `renderErrorReport(findings)` in the completed-Run path, and adds
   `#tab-error-report` to the tab-reset block.

### Evidence

```
command: npx vitest run tests/acceptance/0023-phase-1-error-report-tab.test.js tests/acceptance/0023-phase-1-finding-model-property.test.js
exit_code: 0
result: 13/13 passed (stable across 4 reruns including randomized order)
```

```
command: npm run verify
exit_code: 1
failures:
  tests/acceptance/0020-phase-2-groups-tab.test.js AT-1: toHaveLength(6) failed (got 7)
  tests/acceptance/0021-phase-6-constant-work-tab.test.js AT-1: toHaveLength(6) failed (got 7)
```

## Required human action

The two frozen tests (`0020-phase-2-groups-tab.test.js` and
`0021-phase-6-constant-work-tab.test.js`) AT-1 have **brittle exact-count assertions**
that break with any future tab addition. They were correct at the time they were
written (6 tabs) but did not anticipate future tab growth.

A **test-fix phase** is needed to loosen the 0020/0021 AT-1 assertions so they check
the correct invariant (constant-work is fifth, groups is sixth — i.e. positional
relationships) without hard-coding the total count. The frozen 0023 tests must remain
unchanged. Proposed fix for each:

```javascript
// BEFORE (0020/0021 AT-1):
expect(buttons).toHaveLength(6);
expect(buttons.map(b => b.dataset.tab)).toEqual([
  'org', 'teams', 'projections', 'initiatives', 'constant-work', 'groups',
]);

// AFTER (loosened to not break on future tabs):
const tabDatas = buttons.map(b => b.dataset.tab);
expect(tabDatas.indexOf('constant-work')).toBe(4);         // constant-work stays 5th
expect(tabDatas.indexOf('groups')).toBe(5);                // groups stays 6th
// (or whatever positional invariants the test intends to verify)
```

Once those two tests are updated (in a separate commit approved by a human), this
implement phase can resume and `npm run verify` will pass.

## Autonomous decisions taken this phase

1. **Partial commit policy.** The working production code is committed alongside this
   blocked handover because: (a) the Phase-1 tests pass stably and the implementation
   is functionally complete; (b) committing allows the human to inspect the diff and
   the git history preserves the work; (c) reverting and re-implementing after the
   test fix would be wasteful.

2. **`flagged_for_human: true` set in index.md.** The conflict requires human
   intervention (test-fix) and cannot be resolved autonomously.
