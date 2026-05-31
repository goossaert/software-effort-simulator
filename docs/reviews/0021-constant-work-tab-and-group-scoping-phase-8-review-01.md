# Phase 8 review — 0021 constant-work-tab-and-group-scoping

- **Plan:** `docs/plans/0021-constant-work-tab-and-group-scoping.md` (Phase 8 slice, lines ~1182–1289)
- **Phase:** 8 of 8 (final feature-phase)
- **Review run:** 01
- **Date:** 2026-06-01
- **Test commit:** `a67340c59099470b10b1a420ad3793e845607838` (atdd-p8)
- **Impl commit:** `19689faf4fd801b4d57ae8b61f93123e0ad1de67` (implement-p8, HEAD)
- **Verdict:** **PASS**

---

## Step 1 — Plan (Phase 8)

**Behavioral rule.** The Groups **Members** popover's observed-Categories list sources from
the **union** of Categories across `editedInitiatives` **and** `editedConstantWork`, computed
at **popover-open time** (reflecting the current edited state of both tabs). A Category present
in both sources is a single entry; the **Initiative's casing wins** on a merge; a
constant-work-only Category keeps its own casing; the union dedups case-insensitively (seed the
casing map from `editedInitiatives` first, then add constant-work Categories not already
present). The `(Blank)` row and free-text input are unchanged. This is the affordance by which a
user targets constant-work Categories with Groups (which then scopes that work per Phases 2–4,
ADR-0033).

**Invariants.**
1. The popover option list is the case-insensitive union of `editedInitiatives` and
   `editedConstantWork` Categories.
2. On a merge, the displayed casing is the Initiative's; a constant-work-only Category keeps its
   own casing.
3. The union is recomputed at popover-open time (not cached from render).
4. The `(Blank)` row and free-text input remain present.

**Counterexamples (must NOT pass).**
1. A popover that lists only `editedInitiatives` Categories (constant-work-only missing).
2. A popover that lists a duplicate entry for a Category present in both sources.
3. A merge where the constant-work casing overrides the Initiative casing.
4. A union computed once at render time and stale when the user edits a tab before opening.

**Forbidden shortcuts.** Do not source the union from `parsedInitiatives` / `parsedConstantWork`
(must reflect edited state); do not drop the `(Blank)` row or free-text input.

**Proposed seams (stable):** the popover option list = union of `editedInitiatives` and
`editedConstantWork` Categories; the merge casing rule. **Not locked:** whether the union helper
is shared with the Phase 6 datalist union; the exact popover DOM beyond the option-list contents
and the `(Blank)`/free-text affordances.

---

## Step 2 — Implementation diff (read before the tests)

`git diff a67340c..19689fa` touches three files: `index.html` (production, +12/−7), the task
`index.md` (state advance + human summary), and the new `handover-26-implement-p8.md`. **The only
production change is `index.html`**, confined to one function `_observedCategoriesForPopover()`
(`index.html:4029`).

Before: the function early-returned `[]` when `editedInitiatives` was empty, then built the list
from `editedInitiatives` only (inline `normalizeCategory` loop).

After:
```js
const initCatCol = (detectedCols || {}).categoryCol;
const initCats = collectObservedCategories(editedInitiatives, initCatCol);
const cwCats   = collectObservedCategories(editedConstantWork, 'category');
const firstSeen = new Map(); // lowercase → first-seen casing (initiatives seeded first)
for (const cat of [...initCats, ...cwCats]) {
  if (cat === BLANK) continue;
  const lc = cat.toLowerCase();
  if (!firstSeen.has(lc)) firstSeen.set(lc, cat);
}
return [...firstSeen.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
```

Initial assessment (from the diff alone):
1. **General rule, not keyed on values.** The union is computed structurally from both edited
   models via the shared helper `collectObservedCategories` (the same one `syncAutoDefaultGroup`
   uses, `index.html:1614`); no fixture strings/numbers in the logic.
2. **Every changed file maps to the rule.** `index.html` = the rule; `index.md` = the loop's state
   advance; the handover = the loop's contract. No stray files.
3. **No suspicious constructs.** No conditionals on IDs/names, no hard-coded fixture values, no env
   checks. The `'category'` literal is the canonical constant-work schema key (matches
   `getConstantWorkEffortPerGroup` `index.html:1863` and `syncAutoDefaultGroup` `index.html:1658`),
   not a fixture artifact. The dropped `editedInitiatives`-empty early-return is a correctness
   widening (constant-work-only Categories now appear with no initiatives loaded);
   `collectObservedCategories` is null/empty-safe.

