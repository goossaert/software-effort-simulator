---
schema: backlog-index/v1
id: "0021"
slug: constant-work-tab-and-group-scoping
title: Editable Constant work tab + constant work scoped to Groups by Category and quarter
stage: atdd
status: ready
priority: normal
flagged_for_human: false
total_phases: 8
current_phase: 6
retry_count: 0
max_retries: 3
next_handover: handover-03-plan.md
updated_at: 2026-05-31T22:40:04Z
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
    - docs/reviews/0021-constant-work-tab-and-group-scoping-phase-4-review-01.md
    - docs/reviews/0021-constant-work-tab-and-group-scoping-phase-5-review-01.md
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

**Phase 4 review done** (this commit): verdict **PASS**. Independent verification
(diff `90f41cd..475296a`) confirmed the general Projection-group Category-scoping rule
(`index.html`-only, confined to `buildTeamProjections`): the new local `scopedCwEpics`
filters `getConstantWorkEpics(q, teamName)`'s output by the **Projection group**'s
membership using the **same** `projGroup` / `projLcMembers` / `projHasBlank` sets the
`kProj` count consumes (trim + case-fold via `normalizeCategory` + the **(Blank)
sentinel**, ADR-0028) — so the scoping is literally identical to the initiative side.
Both sinks (the `cwEffort` band floor and the appended constant-work **Initiative
matrix** rows) are driven off `scopedCwEpics`; the projection `runSimulation` call
passes the scoped `fixedEffortPerGroup: [cwEffort]` with no scalar `fixedEffort`. The
degenerate fallback (no Projection group / empty `groupsStore` → `projGroup === null` →
**all** constant work, not first-Group) is preserved; a zero-member Projection group
scopes to `0`. All 5 invariants hold; none of the 4 counterexamples is realizable
(each pinned by a positive+negative assertion pair); no fixture literals / test-keyed
branches / env checks / `tests/` imports; no test file drifted across
`test_commit..impl_commit`. Two-branch negative control: disabling scoping
(`scopedCwEpics = cwEpics`) fails AT-1/AT-2/AT-3/AT-5 (exit 1); dropping the `projGroup`
guard fails AT-4 (exit 1); both reverted → 6/6 GREEN. Targeted (6 pass), combined with
`phase-1-engine.test.js` (36 pass, AT-26/AT-27 green), and `npm run verify`
(183 passed / 1 skipped) all exit 0. Review:
`docs/reviews/0021-…-phase-4-review-01.md`. Advanced to **Phase 5 atdd**
(`current_phase: 5`, `retry_count: 0`); next handover `handover-03-plan.md`.

