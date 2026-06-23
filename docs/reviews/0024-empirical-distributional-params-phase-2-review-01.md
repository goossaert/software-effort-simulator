# Integrity review — 0024 Empirical (distributional) parameters mode — Phase 2

- **Plan:** `docs/plans/0024-empirical-distributional-params.md` (Phase 2 — UI + tri-state `change` handler)
- **Phase:** 2 of 2 (the last feature-phase)
- **Review run:** 01
- **Date:** 2026-06-23
- **Test commit (atdd p2):** `f9ceb3cebd76215160d1d8c8dbdaccbd04abcb04`
- **Implementation commit (implement p2):** `57876478564e78cd8a32589e7e5db8133c3b698b`
- **Diff range:** `f9ceb3c..5787647`
- **Reviewer model:** opus (integrity review — independent verification)

---

## Step 1 — Plan (Phase 2) extract

- **Behavioral rule:** the `param-mode` radio is a **tri-state selector**. Selecting
  `synthetic` / `empirical` / `empirical-distributional` binds `activeParams` to
  `T_SHIRT_PARAMS` / `T_SHIRT_PARAMS_EMPIRICAL` / `T_SHIRT_PARAMS_DISTRIBUTIONAL` and
  `activeSampler` to `sampleLognormal` (first two) or the residual sampler (third), and
  highlights exactly the selected label. Ephemeral (no persistence; reload → Empirical); never
  re-renders the reference panel.
- **Invariants (all `[test-only]`):** (i) exactly one `param-mode` label has `.active` at all
  times; (ii) no `localStorage`/URL key is written by any selection (AC-7); (iii) the reference-panel
  DOM is invariant across selection (ADR-0038 dec. 9). The plan explicitly states **no `[contract]`
  invariant** in this phase (the wiring has no cheap local per-call precondition; the Phase-1
  module-load assertion already guards sampler positivity).
- **Counterexamples (must NOT pass):** two labels `.active`, or `activeParams` set but
  `activeSampler` forgotten (new-mode Run draws no residual); writing a `param-mode`
  `localStorage` key, or making the new mode default-checked; re-rendering the reference panel;
  placing the new option before Empirical or changing the Empirical default.
- **Forbidden shortcuts:** persist to `localStorage`/URL; change which option is `checked` on
  load; re-render the reference panel; env-keyed/identity special-casing in the handler.
- **Expected observable outcomes:** third radio/label present, placed last; `.active`
  single-valued and follows selection across all three; default-checked stays Empirical;
  `activeParams`/`activeSampler` follow the selected mode; `localStorage` empty; reference-panel
  DOM byte-unchanged.
- **Proposed seams:** third `<label id="param-label-empirical-distributional">` with
  `<input … value="empirical-distributional">` after the Empirical label (Empirical keeps
  `checked`); extend the `change` handler to set `activeParams` + `activeSampler` across three
  modes and toggle `.active` on all three (exactly one). Control-flow (if/else vs map) explicitly
  **not** locked in — only the observable state is the contract.
- **PBT-4:** ∀ mode ∈ {synthetic, empirical, empirical-distributional}, dispatching `change`
  binds `activeParams` to the matching table **and** `activeSampler` to the matching function
  **and** leaves exactly one label `.active`. Generator `fc.constantFrom('synthetic','empirical',
  'empirical-distributional')`; adversarial = re-selecting the same mode + round-trip to empirical.
- **Oracle strategy:** class **(a)** — directly-assertable DOM/module state; `oracle_free` N/A.
- **Mutation:** N/A — `mutation.enabled: false` (ADR-0036; StrykerJS cannot scope to one inline
  `<script>` in a multi-`<script>` single-file HTML).

## Step 2 — Implementation diff (read before the tests)

`git diff f9ceb3c..5787647` touches exactly one production file, `index.html` (+20/-4); the rest
of the diff is this phase's verification logs (`docs/atdd-logs/…-phase-2-*.log`), the implement
handover, and the `index.md` advance. Two production hunks:

1. **Radio markup** (`#param-mode-options`, after the Empirical `<label>`): a third
   `<label id="param-label-empirical-distributional">` wrapping
   `<input type="radio" name="param-mode" value="empirical-distributional">` (no `checked`), label
   text "Empirical (distributional) lognormal parameters" + a `param-mode-note`. Empirical keeps
   `checked`.
2. **`change` handler**: replaced the binary `activeParams = radio.value === 'empirical' ? … : …`
   with an `if / else if / else` on `radio.value` binding **both** `activeParams` **and**
   `activeSampler` per mode — `empirical`→`{EMPIRICAL, sampleLognormal}`,
   `empirical-distributional`→`{DISTRIBUTIONAL, sampleLognormalWithResidual}`, else (synthetic)→
   `{T_SHIRT_PARAMS, sampleLognormal}` — plus a third `.classList.toggle('active', …)` for the new
   label.

**Initial assessment (from plan + diff, before reading the tests):**
1. **General rule, not keyed on fixtures?** General. The handler switches on the domain value
   `radio.value` and assigns module references; no literal magic numbers, no fixture strings. The
   three value strings (`synthetic`/`empirical`/`empirical-distributional`) are the **DC-1
   externally-visible contract**, not test-only identifiers.
