---
schema: backlog-handover/v1
task_id: "0022"
produced_by_phase: plan
feature_phase: null
for_next_phase: atdd
outcome: success
reason: ""
produced_at: 2026-06-21T15:50:53Z
produced_commit: c54d9c82784f9a5e0a1b5f00e826a3be5b31e85b
total_phases: 1
---

## Summary

Planned the production change scoped by grill/apply-docs: making the **Empirical parameters**
lognormal table the page-load default. **`total_phases: 1`** — the change is one thin vertical
slice (a UI-default flip + a module-scoped reference init), whose facets (the radio/label UI,
the `activeParams` binding they control, ephemerality, and the preserved bidirectional toggle)
are coupled by invariant I-1 and cannot be cut into independently-acceptance-testable
sub-phases. The plan `docs/plans/0022-empirical-lognormal-default.md` formalises grill's
lint-cleared **AC-1..AC-4** + **I-1** into Phase-1 scenarios **AT-1..AT-4**, a per-size
empirical-on-load **PBT property** (fast-check), **oracle class (a)**, and citations to
**ADR-0035** (the one-way door — already decided), ADR-0026 (ephemerality survives), ADR-0007,
ADR-0002. `index.md` advanced to `stage: atdd`, `current_phase: 1`.

## Instructions for the next phase (atdd)

1. Write the **acceptance** tests `tests/acceptance/0022-empirical-default-on-load.test.js`
   (AT-1, AT-2, AT-4) and the **property** test
   `tests/acceptance/0022-empirical-default-params-property.test.js` (the per-size
   empirical-on-load property, plus AT-3 the toggle regression guard — place AT-3 wherever it
   reads best). Both filenames start with `0022-`.
2. Use the **JSDOM harness** (`tests/harness.js`): `loadSimulator()` is a page-load with no
   interaction; `read(win, 'activeParams' | 'T_SHIRT_PARAMS' | 'T_SHIRT_PARAMS_EMPIRICAL')`;
   `win.document.querySelector('input[name="param-mode"][value="empirical"]')` /
   `#param-label-empirical` for DOM; fire toggles with `el.dispatchEvent(new win.Event('change'))`.
3. **PBT is REQUIRED for this phase** (`pbt.enabled: true`; the gate's (f) floor will grep for
   `pbt.import_symbol` = `fc.property|test.prop|it.prop`). Write the per-size property with
   **fast-check** (`@fast-check/vitest` `test.prop`/`it.prop`), generating the size from
   `Object.keys(T_SHIRT_PARAMS_EMPIRICAL)` **read from the loaded window** (do not hand-list
   sizes). Assert `activeParams[s].mu/.sigma === T_SHIRT_PARAMS_EMPIRICAL[s].mu/.sigma`. The
   carry-through sizes `2XS/XL/XL+` are the adversarial edge; calibrated sizes `XS/S/M/L` are
   what makes the property fail under the (current) synthetic default — so it is genuinely RED.
4. **RED gate**: confirm a **stable** FAIL (5 reruns) on the unmodified base — AT-1/AT-2/AT-4-default
   and the property must fail because the base defaults to synthetic. AT-3 and AT-4's
   "no-localStorage-write" assertion are **already green** regression guards (the toggle works
   and nothing is persisted today); each test *file* is still RED overall via its new-default
   assertions. Persist the RED logs to `docs/atdd-logs/0022-empirical-lognormal-default-phase-1-*-red.log`
   (the gate sub-check (c) re-runs the `command:` header verbatim).
5. The production edit is for **implement**, not atdd. Do **not** touch `index.html`.

## Files the next phase MUST read

- `docs/plans/0022-empirical-lognormal-default.md` — the Phase-1 behavioral rule, AT-1..AT-4,
  invariants (I-1/I-2 `[test-only]`), the PBT property + generator domain, oracle class (a),
  counterexamples, forbidden shortcuts, RED gate, and the scoped-mutation DoD. **This handover
  is the input to every atdd cycle for this task** (there is only feature-phase 1).
- `CONTEXT.md` — glossary: **Synthetic parameters**, **Empirical parameters**, **Recognised
  t-shirt size** (already edited by apply-docs to the reversed default).
- `docs/adr/0035-default-to-empirical-lognormal-parameters.md` — the page-load-default decision
  (the one-way door; do not re-decide it).
- `docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md` — superseded **in part**; its
  ephemeral / no-persistence decision still constrains this feature.
