# Integrity review — 0023 error-report-tab — Phase 2 — run 02

- **Plan:** `docs/plans/0023-error-report-tab.md` (Phase 2 — codes 3-22 + full
  presentation contract; the LAMBDA_ZERO fix lives in the *former-Phase-3* sub-section,
  codes 6-9)
- **Phase:** 2 (`current_phase: 2`, the consolidated final phase)
- **Test commit:** `056c7b3a9267d26980019e72b402405503ecadc1` (atdd-p2 re-run, handover-16)
- **Implementation commit:** `6734696366cd4dd58c8df74375dc764df8954c0f` (implement-p2, handover-17)
- **Reviewer:** integrity review (stage-review), autonomous Loop mode
- **Date:** 2026-06-24
- **Verdict:** **PASS** → hands off to `review-correctness` (feature-phase 2)

This is the **second** integrity run for Phase 2. Run 01
(`…-phase-2-review-01.md`) PASSed the full codes-3-22 + presentation slice over
`57b38dc..cbbabc6`. The correctness review then BLOCKED `suspect-test` on the
`LAMBDA_ZERO` guard; a human migrated AT-5 to `2 WARNING` (honor the spec), atdd
re-confirmed RED, and this implement (`6734696`) drops the spurious guard. **This run
re-reviews the narrow `056c7b3..6734696` diff** — a single production line — plus the
freeze-protection facts the review commit must still uphold.

---

## Boot smoke

`smoke_command` is empty in `backlog.config.json` ⇒ minimal build/parse check.
`index.html` parses (210 465 bytes, 10 inline `<script>` blocks). **PASS** — base is
healthy.

---

## Step 1 — Plan (Phase 2 / former-Phase-3, codes 6-9)

**Behavioral rule (the line this implement touches).** "When Poisson λ = 0 … a WARNING
finding is emitted." A completed Run with λ = 0 forecasts ~0 work and must surface a
`LAMBDA_ZERO` WARNING with a `run` locator.

**Invariants relevant to this change.**
- `[test-only]` **I-2:** `LAMBDA_ZERO ⇔ lambda === 0`; `TOTAL_K_ZERO ⇔ sum(kPerGroup) === 0`.
- `[contract]` Run-level findings carry a single `run` locator (**I-4**).
- `[contract]` (global, Phase 1) Every finding's `severity ∈ {ERROR,WARNING,INFO}` (**I-3**);
  every finding has `locators.length >= 1` (**I-4**) — enforced in `makeFinding`.
- `[contract]` (codes 8-9) a coercion finding is emitted **iff** `entered !== used`.

**Counterexamples (must NOT pass).** "Reporting `LAMBDA_ZERO` when λ is a tiny positive
number (must be exact `=== 0`)."

**Forbidden shortcuts.** No identity special-casing; read-only collection (no mutation
of engine inputs / returned values — I-1); no clock/RNG; explicit sort; the detector
must agree with what the engine actually computed (single source of truth, ADR-0037).

**Expected observable outcome.** `prepareSimulationData(...).findings` carries exactly
one `LAMBDA_ZERO` (WARNING, `Run parameters`, `run` locator) whenever `lambda === 0`,
and none when `lambda > 0`.

**Proposed seam.** `prepareSimulationData` — additive `findings` for code 6 derived from
the returned `lambda`. Routed through the `makeFinding` factory.

---

## Step 2 — Implementation diff (read before the tests)

`git diff 056c7b3..6734696`:

**Production (`index.html`) — exactly one line, at the code-6 block (line 2353):**

```diff
   // ── Code 6: LAMBDA_ZERO ─────────────────────────────────────────
-  if (lambda === 0 && epicSizingDist.length === 0) {
+  if (lambda === 0) {
```

**Non-production (backlog bookkeeping, outside `test_paths`):**
`docs/backlog/0023-error-report-tab/handover-17-implement-p2.md` (new) and
`docs/backlog/0023-error-report-tab/index.md` (stage `implement`→`review`).

**Initial assessment (from the diff alone, before reading the tests):**
1. **General rule, not value-keyed.** The change *deletes* a special-case conjunct,
   making the guard the literal biconditional the plan states (`LAMBDA_ZERO ⇔ lambda === 0`).
   It is the opposite of overfitting — it removes a special case rather than adding one.
2. **Every changed file maps to the rule.** The one production line is the rule;
   the other two files are the loop's own handover + index (not production, not tests).
3. **No suspicious constructs.** No ID conditionals, no fixture literals, no env checks.
   `=== 0` strict equality directly honours the "exact `=== 0`" counterexample.

The change is sound on its face: the run handler's fatal throw at `index.html:5105`
(`if (epicSizingDist.length === 0) throw …`) fires **before** the report renders
(`renderErrorReport` at 5171), so a rendered report always has a non-empty
`epicSizingDist`; the old conjunct `&& epicSizingDist.length === 0` therefore made
`LAMBDA_ZERO` **structurally unreachable** in any rendered report and wrongly suppressed
it in the genuine boundary case (orphan epic with a *recognised* size ⇒ λ = 0 with
`epicSizingDist = ['M']`). Dropping the conjunct restores the spec.

