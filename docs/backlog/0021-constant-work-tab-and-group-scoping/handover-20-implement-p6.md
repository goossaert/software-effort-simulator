---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: implement
feature_phase: 6
for_next_phase: review
outcome: success
reason: ""
produced_at: 2026-05-31T23:04:00Z
produced_commit: ""
---
## Summary

Implemented feature 0021 **Phase 6** — the sixth **Constant work tab** (an editable table with
smart per-field editors and CSV export) — inline in `index.html`, the only production file touched.
A `data-tab="constant-work"` tab button is inserted fifth (between Initiatives and Groups); a
`#tab-constant-work` panel wraps `#constant-work-table-wrap`; `renderConstantWorkTable()` renders
`editedConstantWork` with **all cells editable** (size `<select>`, category/team/quarter
`<input list>` datalist combos seeded from the `editedInitiatives ∪ editedConstantWork` union, and
free-text for everything else); `exportConstantWorkCSV()` downloads `constant-work-edited.csv`
preserving the imported header set verbatim; edits commit to `editedConstantWork` immediately and
call `tryUpdatePreview()` (no Run — commit-on-Run). GREEN confirmed: the plan's combined acceptance
command passes **49/49** (Phase 6: 15 `it`s; Phase 2: all 34 incl. the migrated AT-1), the focused
inner run (`-t "AT-4:"`) passes 3 / 12 skipped, and `npm run verify` exits **0** with **204 passed /
1 skipped** — the 16 RED tests flipped, no regression. No test file was edited.

## Instructions for the next phase

`review` (feature-phase **6**) — independent verification of the Phase 6 implementation against the
plan. Derive the diff boundary from git log:

```bash
git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-19-atdd-p6.md      # test commit
git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-20-implement-p6.md # impl commit (this handover)
```

Review the `test_commit..impl_commit` diff (it is `index.html`-only). Confirm the general rule, the
invariants, that none of the counterexamples is realizable, and that no test file drifted across the
boundary. Suggested negative controls (revert each after):
- **Size `<select>` is exactly the seven canonical sizes:** mutate the size-option source to the
  *observed* sizes only (drop the canonical `Object.keys(T_SHIRT_PARAMS)`) → AT-4 (recognised
  `.toEqual(SEVEN_SIZES)`) and the unrecognised-`XXL` boundary fail.
- **Datalist is the union, not CW-only:** make the category/team/quarter datalists read
  `editedConstantWork` only (drop the `editedInitiatives` half of `_cwObservedValues`) → AT-5 fails
  (initiative-only `A`/`B`, and the initiative `Platform`/`Q2 2026` values, disappear).
- **Cell escaping round-trips:** swap the free-text `value="${escapeHtml(current)}"` to
  `escapeAttr(current)` → AT-11 fails (`escapeAttr` turns the payload's `'` into `\'`, so
  `input.value` no longer equals the literal `<script>alert('x')</script>`). This is the recorded
  escaping decision below — verify it, do not "fix" it back to escapeAttr.
- **Imported header verbatim on export:** any normalisation/reorder of `Papa.unparse`'s field set →
  AT-8 fails (`tshirt_size`/`jira_key` would appear; column order would change).

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the **Phase 6** slice (lines
  ~903-1058): behavioral rule, invariants, counterexamples, forbidden shortcuts, definition of done.
- `tests/acceptance/phase-6-constant-work-tab.test.js` — the frozen Phase 6 acceptance tests
  (AT-1…AT-11, 15 `it`s). **Read for the seam contract; do NOT edit.**
- `tests/acceptance/phase-2-groups-tab.test.js` — its **AT-1** scenario was migrated to six tabs in
  the ATDD session and is frozen; AT-2…AT-33 unchanged.
- `docs/backlog/0021-constant-work-tab-and-group-scoping/handover-19-atdd-p6.md` — the ATDD handover:
  the seam choices, the AT-2 verification decision, the triangulation map, and the RED gate detail.
