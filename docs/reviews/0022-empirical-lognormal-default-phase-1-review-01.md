# Integrity review — 0022 empirical-lognormal-default — Phase 1 — run 01

- **Plan:** `docs/plans/0022-empirical-lognormal-default.md` (Phase 1)
- **Slug / id:** 0022-empirical-lognormal-default
- **Review run:** 01
- **Date:** 2026-06-21T18:59:41Z
- **Test commit (atdd-p1):** `f7eb97de2c91eba6cd5b7ec51db1a3364b92f263`
- **Impl commit (implement-p1):** `62f80b5ff2a7bcc3784bde733444cf6a52ceaba2` (= HEAD)
- **Reviewer model:** opus (config `models.review`)
- **Verdict: BLOCKED** — every integrity axis is clean; the scored **mutation adequacy gate is
  unrunnable** with the committed toolchain config (`mutation.enabled: true`, DoD requires ≥70%),
  so the phase cannot be certified complete. Routed to a **human** (toolchain/config fix), not to
  implement (no production bug) nor atdd (no missing test).

## Boot smoke (LOOP-MODE boot ritual)

`smoke_command` is empty and `toolchain.layers.smoke.status = "n/a"` (no build step; single
self-contained `index.html`; verify loads/boots it) → the boot smoke is a logged **no-op**. As a
substitute build/boot check the base was exercised by the Step 6 clean run: targeted suite **exit 0,
8/8 passed**. Boot smoke result: **passed** (base green).

## Ordering

