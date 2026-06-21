---
schema: backlog-handover/v1
task_id: "0022"
produced_by_phase: apply-docs
feature_phase: null
for_next_phase: plan
outcome: success
reason: ""
produced_at: 2026-06-21T15:43:33Z
produced_commit: ebc51ab816b1039b6e450e5d4ba1ce039e898204
toolchain_applied:
  pbt: fast-check
  mutation: StrykerJS
  oracle_free: n/a
  typecheck: n/a
  lint: ESLint 9
  sast: eslint-plugin-security
  sanitizer: n/a
  dep_scan: npm audit (wrapped)
  secret_scan: secretlint
  analysis: ESLint 9
  forbidden_matcher: ast-grep
  smoke: n/a
  verify: npm run verify
---

## Summary

Applied grill's prepared documentation reversal and installed the **first-ever v3 toolchain** for
this repo. The three `CONTEXT.md` glossary edits are in; **ADR-0035** (empirical-as-default,
superseding ADR-0026's synthetic default) is created and ADR-0026 carries the one-line
superseded-in-part note. The mechanical toolchain — fast-check, StrykerJS, eslint-plugin-security,
secretlint, ast-grep (pinned), npm audit — is installed (lockfile created), wired into
`package.json`/`eslint.config.js`/`stryker.conf.json`/`.secretlintrc.json`, every `config:` key is
written, every tool was probed to run, the full `npm run verify` (incl. `-- --sequence.shuffle`) is
GREEN, and `toolchain.selected: true` is set last. `stage` advances to **plan**. No `index.html`
production change was made (that is the plan→atdd→implement job).

## Instructions for the next phase (plan)

1. Plan the production change scoped in the grill handover's **Plan logistics** — the 5 small
   `index.html` edits (re-grep the change sites; line numbers may have drifted): radios ~952–957
   (`checked` / `class="active"` move synthetic→empirical), `activeParams` init (~1333:
   `T_SHIRT_PARAMS` → `T_SHIRT_PARAMS_EMPIRICAL`), change handler unchanged. Cite the AC-1..AC-4 /
   I-1 already lint-cleared in grill — do not re-derive them.
2. Set the authoritative `total_phases` (grill hinted 1) and `current_phase: 1`.
3. **Mutation scope is the whole 4.6k-line `index.html`** under the configured `mutation.command`
   (`npx stryker run`, scope `changed-files`). A whole-file score of the default `mutation.min_score`
   (80) is **not** realistic day one — set a realistic per-phase `min_score` for the touched
   param/default region and SHOULD use Stryker's line-range `mutate` (e.g. `"index.html:<start>-<end>"`)
   to scope mutation to that region. (grill's NOTE under the mutation layer.)
4. For the PBT floor: the change is largely a UI-default flip + a module-scoped reference init; if the
   plan declares any **parametric** property (e.g. the sampler-reads-empirical invariant across all
   t-shirt sizes), `pbt.enabled` is `true` so the gate's (f) floor will require a `fc.property` /
   `test.prop` / `it.prop` test. If no parametric property is genuinely warranted, record that
   explicitly so the forcing check is satisfied (the toolchain is configured, not N/A'd).

## Files the next phase MUST read

- `docs/backlog/0022-empirical-lognormal-default/handover-01-grill.md` — the Plan logistics, AC-1..AC-4,
  I-1, out-of-scope list, and exact `index.html` change sites.
- `CONTEXT.md` — glossary; the **Synthetic parameters** / **Empirical parameters** entries now reflect
  the reversed default (edited this phase).
- `docs/adr/0035-default-to-empirical-lognormal-parameters.md` — the new ADR making empirical the
  page-load default (the one-way door for this task is captured here; do not re-decide it).
- `docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md` — superseded **in part** (default only);
  its ephemeral-toggle / no-persistence decisions still stand.
- `docs/adr/0007-lognormal-effort-distribution.md` — the synthetic-fit hand-recompute contract that
  stays intact (reference panel is band-as-definition).
- `backlog.config.json` — the now-populated `pbt`, `mutation`, `correctness_gate.*`, `gate`,
  `stability.shuffle_flag`, and `toolchain` blocks the plan/atdd/gate phases consume.

## Context the next phase needs

**Boot smoke**: `smoke_command` is empty (logged no-op per LOOP-MODE); as the closest available check
I ran the existing `npm run verify` on the inherited base (commit ebc51ab) → **passed** (226 tests, 1
skipped). Green base confirmed before any work.

**Glossary terms / ADRs now in place** (plan should cite, not re-derive):
- **ADR-0035** now exists (empirical is the page-load default; synthetic is the one-click alternative;
  ephemerality unchanged). **ADR-0026** is annotated "superseded in part".
- `CONTEXT.md`: **Synthetic parameters** = "documented-baseline … no longer the page-load default";
  **Empirical parameters** = "the **default** value of `activeParams` on every page-load … reset to
  **Empirical** on reload".

**Toolchain applied** (all 13 layers recorded in `toolchain.layers`):
- selected: pbt (fast-check 4.8.0 + @fast-check/vitest 0.3.0), mutation (StrykerJS 9.6.1 core +
  vitest-runner), lint (ESLint 9.39.4), sast (eslint-plugin-security 4.0.1), dep_scan (npm audit,
  wrapped — see below), secret_scan (secretlint 13.0.2), analysis (ESLint), forbidden_matcher
  (@ast-grep/cli 0.43.0, pinned), verify (`npm run verify`, extended).
- n/a: oracle_free, typecheck, sanitizer, smoke (rationale recorded per layer).
- Wiring done: `verify` chains `lint → scan:forbidden → scan:deps → secretlint → vitest`;
  `eslint.config.js` adds `security.configs.recommended` with **only** `security/detect-object-injection`
  disabled (canonical FP on the param-table lookups — `npm run lint` is green repo-wide);
  `stryker.conf.json` (vitest runner, `mutate: ["index.html"]`, clear-text/json reporters);
  `.secretlintrc.json` (preset-recommend); `stability.shuffle_flag = "-- --sequence.shuffle"` validated
  to reach vitest (`vitest run --sequence.shuffle`, seeded run observed).

**Autonomous decisions taken this phase (gated, recorded here):**
1. **`@fast-check/vitest` install** succeeded at the human-re-pinned **0.3.0** (no ERESOLVE against
   vitest 2.x) — the prior blocker (0.4.1's peer `vitest@^4.1.0`) is resolved. StrykerJS 9.6.1 also
   installed clean against vitest 2.x.
2. **npm-audit accepted exception (the gated decision the grill heads-up pre-authorised).** A bare
   `npm audit --audit-level=high` is permanently RED here because of **two pre-existing, dev-server-only
   advisories in the vitest 2.x toolchain** whose only upstream fix is a **vitest 4.x major upgrade the
   operator deliberately refused** (commits 4c263d0 / ebc51ab): `GHSA-fx2h-pf6j-xcff` (vite
   `server.fs.deny` bypass — dev server only) and `GHSA-5xrq-8626-4rwp` (vitest UI-server file
   read/exec — `vitest --ui` only). Neither is reachable by this repo's usage (single static
   `index.html`, headless `vitest run`, no dev/UI server). Per the heads-up ("record an accepted
   exception — do not let an unrelated advisory permanently block the loop") I recorded the exception in
   `scripts/dep-scan.mjs`: a **thin allowlist wrapper around `npm audit` itself** (no library
   substituted) that excepts exactly those two GHSA ids and **still fails on every other high/critical
   advisory, in any dep, including new ones**. `correctness_gate.dep_scan_command` = `npm run scan:deps`.
   This is a reversible decision (delete the two allowlist entries when vitest is upgraded off 2.x); not
   a one-way door, so no block. Also added an npm `overrides` pin of **esbuild ^0.25.0** (installed
   0.25.12) which resolves the underlying esbuild dev-server advisory at the root; the test suite is
   green with it (226 passed), so it is kept rather than allowlisted.

**Heads-up for plan / implement / the gate (not blockers):**
- `verify_command` chains `npm run scan:deps` and `npx secretlint`. `npm audit` (inside scan:deps)
  contacts the registry advisory endpoint, so it **needs network**; the gate's sub-check (b) hermetic
  verify runs **network-disabled**. If `npm audit --json` cannot reach the registry under the hermetic
  wrapper it will print no parseable JSON and `scripts/dep-scan.mjs` exits 2 (FAIL). This is inherent to
  the grill-specified decision to put `npm audit` inside `verify`; flag it if the gate's hermetic verify
  fails on the dep-scan step (the fix is operator-side: pre-warm the audit cache or treat dep_scan as a
  non-hermetic layer — apply-docs neither re-decides the toolchain nor weakens the gate).

## Definition of done (for plan)

A `docs/plans/0022-empirical-lognormal-default.md` exists with the authoritative `total_phases`, the
Phase-1 behavioral rules / invariants / DoD citing AC-1..AC-4 + I-1 and ADR-0035, a realistic scoped
mutation `min_score` for the touched `index.html` region, and the PBT-property decision recorded;
`index.md` advanced to `stage: atdd`, `current_phase: 1`.
