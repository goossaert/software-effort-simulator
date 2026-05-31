---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: review
feature_phase: 6
for_next_phase: atdd
outcome: success
reason: ""
produced_at: 2026-05-31T23:10:20Z
produced_commit: ""
test_commit: ed7426b08c4f51edceac4850f28a95ede9b38f93
impl_commit: bd4c7998bd05086b2481566c9429a74f62f16311
---
## Summary

Independent review of feature 0021 **Phase 6** (the sixth **Constant work tab** — editable table with
smart per-field editors and CSV export). Verdict **PASS**. The `test_commit..impl_commit` diff is
`index.html`-only and implements the general Phase 6 rule; all 8 invariants hold, none of the 6
counterexamples is realizable, and no test file drifted across the boundary. Three negative-control
mutations each flipped the targeted AT(s) to RED and reverted cleanly to GREEN. Full suite green
(`npm run verify` exit 0, 204 passed / 1 skipped). Review file:
`docs/reviews/0021-constant-work-tab-and-group-scoping-phase-6-review-01.md`.

## Instructions for the next phase

Proceed to **Phase 7 atdd** — "Add row / delete row / from-scratch authoring on the Constant work tab".
Read the plan handover (`handover-03-plan.md`) and the plan's **Phase 7** slice (`docs/plans/0021-…md`,
from ~line 1061). Phase 7 builds directly on the Phase 6 surface verified here: `renderConstantWorkTable()`,
`exportConstantWorkCSV()`, the `editedConstantWork` substrate, and the `data-tab="constant-work"` tab.
Author `tests/acceptance/phase-7-*.test.js` and confirm the RED gate before implementing.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the **Phase 7** slice: `+ Add row` (canonical
  schema when nothing imported, imported header set when a CSV was imported), per-row delete (no
  confirmation), from-scratch authoring feeding the simulation with `parsedConstantWork === null`.
- `docs/backlog/0021-constant-work-tab-and-group-scoping/handover-03-plan.md` — the plan handover (input to
  every atdd cycle).
- `index.html` — the Phase 6 surface Phase 7 extends: `renderConstantWorkTable()` (+ `CW_*` recognisers,
  `_cwObservedValues`), `exportConstantWorkCSV()`, the `data-tab="constant-work"` button / `#tab-constant-work`
  panel, the run-handler render call + visibility-reset line, and the `editedConstantWork` substrate
  lifecycle (`loadConstantWorkCSV` clones `parsedConstantWork`; `resetConstantWorkFile` nulls it).
- `docs/adr/0034-editable-constant-work-tab.md` — add/delete/from-scratch is the Phase 7 scope deliberately
  deferred out of Phase 6.
- `tests/acceptance/phase-6-constant-work-tab.test.js` — the frozen Phase 6 seam contract (do not edit).

## Context the next phase needs

Autonomous review decisions taken this session (no user in Loop mode):

- **Diff boundary.** `test_commit = ed7426b` (handover-19-atdd-p6), `impl_commit = bd4c799`
  (handover-20-implement-p6 = HEAD). Production change is `index.html`-only;
  `git diff ed7426b..bd4c799 -- tests features e2e acceptance` is **empty** (no test drift).
- **General rule confirmed (not fixture-keyed).** Column routing is role-based via alias sets
  (`CW_SIZE_COLS`/`CW_CATEGORY_COLS`/`CW_TEAM_COLS`/`CW_QUARTER_COLS`); size options derive from
  `Object.keys(T_SHIRT_PARAMS)` (the production param table, not a literal seven); datalists are computed
  from observed row values across the `editedInitiatives ∪ editedConstantWork` union (team candidates
  `['team','teams']` bridge the initiative-`teams`/CW-`team` naming split). No hard-coded fixtures, no
  ID/env conditionals, no test-helper imports.
- **Escaping nuance (verified, do NOT "fix").** The cell `value="…"` attribute uses **escapeHtml**, not
  escapeAttr. The plan invariant says "attribute values are escapeAttr'd", but frozen AT-11 requires the
  value to round-trip to the literal `<script>alert('x')</script>`; escapeAttr's `'`→`\'` would corrupt it.
  escapeHtml escapes `&<>"` (index.html:3539) — so the double-quoted attribute is XSS-safe (no break-out,
  no tag formation) while `'` survives for exact round-trip. The column key embedded in the `onchange` JS
  subscript still uses `escapeAttr` (its designed context). Resolved as SATISFIED in security/correctness
  intent; the literal invariant wording is superseded by the authoritative frozen test.
- **Coverage observations (non-blocking).** AT-2 verifies the panel-hidden state via the static default
  rather than driving the async run-button visibility-reset block, and the tests invoke
  `renderConstantWorkTable()` directly rather than through the run handler. The two run-handler wiring lines
  (`renderConstantWorkTable();` and `#tab-constant-work → display:none`) are present and correct, verified
  by inspection. No counterexample becomes realizable; no additional verification tests were warranted.
- **Negative controls (each reverted; working tree clean afterwards).**
  1. size set `Object.keys(T_SHIRT_PARAMS)` → `.slice(0,6)` (drop `XL+`): `vitest -t "AT-4:"` → 3 failed.
  2. datalists CW-only (drop the `editedInitiatives` half of catList/teamList/qList): `vitest -t "AT-5:"`
     → 2 failed.
  3. free-text value `escapeHtml(current)` → `escapeAttr(current)`: `vitest -t "AT-11:"` → 1 failed at
     `expect(input.value).toBe(payload)`.
  After reverts: combined acceptance 49 passed; `npm run verify` exit 0 (204 passed / 1 skipped).

GREEN gate re-confirmed this session:
- Combined acceptance:
  `npx vitest run tests/acceptance/phase-6-constant-work-tab.test.js tests/acceptance/phase-2-groups-tab.test.js`
  → exit 0, **49 passed**.
- Full suite: `npm run verify` → exit 0, **204 passed / 1 skipped** (the 1 skip is the pre-existing
  self-skipping `sanity-check-engine-mean.test.js`).
- Test-file drift: `git diff ed7426b..bd4c799 -- tests features e2e acceptance` empty.

## Definition of done

For the consuming **Phase 7 atdd**: author `tests/acceptance/phase-7-*.test.js` (+ any committed-test
migrations the plan names), confirm the RED gate against the post-Phase-6 build, persist RED logs, and
write `handover-NN-atdd-p7.md`. Phase 6 itself is complete and frozen.