Read the plan + the production diff **before** the tests (per the skill's ordering rule). Initial
view formed from the diff alone, then compared against the committed tests.

## Step 1 — Plan (Phase 1) extract

- **Behavioral rule:** On every page-load with no interaction the active lognormal parameter set is
  the **Empirical** table and the **Empirical** radio is selected/highlighted (UI ⇔ `activeParams`
  mutually consistent). Selecting **Synthetic** swaps both back (and vice-versa); the selection is
  never persisted across reloads.
- **Invariants:** I-1 `[test-only]` cross-surface consistency (empirical-checked ⇔
  `activeParams === T_SHIRT_PARAMS_EMPIRICAL`); I-2 `[test-only]` no persisted state. **No
  `[contract]` invariants** (plan states this explicitly; `contract.enabled: false`).
- **Counterexamples (must NOT pass):** test/JSDOM-only default branch; an init that merely equals
  empirical on the carry-through sizes but is the synthetic table; any localStorage/sessionStorage/
  URL persistence; achieving the default by mutating the tables; production importing from
  tests/fixtures/fakes.
- **Forbidden shortcuts:** any persistence layer; env/identity/global-keyed branch; editing/
  recalibrating the param tables or the sidebar reference; altering the `change` handler's swap
  logic; (no fake wiring exists).
- **Expected observable outcomes:** DOM (empirical radio `checked`, `#param-label-empirical.active`,
  synthetic unchecked/unhighlighted); binding `activeParams === T_SHIRT_PARAMS_EMPIRICAL`; toggle
  follows both ways; `localStorage` empty across toggles; idempotent per load.
- **Oracle strategy:** (a) cheap oracle. **Properties to PBT:** one — per-Recognised-size
  empirical-on-load, generator domain = `Object.keys(T_SHIRT_PARAMS_EMPIRICAL)` (`2XS,XS,S,M,L,XL,
  XL+`), adversarial edges = carry-through `2XS/XL/XL+` (must hold) and calibrated `XS/S/M/L` (what
  a synthetic default fails). **DoD:** AT-1..AT-4 pass; property + examples stable green incl.
  shuffle; **scoped mutation ≥70%** on the param-mode region; hermetic verify green over the full
  correctness gate.
- **Proposed seams:** `input[name="param-mode"]` radios + `#param-label-*` labels + `.active`;
  module bindings `activeParams` / `T_SHIRT_PARAMS` / `T_SHIRT_PARAMS_EMPIRICAL`; samplers read
  through `activeParams`.

## Step 2 — Implementation diff (initial assessment, before reading tests)

`git diff f7eb97d..62f80b5` production files = exactly `index.html` + `package.json`:

- `index.html` (param-mode region): `#param-label-synthetic` loses `class="active"`; synthetic
  radio loses `checked`; `#param-label-empirical` gains `class="active"`; empirical radio gains
  `checked`; comment `default: synthetic` → `default: empirical`; `let activeParams = T_SHIRT_PARAMS;`
  → `let activeParams = T_SHIRT_PARAMS_EMPIRICAL;`.
- The `change` handler (`index.html:4522-4531`) shows **no hunk** — byte-for-byte unchanged
  (verified directly): `activeParams = radio.value === 'empirical' ? T_SHIRT_PARAMS_EMPIRICAL :
  T_SHIRT_PARAMS;` + the two `.classList.toggle('active', …)` lines. AT-3 passes through the real
  swap logic.
- `package.json` `verify` script: prepends a guarded bootstrap
  `{ [ -e node_modules/.bin/eslint ] || npm ci; } &&` before the **unchanged** layer chain
  (`lint && scan:forbidden && scan:deps && secretlint && vitest run`).

Answers to the three Step-2 questions:
1. **Implements the general rule, not keyed on values** — the flip is the static HTML default
   (`checked`/`.active`) + the unconditional module initializer. No conditionals, no fixture
   literals, no env/test branch.
2. **Every changed file maps to the rule** — `index.html` is the feature. `package.json`'s `verify`
   change is the hermetic-bootstrap fix from the prior gate rewind: it adds a guarded `npm ci` only,
   and **weakens no correctness layer** (no rule disabled, no strictness lowered, no severity raised,
   no scan scope narrowed, no suppression added; the `&&` chain after the guard is byte-identical).
   It is a *tightening* of robustness, not a goalpost move.
3. **No suspicious constructs** — the `[ -e node_modules/.bin/eslint ]` is a filesystem presence
   check in a build script, **not** a `NODE_ENV`/test branch in production logic.

## Step 3 — Test-gaming scan (each pattern explicitly)

- **Hard-coded fixture values:** none. The only changed literal is the named business constant
  `T_SHIRT_PARAMS_EMPIRICAL` and HTML `checked`/`class="active"` attributes.
- **Conditionals on test-only identifiers:** none.
- **Skipped / deleted tests:** none. `git diff f7eb97d..62f80b5 -- tests features e2e acceptance`
  is **empty** — no test file changed between the test and impl commits (immutability holds).
- **Weakened assertions:** none (no test changes).
- **Production imports from test helpers:** none (`index.html` imports nothing from
  tests/fixtures/fakes/`__mocks__`).
- **Environment checks in production logic:** none (no `NODE_ENV`/`process.env.TEST`/global-keyed
  branch in the diff; the `package.json` filesystem guard is not production logic).
- **Excessive / tautological mocking:** N/A (no mocks; the suite exercises the real loaded page).
- **Patched test runners / correctness-gate configs / thresholds:** none. No change to
  `vitest.config.*`, ESLint config, `stryker.conf.json`, `backlog.config.json`, or any
  coverage/SAST/dep-audit threshold in the impl diff (verified: that file-set diff is empty). The
  only build-script edit is the benign `verify` bootstrap (Step 2).
- **Stale / pre-generated artifacts:** the staged `docs/atdd-logs/0022-…-phase-1-*.log` are
  evidence logs produced by the implement phase, not test-result artifacts the suite consumes.
- **Changed fixtures:** none.
- **Suppression tokens (gate s2):** none in the added production lines (`@ts-nocheck` / `# type:
  ignore` / `eslint-disable` / `# noqa` / `# nolint`).

**Test-gaming patterns found: none.**

## Step 4 — Tests vs. the plan (read after Step 2)

Committed tests (`tests/acceptance/0022-empirical-default-on-load.test.js`,
`tests/acceptance/0022-empirical-default-params-property.test.js`):

- **AT-1** ✓ empirical radio `checked` + `#param-label-empirical.active`; synthetic unchecked +
  unhighlighted (happy + negative).
- **AT-2** ✓ reference identity `activeParams === T_SHIRT_PARAMS_EMPIRICAL` and
  `!== T_SHIRT_PARAMS`.
- **AT-3** ✓ bidirectional toggle both ways through the **real unmodified** handler (binding +
  `.active` follow).
- **AT-4** ✓ a fresh `loadSimulator()` re-defaults to empirical after a prior window selected
  synthetic; `localStorage.length === 0` across toggles; `getItem('param-mode')` null.
- **PBT property** ✓ `test.prop([fc.constantFrom(...RECOGNISED_SIZES)])` with the size set **read
  from the loaded window** (`Object.keys(T_SHIRT_PARAMS_EMPIRICAL)`, not hand-listed), shrinking on,
  asserting `activeParams[size].mu/.sigma` **by value** against the Empirical table. Matches the
  plan's sole property + generator domain; uses `test.prop` ⇒ satisfies the gate (f) `pbt.import_symbol`.
- Focused triangulation examples cover the calibrated `M` (happy), carry-through `2XS` (boundary,
  empirical == synthetic by value), and a calibrated-`S` negative (`activeParams['S'].mu !==`
  synthetic `μ`) — the non-vacuous driver.
- **Oracle (a):** cheap oracle; no metamorphic/differential needed (`oracle_free.enabled: false`).
  Nothing required.
- **External-mirroring:** plan *Authoritative references* = N/A (no external source); no parity test
  needed.

**Counterexample coverage:** the equals-empirical-on-carry-through-but-is-synthetic counterexample
is killed by the property on `XS/S/M/L` + AT-2 reference identity; the mutate-the-tables and
production-import counterexamples are excluded by the diff (none present). The test/JSDOM-only-branch
counterexample is not catchable by the JSDOM suite alone, but the production diff is verified free of
any env/global branch (Step 3) and the gate's structural forbidden-pattern scan (d) re-derives it.

**Coverage gaps:** none material to this implementation. Minor observation (not blocking): AT-4
asserts the no-persistence invariant specifically on `localStorage`; the plan's broader forbidden
list also names `sessionStorage`/URL, which the suite does not separately assert. The implementation
introduces **zero** persistence of any kind (verified by the diff), so this is not an active gap; it
is recorded only so a future persistence-adding change is matched by an equally broad guard.

## Step 5 — Invariants vs. implementation

```
Invariant: I-1 — empirical-checked ⇔ activeParams === T_SHIRT_PARAMS_EMPIRICAL (cross-surface HTML↔JS)
Enforcement: [test-only]
Status: SATISFIED
Contract: N/A (test-only — plan declares no [contract] invariant; consistency is cross-surface, no O(1) local check)
Evidence: index.html:956-957 (empirical radio checked + label .active) + index.html:1333
  (let activeParams = T_SHIRT_PARAMS_EMPIRICAL) are mutually consistent on load; the change handler
  (4525-4527) keeps them consistent on toggle. Enforced jointly by AT-1 + AT-2 + the property; AT-3
  covers both directions.

Invariant: I-2 — no persisted state (localStorage empty across toggles; reload resets to empirical)
Enforcement: [test-only]
Status: SATISFIED
Contract: N/A (test-only — whole-window/storage property, not a local pre/postcondition)
Evidence: the entire impl diff introduces no localStorage/sessionStorage/URL write anywhere; the
  default comes only from the static `checked` attribute + the initializer. Covered by AT-4.
```

No `[contract]` invariants ⇒ no runtime-assertion requirement; gate sub-check (g) does not run
(`contract.enabled: false`). Honest classification, consistent with the plan.

## Step 6 — Negative control (hand-picked mutation, ran with real exit codes)

Most important behavioral rule = the page-load default binding.

1. **Bug injected** — `index.html:1333` `let activeParams = T_SHIRT_PARAMS_EMPIRICAL;` →
   `let activeParams = T_SHIRT_PARAMS;` (reverts the default to synthetic).
2. **Command** — `npx vitest run tests/acceptance/0022-empirical-default-on-load.test.js
   tests/acceptance/0022-empirical-default-params-property.test.js`
   → **exit 1**, `Tests 5 failed | 3 passed (8)` (AT-2 reference identity, the per-size property,
   the calibrated `M`/`S` examples fail; the carry-through `2XS`, AT-1 radio, AT-3 toggle stay green).
3. **Reverted** — `git checkout -- index.html`; working tree clean; line 1333 restored.
4. **Re-run** — same command → **exit 0**, `Tests 8 passed (8)`.

**Negative control: PASS.** The committed suite catches a deliberate one-line regression of the
headline rule with a real non-zero exit. (No `[contract]` invariant exists, so no contract-firing
negative control is applicable.)

## Step 7 — Scored mutation adequacy gate

`mutation.enabled: true`, `mutation.command = "npx stryker run"`, `mutation.min_score = 70`,
`scope = changed-files`, `stryker.conf.json` `mutate = ["index.html:1333", "index.html:4522-4531"]`.

Ran the human-selected command **verbatim** (no tool/flag substituted). **It produced no score** —
`npx stryker run` **exited 1** at the dry-run: `Instrumented 1 source file(s) with 0 mutant(s)` and
`Vitest failed to find test files related to mutated files` → `No tests were executed`. Full report:
**`docs/reviews/0022-empirical-lognormal-default-phase-1-mutation-01.md`**.

Two independent, config-level blockers (root-caused; full detail in the mutation report):

1. **Scoped `mutate` ranges → 0 mutants.** `"index.html:1333"` is invalid mutation-range syntax
   (no `-end`) → matched no file; `"index.html:4522-4531"` is valid but emitted 0 mutants for the
   inline-HTML script. A diagnostic whole-file run (`mutate: ["index.html"]`) on the same committed
   tree instrumented **3589 mutants** — so Stryker *can* mutate this HTML; the **scoped line-range
   form is the defect**, not a capability gap.
2. **`vitest.related` finds no tests.** The suite loads `index.html` via the JSDOM harness
   (`fs.readFileSync` + `runScripts:'dangerously'`, `tests/harness.js`) with **no `import` edge**,
   so Stryker's default `vitest --related index.html` discovers nothing and aborts the dry-run.

**Scoped mutation score: n/a — not computable with the committed config.** This is **not** a
sub-threshold score and **not** a missing-test gap (the tests exist, pass, and kill the Step-6
regression); re-running `/stage-atdd` cannot make `--related` discover fs-loaded tests nor make the
line-range filter emit mutants. It is **not** a production bug either. It is a **toolchain/config
misconfiguration** whose fix a human owns (per the mutation report's options: set
`vitest:{related:false}`, fix the scoped `mutate` form to emit >0 mutants, or deliberately record
the mutation layer N/A for this single-file-HTML app). The skill mandates `blocked` rather than a
pass for a mutation misconfiguration that prevents scoring.

Note: `gate.mutation_command` is empty ⇒ inherits `mutation.command` (`npx stryker run`); the
authoritative post-stage gate sub-check (e) would hit the identical wall. (The implement commit
nonetheless advanced to `review` without a gate mutation rejection — so this integrity review is the
first place the unrunnable mutation gate is actually exercised, which is exactly why it must surface
here.)

## Step 8 — Additional verification tests

None written. The integrity axes are clean and the negative control already proves the suite's
sensitivity; the open item is a toolchain/config blocker that additive tests cannot resolve (and the
review must not modify `stryker.conf.json`).

## Step 10 — Verdict

```
Phase 1 review verdict: BLOCKED

Test gaming patterns found: none
Invariant gaps: none (I-1, I-2 both [test-only], SATISFIED; no [contract] invariants)
Missing test coverage: none material (minor note: AT-4 asserts no-persistence on localStorage only,
  not sessionStorage/URL — moot here, the impl adds zero persistence)
Additional verification tests written: none
Negative control result: PASS (bug → exit 1, 5 failed; revert → exit 0, 8 passed)
Mutation score (scoped): n/a — NOT COMPUTABLE (npx stryker run exited 1, 0 mutants instrumented +
  vitest.related found no tests); threshold 70%
Surviving mutants: none produced (Stryker aborted at the dry-run)

Overall: The test↔production integrity of this phase is sound — no test files changed between the
test and impl commits, no test-gaming patterns, both [test-only] invariants are satisfied, the sole
required PBT property is covered by a genuine generator-based test reading the table from the loaded
window, and the hand-picked negative control confirms the suite kills a real regression of the
page-load-default rule. The blocker is the scored mutation adequacy gate required by the plan's
Definition of Done: with mutation.enabled=true, the human-selected `npx stryker run` cannot produce
a score on this repo as configured — the scoped `mutate` line-ranges instrument 0 mutants (a
diagnostic whole-file run proves Stryker CAN mutate index.html: 3589 mutants, so this is a
range-config defect, not a capability gap) and the vitest runner's `related` discovery cannot find
the JSDOM-harness-loaded tests (no import edge). Because the mutation adequacy gate cannot be
measured, the phase cannot be certified, and the fix is a human toolchain/config change to
stryker.conf.json (or a deliberate mutation N/A) — not a production fix (→implement) and not a
missing test (→atdd), neither of which can resolve a Stryker/vitest-runner integration defect under
the immutability and review-scope rules. Verdict: BLOCKED, flagged for a human.
```

Saved review: `docs/reviews/0022-empirical-lognormal-default-phase-1-review-01.md`
Mutation report: `docs/reviews/0022-empirical-lognormal-default-phase-1-mutation-01.md`
