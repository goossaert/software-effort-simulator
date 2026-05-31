# Review — 0021 constant-work-tab-and-group-scoping — Phase 2 — run 01

- **Plan:** `docs/plans/0021-constant-work-tab-and-group-scoping.md` (Phase 2: per-Group constant-work shift at the org headline)
- **Phase:** 2 of 8
- **Review run:** 01
- **Date:** 2026-05-31T21:26:54Z
- **Test commit:** `59744d9d99c8c667fa563b1f7cd1b5a2b315ed75` (atdd p2, `handover-07-atdd-p2.md`)
- **Impl commit:** `54563abe092e021a9fcdafa14cd5121fb64083c9` (implement p2, `handover-08-implement-p2.md`)
- **Diff range:** `59744d9..54563ab`
- **Mode:** BACKLOG LOOP (autonomous; no user gating)

---

## Step 1 — Plan (Phase 2 contract extracted)

**Behavioral rule.** The single global constant-work shift becomes a per-**Group** vector. For each Group in the Run snapshot, sum `tshirtToPersonMonths(size)` over `editedConstantWork` rows whose `quarter ∈ targetQuarters` and whose normalised **Category** ∈ `group.members` (`trim` + case-insensitive, with the **(Blank) sentinel** matching blank-Category rows), producing `fixedEffortPerGroup: number[]` aligned index-for-index with `kPerGroup`/`groups`. `runSimulation` replaces its scalar `fixedEffort` parameter with `fixedEffortPerGroup`: each Group's sorted distribution shifts by *its own* entry; `globalMin = min(fixedEffortPerGroup)`; `globalMax` accommodates the tallest shift. Constant work contributes **zero** to `kPerGroup`, **Poisson λ**, and the **Bootstrap pool**. The org run handler computes the org-wide vector and passes it. The auto-default `All` Group's members union observed Categories across `editedInitiatives` ∪ `editedConstantWork` (incl. BLANK) while `groupsStore` is the pristine auto-default; user modification freezes it.

**Invariants.**
1. `fixedEffortPerGroup.length === groups.length`, aligned with `kPerGroup`; entry `i` = the constant-work PM for Group `i`.
2. `runSimulation` shifts `results[i].sorted` by `fixedEffortPerGroup[i]` (default `0` when shorter/absent).
3. `globalMin === Math.min(...fixedEffortPerGroup)` (or `0` when empty).
4. Constant work never changes `kPerGroup`, `lambda`, or `epicSizingDist`.
5. The per-Group bucketing uses the same `trim` + case-fold + BLANK-membership semantics as `bucketRowsByGroups`.
6. The auto-default `All` members include every observed Category across both sources, plus BLANK iff any source has a blank Category.
7. The auto-default (re)derives only while `groupsStore` is the pristine auto-default; user modification freezes it.

**Counterexamples (must NOT pass).** (CE1) a `runSimulation` retaining the scalar `fixedEffort` and applying one shift to every Group; (CE2) a `globalMin` that is a single/first/max Group shift rather than the minimum; (CE3) a vector bucketing *initiative* rows; (CE4) a vector adding constant-work effort into `kPerGroup`/the bootstrap pool; (CE5) case-sensitive bucketing, or treating `''`/whitespace Category as a non-BLANK string; (CE6) an auto-default built from initiatives only; (CE7) an auto-default that re-syncs after the user renamed/added/deleted a Group.

**Forbidden shortcuts.** Keeping the scalar `fixedEffort` as a back-compat alias on `runSimulation`; applying the org-wide vector uniformly to teams/projections; sampling constant work into the random pool / Poisson count; introducing a separate `"(Blank)"` string key (BLANK is `null`).

**Proposed seams.** The per-Group vector helper's aligned `number[]` return; `runSimulation`'s `fixedEffortPerGroup` parameter + per-Group shift + `globalMin`; `prepareSimulationData`'s return including `fixedEffortPerGroup`; the auto-default union in the CSV loaders. Explicitly *not* locked: standalone helper vs. extension of `getConstantWorkEffort`; the pristine-auto-default detection mechanism; the exact `globalMax` guard expression.

---

