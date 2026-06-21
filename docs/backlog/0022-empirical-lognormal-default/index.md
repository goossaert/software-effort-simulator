---
schema: backlog-index/v1
id: "0022"
slug: empirical-lognormal-default
title: Default to empirical lognormal parameters
stage: review
status: ready
priority: normal
flagged_for_human: false
total_phases: 1
current_phase: 1
retry_count: 0
max_retries: 3
next_handover: handover-06-implement-p1.md
updated_at: 2026-06-21T18:27:00Z
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

**plan (2026-06-21):** done. `total_phases: 1` (authoritative) — the page-load default flip is
one thin vertical slice. Plan `docs/plans/0022-empirical-lognormal-default.md` formalises AC-1..AC-4
+ I-1 into Phase-1 acceptance scenarios (AT-1..AT-4), a per-size empirical-on-load PBT property
(fast-check), oracle class (a), and citations of ADR-0035/0026/0007. Mutation scoped to the
param-mode region (`stryker.conf.json` `mutate` → `["index.html:1333","index.html:4522-4531"]`)
with `mutation.min_score: 70` (apply-docs delegated the realistic per-phase threshold to plan).
Stage → **atdd**, `current_phase: 1`.

**atdd p1 (2026-06-21):** done. Committed RED tests under `tests/acceptance/0022-*.test.js`:
`0022-empirical-default-on-load.test.js` (AT-1/AT-2/AT-4) and
`0022-empirical-default-params-property.test.js` (the per-size fast-check property + AT-3 toggle
regression guard + happy/boundary/negative examples). Stable RED proven over 5 reruns on the base
(`c54d9c8`, synthetic default): acceptance 5/5 exit 1, property 5/5 exit 1 (shrunk counterexample a
calibrated size {XS,S,M,L} — the non-vacuous driver; 2XS carry-through + AT-3 pass). RED logs +
flakiness log under `docs/atdd-logs/0022-…-phase-1-*.log`. No `index.html` edits. Stage →
**implement**, `next_handover: handover-04-atdd-p1.md`.

**implement p1 (2026-06-21, retry after gate rewind):** done. The first implement (`165edeee`) was
rewound by the post-stage gate for the **hermetic-verify** sub-check (`exit 127` —
`sh: eslint: command not found`). Root cause: the gate runs `verify_command` in a **bare** detached
worktree with **no `npm ci`**, and `node_modules/` is git-ignored, so the old `verify` (which
assumed installed deps) failed at its first tool. Fixed in `package.json` by making `verify`
self-bootstrap deps from the lockfile (`{ [ -e node_modules/.bin/eslint ] || npm ci; } && …`) — no
tool changed/weakened. Re-applied the six in-place `index.html` edits (page-load default → Empirical:
empirical radio `checked` + `.active`; `let activeParams = T_SHIRT_PARAMS_EMPIRICAL`; comment; the
`change` handler untouched). Inner tests stable green (acceptance 3/3, property 5/5; 3 default + 1
shuffle = 8/8), `npm run verify` exit 0 (234 passed | 1 skipped), and a **gate-faithful hermetic
verify now PASSES** (bare worktree, 3 reruns + shuffle, all exit 0). Per-layer + hermetic logs under
`docs/atdd-logs/0022-…-phase-1-*.log`. No `tests/**` edits. Stage → **review**,
`next_handover: handover-06-implement-p1.md`.
