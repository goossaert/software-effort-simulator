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
current_phase: 2
retry_count: 0
max_retries: 3
next_handover: handover-03-plan.md
updated_at: 2026-05-31T20:45:15Z
created_at: 2026-05-29T23:11:00Z
blocked_reason: ""
artifacts:
  plan: docs/plans/0021-constant-work-tab-and-group-scoping.md
  test_commit: ""
  impl_commit: ""
  reviews:
    - docs/reviews/0021-constant-work-tab-and-group-scoping-phase-1-review-01.md
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
