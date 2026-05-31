# Phase 7 review — 0021 constant-work-tab-and-group-scoping

- **Plan:** `docs/plans/0021-constant-work-tab-and-group-scoping.md` (§ Phase 7, line 1061)
- **Phase:** 7 — Add row / delete row / from-scratch authoring on the Constant work tab
- **Review run:** 01
- **Date:** 2026-06-01
- **Test commit:** `be17a606900872d897e309ef995c416aa7a00442` (atdd p7)
- **Implementation commit:** `942b45888837d2d700e7ad1fd71370b5a8cb0903` (implement p7)
- **Verdict:** **PASS**

---

## Step 1 — Plan (Phase 7 contract)

**Behavioral rule.** The Constant work tab gains a `+ Add row` control and a per-row delete
control. `+ Add row` appends a blank row to `editedConstantWork`: when there is no imported
header set to mirror (`parsedConstantWork === null`) the row carries the **canonical schema**
(`jira_key, epic_name, key_result, category, team, quarter, tshirt_size`); otherwise it carries
the imported file's header set, so all rows share columns. When `editedConstantWork` is `null`,
the first add initialises it to `[]` then appends — enabling from-scratch authoring with no CSV
(`parsedConstantWork` stays `null`). Per-row delete splices the row immediately with **no
confirmation**. Validation is lenient: blank `tshirt_size` → 0 PM, blank `quarter` → excluded,
blank `category` → **(Blank) sentinel**. The table re-renders after add and delete.

**Invariants.**
1. After `+ Add row` with no import, `editedConstantWork` is non-null and the new row's keys are exactly the canonical schema.
2. After `+ Add row` with an import, the new row's keys equal the imported header set.
3. Delete removes exactly the targeted row, preserving order, with no confirmation.
4. From-scratch rows feed the simulation identically to imported rows (engine reads `editedConstantWork` regardless of `parsedConstantWork`).
5. Lenient blanks: blank size → 0 PM; blank quarter → excluded; blank Category → BLANK.

**Counterexamples (must NOT pass).**
1. An `+ Add row` that requires a CSV to be loaded first.
2. An added row whose keys differ from the other rows'.
3. A delete that prompts for confirmation, or reorders the remaining rows.
4. A blank `tshirt_size` that throws or contributes a non-zero PM.

**Forbidden shortcuts.** Do not gate `+ Add row` behind a loaded CSV; do not add a delete
confirmation; do not coerce blank cells to defaults beyond the documented lenient behaviour.

**Proposed seams (not locked).** The add-row handler (canonical vs imported header set; init `[]`
from null); the delete handler (splice + re-render). NOT locked: control markup / placement /
glyph; whether the canonical schema is a shared constant or inline.

---

## Step 2 — Implementation diff (read before the tests)

`git diff be17a60..942b458` touches exactly three files:

| File | Role |
|---|---|
| `index.html` | the only production change (+50/−5 lines) |
| `docs/backlog/0021-…/handover-23-implement-p7.md` | handover (new) |
| `docs/backlog/0021-…/index.md` | index advance (stage `implement`→`review`) |

The four `index.html` changes:
1. `CW_CANONICAL_SCHEMA = ['jira_key','epic_name','key_result','category','team','quarter','tshirt_size']` constant.
2. `renderConstantWorkTable` restructured: the toolbar (`+ Add row` always; `↓ Export CSV` only when `hasRows`) is built once and rendered in **every** state, including the empty branch (`toolbar + "No constant work loaded."`). The `+ Add row` button lives in a `<div class="constant-work-toolbar">`, **not** as a `<tbody>` row.
3. Per-row delete column: a trailing `<th></th>` and a trailing `<td><button class="group-row-btn danger" onclick="deleteConstantWorkRow(${rowIdx})">Delete</button></td>` — the single `<button>` in each data row; the trailing column keeps data-column header→index lookups intact.
4. Two handlers: `addConstantWorkRow()` (`if (editedConstantWork === null) editedConstantWork = [];` then `cols = (parsedConstantWork === null) ? CW_CANONICAL_SCHEMA : Object.keys(editedConstantWork[0] || parsedConstantWork[0] || {})`, push all-blank row, re-render) and `deleteConstantWorkRow(rowIdx)` (`splice(rowIdx,1)` + re-render, no `confirm()`).

