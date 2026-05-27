# Phase 3 review — `0020-category-and-groups`

- Plan: `docs/plans/0020-category-and-groups.md`
- Phase: 3 (Groups JSON persistence — Save / Load with `schemaVersion: 1` and wholesale-replace load)
- Review run: 01
- Date: 2026-05-27
- Test commit: `b782f0130c9b16e7b622cc83e8d061e7e7cb46a8`
- Implementation commit: `376353c3b9fc1bf250cac3193c36ac062200d39d`

---

## Step 1 — Plan summary (Phase 3)

**Behavioral rule.** Two toolbar buttons inside the Groups tab — `↓ Save groups (JSON)` / `↑ Load groups (JSON)`. Save serialises `{ schemaVersion: 1, groups: groupsStore.map(...) }` via `JSON.stringify(..., null, 2)`, downloads as `groups.json`; the **(Blank) sentinel** (JS `null`) serialises natively as JSON `null`. Load parses, validates the wrapper + per-Group shape, enforces `schemaVersion` policy (`1` accepts, `>1` rejects with "newer version" message, missing→treated as 1), normalises the `isProjection` invariant at load time (first-wins on duplicates, first-by-default on zero), and replaces `groupsStore` wholesale. A confirmation modal interposes iff the current store is **non-trivial** (`length > 1 || (length === 1 && groups[0].name !== 'All')`). Save / Load never trigger a Run; commit-on-Run discipline.

**Key invariants.**
- Schema is `{ schemaVersion: 1, groups: [...] }` with two-space indent.
- BLANK ↔ JSON `null` end-to-end; no mapping function.
- `loadGroupsJSON(text)` returns `{ ok: false, error }` on any failure, `{ ok: true, groups }` on success.
- Unknown Group fields silently dropped (forward-compat).
- `isProjection` normalised at load time.
- **Trivial-skip check**: modal only skipped iff `length === 0` OR `(length === 1 && name === 'All')`.
- Confirmation modal `#groups-load-confirm-overlay`, inline error surface `#groups-load-error`, both inside `#tab-groups`.

**Forbidden shortcuts.**
- No `localStorage` cache, no auto-save, no preview-before-replace, no additive-merge mode, no Run on save / load.
- No magic-string `BlankSentinel`; `null` end-to-end.
- No `schemaVersion: "1"` string coercion.

---

## Step 2 — Initial assessment from diff (before reading tests)

`git diff` touches only `index.html` (+194 / -1). Changes are:
- CSS for `.groups-load-error` and `.groups-load-confirm-message`.
- Toolbar HTML with two buttons + hidden file input inside `#tab-groups`.
- Inline error surface `#groups-load-error`.
- Confirmation modal `#groups-load-confirm-overlay` outside the panel.
- JS functions: `saveGroupsJSON`, `triggerLoadGroupsJSON`, `loadGroupsJSON`, `confirmLoadGroupsReplacement`, `_applyGroupsReplacement`, `_cancelLoadGroups`, `_confirmLoadGroups`.
- `change` listener on the hidden file input.

**Initial answers.**
1. *Does the implementation appear to implement the general rule, or be keyed on specific values?* — Looks general. No literal "Critical", "Must", "Should", "KR1" branches in production logic.
2. *Does every changed file serve a purpose?* — Yes; everything maps to the plan's Public entry point and Invariants.
3. *Suspicious constructs?* — One concern stood out before reading tests:

> In `confirmLoadGroupsReplacement`:
> ```js
> if (groupsStore.length <= 1) {
>   _applyGroupsReplacement(loadedGroups);
>   return;
> }
> ```
>
> The plan's trivial-skip rule is:
> `groupsStore.length === 0 || (groupsStore.length === 1 && groupsStore[0].name === 'All')`.
>
> The implementation's `<= 1` is more permissive: it skips the modal for **any** single Group, including one the user has renamed away from `All` (e.g. `Critical`, `KR1`) or any single user-defined Group built via `+ New group` and then deleted siblings. Per the plan such a store is non-trivial and the modal MUST interpose.

