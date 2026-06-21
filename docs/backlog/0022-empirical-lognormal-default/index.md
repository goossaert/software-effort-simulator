---
schema: backlog-index/v1
id: "0022"
slug: empirical-lognormal-default
title: Default to empirical lognormal parameters
stage: apply-docs
status: ready
priority: normal
flagged_for_human: false
total_phases: 0
current_phase: 0
retry_count: 0
max_retries: 3
next_handover: handover-01-grill.md
updated_at: 2026-06-21T14:37:12Z
created_at: 2026-06-20T21:36:48Z
blocked_reason: "apply-docs blocked at Step 3b: pbt install ERESOLVE — @fast-check/vitest@0.4.1 needs vitest@^4.1.0 but repo pins vitest@2.1.9; needs human re-pin or approved vitest 4.x upgrade (see handover-02-apply-docs.md)."
artifacts:
  plan: docs/plans/0022-empirical-lognormal-default.md
---
# 0022 — Default to empirical lognormal parameters

Make the **Empirical parameters** lognormal table the page-load default instead of the
**Synthetic parameters** table: the `param-mode` radio's `empirical` option becomes `checked`,
its label carries the `.active` highlight on load, and `activeParams` initialises to
`T_SHIRT_PARAMS_EMPIRICAL`. Synthetic stays a one-click alternative and the toggle stays
ephemeral (no `localStorage`) — only the default value changes. This reverses the page-load
default that [ADR-0026](docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md) deliberately
set to synthetic, so a superseding **ADR-0035** is recorded; the operator's rationale is that the
synthetic↔empirical outcome gap is large enough that the old synthetic default was the mode
silently reporting numbers they did not intend, and the empirical calibration is the baseline that
improves as more realised quarters are folded in.

This is also the **first task born under the v3 toolchain**, so its `handover-01-grill.md` carries
a `## Mechanical toolchain to apply` section (human-selected, dated 2026-06-20) that `apply-docs`
installs and applies — flipping `toolchain.selected` to `true`.
