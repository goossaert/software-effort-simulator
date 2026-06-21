---
schema: backlog-index/v1
id: "0022"
slug: empirical-lognormal-default
title: Default to empirical lognormal parameters
stage: review-correctness
status: ready
priority: normal
flagged_for_human: false
total_phases: 1
current_phase: 1
retry_count: 0
max_retries: 3
next_handover: handover-07-review-p1.md
updated_at: 2026-06-21T20:15:08Z
created_at: 2026-06-20T21:36:48Z
blocked_reason: ""
artifacts:
  plan: docs/plans/0022-empirical-lognormal-default.md
  reviews:
    - docs/reviews/0022-empirical-lognormal-default-phase-1-review-01.md
    - docs/reviews/0022-empirical-lognormal-default-phase-1-review-02.md
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

**review p1 (2026-06-21):** **BLOCKED** (flagged for human). Integrity axes all clean over
`f7eb97d..62f80b5`: no test files changed; no test-gaming patterns; the `package.json` `verify`
bootstrap weakens no correctness layer; I-1/I-2 (`[test-only]`) satisfied (no `[contract]`
invariants); AT-1..AT-4 + the per-size `test.prop` property + triangulation examples all map to the
plan (oracle (a); parity N/A); **negative control PASS** (revert default → exit 1/5-failed; restore
→ exit 0/8-passed). The single blocker is the plan-DoD **scored mutation gate**: with
`mutation.enabled: true`, `npx stryker run` produces **no score** — the scoped `mutate`
ranges `["index.html:1333","index.html:4522-4531"]` instrument **0 mutants** (a diagnostic whole-file
run = 3589 mutants proves Stryker *can* mutate this HTML, so it is a range-config defect, not a
capability gap) and the vitest runner's `related` discovery can't find the JSDOM-harness fs-loaded
tests (no `import` edge). Not a production bug (→implement) and not a missing test (→atdd); the fix is
a human `stryker.conf.json`/toolchain change (set `vitest.related:false` + a working scoped `mutate`
form) or a deliberate mutation N/A. Stage left at **review**; re-run after the human fix. Review +
mutation report under `docs/reviews/0022-…-phase-1-{review,mutation}-01.md`; findings in
`handover-07-review-p1.md`.

**human fix (2026-06-21):** unblocked. Root-caused both blockers from the StrykerJS 9.6.1 source +
reproduction: (1) `vitest.related` fails because the ADR-0031 harness fs-loads `index.html` with no
`import` edge — fixed by `vitest: { related: false }` (verified: `npx stryker run` then runs all 234
tests); (2) **scoped** mutation is *unsatisfiable* for this single-file multi-`<script>` app — Stryker's
`mutate` line-range filter is **script-relative** and resets per `<script>` block, so no file-line range
isolates the param-mode block (`index.html:4522-4531` → 0 mutants; the script-relative `28-30`
over-captures unrelated blocks at file lines 1169/3307/3308), and the changed line
`let activeParams = …` yields **0 mutants** anyway. Decision (operator-chosen): record the mutation
layer **N/A** (`mutation.enabled: false`, `toolchain.layers.mutation.status: "n/a"`) — see **ADR-0036**;
behaviour stays guarded by the passing Step-6 negative control + per-size PBT. `stryker.conf.json` left
runnable (`related:false` + whole-file `mutate`) for ad-hoc use only. Plan DoD mutation bullet marked
N/A; mutation report carries the full root-cause under "Resolution". Blocked `handover-07-review-p1.md`
removed so the loop regenerates the review fresh. Stage stays **review**, `status: ready` → re-run
review (all other axes already clean → should PASS → `review-correctness`). **Trusted-overlay action
(operator, out-of-band):** the overlay is active, so this in-repo N/A is ignored by the gate's
mutation forcing-check — the N/A must also be recorded in the trusted `enforcement.config.json`
(owned by `backlog-tool`, not writable from this session). Add the `toolchain.layers.mutation` N/A,
i.e. the file becomes:
`{"gate":{"enabled":true},"correctness_gate":{"enabled":true},"test_immutability":{"readonly_enforcement":"chmod"},"toolchain":{"layers":{"mutation":{"status":"n/a"}}}}`

**review p1 (2026-06-21, run 02 — re-run after the human mutation-N/A fix):** **PASS** (integrity
clean). Reviewed `f7eb97d..62f80b5` (test..impl). Production diff = `index.html` (six in-place
edits flipping the page-load default synthetic→empirical; the `change` handler byte-for-byte
unchanged) + `package.json` (the `verify` self-bootstrap). All integrity axes clean: **no
test-file drift** (`git diff …-- tests features e2e acceptance` empty); **no test-gaming
pattern** (the `package.json` `verify` change prepends a guarded `npm ci` and disables/
downgrades/scope-narrows **no** correctness layer — infrastructure, not a goalpost move);
**I-1/I-2** `[test-only]` SATISFIED (no `[contract]` invariants → gate (g) N/A); **AT-1..AT-4 +
the per-size `test.prop` property + triangulation examples** map to the plan (oracle (a); parity
N/A; PBT property present, generator-read from the table, non-vacuous on calibrated sizes);
**negative control PASS** (revert default→synthetic → exit 1, 5 failed, property counterexample
`["XS"]`; restore → exit 0, 8 passed). Mutation **N/A** and **does not block** — `mutation.enabled:
false` *with* recorded N/A (`toolchain.layers.mutation.status: "n/a"`, ADR-0036), exactly the
human-fix resolution of run-01's blocker (so this is **not** the `mutation-unconfigured` block
case). Full `npm run verify` on the committed tree exits 0 (234 passed | 1 skipped). Review at
`docs/reviews/0022-…-phase-1-review-02.md`; findings + correctness-review inputs in
`handover-07-review-p1.md`. Stage → **review-correctness** (same `current_phase: 1`); the
correctness review owns the advance to `done`.

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
