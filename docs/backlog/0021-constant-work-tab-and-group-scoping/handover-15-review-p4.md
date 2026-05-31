---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: review
feature_phase: 4
for_next_phase: atdd
outcome: success
reason: ""
produced_at: 2026-05-31T22:12:07Z
produced_commit: ""
test_commit: 90f41cd608f592437e6d78fc5982522ae7d508e6
impl_commit: 475296af542e00d0ef24d4aed4f4d74637fb9dfd
---
## Summary

Independent review of feature 0021 **Phase 4** (Team Projections surface honors
Category-scoping — each (team, quarter) cell scopes its **Constant work** to the
**Projection group**'s members; degenerate fallback preserved). **Verdict: PASS.**
The diff (`90f41cd..475296a`) implements the general rule entirely inside
`buildTeamProjections` in `index.html`, reusing the membership sets the `kProj` count
already consumes — no fixture literals, no test-keyed branches, no test-file drift.
All 5 invariants hold, all 4 counterexamples are pinned by the committed tests, and a
two-branch negative control confirms the suite catches a deliberate bug and recovers
on revert. Targeted (6 pass), combined (36 pass, AT-26/AT-27 green), and
`npm run verify` (183 passed / 1 skipped) all exit 0. Review file:
`docs/reviews/0021-constant-work-tab-and-group-scoping-phase-4-review-01.md`.

The task advances to **Phase 5 atdd** (`current_phase: 5`).

## Instructions for the next phase

`atdd` (feature-phase **5**) — author and freeze the acceptance + inner tests for the
plan's **Phase 5** slice (*Constant-work quarters in the Target selector + Data
preview surfacing*), then confirm the RED gate. Phase 5's behavioral rule (plan
lines ~787-899):

- `refreshQuarters` sources the **Target** selector from `initiatives ∪ epics ∪
  editedConstantWork` quarters and the **Historical** selector from
  `initiatives ∪ epics` (unchanged) — the two `MultiSelect` instances (`#target-ms`
  / `#hist-ms`) populate from **different** lists. `targetMS` options ⊇ `histMS`
  options; the difference is exactly the constant-work-only quarters.
- A **Target quarter** that exists only in constant work yields a pure-constant-work
  forecast (`kPerGroup` all `0`, each Group at its own `fixedEffortPerGroup` shift).
- `prepareSimulationData`'s `preview` gains `preview.fixedEffortPerGroup` (org-wide
  per-Group constant-work PM, aligned with `kPerGroup`/`groupNames`),
  `preview.cwExcludedPM`, and `preview.cwExcludedRows` (PM + row count of
  target-quarter constant work whose Category matches **no** Group's members —
  overlap-aware: a row counts as excluded only if it is in *no* Group).
- `renderPreview` renders per-Group constant-work PM beside each per-Group `K` row
  **and** a dedicated "Constant work in no group: <PM> PM across <N> rows — excluded"
  line; both refresh on quarter-selection change (`tryUpdatePreview`) and on Run.
- **No Run gate / alert / modal** when constant work is excluded — surfacing is the
  Data preview only (forbidden shortcut).

Scenarios to triangulate (plan AT-1…AT-6): target-but-not-historical quarter;
pure-constant-work forecast; historical source unchanged; per-Group PM in preview;
excluded line when no Group matches; no excluded line when all rows match.

