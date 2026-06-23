---
schema: backlog-handover/v1
task_id: "0024"
produced_by_phase: implement
feature_phase: 2
for_next_phase: review
outcome: success
reason: ""
produced_at: 2026-06-23T09:10:00Z
produced_commit: f9ceb3cebd76215160d1d8c8dbdaccbd04abcb04
test_commit: f9ceb3cebd76215160d1d8c8dbdaccbd04abcb04
---
## Summary

Implemented the **Phase 2** UI slice in `index.html` only — the third
`empirical-distributional` radio (placed last, beside Synthetic and Empirical) and the
tri-state `param-mode` `change` handler that binds **both** `activeParams` **and**
`activeSampler` per mode and toggles exactly one `.active` label. Both committed Phase-2
commands now pass (`0024-phase-2-radio-wiring.test.js` **10/10**,
`0024-phase-2-mode-toggle-property.test.js` **1/1**), **stable green** across the configured
3 default reruns + 1 randomized-order run each (all exit 0). `npm run verify` exits 0
(**275 passed, 1 pre-existing skip**) in the working tree **and** under a hermetic,
network-disabled (`npm ci --offline`), lockfile-pinned fresh worktree of the staged tree. No
`tests/**` drift; the only production file changed is `index.html`. The Phase-1 engine
(constants, `sampleLognormalWithResidual`, the hot-loop swap) was **not** touched.

## What changed (general rule each change implements)

- `index.html` (radio markup, `#param-mode-options`, after the Empirical `<label>`) — implements
  AC-1/DC-1/DC-4: the **Lognormal Parameters** group offers the new
  `value="empirical-distributional"` option **last**, with label id
  `param-label-empirical-distributional` and visible text containing
  **"Empirical (distributional)"**; **Empirical keeps `checked`** (the new option is unchecked,
  no `checked` added, default unchanged).
- `index.html` (the `param-mode` `change` handler) — implements the Phase-2 behavioral rule: the
  radio is a **tri-state selector**. `synthetic`→`{T_SHIRT_PARAMS, sampleLognormal}`,
  `empirical`→`{T_SHIRT_PARAMS_EMPIRICAL, sampleLognormal}`,
  `empirical-distributional`→`{T_SHIRT_PARAMS_DISTRIBUTIONAL, sampleLognormalWithResidual}`, and
  exactly the selected label gets `.active` (the other two cleared). The handler reassigns
  `activeSampler` for **every** mode (restoring `sampleLognormal` for synthetic/empirical), so the
  residual sampler is bound **only** in the new mode (DC-2) and round-tripping back to a
  pre-existing mode clears it. It writes no `localStorage`/URL and never re-renders the
  **T-shirt size reference** panel.

## Verification

- Inner tests (committed commands), **stable green**:
  - `npx vitest run tests/acceptance/0024-phase-2-radio-wiring.test.js` → exit 0, **10/10**
    (3 default reruns + 1 `--sequence.shuffle` run, all 10/10).
  - `npx vitest run tests/acceptance/0024-phase-2-mode-toggle-property.test.js` → exit 0, **1/1**
    (3 default reruns + 1 `--sequence.shuffle` run, all 1/1).
- `npm run verify` (working tree) → **exit 0** — 275 passed, 1 skipped (pre-existing). Layers:
  lint exit 0, `scan:forbidden` (ast-grep) exit 0, `scan:deps` exit 0, secretlint exit 0,
  vitest exit 0. Full log: `.agent/last-verify.log`.
- **Hermetic verify** (fresh `git worktree` of the exact staged tree, `npm ci --offline`
  lockfile-pinned, network not used) → **`npm run verify` exit 0** (275 passed, 1 skipped).
- Per-correctness-gate-layer logs persisted under `docs/atdd-logs/`:
  - `…-phase-2-typecheck.log` — **N/A** (vanilla JS).
  - `…-phase-2-lint.log` — exit 0 (`eslint index.html --max-warnings 0`).
  - `…-phase-2-sast.log` — exit 0 (eslint-plugin-security folded into the same eslint flat
    config; `sast_command == lint_command`).
  - `…-phase-2-sanitizer.log` — **N/A** (managed/interpreted language).
  - `…-phase-2-dep-scan.log` — exit 0 (`npm run scan:deps`).
  - `…-phase-2-secret-scan.log` — exit 0 (`npx secretlint "**/*"`).
