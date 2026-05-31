# Review — 0021 constant-work-tab-and-group-scoping — Phase 1 — run 01

- **Plan:** `docs/plans/0021-constant-work-tab-and-group-scoping.md` (Phase 1: `editedConstantWork` substrate)
- **Phase:** 1 of 8
- **Review run:** 01
- **Date:** 2026-05-31T20:45:15Z
- **Test commit:** `784f6eeec39b5ad0121c2c7ab4a9bc1582ea03c4` (atdd p1, `handover-04-atdd-p1.md`)
- **Impl commit:** `355c2b8878f29dcb0971a886f66561eb700c4271` (implement p1, `handover-05-implement-p1.md`)
- **Diff range:** `784f6ee..355c2b8`
- **Mode:** BACKLOG LOOP (autonomous; no user gating)

---

## Step 1 — Plan (Phase 1 contract extracted)

**Behavioral rule.** A second module-scoped array `editedConstantWork` is created at **Constant Work CSV** load time as a per-row shallow clone of `parsedConstantWork` (`parsedConstantWork.map(r => ({ ...r }))`) and becomes the *simulation source of truth*. Every production reader of constant-work rows — `getConstantWorkEffort`, `getConstantWorkEpics`, and `buildTeamProjections`' `cwQuarters` derivation — reads `editedConstantWork`. `parsedConstantWork` remains the immutable parsed input, retained only for the Phase 6 datalist option pools. `resetConstantWorkFile` nulls **both**; a re-load rebuilds the clone wholesale; with nothing loaded both are `null` and each reader's null-guard returns its empty value (`0` / `[]`).

**Invariants.**
1. `editedConstantWork` declared `let editedConstantWork = null;` immediately after `parsedConstantWork`.
2. Whenever `parsedConstantWork !== null`, `editedConstantWork !== null` with the same length.
3. After load: per-row distinct references; per-cell value equality; equal key order.
4. `parsedConstantWork` never mutated by any reader.
5. The three named readers all name `editedConstantWork`, never `parsedConstantWork`.
6. `resetConstantWorkFile` nulls both arrays.

**Counterexamples (must NOT pass).** deep clone (`JSON.parse(JSON.stringify(...))`); `slice()` reference sharing; lazy/first-edit clone; a reader left on `parsedConstantWork`; a reset that nulls only `parsedConstantWork`; a reader that defensively re-clones `parsedConstantWork` before reading.

**Forbidden shortcuts.** unify the two arrays; a `getConstantWork()` "right one" helper; deep-clone/memoize across CSV swaps; migrate the option-pool/datalist reads (those stay on `parsedConstantWork`).

**Expected observable outcomes.** module-scoped clone created at load; every production reader reads `editedConstantWork`; arrays independent per-row; transparent (no-edit load → identical Run output); clear nulls both, replace rebuilds.

**Proposed seams.** the `editedConstantWork` binding; the readers reading it; the clone in `loadConstantWorkCSV` and the null in `resetConstantWorkFile`. Explicitly *not* locked: the spread idiom, and whether `cwQuarters` is inlined or extracted.

---

## Step 2 — Implementation diff (initial assessment, before reading tests)

Production change is `index.html`-only and small:

- `index.html:1559-1560` — added `let editedConstantWork = null;` immediately after `parsedConstantWork` (whose comment is updated to "immutable parse output, retained as the datalist option-pool substrate"). Satisfies invariant 1.
- `index.html:1736` — `resetConstantWorkFile` adds `editedConstantWork = null;` beside the existing `parsedConstantWork = null;`. Satisfies invariant 6.
- `index.html:1747` — `loadConstantWorkCSV` adds `editedConstantWork = parsedConstantWork.map(r => ({ ...r }));` right after the parse. Per-row shallow clone — the exact plan idiom (mirrors `editedInitiatives`).
- `index.html:1756,1759` — `getConstantWorkEffort` guard and loop migrated to `editedConstantWork`.
- `index.html:1774,1777` — `getConstantWorkEpics` guard and filter migrated to `editedConstantWork`.
- `index.html:2112-2113` — `buildTeamProjections`' `cwQuarters` derivation migrated to `editedConstantWork`.

Answers to the three Step-2 questions from the diff alone:
1. **General rule, not value-keyed.** The clone is a structural `.map(r => ({ ...r }))`; the readers iterate/filter the whole array. No literal fixture value (`"Backend"`, `"M"`, `"Q3 2026"`, `"CW-1"`, a magic PM number) appears in the production change.
2. **Every changed file maps to the rule** — see Step 3 for the one out-of-feature file in the range.
3. **No suspicious constructs** — no `if (id === …)`, no hard-coded numbers, no `NODE_ENV`/`process.env` branch, no `tests/` import.

