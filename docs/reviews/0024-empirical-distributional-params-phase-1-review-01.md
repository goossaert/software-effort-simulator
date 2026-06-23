# Integrity review — 0024 empirical-distributional-params, Phase 1, run 01

- **Plan:** `docs/plans/0024-empirical-distributional-params.md` (Phase 1 — engine + baked constants)
- **Feature-phase:** 1
- **Review run:** 01
- **Date:** 2026-06-23
- **Test commit (atdd-p1):** `e852039a2deffa6951d951c88bf4ecf83caf2455`
- **Implementation commit (implement-p1):** `4de048104bfc5afef67bbd78c1ed3e7d9846a86e`
- **Diff range:** `e852039..4de0481`
- **Verdict:** **PASS** (integrity clean) → hand to `/stage-review-correctness`

This is the **integrity** review (test-gaming / tamper / immutability / mutation
adequacy / PBT-oracle coverage). It does **not** confirm the tests pass (that is known);
it reads the plan + production diff first, then the tests. Correctness-from-spec is the
separate `review-correctness` stage that runs next.

---

## Step 1 — Plan (Phase 1) extraction

- **Behavioral rule.** When the Empirical (distributional) set is active, per-epic effort
  is `sampleLognormal(size) × bootstrapChoice(RATIO_RESIDUALS)` (a mean-1 residual that
  injects spread); constant work is the deterministic lognormal mean `exp(μ + σ²/2)`. The
  residual multiply **and** its extra RNG draw occur **only** in the new mode; Synthetic /
  Empirical keep their exact sampled values and PRNG draw sequence (DC-2 / ADR-0038 dec. 7).
- **Invariants.**
  - **I-4 `[contract]`** — `RATIO_RESIDUALS.length > 0` and every element `> 0` (module-load
    runtime assertion; guards the sampler positivity + `bootstrapChoice`/`nextInt` `len ≥ 1`).
  - **I-2 `[test-only]`** — `mean(RATIO_RESIDUALS) = 1` to 4 dp.
  - **I-3 `[test-only]`** — the three parameter tables share an identical key set.
  - **I-1 `[test-only]`** — Synthetic/Empirical byte-for-byte reproducibility.
- **Counterexamples (must NOT pass).** (1) sampler ignoring `RATIO_RESIDUALS`; (2) residual
  drawn in the shared path (Synthetic/Empirical consume it); (3) constants not matching the
  frozen block, or recomputed from CSV at load; (4) wall-clock / unseeded RNG in the sampler;
  (5) production import from `tests/`/`fixtures/`/`fakes/`/`__mocks__/`.
- **Forbidden shortcuts.** No residual in the shared path; no recompute-at-load / CSV read;
  no `if (size === …)` centre/spread special-casing; no wall-clock/unseeded RNG; no env-keyed
  branches.
- **Expected observable outcomes.** New-mode per-epic sample = `lognormal × residual`, `> 0`;
  `tshirtToPersonMonths` = `exp(μ_dist + σ²/2)`; Synthetic/Empirical `runScenario` byte-identical
  to captured golden; unknown size → `0` (× residual = 0).
- **Proposed seams.** Two module constants; the `activeSampler` function pointer (default
  `sampleLognormal`); the `runScenario` hot-loop swap `sampleLognormal(…)` → `activeSampler(…)`,
  size draw left outside the swapped call.
- **Properties to PBT.** PBT-1 (centre table), PBT-2 (sampler relation ∀ seed/size), PBT-3
  (uncalibrated centre uplift + spread). **Oracle class (a)**; `oracle_free` N/A. **Mutation
  N/A** (`mutation.enabled:false`, ADR-0036, recorded in `toolchain.layers.mutation.status:"n/a"`).

## Step 2 — Implementation diff (read before the tests)

Production files changed: `index.html`, `package.json` (plus per-layer gate logs under
`docs/atdd-logs/` and the backlog index/handovers — non-production).

1. **General rule, not value-keying.** `sampleLognormalWithResidual(sizeLabel)` returns
   `sampleLognormal(sizeLabel) * bootstrapChoice(RATIO_RESIDUALS)` (`index.html:1439-1441`) —
   a single relation applied uniformly to all sizes. The hot loop routes through the
   `activeSampler` pointer (`index.html:2600`). No size special-casing, no fixture literals,
   no identity branches.
2. **Every changed file maps to the rule.** `index.html` = the engine slice (two baked
   constants, the I-4 contract, the `activeSampler` seam, `sampleLognormalWithResidual`, the
   hot-loop swap). `package.json` = the `lint`-script bootstrap (decision D1) — analysed in
   Step 3; it is an invocation-reliability fix, not a behavioral change.