**Initial assessment (diff alone, before tests):**
1. *General rule or keyed on values?* General. The canonical-vs-imported choice keys on the structural predicate `parsedConstantWork === null`, not on any fixture value; `CW_CANONICAL_SCHEMA` is the plan's documented canonical key set (a contract), not a test literal. Delete is an unconditional splice. The toolbar `+ Add row` is unconditionally rendered.
2. *Every changed file maps to the rule?* Yes — one production file + the mandatory handover + index advance.
3. *Suspicious constructs?* None — no test-id branches, no `NODE_ENV`/`process.env`, no hard-coded fixture literals, no `tests/` imports, no config/runner changes.

---

## Step 3 — Test-gaming scan

| Pattern | Finding |
|---|---|
| Hard-coded fixture values | **None.** `CW_CANONICAL_SCHEMA` is the plan's canonical schema (contract), independently re-declared in the test as `CANONICAL_SCHEMA`; both derive from the plan, not from each other. |
| Conditionals on test-only identifiers | **None.** |
| Skipped / deleted tests | **None.** `git diff be17a60..942b458 -- tests features e2e acceptance` is **empty** (no test file drift). |
| Weakened assertions | **None** (no test edits). |
| Production imports from test helpers | **None.** |
| Environment checks in production logic | **None.** |
| Excessive / incorrect mocking | **N/A.** |
| Patched runners / configs | **None** — diff touches only `index.html` + handover + index.md. |
| Stale / pre-generated artifacts | **None** in range. |
| Changed fixtures | **None.** |

---

## Step 4 — Tests vs plan (read after forming the Step-2 view)

`tests/acceptance/phase-7-constant-work-add-delete.test.js` — 11 `it`s across AT-1…AT-7:
AT-1 (2: canonical from null + `[]`-boundary init), AT-2 (1: imported header set + negative
`not.toContain('jira_key'|'tshirt_size')`), AT-3 (2: middle-delete order-preservation +
`confirm` spy = 0, and delete-last-row boundary → 0 rows), AT-4 (1: from-scratch shift, `parsedConstantWork`
stays null), AT-5 (3: blank size→0 PM, blank quarter→excluded, blank category→BLANK sentinel),
AT-6 (1: added-row editors = seven-size `<select>` + datalist combos, free-text negatives), AT-7
(1: export includes added rows, filename `constant-work-edited.csv`).

- **Every invariant has coverage**: I1→AT-1, I2→AT-2, I3→AT-3, I4→AT-4, I5→AT-5.
- **Every counterexample is pinned**: C1→AT-1/4/5/6/7 (author through the control with `parsedConstantWork === null`); C2→AT-2 (positive header-set equality + negative key absence); C3→AT-3 (`confirm` spy + order); C4→AT-5 (blank size → 0 PM, no throw).
- Seams are reached through the **rendered UI** (clickable `/add row/i` element; single row `<button>`), not handler names — robust and not overfit.
- **Could the impl pass all tests yet violate a counterexample?** No. Each counterexample is asserted both positively and (where it matters) negatively; the negative-control mutations below confirm the suite's discriminating power.

No missing behavioral cases relative to the plan. One **non-blocking** observation: the
`parsedConstantWork[0]` fallback in `addConstantWorkRow` (imported → all rows deleted → `+ Add row`)
is not directly exercised by a test, but it is robust by construction and is not a plan
counterexample.

---

## Step 5 — Invariants against the implementation