- `index.html` — the only production file changed. The Phase 6 surface:
  - tab button `data-tab="constant-work"` (search `data-tab="constant-work"`);
  - panel `#tab-constant-work` wrapping `#constant-work-table-wrap`;
  - `function renderConstantWorkTable()` + the `CW_SIZE_COLS`/`CW_CATEGORY_COLS`/`CW_TEAM_COLS`/
    `CW_QUARTER_COLS` recognisers + the `_cwObservedValues` union helper (just after
    `renderInitiativesTable`);
  - `function exportConstantWorkCSV()` (just after `exportInitiativesCSV`);
  - the `renderConstantWorkTable();` call + `#tab-constant-work` reset line in the run-button handler;
  - the `#constant-work-table-wrap` CSS block (after `.initiatives-toolbar`).
- `docs/adr/0034-editable-constant-work-tab.md` — design rationale (sixth tab, editable substrate,
  smart editors, CSV export verbatim, commit-on-Run; add/delete/from-scratch is **Phase 7**).
- `docs/adr/0027-editable-initiatives-tab-with-csv-export.md` — the editable-tab + commit-on-Run +
  immutable-substrate pattern this phase mirrors.
- `docs/adr/0023-constant-work-csv-deterministic-shift.md` — the alias cascade
  (`category|moscow|emoji`, `tshirt_size|t_shirt_size`, `epic_name|building_block`,
  `jira_key|epic_key`, `key_result|KR|kr`) the editors + export respect.
- `docs/adr/0028-category-as-generalized-moscow.md` — case-insensitive Category + the (Blank)
  sentinel; relevant context for the category datalist.

## Context the next phase needs

Autonomous decisions taken this session (no user in Loop mode):

- **General rule each change implements (Step 5 honesty check):**
  - Tab button + panel markup → "a sixth **Constant work** Tab is inserted after **Initiatives**
    (fifth, before **Groups**) and exposes `#constant-work-table-wrap`."
  - `renderConstantWorkTable()` → "renders `editedConstantWork` as a fully-editable table with the
    per-field editor rule: size `<select>` of the seven canonical sizes; category/team/quarter
    `<input list>` datalist combos seeded from the `editedInitiatives ∪ editedConstantWork` union;
    everything else free-text; inline edits commit to `editedConstantWork` and refresh the preview,
    never Run."
  - `exportConstantWorkCSV()` → "exports the edited constant work to `constant-work-edited.csv`
    preserving the imported header set verbatim (round-trips)."
- **Editor-rule column recognisers (the general rule, not fixture literals):** size cols =
  `{tshirt_size, t_shirt_size}`; datalist cols = category `{category, moscow, emoji}` ∪ team `{team}`
  ∪ quarter `{quarter}` (ADR-0023 aliases); all other column keys → free text. The table columns are
  `Object.keys(editedConstantWork[0])` (the *edited* substrate, not `parsedConstantWork`, because the
  tests mount rows directly on `editedConstantWork`). No column is read-only.
- **Datalist union helper (`_cwObservedValues`):** collects observed, trimmed, non-empty, first-seen
  de-duplicated values for a candidate-column set across a rows array; applied to **both**
  `editedInitiatives` and `editedConstantWork` for each of category/team/quarter. The candidate sets
  intentionally span both naming conventions — team uses `['team', 'teams']` so the initiative
  `teams` column and the constant-work `team` column both contribute (this is the union the
  counterexample "datalist seeded only from editedConstantWork" forbids). Datalist `id`s
  (`cw-category-options` / `cw-team-options` / `cw-quarter-options`) are **not** plan-named — the
  tests resolve them dynamically via each input's `list` attribute, so the ids are an incidental
  implementation detail (free to rename).
