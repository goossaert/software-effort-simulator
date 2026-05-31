---
schema: backlog-handover/v1
task_id: "0021"
produced_by_phase: apply-docs
feature_phase: null
for_next_phase: plan
outcome: success
reason: ""
produced_at: 2026-05-29T23:00:00Z
produced_commit: 7bf19a0
---
## Summary

`apply-docs` applied the documentation grill prepared: it created **ADR-0033**
(constant work scoped to Groups by Category) and **ADR-0034** (editable Constant work tab
with add/delete + CSV export), **amended ADR-0023** with an "Amended by 0033/0034" note,
and applied ~20 **CONTEXT.md** glossary edits. All landed in commit `7bf19a0`. Outcome:
success — the task is ready for `plan`.

## Instructions for the next phase

`plan`: produce `docs/plans/0021-constant-work-tab-and-group-scoping.md` per
`PLAN-TEMPLATE.md`, reusing task id `0021` (do **not** compute a new plan number). Take
slug, relevant files, test-harness locations, verify command, goal, scope, and entry point
from `handover-01-grill.md`'s **Plan logistics**. Cite the ADRs and glossary terms created
here rather than re-deriving them. Set `total_phases` authoritatively from the phases you
write, set `current_phase: 1`, advance `stage: atdd`.

## Files the next phase MUST read

- `docs/backlog/0021-constant-work-tab-and-group-scoping/handover-01-grill.md` — the Plan logistics (slug, files, harness, verify, goal/scope/entry point) and full design record.
- `CONTEXT.md` — glossary now reflecting the constant-work / Category / Group / quarter terms the plan must use precisely.
- `docs/adr/0033-constant-work-scoped-to-groups-by-category.md` — core engine semantics (per-Group `fixedEffortPerGroup`, Category scoping, exclusion-but-surfaced, target-quarter-only).
- `docs/adr/0034-editable-constant-work-tab.md` — editable tab + `editedConstantWork` substrate + export (commit-on-Run).
- `docs/adr/0023-constant-work-csv-deterministic-shift.md` — the amended ADR (deterministic mechanism retained; global-scalar scope superseded).

## Context the next phase needs

Now present in the repo after this phase:

- **ADRs:** `0033` (scoping), `0034` (editable tab), and the amendment header on `0023`.
- **CONTEXT.md terms** updated/added: Constant work, Constant Work CSV, Category, Group,
  Scenario, Target quarter, Quarter selector, Tab, Groups tab, Data preview, Quick
  projection Monte Carlo, Effort projection band, Global histogram range, Initiative
  matrix, Projection group, and the new term **Constant work tab** (plus two *Flagged
  ambiguities* and updated *Relationships* constant-work bullets).
- **Numbering:** ADRs use their own sequence (0033/0034), independent of the feature/plan
  number 0021 — by project decision and per the tool's convention (the loop never parses
  ADR numbers). The plan must use `0021` as its number.

## Definition of done (for plan)

`docs/plans/0021-constant-work-tab-and-group-scoping.md` exists, conforms to
`PLAN-TEMPLATE.md` (every section present), each phase is a thin vertical slice with one
observable outcome, `total_phases` is set authoritatively, and `index.md` is advanced to
`stage: atdd`, `current_phase: 1`.
