# Phase 5 review — 0021 constant-work-tab-and-group-scoping

- **Plan:** `docs/plans/0021-constant-work-tab-and-group-scoping.md` (Phase 5, lines ~787-899)
- **Phase:** 5 — Constant-work quarters in the Target selector + Data preview surfacing of per-Group constant-work PM and exclusions
- **Review run:** 01
- **Date:** 2026-06-01
- **Test commit:** `0d56a924362b78faf32023661c8fbab9002830dd` (atdd-p5, `handover-16-atdd-p5.md`)
- **Implementation commit:** `1e4e617229440363ac1889b73d748b0072d04a57` (implement-p5, `handover-17-implement-p5.md`)
- **Diff boundary:** `0d56a92..1e4e617`
- **Verdict:** **PASS**

---

## Step 1 — Plan (Phase 5)

**Behavioral rule.** The **Target quarter** selector's source becomes
`initiatives ∪ epics ∪ editedConstantWork` quarters; the **Historical quarter**
selector's source stays `initiatives ∪ epics` (constant work cannot inform
Poisson λ or the bootstrap pool). The two `MultiSelect` instances are populated
from **different lists** in `refreshQuarters`, preserving selection-preservation.
A Target quarter present only in constant work yields a pure-constant-work
forecast (`kPerGroup` all `0`, each Group flat at its own `fixedEffortPerGroup`
entry). The **Data preview** surfaces, beside each per-Group `K` row, the
constant-work PM folded into that Group (the org-wide `fixedEffortPerGroup` from
Phase 2), plus a dedicated line reporting any target-quarter constant work whose
Category matches no Group's members (PM + row count, "excluded"). Surfacing is
preview-only — no Run gate, no alert.

**Invariants.**
1. `targetMS` options ⊇ `histMS` options; the difference is exactly the constant-work-only quarters.
2. `histMS` options never include a quarter present only in constant work.
3. `preview.fixedEffortPerGroup` is aligned with `preview.kPerGroup`/`groupNames`.
4. `preview.cwExcludedPM`/`cwExcludedRows` count target-quarter constant-work rows whose Category ∈ no Group's members (overlap-aware: excluded only if in *no* Group).
5. The preview's per-Group PM and excluded line refresh on quarter-selection change (`tryUpdatePreview`) and on Run.

**Counterexamples (must NOT pass).**
1. A `refreshQuarters` that adds constant-work quarters to the **Historical** selector.
2. A `refreshQuarters` that populates both selectors from the same (target) list.
3. A preview that omits the per-Group constant-work PM.
4. An "excluded" count that includes constant work that *is* in some Group (overlap mishandled).
5. A Run gate / alert when constant work is excluded (surfacing is preview-only).

**Forbidden shortcuts.** No Run-time block/warn on excluded constant work; do not
change selection-preservation defaults beyond sourcing the two selectors
differently.

**Expected observable outcomes.** Constant-work-only quarters selectable as
targets, not historical; a pure-constant-work target quarter yields `K = 0` per
Group + each Group's shift; the Data preview surfaces per-Group constant-work PM
and an excluded summary.

**Proposed seams.** `refreshQuarters` populating `targetMS`/`histMS` from
different lists; `preview.fixedEffortPerGroup` / `.cwExcludedPM` / `.cwExcludedRows`;
the presence of per-Group PM + an "excluded" line in the rendered preview text.
Explicitly *not* locked in: wording/formatting of the per-Group PM and excluded
line; whether the excluded summary lives in `prepareSimulationData` or a helper.

---

## Step 2 — Implementation diff (initial assessment, before reading tests)

`git diff 0d56a92..1e4e617` touches three files: `index.html` (the only
production change, +101/-11), plus `docs/backlog/.../index.md` and
`handover-17-implement-p5.md` (bookkeeping). The five production edits:

