# Review — 0021 constant-work-tab-and-group-scoping — Phase 3, run 01

- **Plan:** `docs/plans/0021-constant-work-tab-and-group-scoping.md` (Phase 3 slice, ~lines 570–672)
- **Phase:** 3 — *Team Level surface honors Category-scoping — per-team `fixedEffortPerGroup`*
- **Review run:** 01
- **Date:** 2026-05-31
- **Test commit:** `aa0d5769e7fd4460cecc09bdf84621328cf5fb3f` (handover-10-atdd-p3)
- **Impl commit:** `aab5babf57bf64b441e370c8cc9a63eb0c6b1bcc` (handover-11-implement-p3)
- **Diff under review:** `git diff aa0d576..aab5bab`

---

## Step 1 — Plan (Phase 3) extract

**Behavioral rule.** `prepareTeamSimulationData` replaces its per-team scalar
constant-work effort (`getConstantWorkEffort(targetQuarters, teamName)`) with a per-team
`fixedEffortPerGroup`: for each team and each Group, sum `tshirtToPersonMonths(size)` over
`editedConstantWork` rows whose `team` matches the team (case-insensitive), whose
`quarter ∈ targetQuarters`, and whose Category ∈ `group.members`. The team match
AND-composes with the Category filter. `renderTeamSection` and the per-team
`runSimulation` call consume `fixedEffortPerGroup` exactly as the org headline does
(Phase 2). Constant work still contributes zero to the team's `kPerGroup` / λ / bootstrap
pool.

**Invariants.**
1. Each team entry's `fixedEffortPerGroup.length === groups.length`, aligned with the team's `kPerGroup`.
2. A row contributes to a team's vector only if its team matches (case-insensitive) AND its Category ∈ the Group's members.
3. The team vector uses the same Category semantics (trim + case-fold + (Blank) sentinel) as the org vector.
4. Constant work does not change the team's `kPerGroup` / λ / sizing pool.