2. **Every changed line maps to the rule?** Yes — markup adds the contracted option; the handler
   adds the third binding arm + the third highlight toggle; nothing extraneous.
3. **Suspicious constructs?** None — no `NODE_ENV`/`process.env`, no `if (id === …)` identity
   branch, no hard-coded numerics, no import from test paths.

## Step 3 — Test-gaming scan

- **Hard-coded fixture values:** none. References are production symbols (`T_SHIRT_PARAMS*`,
  `sampleLognormal`, `sampleLognormalWithResidual`); the value strings are the DC-1 contract.
- **Conditionals on test-only identifiers:** none.
- **Skipped/deleted tests:** none. `git diff f9ceb3c..5787647 -- tests features e2e acceptance`
  is **empty** — no test file changed between the test and impl commits.
- **Weakened assertions:** none (no test changes).
- **Production imports from test helpers:** none in the diff.
- **Environment checks in production:** none.
- **Excessive/incorrect mocking; tautological/internal-state assertions:** N/A — the suite drives
  the real loaded `index.html` via jsdom (`loadSimulator()`) and asserts on observable DOM +
  module references read by value from the window, not on mocks or private fields.
- **Patched runners / gate configs / thresholds:** none.
  `git diff f9ceb3c..5787647 -- '*.config.*' '*.json' '.eslintrc*' '.nycrc*' 'tsconfig*'
  '.ast-grep/*' package.json` is **empty**. No coverage/timeout/exclusion/severity change; no
  blanket suppression (`@ts-nocheck`/`eslint-disable`/`# noqa`/`// nolint`) added.
- **Stale/pre-generated artifacts:** the only `.log` files are this phase's verification logs
  under `docs/atdd-logs/` (lint/sast/dep-scan/secret-scan/typecheck/sanitizer), produced by the
  implement session; no fabricated test-result file claiming green.
- **Changed fixtures/factories/seeds:** none.

**Result: no gaming patterns found.**

## Step 4 — Tests (read after forming the Step-2 view)

Committed at the test commit:
- `tests/acceptance/0024-phase-2-radio-wiring.test.js` (10 tests, AT-1..AT-3)
- `tests/acceptance/0024-phase-2-mode-toggle-property.test.js` (PBT-4, `@fast-check/vitest`
  `test.prop`)

Coverage vs the plan:
- **AT-1** (present, labelled, last; Empirical stays checked) — three tests: existence + `name` +
  label text "Empirical (distributional)"; DOM order `['synthetic','empirical',
  'empirical-distributional']`; default-checked = empirical, others unchecked. ✓
- **AT-2** (swap table + sampler + highlight; round-trip) — four tests: new mode binds
  `activeParams===DISTRIBUTIONAL`, `activeSampler===sampleLognormalWithResidual`, single `.active`;
  a **seeded behavioral** check that `activeSampler('M') === sampleLognormal('M') ×
  bootstrapChoice(RATIO_RESIDUALS)` and `> 0` (proves the residual binding takes effect, not just
  reference identity); re-selecting Empirical restores `{EMPIRICAL, sampleLognormal}` + highlight;
  selecting Synthetic from the new mode clears the residual sampler (`activeSampler` back to
  `sampleLognormal`, explicitly `not.toBe(sampleLognormalWithResidual)`). ✓
- **AT-3** (ephemeral + reference panel untouched) — three tests: a fresh `loadSimulator()`
  defaults to Empirical even after a prior window selected the new mode; no selection across all
  three writes `localStorage` (length 0, no `param-mode` key); the `.size-table` reference panel
  `outerHTML` is byte-identical after selecting the new mode. ✓
- **All four counterexamples** are covered: forgotten `activeSampler` → AT-2 (line 94 + the
  behavioral residual check) + PBT-4; two labels active → AT-2 single-active + PBT-4 loop;
  `localStorage` write / new-mode default → AT-3 + AT-1; reference-panel re-render → AT-3; option
  ordering / Empirical default → AT-1.
- **PBT-4** — present as a `test.prop` over `fc.constantFrom(...MODES)`, asserting the matching
  table **and** sampler (read by reference from the window, not hand-rolled) **and** exactly-one-
  `.active` across all three labels each run; adversarial re-selection / round-trip covered by the
  generator revisiting values on the shared window. Meets the PBT structural floor (gate (f):
  `pbt.import_symbol` = `fc.property|test.prop|it.prop`).
- **External-source mirroring:** N/A this phase (no external source; the frozen-calibration parity
  lives in Phase 1).
- **Oracle-free coverage:** plan marks class (a); `oracle_free` N/A — nothing required.

Could the implementation pass every visible test yet still violate a counterexample? No — the
behavioral residual check (AT-2) and the by-reference sampler assertion (AT-2 + PBT-4) close the
"set the table but forget the sampler" gap; the `outerHTML` and `localStorage`-length assertions
close the panel/persistence gaps; the order + default-checked assertions close the placement gap.
**No coverage gap found.**

## Step 5 — Invariants vs implementation

