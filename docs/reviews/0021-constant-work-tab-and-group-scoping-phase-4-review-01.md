# Review — 0021 constant-work-tab-and-group-scoping — Phase 4 — run 01

- **Plan:** `docs/plans/0021-constant-work-tab-and-group-scoping.md` (Phase 4 —
  Team Projections surface honors Category-scoping, degenerate fallback resolved)
- **Phase:** 4 of 8
- **Review run:** 01
- **Date:** 2026-05-31T22:12:07Z
- **Test commit:** `90f41cd608f592437e6d78fc5982522ae7d508e6` (atdd p4 — RED confirmed)
- **Impl commit:** `475296af542e00d0ef24d4aed4f4d74637fb9dfd` (implement p4)
- **Verdict:** **PASS**

---

## Step 1 — Plan (Phase 4 slice)

**Behavioral rule.** On the **Team Projections tab**, each (team, quarter) cell
scopes its constant work to the **Projection group**'s members: the appended
constant-work **Initiative matrix** rows and the `cwEffort` band floor include
only constant-work rows (for that team, that quarter) whose Category ∈
`projGroup.members` (case-insensitive `trim` + case-fold + the **(Blank)
sentinel**, ADR-0028). The single-group projection `runSimulation` call passes
`fixedEffortPerGroup: [scopedCwEffort]`. **Degenerate fallback (ADR-0023):** when
no Projection group exists (or `groupsStore` is empty), the cell falls back to the
constant-work-only flat band using **all** constant work for that (team, quarter).
Category-scoping applies only when a Projection group exists.

**Invariants.**
1. Projection group present → `cell.cwEffort` = Σ `tshirtToPersonMonths(size)` over
   the cell's constant-work rows whose Category ∈ `projGroup.members`.
2. Projection group present → the cell's appended constant-work matrix rows are
   exactly those scoped rows.
3. No Projection group / empty `groupsStore` → `cell.cwEffort` = Σ over **all** the
   cell's constant-work rows (degenerate fallback).
4. The projection `runSimulation` call passes `fixedEffortPerGroup: [scopedCwEffort]`.
5. Initiative-side projection behaviour (`kProj`, the `kProj > 0` band) is unchanged
   except for the scoped `cwEffort` floor.

**Counterexamples (must NOT pass).**
- A cell showing all constant work (every Category) when a Projection group exists.
- A cell whose `cwEffort` is the unscoped total when a Projection group exists.
- A zero-member Projection group that still lifts the band by all constant work.
- A projection `runSimulation` call still passing the scalar `fixedEffort: cwEffort`.

**Forbidden shortcuts.**
- Dropping the degenerate fallback.
- Scoping by the *first* Group when no `isProjection` Group exists (the fallback is
  all-constant-work, not first-Group).

**Expected observable outcomes / seams.** A projection cell shows only
Projection-group-scoped constant work in band + matrix; a zero-member group scopes
to `0`; no Projection group / empty `groupsStore` falls back to all constant work.
Seam: `buildTeamProjections(...)`, cells read at `proj[i].byQuarter[q]`
(`cwEffort`, `p25/p50/p75`, `initiatives.filter(isConstant)`). The plan explicitly
does **not** lock in whether scoping reuses the Phase 2 vector helper or filters
`getConstantWorkEpics`' output inline.

---

## Step 2 — Implementation diff (initial view, before reading tests)

Diff `90f41cd..475296a`. Changed files: `index.html` (the only production change),
plus the loop artifacts `docs/backlog/.../handover-14-implement-p4.md` and
`docs/backlog/.../index.md`. The entire production change is inside
`buildTeamProjections`:

```js
// index.html:2230-2238 — new local derivation, right after
//   const cwEpics = getConstantWorkEpics(q, teamName);
const scopedCwEpics = projGroup
  ? cwEpics.filter(e => e.category === BLANK
      ? projHasBlank
      : projLcMembers.has(e.category.toLowerCase()))
  : cwEpics;
// index.html:2263 — matrix append now off scopedCwEpics
for (const cw of scopedCwEpics) initiatives.push(cw);
// index.html:2267 — band floor now off scopedCwEpics
const cwEffort = scopedCwEpics.reduce((s, e) => s + e.effort, 0);
// index.html:2288 — runSimulation call unchanged structurally; cwEffort is now scoped
fixedEffortPerGroup: [cwEffort],
```

Initial answers:
1. **General rule, not keyed on values?** General. The filter is driven by the
   membership sets `projGroup` / `projLcMembers` / `projHasBlank` computed at
   `index.html:2200-2208` — the *same* sets the `kProj` count consumes
   (`index.html:2274-2280`). No literal Category strings, no magic numbers.
2. **Does every changed file map to the rule?** Yes. Only `index.html` carries
   production change; the other two files are the loop's handover + index.
3. **Suspicious constructs?** None. No `if (id === …)`, no hard-coded fixture
   numbers, no `NODE_ENV`/`process.env` checks, no `tests/` import.

Initial assessment: the diff implements exactly the plan's behavioral rule, with
the documented inline-filter mechanism (one of the two latitudes the plan allows).

---

## Step 3 — Test-gaming scan

| Pattern | Finding |
|---|---|
| Hard-coded fixture values (`Backend`/`Ops`/`ScaffoldCat`/`2.20`/`6.60`) in prod | **None** — `grep -Ei` over the production diff returns nothing |
| Conditionals on test-only identifiers | **None** |
| Skipped/deleted tests | **None** — `git diff 90f41cd..475296a -- tests features e2e acceptance` is **empty** |
| Weakened assertions | **None** (no test file changed) |
| Production imports from `tests/`/`__mocks__`/`fixtures` | **None** |
| Environment checks (`NODE_ENV`/`process.env`) | **None** |
| Excessive/incorrect mocking | **None** |
| Patched runner/config (`vitest.config`/coverage/timeouts) | **None** — not in the diff |
| Stale/pre-generated artifacts | **None** — test logs produced live this session |
| Changed fixtures/factories/seeds | **None** |

`git diff --name-only 90f41cd..475296a` = `handover-14-implement-p4.md`,
`index.md`, `index.html`. No test file drifted.

---

## Step 4 — Tests (read after forming the view)

Read `tests/acceptance/phase-4-projections-constant-work-scoping.test.js` (frozen at
the test commit) and the migrated `phase-1-engine.test.js` AT-26/AT-27. All Phase 4
scenarios drive the public seam `buildTeamProjections(...)` and assert on
`proj[i].byQuarter[q]` (`cwEffort`, `p25/p50/p75`, `initiatives.filter(isConstant)`)
— the mechanism is not pinned, exactly as the plan intends.

Coverage vs. plan scenarios (AT-1…AT-5, 6 `it`s):
- **AT-1** — matrix rows scoped to `['Backend']`; Ops omitted. ✓
- **AT-2** — `cwEffort` = `pm('M')` only, **and** `.not.toBeCloseTo(pm('M')+pm('L'))`
  (pins counterexample "unscoped total"); flat band at the scoped floor. Plus a
  property `it`: `'  backend '` (whitespace + case) matches, `'OPS'` excluded —
  exercises the trim + case-fold contract. ✓
- **AT-3** — zero-member Projection group → `cwEffort === 0`, band `(0,0,0)`, no
  matrix rows (pins counterexample "zero-member still lifts"). ✓