1. **`refreshQuarters`** — extracts an inline `cmpQuarter` comparator (pure
   refactor, reused for both sorts). `all = [...new Set([...fromInits, ...fromEpics])].sort(cmpQuarter)`
   (Historical source, unchanged); `fromCW = editedConstantWork ? extractQuarters(editedConstantWork) : []`;
   `allTarget = [...new Set([...all, ...fromCW])].sort(cmpQuarter)`. `curHist`
   validates against `all`, `curTarget` against `allTarget`; `targetDef` fallback
   uses `allTarget`. Then `histMS.populate(all, histDef)` /
   `targetMS.populate(allTarget, targetDef)` — populated from **different lists**.
2. **`loadConstantWorkCSV` / `resetConstantWorkFile`** — each calls
   `refreshQuarters()` so a CW source change refreshes the selectors.
3. **`getConstantWorkExcluded(quarters, groups, teamName=null)`** — new sibling
   helper. Builds the **union** of all Groups' members once (case-folded + BLANK
   sentinel), then for each in-scope `editedConstantWork` row (quarter ∈ quarters,
   optional team match) excludes it iff its normalised Category is in no member.
   Returns `{pm, rows}`.
4. **`prepareSimulationData.preview`** — adds `fixedEffortPerGroup` (the org-wide
   vector already computed at the call site), `cwExcludedPM`, `cwExcludedRows`
   (from `getConstantWorkExcluded(targetQuarters, groupsStore)`).
5. **`renderPreview`** — each per-Group K row's `pv` span now reads
   `K = <k> · <pm>.<1> PM constant`; a dedicated excluded line is emitted **only
   when `preview.cwExcludedRows > 0`**.

Initial answers to the three diff questions:
1. **General rule, not value-keyed.** The Target/Historical split is set-algebra
   over the live `editedConstantWork`/`parsedInitiatives`/`parsedEpics` arrays;
   the excluded count is membership set-algebra. No literal keyed to a fixture.
2. **Every changed file maps to the rule.** Only `index.html` is production; the
   two `docs/backlog/...` files are loop bookkeeping.
3. **No suspicious constructs.** The only string literals (`'Q2 2026'`,
   `'Q3 2026'`) are the **pre-existing** default-selection quarters — the
   `histDef` line is byte-for-byte unchanged in the diff; `targetDef` only swaps
   `all`→`allTarget`. These are app demo defaults, not test-keyed branches. No
   conditionals on IDs, no env checks, no test-helper imports.

---

## Step 3 — Test-gaming scan

| Pattern | Finding |
|---|---|
| Hard-coded fixture values | **None.** `'Q2 2026'`/`'Q3 2026'` are pre-existing default-selection quarters (the `histDef` line is unchanged in the diff), not values matched to Phase 5 fixtures. |
| Conditionals on test-only identifiers | **None.** |
| Skipped / deleted tests | **None.** `git diff 0d56a92..1e4e617 -- tests features e2e acceptance` is empty. The 1 skipped test is the pre-existing self-skipping `tests/verification/sanity-check-engine-mean.test.js` (from Phase 2), not a Phase 5 skip. |
| Weakened assertions | **None.** No test file changed. |
| Production imports from test helpers | **None.** |
| Environment checks in production logic | **None.** |
| Excessive / incorrect mocking | **N/A** (no mocks added). |
| Patched test runners / configs | **None.** No `*.config.*` / `package.json` / coverage-config change in the diff. |
| Stale / pre-generated artifacts | **None.** |
| Changed fixtures | **None.** |

No gaming pattern found.

---

## Step 4 — Tests (read after forming the diff view)

`tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js` (AT-1…AT-6,
frozen at the test commit). The seams match the plan exactly: option lists read
through the **rendered checkboxes** under `#target-ms .ms-options-wrap` /
`#hist-ms .ms-options-wrap` (user-observable, not a private widget field);
`prepareSimulationData(...).preview.fixedEffortPerGroup` / `.cwExcludedPM` /
`.cwExcludedRows`; `renderPreview(...)` → `#preview-grid` text.

Coverage vs. the plan, mapped to my Step-2 view:

- **AT-1** pins invariants 1 & 2 *and* counterexamples 1 & 2: Target ⊇ Historical,
  the set difference is **exactly** `['Q1 2027','Q4 2026']`, and an overlapping
  quarter (`Q3 2026`, present in both an initiative and constant work) is
  correctly **not** in the difference.
