---
schema: backlog-handover/v1
task_id: "0022"
produced_by_phase: atdd
feature_phase: 1
for_next_phase: implement
outcome: success
reason: ""
produced_at: 2026-06-21T16:02:35Z
produced_commit: 3f40138bd540a9a8613b6cf66601976ac27d9ab0
---

## Summary

Wrote the Phase-1 RED test set for "Default to the Empirical lognormal parameters on page-load"
and proved it a **stable FAIL** (5 reruns) on the unmodified base (`3f40138`, which still defaults
to **Synthetic parameters**). Two files, both prefixed `0022-`:
`tests/acceptance/0022-empirical-default-on-load.test.js` (AT-1, AT-2, AT-4) and
`tests/acceptance/0022-empirical-default-params-property.test.js` (the per-Recognised-t-shirt-size
fast-check **property** + AT-3 the bidirectional-toggle regression guard + happy/boundary/negative
examples). Acceptance command exits 1 (3 failed); property command exits 1 (3 failed | 2 passed)
with a shrunk counterexample that is always a calibrated size {XS,S,M,L}. **No `index.html` edits.**
`index.md` advanced to `stage: implement`, `next_handover: handover-04-atdd-p1.md`.

## Instructions for the next phase (implement)

1. **Make the RED tests GREEN by flipping the page-load default — production only.** The complete
   edit set is the plan's "Relevant existing files" list (re-grep first; edits are in-place):
   - `index.html:952` `<label id="param-label-synthetic" class="active">` → **remove** `class="active"`.
   - `index.html:953` `<input … value="synthetic" checked>` → **remove** `checked`.
   - `index.html:956` `<label id="param-label-empirical">` → **add** `class="active"`.
   - `index.html:957` `<input … value="empirical">` → **add** `checked`.
   - `index.html:1332` comment `// … default: synthetic` → `… default: empirical`.
   - `index.html:1333` `let activeParams = T_SHIRT_PARAMS;` → `let activeParams = T_SHIRT_PARAMS_EMPIRICAL;`.
   - `index.html:4524-4530` the `change` handler is **unchanged** (AT-3 must pass through the real,
     unmodified handler — do not touch its swap logic).
   I confirmed all six sites at exactly these lines this session (the plan's line numbers are
   accurate; CONTEXT.md's `index.html:1264/1253-1261/3293-3300` references are stale prose and do
   **not** reflect the file — trust the plan + a fresh grep, not CONTEXT.md's numbers).
2. **Do NOT edit any `tests/**` file.** The test commit is frozen (test-immutability rule). A
   surviving mutant or a coverage gap is closed by re-running atdd, never by editing these tests.
3. **Re-grep the mutation ranges before committing.** The plan scoped Stryker `mutate` to
   `["index.html:1333", "index.html:4522-4531"]`. The initializer is line 1333 and the `change`
   handler is 4524-4530 (inside 4522-4531) on the base — both still correct, edits are in-place so
   they should not drift, but confirm and fix `stryker.conf.json` if they did.
4. **Run the full hermetic `npm run verify`** before writing `outcome: success` (see the dep-scan
   heads-up below).

## Files the next phase MUST read

- `docs/plans/0022-empirical-lognormal-default.md` — the Phase-1 behavioral rule, AT-1..AT-4, the
  PBT property + generator domain, oracle class (a), counterexamples, forbidden shortcuts, RED
  gate, and the scoped-mutation DoD (≥70% on the param-mode region).
- `tests/acceptance/0022-empirical-default-on-load.test.js` — AT-1/AT-2/AT-4; the new-default
  assertions implement must satisfy.
- `tests/acceptance/0022-empirical-default-params-property.test.js` — the per-size property + AT-3
  + examples.
- `docs/atdd-logs/0022-empirical-lognormal-default-phase-1-acceptance-red.log` — acceptance RED
  command + output (exit 1).
- `docs/atdd-logs/0022-empirical-lognormal-default-phase-1-inner-red.log` — property RED command +
  output + `shrunk_counterexample`.
- `docs/atdd-logs/0022-empirical-lognormal-default-phase-1-flakiness.log` — proves the RED is
  **stable** across 5 reruns (acceptance 5/5 FAIL, inner 5/5 FAIL).
- `CONTEXT.md` — glossary: **Synthetic parameters**, **Empirical parameters**, **Recognised
  t-shirt size** (the line-number prose in these entries is stale; the definitions are current).
- `docs/adr/0035-default-to-empirical-lognormal-parameters.md` — the page-load-default decision
  (the one-way door; do not re-decide).
- `docs/adr/0026-empirical-lognormal-parameters-mode-toggle.md` — superseded **in part**; its
  ephemeral / no-persistence decision still constrains (AT-4).

## Context the next phase needs

**Boot smoke (mandatory):** `smoke_command` is empty (logged no-op per LOOP-MODE). As the cheapest
structural check, I loaded the base `index.html` through the JSDOM harness and confirmed it boots
and defaults to **synthetic** (`empirical.checked=false`, `synthetic.checked=true`,
`activeParams===T_SHIRT_PARAMS`, `localStorage.length=0`, empirical keys = the 7 Recognised t-shirt
sizes). Result: **passed** — clean GREEN base, no repair needed.

**Test commit SHA (for implement's diff):** derive via
`git log -1 --format=%H -- docs/backlog/0022-empirical-lognormal-default/handover-04-atdd-p1.md`
(this commit). The reviews' `test_commit..impl_commit` diff anchors on it.

**Autonomously-taken (gated) decisions, recorded here:**
1. **Seam choice (Step 4 pause, no user).** Targeted only stable, plan-named seams — **never**
   private helpers: (a) the **DOM seams** `input[name="param-mode"][value="…"]` radios and the
   `#param-label-synthetic` / `#param-label-empirical` labels + their `.active` class; (b) the
   **module bindings** `activeParams`, `T_SHIRT_PARAMS`, `T_SHIRT_PARAMS_EMPIRICAL`, read via the
   harness `read(win, …)`; (c) the **page-load entry point** `loadSimulator()` and the radio
   `change` event (`dispatchEvent(new win.Event('change', {bubbles:true}))`). I did **not** lock in
   the change handler's internal structure, sampler internals, or any incidental helper name — the
   plan's "Do NOT lock in" list. These are stable domain/application seams (the radio group + the
   `activeParams` reference are the documented contract surfaces in CONTEXT.md and ADR-0026/0035),
   not incidental.
2. **PBT property written, not N/A'd** (`pbt.enabled: true`, framework `fast-check` via
   `@fast-check/vitest` `test.prop`, `import_symbol` = `fc.property|test.prop|it.prop` — the gate's
   (f) floor will grep and find `test.prop` + `fc.constantFrom`). The generator domain is read
   **from the loaded window** (`Object.keys(read(win,'T_SHIRT_PARAMS_EMPIRICAL'))`) — not
   hand-listed — so the property tracks the table, not a fixture copy. Shrinking left ON (default).