**Counterexamples (must NOT pass).**
- A team section that retains the scalar `fixedEffort` (lifts every Group uniformly).
- A team vector that ignores the team filter (org-wide CW lifting every team).
- A team vector that ignores the Category filter (all the team's CW lifting every Group).
- A case-sensitive team match.

**Forbidden shortcuts.** Do not reuse the org-wide vector for all teams; do not pre-empt
the Team Projections surface (Phase 4 owns it).

**Expected observable outcomes.** CW lifts a team's Group columns only where team AND
Category both match; the per-team vector is aligned with `groups`; a row in no Group, or
for another team, lifts nothing here.

**Proposed seams.** `prepareTeamSimulationData` returning `fixedEffortPerGroup` per team
entry; reuse of the Phase 2 per-Group helper with a `teamName` argument (explicitly *not*
locked in — the contract is the team-scoped, Category-scoped, group-aligned vector).

---

## Step 2 — Implementation diff (read before the tests)

`git diff aa0d576..aab5bab` touches exactly three files: `index.html` (production) plus the
phase's own `handover-11-implement-p3.md` and `index.md` frontmatter. Two `index.html`
hunks:

1. **`prepareTeamSimulationData` (~line 2166).** The per-team return field
   `fixedEffort: getConstantWorkEffort(targetQuarters, teamName)` is replaced by
   `fixedEffortPerGroup: getConstantWorkEffortPerGroup(targetQuarters, groupsStore, teamName)`.
   The per-team scalar field is gone — no back-compat alias.
2. **`renderTeamSection` (~line 2747).** The Phase-2 interim uniform broadcast
   `fixedEffortPerGroup: teamGroupsSnapshot.map(() => td.fixedEffort || 0)` is replaced by
   `fixedEffortPerGroup: td.fixedEffortPerGroup`, consuming the per-team vector built upstream.

**Initial assessment (diff alone):**
1. *General rule, not keyed on values?* General. The vector is produced by the shared
   helper `getConstantWorkEffortPerGroup`, parameterised by `groupsStore` + the team's
   `teamName`. No literal fixture value (`'Platform'`, `'Backend'`, `'ScaffoldCat'`, `4.4`,
   t-shirt sizes) appears in production logic.
2. *Every change maps to the rule?* Yes — edit 1 produces the per-team scoped vector; edit
   2 consumes it. Nothing else changed.
3. *Suspicious constructs?* None — no conditionals on IDs, no hard-coded numbers, no
   environment checks.

---

## Step 3 — Test-gaming scan

- **Hard-coded fixture values:** none. `grep` of the `index.html` hunks for
  `Platform'|Backend'|ScaffoldCat|4\.4` → no match.
- **Conditionals on test-only identifiers:** none.
- **Skipped/deleted tests:**
  `git diff aa0d576..aab5bab -- tests features e2e acceptance` → **empty**. No test file
  changed between test and impl commits.
- **Weakened assertions:** N/A (no test file changed).
- **Production imports from test helpers:** none (`grep` for `require(.*tests` /
  `import.*fixtures` → no match).
- **Environment checks in production:** none (`grep` for `NODE_ENV|process.env` in hunks →
  no match).
- **Excessive/incorrect mocking:** none.
- **Patched runners/configs:** none (`vitest.config.*`, coverage, timeouts unchanged).
- **Stale/pre-generated artifacts:** none committed.
- **Changed fixtures:** none.

Full changed-file set in the diff: `index.html`, `handover-11-implement-p3.md`, `index.md`.

---

## Step 4 — Tests read (after forming the view)

The frozen `tests/acceptance/phase-3-team-level-constant-work-scoping.test.js` (AT-1…AT-5)
asserts against the plan's stable seam `prepareTeamSimulationData(...)[i].fixedEffortPerGroup`
(AT-1/2/3/5) and the rendered Median (P50) row via `renderTeamSection` (AT-4). Expected
PM values are computed in-realm (`pm(win, 'M')` = `tshirtToPersonMonths('M')`), never
hard-coded — so the tests assert the rule, not a constant.

Coverage vs. plan:
- **Counterexample "scalar/uniform broadcast"** → killed by AT-1 & AT-4 (Frontend must be
  `0` / `'0.0'`, not lifted to the team's CW).
- **Counterexample "ignores team filter"** → killed by AT-2 (Risk vector `[0,0]`) and AT-5
  (the `risk` row must not leak into Platform's vector).
- **Counterexample "ignores Category filter"** → killed by AT-1 (Frontend `0`) and AT-3
  (the `Ops` row, in no Group, is excluded; length stays aligned with `groupsStore`).
- **Counterexample "case-sensitive team match"** → killed by AT-5 (`'platform'` matches
  the `Platform` team).
- **Invariant length-alignment** → AT-1 (length 2), AT-3 (length 1).
- **Boundary** → AT-1 includes a matching-team/matching-Category row *outside* the Target
  quarters (`Q4 2026`, `XL`) that must not count.

The implementation could **not** pass these while realizing any counterexample. No visible
behavioral case from the plan is left uncovered by the AT set + the negative control below.

---

## Step 5 — Invariants vs. implementation

```
Invariant 1: fixedEffortPerGroup.length === groups.length, aligned with kPerGroup
Status: SATISFIED
Evidence: getConstantWorkEffortPerGroup returns groupList.map(g => …) over the passed
  groups (here groupsStore), so length === groups.length by construction. kPerGroup is
  built by bucketRowsByGroups over the same groupsStore, and renderTeamSection snapshots
  groupsStore.slice() for `groups` without mutating the store between prepare and render —
  so the vector and kPerGroup are index-for-index aligned. AT-1/AT-3 confirm the length.
```
```
Invariant 2: contributes only on team-match (case-insensitive) AND Category ∈ members
Status: SATISFIED
Evidence: the helper filters rows by qSet (quarter), then by teamKey =
  teamName.toLowerCase() when teamName !== null (AND with the per-Group membership scan),
  then per Group sums only rows whose normalised Category is in that Group's lower-cased
  members (or BLANK ∈ members for blank-Category rows). prepareTeamSimulationData passes the
  team's own teamName, so the AND-composition holds per team. AT-1/2/3/5 confirm.
```
```
Invariant 3: same Category semantics (trim + case-fold + (Blank) sentinel) as org vector
Status: SATISFIED
Evidence: org headline (index.html:2033, prepareSimulationData) and the team path
  (index.html:2166) call the SAME helper getConstantWorkEffortPerGroup — the only
  difference is the teamName argument (null for org, the team for the team path). The
  Category normalisation (normalizeCategory) and BLANK handling are therefore identical by
  construction, not re-implemented. Verified by Phase 2 review on the org path; no code
  divergence introduced this phase.
```
```
Invariant 4: constant work does not change the team's kPerGroup / λ / bootstrap pool
Status: SATISFIED
Evidence: the diff touches only the fixedEffortPerGroup field and its consumption.
  kPerGroup is still built by bucketRowsByGroups; λ and the epic sizing pool are built from
  parsedEpics. getConstantWorkEffortPerGroup reads editedConstantWork only and feeds
  runSimulation solely as fixedEffortPerGroup (a purely additive post-sort shift). It never
  feeds kPerGroup / λ / the bootstrap pool. AT-4's flat-band design (initiative Category
  ScaffoldCat in no Group → every K === 0) relies on this and passes.
```

No invariant is AT RISK or VIOLATED.

**Other-surface non-regression:** confirmed the org headline (Phase 2,
`prepareSimulationData`/`runSimulation`, `index.html:2033/2385`) and the Team Projections
projection cell (Phase 4, `index.html:2275`, `fixedEffortPerGroup: [cwEffort]`, single-group
unscoped) were **not** touched by the diff. The scalar helper `getConstantWorkEffort`
(`index.html:1800`) is retained with no production caller — still exercised by Phase 1's
frozen substrate tests; intentionally kept, not dead-code to remove this phase.

---

## Step 6 — Negative control (mutation)

Targeting the central rule (team-scoping in `prepareTeamSimulationData`).

1. **Mutate:** `index.html:2166`
   `getConstantWorkEffortPerGroup(targetQuarters, groupsStore, teamName)`
   → `getConstantWorkEffortPerGroup(targetQuarters, groupsStore)` (drop the team filter →
   org-wide CW lifting every team = counterexample "ignores the team filter").
2. **Run:** `npx vitest run tests/acceptance/phase-3-team-level-constant-work-scoping.test.js`
   → **exit 1**, `2 failed | 3 passed`. Failures: **AT-2** (Risk vector no longer `[0,0]`)
   and **AT-5** (the `risk` row leaks into Platform's vector).
3. **Confirmed the suite catches it** (exit code non-zero).
4. **Revert** the one-line mutation.
5. **Re-run:** → **exit 0**, `5 passed`. Working tree clean (`git status --porcelain` empty,
   `git diff --stat` empty) — mutation fully removed, tree matches HEAD.

**Negative control: PASS.**

---

## Step 7 — Additional verification tests

None written. The only Phase-3-specific production logic is wiring: pass `groupsStore` +
the team's `teamName` to the shared helper in `prepareTeamSimulationData`, and consume
`td.fixedEffortPerGroup` in `renderTeamSection`. AT-1…AT-5 plus the negative control fully
exercise that wiring and all four counterexamples. The Category trim/case-fold/(Blank)
semantics are the *same shared helper* already verified on the org path in Phase 2 review —
there is no team-level code divergence to test separately, so additive tests would only
re-cover Phase 2's contract.

---

## Gate (run this session)

| Command | Exit | Result |
|---|---|---|
| `npx vitest run tests/acceptance/phase-3-team-level-constant-work-scoping.test.js` | 0 | 5 passed |
| `npm run verify` (full suite) | 0 | 177 passed / 1 skipped (178 total) |
| `git diff aa0d576..aab5bab -- tests features e2e acceptance` | — | empty (no test drift) |
| negative control (drop teamName) | 1 | AT-2 + AT-5 fail |
| negative control (reverted) | 0 | 5 passed |

(The trailing jsdom `getContext` / `navigation` lines in the logs are benign environment
noise from chart rendering under jsdom, not failures.)

---

## Step 9 — Verdict

```
Phase 3 review verdict: PASS

Test gaming patterns found: none
Invariant gaps: none
Missing test coverage: none
Additional verification tests written: none
Negative control result: PASS

Overall: The implementation encodes the Phase 3 general rule, not the fixtures.
prepareTeamSimulationData reports a per-team fixedEffortPerGroup produced by the shared
helper getConstantWorkEffortPerGroup(targetQuarters, groupsStore, teamName), which
AND-composes the case-insensitive team match with ADR-0028 Category membership (trim +
case-fold + the (Blank) sentinel) and returns a vector aligned index-for-index with
groupsStore / kPerGroup; renderTeamSection consumes that per-team vector. The per-team
scalar fixedEffort is gone (no uniform broadcast); none of the four counterexamples is
realizable; all four invariants hold by construction. Constant work remains a purely
additive post-sort shift that never enters any team's kPerGroup / λ / bootstrap pool. The
org headline (Phase 2) and Team Projections (Phase 4) were left untouched. No test file
drifted between the test and impl commits. The negative control fails AT-2/AT-5 on the
team-scoping mutation and recovers on revert. Targeted (5/5) and full verify (177/1 skip)
both exit 0.
```

This is feature-phase 3 of 8 (k=3 < N=8) → advance to Phase 4 atdd.
