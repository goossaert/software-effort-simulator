# Integrity review — 0022 empirical-lognormal-default, Phase 1, run 02

- **Plan:** `docs/plans/0022-empirical-lognormal-default.md`
- **Phase:** 1 (of 1) — *Page-load default flips to the Empirical parameters table (ephemeral, toggle intact)*
- **Review run:** 02 (run 01 was the prior BLOCKED review on the scored-mutation gate; the
  human fix recorded mutation **N/A** — `mutation.enabled: false`,
  `toolchain.layers.mutation.status: "n/a"`, ADR-0036 — and removed the blocked handover so
  the loop regenerates the review fresh)
- **Date:** 2026-06-21
- **Test commit:** `f7eb97de2c91eba6cd5b7ec51db1a3364b92f263` (atdd-p1)
- **Implementation commit:** `62f80b5ff2a7bcc3784bde733444cf6a52ceaba2` (implement-p1, retry after hermetic-verify gate rewind)
- **Reviewer model:** opus (fresh integrity-review session, Loop mode)
- **Verdict:** **PASS** (integrity clean → hands off to `review-correctness`)

---

## Boot smoke test

`smoke_command` is empty (`""`) and `toolchain.layers.smoke.status: "n/a"` (no build step;
single self-contained `index.html`; `verify` already loads/boots it). Minimal check:
`index.html` present (189 340 bytes) and parses. Result: **passed** (logged no-op for the
empty smoke command). The inherited base (HEAD `f2217e3`, the human-fix unblock commit) is
healthy — full `npm run verify` exits 0 (below).

## Step 1 — Plan (Phase 1)

- **Behavioral rule:** On every page-load with no interaction, the active lognormal
  parameter set is the **Empirical parameters** table and the **Empirical** radio is the
  selected/highlighted option (UI selection and `activeParams` mutually consistent).
  Selecting **Synthetic** swaps both back and vice-versa; the selection is never persisted
  across reloads.
- **Invariants:** I-1 `[test-only]` (cross-surface HTML↔JS consistency: empirical-checked ⇔
  `activeParams === T_SHIRT_PARAMS_EMPIRICAL`); I-2 `[test-only]` (no persisted state —
  `localStorage` empty across toggles, reload resets). **No `[contract]` invariants**
  (`contract.enabled: false`).
- **Counterexamples (must NOT pass):** test/JSDOM-only branch flipping the default only
  under the harness; an `activeParams` init that equals empirical on carry-through sizes but
  is in fact the synthetic table; any `localStorage`/`sessionStorage`/URL persistence;
  achieving the default by mutating the parameter tables; any production import from
  `tests/`/`__mocks__/`/`fixtures/`/`fakes/`.
- **Forbidden shortcuts:** no persistence layer; no env/identity/global-keyed branch
  (`NODE_ENV`/`process.env.TEST`); no edit/recalibration/reorder of either parameter table
  or the sidebar reference panel; no change to the `change` handler's swap logic.
- **Expected observable outcomes:** empirical radio `checked` + `#param-label-empirical.active`
  on load, synthetic unchecked/unhighlighted; `activeParams === T_SHIRT_PARAMS_EMPIRICAL`;
  toggle follows both ways; `localStorage` empty; idempotent across fresh loads.
- **Oracle strategy:** class **(a)** cheap oracle (directly assertable). `oracle_free.enabled: false`.
- **Properties to PBT:** one parametric property — ∀ Recognised t-shirt size `s`,
  `activeParams[s].(mu,sigma) === T_SHIRT_PARAMS_EMPIRICAL[s].(mu,sigma)` by value; generator
  domain = `Object.keys(T_SHIRT_PARAMS_EMPIRICAL)` read from the loaded window; adversarial
  edges = carry-through sizes (`2XS/XL/XL+`, must still hold) and calibrated sizes
  (`XS/S/M/L`, the non-vacuous driver).
- **Mutation (DoD):** recorded **N/A** — see Step 7.

## Step 2 — Implementation diff (read before the tests)

