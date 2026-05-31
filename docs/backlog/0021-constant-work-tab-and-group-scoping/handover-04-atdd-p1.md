---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: atdd
feature_phase: 1
for_next_phase: implement
outcome: success
reason: ""
produced_at: 2026-05-31T20:29:59Z
produced_commit: ""
---
## Summary

ATDD for feature 0021 **Phase 1** (`editedConstantWork` substrate — transparent
indirection) is complete. Authored a new acceptance file
`tests/acceptance/phase-1-constant-work-substrate.test.js` covering scenarios
AT-1…AT-9, and migrated the two committed feature-0020 tests this phase names —
`tests/acceptance/phase-1-engine.test.js` **AT-21** and **AT-27** — onto the new
`editedConstantWork` source of truth. The RED gate is confirmed: the combined run
exits **1** with **11 failed / 28 passed** — all 9 new tests fail (because
`editedConstantWork` is undefined / the readers still read `parsedConstantWork`)
plus the 2 migrated tests fail for the same reason. No production code was written.

## Instructions for the next phase

`implement` (feature-phase **1**):

1. Read `docs/plans/0021-constant-work-tab-and-group-scoping.md` **Phase 1** — it is
   the contract (behavioral rule, invariants, counterexamples, forbidden shortcuts,
   definition of done). Implement the substrate inline in `index.html` per ADR-0034:
   - Declare `let editedConstantWork = null;` immediately after
     `let parsedConstantWork = null;` (`index.html:1559`).
   - In `loadConstantWorkCSV` (`index.html:1743`), after `parsedConstantWork = parseCSV(text)`,
     set `editedConstantWork = parsedConstantWork.map(r => ({ ...r }))` (per-row shallow clone).
   - In `resetConstantWorkFile` (`index.html:1733`), set `editedConstantWork = null`
     alongside `parsedConstantWork = null`.
   - Migrate every **production** constant-work reader to read `editedConstantWork`:
     `getConstantWorkEffort` (`index.html:1752`), `getConstantWorkEpics` (`index.html:1770`),
     and the `cwQuarters` derivation in `buildTeamProjections` (`index.html:2109`).
   - **Do NOT** migrate any datalist / option-pool read to `editedConstantWork` (none exist
     yet; they arrive in Phase 6 and must stay on `parsedConstantWork`).
2. Make the tests pass **without editing any test file**. The test commit is the
   enforcement boundary (derive its SHA via
   `git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-04-atdd-p1.md`).