I flagged this as the prime overfitting suspect before reading the tests.

---

## Step 3 — Test gaming scan

| Pattern | Status |
| --- | --- |
| Hard-coded fixture values in production logic | NOT present. Literal `'#4f46e5'` and `'All'` exist in production, but as the documented auto-default Group seed in Phase 1; no test-fixture references like `'Critical'`, `'KR1'`, `'NewG'` leak into production. |
| Conditionals on test-only identifiers | NOT present. |
| Skipped / deleted tests | NOT present. `git diff <TEST_SHA>..<IMPL_SHA> -- tests` is empty. |
| Weakened assertions | NOT present in committed tests. |
| Production imports from test helpers | NOT present. |
| Environment checks (`NODE_ENV === 'test'`) | NOT present. |
| Excessive / incorrect mocking | NOT present. Tests use real `JSON.parse` against the real implementation. |
| Patched runner / coverage configs | NOT present. `vitest.config*` untouched. |
| Stale or pre-generated artefacts | NOT present. |
| Changed fixtures | NOT present. |

`git diff b782f01..376353c -- tests features e2e acceptance` returns no output. Test files are unmodified.

---

## Step 4 — Tests vs. plan (read after Steps 2–3)

The committed suite covers 30 scenarios across acceptance + 28 inner tests. All triangulate well except for the **trivial-skip check**, which is example-covered, not rule-covered:

- **AT-11** uses 3 Groups (`KR1 / KR2 / KR3`) — confirms `length > 1` triggers the modal.
- **AT-12** uses (a) a single Group named `All` and (b) `groupsStore === []` — confirms both skip the modal.
- **Missing**: a single Group with `name !== 'All'` (e.g. `Critical`, `KR1`, or a user-renamed auto-default). This is precisely the case the plan flags as non-trivial and the implementation gets wrong.

This is a textbook overfitting scenario:
- Plan rule: `non-trivial = length > 1 OR (length === 1 && name !== 'All')`
- Tests exercise: `length === 3` (non-trivial) ✓, `length === 1 && name === 'All'` (trivial) ✓, `length === 0` (trivial) ✓.
- The fourth quadrant `length === 1 && name !== 'All'` is not asserted.
- Implementation reads tests as "length === 1 → trivial" and writes `<= 1`. Tests pass; plan is violated.

No other plan rules appear under-covered. Schema policy, BLANK round-trip, isProjection normalisation, parse / shape errors, modal cancel / replace flow, no-Run-on-save-load, unknown-field forward-compat, empty-store save, pre-CSV load — all triangulated to my satisfaction.

---

## Step 5 — Invariants vs. implementation