This phase **owns no legacy test migration** of its own (Phase 5 in the plan's
test-migration note migrates nothing; only Phases 1/2/6/8 migrate). Author
`tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js` per the plan's
*Test harness* section (seam: `refreshQuarters`, `prepareSimulationData.preview`,
`renderPreview`'s rendered text), then confirm RED. **Take all gated decisions
autonomously and record them in your handover** (no user in Loop mode).

Derive the diff boundary for the *next* (implement → review) cycle from the git log
of the handover files; this review embeds the Phase-4 SHAs only for the record.

## Files the next phase MUST read

- `docs/plans/0021-constant-work-tab-and-group-scoping.md` — the **Phase 5** slice
  (lines ~787-900): acceptance behavior (AT-1…AT-6), behavioral rule, invariants,
  counterexamples, forbidden shortcuts, test harness, definition of done.
- `index.html` — the seams Phase 5 touches: `refreshQuarters` (~`index.html:1624`+,
  the two `populate` calls), `extractQuarters`, `prepareSimulationData` (the `preview`
  object), `renderPreview` / `tryUpdatePreview`, and the `MultiSelect` widget
  (`histMS` / `targetMS`). `getConstantWorkEffortPerGroup` (Phase 2) is the helper the
  preview's per-Group PM reuses.
- `tests/harness.js` — `loadSimulator`, `read`, `evalIn`, `execIn`, `csv`; how to
  read `MultiSelect` options and rendered preview text.
- `tests/acceptance/phase-1-engine.test.js` and
  `tests/acceptance/phase-4-projections-constant-work-scoping.test.js` — for the
  fixture/seam idioms (load initiatives via `loadInitiativesCSV`, set
  `editedConstantWork`/`groupsStore`, call engine functions via `evalIn`).
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` — the two selectors
  diverge in source; constant work never informs λ / the bootstrap pool; exclusion is
  surfaced, never silently dropped.
- `docs/adr/0017-multi-quarter-selectors.md` — the `MultiSelect` widget; its sources
  diverge in this phase.
- `CONTEXT.md` — glossary (Target quarter, Historical quarter, Quarter selector,
  MultiSelect, Data preview, Constant work, Category, Group, Poisson λ, Bootstrap pool).

## Context the next phase needs

Autonomous decisions taken this review session (no user in Loop mode):

- **Verdict PASS, transition applied by this phase.** `current_phase` advanced 4 → 5,
  `stage` → `atdd`, `retry_count` reset to `0`, `next_handover` → `handover-03-plan.md`
  (the plan handover that every atdd cycle reads), and the Phase-4 review path appended
  to `artifacts.reviews`.
- **Negative control used two mutations, both reverted before commit.** (A) disabling
  scoping (`const scopedCwEpics = cwEpics;`) fails AT-1/AT-2(×2)/AT-3/AT-5, exit 1 —
  AT-4 (the degenerate fallback) survives because unconditional-all *is* the fallback.
  (B) dropping the `projGroup` guard (filter unconditionally) fails AT-4, exit 1 —
  confirming the fallback branch is genuinely tested. The working tree was restored to
  HEAD (`git diff --stat` empty) before any artifact write; this commit contains only
  the review file, the index update, and this handover.
- **Accepted the implementer's two documented decisions.** (1) The cell-skip guard
  `if (!qInits.length && !cwEpics.length) continue;` was intentionally left on the
  **unscoped** `cwEpics` — keeping a cell with entirely out-of-scope constant work
  rendered (with `cwEffort === 0`, flat band), consistent with AT-3 and not a
  counterexample. (2) The inline-filter mechanism (vs. reusing the Phase 2 vector
  helper) is one of the two latitudes the plan explicitly allows; the observable
  contract is what the tests pin. Both are sound.
- **One non-blocking coverage note (not a gap).** The Phase 4 acceptance file keeps
  `kProj === 0` by design so the scoped `cwEffort` is directly observable in the flat
  band; it does not re-exercise the `kProj > 0` Monte Carlo band-shift. That path is
  unchanged by this diff (only `cwEffort`'s definition changed) and the
  `fixedEffortPerGroup` shift was tested/reviewed in Phase 2 (AT-5/AT-6). No additive
  verification tests were warranted.

## Definition of done (for the Phase 5 atdd phase)

- `tests/acceptance/phase-5-constant-work-quarters-and-preview.test.js` authored and
  frozen, covering AT-1…AT-6.
- RED gate confirmed: the new acceptance file fails on the current build (Target/
  Historical selectors share a source today; the preview has no per-Group constant-work
  PM and no excluded line) with a clean exit 1; RED confined to the new file; the rest
  of the suite stays GREEN.
- RED logs written under
  `docs/atdd-logs/0021-…-phase-5-{acceptance-red,inner-red,verify-ci}.log`.
- Index advanced to `stage: implement` (`current_phase: 5`); a `handover-NN-atdd-p5.md`
  written with `outcome: success`; one atomic commit under the lock; final JSON emitted.
