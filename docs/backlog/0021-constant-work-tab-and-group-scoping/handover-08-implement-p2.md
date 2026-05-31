---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: implement
feature_phase: 2
for_next_phase: review
outcome: success
reason: ""
produced_at: 2026-05-31T21:19:00Z
produced_commit: ""
---
## Summary

Implemented feature 0021 **Phase 2** (per-Group constant-work shift at the org
headline) inline in `index.html` per ADR-0033 and the plan's Phase 2 slice. The
scalar `fixedEffort` is gone from `runSimulation` (parameter **and** return),
replaced by the per-Group vector `fixedEffortPerGroup`; a new
`getConstantWorkEffortPerGroup` buckets `editedConstantWork` by Category
membership into a vector aligned with `kPerGroup`; `prepareSimulationData`
returns the org-wide vector; the auto-default `All` Group now unions
initiative ∪ constant-work Categories. All four `runSimulation` references were
migrated to the vector shape. GREEN confirmed: the 4-file targeted command exits
**0** (47 passed / 1 skipped — the sanity-check self-skips, its CSVs absent), and
`npm run verify` (full suite) exits **0** (172 passed / 1 skipped). No test file
was edited.

## Instructions for the next phase

`review` (feature-phase **2**) — independent verification per `/phase-review`.
Derive the diff boundary `test_commit..impl_commit` from git log (see
LOOP-MODE.md):
- test commit: `git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-07-atdd-p2.md`
- impl commit: `git log -1 --format=%H -- docs/backlog/0021-constant-work-tab-and-group-scoping/handover-08-implement-p2.md`

Read the plan's **Phase 2** slice (behavioral rule, invariants, counterexamples,
forbidden shortcuts) and the diff **before** the tests. Confirm:
1. The diff implements the **general** per-Group rule (Category-scoped additive
   shift), not fixture-keyed shortcuts. Touches `index.html` only.
2. None of the seven Phase 2 counterexamples is present — in particular: no
   residual scalar `fixedEffort` parameter/alias on `runSimulation` (grep);
   `globalMin` is `min(...fixedEffortPerGroup)` (not first/max/scalar); the
   vector buckets `editedConstantWork` (not initiatives) and never feeds
   `kPerGroup`/λ/the bootstrap pool; bucketing is case-insensitive + trim with
   the (Blank) sentinel as `null`; the auto-default unions both sources and
   freezes on user modification.
3. All eight Phase 2 invariants hold (see the plan).
4. No test file drifted across `test_commit..impl_commit` (the implement commit
   stages only `index.html` + the backlog docs).

Suggested negative control: temporarily make `runSimulation` apply
`fixedEffortPerGroup[0]` to every Group (uniform) and confirm AT-1/AT-5/AT-12
fail; revert → GREEN. Or revert `globalMin` to `fixedEffortPerGroup[0]` and
confirm AT-6 fails on the `[8,3]` vector.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — **Phase 2** slice
  (lines ~400-566): behavioral rule, 8 invariants, 7 counterexamples, forbidden
  shortcuts, definition of done. Also the top-of-file *Data models* `runSimulation`
  BEFORE/AFTER block.
- `index.html` — the production diff. Key sites:
  - `getConstantWorkEffortPerGroup` (new, just after `getConstantWorkEffort`) —
    the per-Group bucketing helper.
  - `syncAutoDefaultGroup` (new, just after `collectObservedCategories`) — the
    auto-default union; called from `loadInitiativesCSV` and `loadConstantWorkCSV`.
  - `prepareSimulationData` — returns `fixedEffortPerGroup`.
  - `runSimulation` — vector parameter, per-Group shift, `globalMin`/`globalMax`,
    return.
  - Three call sites: org run handler, `renderTeamSection`, `buildTeamProjections`.
- `tests/acceptance/phase-2-constant-work-org-scoping.test.js` — the frozen Phase 2
  acceptance tests (AT-1…AT-11). Do NOT edit.
- `tests/acceptance/phase-1-engine.test.js` — frozen; migrated AT-11/13/14/25 and
  rewritten AT-12; AT-26/AT-27/AT-29 unchanged and green.
