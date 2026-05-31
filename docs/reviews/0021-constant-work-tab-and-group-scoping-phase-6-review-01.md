# Review — 0021 constant-work-tab-and-group-scoping — Phase 6, run 01

- **Plan:** `docs/plans/0021-constant-work-tab-and-group-scoping.md` (Phase 6: Constant work tab — editable table with smart per-field editors and CSV export)
- **Phase:** 6
- **Review run:** 01
- **Date:** 2026-05-31
- **Test commit:** `ed7426b08c4f51edceac4850f28a95ede9b38f93` (handover-19-atdd-p6)
- **Implementation commit:** `bd4c7998bd05086b2481566c9429a74f62f16311` (handover-20-implement-p6)
- **Diff reviewed:** `git diff ed7426b..bd4c799 -- index.html` (production change is `index.html`-only; the other two changed files are the backlog index + implement handover)

---

## Step 1 — Plan extract (Phase 6)

**Behavioral rule.** A sixth **Constant work** Tab (`#tab-constant-work`) is inserted after **Initiatives**
(fifth button, before **Groups**) and renders `editedConstantWork` via `renderConstantWorkTable()`, modelled
on `renderInitiativesTable` but with **all** cells editable. Per-field editors: `tshirt_size`/`t_shirt_size`
→ `<select>` of exactly the seven Recognised t-shirt sizes (`2XS, XS, S, M, L, XL, XL+`); `category`/`team`/
`quarter` (+ ADR-0023 aliases) → `<input list>` datalist combos seeded from the observed **union** of
`editedInitiatives` ∪ `editedConstantWork`; everything else → free text. Inline `onchange` commits
`this.value` to `editedConstantWork` and calls `tryUpdatePreview` (no Run — commit-on-Run). `↓ Export CSV`
→ `exportConstantWorkCSV()` → `Papa.unparse(editedConstantWork)` → download `constant-work-edited.csv`
preserving the imported header set verbatim. Pre-rendered every Run; panel in the visibility-reset block.

**Invariants (8).** Six `.tab-btn`, Constant work fifth / Groups sixth · single `innerHTML` write per call ·
size options exactly the seven canonical (unrecognised value appended-and-selected, seven always present) ·
datalist = `editedInitiatives` ∪ `editedConstantWork` union · onchange writes string + `tryUpdatePreview`,
no Run · export no-op when empty, else imported header order · cell text `escapeHtml`'d, attribute values
`escapeAttr`'d · render call in run handler + `#tab-constant-work` in the reset block.

**Counterexamples (6, must NOT pass).** size as free-text / observed-sizes dropdown · category/team/quarter
as plain `<select>` · jira_key/epic_name read-only · export normalising aliases or reordering columns ·
edit handler that Runs or omits `tryUpdatePreview` · datalist seeded only from `editedConstantWork`.

**Forbidden shortcuts.** No read-only cells · no header normalise/reorder on export · datalist not from
`parsedConstantWork` only · tab not before Initiatives / after Groups (must be fifth).

---

## Step 2 — Implementation diff, initial assessment (formed before reading tests)

The `index.html` diff comprises exactly the surfaces the rule names, and nothing else:

1. **General rule, not fixture-keyed.** Column routing is by *role*, via sets keyed on ADR-0023 aliases —
   `CW_SIZE_COLS = {tshirt_size, t_shirt_size}`, `CW_CATEGORY_COLS = {category, moscow, emoji}`,
   `CW_TEAM_COLS = {team}`, `CW_QUARTER_COLS = {quarter}` — with all other keys falling through to free text.
   The size option set is `Object.keys(T_SHIRT_PARAMS)` (derived from the production param table, **not** a
   literal `['2XS',…]`), and the datalists are computed from observed row values, not from any test string.
2. **Every changed hunk maps to the rule.** CSS for `#constant-work-table-wrap`; the fifth tab button
   `data-tab="constant-work"` (between Initiatives and Groups); the `#tab-constant-work` panel wrapping
   `#constant-work-table-wrap`; `renderConstantWorkTable()` + recognisers + `_cwObservedValues` union helper;
   `exportConstantWorkCSV()`; the `renderConstantWorkTable()` run-handler call and the
   `#tab-constant-work → display:none` reset line.
3. **No suspicious constructs.** No conditionals on IDs/names, no hard-coded numbers matching fixtures, no
   `NODE_ENV`/`process.env` branch, no import from `tests/`.

Initial view: the diff implements the **general** Phase 6 rule. One point flagged for Step 5 — the cell
`value="…"` attribute uses `escapeHtml`, while the invariant text says attribute values are `escapeAttr`'d
(examined below; it is a justified, test-mandated deviation, not a violation).

---

## Step 3 — Test-gaming scan