- **Escaping decision (recorded — important for review):** free-text and datalist-combo cell `value`
  attributes and the size-option labels/values use **`escapeHtml`**, not `escapeAttr`. AT-11 requires
  `input.value` to equal the literal payload `<script>alert('x')</script>` exactly. `escapeAttr`
  replaces `'`→`\'` (it is built for JS-string-in-attribute contexts like `onclick="f('…')"`), which
  would make the parsed attribute value `<script>alert(\'x\')</script>` and fail the round-trip.
  `escapeHtml` escapes `&<>"` to entities (so `<script>` cannot parse as a tag and `"` cannot break
  the attribute) while leaving `'` intact, and the entities decode back to the exact original — so
  the value round-trips AND the payload is inert. The handler-attribute column key still uses the
  `safeCol = escapeAttr(col)` idiom (it is embedded inside the single-quoted `['…']` JS subscript, the
  context `escapeAttr` is designed for). This is the one place the implementation deviates from the
  handover's "escapeAttr for attribute values" guidance, and it is required by the test.
- **Size-`<select>` unrecognised-value handling:** when the current size is non-empty and not one of
  the seven, it is **appended** as an extra option and marked selected (`[...sizes, current]`), so the
  seven canonical options are always present (AT-4 `toContain` each) and no imported data is lost
  (AT-4 `toContain('XXL')` + `select.value === 'XXL'`). When the value is recognised (or empty), the
  option list is exactly the seven, so AT-4's `.toEqual(SEVEN_SIZES)` holds.
- **Empty state:** when `editedConstantWork` is null/empty, the wrap shows a single
  "No constant work loaded." message (one `innerHTML` assignment — invariant preserved). The
  `+ Add row` authoring affordance is **Phase 7**, deliberately out of scope.
- **Run-handler wiring:** `renderConstantWorkTable()` is called next to `renderInitiativesTable()`;
  `#tab-constant-work` is reset to `display:none` in the visibility-reset block (so a fresh Run lands
  on Organization Level with the Constant work panel hidden — the seam AT-2 verifies via default
  state).
- **No `editedConstantWork` engine coupling changed:** constant work still contributes **zero** to
  any Group's `kPerGroup` / Poisson λ / bootstrap pool. This phase is UI-only; the Phase 1–5 engine
  path (`getConstantWorkEffortPerGroup`, etc.) is untouched. AT-7 confirms the edited size flows into
  `getConstantWorkEffortPerGroup` on the next Run as a purely additive shift.

GREEN gate detail:
- Combined acceptance:
  `npx vitest run tests/acceptance/phase-6-constant-work-tab.test.js tests/acceptance/phase-2-groups-tab.test.js`
  → exit **0**, **49 passed** (15 Phase 6 + 34 Phase 2).
- Focused inner: `npx vitest run tests/acceptance/phase-6-constant-work-tab.test.js -t "AT-4:"`
  → exit **0**, 3 passed / 12 skipped.
- Full suite: `npm run verify` → exit **0**, **204 passed / 1 skipped** (the 1 skip is the
  pre-existing self-skipping `sanity-check-engine-mean.test.js`). Full log at `.agent/last-verify.log`.
  The `Not implemented: navigation` / canvas `getContext` lines in the output are pre-existing
  harmless jsdom warnings (anchor `.click()` in the export path, Chart stub), not failures.
- Test-file drift: `git diff --name-only <test_commit>..HEAD -- tests features e2e acceptance` is
  empty; the working-tree change is `index.html` only.

## Definition of done (for review)

- Verdict PASS only if the diff implements the general Phase 6 rule (`index.html`-only), all eight
  invariants hold, none of the six counterexamples is realizable, and no test file drifted across
  `test_commit..impl_commit`.
- The negative controls above should each flip the named AT(s) to RED and revert cleanly to GREEN.
- On PASS: append the review file to `artifacts.reviews`, advance to **Phase 7 atdd**
  (`current_phase: 7`, `retry_count: 0`, `stage: atdd`, `next_handover` → the plan handover). On
  FAIL: `stage: implement`, `retry_count += 1`, write `handover-NN-review-p6.md` with precise
  findings.
</content>
</invoke>