- `tests/verification/phase-1-2-review-01.test.js`,
  `tests/verification/sanity-check-engine-mean.test.js` — frozen; migrated to the
  vector contract (sanity-check self-skips locally — CSVs absent).
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` — engine semantics.
- `docs/adr/0028-category-as-generalized-moscow.md` — case-insensitive Category +
  (Blank) sentinel.
- `docs/adr/0029-user-defined-groups-supersede-cumulative-moscow.md` — the Group
  model the auto-default union extends.

## Context the next phase needs

Autonomous decisions taken this session (Loop mode — no user at the Step-4 seam
check or any gate):

- **No seam conflict.** The test-imposed contract (`fixedEffortPerGroup` on
  `prepareSimulationData`'s return and on `runSimulation`; the auto-default via
  `loadInitiativesCSV`/`loadConstantWorkCSV`) is exactly the plan's intended
  contract change — removing the scalar `fixedEffort` is mandated, not a conflict.
  Implementation proceeded directly.

- **Helper seam chosen: a standalone `getConstantWorkEffortPerGroup(quarters,
  groups, teamName = null)`** (the plan left this open between a new helper and
  extending `getConstantWorkEffort`). It pre-normalises in-scope rows once, then
  buckets per Group reusing `bucketRowsByGroups`' membership logic (lowercased
  member set + `blankMember` flag; (Blank) sentinel is `null`). The optional
  `teamName` filter is included now (Phase 3 reuses it for the team surface), but
  is unused by Phase 2 (org call passes `null`). `getConstantWorkEffort` is
  **retained** (still used by `prepareTeamSimulationData` → `td.fixedEffort`,
  Phase 3's territory) — not dead code.

- **Category source cascade.** The helper reads `r.category || r.moscow ||
  r.emoji` (the ADR-0023 cascade), matching its sibling `getConstantWorkEpics`,
  before `normalizeCategory`. Phase 2 tests only set `category`, so this is
  behaviour-neutral for them but consistent with the existing constant-work reader.

- **Org call site reuses the prepared vector.** The org run handler destructures
  `fixedEffortPerGroup` from `prepareSimulationData` (computed against
  `groupsStore`) and passes it to `runSimulation` alongside `groups:
  groupsStore.slice()` — exactly as `kPerGroup` is already threaded. The snapshot
  is taken with no intervening mutation, so order/length match. The old
  `getConstantWorkEffort(targetQs)` scalar call was removed.

- **`globalMax` guard.** Kept the plan's `Math.max(...shifted.map(p995),
  Math.max(...fixedEffortPerGroup) + 1)` shape, made empty-safe:
  `(shifts.length ? Math.max(...shifts) : 0) + 1`. `globalMin` is likewise
  `shifts.length ? Math.min(...shifts) : 0` (an empty vector → `0`, never
  ±Infinity). The default parameter is `fixedEffortPerGroup = []`.

- **Team-level and projection call sites: shape-only, behaviour-preserving.**
  - `renderTeamSection` broadcasts the existing per-team scalar uniformly:
    `fixedEffortPerGroup: teamGroupsSnapshot.map(() => td.fixedEffort || 0)`. This
    reproduces the prior uniform-team shift exactly (`globalMin`/`globalMax`
    identical). Phase 3 owns replacing it with a per-team Category-scoped vector;
    deliberately NOT done here.
  - `buildTeamProjections`' single-group cell passes `fixedEffortPerGroup:
    [cwEffort]` (was `fixedEffort: cwEffort`). Unscoped; Phase 4 owns
    Projection-group Category scoping. No committed Phase 2 test exercises a
    non-zero shift here (AT-26 has `cwEffort === 0`; AT-27 has empty `groupsStore`
    so the branch is not hit) — discipline + this reviewer are the guards.

- **Auto-default union mechanism (the one genuinely non-obvious decision).** The
  plan says the auto-default `All` re-derives on *any* CSV load while pristine,
  but the **frozen, NOT-migrated** `phase-1-engine.test.js` **AT-29** asserts an
  initiatives *reload* must NOT re-sync the existing `All`. Reconciliation:
  `syncAutoDefaultGroup()` (re)derives the union of observed Categories across
  `editedInitiatives` ∪ `editedConstantWork` **only** while the store is the
  pristine auto-default — detected with the *same structural heuristic the Groups
  JSON-load path already uses* (`confirmLoadGroupsReplacement`, `index.html`
  ~4022): empty store, or a single Group named `All`. To preserve AT-29, it
  additionally re-derives only on the first-ever load (empty store) **or** once
  constant work is in play (`editedConstantWork !== null`) — so an
  initiatives-only reload is frozen (AT-29), while a constant-work load (AT-9) and
  an initiatives load that follows constant work (AT-9 reverse order) both union.
  Initiative casing wins on merge (initiatives seeded first); BLANK iff any source
  is blank. AT-10 (user replaces the store with their own ≥2 named Groups) →
  not-pristine → no-op. Verified: AT-9 (both orders), AT-10, AT-29, AT-8, AT-22,
  AT-30 all green.

- **Which RRG/GREEN:** the 12 RED tests (the new acceptance file's 11 minus the
  green AT-10 freeze guard = 10, plus AT-12 rewritten, plus the new acceptance
  AT-10 was already green = the documented 11 fail/1 pass in the acceptance file,
  12 across the suite with AT-12) now all pass. `phase-2-groups-tab.test.js:465`'s
  harmless `fixedEffort: 0` is an ignored extra property (defaults to a 0 shift) —
  untouched, suite stays green.

GREEN evidence (persisted command output):
- Targeted: `npx vitest run tests/acceptance/phase-2-constant-work-org-scoping.test.js
  tests/acceptance/phase-1-engine.test.js tests/verification/sanity-check-engine-mean.test.js
  tests/verification/phase-1-2-review-01.test.js` → exit **0**, 47 passed / 1 skipped.
- Full: `npm run verify` → exit **0**, 172 passed / 1 skipped (full log:
  `.agent/last-verify.log`). The jsdom "Not implemented: navigation" lines are
  pre-existing harness noise from a download-link test, not failures (exit 0).

## Definition of done (for review)

- Verdict PASS only if: the diff implements the general per-Group rule
  (`index.html`-only); none of the 7 counterexamples is present; all 8 invariants
  hold; the scalar `fixedEffort` is fully gone from `runSimulation`; no test file
  drifted across `test_commit..impl_commit`; and re-running the targeted command
  + `npm run verify` both exit 0.
- On PASS (k=2 < N=8): advance `stage: atdd`, `current_phase: 3`,
  `retry_count: 0`, `next_handover` → the plan handover, append this review to
  `artifacts.reviews`.
- On FAIL: `stage: implement`, `retry_count++`, write `handover-NN-review-p2.md`
  with precise findings.
