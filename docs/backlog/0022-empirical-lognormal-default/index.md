---
schema: backlog-index/v1
id: "0022"
slug: empirical-lognormal-default
title: Default to empirical lognormal parameters
stage: plan
status: ready
priority: normal
flagged_for_human: false
total_phases: 0
current_phase: 0
retry_count: 0
max_retries: 3
next_handover: handover-02-apply-docs.md
updated_at: 2026-06-21T15:43:33Z
created_at: 2026-06-20T21:36:48Z
blocked_reason: ""
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

**apply-docs (2026-06-21):** done. CONTEXT.md edits applied; ADR-0035 created; ADR-0026 noted as
superseded-in-part. v3 toolchain installed + wired + probed (fast-check, StrykerJS,
eslint-plugin-security, secretlint, ast-grep, npm audit), `toolchain.selected: true`, full
`npm run verify` GREEN. `npm audit` carries a documented accepted-exception allowlist for two
pre-existing dev-server-only advisories fixable only by the refused vitest 4.x major (see
`handover-02-apply-docs.md`). Stage → **plan**.