- **AT-2** pins the pure-constant-work forecast (expected outcome): `kPerGroup`
  `[0,0]` for a CW-only target quarter; each Group's distribution flat at its own
  `fixedEffortPerGroup` (p10 = p90 = the shift).
- **AT-3** pins invariant 2 / counterexamples 1 & 2: Historical lists exactly
  `['Q2 2026','Q3 2026']`, no CW-only quarter.
- **AT-4** pins invariant 3 / counterexample 3: `fixedEffortPerGroup` is an array
  aligned with `kPerGroup` and `groupNames`, lifted Group at its PM, other at `0`;
  the rendered grid matches `/PM/i`.
- **AT-5** pins invariant 4 / counterexample 4: only the in-target-quarter,
  in-no-Group row counts (`cwExcludedRows === 1`); the in-Group `Backend` row and
  the out-of-target-quarter `Ops` row are excluded from the count; a positive
  excluded line renders.
- **AT-6** pins the boundary: every Category in a Group → `cwExcludedPM`/`Rows`
  zero, no positive excluded line (`not.toMatch(/[1-9]\d*\s*rows?…excluded/i)`).

**Could the implementation pass all visible tests while violating a plan
counterexample?** Counterexamples 1–4 are each pinned by a positive+negative
assertion pair and are independently confirmed by the negative controls below.
**Counterexample 5** (a Run gate/alert) has **no dedicated test** — see Missing
coverage. It is, however, structurally absent from the diff: the only Run-path
change is the addition of preview fields + `renderPreview` surfacing; no
`alert()`, modal, early-return, or `checkRunButton`-style gate keyed on excluded
constant work was added. The plan permits this (surfacing-only), and the absence
is verified by reading the full diff.

---

## Step 5 — Invariants vs. implementation

```
Invariant 1: targetMS options ⊇ histMS options; difference = exactly the constant-work-only quarters
Status: SATISFIED
Evidence: allTarget = [...new Set([...all, ...fromCW])] is a superset of `all`;
histMS is populated from `all`, targetMS from `allTarget`. allTarget \ all =
fromCW \ (init∪epic) = constant-work-only quarters. AT-1 asserts the exact diff
incl. the overlap case (Q3 2026 not in the difference).

Invariant 2: histMS options never include a quarter present only in constant work
Status: SATISFIED
Evidence: histMS.populate(all, histDef) where all = initiatives ∪ epics only;
fromCW never feeds `all`. AT-3 asserts hist === ['Q2 2026','Q3 2026'].

Invariant 3: preview.fixedEffortPerGroup aligned with kPerGroup/groupNames
Status: SATISFIED
Evidence: fixedEffortPerGroup = getConstantWorkEffortPerGroup(targetQuarters,
groupsStore) maps over the same groupsStore that produces kPerGroup; groupNames =
groupsStore.map(g => g.name). All three are index-aligned by construction. AT-4
asserts equal lengths against both kPerGroup and groupNames.

Invariant 4: cwExcludedPM/Rows count target-quarter rows in no Group (overlap-aware)
Status: SATISFIED
Evidence: getConstantWorkExcluded builds the member UNION once (memberSet +
blankMember across all groups), filters rows by qSet (= targetQuarters) and
optional team, and counts a row only when `!inSomeGroup`. A Category in ≥1 Group
is never excluded. Mirrors getConstantWorkEffortPerGroup's trim+case-fold+(Blank)
semantics and the category→moscow→emoji cascade. AT-5 asserts the overlap
negative (Backend not counted) and the out-of-quarter negative.

Invariant 5: preview's per-Group PM + excluded line refresh on selection change and Run
Status: SATISFIED
Evidence: tryUpdatePreview() → prepareSimulationData() → renderPreview() is wired
to `ms-change` on both #hist-ms and #target-ms (index.html:4305-4306) and the Run
path; the new preview fields flow through that pre-existing path automatically.
```

No invariant AT RISK or VIOLATED.