- No correctness layer disabled, downgraded, scope-narrowed, or suppressed; no blanket
  suppression tokens added.

## Files the next phase (review p2) MUST read

- `docs/plans/0024-empirical-distributional-params.md` — **Phase 2** slice: behavioral rule,
  AT-1..AT-3, invariants, PBT-4, counterexamples, forbidden shortcuts, DoD. Primary input.
- `tests/acceptance/0024-phase-2-radio-wiring.test.js` — the frozen acceptance contract
  (AT-1..AT-3); DOM/seam selectors it pins.
- `tests/acceptance/0024-phase-2-mode-toggle-property.test.js` — the frozen PBT-4 contract
  (mode→table / mode→sampler / mode→label maps).
- `index.html` — the Phase-2 diff: `#param-mode-options` (new third label/radio) + the tri-state
  `change` handler.
- `docs/adr/0038-empirical-distributional-parameters-mode.md` — decisions 1 (third additive
  mode), 7 (PRNG isolation), 9 (reference panel unchanged); `docs/adr/0035-…md` (Empirical is
  the page-load default).
- `CONTEXT.md` — glossary (Empirical (distributional) parameters; T-shirt size reference panel).

## Diff range for review (derive from git log)

- Test commit: `git log -1 --format=%H -- docs/backlog/0024-empirical-distributional-params/handover-09-atdd-p2.md`
  → `f9ceb3cebd76215160d1d8c8dbdaccbd04abcb04`.
- Impl commit: `git log -1 --format=%H -- docs/backlog/0024-empirical-distributional-params/handover-10-implement-p2.md`
  (this commit). Review diffs `test_commit..impl_commit`.

## Context the next phase needs

- **total_phases = 2, current_phase = 2** — this is the LAST feature-phase. Pipeline:
  review p2 → review-correctness p2, then the task is **done** (review-correctness p2 PASS sets
  `stage: done`, `status: done`).
- **Boot smoke:** `smoke_command` empty in `backlog.config.json` ⇒ logged no-op. Base health
  confirmed directly: the jsdom harness loads `index.html` and the committed Phase-2 suite was
  **RED** on the inherited base (11 failed; new radio → `null`) before this slice, then **green**
  after. **Result: passed.**
- **Autonomous decisions (Loop mode — no user).** No new one-way-door decisions were taken;
  the implementation follows the frozen tests + the atdd handover's recorded seams verbatim:
  - The new label id is `param-label-empirical-distributional` (atdd seam **S3**); the radio
    `value` is exactly `empirical-distributional` (DC-1).
  - The handler reassigns `activeSampler` on **every** mode (atdd seam **S4**) — restoring
    `sampleLognormal` for synthetic/empirical (a no-op for their draw sequence; DC-2 preserved)
    and binding `sampleLognormalWithResidual` only for the new mode.
  - The reference panel (`.size-table` inside the `<details>`) is not re-rendered (atdd seam
    **S5** / ADR-0038 dec. 9); the handler writes no `localStorage` (AC-7/DC-4).
  - **Control-flow choice (reversible, recorded):** the handler uses an explicit `if/else if/else`
    on `radio.value` (not a lookup map). The plan's *Do NOT lock in* note leaves the control-flow
    free; only the observable state (value→table, value→sampler, single `.active`) is the
    contract, which the tests pin. The note label uses descriptive copy
    ("Empirical centre + bootstrapped estimation-error spread") — cosmetic, no test depends on it.
- **No test drift:** `git diff --cached --name-only -- tests features e2e acceptance` is empty;
  the only staged production file is `index.html`.
- **Mutation: N/A** (`mutation.enabled: false`; ADR-0036). Adequacy carried by the tri-state
  PBT-4, the bidirectional toggle regression (AT-2), and the ast-grep forbidden-pattern negative
  control. **PBT** = fast-check; PBT-4 committed as a `test.prop` (gate (f) floor met).
  **contract**/**oracle_free** N/A for Phase 2.

## Definition of done (for review p2)

- Integrity review of `test_commit..impl_commit` is clean: no test file changed between the
  test and impl commits; no test-gaming pattern, no production import from tests, no
  env/identity branch, no blanket suppression; the new option's contract values are exact; DC-2
  isolation holds (residual sampler bound only in the new mode).
- A PASS hands to `review-correctness` p2 (same `current_phase`); a `review-correctness` p2 PASS
  completes the task.
</content>
</invoke>
