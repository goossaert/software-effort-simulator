---
schema: backlog-handover/v1
task_id: "0024"
produced_by_phase: atdd
feature_phase: 2
for_next_phase: implement
outcome: success
reason: ""
produced_at: 2026-06-23T07:02:12Z
produced_commit: 851045d946e504013e81c82ffc092dd7fe372095
---
## Summary

atdd for **Phase 2** (UI + tri-state `change` handler) wrote two committed test files and
confirmed a **stable RED** on the current base (HEAD `851045d`, post-Phase-1) across the
configured 5 reruns (`test_immutability.flakiness_reruns`), both commands exiting non-zero for
the stated reason — the third `empirical-distributional` radio + the
`param-label-empirical-distributional` label do not exist, and the base `change` handler maps
only `empirical`↔`synthetic` and never assigns `activeSampler`:

- `tests/acceptance/0024-phase-2-radio-wiring.test.js` — AT-1..AT-3 (acceptance), **10 tests,
  10 failed** every run (new-option radio/label resolve to `null`; presence/order/default,
  selection, ephemerality + reference-panel all fail).
- `tests/acceptance/0024-phase-2-mode-toggle-property.test.js` — PBT-4 (fast-check `test.prop`),
  **1 test, 1 failed** every run with a stable shrunk counterexample `["synthetic"]` (the
  tri-state "exactly one of THREE labels `.active`" check reads `null.classList` for the missing
  third label).

**Satisfiability proven (anti-unsatisfiable check):** I applied a throwaway Phase-2
implementation to `index.html` (the third radio/label placed last + the tri-state handler that
sets `activeParams` + `activeSampler` across three modes and toggles three labels), ran both
commands plus the full suite (**10/10 + 1/1 green; whole suite 275 passed, 1 pre-existing skip**),
then fully reverted `index.html` (`git checkout`). The commit contains **only** the two test
files, the three RED logs, the index advance, and this handover — **no production code**.

## Instructions for the next phase (implement p2)

Implement the Phase-2 UI slice in `index.html` so both committed commands go green, **without
editing any file under `tests/**`**. The tests pin these seams (the only contract is the
observable DOM/module state — value→table, value→sampler, single `.active`, ephemerality,
reference-panel invariance):

1. **Third radio + label, placed LAST.** Add, immediately after the Empirical `<label>`
   (`index.html:959`, inside `#param-mode-options`), a third option:
   ```html
   <label id="param-label-empirical-distributional">
     <input type="radio" name="param-mode" value="empirical-distributional">
     <span>Empirical (distributional) lognormal parameters<br><span class="param-mode-note">…</span></span>
   </label>
   ```
   - The radio `value` MUST be exactly `empirical-distributional` (test contract, DC-1).
   - The label element id MUST be exactly `param-label-empirical-distributional` (PBT-4 + AT-2
     read `param-label-${mode}`).
   - The label's visible text MUST contain the substring **"Empirical (distributional)"** (AT-1).
   - It MUST be the **last** `input[name="param-mode"]` in `#param-mode-options`
     (`['synthetic','empirical','empirical-distributional']`, AT-1) and Empirical MUST keep its
     `checked` attribute (DC-4 / AT-1 / AT-3). Do **not** add `checked` to the new option.