3. **No suspicious constructs.** The `[contract]` assertion is on the real `RATIO_RESIDUALS`,
   not a fixture; the constants are baked domain data; no `NODE_ENV`/`process.env.TEST`, no
   test-helper imports.

**DC-2 isolation (the crux).** `activeSampler` defaults to `sampleLognormal`, so for
Synthetic/Empirical the hot loop is literally `sampleLognormal(bootstrapChoice(epicSizingDist))`
— byte-identical to the pre-feature line and the same PRNG sequence. The residual draw lives
**only** in `sampleLognormalWithResidual`, evaluated **after** the lognormal draw (JS left-to-right
on `a * b`) — pinning seam **S2** (lognormal-first-then-residual). The size draw
`bootstrapChoice(epicSizingDist)` stays **outside** the swapped call, so all three modes draw
the size at the identical PRNG position. The Phase-1 change does **not** touch the param-mode
`change` handler (`index.html:4705-4707` still maps only empirical↔synthetic and does not set
`activeSampler`) — correct: the radio wiring is Phase 2, no scope creep.

**Baked-constant cross-check (DC-3 / AC-3, verified by hand against the diff):**
- Calibrated (XS/S/M/L) distributional `(μ,σ)` **equals** `T_SHIRT_PARAMS_EMPIRICAL[size]`
  exactly: XS `-0.5093/0.4286`, S `0.4704/0.2703`, M `0.9636/0.2703`, L `1.7550/0.2703`.
- Uncalibrated (2XS/XL/XL+) σ **equals** synthetic σ exactly; μ ≈ synthetic μ + ln(1.40)
  (=0.33647) to 4 dp: 2XS −1.8444+0.33647=−1.50793 ≈ **−1.5079**; XL 1.9945+0.33647=2.33097 ≈
  **2.3310**; XL+ 2.3503+0.33647=2.68677 ≈ **2.6868**.
- All three tables share the identical 7-key set (I-3).
- `RATIO_RESIDUALS` (n=23) sum = 23.0000 ⇒ mean = 1.0000 to 4 dp; every element `> 0` (I-2/I-4).

## Step 3 — Test-gaming scan

| Pattern | Finding |
|---|---|
| Hard-coded fixture values in production | **None** — constants are baked domain data from the canonical frozen calibration (plan *Data models* / grill handover), matched relationally by the tests, not magic numbers copied from a fixture. |
| Conditionals on test-only identifiers | **None.** |
| Skipped / deleted tests | **None** — `git diff e852039..4de0481 -- tests features e2e acceptance` is **empty**; no frozen test file changed (gate sub-check (a) twin). |
| Weakened assertions | **None** (no test files changed). |
| Production imports from test helpers | **None** — no `from '…/tests|fixtures|fakes|__mocks__/…'` in the added production lines. |
| Environment checks in production | **None** — no `NODE_ENV`/`process.env.TEST` branches. |
| Excessive / tautological mocking | **N/A** — tests drive the real loaded-window globals; determinism via seeding the in-process `rng`. |
| Patched runners / gate configs / thresholds | **One config-adjacent change — `package.json` `lint` script — analysed below; NOT a loosening.** No `vitest.config`/eslint-config/coverage-threshold change. |
| Stale / pre-generated artifacts | **None** — the `docs/atdd-logs/*` files are per-layer correctness-gate logs from implement, not test-result files asserting green. |
| Changed fixtures | **None.** |

**`package.json` `lint`-script change (decision D1) — not a weakening.**
`"eslint index.html --max-warnings 0"` → `"{ [ -e node_modules/.bin/eslint ] || npm ci; } &&
eslint index.html --max-warnings 0"`. The eslint invocation is byte-identical (`--max-warnings 0`
preserved, same flat config incl. `eslint-plugin-security`); the prefix only self-bootstraps the
toolchain so `npm run lint` is runnable on a fresh, network-disabled checkout (the gate's
standalone `analysis` command, which exited 127 on the rewound commit). No rule disabled, no
severity lowered, no scan scope narrowed, no suppression added. By the Step-3 criteria this is an
invocation-reliability fix (a *tightening* of runnability), not a goalpost move. The added
production lines contain **no** blanket suppression token (`@ts-nocheck`/`type: ignore`/
`eslint-disable`/`noqa`/`nolint`) — gate sub-check (s2) twin clean.

## Step 4 — Tests (read after forming the Step-2 view)

Committed Phase-1 tests (unchanged since the test commit):
`tests/acceptance/0024-phase-1-distributional-sampler.test.js` (AT-1..5, 14 cases) and
`tests/acceptance/0024-phase-1-distributional-params-property.test.js` (PBT-1/2/3, `test.prop`).