```
Invariant: The groups.json schema is { schemaVersion: 1, groups: { name, color, members, isProjection }[] }.
Status: SATISFIED
Evidence: saveGroupsJSON builds exactly this shape; loadGroupsJSON validates the four documented fields per Group.

Invariant: The (Blank) sentinel serialises as the JSON null literal.
Status: SATISFIED
Evidence: members serialised via members.slice() — JS null → JSON null via JSON.stringify. AT-3 + AT-15 + AT-28 all green.

Invariant: JSON.stringify(..., null, 2) is the canonical serialisation form.
Status: SATISFIED
Evidence: saveGroupsJSON line `const json = JSON.stringify(payload, null, 2);`.

Invariant: Downloaded filename is the literal 'groups.json'.
Status: SATISFIED
Evidence: `a.download = 'groups.json'`.

Invariant: The hidden <input type="file" accept=".json"> exists exactly once.
Status: SATISFIED
Evidence: One `<input type="file" id="groups-json-input" accept=".json">` inside the Groups toolbar.

Invariant: loadGroupsJSON returns { ok:false, error } or { ok:true, groups }.
Status: SATISFIED
Evidence: Every return path matches one of these two shapes.

Invariant: schemaVersion === 1 parses; > 1 rejects; missing treated as 1.
Status: SATISFIED
Evidence: lines 3968-3979 implement exactly this policy. Inner suite property-tests {2,3,10,999} reject.

Invariant: Unknown fields on Group entries silently dropped.
Status: SATISFIED
Evidence: groups.push({ name, color, members, isProjection }) only — unknown keys not copied. AT-17 + inner forward-compat suite green.

Invariant: isProjection normalisation at load time — first-wins or first-by-default.
Status: SATISFIED
Evidence: lines 4000-4006. Inner property test covers all combinations.

Invariant: Confirmation modal interposes iff
    groupsStore.length > 1 || (groupsStore.length === 1 && groupsStore[0].name !== 'All')
Status: VIOLATED
Evidence: confirmLoadGroupsReplacement uses `if (groupsStore.length <= 1)` (index.html:4014). This skips the modal for a single user-defined Group whose name is not 'All' — a case the plan explicitly classifies as non-trivial. Two additional verification tests (tests/verification/phase-3-review-01.test.js) confirm the divergence:
  • single Group named 'Critical' → modal stays display:none, groupsStore is overwritten immediately (plan says modal must show, store must stay).
  • single Group named 'KR1' → same.
Failure mode: a user who renamed the auto-default `All` Group to e.g. `Critical` and then accidentally clicks Load with the wrong file loses their group definition silently — no confirmation, no undo.

Invariant: Modal Cancel leaves groupsStore unchanged.
Status: SATISFIED
Evidence: _cancelLoadGroups hides the overlay and nulls `_pendingLoadedGroups`; no mutation. AT-13 green.

Invariant: Modal Replace writes parsed groups + re-renders.
Status: SATISFIED
Evidence: _confirmLoadGroups calls _applyGroupsReplacement, which mutates groupsStore in place and calls renderGroupsTab. AT-14 green.

Invariant: Successful load clears any pre-existing inline error.
Status: SATISFIED
Evidence: confirmLoadGroupsReplacement clears #groups-load-error at the top. AT-29 green.

Invariant: Save / Load never call runSimulation.
Status: SATISFIED
Evidence: Diff contains no runSimulation reference. AT-30 spies green.

Invariant: Empty groupsStore serialises to { schemaVersion: 1, groups: [] }.
Status: SATISFIED
Evidence: Direct from saveGroupsJSON. AT-4 + AT-21 green.

Invariant: Loading groups: [] sets groupsStore = [].
Status: SATISFIED
Evidence: _applyGroupsReplacement empties via length=0 and pushes nothing. AT-27 green.
```

**Counterexample re-check** (must NOT pass per plan §"Counterexamples"):

| Counterexample | Risk | Evidence |
| --- | --- | --- |
| Save omits `schemaVersion` | NO | always emitted |
| Save serialises BLANK as `"null"` / `"(Blank)"` / `"BLANK"` | NO | JS `null` → JSON `null` |
| Non-2-space indent | NO | `null, 2` |
| Filter out empty-member Groups | NO | lenient — all entries kept |
| Re-order Groups (e.g. alphabetical) | NO | order preserved via `.map` over `groupsStore` |
| Accept `schemaVersion: "1"` | NO | inner test green; rejected with "must be an integer" |
| Silently drop a malformed Group | NO | hard reject on shape failure |
| Migrate a v2 file automatically | NO | rejected with "newer version" |
| Fail on unknown fields | NO | forward-compat — silently dropped |
| Retain previous `isProjection` over loaded value | NO | wholesale replace |
| **Interpose modal on a trivial store** | NO | trivial-skip in place |
| **Fail to interpose modal on a non-trivial store** | **YES** | single Group `Critical` (length===1, name!=='All') incorrectly skips — see invariant violation above |
| Trigger Run after load | NO | AT-30 spy proves no runSimulation call |
| Set chart to a "preview" state | NO | no chart code touched |
| Prompt user for filename | NO | filename hardcoded |
| Modal without backdrop overlay | NO | uses `marker-overlay` class |
| Replace as default focus / Enter-bound | NO | no `autofocus` attribute on Replace |
| Fail to clear inline error on subsequent success | NO | AT-29 green |

