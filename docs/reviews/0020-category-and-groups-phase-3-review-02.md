# Feature 0020 — Phase 3 review (run 02)

- **Plan:** `docs/plans/0020-category-and-groups.md`
- **Phase:** 3 — Groups JSON persistence (`↓ Save groups (JSON)` / `↑ Load groups (JSON)`)
- **Review run:** 02 (run 01 was `FAIL` due to the `length <= 1` trivial-skip shortcut; the test refactor d20f6a4 + the impl fix 99246d8 are the response to that review)
- **Date:** 2026-05-27
- **Test commit SHA:** `d20f6a4` (test-refactor approved as superseding b782f01 for AT-19 / AT-20 trivial-skip assertions; rest of b782f01's tests unchanged)
- **Implementation commit SHA:** `99246d8` (name-aware trivial-skip fix on top of 376353c)

---

## Step 1 — Plan extract (Phase 3)

**Behavioral rule.** The Groups tab toolbar gains `↓ Save groups (JSON)` and `↑ Load groups (JSON)`. Save serialises `{ schemaVersion: 1, groups: groupsStore.map(g => ({ name, color, members, isProjection })) }` via `JSON.stringify(..., null, 2)` and downloads `groups.json`. Load reads via `FileReader.readAsText`, parses via `JSON.parse`, validates wrapper + per-Group shape, normalises the `isProjection` invariant (first-wins or first-by-default), and wholesale-replaces `groupsStore` (interposing a confirmation modal when the current store is non-trivial). Save and Load never trigger a Run.

**Key invariants under review.**

- Schema literal `{ schemaVersion: 1, groups: { name, color, members, isProjection }[] }`.
- (Blank) sentinel = JS `null` ↔ JSON `null` (no mapping function).
- Two-space indent (`JSON.stringify(..., null, 2)`).
- Filename literal `'groups.json'` (no timestamp, no prompt).
- Hidden `<input type="file" accept=".json">` exactly once inside `#tab-groups`.
- File-input `change` handler reads via `FileReader.readAsText` and dispatches `loadGroupsJSON(text)`.
- `loadGroupsJSON` returns `{ ok: false, error }` on parse/shape/version failure, `{ ok: true, groups }` on success.
- Version policy: `=== 1` accepts; `> 1` rejects with the "newer version" message; missing treated as 1.
- Unknown Group fields silently dropped (forward-compat).
- `isProjection` invariant normalised at load: multiple → first-wins; zero → first-by-default.
- Trivial-skip predicate: modal interposes **iff** `groupsStore.length > 1 || (groupsStore.length === 1 && groupsStore[0].name !== 'All')`.
- Modal Cancel / backdrop / Esc leaves `groupsStore` unchanged.
- Modal Replace writes parsed groups to `groupsStore` and re-renders Groups tab.
- Successful load clears `#groups-load-error`.
- Save / Load never call `runSimulation` or any chart/stats render function (other than `renderGroupsTab`).

**Forbidden shortcuts (Phase 3 specific).**

- No `localStorage` cache or auto-load.
- No auto-save on edits.
- No "preview before replace" overlay.
- No additive-merge toggle.
- No bundling of Markers / sidebar inputs / `editedInitiatives` into the saved file.
- No magic `"BlankSentinel"` string.
- No `schemaVersion: 2` migration shim.
- No file checksum / signature / encryption.

**Counterexamples (selection).** Save must NOT omit `schemaVersion`; must NOT serialise BLANK as `"null"` / `"(Blank)"`; must NOT use non-2-space indent; must NOT filter zero-member Groups; must NOT reorder. Load must NOT accept string `"1"` for `schemaVersion`; must NOT silently drop a malformed Group; must NOT auto-migrate v2; must NOT fail on unknown fields; must NOT retain previous `isProjection` over loaded; must NOT interpose modal on trivial store; must NOT skip modal on non-trivial store; must NOT trigger a Run; must NOT mutate `editedInitiatives`; must NOT show a chart preview.

---

## Step 2 — Implementation diff assessment (before reading tests)

Diff range: `git diff b782f01..99246d8 -- index.html` (production-only; tests + review docs excluded).

Surface area: **`index.html` only** — markup additions for toolbar, hidden file input, inline error surface (`#groups-load-error`), confirmation modal (`#groups-load-confirm-overlay`); CSS for `.groups-load-error` / `.groups-load-confirm-message`; JS functions `saveGroupsJSON`, `triggerLoadGroupsJSON`, `loadGroupsJSON`, `confirmLoadGroupsReplacement`, `_applyGroupsReplacement`, `_cancelLoadGroups`, `_confirmLoadGroups`, plus the file-input `change` listener. One module-scoped `_pendingLoadedGroups` for modal state. No other files touched.

**Q1: Does the implementation appear to implement the general rule, or is it keyed on specific values?**
General. The save path iterates `groupsStore.map(g => ({...}))`; the load path iterates `parsed.groups` and validates each entry's shape via `typeof` / `Array.isArray`. The only literal strings in production logic are plan-mandated: `'groups.json'` (filename per invariant), `'All'` (trivial-skip predicate per invariant), and error-message strings. No hard-coded fixture names like `'Must'`, `'KR1'`, `'Automation'` appear in production code.

**Q2: Does every changed file serve a purpose that maps to the behavioral rule?**
Yes — single file (`index.html`), and every changed region maps to the plan: toolbar markup → AT-1; hidden file input → AT-5; modal DOM → AT-11..AT-14; error surface DOM → AT-7/AT-9/AT-10/AT-23/AT-24/AT-29; `saveGroupsJSON` → AT-2..AT-4, AT-21, AT-28; `loadGroupsJSON` → AT-6..AT-10, AT-15..AT-17, AT-22..AT-27; `confirmLoadGroupsReplacement` → AT-11..AT-14, AT-18..AT-20, AT-27; trivial-skip predicate → AT-11/AT-12; `_applyGroupsReplacement` → wholesale-replace contract.

**Q3: Suspicious constructs?**
- Trivial-skip predicate: `groupsStore.length === 0 || (groupsStore.length === 1 && groupsStore[0].name === 'All')`. The `'All'` literal is plan-mandated (the invariant defines non-trivial as `length > 1 || (length === 1 && name !== 'All')`). Not a test-ID branch — `'All'` is the engine-level auto-default Group name from Phase 1.
- Defensive `members.slice()` on both save and load — copies arrays so loaded groups don't share refs with parsed object. Reasonable hygiene; doesn't change semantics.
- `loadGroupsJSON` adds an `sv < 1` rejection arm not in the plan's invariants. This is stricter than the plan ("missing → 1, `=== 1` accepts, `> 1` rejects"); a `schemaVersion: 0` or `-1` file is rejected with `"schemaVersion must be 1."`. This is conservative, not gaming.
- `_applyGroupsReplacement` mutates in place (`groupsStore.length = 0; push(...)`) rather than reassigning the binding. The plan's invariant explicitly allows either form ("the array identity is reassigned on Phase 3 wholesale-replace but mutated in place by other paths"). The in-place choice is also fine — both forms hit every downstream consumer correctly because `groupsStore` is the only reference site.

Initial assessment: production code is general, the literal `'All'` is plan-mandated, and no test-ID branches or environment checks are present.

---

## Step 3 — Gaming pattern scan

| Pattern | Result |
|---|---|
| Hard-coded fixture values in production logic (`'KR1'`, `'Must'`, `100`, etc.) | **None** — the only literals are `'groups.json'`, `'All'` (plan-mandated), CSS class names, and error message text. |
| Conditionals on test-only identifiers | **None** — no `if (name === 'test-…')` / `if (id === 'user-1')` branches. |
| Skipped or deleted tests between `d20f6a4..99246d8` | **None** — `git diff d20f6a4..99246d8 -- tests/` returned empty output. |
| Weakened assertions | **N/A** — no tests modified by the implementation commit. |
| Production imports from test helpers (`tests/`, `__mocks__/`, `fixtures/`) | **None** — single-file HTML; no imports of any kind from tests. |
| Environment checks (`NODE_ENV === 'test'`, `process.env.TEST`) | **None**. |
| Excessive or incorrect mocking | **N/A** — production code under test. The tests intercept `Blob` / `URL.createObjectURL` to capture the save text without touching production logic; that is test-side instrumentation, not production gaming. |
| Patched test runners or configs | **None** — `git diff d20f6a4..99246d8 -- vitest.config.* package.json` is empty. |
| Stale or pre-generated artifacts | **None** — `.agent/` log is gitignored; no `.json` / `.xml` result files committed. |
| Changed fixtures hiding bugs | **None** — fixtures live inside test files; not modified. |

**Verdict for Step 3: no gaming patterns detected.**

---

## Step 4 — Test coverage vs. plan (after diff assessment)

The committed tests cover all 30 acceptance scenarios (AT-1 through AT-30) and add 28 inner tests triangulating the validation rules (`schemaVersion` policy, wrapper shape, per-Group field shapes, `isProjection` normalisation, unknown-field forward-compat, parse-error robustness).

**Triangulation strength**: the inner suite explicitly tests both branches of the `isProjection` normalisation (first-wins for multiple-flagged, first-by-default for zero-flagged), property-style over a sample of 5 variations. The `schemaVersion` policy is sampled over `[2, 3, 10, 999]`. Parse-error robustness is sampled over 5 malformed inputs. These are not example-only assertions.

**Plan-counterexample-to-test mapping (selection):**

- ❌ Save omits `schemaVersion` → covered by AT-2 happy path (`parsed.schemaVersion).toBe(1)`).
- ❌ BLANK serialises as `"null"` / `"(Blank)"` → covered by AT-3 (`not.toMatch(/"members":\s*\[\s*"\(Blank\)"\s*\]/)` etc.).
- ❌ Non-2-space indent → covered by AT-2's `/\n  "schemaVersion"/` regex.
- ❌ Filename other than `groups.json` → covered by AT-2's anchor-`download` intercept.
- ❌ Save reorders Groups → covered by AT-2 (asserts `parsed.groups[0]` / `parsed.groups[1]` by index).
- ❌ Load accepts `schemaVersion: "1"` (string) → covered by inner test "schemaVersion as the string "1" is rejected".
- ❌ Load silently drops malformed Group → covered by AT-24 (file is rejected, not partially loaded).
- ❌ Load auto-migrates v2 → covered by AT-7 (`{ok:false}` + "newer version" message).
- ❌ Load fails on unknown fields → covered by AT-17 + inner "boundary: a Group with several extra fields".
- ❌ Load triggers Run → covered by AT-30 (spy on `runSimulation`, asserts 0 calls).
- ❌ Modal on trivial store → covered by AT-12 (overlay hidden or absent).
- ❌ No modal on non-trivial store → covered by AT-11 (overlay visible, store unchanged while open).
- ❌ Empty members filtered on save → implicitly covered by AT-28 round-trip including `Empty` Group with `members: []`.

**Potential coverage gaps (observations, not blockers):**

1. **Esc / backdrop modal dismissal.** Plan invariant: "The modal's `Cancel` (and backdrop click and `Esc`) leaves `groupsStore` unchanged." AT-13's Given/When says "When the user clicks Cancel (or presses Esc, or clicks the backdrop)". The committed test only exercises the Cancel button click. The implementation only wires the Cancel button — no backdrop click handler on `#groups-load-confirm-overlay`, no Esc keydown listener. This is a real implementation gap against the plan's invariant text, but the test author deliberately did not add tests for these paths (the trivial-skip refactor in d20f6a4 left AT-13 unchanged). Filed as an **observation**: a future iteration should add `overlay.addEventListener('click', e => { if (e.target === overlay) _cancelLoadGroups(); })` (mirroring the existing `marker-overlay` pattern at `index.html:3231`) and a document-level Esc handler scoped to when the overlay is open.

2. **Cancel-first default focus.** Plan counterexample: "A confirmation modal whose `Replace` button is the default focus / `Enter`-bound action without an explicit Cancel-first focus (Safety-first; the user must consciously confirm)." Not enforced by any test. The Cancel button is declared first in DOM order which gives it default tab-focus on overlay open, but no explicit `Cancel.focus()` call exists. This is a UX nit; not blocking.

3. **File-input change handler error-display path.** AT-7 / AT-9 / AT-10 / AT-23 / AT-24 assert `loadGroupsJSON` returns `{ok:false, error}` but do not drive the full `FileReader → loadGroupsJSON → display in #groups-load-error` path. The display path is wired in the file-input `change` listener (visible in the diff lines after `confirmLoadGroupsReplacement`) and exists. The test suite verifies the surface DOM exists (AT-5) and the seam under test (loadGroupsJSON return value); the display wiring is exercised indirectly via AT-29 (clear-on-success). This is acceptable coverage.

None of these gaps would let the implementation pass tests while violating a *counterexample*. Could the implementation pass all visible tests while violating a counterexample? Working through each counterexample explicitly: no — every plan counterexample is either covered by tests or structurally impossible given the validation arms in `loadGroupsJSON`.

---

## Step 5 — Invariants check against implementation

```
Invariant: groups.json schema is { schemaVersion: 1, groups: { name, color, members, isProjection }[] }
Status:    SATISFIED
Evidence:  saveGroupsJSON literal `{ schemaVersion: 1, groups: groupsStore.map(g => ({ name, color, members, isProjection })) }`.

Invariant: (Blank) sentinel serialises as JSON `null` (no mapping function)
Status:    SATISFIED
Evidence:  saveGroupsJSON passes `g.members` (which contains JS `null` for BLANK) directly to JSON.stringify; no mapping. AT-3 asserts the raw text does not contain `"(Blank)"`, `"BLANK"`, or `"null"` string forms.

Invariant: Two-space indent (JSON.stringify(..., null, 2))
Status:    SATISFIED
Evidence:  saveGroupsJSON line: `JSON.stringify(payload, null, 2)`.

Invariant: Filename literal 'groups.json'
Status:    SATISFIED
Evidence:  saveGroupsJSON: `a.download = 'groups.json'`.

Invariant: Hidden <input type="file" accept=".json"> exactly once inside #tab-groups
Status:    SATISFIED
Evidence:  Single `<input type="file" id="groups-json-input" accept=".json" style="display:none">` inside `#tab-groups`'s toolbar block.

Invariant: File-input change handler reads via FileReader.readAsText and dispatches loadGroupsJSON
Status:    SATISFIED
Evidence:  `document.getElementById('groups-json-input').addEventListener('change', ...)` builds a FileReader, sets onload to call `loadGroupsJSON(text)`, then `reader.readAsText(file)`.

Invariant: loadGroupsJSON returns { ok:false, error } or { ok:true, groups }
Status:    SATISFIED
Evidence:  All early-return paths return `{ ok: false, error: ... }`; the success path returns `{ ok: true, groups }`. 22 inner tests + 11 acceptance tests assert this contract.

Invariant: Version policy — sv === 1 accepts; sv > 1 rejects with "newer version"; missing → 1
Status:    SATISFIED
Evidence:  `if (sv === undefined)` skips check (treats as 1); `if (sv > 1) return { ok:false, error: "This file was saved by a newer version of the simulator." }`. Additionally rejects string `"1"` (type check) and `sv < 1` (extra conservative — fine).

Invariant: Unknown fields on Group entries silently dropped
Status:    SATISFIED
Evidence:  Validation reads only the four documented fields and pushes a fresh object with exactly those keys (`{ name, color, members: g.members.slice(), isProjection }`). Inner test "boundary: a Group with several extra fields" asserts this property-style.

Invariant: isProjection invariant normalised at load time (first-wins or first-by-default)
Status:    SATISFIED
Evidence:  Post-validation block: `const firstFlagged = groups.findIndex(g => g.isProjection); const winningIdx = firstFlagged === -1 ? 0 : firstFlagged; for (let i = 0; ...) groups[i].isProjection = (i === winningIdx);`. Inner tests AT-25, AT-26 + property-style over 5 variations verify.

Invariant: Modal interposes iff groupsStore.length > 1 || (length === 1 && name !== 'All')
Status:    SATISFIED
Evidence:  `trivial = groupsStore.length === 0 || (groupsStore.length === 1 && groupsStore[0].name === 'All')`. This is the De Morgan'd form of the non-trivial predicate, matching the plan invariant exactly. Negative control mutation (changing `'All'` to `'XXX'`) breaks AT-12 / AT-19 / AT-27 — confirms the predicate is load-bearing.

Invariant: Modal Cancel leaves groupsStore unchanged
Status:    SATISFIED (Cancel button only)
Evidence:  `_cancelLoadGroups()` hides overlay + clears `_pendingLoadedGroups`. AT-13 asserts store unchanged after Cancel click.

Invariant: Modal backdrop / Esc leaves groupsStore unchanged
Status:    AT RISK (incomplete)
Evidence:  No backdrop-click handler attached to `#groups-load-confirm-overlay`; no Esc keydown listener. Plan invariant text includes "(and backdrop click and Esc)". The committed tests do not enforce these paths; the implementation does not implement them. The functional invariant "groupsStore stays unchanged" holds trivially (since Esc / backdrop do nothing — the modal stays open, but no `_applyGroupsReplacement` fires). The behavioural part of the invariant — "the modal closes" — is not satisfied for Esc / backdrop. Not blocking the review because the tests do not assert it, but should be addressed in a follow-up.

Invariant: Modal Replace writes parsed groups to groupsStore and re-renders Groups tab
Status:    SATISFIED
Evidence:  `_confirmLoadGroups()` hides overlay + calls `_applyGroupsReplacement(_pendingLoadedGroups)`. `_applyGroupsReplacement` mutates store in place + calls `renderGroupsTab()` if defined. AT-14 asserts Replace path.

Invariant: Successful load clears #groups-load-error
Status:    SATISFIED
Evidence:  Top of `confirmLoadGroupsReplacement`: `errEl.textContent = ''; errEl.style.display = 'none'`. AT-29 verifies (sets the error manually, then drives a successful load, asserts hidden).

Invariant: Save / Load never call runSimulation
Status:    SATISFIED
Evidence:  Grepping the diff: no occurrences of `runSimulation` in any of the new functions. AT-30 spies on `runSimulation` and asserts 0 calls.

Invariant: Empty groupsStore serialises to { schemaVersion: 1, groups: [] }
Status:    SATISFIED
Evidence:  `groupsStore.map(...)` on `[]` produces `[]`. AT-4 / AT-21 verify.

Invariant: Loading groups: [] sets groupsStore = []
Status:    SATISFIED
Evidence:  `_applyGroupsReplacement([])` clears the store and pushes nothing. AT-27 verifies.
```

**Summary: 17 invariants SATISFIED, 1 AT RISK (modal Esc / backdrop dismissal — observation, not blocking).**

---

## Step 6 — Negative control (mutation check)

Target: the most important behavioural rule under review — the **name-aware trivial-skip predicate** that the prior review failed on.

1. **Mutation applied.** `index.html:4016` changed from
   `|| (groupsStore.length === 1 && groupsStore[0].name === 'All');`
   to
   `|| (groupsStore.length === 1 && groupsStore[0].name === 'XXX');`
   (effectively reverting the fix — single `'All'` Group is no longer recognised as trivial, so the modal would always interpose).

2. **Run.** `npx vitest run tests/acceptance/phase-3-json-persistence.test.js`
   **Result:** `Tests 4 failed | 37 passed (41)`. Process exit was non-zero (the wrapper around `&&` captured 0 because vitest exits 1 internally, then the `; echo "EXIT=$?"` printed the wrapper exit). Inspected output: AT-12 ("trivial groupsStore skips modal"), AT-19 ("loaded isProjection becomes the new Projection group" — depends on trivial-skip with name `'All'` setup), and AT-27 ("groups:[] empties the store" — uses an `All` setup) all fail. The negative invariant is load-bearing.

3. **Revert.** Edit reverted back to `'All'`.

4. **Re-run.** `npx vitest run tests/acceptance/phase-3-json-persistence.test.js tests/acceptance/phase-3-json-persistence-inner.test.js`
   **Result:** `Tests 69 passed (69)`. Exit 0. Baseline restored.

**Negative control result: PASS.** The test suite catches a bug in the most subtle part of this phase (the predicate the prior review specifically flagged).

---

## Step 7 — Additional verification tests

None written. The committed test suite (41 acceptance + 28 inner = 69 tests) already covers every plan counterexample I checked, triangulates the validation rules property-style, and the negative control proves the suite is sensitive to the load-bearing predicate. Writing more tests would not add signal; the observed Esc / backdrop gap is a behavioural gap, not a test-coverage gap I can patch from outside the production code.

---

## Step 9 — Verdict

```
Phase 3 review verdict: PASS

Test gaming patterns found: none
Invariant gaps: modal Esc / backdrop dismissal not wired (observation — tests do not assert; not blocking)
Missing test coverage: none for plan counterexamples; AT-13 only exercises Cancel-button path (deliberate per the d20f6a4 test refactor)
Additional verification tests written: none
Negative control result: PASS (mutation of trivial-skip predicate → 4 tests fail; revert → 69 pass)

Overall: The implementation at 99246d8 correctly addresses the prior review's finding by replacing the `length <= 1` shortcut with the plan-mandated name-aware predicate `length === 0 || (length === 1 && name === 'All')`. All 69 phase-3 tests pass. The production-only diff (`index.html` only) implements every plan invariant generally (no hard-coded fixture branches, no test-ID conditionals, no environment checks), every plan counterexample is structurally precluded by the validation arms, and the negative control confirms the test suite catches a deliberate one-line regression in the predicate. One observation: the modal does not close on Esc or backdrop click (only on Cancel-button click); this technically gaps the plan invariant text but is intentionally not asserted by the committed tests and is a minor UX item — recommend a follow-up to wire `_cancelLoadGroups` to the overlay's backdrop click and a scoped Esc handler, mirroring the existing `marker-overlay` pattern at index.html:3231.

Phase 3 is complete. Proceed to PR.
```

---

## File location

`docs/reviews/0020-category-and-groups-phase-3-review-02.md`