`git diff f7eb97d..62f80b5` production files = exactly **`index.html`** + **`package.json`**
(all other changed paths are `docs/atdd-logs/**` and `docs/backlog/**` artifacts, not
production).

`index.html` (the feature — six in-place edits, line numbers stable because all edits are
in-place):
- `:952` removed `class="active"` from `#param-label-synthetic`.
- `:953` removed `checked` from the synthetic radio.
- `:956` added `class="active"` to `#param-label-empirical`.
- `:957` added `checked` to the empirical radio.
- `:1332` comment `default: synthetic` → `default: empirical`.
- `:1333` `let activeParams = T_SHIRT_PARAMS;` → `let activeParams = T_SHIRT_PARAMS_EMPIRICAL;`.
- The `param-mode` `change` handler (`:4522-4531`) is **absent from the diff** → byte-for-byte
  unchanged (AT-3 exercises the real, unmodified handler).

`package.json` (`verify` script — the hermetic-verify root-cause fix):
- `"verify": "npm run lint && … && vitest run"` →
  `"verify": "{ [ -e node_modules/.bin/eslint ] || npm ci; } && npm run lint && … && vitest run"`.

**Initial assessment from the diff alone (before reading the tests):**
1. *General rule vs. keyed on values:* the `index.html` change implements the **general
   rule** — flip the static-HTML `checked`/`.active` and the module-scoped initializer to
   empirical. No conditional, no fixture literal, no env/identity branch. Not keyed on
   specific values.
2. *Every changed file maps to the rule:* the six `index.html` edits map directly to the
   behavioral rule; the `package.json` edit is **infrastructure** (a hermetic `npm ci`
   bootstrap), not feature logic — assessed under Step 3.
3. *Suspicious constructs:* none in `index.html`. The `package.json` change **prepends** a
   guarded `npm ci` to the existing chain and **disables/removes/reorders no layer** — all
   five layers (`lint`, `scan:forbidden`, `scan:deps`, `secretlint`, `vitest run`) remain
   identical and in order.

## Step 3 — Test-gaming scan

| Pattern | Finding |
|---|---|
| Hard-coded fixture values | **None.** The change uses `T_SHIRT_PARAMS_EMPIRICAL`, a real in-repo domain constant, not a fixture literal. |
| Conditionals on test-only identifiers | **None.** |
| Skipped/deleted tests | **None.** `git diff f7eb97d..62f80b5 -- tests features e2e acceptance` is **empty** — no test file changed between test and impl commit. |
| Weakened assertions | **None** (no test files changed). |
| Production imports from test helpers | **None** in the production diff. |
| Environment checks in production logic | **None.** No `NODE_ENV`/`process.env.TEST`/global-keyed branch. |
| Excessive/incorrect mocking | **N/A** (single static HTML; no mocks). |
| Tautological mock / internal-state assertions | **N/A** (no test changes). |
| Patched test runners / correctness-gate configs / thresholds | **`package.json` `verify` changed — NOT a loosening.** It prepends `{ [ -e node_modules/.bin/eslint ] \|\| npm ci; } &&` to the existing chain. No `vitest.config`/rule/threshold/scope is changed; no layer disabled, downgraded, or scope-narrowed; the brace group's exit status is `npm ci`'s on a miss, so a failed install aborts `verify` loudly (it cannot mask a later layer). This is a hermetic **precondition** (the gate runs `verify` in a bare worktree with no `node_modules`), i.e. a *robustness* addition, not a goalpost move. **Not a FAIL.** |
| Stale/pre-generated artifacts | **None.** The `docs/atdd-logs/**` files are this session's per-layer + hermetic-verify logs (legitimately produced), not test-result files used to fake green. |
| Changed fixtures | **None.** Neither parameter table nor any seed data is modified. |

**No gaming pattern found.**

## Step 4 — Tests vs. plan (read after forming the Step 2 view)

Committed tests at the test commit:
- `tests/acceptance/0022-empirical-default-on-load.test.js` — AT-1, AT-2, AT-4.
- `tests/acceptance/0022-empirical-default-params-property.test.js` — the per-size `test.prop`
  property + calibrated/carry-through/negative examples + AT-3 (toggle regression guard).