| Pattern | Finding |
|---|---|
| Hard-coded fixture values in production | **None.** Sizes from `Object.keys(T_SHIRT_PARAMS)`; datalists computed from observed values. |
| Conditionals on test-only identifiers | **None.** |
| Skipped/deleted tests | **None.** `git diff ed7426b..bd4c799 -- tests features e2e acceptance` is **empty**. |
| Weakened assertions | **None** — no test file changed across the boundary. |
| Production imports from test helpers | **None.** |
| Environment checks in production | **None.** |
| Excessive/incorrect mocking | **None** (production code; tests own their capture shims). |
| Patched runners/configs | **None** — `vitest.config.*` / `package.json` not in the diff. |
| Stale/pre-generated artifacts | **None.** |
| Changed fixtures | **None.** |

Test files are byte-identical between `test_commit` and `impl_commit`; the only working change is `index.html`.

---

## Step 4 — Tests read (after Step 2). Coverage vs. plan

`tests/acceptance/phase-6-constant-work-tab.test.js` (AT-1…AT-11, 15 `it`s) + the migrated
`tests/acceptance/phase-2-groups-tab.test.js` AT-1 (six-tab order, frozen) map 1:1 to the rule:
AT-1 tab order; AT-2 panel hidden + org active; AT-3 reveal + one `<tr>`/row (incl. 1-row boundary);
AT-4 size `<select>` exactly seven + `t_shirt_size` alias + unrecognised-`XXL` boundary; AT-5 datalist
union (category, and team/quarter incl. initiative-only values); AT-6 free-text columns (no `list`, no
`<select>`); AT-7 write-through + additive flow into `getConstantWorkEffortPerGroup`; AT-8 export header
verbatim (+ negatives: no `tshirt_size`/`jira_key` rewrite); AT-9 round-trip; AT-10 `tryUpdatePreview`
without Run; AT-11 inert payload + exact-value round-trip.

**Coverage observations (not gaps that change the verdict).** AT-2 verifies the *default/static* hidden
state rather than driving the async run-button visibility-reset block, and AT-7/the tests invoke
`renderConstantWorkTable()` directly rather than through the run handler. The two run-handler lines
(`renderConstantWorkTable();` and `#tab-constant-work … display='none'`) are therefore verified by
inspection, not by an executing test of the handler. Both lines are present and correct in the diff, and
the ATDD handover records this as the deliberate AT-2 seam choice. No counterexample becomes realizable as a
result.

---

## Step 5 — Invariants vs. implementation

```
Invariant: Six .tab-btn; Constant work (data-tab="constant-work") fifth, Groups sixth.
Status: SATISFIED
Evidence: button inserted between data-tab="initiatives" and data-tab="groups"; AT-1 + migrated phase-2 AT-1 pin order.

Invariant: renderConstantWorkTable writes #constant-work-table-wrap.innerHTML exactly once per call.
Status: SATISFIED
Evidence: exactly one `container.innerHTML = …` per code path (empty-state early return; else the built table). Never both in one call.

Invariant: tshirt_size options are exactly the seven canonical; current selected; unrecognised value appended-and-selected, seven always present.
Status: SATISFIED
Evidence: `sizes = Object.keys(T_SHIRT_PARAMS)` (= 2XS,XS,S,M,L,XL,XL+); `opts = (sizes.includes(current)||!current) ? sizes : [...sizes,current]`. AT-4's three `it`s pin recognised/alias/unrecognised. Mutation 1 confirms.

Invariant: category/team/quarter datalists = observed union of editedInitiatives ∪ editedConstantWork.
Status: SATISFIED
Evidence: catList/teamList/qList each `[...new Set([..._cwObservedValues(editedInitiatives,…), ..._cwObservedValues(editedConstantWork,…)])]`; team candidates `['team','teams']` bridge the naming split. AT-5 pins it; mutation 2 confirms.

Invariant: onchange writes this.value to editedConstantWork[rowIdx][col] and calls tryUpdatePreview; no Run.
Status: SATISFIED
Evidence: onchange = `editedConstantWork[${rowIdx}]['${safeCol}'] = this.value; tryUpdatePreview()`. AT-7 (write-through, chart unchanged) + AT-10 (tryUpdatePreview spy fires, chartInstance type unchanged) pin it.

Invariant: exportConstantWorkCSV no-op when empty; else downloads constant-work-edited.csv in imported header order.
Status: SATISFIED
Evidence: `if (!editedConstantWork || !editedConstantWork.length) return;` then `Papa.unparse(editedConstantWork)` (keys-from-first-row order) → `a.download = 'constant-work-edited.csv'`. AT-8 asserts exact header line + alias-not-rewritten negatives; AT-9 round-trips.

Invariant: cell text escapeHtml'd; attribute values escapeAttr'd.
Status: SATISFIED (in security/correctness intent; documented, test-mandated deviation on value attributes)
Evidence: `<th>`/option labels use escapeHtml. The cell `value="…"` attribute uses **escapeHtml** (not escapeAttr) by design: AT-11 requires `input.value` to equal the literal `<script>alert('x')</script>`; escapeAttr's `'`→`\'` would corrupt the round-trip. escapeHtml escapes `&<>"` (verified at index.html:3539) — so the double-quoted attribute cannot be broken and no tag can form (XSS-safe) while `'` is preserved for exact round-trip. The column key embedded in the JS subscript still uses `escapeAttr` (its designed context). The invariant's security intent holds; the literal "escapeAttr for value attributes" is superseded by the frozen acceptance test. Mutation 3 confirms the dependency.

Invariant: renderConstantWorkTable() in run handler; #tab-constant-work in visibility-reset block.
Status: SATISFIED
Evidence: both lines present in the diff (run-handler call beside renderInitiativesTable(); reset line beside the other tab-* resets). Verified by inspection (see Step 4 coverage note).
```

