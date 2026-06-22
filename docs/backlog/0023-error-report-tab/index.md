---
schema: backlog-index/v1
id: "0023"
slug: error-report-tab
title: Error Report tab
stage: apply-docs
status: ready
priority: normal
flagged_for_human: false
total_phases: 0
current_phase: 0
retry_count: 0
max_retries: 3
next_handover: handover-01-grill.md
updated_at: 2026-06-22T18:49:16Z
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
task. See ADR-0037 (to be created by apply-docs).