## Step 2 — Implementation diff (initial assessment, before reading tests)

Production change is `index.html`-only (`git diff --stat 59744d9..54563ab` = `index.html`, `index.md`, `handover-08-implement-p2.md` — no other files). Assessed from the diff alone:

1. **General rule, not fixture-keyed.** `getConstantWorkEffortPerGroup(quarters, groups, teamName=null)` (`index.html:1830`) iterates `editedConstantWork`, pre-normalises in-scope rows (quarter + optional team), then for each Group buckets by Category membership with a lowercased member set + `blankMember` flag. No literal category/group/team names, no hard-coded numbers, no ID conditionals. The shift in `runSimulation` is `shifts[i] || 0` per Group — fully general.
2. **Every change maps to the rule.** `syncAutoDefaultGroup` (auto-default union); `getConstantWorkEffortPerGroup` (the vector); `prepareSimulationData` returning `fixedEffortPerGroup`; `runSimulation` vector param + per-Group shift + `globalMin`/`globalMax`; three call sites (org passes the prepared vector; team broadcasts `td.fixedEffort` uniformly with a comment deferring to Phase 3; projection passes `[cwEffort]` deferring to Phase 4).
3. **No suspicious constructs.** No `NODE_ENV`/env checks, no test-helper imports, no conditionals on fixture identifiers. The one structural heuristic (`pristine = length 0 || single Group named 'All'`) is *not* test-keyed — it is copied verbatim from the existing `confirmLoadGroupsReplacement` trivial-replacement check (`index.html:4138-4140`).

Initial view: faithful, general implementation of the Phase 2 contract.

---

## Step 3 — Test-gaming scan

- **Hard-coded fixture values:** none. Logic is computed from `group.members` / row Categories / `tshirtToPersonMonths`.
- **Conditionals on test-only identifiers:** none.
- **Skipped/deleted tests:** none — `git diff 59744d9..54563ab -- tests features e2e acceptance` returns **empty output**. No test file changed between the test and impl commits.
- **Weakened assertions:** none (no test diff).
- **Production imports from test helpers:** none.
- **Environment checks in production:** none.
- **Excessive/incorrect mocking:** N/A (jsdom integration harness; no mocks introduced).
- **Patched runners/configs:** none — no `vitest.config.*`/`package.json`/coverage changes in the diff (only `index.html` + backlog docs).
- **Stale/pre-generated artifacts:** none committed; all evidence below is from commands run this session.
- **Changed fixtures:** none.

Result: **no gaming patterns found.**

---

## Step 4 — Tests read (after forming the Step 2 view)

`tests/acceptance/phase-2-constant-work-org-scoping.test.js` (AT-1…AT-11) targets the org-wide vector via the plan's stable seam `prepareSimulationData(...).fixedEffortPerGroup` (not a private helper name) and `runSimulation`'s vector parameter. The tests are genuinely behavioral and notably adversarial:

- **AT-1** asserts the matching Group gets `pm('M')`, the non-matching Group `0`, **and** a Backend row in `Q4 2026` (outside the `Q3 2026` Target) contributes nothing — a quarter-boundary check.
- **AT-5** is a property over `[0, 5, 12]` (boundary 0 + two distinct positives), asserts each Group sits flat at its own entry, and explicitly `expect(out).not.toHaveProperty('fixedEffort')` — directly guarding CE1.
- **AT-6** is a property over `[[0,8],[3,8],[8,3],[5,5]]`; the `[8,3]` case fails any first-element or max implementation, the `[5,5]` case pins a non-zero floor — directly guarding CE2.
- **AT-7** compares `kPerGroup`/`lambda`/`epicSizingDist` with and without a constant-work row — guarding CE4.
- **AT-3/AT-4** cover case-insensitive+trim and the BLANK sentinel (reading `BLANK` from the window, asserting it is `null`) — guarding CE5.
- **AT-9/AT-10** cover the auto-default union (both load orders) and the freeze-on-modification — guarding CE6/CE7.