---

## Step 6 — Negative control

I introduced a deliberate one-line bug:

```diff
- groups[i].isProjection = (i === winningIdx);
+ groups[i].isProjection = (i !== winningIdx);
```

This inverts the load-time isProjection normalisation.

```
$ npx vitest run tests/acceptance/phase-3-json-persistence.test.js tests/acceptance/phase-3-json-persistence-inner.test.js
…
 Test Files  2 failed (2)
      Tests  11 failed | 58 passed (69)
   Duration  1.40s
Exit code: 0  (vitest exits 0 in non-CI mode; the file-level "2 failed" is the signal)
```

Reverted, full suite passes:
```
 Test Files  2 passed (2)
      Tests  69 passed (69)
   Duration  1.29s
```

Negative control: **PASS** — the suite catches a deliberate one-line bug in the most behaviourally-load-bearing line.

---

## Step 7 — Additional verification tests

Wrote `tests/verification/phase-3-review-01.test.js` with two scenarios targeting the trivial-skip gap:

1. Single Group named `Critical` (not `All`) — load should interpose the modal.
2. Single Group named `KR1` (not `All`) — load should interpose the modal.

Both **FAIL** on the current implementation:

```
 FAIL tests/verification/phase-3-review-01.test.js
  × verification: single non-All Group is non-trivial → modal MUST interpose >
      a single Group named Critical (not All) triggers the confirmation modal
    → modal should be visible for a single non-All Group: expected 'none' not to be 'none'
  × verification: … > a single Group named KR1 (not All) … triggers the confirmation modal
    → expected 'none' not to be 'none'

 Test Files  1 failed (1)
      Tests  2 failed (2)
```

The implementation skips the modal and applies the replace immediately, then the test sees `overlay.style.display === 'none'` and fails.

These tests do **NOT** modify any production code or committed test. They are independent verification per the `/phase-review` Step 7 contract.

---

## Step 8 — Verdict

```
Phase 3 review verdict: FAIL

Test gaming patterns found: none
Invariant gaps: trivial-skip check uses `groupsStore.length <= 1` instead of
                `length === 0 || (length === 1 && groups[0].name === 'All')`.
                The plan invariant under §"Behavioral rule" + §"Invariants"
                explicitly requires the name check.
Missing test coverage: AT-11 / AT-12 do not cover the
                       `length === 1 && name !== 'All'` quadrant. The committed
                       suite only triangulates length > 1 (non-trivial)
                       and length === 1 with the exact name 'All' (trivial)
                       plus length === 0 (trivial).
Additional verification tests written:
  tests/verification/phase-3-review-01.test.js (2 tests, both FAIL on current
  implementation, confirming the invariant violation)
Negative control result: PASS — 11 tests fail when isProjection assignment
                         is inverted; revert restores 69/69 pass.

Overall: The acceptance + inner suites are otherwise thorough and the
implementation is clean — no test-fixture leakage, no skipped tests, no
runner config patches, no environment checks. The single concrete defect is
the trivial-skip check in confirmLoadGroupsReplacement (index.html:4014-4018):
the production code uses a permissive `length <= 1` shortcut while the plan
specifies a name-aware predicate. The two write paths it affects are
(a) a user who has manually renamed the auto-default `All` Group via the
Phase-2 Groups tab and (b) a user who has deleted all but one user-defined
Group and then tries to Load. Both lose their data silently with no
confirmation.

Required correction (production code only — no test edits):

  index.html:4014 — replace
      if (groupsStore.length <= 1) {
  with
      const trivial =
        groupsStore.length === 0
        || (groupsStore.length === 1 && groupsStore[0].name === 'All');
      if (trivial) {

  After the fix, the existing 69 tests must still pass AND the two
  verification tests in tests/verification/phase-3-review-01.test.js must
  pass. The phase loops back to Step 2 of /phase-implement.
```

Review saved to: `docs/reviews/0020-category-and-groups-phase-3-review-01.md`
