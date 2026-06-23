---
schema: backlog-handover/v1
task_id: "0024"
produced_by_phase: implement
feature_phase: 1
for_next_phase: review
outcome: success
reason: ""
produced_at: 2026-06-23T06:32:32Z
produced_commit: e03d441ed63b7fbfb0fa9731a340d60ec3131f1d
test_commit: e852039a2deffa6951d951c88bf4ecf83caf2455
---
## Summary

Re-ran implement for **Phase 1** (engine + baked constants) after the post-stage gate
rewound the first implement commit (`b9c4c7d4`). The rewind was **not** a code defect —
that commit's hermetic `npm run verify` passed (264 green) — it was the gate's standalone
`analysis` sub-check exiting **127** (`sh: eslint: command not found`) when it ran
`npm run lint` on a fresh worktree that has no `node_modules`. The standalone `lint`
script lacked the `npm ci` self-bootstrap guard the composite `verify` script already had.

This commit does two production-only things:

1. **Re-applies the Phase-1 engine slice to `index.html`** (the only behavioral change),
   byte-identical in intent to the rewound commit (which the atdd session had proven
   satisfiable):
   - `T_SHIRT_PARAMS_DISTRIBUTIONAL` (7 sizes) + `RATIO_RESIDUALS` (23 floats), baked
     verbatim from the plan's *Data models* (DC-3; not recomputed at load).
   - `[contract]` I-4 module-load assertion guarding `RATIO_RESIDUALS.length > 0 &&
     every element > 0`.
   - `let activeSampler = sampleLognormal;` — the DC-2 RNG-isolation function-pointer seam
     (default identity = plain lognormal, so Synthetic/Empirical stay byte-identical).
   - `function sampleLognormalWithResidual(sizeLabel)` — name pinned by atdd seam **S1**;
     draw order lognormal-first-then-residual pinned by atdd seam **S2**:
     `return sampleLognormal(sizeLabel) * bootstrapChoice(RATIO_RESIDUALS);`.
   - `runScenario` hot-loop swap (`index.html:2544`): `sampleLognormal(bootstrapChoice(
     epicSizingDist))` → `activeSampler(bootstrapChoice(epicSizingDist))`. The size draw
     stays outside the swapped call, so all three modes draw the size identically; only the
     residual draw is new and lives inside the new-mode sampler.

2. **Fixes the gate's 127** by making the `lint` npm script self-bootstrap (see *Autonomous
   decision D1* below).

## Autonomous decision D1 (Loop mode — no user; recorded per contract)

**Make the `lint` npm script self-bootstrap its toolchain, mirroring `verify`.**

- Before: `"lint": "eslint index.html --max-warnings 0"`.
- After:  `"lint": "{ [ -e node_modules/.bin/eslint ] || npm ci; } && eslint index.html --max-warnings 0"`.

Why: the gate's `analysis` sub-check runs `correctness_gate.analysis_command`
(= `npm run lint`) **standalone** on a fresh, network-disabled, lockfile-pinned checkout.
The composite `verify` script already self-bootstraps with the identical guard
(`{ [ -e node_modules/.bin/eslint ] || npm ci; } && …`), which is why the gate's hermetic
`verify` re-run passed while the standalone `analysis` re-run hit `eslint: command not
found` (127). Adding the same guard to `lint` makes `npm run lint` runnable on a fresh
checkout. The guard is idempotent (when eslint is already present it is a no-op, so the
`verify` path does not double-install).

This is **not** a weakening of the lint/SAST layer — eslint still runs with
`--max-warnings 0` and the same flat config (eslint-plugin-security folded in). It is an
infrastructure-reliability fix to the *invocation*, not a relaxation of the *check*. It is a
production file (`package.json`), not a test file, so it does not touch the frozen test set.

The `dep_scan` layer (`node scripts/dep-scan.mjs`) and `secret_scan` (`npx secretlint`) were
checked and do **not** need an analogous guard for the cited failure: `node` is always on
PATH and `dep-scan.mjs` only shells out to `npm audit --json` (works from `package-lock.json`
alone), and both were exercised green inside the hermetic `verify`. Only the standalone
`analysis`/`lint` re-run was the 127 source, and only it is touched.

## Verification (all green)

- **Inner tests — stable green:**
  - `npx vitest run tests/acceptance/0024-phase-1-distributional-sampler.test.js` → 14/14
  - `npx vitest run tests/acceptance/0024-phase-1-distributional-params-property.test.js` → 3/3
  - Stable across **3 default-order reruns + 1 randomized-order run** (`-- --sequence.shuffle`)
    each; every run exit 0.