```
Invariant 1: After + Add row with no import, editedConstantWork non-null; new row keys = canonical schema.
Status: SATISFIED
Evidence: addConstantWorkRow inits []-from-null; parsedConstantWork===null ⇒ cols = CW_CANONICAL_SCHEMA;
          row built by cols.forEach(c => row[c]=''); all 7 keys are non-integer strings so
          Object.keys order === canonical order (AT-1 .toEqual ordered).
```
```
Invariant 2: After + Add row with import, new row keys = imported header set.
Status: SATISFIED
Evidence: post-loadConstantWorkCSV parsedConstantWork is non-null ⇒ cols = Object.keys(editedConstantWork[0]);
          the clone preserves Papa header order, so keys match the imported headers index-for-index (AT-2).
```
```
Invariant 3: Delete removes exactly the targeted row, preserves order, no confirmation.
Status: SATISFIED
Evidence: deleteConstantWorkRow = editedConstantWork.splice(rowIdx,1) + re-render; no confirm() call anywhere
          on the delete path (grep-confirmed); splice preserves the order of survivors (AT-3 middle delete → [CW-1,CW-3]).
```
```
Invariant 4: From-scratch rows feed the simulation identically to imported rows.
Status: SATISFIED
Evidence: addConstantWorkRow populates editedConstantWork and never touches parsedConstantWork; the engine seam
          getConstantWorkEffortPerGroup reads editedConstantWork (Phase-1 substrate migration), so an authored
          row lifts its Group's vector (AT-4: vector[0]=pm('M'), parsedConstantWork null).
```
```
Invariant 5: Lenient blanks — blank size → 0 PM; blank quarter → excluded; blank Category → BLANK.
Status: SATISFIED
Evidence: no coercion added in Phase 7; blanks flow unchanged into getConstantWorkEffortPerGroup /
          tshirtToPersonMonths / normalizeCategory (AT-5's three cases all pass against the unchanged engine).
```

---

## Step 6 — Negative-control mutations

All mutations applied to `index.html`, tested, then reverted; final tree clean and GREEN restored.

| # | Mutation | Command | Exit | Result |
|---|---|---|---|---|
| (a) | gate `+ Add row` behind a loaded CSV — `addConstantWorkRow`: `if (parsedConstantWork === null) return;` | `npx vitest run …phase-7… ` | **1** | **8 failed / 3 passed** — every from-scratch `it` (AT-1×2, AT-4, AT-5×3, AT-6, AT-7) fails; only AT-2 (imported) + AT-3 (pre-seeded model) survive → counterexample 1 caught |
| (b) | always use the canonical schema — `const cols = CW_CANONICAL_SCHEMA;` | `npx vitest run …phase-7… -t "AT-2"` | **1** | AT-2 fails (imported header set not honoured) → counterexample 2 caught |
| (c) | add a confirmation to delete — `if (!confirm('Delete this row?')) return;` | `npx vitest run …phase-7… -t "AT-3"` | **1** | AT-3 fails (`__confirmCalls` becomes 1 ≠ 0) → counterexample 3 caught |

Post-revert: `npx vitest run …phase-7…` exit **0** (11/11); `git status --porcelain` empty.

**Negative control: PASS.**

---

## Step 7 — Additional verification tests

None written. The frozen suite already pins all 5 invariants and all 4 counterexamples, and the
negative-control mutations confirm the assertions are discriminating. No coverage gap relative to
the plan's Phase 7 contract.

---

## Test results

- Targeted: `npx vitest run tests/acceptance/phase-7-constant-work-add-delete.test.js` → **11 passed**, exit **0**.
- Full: `npm run verify` → **215 passed / 1 skipped** (the pre-existing self-skipping `tests/verification/sanity-check-engine-mean.test.js`), exit **0**.
- The jsdom `Error: Not implemented: navigation` on stderr is the benign export-anchor `.click()` noise (AT-7); both suites report exit 0.

---

## Verdict

```
Phase 7 review verdict: PASS

Test gaming patterns found: none
Invariant gaps: none
Missing test coverage: none (the parsedConstantWork[0] fallback edge is robust-by-construction
                             and not a plan counterexample — non-blocking observation only)
Additional verification tests written: none
Negative control result: PASS

Overall: The implementation realises the general ADR-0034 rule entirely within index.html: a
`+ Add row` toolbar control (always rendered, never gated behind a CSV), a per-row delete that
splices immediately with no confirmation, canonical-schema-from-null vs imported-header-set
key selection keyed on the structural predicate parsedConstantWork === null, and reuse of the
unchanged smart editors / export / engine seam with no blank coercion. All five invariants hold
by construction; none of the four counterexamples is realizable. No test file drifted across
test_commit..impl_commit; no gaming patterns. Three negative-control mutations each flipped exactly
the predicted AT(s) to RED and reverted to 11/11 GREEN. Targeted (11/11) and npm run verify
(215 passed / 1 skipped) both exit 0. Phase 7 is complete.
```

Saved review: `docs/reviews/0021-constant-work-tab-and-group-scoping-phase-7-review-01.md`