- **Plan scenarios → coverage.** AT-1 (relation, M + boundary XL+ + unknown→0), AT-2 (constants
  vs frozen calibration, key set, mean-1 pool), AT-3 (XL+ centre uplift ≈1.40× + variance widens),
  AT-4 (synthetic + empirical golden byte-for-byte + synthetic→new→synthetic round-trip), AT-5
  (constant work `exp(μ+σ²/2)`, calibrated matches empirical, uncalibrated 1.40×, unknown→0). No
  plan-described behavior is uncovered.
- **No overfitting.** The residual relation is asserted against a **re-computed oracle**
  (re-seed → `sampleLognormal(size)` × `bootstrapChoice(RATIO_RESIDUALS)`), not a hard-coded
  number, so it cannot be satisfied by returning a constant; PBT-2 quantifies it over all seeds
  and sizes. The constants are checked **relationally** (calibrated == empirical;
  uncalibrated == synthetic + ln1.40), not against literals duplicated in the test.
- **Counterexamples are caught.** (1) residual-ignoring sampler → AT-1/PBT-2 (proven by negative
  control A); (2) residual in shared path → AT-4 golden/round-trip would shift; (3) wrong/recomputed
  constants → AT-2/PBT-1; (4) wall-clock/unseeded RNG → breaks the re-seeded `toBe(ln*res)` oracle
  + forbidden-scan; (5) prod import from tests → forbidden-scan.
- **External-source mirroring.** The only mirrored artefact is the **frozen** calibration (DC-3
  froze the CSV out of the repo). Verification is the exact-value/relational AC-3 assertions — the
  designated parity check. No live external source exists, so no fake-only-mirroring gap applies.
- **PBT coverage.** All three non-N/A parametric plan properties (PBT-1/2/3) have generator-based
  `test.prop` properties over the stated domain with shuffling/shrinking at defaults; the size
  domain is **read from the loaded window** (`Object.keys(T_SHIRT_PARAMS_EMPIRICAL)`), not
  hand-listed. Structural floor (gate sub-check (f), `pbt.import_symbol = test.prop`) is met.
- **Oracle-free.** Oracle class (a); `oracle_free` N/A — no metamorphic/differential requirement.

**Observation (not a gap).** The AC-5 variance assertion (AT-3/PBT-3, `neu.variance > empVar`)
does not, on its own, isolate the residual's contribution: the new mode's centre uplift (μ shifted
by ln1.40) inflates a lognormal's absolute variance by ~1.40² even with no residual, so a
residual-ignoring sampler would still pass the variance **and** the mean checks. The load-bearing
defense against that counterexample is the deterministic AT-1/PBT-2 exact relation — confirmed by
negative control A (dropping the residual fails exactly AT-1 ×2 + PBT-2, while AT-3/PBT-3 stay
green). Coverage is therefore complete; the variance check is a corroborating statistical property,
not the primary guard. No additional test is required.

## Step 5 — Invariants vs the implementation

```
Invariant: RATIO_RESIDUALS.length > 0 and every element > 0 (I-4)
Enforcement: [contract]
Status: SATISFIED
Contract: PRESENT (index.html:1371-1373 — `if (!(RATIO_RESIDUALS.length > 0 &&
          RATIO_RESIDUALS.every((r) => r > 0))) throw new Error('[contract] …')`)
Evidence: module-load assertion on the real baked RATIO_RESIDUALS; not keyed on any
          fixture/test-id/NODE_ENV. Negative control B confirms it fires on a forbidden value.

Invariant: mean(RATIO_RESIDUALS) = 1 to 4 dp (I-2)
Enforcement: [test-only]   Status: SATISFIED   Contract: N/A (test-only)
Evidence: sum=23.0000/23 ⇒ 1.0000; asserted by AT-2 (`toBeCloseTo(1, 4)`).

Invariant: the three parameter tables share an identical key set (I-3)
Enforcement: [test-only]   Status: SATISFIED   Contract: N/A (test-only)
Evidence: identical 7-key set in the diff; asserted by AT-2 + PBT-1.

Invariant: Synthetic/Empirical byte-for-byte reproducibility (I-1)
Enforcement: [test-only]   Status: SATISFIED   Contract: N/A (test-only)
Evidence: activeSampler default = sampleLognormal ⇒ shared path unchanged; AT-4 golden + round-trip.
```

`contract.enabled:false`, so gate sub-check (g) does not run; the assertion is nonetheless
present and live (Step 6 negative control B), satisfying the plan's `[contract]` requirement.

## Step 6 — Negative controls (two; phase has a `[contract]` invariant)

**Baseline (HEAD = impl commit):** AT 14/14 pass (exit 0), PBT 3/3 pass (exit 0).

