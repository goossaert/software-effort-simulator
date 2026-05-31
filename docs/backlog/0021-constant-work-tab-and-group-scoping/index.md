---
schema: backlog-index/v1
id: "0021"
slug: constant-work-tab-and-group-scoping
title: Editable Constant work tab + constant work scoped to Groups by Category and quarter
stage: implement
status: ready
priority: normal
flagged_for_human: false
total_phases: 8
current_phase: 8
retry_count: 0
max_retries: 3
next_handover: handover-25-atdd-p8.md
updated_at: 2026-05-31T23:42:42Z
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
    - docs/reviews/0021-constant-work-tab-and-group-scoping-phase-6-review-01.md
    - docs/reviews/0021-constant-work-tab-and-group-scoping-phase-7-review-01.md
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

**Phase 6 atdd done** (this commit): authored
`tests/acceptance/phase-6-constant-work-tab.test.js` (AT-1…AT-11, 15 `it`s) for the
sixth **Constant work tab** — editable table modelled on the Initiatives tab with the
`tshirt_size`/`t_shirt_size` cell as a `<select>` of exactly the seven **Recognised
t-shirt sizes**, `category`/`team`/`quarter` as `<input list>` datalist combos seeded
from the `editedInitiatives ∪ editedConstantWork` union, keys/name/kr/extra columns as
free text, inline `onchange` write-through + `tryUpdatePreview` (no Run, commit-on-Run),
and `exportConstantWorkCSV()` → `constant-work-edited.csv` preserving the imported header
set verbatim (round-trips). **Migrated** `tests/acceptance/phase-2-groups-tab.test.js`
AT-1 (five tabs → six; `Constant work` fifth, `Groups` sixth) — frozen. Seams (autonomously
chosen): the plan-named `data-tab="constant-work"` / `#tab-constant-work` /
`#constant-work-table-wrap` ids + `renderConstantWorkTable()` / `exportConstantWorkCSV()`
functions; datalist ids/classes left unlocked (resolved via each input's `list` attr); tab
reveal driven through the real generic tab-switch handler; AT-2 verified via the panel's
default/after-Run hidden state (sibling Groups-tab AT-2 seam) rather than the async Run
path. RED confirmed: combined acceptance run (Phase 6 + Phase 2) exits **1** (16 failed /
33 passed); focused inner run (`-t "AT-4:"`, the size-`<select>` seam) exits **1** (3
failed / 12 skipped); full suite (`npm run verify`) exits **1** with **16 failed / 188
passed / 1 skipped** — RED confined to the new Phase 6 file (15) + the migrated Phase 2
AT-1 (1). Logs under
`docs/atdd-logs/0021-…-phase-6-{acceptance-red,inner-red,verify-ci}.log`. Advanced to
**Phase 6 implement** (`stage: implement`); next handover `handover-19-atdd-p6.md`.

**Phase 6 implement done** (this commit): implemented the sixth **Constant work tab** inline in
`index.html` (one production file). Added the `data-tab="constant-work"` tab button (fifth, between
Initiatives and Groups) and the `#tab-constant-work` panel (`class="tab-panel"`,
`style="display:none"`) wrapping `#constant-work-table-wrap`; new `renderConstantWorkTable()`
(modelled on `renderInitiativesTable`, all cells editable — `tshirt_size`/`t_shirt_size` →
`<select>` of exactly the seven Recognised t-shirt sizes from `Object.keys(T_SHIRT_PARAMS)`, with an
unrecognised imported size preserved as an extra selected option; `category`/`moscow`/`emoji`,
`team`, `quarter` → `<input list>` datalist combos seeded from the observed **union** of
`editedInitiatives` ∪ `editedConstantWork` via the new `_cwObservedValues` helper, covering the
initiative `teams`/constant-work `team` naming split; all other columns → free-text `<input>`),
writing `#constant-work-table-wrap.innerHTML` once; inline `onchange` handlers commit `this.value` to
`editedConstantWork[rowIdx][col]` and call `tryUpdatePreview()` (no Run — commit-on-Run). New
`exportConstantWorkCSV()` (`Papa.unparse(editedConstantWork)` → `constant-work-edited.csv`, imported
header set verbatim, round-trips). Cell values use `escapeHtml` (not `escapeAttr`) so the
`<script>` payload renders inert **and** the value round-trips exactly (recorded decision —
`escapeAttr`'s `\'`-escaping would corrupt the value). `renderConstantWorkTable()` wired into the Run
handler; `#tab-constant-work` added to the visibility-reset block. CSS for `#constant-work-table-wrap`
mirrors `#initiatives-table-wrap`. GREEN confirmed: combined acceptance
(`phase-6-constant-work-tab.test.js` + `phase-2-groups-tab.test.js`) 49/49 pass (exit 0); focused
inner run (`-t "AT-4:"`) 3 pass / 12 skip (exit 0); `npm run verify` exits 0 (204 passed / 1 skipped —
the 16 RED tests flipped, no regression). No test file edited; the only production change is
`index.html`. Advanced to **Phase 6 review** (`stage: review`); next handover
`handover-20-implement-p6.md`.

**Phase 6 review done** (this commit): verdict **PASS**. Independent verification
(diff `ed7426b..bd4c799`, `index.html`-only) confirmed the general Phase 6 rule: a fifth
**Constant work** tab (`data-tab="constant-work"`) is inserted between **Initiatives** and
**Groups**; `renderConstantWorkTable()` renders `editedConstantWork` with role-based per-field
editors — size `<select>` from the canonical `Object.keys(T_SHIRT_PARAMS)` seven (unrecognised
value appended-and-selected), category/team/quarter `<input list>` datalists seeded from the
`editedInitiatives ∪ editedConstantWork` union (team candidates `['team','teams']` bridge the
naming split), everything else free text; inline `onchange` commits to `editedConstantWork` and
calls `tryUpdatePreview` (no Run); `exportConstantWorkCSV()` → `Papa.unparse` →
`constant-work-edited.csv` preserving the imported header set verbatim. All 8 invariants hold;
none of the 6 counterexamples is realizable; no test file drifted across `test_commit..impl_commit`
(drift check empty). The one nuance — the cell `value="…"` attribute uses **escapeHtml** (not
escapeAttr) — is a deliberate, AT-11-mandated choice that is XSS-safe (escapeHtml escapes `&<>"`)
and round-trips exactly. Three negative controls each flipped the targeted AT(s) to RED and reverted
to GREEN: size set `.slice(0,6)` → AT-4 (3 fail); datalist CW-only → AT-5 (2 fail); free-text
`escapeAttr` → AT-11 (1 fail). Targeted (49 pass) + `npm run verify` (204 passed / 1 skipped) both
exit 0; working tree clean. Review:
`docs/reviews/0021-…-phase-6-review-01.md`. Advanced to **Phase 7 atdd**
(`current_phase: 7`, `retry_count: 0`); next handover `handover-03-plan.md`.

**Phase 7 atdd done** (this commit): authored
`tests/acceptance/phase-7-constant-work-add-delete.test.js` (AT-1…AT-7, 11 `it`s) for
**Add row / delete row / from-scratch authoring** on the **Constant work tab** — the
ADR-0034 delta over the read-only-shaped Initiatives tab: `+ Add row` appends a blank
**canonical-schema** row (`jira_key, epic_name, key_result, category, team, quarter,
tshirt_size`) when nothing was imported (`parsedConstantWork === null`, incl. the
`editedConstantWork === []` boundary) and the **imported header set** otherwise (all rows
share columns); per-row delete splices immediately with **no confirmation**, preserving
order; from-scratch rows feed the simulation (`getConstantWorkEffortPerGroup` shift) while
`parsedConstantWork` stays `null`; lenient blanks (blank size → 0 PM, blank quarter →
excluded, blank Category → **(Blank) sentinel**); added rows render the same smart editors
(seven-size `<select>`, datalist combos) and export via `exportConstantWorkCSV()`. **No
legacy migration needed** (the plan concentrates migrations in Phases 1/2/6/8). Seams
(autonomously chosen): the `+ Add row` and per-row delete controls are reached through the
**rendered UI** (a clickable element matching `/add row/i` inside `#tab-constant-work`; the
single `<button>` in a data row) — clicked via `.click()` (inline-`onclick` fires in the
jsdom harness, as the Groups-tab tests already prove) — deliberately NOT locking the handler
function names or the delete glyph (`×`/`Delete`); authored-row behaviour asserted through
the Phase-2 engine seam `getConstantWorkEffortPerGroup`. RED confirmed: acceptance run
11 failed / 11, exit 1 (every AT fails on the absent add/delete controls — AT-1 "no + Add
row", AT-3 "no per-row delete", exactly the plan's RED gate); focused inner run
(`-t "AT-1:"`) 2 failed / 9 skipped, exit 1; full suite (`npm run verify`)
11 failed / 204 passed / 1 skipped, exit 1 — RED confined to the new file (the 204 passed =
the post-Phase-6 baseline; the 1 skipped is the pre-existing self-skipping
`sanity-check-engine-mean.test.js`). Logs under
`docs/atdd-logs/0021-…-phase-7-{acceptance-red,inner-red,verify-ci}.log`. Advanced to
**Phase 7 implement** (`stage: implement`); next handover `handover-22-atdd-p7.md`.

**Phase 7 implement done** (this commit): implemented **Add row / delete row / from-scratch
authoring** on the **Constant work tab** inline in `index.html` (one production file). Added a
`CW_CANONICAL_SCHEMA` constant (`['jira_key','epic_name','key_result','category','team','quarter',
'tshirt_size']`); restructured `renderConstantWorkTable` so the toolbar — now carrying a
**`+ Add row`** button (text `/add row/i`) plus the existing `↓ Export CSV` — renders in **every**
state, including the empty state (which previously early-returned "No constant work loaded." with no
control); `+ Add row` is placed in the toolbar, **not** as a `<tbody>` row, so the rendered row count
stays exact. Each data row gained a trailing per-row **Delete** `<button>` (the single button in the
row; the new trailing `<th></th>`/`<td>` column keeps data-column indices intact). New handler
`addConstantWorkRow()` appends a blank row: initialises `editedConstantWork` to `[]` when `null`
(an already-`[]` model is left intact; `parsedConstantWork` stays `null`), keys = the **canonical
schema** when `parsedConstantWork === null` else the **imported header set**
(`Object.keys(editedConstantWork[0] || parsedConstantWork[0] || {})` — robust to a fully-emptied
import), all values blank, then re-renders. New handler `deleteConstantWorkRow(rowIdx)` splices the
targeted row immediately with **no `confirm()`**, preserving order, then re-renders. Added rows
render the **same** smart editors (seven-size `<select>`, datalist combos) automatically, export via
the unchanged `exportConstantWorkCSV()`, and feed the simulation through the Phase-2
`getConstantWorkEffortPerGroup` seam; lenient blanks (size→0 PM, blank quarter→excluded, blank
Category→**(Blank) sentinel**) are left to the engine — no coercion added. GREEN confirmed: targeted
`phase-7-constant-work-add-delete.test.js` 11/11 pass (exit 0); `npm run verify` exits 0
(**215 passed / 1 skipped** — the pre-existing self-skipping `sanity-check-engine-mean.test.js`).
No test file edited; the only production change is `index.html`. Advanced to **Phase 7 review**
(`stage: review`); next handover `handover-23-implement-p7.md`.

**Phase 7 review done** (this commit): verdict **PASS**. Independent verification
(diff `be17a60..942b458`, `index.html`-only) confirmed the general ADR-0034 rule: a `+ Add row`
toolbar control (always rendered, in a `<div class="constant-work-toolbar">` — never a `<tbody>`
row, never gated behind a CSV) plus a per-row **Delete** `<button>` (the single button in each data
row) that splices `editedConstantWork` immediately with **no `confirm()`**; `addConstantWorkRow`
inits `[]`-from-`null` (leaving `parsedConstantWork` `null`) and keys the new row on the structural
predicate `parsedConstantWork === null` → **canonical schema** else the **imported header set**
(`Object.keys(editedConstantWork[0] || parsedConstantWork[0] || {})`); reuses the unchanged smart
editors (seven-size `<select>`, datalist combos), `exportConstantWorkCSV()`, and the Phase-2
`getConstantWorkEffortPerGroup` seam with **no blank coercion**. All 5 invariants hold by
construction; none of the 4 counterexamples is realizable; `CW_CANONICAL_SCHEMA` is the plan's
contract (not a fixture literal); no test file drifted across `test_commit..impl_commit`; no gaming
pattern. Three negative controls each flipped exactly the predicted AT(s) to RED and reverted to
11/11 GREEN: (a) gate add behind CSV → 8 fail (every from-scratch `it`); (b) always canonical →
AT-2 fail; (c) `confirm()` on delete → AT-3 fail. Targeted (11 pass) + `npm run verify`
(215 passed / 1 skipped) both exit 0; working tree clean. Review:
`docs/reviews/0021-…-phase-7-review-01.md`. Advanced to **Phase 8 atdd**
(`current_phase: 8`, `retry_count: 0`); next handover `handover-03-plan.md`.

**Phase 8 atdd done** (this commit): authored
`tests/acceptance/phase-8-groups-popover-union.test.js` (AT-1…AT-6, 11 `it`s) for the
**Groups Members popover** sourcing its observed-Categories option list from the union of
`editedInitiatives` ∪ `editedConstantWork`, computed at popover-open time — constant-work
Categories (incl. constant-work-only ones) become targetable by Groups; a Category in both
sources is one entry (Initiative casing wins on a case-insensitive merge), a constant-work-only
Category keeps its own casing, and adding a constant-work-only Category to a Group scopes that
work on the next Run (the Phase-2 `getConstantWorkEffortPerGroup` shift) while clearing the
Phase-5 `getConstantWorkExcluded` line; the `(Blank)` row and free-text input are unchanged.
**Migrated** `tests/acceptance/phase-2-groups-tab.test.js` **AT-28** (popover source
`editedInitiatives` → `editedInitiatives ∪ editedConstantWork`) — frozen. Seams (autonomously
chosen): the Phase-2 popover open affordance (`#groups-table-wrap .group-add-chip-btn`) and the
option list read from the DOM (`.ms-option`/`label` text), deliberately NOT locking the popover
DOM beyond the option-list contents + the `(Blank)`/free-text affordances (plan's "Do NOT lock
in"); AT-4's scoping effect asserted through the Phase-2 `getConstantWorkEffortPerGroup` and
Phase-5 `getConstantWorkExcluded` engine seams; constant work read via the canonical `category`
key. RED confirmed: acceptance run (Phase 8 + Phase 2) **8 failed / 37 passed**, exit 1 — RED
confined to the new file's 7 union RED-drivers (AT-1 happy+property, AT-3 ×2, AT-4, AT-6 ×2) +
the migrated AT-28; AT-1 negative, AT-2 ×2, AT-5 are preserved-behavior guards GREEN on the
post-Phase-7 build (same shape as Phases 4/5 GREEN guards). Focused inner run (`-t "AT-1:"`)
2 failed / 1 passed / 8 skipped, exit 1. Full suite (`npm run verify`) **8 failed / 218 passed /
1 skipped**, exit 1 — 218 = the 215 post-Phase-7 baseline − AT-28 (now RED) + 4 new GREEN guards;
the 1 skipped is the pre-existing self-skipping `sanity-check-engine-mean.test.js`. Logs under
`docs/atdd-logs/0021-…-phase-8-{acceptance-red,inner-red,verify-ci}.log`. Advanced to
**Phase 8 implement** (`stage: implement`); next handover `handover-25-atdd-p8.md`.