3. **AT-3 placed in the property file** (per the plan handover's "place AT-3 wherever it reads
   best"): it shares the radio/label DOM vocabulary with the property's seam.
4. **Acceptance & inner are split per the plan's two named commands** so gate sub-check (c) re-runs
   each verbatim.

**Stable-RED note (important for the gate's (c) re-check):** the property command is RED on **every**
run (exit 1, always 3 failed | 2 passed), but the *shrunk counterexample varies* across runs
(observed L / M / S over the 5 reruns) because the fast-check seed is **unpinned** by design. This
is **not** flakiness in the outcome: the FAIL and the exit code are invariant, and the
counterexample is **always** a calibrated size {XS, S, M, L} (never a carry-through size, never a
pass) — the synthetic-base μ differs from the empirical μ only for the calibrated sizes, which is
exactly what makes the property non-vacuous. The carry-through sizes 2XS/XL/XL+ and AT-3 are the 2
passing tests on the base every run. I deliberately did **not** pin a seed: a stable *outcome*
(always RED for the same reason) is what the immutability/RED gate requires, and an unpinned
generator keeps the property's coverage of the whole calibrated subset. Gate (c) only requires a
non-zero exit on each re-run, which holds 5/5.

**Heads-up carried forward for implement / the gate (from the plan handover; not a blocker now):**
- `verify_command` chains `npm run scan:deps` (npm audit → registry) and `npx secretlint`. The
  gate's hermetic verify (sub-check b) runs **network-disabled**; if `npm audit --json` cannot
  reach the registry under that wrapper, `scripts/dep-scan.mjs` exits non-zero. Flag it only if the
  hermetic verify fails specifically on the dep-scan step (operator-side: pre-warm the audit cache
  or treat dep_scan as non-hermetic — neither implement nor the gate re-decides the toolchain).
- `npm audit` carries a documented accepted-exception allowlist for two pre-existing
  dev-server/UI-only advisories (GHSA-fx2h-pf6j-xcff / GHSA-5xrq-8626-4rwp); every other
  high/critical still fails.

**No one-way-door block:** the sole one-way door (the page-load default) is pre-decided by
ADR-0035; the tests formalise it rather than re-deciding it.

## Definition of done (for implement)

Production-only edits to `index.html` flip the page-load default to **Empirical parameters** (the
six sites above) so the committed Phase-1 tests pass: AT-1 (empirical radio `checked` + label
`.active`, synthetic neither), AT-2 (`activeParams === T_SHIRT_PARAMS_EMPIRICAL`), AT-3 (toggle
swaps both ways through the unmodified handler), AT-4 (fresh load resets to empirical, nothing
persisted), and the per-size property (every Recognised t-shirt size resolves to the empirical
`(μ, σ)` by value). `npm run verify` GREEN under the hermetic verify; scoped mutation ≥ 70% on the
param-mode region; **no `tests/**` edits**. Advance `stage: review`,
`next_handover: handover-NN-implement-p1.md`.