**Phase 5 atdd done** (this commit): authored
`tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js` (AT-1…AT-6, 6 `it`s)
for the **Target quarter** selector sourcing constant-work quarters and the **Data preview**
surfacing per-Group constant-work PM + an "in no group … excluded" line. **No legacy
migration needed** (the plan concentrates migrations in Phases 1/2/6/8; no committed test
asserts the pre-Phase-5 selector source or preview shape). Seams (autonomously chosen):
`refreshQuarters()` read through the rendered checkbox options under
`#target-ms`/`#hist-ms .ms-options-wrap` (not the widget's internal field); the plan-named
`preview.fixedEffortPerGroup` / `cwExcludedPM` / `cwExcludedRows` fields (exact values) plus
lenient rendered-text presence checks (`/PM/i`, `/excluded/i`, and a negative
`/[1-9]\d*\s*rows?…excluded/i` guard). RED-drivers AT-1/AT-4/AT-5 (exactly the plan's RED
gate); AT-2 (pure-constant-work forecast), AT-3 (Historical source unchanged), AT-6
(no positive excluded line, overlap-aware) are preserved-behavior guards GREEN on the
post-Phase-4 build. RED confirmed: acceptance run 3 failed / 3 passed, exit 1; focused inner
run (`-t "Data preview"`) 2 failed / 1 passed / 3 skipped, exit 1; full suite
(`npm run verify`) 3 failed / 186 passed / 1 skipped, exit 1 — RED confined to the new file.
Logs under `docs/atdd-logs/0021-…-phase-5-{acceptance-red,inner-red,verify-ci}.log`. Advanced
to **Phase 5 implement** (`stage: implement`); next handover `handover-16-atdd-p5.md`.

**Phase 5 implement done** (this commit): implemented the Phase 5 slice inline in
`index.html` (one production file). (1) `refreshQuarters` now sources the **Target**
selector from `initiatives ∪ epics ∪ editedConstantWork` quarters (new
`fromCW = extractQuarters(editedConstantWork)`, `allTarget` sorted with the shared
`cmpQuarter`, Target selection-preservation validated against `allTarget`) while the
**Historical** selector keeps `initiatives ∪ epics` — the two `MultiSelect`s are
populated from different lists; `loadConstantWorkCSV` / `resetConstantWorkFile` now
call `refreshQuarters()` for the user-visible source change. (2) `prepareSimulationData`'s
`preview` gained `fixedEffortPerGroup` (the org-wide vector already computed at the call
site, group-aligned), `cwExcludedPM`, and `cwExcludedRows` — the latter two from a new
sibling helper `getConstantWorkExcluded(quarters, groups, teamName)` that counts
in-scope CW rows whose **Category** is in **no** Group's members (overlap-aware: union of
all members built once; reuses the trim + case-fold + (Blank) sentinel semantics and the
`category → moscow → emoji` cascade). (3) `renderPreview` surfaces each Group's
constant-work PM beside its `K` row and a positive-only "… excluded" line
(`cwExcludedRows > 0`); no Run gate / alert. Constant work still contributes **zero** to
any Group's `kPerGroup` / **Poisson λ** / **Bootstrap pool** (engine path unchanged).
GREEN confirmed: targeted acceptance 6/6 pass (exit 0); `npm run verify` exits 0
(189 passed / 1 skipped — the 3 RED-drivers flipped, no regression). No test file edited.
Advanced to **Phase 5 review** (`stage: review`); next handover `handover-17-implement-p5.md`.

**Phase 5 review done** (this commit): verdict **PASS**. Independent verification
(diff `0d56a92..1e4e617`, `index.html`-only) confirmed the general Phase 5 rule:
`refreshQuarters` sources the **Target** selector from `initiatives ∪ epics ∪
editedConstantWork` and the **Historical** selector from `initiatives ∪ epics`,
populating the two `MultiSelect`s from **different lists** (`histMS.populate(all)` /
`targetMS.populate(allTarget)`) with selection-preservation intact; the new
`getConstantWorkExcluded` computes an **overlap-aware** in-no-Group exclusion
(member union built once, excluded iff in *no* Group) reusing the established
trim+case-fold+(Blank)-sentinel membership and the category→moscow→emoji cascade;
`prepareSimulationData.preview` gained `fixedEffortPerGroup` (group-aligned),
`cwExcludedPM`, `cwExcludedRows`; `renderPreview` surfaces per-Group PM and a
positive-only excluded line. All 5 invariants hold by construction; none of the 5
counterexamples is realizable (1–4 caught by AT-1/AT-3/AT-4/AT-5; 5 — no Run
gate/alert — structurally absent from the diff). No gaming pattern; no test file
drifted across `test_commit..impl_commit`; the 1 skipped test is the pre-existing
self-skipping `sanity-check-engine-mean.test.js`. Constant work still contributes
zero to any Group's `kPerGroup` / Poisson λ / bootstrap pool. Two negative-control
mutations (Historical populated from the widened list → AT-1/AT-3 fail; drop the
overlap-aware guard → AT-5/AT-6 fail) both caught and reverted; GREEN restored,
working tree clean. Targeted (6 pass) + `npm run verify` (189 passed / 1 skipped)
both exit 0. Review: `docs/reviews/0021-…-phase-5-review-01.md`. Advanced to
**Phase 6 atdd** (`current_phase: 6`, `retry_count: 0`); next handover
`handover-03-plan.md`.