Two non-`index.html` files in the range are the task's own backlog docs (`index.md`, `handover-05-implement-p1.md`) — expected per the atomic-commit contract.

---

## Step 3 — Test-gaming scan

Diff range contains two commits: `355c2b8` (the implement commit) and `3029009` ("Changed model to Opus for all stages"). Files touched in range: `index.html`, the two backlog docs, and `backlog.config.json`.

| Pattern | Finding |
|---|---|
| Hard-coded fixture values | **None.** No fixture literal in production logic. |
| Conditionals on test-only identifiers | **None.** |
| Skipped/deleted tests | **None.** `git diff 784f6ee..355c2b8 -- tests features e2e acceptance` is **empty** — no test file changed. |
| Weakened assertions | **None** (no test edits at all). |
| Production imports from test helpers | **None.** |
| Environment checks in production | **None.** |
| Excessive/incorrect mocking | **None.** |
| Patched test runners/configs | **None of the test-runner configs** (`vitest.config.*`, etc.) changed. `backlog.config.json` *did* change (`sonnet`→`opus` model selection, from the interleaved commit `3029009`) — this is the **backlog-loop orchestration config**, not a test runner / coverage / timeout config. It cannot affect test pass/fail. Recorded, not a gaming pattern. |
| Stale/pre-generated artifacts | **None.** Test results regenerated live this session (see Step 7 / negative control). |
| Changed fixtures | **None.** |

**Verdict for Step 3:** no gaming pattern; no test file modified between test and impl commits.

---

## Step 4 — Tests (read after forming the Step-2 view)

`tests/acceptance/phase-1-constant-work-substrate.test.js` (AT-1…AT-9) maps 1:1 to the plan's Phase-1 acceptance scenarios and targets only the named seams (binding, lifecycle, three readers). It deliberately does NOT pin the spread idiom or whether `cwQuarters` is inlined — matching the plan's "do not lock in" note.

- **AT-1** — clone is a NEW top-level array; per-row distinct references; per-cell value equality; equal `Object.keys` order. (Catches deep-clone *and* slice counterexamples.)
- **AT-2** — editing `editedConstantWork[0]` leaves `parsedConstantWork[0]` unchanged. (Catches slice ref-sharing.)
- **AT-3** — `resetConstantWorkFile` nulls both. (Catches "nulls only parsedConstantWork".)
- **AT-4** — `getConstantWorkEffort` reflects the *edited* size; iterates `['S','L','XL']` comparing against `tshirtToPersonMonths(size)` (general rule, not a hard-coded number); asserts the result is NOT the original `M`. (Catches reader-left-on-parsed, lazy clone, and defensive re-clone.)
- **AT-5** — `getConstantWorkEpics` returns the edited `epic_name`. (Catches reader-left-on-parsed for the epics reader.)
- **AT-6** — `buildTeamProjections` includes the edited quarter and drops the original. (Catches reader-left-on-parsed for `cwQuarters`.)
- **AT-7** — both `null` → readers return `0` / `[]`.
- **AT-8** — `edited` `toEqual` `parsed` and reader effort matches a parsed-direct computation (transparent indirection; reader-level identity == Run-level identity because constant work enters the engine only via these readers — ADR-0033).
- **AT-9** — re-load rebuilds the clone wholesale; prior edit discarded. (Catches memoize-across-swaps.)

Migrated engine tests (frozen): `phase-1-engine.test.js` **AT-21** (mounts `editedConstantWork = [...]` then asserts `getConstantWorkEpics` resolves the category cascade) and **AT-27** (mounts `editedConstantWork = [...]`, empties `groupsStore`, asserts the projection band collapses to a non-zero `cwEffort = tshirtToPersonMonths('M')`, proving the read goes through the edited substrate). Both correctly target the new source of truth. AT-25 still passes `fixedEffort: 0` to `runSimulation` — that is the scalar→vector contract deliberately deferred to **Phase 2** per the plan's test-contract-migration note, and is unaffected by Phase 1.

**Could the impl pass all visible tests while violating a counterexample?** No — each of the six counterexamples has a catching test (AT-1/AT-2 for clone-shape, AT-3 for reset, AT-4/AT-5/AT-6 for reader source incl. lazy/defensive-reclone, AT-9 for memoize). No behavioral case in the plan is left uncovered.

---

## Step 5 — Invariants vs. implementation

