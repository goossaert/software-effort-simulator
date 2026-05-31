---
schema: backlog-index/v1
id: "0021"
slug: constant-work-tab-and-group-scoping
title: Editable Constant work tab + constant work scoped to Groups by Category and quarter
stage: review
status: ready
priority: normal
flagged_for_human: false
total_phases: 8
current_phase: 4
retry_count: 0
max_retries: 3
next_handover: handover-14-implement-p4.md
updated_at: 2026-05-31T22:04:51Z
created_at: 2026-05-29T23:11:00Z
blocked_reason: ""
artifacts:
  plan: docs/plans/0021-constant-work-tab-and-group-scoping.md
  test_commit: ""
  impl_commit: ""
  reviews:
    - docs/reviews/0021-constant-work-tab-and-group-scoping-phase-1-review-01.md
    - docs/reviews/0021-constant-work-tab-and-group-scoping-phase-2-review-01.md
    - docs/reviews/0021-constant-work-tab-and-group-scoping-phase-3-review-01.md
---
# 0021 — Editable Constant work tab + group-/quarter-scoped constant work

Makes **Constant work** a first-class, editable, Category-addressable body of work in
`index.html`: a new sixth **Constant work tab** (editable table, add/delete rows,
from-scratch authoring, CSV export, commit-on-Run via a new `editedConstantWork`
substrate), and an engine change that replaces the single global `fixedEffort` scalar
with a per-**Group** vector scoped by **Category** membership across all three surfaces
(org headline, Team Level, Team Projections). Constant-work quarters become selectable
as **Target quarters** only; constant work whose Category is in no Group is excluded but
surfaced in the **Data preview**.

Grilling and apply-docs are complete: ADR-0033 and ADR-0034 were created, ADR-0023 was
amended, and ~20 CONTEXT.md glossary terms were updated (commit `7bf19a0`); the plan was
written (commit `e3dc6be`). This task enters the loop at `stage: atdd`, `current_phase: 1`,
with `total_phases: 8` set authoritatively from the plan. Authoritative per-phase trail =
the handover files + git log.

**Phase 1 atdd done**: authored `tests/acceptance/phase-1-constant-work-substrate.test.js`
(AT-1…AT-9 for the `editedConstantWork` substrate) and migrated `phase-1-engine.test.js`
AT-21/AT-27 onto `editedConstantWork`. RED gate confirmed (11 failed / 28 passed, exit 1);
logs under `docs/atdd-logs/0021-…-phase-1-{acceptance,inner}-red.log`.