3. GREEN target: `npx vitest run tests/acceptance/phase-1-constant-work-substrate.test.js tests/acceptance/phase-1-engine.test.js`
   exits 0, **and** the full suite `npm run verify` stays green (Phase 1 must not regress
   `phase-2-groups-tab.test.js`, `phase-3-*`, or the `tests/verification/*` files — it is
   transparent indirection, so Run output must be unchanged, per AT-8).

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — **Phase 1** slice is the spec (lines ~254-396): behavioral rule, invariants, counterexamples, forbidden shortcuts, definition of done.
- `tests/acceptance/phase-1-constant-work-substrate.test.js` — the frozen acceptance tests for this phase (read to understand the seam contract; do NOT edit).
- `tests/acceptance/phase-1-engine.test.js` — contains the migrated AT-21/AT-27 (frozen; do NOT edit). Note other ATs here are unaffected by Phase 1 and must stay green.
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-1-acceptance-red.log` — the confirmed acceptance RED gate (command, exit 1, full output).
- `docs/atdd-logs/0021-constant-work-tab-and-group-scoping-phase-1-inner-red.log` — same run; documents that Phase 1 has no separate inner seam.
- `docs/adr/0034-editable-constant-work-tab.md` — the `editedConstantWork` substrate rationale and the `parsed`/`edited` two-array split.
- `docs/adr/0027-editable-initiatives-tab-with-csv-export.md` — the `editedInitiatives`/`parsedInitiatives` pattern this mirrors exactly (`index.html:1556`, `1570`).
- `CONTEXT.md` — glossary; canonical terms (Constant work, Constant Work CSV, Category, Group, Target quarter, Projection group).
- `tests/harness.js` — `loadSimulator`/`read`/`evalIn`/`execIn`/`csv`; note `editedConstantWork` MUST be a top-level lexical binding (like `parsedConstantWork`) so `read(win,'editedConstantWork')` and `execIn(win,'editedConstantWork = …')` resolve it.

The test commit SHA (for `implement`→`review` diffing) is the commit of THIS handover
file (see the `git log` command above). No SHA is embedded here because each phase is one
atomic commit.

## Context the next phase needs

Autonomous decisions taken this session (the interactive Step-4 seam proposal and Step-7
test-API review have no user in Loop mode):

- **Chosen seams (stable, all named in the plan):** the module-scoped `editedConstantWork`
  binding; `loadConstantWorkCSV` (clone) and `resetConstantWorkFile` (null) lifecycle; and
  the three readers `getConstantWorkEffort`, `getConstantWorkEpics`, and
  `buildTeamProjections` (its constant-work-quarter derivation). No new private helper API
  was invented. Per the plan's "Proposed implementation seams", the tests deliberately do
  **not** pin the spread idiom or whether `cwQuarters` is inlined vs extracted — any per-row
  shallow clone preserving key order, read by the production readers, satisfies them.
- **No separate inner-loop seam (Step 4/5 decision):** the plan states Phase 1's substrate
  has no separate inner seam; its Level-3 behaviours (per-row reference independence,
  key-order preservation, null-guard empty returns) are specified inside the acceptance file
  (AT-1, AT-2, AT-7). The `…-inner-red.log` therefore records the same command/run as the
  acceptance gate, annotated to that effect.
- **Migration form (load-bearing for RED):** AT-21 and AT-27 were migrated by assigning the
  fixture to **`editedConstantWork` directly** (not by calling `loadConstantWorkCSV`, and not
  by setting `parsedConstantWork`). This is the only form that stays RED on the current
  build — `loadConstantWorkCSV` would populate `parsedConstantWork`, which the pre-impl
  readers still read, so the tests would pass green prematurely. AT-27 was additionally
  strengthened with `expect(cell.cwEffort).toBe(tshirtToPersonMonths('M'))` and
  `toBeGreaterThan(0)` so its migration genuinely exercises the read-through (it was
  otherwise satisfied by `0 === cwEffort` even pre-impl).
- **Test-API review verdict:** all imposed names match `CONTEXT.md` verbatim (Constant work,
  Constant Work CSV, Category, Group, Target quarter, Projection group); the imposed
  interface is exactly the plan's seam set; no incidental seams. Recommendation: proceed.

RED gate detail (from the persisted logs):
- Command: `npx vitest run tests/acceptance/phase-1-constant-work-substrate.test.js tests/acceptance/phase-1-engine.test.js`
- Exit code: **1** — 11 failed | 28 passed (39 total).
- Reasons: new AT-1…AT-9 fail because `editedConstantWork` is `undefined` and the readers
  read `parsedConstantWork`; migrated AT-21 (`getConstantWorkEpics` → `[]`) and AT-27
  (`cwEffort === 0`) fail because the readers do not yet read `editedConstantWork`. This
  matches the plan's Phase 1 RED gate exactly.

## Definition of done (for implement)

- `npx vitest run tests/acceptance/phase-1-constant-work-substrate.test.js tests/acceptance/phase-1-engine.test.js`
  exits 0 (AT-1…AT-9 + migrated AT-21/AT-27 all pass).
- `npm run verify` (full suite) exits 0 — no regression in any other phase/verification file
  (transparent indirection: a fresh load with no edits produces unchanged Run output, AT-8).
- No test file was edited (test commit SHA is the boundary).
- `git diff` for the implement commit touches only `index.html` (substrate binding + clone +
  null + the three reader migrations).
- `index.md` advanced to `stage: review`, `next_handover: handover-NN-implement-p1.md`.