Mapping & coverage:
- **AT-1** → radio `checked` + `#param-label-empirical.active`, synthetic negative. ✓
- **AT-2** → reference identity `activeParams === T_SHIRT_PARAMS_EMPIRICAL` **and** `!== T_SHIRT_PARAMS`. ✓
- **AT-3** → toggle both ways through the **real, unmodified** `change` handler (binding +
  `.active` follow the selection synthetic↔empirical). ✓
- **AT-4** → fresh load defaults empirical even after a prior window selected synthetic;
  `localStorage.length === 0` across toggles; `getItem('param-mode')` null. ✓
- **PBT property** → `test.prop([fc.constantFrom(...RECOGNISED_SIZES)])` where
  `RECOGNISED_SIZES = Object.keys(read(loadSimulator(), 'T_SHIRT_PARAMS_EMPIRICAL'))` — the
  domain is read from the loaded window, **not hand-listed**, so it tracks the table rather
  than a fixture copy; shrinking on (default); asserts `activeParams[size].(mu,sigma)` by
  value against the empirical table. Satisfies the plan's single parametric property and the
  `pbt.import_symbol` (`test.prop`) floor.
- **Could the impl pass every visible test yet violate a counterexample?** No. The
  by-value-per-size property over calibrated sizes (`XS/S/M/L`, whose empirical μ differs from
  synthetic) + the explicit "does not bind calibrated S to synthetic μ" negative + AT-2's
  reference identity jointly rule out a synthetic-on-load default that merely matches on the
  carry-through sizes. AT-4 rules out persistence. The forbidden-pattern scan (Step 3) rules
  out an env/harness-only branch.
- **External-source mirroring:** plan declares **N/A — no external behavior mirrored**; the
  empirical constants are an in-repo calibration. No parity test required (correctly absent).
- **PBT coverage:** the one non-N/A parametric property has a generator-based property test —
  **no coverage gap**.
- **Oracle-free coverage:** phase is oracle class **(a)**; no metamorphic/differential
  relation required (`oracle_free.enabled: false`). N/A.

**No missing coverage.**

## Step 5 — Invariants vs. implementation

```
Invariant: I-1 — empirical-checked ⇔ activeParams === T_SHIRT_PARAMS_EMPIRICAL (cross-surface HTML↔JS consistency)
Enforcement: [test-only]
Status: SATISFIED
Contract: N/A (test-only — cross-surface, no single O(1) function precondition; contract.enabled=false)
Evidence: index.html:957 (empirical radio `checked`) + :956 (`.active` on empirical label) are
  consistent with :1333 (`let activeParams = T_SHIRT_PARAMS_EMPIRICAL`). Both surfaces point at
  empirical on load; AT-1 + AT-2 + the property pin both directions.

Invariant: I-2 — no persisted state (localStorage empty across toggles; reload resets to empirical)
Enforcement: [test-only]
Status: SATISFIED
Contract: N/A (test-only — whole-window/storage property, not a local pre/postcondition)
Evidence: the production diff introduces no localStorage/sessionStorage/URL access; the default
  comes only from the static `checked` attribute + the initializer. AT-4 asserts empty storage.
```

No `[contract]` invariants → gate sub-check (g) does not run. Honest classification, not an omission.

## Step 6 — Negative control (always-run smoke check)

Mutated the most important behavioral rule (page-load default = empirical) by reverting the
initializer, then restored via `git checkout`:

1. **Inject:** `index.html:1333` `T_SHIRT_PARAMS_EMPIRICAL` → `T_SHIRT_PARAMS` (synthetic default).
2. **Run:** `npx vitest run tests/acceptance/0022-empirical-default-on-load.test.js tests/acceptance/0022-empirical-default-params-property.test.js` → **exit 1**, `5 failed | 3 passed`. The property failed with `Counterexample: ["XS"]` (a **calibrated** size — the non-vacuous driver); AT-2, AT-4, the calibrated-M example, and the calibrated-S negative also fired.
3. **Confirm failure:** ✓ exit code 1.
4. **Revert:** `git checkout -- index.html` → `:1333` restored to `T_SHIRT_PARAMS_EMPIRICAL`.
5. **Re-run:** same command → **exit 0**, `8 passed (8)`. Working tree clean (`git status --porcelain` empty).