---

## Step 3 — Test-gaming scan

| Pattern | Result |
|---|---|
| **Test files changed** (`git diff 056c7b3..6734696 -- tests features e2e acceptance`) | **empty** — no test file touched. PASS. |
| Hard-coded fixture values in production | None — the diff *deletes* a clause; no literals added. |
| Conditionals on test-only identifiers | None. |
| Skipped / deleted tests | None. |
| Weakened assertions | None — no test edits at all. |
| Production imports from `tests/`/`__mocks__/`/`fixtures/`/`fakes/` | None. |
| `NODE_ENV === 'test'` / `process.env.TEST` branches | None. |
| Excessive / incorrect mocking | N/A — no mocks; jsdom drives the real page realm. |
| Tautological / internal-state assertions | None added. |
| Patched runner / gate / threshold configs (`vitest.config`, `.eslintrc`, `tsconfig`, coverage, etc.) | None in diff. |
| Blanket suppressions (`eslint-disable`, `@ts-nocheck`, `# noqa`, …) | None added. |
| Stale / pre-generated artifacts | None. |
| Changed fixtures / factories / seed data | None. |

**No gaming patterns found.** The host gate's structural sub-checks (a no-test-staged,
d forbidden-pattern, s2 suppression) will re-derive this independently; the cheap
first-line scan is clean.

---

## Step 4 — Tests (read after forming the Step 2 view)

The committed Phase-2 tests pin `LAMBDA_ZERO` through three complementary cases — none
were modified in the reviewed range:

- **`0023-phase-2-acc-run-parameters.test.js` AT-1** — historical epic linked to `I-1`
  with an **unrecognised** size (`XXL`) ⇒ `lambda === 0` **and** `epicSizingDist` empty.
  Asserts exactly one `LAMBDA_ZERO` (WARNING, `Run parameters`, `run` locator). This
  case passed under *both* the old and new guard (it is the `epicSizingDist.length === 0`
  branch), which is precisely why it never caught the bug.
- **`0023-phase-2-acc-presentation.test.js` AT-5** (the human-migrated test) — an
  **orphan** epic with a **recognised** size (`M`) ⇒ `lambda === 0` with
  `epicSizingDist = ['M']` (non-empty). Asserts the badge `2 WARNING` (ORPHAN_EPIC +
  LAMBDA_ZERO). This is the **distinguishing** case the new code is required for.
- **`0023-phase-2-acc-run-parameters.test.js` AT-2** — λ > 0 ⇒ asserts
  `findings.filter(LAMBDA_ZERO)` has length 0. The **negative** direction of the
  biconditional, and the guard against the "tiny positive λ" counterexample (strict `=== 0`).

**Could the implementation pass every visible test yet violate a counterexample?** No.
The counterexample (λ tiny-positive ⇒ no finding) is covered by AT-2 and respected by
strict `=== 0`; the boundary case is covered by AT-5; the empty-`epicSizingDist` case by
AT-1. The three together fully bracket `LAMBDA_ZERO ⇔ lambda === 0`.

**PBT coverage.** `LAMBDA_ZERO` (I-2) is a `[test-only]` invariant, **not** a parametric
row in any phase's *Properties / invariants to PBT* table — it is acceptance-covered, by
design (handover-15 confirms "no LAMBDA_ZERO PBT to satisfy"). The former-Phase-3
parametric rows (`CAPACITY_COERCED`, `ITERATIONS_CLAMPED`) are covered by
`0023-phase-2-prop-coercion.test.js` (2 `test.prop` invocations, both green in this run).
The whole-plan PBT floor (12) is **met and unchanged** by this implement: 20 committed
`fc.property|test.prop|it.prop` invocations exist at the test commit (4 phase-1 + 16
phase-2). No coverage gap.

**Oracle-free.** `oracle_free.enabled: false`; Phase 2 oracles are class (a) cheap
oracles. N/A.

---

## Step 5 — Invariants vs. implementation

```
Invariant: [test-only] I-2 — LAMBDA_ZERO ⇔ lambda === 0
Enforcement: [test-only]
Status: SATISFIED
Contract: N/A (test-only)
Evidence: index.html:2353 `if (lambda === 0)` is the literal biconditional; AT-1
  (λ=0 ⇒ emit), AT-2 (λ>0 ⇒ none) and AT-5 (λ=0, non-empty epicSizingDist ⇒ emit)
  pin both directions. Strict === honours the "tiny positive λ" counterexample.

Invariant: [contract] I-4 — run-level findings carry a single `run` locator
Enforcement: [contract]
Status: SATISFIED
Contract: PRESENT — makeFinding (index.html:2122-2124) throws when locators.length < 1
Evidence: the code-6 push supplies `locators: [{ kind:'run', id:'lambda' }]`
  (index.html:2356) and routes through makeFinding.

Invariant: [contract] I-3 — severity ∈ {ERROR,WARNING,INFO}
Enforcement: [contract]
Status: SATISFIED
Contract: PRESENT — makeFinding (index.html:2119-2121) throws on a bad severity
Evidence: code-6 uses severity 'WARNING' via makeFinding; NC2 below fires the throw.

Invariant: [contract] (codes 8-9) coercion finding iff entered !== used
Enforcement: [contract]
Status: SATISFIED (untouched by this diff)
Contract: PRESENT — collectRunLevelFindings (index.html:2138, 2146) guards on `!==`
Evidence: not in the reviewed diff; unchanged since the prior PASS.
```