The migrated `phase-1-engine.test.js` (AT-11/13/14/25 mechanical `fixedEffort: 0` → `fixedEffortPerGroup: [0,…]`; AT-12 rewritten so a zero-member Group's shift is its own `0`) and the two `tests/verification/` files were migrated in the **atdd** commit (`59744d9`) and are frozen; they did not drift into the impl commit.

**Could the implementation pass all visible tests yet still violate a plan counterexample?** No — each of CE1–CE7 is both test-covered (above) and avoided by the implementation (Step 5). No behavioral case in the Phase 2 plan slice is left uncovered. The team-level/projection surfaces are explicitly Phase 3/4 territory and are shape-only here; no Phase 2 test exercises a non-zero shift there, and the implementation preserves prior behaviour at both sites (documented in the handover) — correctly *not* pre-empting later phases (forbidden-shortcut compliant).

**Missing coverage:** none material for Phase 2.

---

## Step 5 — Invariants vs. implementation

```
Invariant 1: fixedEffortPerGroup.length === groups.length, aligned with kPerGroup.
Status: SATISFIED
Evidence: getConstantWorkEffortPerGroup returns groupList.map(g => total) — exactly one
entry per Group, in groups order. prepareSimulationData computes both kPerGroup (via
bucketRowsByGroups against groupsStore) and the vector (against the same groupsStore) with
no intervening mutation, and runSimulation receives groups: groupsStore.slice(); order/length
align. Empty-CSV path returns groupList.map(() => 0) — still aligned.

Invariant 2: runSimulation shifts results[i].sorted by fixedEffortPerGroup[i] (default 0).
Status: SATISFIED
Evidence: index.html:2402-2408 — `const shift = shifts[i] || 0; if (!shift) return arr;`
then per-element add. AT-5 verifies distinct per-Group shifts; AT-11 verifies the K=0 case.

Invariant 3: globalMin === Math.min(...fixedEffortPerGroup) (or 0 when empty).
Status: SATISFIED
Evidence: index.html:2415 — `const globalMin = shifts.length ? Math.min(...shifts) : 0;`.
Negative control (Step 6) confirms AT-6 fails when min→max. Empty-safe.

Invariant 4: constant work never changes kPerGroup, lambda, or epicSizingDist.
Status: SATISFIED
Evidence: kPerGroup derives from bucketRowsByGroups(targetInits, categoryCol) (initiatives
only); lambda/epicSizingDist are upstream of the vector; the vector is computed separately
and used only as the post-sort shift. AT-7 asserts all three are identical with/without a
constant-work row.

Invariant 5: per-Group bucketing uses the same trim + case-fold + BLANK semantics as
bucketRowsByGroups.
Status: SATISFIED
Evidence: getConstantWorkEffortPerGroup builds `lcMembers` (Set of String(m).toLowerCase())
+ `blankMember` flag and matches `row.cat === BLANK ? blankMember : lcMembers.has(cat.toLowerCase())`
— structurally identical to bucketRowsByGroups' kPerGroup loop (index.html:1933-1950).
Categories pass through normalizeCategory (blank/whitespace/undefined → BLANK=null), so
'' and '   ' are BLANK, never strings. AT-3/AT-4 confirm.

Invariant 6: auto-default members union both sources, plus BLANK iff any source is blank.
Status: SATISFIED
Evidence: syncAutoDefaultGroup unions collectObservedCategories(editedInitiatives) and
collectObservedCategories(editedConstantWork); a `seen` lowercase→firstCasing map (initiatives
seeded first → initiative casing wins) plus a `hasBlank` flag appending BLANK at the end.
AT-9 confirms both load orders.

Invariant 7: auto-default (re)derives only while pristine; user modification freezes it.
Status: SATISFIED
Evidence: `pristine = groupsStore.length === 0 || (length===1 && [0].name==='All')` — the same
heuristic as confirmLoadGroupsReplacement. A second guard `if (length===1 && editedConstantWork
===null) return;` preserves the un-migrated, frozen AT-29 (initiatives-only reload must not
re-sync). AT-10 confirms a user-replaced 2-Group store is untouched by a later CW load.
```

All seven invariants **SATISFIED**.

**Counterexample confirmation (each absent):** CE1 — `runSimulation` signature is `{…, fixedEffortPerGroup = []}`; the scalar `fixedEffort` is gone from the parameter list **and** the return (`fixedEffortPerGroup: shifts`); `git grep fixedEffort` finds only `prepareTeamSimulationData`'s `td.fixedEffort` (Phase 3 territory, a data-object field) and the team-broadcast call site — never a `runSimulation` parameter/alias. CE2 — `globalMin` is `min(...)` (negative control verified). CE3 — the helper iterates `editedConstantWork`. CE4 — see Invariant 4 + AT-7. CE5 — see Invariant 5 + AT-3/AT-4. CE6 — see Invariant 6 + AT-9. CE7 — see Invariant 7 + AT-10.

---

## Step 6 — Negative control (two mutations on the most critical logic)

**Mutation A — break the per-Group shift (CE1 / Invariant 2).** Changed `const shift = shifts[i] || 0;` → `const shift = shifts[0] || 0;` (uniform shift).
- Command: `npx vitest run tests/acceptance/phase-2-constant-work-org-scoping.test.js`
- Result: **2 failed | 10 passed** — AT-5 (each Group at its own entry) and AT-11 (pure-constant-work per-Group band) fail. Non-zero exit.
- Revert → same command → **12 passed**, exit **0**.

**Mutation B — break `globalMin` (CE2 / Invariant 3).** Changed `Math.min(...shifts)` → `Math.max(...shifts)`.
- Command: `npx vitest run tests/acceptance/phase-2-constant-work-org-scoping.test.js`
- Result: **1 failed | 11 passed** — AT-6 fails (`expect(out.globalMin).toBe(Math.min(...vec))`, the `[8,3]` vector). Exit **1**.
- Revert → working tree clean (verified `git status --porcelain` empty; `git diff 54563ab -- index.html` empty).

Both mutations were reverted before committing this review. The suite reliably catches deliberate bugs in the two load-bearing rules.

---

## Step 7 — Additional verification tests

None written. The committed AT-1…AT-11 (property-based on AT-5/AT-6, boundary on AT-1) plus the migrated engine/verification suites already cover every Phase 2 invariant and counterexample; no gap warranted an additive test.

---

## Re-confirmation of GREEN (post-review, clean tree)

- Targeted: `npx vitest run tests/acceptance/phase-2-constant-work-org-scoping.test.js tests/acceptance/phase-1-engine.test.js tests/verification/sanity-check-engine-mean.test.js tests/verification/phase-1-2-review-01.test.js` → exit **0**, **47 passed / 1 skipped** (sanity-check self-skips — CSVs absent locally).
- Full: `npm run verify` (`vitest run`) → exit **0**, **172 passed / 1 skipped**.

---

## Step 9 — Verdict

```
Phase 2 review verdict: PASS

Test gaming patterns found: none
Invariant gaps: none (all 7 SATISFIED)
Missing test coverage: none (all 7 counterexamples test-covered and avoided)
Additional verification tests written: none
Negative control result: PASS (Mutation A → AT-5/AT-11 fail, exit≠0; Mutation B → AT-6 fail,
  exit 1; both reverted, GREEN restored)

Overall: The implementation lands the general per-Group constant-work rule inline in
index.html only. The scalar `fixedEffort` is fully removed from runSimulation's parameter and
return (replaced by the aligned vector `fixedEffortPerGroup`); `getConstantWorkEffortPerGroup`
buckets `editedConstantWork` by Category membership using bucketRowsByGroups' exact
trim+case-fold+BLANK semantics and never feeds kPerGroup/λ/the bootstrap pool; `globalMin` is
the minimum per-Group shift (empty-safe); the auto-default `All` Group unions both sources via
the existing pristine heuristic and freezes on user modification (with the AT-29 fires-once
contract preserved). None of the seven counterexamples is present, all seven invariants hold,
no test file drifted across 59744d9..54563ab, two negative-control mutations both failed and
were reverted, and the targeted command + `npm run verify` both exit 0. Phase 2 is complete;
advance to Phase 3 atdd.
```

Saved review: `docs/reviews/0021-constant-work-tab-and-group-scoping-phase-2-review-01.md`