```
Invariant: Exactly one param-mode label has .active at all times
Enforcement: [test-only]
Status: SATISFIED
Contract: N/A (test-only)
Evidence: handler toggles .active on all three labels with `radio.value === '<mode>'`, so exactly
  the selected one is true; verified by AT-2 (single-active) + PBT-4 (all-three loop).

Invariant: No localStorage/URL key written by any selection (AC-7)
Enforcement: [test-only]
Status: SATISFIED
Contract: N/A (test-only)
Evidence: handler body assigns module refs + toggles classes only; no storage/URL write in the
  diff; AT-3 asserts localStorage length 0 and no `param-mode` key across all three selections.

Invariant: Reference-panel DOM invariant across selection (ADR-0038 dec. 9)
Enforcement: [test-only]
Status: SATISFIED
Contract: N/A (test-only)
Evidence: handler never touches the `.size-table`/`<details>` panel; AT-3 asserts `.size-table`
  outerHTML byte-identical after selecting the new mode.
```

No `[contract]` invariant in this phase (plan-stated) ⇒ no runtime assertion required; the
`contract.enabled: false` gate sub-check (g) is skipped by design. The Phase-1 module-load
`[contract]` (I-4, `RATIO_RESIDUALS` positivity) remains live in the base and unaffected.

## Step 6 — Negative control (hand-picked mutation)

Target: the most important Phase-2 rule — the new mode binds the **residual** sampler.

1. **Mutation** (`index.html`, the `empirical-distributional` arm):
   `activeSampler = sampleLognormalWithResidual;` → `activeSampler = sampleLognormal;`
2. **Run** `npx vitest run tests/acceptance/0024-phase-2-radio-wiring.test.js
   tests/acceptance/0024-phase-2-mode-toggle-property.test.js` → **exit 1**, **3 failed | 8 passed**:
   - PBT-4 (`activeSampler` ≠ matching sampler) — shrunk counterexample `["empirical-distributional"]`;
   - AT-2 "binds … activeSampler to the residual sampler …" (reference mismatch);
   - AT-2 "makes a seeded sample multiply … by a bootstrapped residual" (`2.4232837…` ≠
     `1.7818405…` = lognormal-only vs lognormal×residual).
3. **Confirmed** the suite catches the deliberate bug.
4. **Revert** `git checkout -- index.html` (tree clean).
5. **Re-run** → **exit 0**, **11 passed**.

**Negative control: PASS.** (No `[contract]` invariant this phase ⇒ no contract-firing variant
required; the chosen mutation exercises the phase's core behavioral rule.)

## Step 7 — Mutation testing (scored gate)

**N/A — `mutation.enabled: false`** (ADR-0036; recorded N/A in `backlog.config.json`
`toolchain.layers.mutation.status: "n/a"` and the plan DoD). This is a recorded N/A, not an
unconfigured business-logic phase, so the phase is **not** blocked. Phase 2 is UI wiring (no
numeric business logic). Adequacy is carried by the tri-state PBT-4, the bidirectional toggle
regression (AT-2), and the ast-grep forbidden-pattern negative control in `npm run verify`.

## Step 8 — Additional verification tests

None written — Steps 4–5 found no missing case, edge case, or invariant gap, and the negative
control confirms the committed suite detects the core-rule mutation. No production code touched.

## Step 10 — Verdict

```
Phase 2 review verdict: PASS

Test gaming patterns found: none
Invariant gaps: none
Missing test coverage: none
Additional verification tests written: none
Negative control result: PASS
Mutation score (scoped): N/A (mutation.enabled=false; ADR-0036)
Surviving mutants: none (mutation N/A)

Overall: The Phase-2 implementation is a clean, minimal, general tri-state wiring of the
`param-mode` radio — a third `value="empirical-distributional"` option placed last (Empirical
keeps `checked`) and a `change` handler that binds both `activeParams` and `activeSampler` per
mode and toggles exactly one `.active` label. The only production file changed is `index.html`;
no test file changed between the test and impl commits; no test-gaming pattern, no production
import from tests, no env/identity branch, no config/threshold patch, no blanket suppression. The
committed suite covers AT-1..AT-3, all four plan counterexamples, and PBT-4 (table + sampler + single
highlight, with adversarial re-selection/round-trip), with a seeded behavioral check that proves
the residual binding actually takes effect rather than only matching a reference. All three
Phase-2 invariants are `[test-only]` and SATISFIED; the plan declares no `[contract]` invariant
here, so no runtime assertion is required (contract floor skipped by config). The hand-picked
negative control — dropping the residual sampler binding — fails 3 tests (exit 1) and green is
restored on revert. Mutation is a recorded N/A (ADR-0036). Integrity review is clean; the phase
hands off to /stage-review-correctness p2.
```

Review file: `docs/reviews/0024-empirical-distributional-params-phase-2-review-01.md`.

On PASS, the integrity review is complete but the feature-phase is not: the next step is a fresh
correctness review (`/stage-review-correctness` p2), which reasons from the spec rather than the
tests. The phase is complete only once that review also PASSes, and it owns the advance to `done`
(this is the last feature-phase).