```
Invariant 1: editedConstantWork declared `let … = null;` immediately after parsedConstantWork.
Status: SATISFIED
Evidence: index.html:1559-1560 — the two declarations are adjacent.

Invariant 2: parsedConstantWork !== null ⇒ editedConstantWork !== null, same length.
Status: SATISFIED
Evidence: loadConstantWorkCSV (index.html:1746-1747) sets both in the same call; the clone is `.map` over the parsed array (equal length). AT-1 asserts equal length; AT-8/AT-9 assert structural equality.

Invariant 3: per-row distinct refs; per-cell value equality; equal key order.
Status: SATISFIED
Evidence: `.map(r => ({ ...r }))` makes a fresh object per row, copying own enumerable string keys in source order; CSV cells are strings so no value coercion. AT-1 asserts all three.

Invariant 4: parsedConstantWork never mutated by a reader.
Status: SATISFIED
Evidence: the three readers only read (for/filter/map); none assigns into a row. AT-2/AT-4/AT-5 assert parsedConstantWork is unchanged after edits.

Invariant 5: the three named readers name editedConstantWork, never parsedConstantWork.
Status: SATISFIED
Evidence: exhaustive grep of index.html — the only parsedConstantWork references left are lifecycle (declaration 1559, reset-null 1735, parse 1746, clone-source 1747, a `.length` console.log 1748). getConstantWorkEffort (1756/1759), getConstantWorkEpics (1774/1777), and cwQuarters (2112/2113) all name editedConstantWork. No fourth production reader exists.

Invariant 6: resetConstantWorkFile nulls both arrays.
Status: SATISFIED
Evidence: index.html:1735-1736 nulls parsedConstantWork then editedConstantWork. AT-3 asserts both null.
```

No invariant is AT RISK or VIOLATED.

---

## Step 6 — Negative control (mutation test)

Targeted command: `npx vitest run tests/acceptance/phase-1-constant-work-substrate.test.js tests/acceptance/phase-1-engine.test.js`

1. **Baseline (clean impl):** exit **0** — 39 passed.
2. **Introduce bug:** `index.html:1759` `for (const r of editedConstantWork)` → `for (const r of parsedConstantWork)` (re-introduces the "reader left on parsedConstantWork" counterexample for `getConstantWorkEffort`).
3. **Run with bug:** exit **1** — **1 failed | 38 passed**; the failing test is `AT-4: getConstantWorkEffort reads editedConstantWork … returns the person-months of the EDITED t-shirt size`. The suite catches the core regression.
4. **Revert bug** (restored to `editedConstantWork`).
5. **Re-run after revert:** exit **0** — 39 passed; `git status --porcelain` empty (mutation fully reverted — the commit will contain no production change).

**Negative control: PASS.**

---

## Step 7 — Additional verification tests

**None written.** The committed acceptance suite already has a catching test for every Phase-1 invariant and all six counterexamples (mapped in Step 4), and the negative control demonstrates the suite fails on a real regression. Adding redundant tests would be noise. No coverage gap was found that the committed tests miss.

---

## Step 8 — Verification evidence (re-run this session)

- Targeted: `npx vitest run tests/acceptance/phase-1-constant-work-substrate.test.js tests/acceptance/phase-1-engine.test.js` → exit **0**, **39 passed** (9 substrate + 30 engine).
- Full: `npm run verify` (`vitest run`) → exit **0**, **160 passed | 1 skipped** (10 files). The 1 skip is the engine-mean sanity check that self-skips when CSV fixtures are absent (pre-existing, commit `88b0416`; unrelated to this phase).
- Test-file drift: `git diff 784f6ee..355c2b8 -- tests features e2e acceptance` → **empty**.

---

## Step 9 — Verdict

```
Phase 1 review verdict: PASS

Test gaming patterns found: none
Invariant gaps: none
Missing test coverage: none
Additional verification tests written: none
Negative control result: PASS

Overall: The implementation is the general substrate rule the plan specifies and
nothing more. editedConstantWork is declared adjacent to parsedConstantWork, built
as a per-row shallow clone (`.map(r => ({ ...r }))`) at load, nulled alongside
parsedConstantWork on reset, and read by all three production constant-work readers
(getConstantWorkEffort, getConstantWorkEpics, buildTeamProjections' cwQuarters); an
exhaustive grep confirms no fourth reader and that the remaining parsedConstantWork
references are lifecycle-only. None of the six plan counterexamples is present
(no deep clone, no slice, no lazy clone, no reader on parsedConstantWork, reset
nulls both, no defensive re-clone) and no forbidden shortcut is taken. No test file
changed between the test and impl commits; no test-gaming pattern exists (the lone
out-of-feature file in the range, backlog.config.json, is loop-orchestration model
selection, not a test runner config). The targeted suite and full verify both exit 0,
and a negative-control mutation of the core reader is caught by AT-4. Advance to
Phase 2 atdd.
```

Saved review: `docs/reviews/0021-constant-work-tab-and-group-scoping-phase-1-review-01.md`