No `[contract]` invariant exists, so the "contract must fire" sub-clause does not apply.
**Negative control: PASS.**

## Step 7 — Mutation testing (scored adequacy gate)

**N/A — not run, does not block.** `mutation.enabled: false` in `backlog.config.json`, **with a
recorded N/A**: `toolchain.layers.mutation.status: "n/a"` (human toolchain decision 2026-06-21)
and **ADR-0036**. This is the human resolution of the prior run-01 BLOCKED: StrykerJS 9.x's
`mutate` line-range filter is **script-relative** and resets per inline `<script>` block, so no
file-line range isolates the param-mode block (planned `index.html:4522-4531` → 0 mutants; the
script-relative `28-30` over-captures unrelated blocks), and the changed line
`let activeParams = …` yields 0 mutants anyway; whole-file mutation (3589 mutants) is
impractical and dominated by UI the engine suite does not exercise. The behavioral guarantee
is carried instead by the **passing Step-6 negative control** + the **per-size empirical-on-load
PBT property**. Per the skill, mutation is skipped entirely when disabled; the
`mutation-unconfigured` block applies only when there is **no recorded N/A** — here the N/A is
recorded, so the phase is not blocked on this axis. (The orchestrator's mutation-forcing gate
likewise does not fire because the layer is deliberately marked `n/a`.)

## Step 8 — Additional verification tests

**None.** Steps 4–5 found no missing cases, edge cases, or invariant gaps. AT-1..AT-4 + the
per-size PBT property + the calibrated/carry-through/negative examples cover the behavioral
rule and every counterexample. No additive probe needed.

## Supporting evidence

- Full `npm run verify` on the committed tree: **exit 0**, `234 passed | 1 skipped` (all
  correctness layers — ESLint lint, eslint-plugin-security SAST, ast-grep forbidden,
  npm-audit dep-scan, secretlint, vitest — green).
- 0022 suite green baseline before the negative control: `8 passed (8)`.
- No test-file drift: `git diff f7eb97d..62f80b5 -- tests features e2e acceptance` empty.

---

## Verdict

```
Phase 1 review verdict: PASS

Test gaming patterns found: none
Invariant gaps: none (I-1, I-2 both [test-only], SATISFIED; no [contract] invariants)
Missing test coverage: none (AT-1..AT-4 + per-size PBT property + triangulation examples all map to the plan; oracle (a); parity N/A; PBT property present and non-vacuous)
Additional verification tests written: none
Negative control result: PASS (inject synthetic default → exit 1, 5 failed, property counterexample ["XS"]; revert → exit 0, 8 passed)
Mutation score (scoped): N/A (mutation.enabled=false, recorded N/A — toolchain.layers.mutation.status="n/a", ADR-0036)
Surviving mutants: N/A

Overall: The integrity axes are all clean over f7eb97d..62f80b5. No test file changed between
the test and implementation commits; no test-gaming pattern is present; the second production
change (the package.json `verify` self-bootstrap) adds a hermetic `npm ci` precondition without
disabling, downgrading, or scope-narrowing any correctness-gate layer, so it is infrastructure,
not a goalpost move. Invariants I-1/I-2 are [test-only] and SATISFIED (no [contract] invariants).
AT-1..AT-4, the per-size fast-check property, and the triangulation examples map cleanly to the
plan's behavioral rule and rule out every stated counterexample; the property is generator-based
over the table's own key set and non-vacuous on the calibrated sizes. The negative control
confirms the suite catches a deliberate revert-to-synthetic bug (exit 1, counterexample a
calibrated size) and goes green again on revert. Mutation is a recorded N/A (ADR-0036), so it is
skipped and does not block. Integrity review PASSES → hand off to /stage-review-correctness.
```

Saved review file: `docs/reviews/0022-empirical-lognormal-default-phase-1-review-02.md`