`contract.enabled: false` ⇒ the host gate's contract-floor sub-check (g) is opt-in/off,
but the qualitative per-invariant judgement above is the real check and every contract
is **PRESENT** in `makeFinding` and live (proven by NC2).

---

## Step 6 — Negative controls

**NC1 — marquee behavioral rule (`LAMBDA_ZERO ⇔ lambda === 0`).**

| Step | Command | Exit | Result |
|---|---|---|---|
| baseline | `npx vitest run …acc-presentation.test.js` | 0 | AT-5 passes (badge `2 WARNING`) |
| mutate (re-add `&& epicSizingDist.length === 0`) | same | 1 | AT-5 **fails** — `expected '…1 WARNING…' to contain '2 WARNING'` (LAMBDA_ZERO suppressed) |
| revert | same | 0 | AT-5 passes again |
| post-revert | `git diff index.html` | — | empty (tree pristine) |

The committed suite **catches** the deliberate reintroduction of the bug.

**NC2 — contracted invariant fires its own assertion (required because Phase 2 has
`[contract]` invariants).** Calling `makeFinding` with values the contract forbids
(verified via a transient page-realm probe through `tests/harness.js`, not committed):

- invalid severity `'CRITICAL'` ⇒ throws **`[finding] invalid severity "CRITICAL" for
  code "LAMBDA_ZERO"`** (I-3 firing — the assertion itself, not a downstream expectation).
- empty `locators` ⇒ throws **`[finding] code "X" must carry >= 1 locator`** (I-4 firing).

The `[contract]` invariants are **live defense-in-depth**, not dead contracts.

**Negative control result: PASS.** All mutations reverted; `git status` clean.

---

## Step 7 — Mutation testing (scored gate)

**N/A — skipped legitimately.** `mutation.enabled: false` **and**
`toolchain.layers.mutation.status: "n/a"` with a recorded rationale (StrykerJS cannot
scope a single inline `<script>` in a multi-`<script>` single-file HTML app — ADR-0036).
This is a recorded N/A, **not** a misconfiguration, so the phase is not blocked on
`mutation-unconfigured`. The Step 6 negative controls stand as the hand-picked smoke
check; per-rule adequacy is covered by the PBT floor.

---

## Step 8 — Additional verification tests

**None written.** The change is a single-line guard deletion fully bracketed by the
three existing committed acceptance tests (AT-1/AT-2/AT-5) and proven by NC1; the
contract liveness is proven by NC2. No coverage gap warranted an additive probe, and a
review commit is kept to {review file, index, handover} so the review-commit
freeze-protection (gate sub-check a) is trivially satisfied.

---

## Whole-tree verification (first line of defense; gate re-runs authoritatively)

`npm run verify` on the clean impl tree (`6734696`): **exit 0 — 308 passed, 1 skipped**
(lint + ast-grep forbidden-patterns + dep scan + secretlint + vitest). Matches the
implement handover's hermetic claim. The host gate re-runs `verify_command` on a fresh,
network-disabled checkout (sub-check b) as the authority.

---

## Step 10 — Verdict

```
Phase 2 review verdict: PASS

Test gaming patterns found: none
Invariant gaps: none
Missing test coverage: none
Additional verification tests written: none
Negative control result: PASS
Mutation score (scoped): N/A (mutation.enabled=false; toolchain.layers.mutation.status="n/a", ADR-0036)
Surviving mutants: none (mutation N/A)
```

**Overall.** The implement is a single, correct, *generalising* production line —
`if (lambda === 0 && epicSizingDist.length === 0)` → `if (lambda === 0)` — that makes
the code-6 detector the literal `LAMBDA_ZERO ⇔ lambda === 0` biconditional the plan
declares (I-2) and resolves the run-01 suspect-test on the spec side (per the
human-approved handover-15 `2 WARNING` migration of AT-5). No test file was modified in
`056c7b3..6734696`; the test-gaming scan is clean; every `[contract]` invariant is
PRESENT in `makeFinding` and proven live (NC2); the marquee behavioral rule is caught by
the committed suite (NC1); the PBT floor (12) is met and unchanged; mutation is a
recorded N/A. Integrity is clean — hand off to **`review-correctness`** for feature-phase 2.