2. **Tri-state `change` handler** (`index.html:4705–4711`). Extend the existing per-radio
   `change` listener to bind BOTH module references across three modes and toggle three labels —
   exactly one `.active`:
   ```js
   if (radio.value === 'empirical') { activeParams = T_SHIRT_PARAMS_EMPIRICAL; activeSampler = sampleLognormal; }
   else if (radio.value === 'empirical-distributional') { activeParams = T_SHIRT_PARAMS_DISTRIBUTIONAL; activeSampler = sampleLognormalWithResidual; }
   else { activeParams = T_SHIRT_PARAMS; activeSampler = sampleLognormal; }
   // then .classList.toggle('active', radio.value === <value>) for all THREE param-label-* ids
   ```
   - The handler MUST reassign `activeSampler` for **every** mode (back to `sampleLognormal` for
     synthetic/empirical — AT-2's "clears the residual sampler" + round-trip, PBT-4). The base
     handler did **not** touch `activeSampler` at all; that is the Phase-2 gap.
   - It MUST set `activeSampler = sampleLognormalWithResidual` (the Phase-1 function) only for the
     new mode (DC-2 isolation — the residual draw stays inside the new-mode sampler).
3. **Do NOT** write `localStorage`/URL (ephemeral — AC-7/DC-4; AT-3 asserts `localStorage.length
   === 0` and no `param-mode` key after all three selections) and **do NOT** re-render or mutate
   the **T-shirt size reference** `<details>` panel (`index.html:971–991`; ADR-0038 dec. 9 —
   AT-3 asserts the `.size-table` `outerHTML` is byte-unchanged after selecting the new mode).
4. **Do NOT** touch the Phase-1 engine (constants, `sampleLognormalWithResidual`, the hot-loop
   swap) or the Synthetic/Empirical sampling paths. This phase is markup + handler only.

The verify is `npm run verify` (lint + ast-grep forbidden-scan + dep-scan + secretlint +
`vitest run`), run hermetically (network-disabled, lockfile-pinned) — see DoD.

## Files the next phase MUST read

- `docs/plans/0024-empirical-distributional-params.md` — **Phase 2** slice: behavioral rule,
  AT-1..AT-3, invariants, PBT-4, counterexamples, forbidden shortcuts, RED gate, DoD. Primary input.
- `tests/acceptance/0024-phase-2-radio-wiring.test.js` — the frozen acceptance contract
  (AT-1..AT-3); read its header for the RED reasons and the DOM/seam selectors it pins.
- `tests/acceptance/0024-phase-2-mode-toggle-property.test.js` — the frozen PBT-4 contract
  (the mode→table / mode→sampler / mode→label maps it asserts).
- `docs/atdd-logs/0024-empirical-distributional-params-phase-2-acceptance-red.log` and
  `…-inner-red.log` — the exact RED commands (the gate re-runs the `command:` headers) + full output.
- `docs/atdd-logs/0024-empirical-distributional-params-phase-2-flakiness.log` — proves the RED is
  stable across 5 reruns.
- `CONTEXT.md` — glossary: **Empirical (distributional) parameters** (the
  `value="empirical-distributional"` contract + ephemerality), **Synthetic parameters**,
  **Empirical parameters**, **T-shirt size reference** (panel never re-renders).
- `docs/adr/0038-empirical-distributional-parameters-mode.md` — decisions 1 (third additive mode),
  7 (PRNG isolation), 9 (reference panel unchanged).
- `docs/adr/0026-…md` (two-table / `activeParams` / ephemeral toggle) and `docs/adr/0035-…md`
  (Empirical is the page-load default — must stay).
- `index.html` anchors (HEAD `851045d`): `#param-mode-options` radio markup **949–961**
  (`param-label-synthetic` 952, `param-label-empirical` 956, Empirical `checked` 957); the
  **T-shirt size reference** `<details>` panel (with `.size-table`) **971–991**; the param-mode
  `change` handler **4705–4711**. Phase-1 engine anchors (unchanged this phase):
  `T_SHIRT_PARAMS_DISTRIBUTIONAL`/`RATIO_RESIDUALS` ≈1347–1372, `activeSampler` + the new sampler
  near `activeParams`/`sampleLognormal`.

## Context the next phase needs

- **total_phases = 2, current_phase = 2.** This is the LAST feature-phase. Pipeline: implement p2
  → review p2 → review-correctness p2, then the task is **done** (`review-correctness` p2 PASS sets
  `stage: done`, `status: done`).
- **Boot smoke:** `smoke_command` empty in `backlog.config.json` ⇒ logged no-op. Base health was
  confirmed directly: `index.html` loads under the jsdom harness and the committed Phase-1 suite is
  green (14/14). **Result: passed** (no build/boot step; single-file HTML).
- **Autonomous seam decisions (Loop mode — no user; recorded here per the contract).** All
  reversible; they only constrain how the frozen tests are satisfied:
  - **S3 — the new label's element id is pinned to `param-label-empirical-distributional`.** The
    plan named this id in its *Proposed implementation seams*; PBT-4 and AT-2 read
    `param-label-${value}`, so the id MUST be the value prefixed by `param-label-`. (Consistent
    with the existing `param-label-synthetic` / `param-label-empirical` convention.)
  - **S4 — the handler MUST reassign `activeSampler` on every mode** (not only the new one). AT-2's
    "clears the residual sampler when Synthetic is selected" + the round-trip + PBT-4 require
    synthetic/empirical to bind `activeSampler === sampleLognormal` after a selection, so the
    handler cannot leave `activeSampler` untouched for those two modes. This does not change
    Synthetic/Empirical *sampled values* (the default already is `sampleLognormal`; reassigning it
    to the same function is a no-op for their draw sequence — DC-2 still holds).
  - **S5 — AT-3 pins the reference-panel invariance to the `.size-table` element's `outerHTML`**
    (the table inside the `<details>` panel). The implementation must not re-render/replace that
    table on selection.
- **The new-option contract values are exact strings:** radio `value="empirical-distributional"`,
  label id `param-label-empirical-distributional`, visible text contains `Empirical
  (distributional)`. Changing any of these breaks the frozen tests (which may not be edited).
- **Determinism:** the only sampling sub-assertion (AT-2 "makes a seeded sample multiply…") does
  `rng = new Xoshiro128ss(424242); resetBoxMuller();` immediately before drawing and calls the
  samplers directly; all other assertions are DOM/reference-identity (no RNG). PBT-4 is fully
  deterministic. The property file uses one shared window and re-establishes state each run.
- **Mutation N/A** (`mutation.enabled: false`, layer recorded N/A; ADR-0036). **PBT** = fast-check;
  Phase 2 declares **PBT-4** (parametric) and it is committed as a `test.prop`, satisfying the
  gate's (f) PBT floor. **oracle_free** N/A (oracle class (a); `oracle_free.enabled: false`).
  **contract** floor N/A (no `[contract]` invariant in Phase 2; `contract.enabled: false`).
- **Test commit SHA derivation** (for review/implement):
  `git log -1 --format=%H -- docs/backlog/0024-empirical-distributional-params/handover-09-atdd-p2.md`.

## Definition of done (for implement p2)

- Both committed Phase-2 commands pass:
  `npx vitest run tests/acceptance/0024-phase-2-radio-wiring.test.js` (10/10) and
  `npx vitest run tests/acceptance/0024-phase-2-mode-toggle-property.test.js` (1/1), on every
  rerun and in randomized order (stable green).
- `npm run verify` passes under a hermetic, network-disabled, lockfile-pinned checkout with no
  `correctness_gate` layer disabled/downgraded (typecheck N/A; lint; SAST; sanitizer N/A; dep-scan;
  secret-scan; ast-grep forbidden-pattern all pass).
- The implement commit stages **no** file under `tests/**` (gate sub-check (a)); the only
  production file changed is `index.html`.
- Mutation: **N/A** (ADR-0036). Adequacy is carried by the tri-state PBT-4, the bidirectional
  toggle regression (AT-2), and the ast-grep forbidden-pattern negative control.