- **`npm run verify` → exit 0** (working tree): lint, ast-grep forbidden-scan (5 rules),
  dep-scan (PASS, 2 documented accepted advisories), secretlint, `vitest run`
  (264 passed | 1 pre-existing skip). Full log: `.agent/last-verify.log`.
- **Hermetic verify (fresh worktree from a `git stash create` tree `4bfd397`, no
  `node_modules`):**
  - **(1) gate `analysis` command reproduced:** `npm run lint` → **exit 0** (the guard ran
    `npm ci` — added 419 packages — then eslint clean). This is the exact check that exited
    127 on the rewound commit; the fix resolves it.
  - **(2) full `npm run verify` → exit 0** (264 passed | 1 skip).
- **Per-layer correctness-gate logs** persisted under `docs/atdd-logs/`:
  `…-phase-1-lint.log` (0), `…-sast.log` (0), `…-dep-scan.log` (0), `…-secret-scan.log` (0),
  `…-forbidden-scan.log` (0), `…-typecheck.log` (N/A — vanilla JS), `…-sanitizer.log`
  (N/A — interpreted language).
- **No test drift:** `git diff --name-only e852039..HEAD -- tests features e2e acceptance`
  is empty; the implement commit stages **no** file under `tests/**`. Production files
  changed: `index.html`, `package.json`.

## Forbidden-pattern self-check (clean)

No fixture literals / identity branches / `NODE_ENV`/`TEST` branches / imports from
`tests/`·`fixtures/`·`fakes/`·`__mocks__/`; no size special-casing (the table + pooled
residual drive all sizes uniformly); randomness is only the injected seedable `rng`
(`Xoshiro128ss`), no wall-clock or unseeded RNG; ast-grep forbidden-scan passes (5 rules).
The `[contract]` I-4 assertion is on the real `RATIO_RESIDUALS` values, not on any fixture.

## Instructions for the next phase (review p1)

Independent integrity review of feature-phase 1. Derive the diff range from git:
`test_commit (e852039) .. impl_commit (this commit's SHA, the HEAD after this commit)`.

Read first (per `/stage-review`): the plan's **Phase 1** slice, then the production diff —
**not** the tests. Points to verify:
- The sampler relation (effort = `sampleLognormal(size) × bootstrapChoice(RATIO_RESIDUALS)`,
  lognormal-first) and the `activeSampler` default-identity isolation (Synthetic/Empirical
  byte-identical — AT-4 golden + round-trip).
- The baked constants match the frozen calibration exactly (DC-3); no recompute-at-load.
- The `package.json` `lint`-script change is an invocation-bootstrap, **not** a weakening of
  any correctness layer (eslint still runs `--max-warnings 0`; no suppressions added). This
  is the one non-`index.html` production change — confirm it does not relax lint/SAST scope.
- The `[contract]` I-4 module-load assertion exists and is on real domain values.
- Mutation: **N/A** (`mutation.enabled: false`; ADR-0036). PBT floor met (PBT-1/2/3
  committed as `test.prop`). oracle_free N/A (oracle class (a)).

## Files the next phase MUST read

- `docs/plans/0024-empirical-distributional-params.md` — Phase 1 slice (primary input).
- `index.html` — the production diff (constants ≈ after `T_SHIRT_PARAMS_EMPIRICAL`;
  `activeSampler` beside `activeParams`; `sampleLognormalWithResidual` after `sampleLognormal`;
  hot-loop swap in `runScenario`).
- `package.json` — the `lint`-script bootstrap fix (decision D1).
- `docs/backlog/0024-empirical-distributional-params/handover-04-atdd-p1.md` — the frozen
  seam contract (S1/S2) and the test inventory.
- `docs/backlog/0024-empirical-distributional-params/handover-05-gate-p1.md` — the gate
  rejection this commit resolves.
- The two committed Phase-1 test files (read-only — to understand, not to re-run as the
  oracle): `tests/acceptance/0024-phase-1-distributional-sampler.test.js` and
  `…-distributional-params-property.test.js`.

## Definition of done (met)

- [x] Both committed Phase-1 commands pass (14/14 + 3/3), stable across reruns +
  randomized order.
- [x] `npm run verify` exits 0 under a hermetic, network-disabled, lockfile-pinned checkout,
  no `correctness_gate` layer disabled/downgraded.
- [x] The gate's standalone `analysis` command (`npm run lint`) now exits 0 on a fresh
  checkout (was 127).
- [x] Implement commit stages no `tests/**` file; production files changed: `index.html`,
  `package.json`.
- [x] Mutation N/A (ADR-0036); PBT floor met; per-layer logs persisted.
</content>
</invoke>