**Control A — most important behavioral rule (the residual multiply).**
1. Bug: `sampleLognormalWithResidual` → `return sampleLognormal(sizeLabel);` (residual dropped).
2. `npx vitest run …-sampler.test.js` → **2 failed | 12 passed** (the AT-1 exact-relation cases
   for M and XL+); `npx vitest run …-property.test.js` → **1 failed | 2 passed** (PBT-2). Both
   suites RED.
3. Failure confirmed (the re-computed `toBe(ln*res)` oracle and PBT-2 reject the plain lognormal).
4. Reverted (`git checkout -- index.html`).
5. Re-run → AT **exit 0** (14 passed), PBT **exit 0** (3 passed).

**Control B — contracted invariant I-4 (the live runtime assertion).**
1. Bug: first `RATIO_RESIDUALS` element `0.3692` → `-0.3692` (violates "every > 0").
2. Loaded `index.html` in JSDOM capturing `jsdomError`: the assertion fired —
   `Uncaught [Error: [contract] RATIO_RESIDUALS must be a non-empty pool of strictly positive
   residuals]`. Module load **aborted at the throw**: `typeof activeParams` (declared after the
   contract) became `undefined` (`sampleLognormal` still reports `function` only due to
   function-declaration hoisting). On the clean tree the contract is silent (no jsdomError,
   all bindings present).
3. The failure that catches the forbidden value is the **contract itself firing** (a local,
   loud module-load abort), not merely a downstream test expectation — the proof I-4 is live
   defense-in-depth, not a dead contract.
4. Reverted; throwaway probe removed.
5. Working tree clean (`git status --porcelain` empty); RATIO_RESIDUALS first element restored.

## Step 7 — Mutation testing (scored adequacy gate)

**N/A.** `mutation.enabled: false`, with a **recorded** N/A (`toolchain.layers.mutation.status:
"n/a"` + rationale; plan *Definition of done*; ADR-0036 — StrykerJS cannot scope to one inline
`<script>` in a multi-`<script>` single-file HTML). This is a configured N/A, not a
business-logic phase with an unrecorded disable, so the scored gate is correctly skipped. Adequacy
is carried by the per-size PBT, the byte-identical golden (AC-4), the live I-4 contract, and the
ast-grep forbidden-pattern negative control. The Step-6 negative controls ran as the smoke check.

## Step 8 — Additional verification tests

**None.** No missing case, edge case, or invariant gap was found in Steps 4–5; the committed
suite covers every Phase-1 scenario and property, and the two independent negative controls
confirm the suite catches both the core behavioral mutation and a contract violation. Adding
tests would be redundant. (The review commit therefore carries only this review file, the index
advance, and the handover.)

---

## Step 10 — Verdict

```
Phase 1 review verdict: PASS

Test gaming patterns found: none
Invariant gaps: none (I-4 [contract] PRESENT + live at index.html:1371-1373; I-1/I-2/I-3 test-only, satisfied)
Missing test coverage: none (AC-5 variance check is corroborating-only; the residual relation is fully pinned by AT-1/PBT-2 — observation, not a gap)
Additional verification tests written: none
Negative control result: PASS (A: residual-drop → AT 2-fail + PBT 1-fail → revert → green; B: I-4 contract fires on a forbidden value, module-load abort)
Mutation score (scoped): N/A (mutation.enabled=false; recorded N/A — ADR-0036)
Surviving mutants: none (mutation N/A)

Overall: The Phase-1 engine slice implements the behavioral rule generally — effort =
sampleLognormal(size) × bootstrapChoice(RATIO_RESIDUALS) routed through the default-identity
activeSampler pointer, with the residual draw isolated to the new mode (DC-2) and pinned
lognormal-first (S2). The two baked constants match the frozen calibration exactly (DC-3): the
calibrated sizes equal the Empirical table, the uncalibrated sizes carry the synthetic σ with μ
shifted by ln(1.40) to 4 dp, and the mean-1 positive residual pool checks out. No test file
changed between the test and implementation commits; no test-gaming pattern, no production
import from tests, no env/identity branch, no blanket suppression. The one non-index.html
production change (package.json lint bootstrap) is an invocation-reliability fix, not a weakening
of any correctness layer. The I-4 [contract] invariant is present and proven live by a negative
control; the most important behavioral rule is proven covered by a second negative control.
Mutation is a recorded N/A and PBT-1/2/3 meet the structural floor. Integrity review PASSES;
the phase hands to /stage-review-correctness (which owns the advance to Phase 2).
```

**Saved review file:** `docs/reviews/0024-empirical-distributional-params-phase-1-review-01.md`