The caller `openMembersPopover` (`index.html:4052`) calls `_observedCategoriesForPopover()` inline
on **every** open (line 4057) and still renders the dedicated `(Blank)` row (lines 4069–4072) and
the free-text `<input type="text">` + Add button (lines 4080–4083) — untouched by the diff.

---

## Step 3 — Test-gaming scan

- **Hard-coded fixture values:** none. The only literal is `'category'` (canonical CW column key).
- **Conditionals on test-only identifiers:** none.
- **Skipped/deleted tests:** none. `git diff a67340c..19689fa -- tests features e2e acceptance`
  returns **empty** — no test file changed between the test and impl commits.
- **Weakened assertions:** none (no test diff).
- **Production imports from test helpers:** none (`grep` of the diff for `tests/`/`__mocks__`/
  `fixture`/`require(` → no matches).
- **Environment checks:** none (no `NODE_ENV`/`process.env` in the diff).
- **Excessive/incorrect mocking:** N/A.
- **Patched runners/configs:** none (no `vitest.config`/coverage changes in the diff).
- **Stale/pre-generated artifacts:** none.
- **Changed fixtures:** none.

---

## Step 4 — Tests (read after forming the view)

`tests/acceptance/phase-8-groups-popover-union.test.js` (AT-1…AT-6, 11 `it`s) at the test commit:

- **AT-1** — popover lists every initiative Category **and** every constant-work-only Category
  (happy + property over multi-row CW); negative `it` asserts a never-present Category is absent.
- **AT-2** — a Category in both sources is a single entry with Initiative casing (`Backend`, not
  `backend`); property `it` over several overlapping case variants (`BACKEND`, ` frontend `).
- **AT-3** — a constant-work-only Category keeps its own casing (`Ops`, not `ops`/`OPS`);
  mixed-case boundary (`DataPlatform`).
- **AT-4** — adding a constant-work-only Category (`Ops`) via the popover checkbox flips
  `getConstantWorkEffortPerGroup` from `0` to the row PM and clears `getConstantWorkExcluded`
  (reads the Phase-2/Phase-5 engine seams; the checkbox exists **only** because the popover now
  sources the union).
- **AT-5** — the dedicated `(Blank)` row (`input[data-blank]`) and the free-text `input` remain.
- **AT-6** — open-time recompute: an unsaved edit to both an initiative and a constant-work
  Category appears without Run; a second `it` proves reopen reflects a late edit **and** drops the
  old value (not cached).

Migrated **AT-28** in `tests/acceptance/phase-2-groups-tab.test.js` asserts both an edited
initiative Category (`KR99`) and a constant-work-only Category (`KR88`) appear in the popover —
the union assertion, frozen this phase.

The option list is read from the DOM (`.ms-option`/`label` text, dropping the `(Blank)` row and
empty text) — coupled only to the option-list contents and the `(Blank)`/free-text affordances, as
the plan permits. No behavioral case in the plan lacks coverage; the implementation cannot pass
all visible tests while violating a counterexample (see Step 6).

---

## Step 5 — Invariants vs implementation

```
Invariant: The popover option list is the case-insensitive union of editedInitiatives and editedConstantWork Categories.
Status: SATISFIED
Evidence: _observedCategoriesForPopover iterates [...initCats, ...cwCats] (both via collectObservedCategories) and dedups by cat.toLowerCase() in a Map. AT-1 (happy+property) + AT-28 pin it; mutation 1 (drop cwCats) fails them.

Invariant: On a merge, the displayed casing is the Initiative's; a constant-work-only Category keeps its own casing.
Status: SATISFIED
Evidence: initCats is iterated before cwCats and `if (!firstSeen.has(lc)) firstSeen.set(lc, cat)` records the first (Initiative) casing; a CW-only Category, absent from initCats, records its own. AT-2 + AT-3 pin it; mutation 2 (cwCats first) fails AT-2.

Invariant: The union is recomputed at popover-open time (not cached from render).
Status: SATISFIED
Evidence: openMembersPopover calls _observedCategoriesForPopover() inline on each open (index.html:4057); nothing memoises the result. AT-6 second `it` (reopen reflects late edit, drops old) pins it.

Invariant: The (Blank) row and free-text input remain present.
Status: SATISFIED
Evidence: openMembersPopover still builds the dedicated `(Blank)` row (index.html:4069) and the free-text input + Add button (index.html:4080), untouched by the diff; the function excludes BLANK from the option list (`if (cat === BLANK) continue;`) so BLANK is rendered only via its dedicated row. AT-5 pins it.
```