---

## Step 6 — Negative control (mutation tests)

Two mutations, targeting the two core Phase 5 rules. Each was applied, run,
confirmed failing, and reverted; GREEN was confirmed restored and the working
tree confirmed clean afterward.

**Mutation A — selector-source split** (counterexamples 1 & 2): changed
`histMS.populate(all, histDef)` → `histMS.populate(allTarget, histDef)` (Historical
populated from the widened list).
- Command: `npx vitest run tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js`
- Result: **exit 1**, 2 failed / 4 passed — **AT-1** and **AT-3** fail (CW-only quarters leak into Historical).
- Reverted.

**Mutation B — overlap-aware exclusion** (counterexample 4): removed the
`if (inSomeGroup) continue;` guard in `getConstantWorkExcluded` (count in-Group
rows as excluded too).
- Command: `npx vitest run tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js`
- Result: **exit 1**, 2 failed / 4 passed — **AT-5** and **AT-6** fail (in-Group work wrongly counted as excluded).
- Reverted.

**After both reverts:** `git status --porcelain` empty; targeted run **exit 0**,
**6 passed**.

Negative control: **PASS**.

---

## Step 7 — Additional verification tests

**None written.** The committed AT-1…AT-6 plus the two negative controls already
pin every realizable counterexample (1–4) with a positive+negative assertion
pair, and invariants 1–5 are satisfied by construction. The only uncovered
counterexample (5, a Run gate/alert) is an *absence* — best verified by diff
inspection (done in Steps 2/4: no Run-path gate/alert was added), not by a brittle
"no alert" spy. Writing one would add little signal.

---

## Step 8 — Commands & exit codes (this review)

| Command | Exit | Result |
|---|---|---|
| `git diff --name-only 0d56a92..1e4e617 -- tests features e2e acceptance` | 0 | empty (no test drift) |
| `npx vitest run tests/acceptance/phase-5-…test.js` (baseline) | 0 | 6 passed |
| `npm run verify` (baseline) | 0 | 189 passed / 1 skipped |
| Mutation A → targeted run | 1 | 2 failed (AT-1, AT-3) / 4 passed |
| Mutation B → targeted run | 1 | 2 failed (AT-5, AT-6) / 4 passed |
| targeted run after reverts | 0 | 6 passed; working tree clean |

---

## Step 9 — Verdict

```
Phase 5 review verdict: PASS

Test gaming patterns found: none
Invariant gaps: none
Missing test coverage: counterexample 5 (no Run gate/alert when constant work is
  excluded) has no dedicated test; verified structurally absent from the diff —
  acceptable (surfacing-only is permitted by the plan; absence of a gate is best
  confirmed by diff inspection, which it is).
Additional verification tests written: none
Negative control result: PASS
```

**Overall.** The Phase 5 slice is implemented as a general rule entirely in
`index.html`. `refreshQuarters` sources the Target selector from
`initiatives ∪ epics ∪ editedConstantWork` and the Historical selector from
`initiatives ∪ epics`, populating the two `MultiSelect`s from different lists and
preserving the existing selection-preservation logic; a constant-work source
change refreshes both. `getConstantWorkExcluded` computes an overlap-aware
in-no-Group exclusion (member union built once) reusing the established
trim+case-fold+(Blank)-sentinel membership and the category→moscow→emoji cascade,
and `prepareSimulationData.preview` surfaces `fixedEffortPerGroup` (group-aligned)
+ `cwExcludedPM`/`cwExcludedRows`; `renderPreview` shows per-Group PM and a
positive-only excluded line. No test file drifted across the diff; no gaming
pattern is present; all five invariants hold by construction; counterexamples 1–4
are each caught by the tests (two confirmed by negative-control mutations) and
counterexample 5 is structurally absent from the diff. Constant work continues to
contribute zero to any Group's `kPerGroup` / Poisson λ / bootstrap pool (the
engine path is untouched). Targeted (6 passed) and `npm run verify` (189 passed /
1 skipped) both exit 0.

Phase 5 is complete — proceed to Phase 6 atdd.