**Phase 1 implement done**: implemented the `editedConstantWork` substrate
inline in `index.html` — declared `let editedConstantWork = null;` beside `parsedConstantWork`,
cloned per-row (`parsedConstantWork.map(r => ({ ...r }))`) in `loadConstantWorkCSV`, nulled it
in `resetConstantWorkFile`, and migrated the three production readers (`getConstantWorkEffort`,
`getConstantWorkEpics`, `buildTeamProjections`' `cwQuarters`) to read it. GREEN confirmed:
targeted run 39/39 pass; `npm run verify` exits 0 (160 passed / 1 skipped).

**Phase 1 review done** (this commit): verdict **PASS**. Independent verification confirmed
the diff implements the general substrate rule (`index.html`-only), none of the six plan
counterexamples is present, all six invariants hold (exhaustive grep — no fourth reader, the
residual `parsedConstantWork` references are lifecycle-only), and no test file drifted between
`784f6ee..355c2b8`. Negative control: mutating `getConstantWorkEffort` to read
`parsedConstantWork` fails AT-4 (exit 1); revert → 39/39 GREEN. Targeted + `npm run verify`
both exit 0. Review: `docs/reviews/0021-…-phase-1-review-01.md`. Advanced to **Phase 2 atdd**
(`current_phase: 2`); next handover `handover-03-plan.md`.

**Phase 2 atdd done** (this commit): authored
`tests/acceptance/phase-2-constant-work-org-scoping.test.js` (AT-1…AT-11 for the
per-Group `fixedEffortPerGroup` org-headline shift) and migrated the scalar-contract
tests onto the vector: `phase-1-engine.test.js` AT-11/13/14/25 (mechanical
`fixedEffort: 0` → `fixedEffortPerGroup: [0,…]`), AT-12 (rewritten — a zero-member
Group's shift is now its own `0`, not a shared scalar), plus
`tests/verification/phase-1-2-review-01.test.js` and the self-skipping
`sanity-check-engine-mean.test.js` (per-Group engine-mean identity). RED gate
confirmed: acceptance run 11 failed / 1 passed (AT-10 is the auto-default-freeze guard,
green on both builds), exit 1; full suite 12 failed / 160 passed / 1 skipped, exit 1 —
targeted (only the new file + AT-12 fail). Logs under
`docs/atdd-logs/0021-…-phase-2-{acceptance-red,inner-red,verify-ci}.log`. Advanced to
**Phase 2 implement** (`stage: implement`); next handover `handover-07-atdd-p2.md`.

**Phase 2 implement done** (this commit): implemented the per-Group org-headline shift
inline in `index.html`. Added `getConstantWorkEffortPerGroup(quarters, groups, teamName=null)`
(buckets `editedConstantWork` by Category membership — `trim`+case-fold+(Blank) sentinel,
reusing `bucketRowsByGroups` semantics — into a vector aligned with `kPerGroup`);
`prepareSimulationData` now returns the org-wide `fixedEffortPerGroup`; `runSimulation`'s
scalar `fixedEffort` param/return is **gone**, replaced by `fixedEffortPerGroup` (per-Group
shift, `globalMin = min(...)` empty-safe, return reports the vector, no scalar). All four
`runSimulation` references migrated: org handler passes the prepared vector; team-level
broadcasts `td.fixedEffort` uniformly (Phase 3 scopes it); the projection cell passes
`[cwEffort]` (Phase 4 scopes it). Auto-default `All` now unions initiative ∪ constant-work
Categories via `syncAutoDefaultGroup()` (re)derived while the store is the pristine lone
`All` (same structural heuristic as the JSON-load path), frozen on user modification;
preserves AT-29 fires-once-for-initiatives by only re-deriving on first load or once constant
work is present. GREEN confirmed: targeted 47/47 pass (1 skipped sanity-check); `npm run verify`
exits 0 (172 passed / 1 skipped). No test file edited. Advanced to **Phase 2 review**
(`stage: review`); next handover `handover-08-implement-p2.md`.

**Phase 2 review done** (this commit): verdict **PASS**. Independent verification
(diff `59744d9..54563ab`) confirmed the general per-Group rule (`index.html`-only):
the scalar `fixedEffort` is gone from `runSimulation`'s parameter **and** return;
`getConstantWorkEffortPerGroup` buckets `editedConstantWork` by Category with
`bucketRowsByGroups`' exact `trim`+case-fold+BLANK semantics and never feeds
`kPerGroup`/λ/the bootstrap pool; `globalMin = min(...)` (empty-safe); the auto-default
`All` unions both sources via the existing `confirmLoadGroupsReplacement` pristine
heuristic and freezes on user modification (AT-29 fires-once preserved). None of the 7
counterexamples present; all 7 invariants hold; no test file drifted across
`test_commit..impl_commit`. Negative control: uniform shift (`shifts[0]`) fails
AT-5/AT-11; `globalMin`→max fails AT-6 (`[8,3]`); both reverted → GREEN. Targeted
(47 pass/1 skip) + `npm run verify` (172 pass/1 skip) both exit 0. Review:
`docs/reviews/0021-…-phase-2-review-01.md`. Advanced to **Phase 3 atdd**
(`current_phase: 3`, `retry_count: 0`); next handover `handover-03-plan.md`.

**Phase 3 atdd done** (this commit): authored
`tests/acceptance/phase-3-team-level-constant-work-scoping.test.js` (AT-1…AT-5 for
the per-team `fixedEffortPerGroup` on the **Team Level tab** — team match
AND-composes with Category membership). No legacy migration was needed (AT-25 was
migrated to the vector in Phase 2 and stays green; the plan confirms no Phase-3-unique
migration). RED gate confirmed: targeted run 5 failed / 0 passed, exit 1; full suite
5 failed / 172 passed / 1 skipped, exit 1 — RED confined to the new file. AT-1/2/3/5
fail because `prepareTeamSimulationData` returns no `fixedEffortPerGroup` (scalar
`fixedEffort` only); AT-4 fails because `renderTeamSection` broadcasts the team scalar
uniformly (Frontend wrongly lifted to `4.4` instead of `0.0`). Logs under
`docs/atdd-logs/0021-…-phase-3-{acceptance-red,inner-red,verify-ci}.log`. Advanced to
**Phase 3 implement** (`stage: implement`); next handover `handover-10-atdd-p3.md`.

**Phase 3 implement done** (this commit): implemented the per-team `fixedEffortPerGroup`
inline in `index.html` (two edits, reusing the Phase 2 helper). `prepareTeamSimulationData`
now returns `fixedEffortPerGroup: getConstantWorkEffortPerGroup(targetQuarters, groupsStore,
teamName)` per team entry (team AND Category scoped, aligned with `kPerGroup`); the per-team
scalar `fixedEffort` is **gone**. `renderTeamSection` passes the team's own
`td.fixedEffortPerGroup` to `runSimulation`, replacing the Phase-2 interim uniform broadcast.
The org headline (Phase 2) and the Team Projections projection-cell call (Phase 4,
`index.html:2271`) were left untouched; constant work remains a purely additive post-sort
shift (never enters any team's `kPerGroup` / λ / bootstrap pool). The scalar helper
`getConstantWorkEffort` is retained — still exercised by Phase 1's substrate tests. GREEN
confirmed: targeted 5/5 pass (exit 0); `npm run verify` exits 0 (177 passed / 1 skipped).
No test file edited; the only production change is `index.html`. Advanced to **Phase 3
review** (`stage: review`); next handover `handover-11-implement-p3.md`.

**Phase 3 review done** (this commit): verdict **PASS**. Independent verification
(diff `aa0d576..aab5bab`) confirmed the general per-team rule (`index.html`-only):
`prepareTeamSimulationData` reports a per-team `fixedEffortPerGroup` produced by the
shared `getConstantWorkEffortPerGroup(targetQuarters, groupsStore, teamName)` — the
case-insensitive team match AND-composes with ADR-0028 Category membership (trim +
case-fold + the (Blank) sentinel), returning a vector aligned index-for-index with
`groupsStore`/`kPerGroup`; `renderTeamSection` consumes `td.fixedEffortPerGroup`. The
per-team scalar `fixedEffort` is gone (no uniform broadcast). None of the 4
counterexamples is realizable; all 4 invariants hold by construction; constant work
never enters any team's `kPerGroup` / λ / bootstrap pool. The org headline (Phase 2,
`index.html:2033/2385`) and Team Projections (Phase 4, `index.html:2275`
`fixedEffortPerGroup: [cwEffort]`) were left untouched; `getConstantWorkEffort` (scalar)
is retained for Phase 1's frozen substrate tests. No test file drifted across
`test_commit..impl_commit`. Negative control: dropping the `teamName` arg (org-wide CW)
fails AT-2/AT-5 (exit 1); revert → 5/5 GREEN. Targeted (5 pass) + `npm run verify`
(177 pass / 1 skip) both exit 0. Review:
`docs/reviews/0021-…-phase-3-review-01.md`. Advanced to **Phase 4 atdd**
(`current_phase: 4`, `retry_count: 0`); next handover `handover-03-plan.md`.

**Phase 4 atdd done** (this commit): authored
`tests/acceptance/phase-4-projections-constant-work-scoping.test.js` (AT-1…AT-5,
6 `it`s incl. one case-insensitive/trim property test) for the **Team Projections
tab** — each (team, quarter) cell scopes its constant work to the **Projection
group**'s members (scoped `cwEffort` band floor + scoped constant-work
**Initiative matrix** rows), with the degenerate fallback (no Projection group /
empty `groupsStore` → all constant work) preserved per ADR-0023. Seam: the
plan-named `buildTeamProjections(...)` entry point; cells read at
`proj[i].byQuarter[q]` (`cwEffort`, `p25/p50/p75`, `initiatives.filter(isConstant)`).
No legacy migration was needed this phase — `phase-1-engine.test.js` AT-26
(zero-member Projection group) and AT-27 (empty-`groupsStore` fallback) were
migrated onto the vector in Phase 2 and stay GREEN under the degenerate-fallback
decision. RED gate confirmed: acceptance run 5 failed / 1 passed, exit 1 (AT-4,
the degenerate-fallback guard, is GREEN on the current build — the fallback
already holds); combined run 5 failed / 31 passed, exit 1 (RED confined to the
new file, AT-26/AT-27 GREEN); full suite 5 failed / 178 passed / 1 skipped, exit
1. Logs under `docs/atdd-logs/0021-…-phase-4-{acceptance-red,inner-red,verify-ci}.log`.
Advanced to **Phase 4 implement** (`stage: implement`); next handover
`handover-13-atdd-p4.md`.

**Phase 4 implement done** (this commit): implemented the Projection-group Category
scoping inline in `index.html` — confined to `buildTeamProjections`. Each (team,
quarter) cell now derives `scopedCwEpics` from `getConstantWorkEpics(q, teamName)` by
filtering on the **Projection group**'s membership (reusing the already-computed
`projLcMembers` / `projHasBlank` — trim + case-fold + the **(Blank) sentinel**, ADR-0028
semantics shared with the `kProj` count); the appended constant-work **Initiative matrix**
rows and the `cwEffort` band floor are both driven off `scopedCwEpics`. The projection
`runSimulation` call's `fixedEffortPerGroup: [cwEffort]` is now the scoped sum. **Degenerate
fallback (ADR-0023):** when no Projection group exists (incl. empty `groupsStore`),
`scopedCwEpics === cwEpics` → all constant work for the cell. A zero-member Projection group
scopes to `0` (empty `projLcMembers` + `projHasBlank` false → empty `scopedCwEpics`).
Untouched: the org headline (Phase 2), the per-team Team Level surface (Phase 3), and the
initiative side of the cell (`kProj`, `bucketRowsByGroups`, the `kProj > 0` band) — constant
work stays a purely additive deterministic floor, never entering `kPerGroup` / λ / the
bootstrap pool. GREEN confirmed: targeted acceptance 6/6 pass (exit 0); combined run with
`phase-1-engine.test.js` 36/36 (AT-26/AT-27 stay green); `npm run verify` exits 0
(183 passed / 1 skipped). No test file edited; the only production change is `index.html`.
Advanced to **Phase 4 review** (`stage: review`); next handover
`handover-14-implement-p4.md`.