**Counterexamples** — none realizable: size is always a canonical-seven `<select>` (never free-text / observed-only); category/team/quarter are `<input list>` (never plain `<select>`); no cell is read-only; export preserves alias headers and order; the handler calls `tryUpdatePreview` and never `runSimulation`; the datalist unions both sources. Each is pinned by an AT and/or a negative control.

---

## Step 6 — Negative-control mutations (three; each reverted)

Baseline GREEN: `npx vitest run tests/acceptance/phase-6-constant-work-tab.test.js tests/acceptance/phase-2-groups-tab.test.js` → **49 passed**.

1. **Size `<select>` = seven canonical.** `Object.keys(T_SHIRT_PARAMS)` → `…slice(0, 6)` (drop `XL+`).
   `vitest -t "AT-4:"` → **1 failed file / 3 failed**. Reverted.
2. **Datalist union.** drop the `editedInitiatives` half of catList/teamList/qList (CW-only).
   `vitest -t "AT-5:"` → **1 failed file / 2 failed**. Reverted.
3. **Escaping round-trips.** free-text `value="${escapeHtml(current)}"` → `escapeAttr(current)`.
   `vitest -t "AT-11:"` → **1 failed file / 1 failed** at `expect(input.value).toBe(payload)`. Reverted.

After reverts: `git status --porcelain` empty; combined acceptance **49 passed**; `npm run verify`
**exit 0, 204 passed / 1 skipped** (the 1 skip is the pre-existing self-skipping
`sanity-check-engine-mean.test.js`).

Negative control: **PASS** (real non-zero exit on each mutation; clean GREEN on revert).

---

## Step 7 — Additional verification tests

None written. Acceptance coverage maps 1:1 to the rule, all invariants hold by construction, and three
distinct negative controls already pin the distinctive Phase 6 behaviors (canonical size set, datalist
union, value round-trip). The two run-handler-wiring lines are verified by inspection (Step 4) — adding a
test that drives the async run path would not change the verdict.

---

## Step 9 — Verdict

```
Phase 6 review verdict: PASS

Test gaming patterns found: none
Invariant gaps: none (invariant 7 "attribute values escapeAttr'd" is satisfied in security/correctness
                intent; the cell value attribute intentionally uses escapeHtml — mandated by frozen AT-11
                and XSS-safe because escapeHtml escapes & < > " )
Missing test coverage: none material (run-handler wiring lines verified by inspection; AT-2 uses the
                static default-state seam by design)
Additional verification tests written: none
Negative control result: PASS
```

**Overall.** The `test_commit..impl_commit` diff implements the general Phase 6 rule entirely in `index.html`:
a fifth **Constant work** tab between Initiatives and Groups, a fully-editable `renderConstantWorkTable()`
with role-based per-field editors (canonical-seven size `<select>`; category/team/quarter datalists seeded
from the `editedInitiatives ∪ editedConstantWork` union; free text elsewhere), inline commit-on-Run write-
through via `tryUpdatePreview`, and an `exportConstantWorkCSV()` that preserves the imported header set
verbatim. All eight invariants hold; none of the six counterexamples is realizable; no test file drifted
across the boundary (drift check empty). Three negative controls each flipped the targeted AT(s) to RED and
reverted cleanly to GREEN, and the full suite is green (`npm run verify` exit 0, 204 passed / 1 skipped).
The one nuance — `escapeHtml` on the cell value attribute — is a deliberate, test-required choice that is
strictly safer for this double-quoted-attribute context than the invariant's literal `escapeAttr` wording.
Phase 6 is complete.