- `docs/adr/0007-lognormal-effort-distribution.md` — the synthetic-fit contract that stays intact.
- `tests/harness.js` — `loadSimulator`/`read`/`evalIn`/`execIn` usage.
- `backlog.config.json` — `pbt.*`, `mutation.*` (now `min_score: 70`), `correctness_gate.*`,
  `gate`, `stability.shuffle_flag`, `toolchain` blocks.

## Context the next phase needs

**Boot smoke:** `smoke_command` is empty (logged no-op per LOOP-MODE). The inherited base
(`c54d9c8`, clean working tree) was confirmed GREEN by apply-docs (`npm run verify`, 226 passed
/ 1 skipped). As the cheapest available structural check for a docs-only stage I re-grepped the
five change sites — all present at the grill-recorded lines (no drift): radios 952/953/956/957,
`activeParams` init 1333 (`= T_SHIRT_PARAMS;`), empirical table 1322-1330, change handler
4524-4530. Result: **passed**.

**Autonomous (gated) decisions taken this phase, recorded here:**
1. **`total_phases = 1`.** grill hinted 1; I confirmed it after sizing — the slice has one
   observable outcome (the default mode) and splitting would produce scaffolding-only,
   non-acceptance-testable sub-phases. My count is authoritative.
2. **PBT property declared (not N/A'd).** apply-docs item 4 left this open. A genuine
   universally-quantified property exists (∀ recognised t-shirt size, the active table on load
   is the empirical table, by value), so `pbt.enabled: true` is satisfied with a real property
   — no N/A escape hatch used. The carry-through sizes are the adversarial edge; the calibrated
   sizes keep it non-vacuous.
3. **Scoped mutation config set in this plan commit (pre-authorised by apply-docs item 3).**
   apply-docs explicitly delegated "set a realistic per-phase `min_score` … SHOULD use Stryker
   line-range `mutate`" to plan. I set `stryker.conf.json` `mutate` →
   `["index.html:1333", "index.html:4522-4531"]` (the changed initializer + the param-mode
   `change` handler) and `backlog.config.json` `mutation.min_score` → **70**. The empirical /
   synthetic **data tables are excluded** from `mutate`: their numeric-literal mutants are not
   killable by this phase's tests (the property reads `μ/σ` from the same table on both sides),
   so including them would only dilute the score. The scored mutants therefore come from the
   `change` handler (string/equality/conditional/ternary), which AT-1 + AT-3 exercise. 70%
   leaves headroom for a few equivalent/inline-script-boundary mutants while still pinning the
   toggle logic. These config edits are in the **plan** commit, which is *not* a
   `gate.protected_phase`, so it is not gate-judged; doing them here (not in implement) keeps
   the enforcement threshold out of the same commit that is mutation-scored — avoiding the
   "implement weakened the gate to go green" anti-pattern. **This is reversible** (not a
   one-way door): the ranges/threshold can be re-tuned by a later atdd/implement/review cycle.
   Implement MUST re-grep the two ranges before committing (edits are in-place so lines should
   not drift, but confirm) and adjust `stryker.conf.json` if they did.

**Heads-up carried forward for implement / the gate (not a blocker now):**
- `verify_command` chains `npm run scan:deps` (npm audit → registry) and `npx secretlint`. The
  gate's hermetic verify (sub-check b) runs **network-disabled**; if `npm audit --json` cannot
  reach the registry under that wrapper, `scripts/dep-scan.mjs` exits non-zero. This is inherent
  to the apply-docs toolchain decision (audit inside verify); flag it if the hermetic verify
  fails specifically on the dep-scan step (operator-side fix: pre-warm the audit cache or treat
  dep_scan as non-hermetic — neither the plan nor implement re-decides the toolchain).
- `npm audit` carries a documented accepted-exception allowlist (two pre-existing dev-server/UI
  -only advisories, GHSA-fx2h-pf6j-xcff / GHSA-5xrq-8626-4rwp); every other high/critical still
  fails. `eslint-plugin-security` has only `detect-object-injection` disabled (the canonical FP
  on `activeParams[size]` lookups).

**No one-way-door block:** the sole one-way door (the page-load default) is pre-decided by
ADR-0035, so no `blocked: one-way-door` was needed; the plan formalises it rather than
re-deciding it.

## Definition of done (for atdd)

Committed RED tests under `tests/acceptance/0022-*.test.js`: the acceptance scenarios
(AT-1..AT-4) and the per-size empirical-on-load fast-check property, each proven a **stable
FAIL** (5 reruns) on the base for the stated reason, with RED logs persisted under
`docs/atdd-logs/0022-empirical-lognormal-default-phase-1-*-red.log`; `index.md` advanced to
`stage: implement` with `next_handover: handover-NN-atdd-p1.md`. No `index.html` edits.