- **AT-4** — empty `groupsStore` → all constant work (`pm('M')+pm('L')`), band flat
  at the total, 2 matrix rows (pins the degenerate fallback / "all-constant-work,
  not first-Group"). ✓
- **AT-5** — `members:[BLANK]` includes the blank-Category row, excludes the
  non-blank row (pins the (Blank) sentinel branch). ✓
- **AT-26** (migrated) — zero-member Projection group → band collapses to `cwEffort`
  even with non-zero MSC count. Stays GREEN. ✓
- **AT-27** (migrated) — empty `groupsStore` → flat band at `cwEffort > 0` (asserts
  `tshirtToPersonMonths('M')`), i.e. the degenerate fallback genuinely uses **all**
  constant work and reads `editedConstantWork`. Stays GREEN. ✓

Could the implementation pass all visible tests while violating a counterexample? No.
Each of the four counterexamples is pinned by a positive+negative pair (AT-1/AT-2 for
scope, AT-2's `.not` for unscoped total, AT-3 for zero-member, AT-4 for fallback). The
fourth counterexample ("still passing scalar `fixedEffort`") is not realizable: the
scalar parameter was removed from `runSimulation` in Phase 2 and the diff passes
`fixedEffortPerGroup: [cwEffort]`.

**Coverage observation (non-blocking).** The Phase 4 acceptance file deliberately
keeps `kProj === 0` (documented in the file header) so the scoped `cwEffort` is
directly observable in the flat band; it does not exercise the `kProj > 0` Monte
Carlo band-shift. That path is unchanged by this diff (only `cwEffort`'s definition
changed; the `runSimulation` call structure is untouched) and the
`fixedEffortPerGroup` shift itself was tested and reviewed in Phase 2 (AT-5/AT-6).
No gap that lets a Phase 4 counterexample slip through.

---

## Step 5 — Invariants vs. implementation

```
Invariant 1: Projection group present → cell.cwEffort = Σ pm(size) over scoped rows.
Status: SATISFIED
Evidence: cwEffort = scopedCwEpics.reduce((s,e)=>s+e.effort,0) (index.html:2267);
  each cwEpics entry carries effort = tshirtToPersonMonths(size) (getConstantWorkEpics,
  index.html:1886); scopedCwEpics filters by projLcMembers/projHasBlank (2234-2238).
  AT-2 confirms cwEffort === pm('M') (not the Backend+Ops total).

Invariant 2: Projection group present → matrix rows are exactly the scoped rows.
Status: SATISFIED
Evidence: for (const cw of scopedCwEpics) initiatives.push(cw) (index.html:2263).
  AT-1/AT-5 confirm the count and identity of the appended isConstant rows.

Invariant 3: No Projection group / empty groupsStore → cwEffort = Σ over ALL rows.
Status: SATISFIED
Evidence: projGroup = groupsStore.find(g => g.isProjection) || null (index.html:2200)
  → null when none → ternary returns cwEpics unchanged (2234-2238). AT-4 (cwEffort =
  M+L) and AT-27 (cwEffort > 0) confirm the fallback uses all constant work.

Invariant 4: Projection runSimulation call passes fixedEffortPerGroup: [scopedCwEffort].
Status: SATISFIED
Evidence: index.html:2288 fixedEffortPerGroup: [cwEffort], where cwEffort is the scoped
  sum; no scalar fixedEffort anywhere in the call.

Invariant 5: Initiative-side projection behaviour (kProj, the kProj>0 band) unchanged
  except for the scoped cwEffort floor.
Status: SATISFIED
Evidence: the diff does not touch the kProj loop (2274-2280), bucketRowsByGroups
  (2243), the initiative sort (2256-2260), or the runSimulation params other than the
  already-scoped fixedEffortPerGroup; only the scopedCwEpics insertion, the matrix
  append source, the cwEffort source, and comment text changed.
```

The membership semantics are *literally identical* to the `kProj` count: both read
the same `projLcMembers`/`projHasBlank` sets and both normalise the row Category via
`normalizeCategory` (`trim` + (Blank) sentinel, index.html:1539-1543) before
`.toLowerCase()`. Constant work contributes **zero** to `kPerGroup` / Poisson λ /
the bootstrap pool — it remains a purely additive deterministic band floor.

The implementer's documented autonomous decision to leave the cell-skip guard
`if (!qInits.length && !cwEpics.length) continue;` on the **unscoped** `cwEpics` is
sound: it preserves rendering of a cell whose constant work is entirely out of scope
(shown with `cwEffort === 0`, flat band) — consistent with AT-3's behaviour and not a
counterexample. Changing it to `scopedCwEpics` would be an untested suppression.

---

## Step 6 — Negative control (mutation)

**Mutation A — disable scoping (`const scopedCwEpics = cwEpics;`):**
1. Applied (`grep` confirmed `// MUTANT A`).
2. `npx vitest run tests/acceptance/phase-4-projections-constant-work-scoping.test.js`
3. Exit **1** — **5 failed / 1 passed** (AT-1, AT-2 ×2, AT-3, AT-5 fail; AT-4 — the
   degenerate fallback — passes, as expected since unconditional-all *is* the fallback).
4. Reverted (`grep` confirmed clean).
5. Re-ran → exit **0**, **6 passed**.

**Mutation B — drop the `projGroup` guard (filter unconditionally, no fallback):**
1. Applied (`grep` confirmed `// MUTANT B`).
2. Same targeted command.
3. Exit **1** — **1 failed / 5 passed** (AT-4 fails: with no Projection group the
   empty membership sets scope everything to 0, breaking the fallback).
4. Reverted; working tree matches HEAD (`git diff --stat` empty).
5. Re-ran → exit **0**, **6 passed**.

Both branches of the rule (scoping when a Projection group exists; all-constant-work
fallback when none) are caught by a deliberate one-line bug. Negative control: **PASS**.

---

## Step 7 — Additional verification tests

None written. Coverage is complete for the phase's behavioral rule, all five
invariants hold by construction, and the two-branch negative control confirms the
committed suite reliably detects regressions. No gap warranted additive tests.

---

## GREEN re-confirmation

- Targeted: `npx vitest run tests/acceptance/phase-4-projections-constant-work-scoping.test.js`
  → exit **0**, **6 passed**.
- Combined: `… phase-4-… phase-1-engine.test.js` → exit **0**, **36 passed**
  (AT-26/AT-27 green).
- Full: `npm run verify` → exit **0**, **183 passed / 1 skipped** (the jsdom
  "Not implemented: navigation" lines are pre-existing benign warnings).
- Test drift: `git diff --name-only 90f41cd..475296a -- tests` → empty.

---

## Step 9 — Verdict

```
Phase 4 review verdict: PASS

Test gaming patterns found: none
Invariant gaps: none
Missing test coverage: none blocking (noted: kProj>0 projection band-shift is not
  re-exercised in the Phase 4 file by design — covered by Phase 2 AT-5/AT-6 and
  unchanged by this diff)
Additional verification tests written: none
Negative control result: PASS

Overall: The Phase 4 slice implements the general Projection-group Category-scoping
rule entirely within buildTeamProjections in index.html, reusing the exact
membership sets (projGroup / projLcMembers / projHasBlank) that the kProj count
already consumes — so the scoping semantics (trim + case-fold + (Blank) sentinel,
ADR-0028) are literally identical to the initiative side. Both sinks (the cwEffort
band floor and the appended constant-work matrix rows) are driven off the scoped
list; the projection runSimulation call passes the scoped fixedEffortPerGroup:
[cwEffort] with no scalar fixedEffort; and the degenerate fallback (no Projection
group / empty groupsStore → all constant work) is preserved, not replaced by a
first-Group scope. No fixture literals, test-keyed branches, env checks, or test
imports. No test file drifted between the test and impl commits. All four Phase 4
counterexamples are pinned by the committed tests, and a two-branch negative control
confirms the suite fails on a deliberate bug and recovers on revert. Targeted (6),
combined (36), and full (183/1 skipped) runs all exit 0.
```

Saved review file: `docs/reviews/0021-constant-work-tab-and-group-scoping-phase-4-review-01.md`