**Counterexamples** — none realizable:
1. Initiatives-only list → mutation 1 reproduces it and AT-1/AT-3/AT-4/AT-6/AT-28 fail.
2. Duplicate entry for a both-sources Category → case-insensitive `firstSeen` dedup; AT-2 asserts
   length 1.
3. Constant-work casing overrides Initiative → mutation 2 reproduces it and AT-2 fails.
4. Stale render-time union → computed fresh per open; AT-6 second `it` catches caching.

Forbidden shortcuts honored: the union reads `editedInitiatives`/`editedConstantWork` (the edited
models), never `parsedInitiatives`/`parsedConstantWork`; the `(Blank)` row and free-text input are
not dropped.

---

## Step 6 — Negative control (two mutations)

**Mutation 1 — drop the constant-work side of the union** (`const cwCats = [];`):
- Command: `npx vitest run tests/acceptance/phase-8-groups-popover-union.test.js tests/acceptance/phase-2-groups-tab.test.js`
- Result: **8 failed / 37 passed**, exit ≠ 0 — exactly AT-1 (happy+property), AT-3 (×2), AT-4,
  AT-6 (×2), and the migrated AT-28. The preserved-behavior guards (AT-1 negative, AT-2 ×2, AT-5)
  stayed GREEN. Reproduces counterexample 1.

**Mutation 2 — seed the casing map from constant work first** (`for (const cat of [...cwCats, ...initCats])`):
- Result: **2 failed / 43 passed**, exit ≠ 0 — exactly AT-2 (×2, `backend` instead of `Backend`).
  Reproduces counterexample 3.

**Revert + restore:**
- Both edits reverted; working tree byte-identical to HEAD (`git status --porcelain` empty,
  `git diff HEAD -- index.html` empty).
- `npx vitest run tests/acceptance/phase-8-groups-popover-union.test.js tests/acceptance/phase-2-groups-tab.test.js` → **45 passed**, exit 0.

**Negative control: PASS** — the suite catches deliberate violations of both the union and the
casing-merge rule, and recovers cleanly.

---

## Step 7 — Additional verification tests

None needed. The frozen tests cover every Phase-8 invariant and counterexample; the two negative
controls confirm the suite's discriminating power. No production bug found.

---

## Green confirmation (current build)

- `npx vitest run tests/acceptance/phase-8-groups-popover-union.test.js tests/acceptance/phase-2-groups-tab.test.js` → **45 passed**, exit 0.
- `npm run verify` → **226 passed / 1 skipped**, exit 0 (the 1 skipped is the pre-existing
  self-skipping `sanity-check-engine-mean.test.js`).

---

## Verdict

```
Phase 8 review verdict: PASS

Test gaming patterns found: none
Invariant gaps: none
Missing test coverage: none
Additional verification tests written: none
Negative control result: PASS

Overall: The single production change (index.html, _observedCategoriesForPopover) implements the
general Phase-8 rule — the Groups Members popover's option list is the case-insensitive union of
editedInitiatives ∪ editedConstantWork Categories, computed at open time, with Initiative casing
winning on a merge and constant-work-only Categories keeping their own casing — reusing the shared
collectObservedCategories helper (same trim + case-fold + (Blank)-sentinel semantics as
syncAutoDefaultGroup). The (Blank) row and free-text input are untouched; the engine, the per-Group
scoping helpers, and the Constant work tab are untouched (AT-4 only reads existing seams). All 4
invariants hold by construction; none of the 4 counterexamples is realizable; no fixture literals /
test-keyed branches / env checks / tests/ imports; no test file drifted across
test_commit..impl_commit. Two negative-control mutations each flipped exactly the predicted ATs to
RED and reverted to 45/45 GREEN. Targeted (45 pass) and npm run verify (226 pass / 1 skip) both
exit 0; working tree clean. This is feature-phase 8 of 8 — the task is complete.
```

Saved review: `docs/reviews/0021-constant-work-tab-and-group-scoping-phase-8-review-01.md`
