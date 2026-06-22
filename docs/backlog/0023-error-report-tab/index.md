---
schema: backlog-index/v1
id: "0023"
slug: error-report-tab
title: Error Report tab
stage: atdd
status: ready
priority: normal
flagged_for_human: false
total_phases: 6
current_phase: 1
retry_count: 0
max_retries: 3
next_handover: handover-03-plan.md
updated_at: 2026-06-22T19:24:06Z
created_at: 2026-06-22T18:49:16Z
blocked_reason: ""
artifacts:
  plan: docs/plans/0023-error-report-tab.md
---
# 0023 — Error Report tab

Add a new advisory **Error Report** results tab (slug `error-report`, last in the
tab bar; org stays the resting tab) that, after a Run **completes**, lists
data-quality findings the simulator otherwise handles silently — unrecognized
t-shirt sizes, out-of-scope/orphan epics, historical quarters with no loaded
epics, duplicate initiative keys and quarter-label variants, degenerate λ=0 /
total-K=0 runs, capacity/iterations coercion, constant-work categories matching no
Group, and the four multi-quarter-initiative conditions.

Findings are collected by **instrumenting the actual Run path** (so the report can
never disagree with what the simulation computed) and are **advisory only**: the
report never aborts or alters a Run, and the two existing hard stops are unchanged.
The known multi-quarter forward double-count is **reported at ERROR but not fixed**
here — the underlying per-key-vs-per-row unit-consistency fix is a separate future
task. See [ADR-0037](../../adr/0037-error-report-advisory-diagnostics.md).

> **apply-docs done (2026-06-22):** the five glossary terms are in `CONTEXT.md`
> (four new + the pre-existing **Recognised t-shirt size** augmented in place) and
> ADR-0037 is created; toolchain was already selected (no-op). Next stage: **plan**.
>
> **plan done (2026-06-22):** `docs/plans/0023-error-report-tab.md` written with
> **`total_phases: 6`** thin vertical slices — (1) tab + finding model + render +
> empty state + unrecognised-size; (2) scope/calibration exclusions; (3)
> run-parameter / degenerate-run findings; (4) duplicates & overlaps; (5) initiative
> & cross-ref integrity + constant-work exclusion; (6) multi-quarter section + full
> presentation contract. AC-1…AC-13, I-1…I-5, and DC-1…DC-5 are formalised (not
> re-decided); the 22 test-facing `code`s + per-code severities are pinned in the
> plan's Data models. Next stage: **atdd** (feature-phase 1).
