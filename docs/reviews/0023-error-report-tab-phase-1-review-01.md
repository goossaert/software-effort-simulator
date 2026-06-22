# Integrity review — 0023 error-report-tab, Phase 1, run 01

- **Plan:** `docs/plans/0023-error-report-tab.md` (Phase 1)
- **Feature-phase:** 1 (tab + finding model + render + empty state + unrecognised-size)
- **Review run:** 01
- **Date (UTC):** 2026-06-22
- **test_commit:** `36d5b1c8c94e2e40c62787d660a2354622655daa` (atdd p1 — RED confirmed)
- **impl_commit:** `d77e0abc6f340e4915560b91bf4fad942839c8ee` (implement p1)
- **Diff under review:** `git diff 36d5b1c..d77e0ab` (production-only; no test files in range)
- **Reviewer:** integrity review (stage-review), autonomous loop mode

## Verdict: **FAIL** (production bug — dead `[contract]` invariants), routed to `/stage-implement`

A genuine, evidence-backed integrity gap: the plan tags invariants **I-3** and **I-4**
as `[contract]` (and prescribes "assert in the finding constructor — cheap, local,
always-true"), but the production code constructs `Data-quality finding`s as plain
object literals with **no runtime assertion**. Step 6's contracted-invariant negative
control proves the contract is **dead** — a deliberate invalid `severity` is caught only
by a downstream test expectation, never by a runtime assertion. Per Step 5/Step 6 this
is a production-code gap → **FAIL routed to `/stage-implement`** (the implementer writes
the assertion; the reviewer never does). All other integrity checks PASS.

---

## Boot smoke test

`smoke_command` is empty in `backlog.config.json` → logged no-op. Minimal base-health
check performed instead: `index.html` loads (190,105 bytes) and contains the
`run-btn` handler. **Result: passed** (base is GREEN; the inherited tree at HEAD
re-runs the Phase-1 suite green — see baseline below).

---

## Step 1 — Plan (Phase 1) extract

- **Behavioral rule:** every in-scope **Epic** whose normalised t-shirt size is not a
  **Recognised t-shirt size** ⇒ exactly one `UNRECOGNIZED_SIZE_EPIC` (ERROR) locating
  it; every target-quarter **Constant work** row with an unrecognised size ⇒ exactly
  one `UNRECOGNIZED_SIZE_CONSTANT_WORK` (WARNING) locating the row. Collecting/rendering
  never aborts or alters the **Run**.
- **Invariants:**
  - `[contract]` **I-3** — every finding's `severity` ∈ {`ERROR`,`WARNING`,`INFO`}
    (assert in the finding constructor).
  - `[contract]` **I-4** — every item-level finding has `locators.length >= 1`; a
    run-level finding carries its single run-level locator (assert in the constructor).
  - `[test-only]` **I-1** — collecting diagnostics does not change the engine output
    (identical stats with/without findings for a fixed seed).
  - `[test-only]` **I-2** — completeness + uniqueness: each unrecognised-size epic/row
    appears in exactly one finding of its code; recognised-size produces none.
- **Counterexamples (must NOT pass):** hard-coding the empty-state for a fixture;
  special-casing a known epic key; flagging a recognised size differing only by case /
  trailing space (must normalise via `normalizeSize` — I-5); production importing from
  `tests/`/`__mocks__/`/`fixtures/`/`fakes/`; rendering in Map/Set iteration order.
- **Forbidden shortcuts:** no identity special-casing; read-only collection (no mutation
  of engine inputs / returned engine values — I-1); no clock/RNG; explicit sort; do not
  re-implement size recognition independently of `normalizeSize`/`T_SHIRT_PARAMS` (I-5).
- **Expected observable outcomes:** new tab button + panel; org stays `.active`;
  `prepareSimulationData(...).findings` is an array with existing fields unchanged;
  `renderErrorReport([])` → empty-state; a fatal Run never calls `renderErrorReport`.
- **Proposed seams:** additive `findings` on `prepareSimulationData`; `renderErrorReport`;
  tab markup + run-handler wiring.

## Step 2 — Implementation diff (read before the tests)

`git diff 36d5b1c..d77e0ab` touches only `index.html` (production) + the handover +
index.md. The production change:

1. **Tab markup** — `<button class="tab-btn" data-tab="error-report">Error Report</button>`
   appended last in `.tab-bar`; `<div id="tab-error-report" class="tab-panel"
   style="display:none">` after the groups panel (DC-1). ✔ maps to AT-1.
2. **`prepareSimulationData` — additive `findings`.** `const findings = []` declared;
   `UNRECOGNIZED_SIZE_EPIC` collected in the **`else` of the engine's own
   `if (T_SHIRT_PARAMS[size])` inclusion test** (single source of truth — the detector
   fires exactly when the engine excluded the epic; I-5/ADR-0037). `UNRECOGNIZED_SIZE_CONSTANT_WORK`
   collected over target-quarter constant-work rows via the same `normalizeSize` +
   `T_SHIRT_PARAMS` recognition. Return is `{ lambda, epicSizingDist, kPerGroup,
   fixedEffortPerGroup, preview, findings }` — all pre-existing fields unchanged in name
   and value; `findings` added. ✔ additive (I-1).
3. **`renderErrorReport(findings)`** — empty-state (`No data issues detected.`),
   `.slice().sort()` by an explicit comparator (SEV_ORDER → code → first-locator id;
   never Map/Set order), by-severity badge, section grouping by category. ✔ explicit sort.
4. **Run-handler wiring** — destructures `findings`, calls `renderErrorReport(findings)`
   in the completed-Run path (after the engine ran, so a fatal Run never reaches it),
   and adds `#tab-error-report` to the tab-reset block. ✔ maps to AT-1/AT-5.

**Initial assessment (before reading tests):**
1. *General rule vs keyed-on-values?* General. Detection is driven by the engine's own
   `T_SHIRT_PARAMS[normalizeSize(...)]` test — no fixture keys, no hard-coded epic ids.
2. *Every change maps to the rule?* Yes (markup, collection, render, wiring).
3. *Suspicious constructs?* **One concern flagged for Step 5:** findings are built as
   bare object literals — no finding constructor and no runtime assertion, despite I-3/I-4
   being tagged `[contract]`. Otherwise none.

## Step 3 — Test-gaming scan

| Pattern | Finding |
|---|---|
| Hard-coded fixture values in production | **None.** Severities are literal enum values (`'ERROR'`/`'WARNING'`), not fixture data; ids are derived from `epic._epic_key`/row keys. |
| Conditionals on test-only identifiers | **None.** |
| Skipped/deleted tests | **None.** `git diff 36d5b1c..d77e0ab -- tests features e2e acceptance` is **empty** — zero test-file changes in the range. |
| Weakened assertions | **None** (no test edits in range). |
| Production imports from test helpers | **None.** No import from `tests/`/`__mocks__/`/`fixtures/`/`fakes/`. |
| Environment checks (`NODE_ENV`/`process.env.TEST`) | **None.** |
| Excessive/incorrect mocking | **N/A** — no mocks; tests drive page-realm functions via the jsdom harness. |
| Tautological / internal-state assertions | **None** — tests assert observable `findings` fields + rendered panel text. |
| Patched runners / gate configs / thresholds | **None.** `vitest.config.*`, eslint, ast-grep rules, coverage/SAST thresholds unchanged in range. |
| Stale/pre-generated artifacts | **None.** |
| Changed fixtures | **None.** |

**Test-immutability (Step 3 hard gate):** the implement diff range
`36d5b1c..d77e0ab` contains **no** test-file changes. ✔ PASS.

> **Note on the human-fix commit (`fdbb375`, descendant of `d77e0ab`):** a human
> migrated the brittle `0020-AT-1` / `0021-AT-1` tab-bar count assertions
> (`toHaveLength(6)`) to the 7-tab reality — the same operator-approved precedent set
> when feature 0021 Phase 6 migrated `0020-AT-1`. This commit is **outside** the
> reviewed range `36d5b1c..d77e0ab` and touches **only test files + index.md (no
> `index.html`)**, so the integrity diff stays production-only with zero test-file
> changes. I inspected it: it loosens the two count assertions to positional checks and
> does **not** weaken or touch the 0023 Phase-1 tests; it hides no bug. The stage-review
> immutability rule (no implement-session test edits in `test_commit..impl_commit`) is
> satisfied.

## Step 4 — Tests read (after forming the initial view)

Files (committed at `36d5b1c`, byte-identical at HEAD):
- `tests/acceptance/0023-phase-1-error-report-tab.test.js` (AT-1…AT-5)
- `tests/acceptance/0023-phase-1-finding-model-property.test.js` (2 properties + triangulating examples + the I-3/I-4 contract example)

- **Behavioral coverage:** AT-1 (tab present/last/org-resting), AT-2 (empty state),
  AT-3 (epic unrecognised size → exactly one ERROR finding + panel shows the key + the
  recognised sibling NOT flagged), AT-4 (constant-work row → exactly one WARNING + 0 PM),
  AT-5 (engine output identical with/without a `findings` field; `runSimulation` reads
  none). All Phase-1 plan scenarios are covered; the suite is not overfit (it asserts on
  finding-level fields and panel text, not a fixed DOM tree).
- **Counterexample coverage:** the recognised-by-case/whitespace negative is exercised
  (`[' m ','xl+','2xs','S ']` → 0 findings) — guards I-5. Zero-epics boundary covered.
- **PBT coverage (plan "Properties / invariants to PBT"):**
  - *Property 1* (unrecognised-size partition) — covered by a generator-based
    `test.prop` over `SIZE_ARB` (recognised labels + lowercase/space variants + junk +
    `fc.string()`), shrinking ON, oracle computed through the page's own
    `normalizeSize`/`T_SHIRT_PARAMS` (not re-implemented — I-5). ✔
  - *Property 2* (advisory engine-equality, I-1) — covered by a generator-based
    `test.prop` over recognised-size arrays with a pinned seed, asserting engine
    stats/sorted equality with/without findings. ✔
  - Both invoke `pbt.import_symbol` (`test.prop`); PBT structural floor satisfied.
- **Oracle-free:** plan marks Phase 1 oracle class **(a) cheap oracle**;
  `oracle_free.enabled` is false. No metamorphic/differential machinery required. ✔
- **Authoritative references:** plan declares **N/A — no external source mirrored**; no
  parity test required. ✔
- **Could the impl pass all visible tests yet violate a counterexample?** Not for the
  behavioral rule (detection is engine-sourced). **But** for the `[contract]` invariants
  I-3/I-4 the suite verifies them **test-only** (the example at lines 140-163 checks the
  *produced* findings are valid) — it does **not** prove a *runtime* contract exists. See
  Step 5.

## Step 5 — Invariants vs implementation

```
Invariant: I-3 — every finding's severity ∈ {ERROR,WARNING,INFO}
Enforcement: [contract]
Status: AT RISK (values produced are valid, but no enforcement of the contract)
Contract: MISSING — no runtime assertion in index.html; findings are bare literals.
          The plan prescribes "assert in the finding constructor"; there is no
          finding constructor and no assert/throw guarding severity.
Evidence: prepareSimulationData pushes `{ code, severity:'ERROR'|'WARNING', ... }`
          object literals directly into `findings`. renderErrorReport even TOLERATES
          an unknown severity (SEV_ORDER fallback `!== undefined ? ... : 3`), the
          opposite of a contract. Step 6 NC-2 confirms a 'BOGUS' severity is NOT
          aborted at construction.
```

```
Invariant: I-4 — every item-level finding has locators.length >= 1 (run-level: its
           single run-level locator)
Enforcement: [contract]
Status: AT RISK
Contract: MISSING — no runtime assertion enforcing locators.length >= 1.
Evidence: locators arrays are built as 1-element literals; correct by construction
          today, but unguarded — a future detector (phases 2-6) that omits a locator
          would not be caught at construction time.
```

```
Invariant: I-1 — collecting diagnostics does not change engine output
Enforcement: [test-only]
Status: SATISFIED
Contract: N/A (test-only)
Evidence: findings collection is read-only (local array; no mutation of epic,
          editedConstantWork, editedInitiatives, or any returned engine value);
          epicSizingDist is built identically (recognised → push; unrecognised → skip,
          now also recorded as a finding but still NOT pushed). runSimulation takes no
          findings argument. AT-5 + Property 2 pass.
```

```
Invariant: I-2 — completeness + uniqueness for this phase's codes
Enforcement: [test-only]
Status: SATISFIED
Contract: N/A (test-only)
Evidence: one finding per excluded epic/row; recognised-size sibling not flagged
          (AT-3); Property 1 asserts the exact partition with no duplicates.
```

**The plan declares ≥1 `[contract]` invariant (two: I-3, I-4) and the changed
production code contains ZERO runtime assertions.** Per Step 5, a `[contract]` invariant
with no in-code assertion is a **production-code gap → FAIL routed to
`/stage-implement`**, naming the function + the contract it lacks (below).

*(Host gate context: `contract.enabled:false`, so the orchestrator's opt-in structural
sub-check (g) does not run. The skill is explicit that (g) is a WEAK opt-in backstop and
that "Step 5's qualitative per-invariant judgement remains the real check" — it is not
waived by the gate being off. The plan deliberately tagged I-3/I-4 `[contract]` while
tagging I-1/I-2 `[test-only]`; that distinction is meaningful and the implementation
must honour it. This is also the **first** plan in the repo to use `[contract]` — 0020/
0021/0022 used none — so there is no prior repo convention treating `[contract]` as
documentation-only.)*

## Step 6 — Negative control (mandatory)

Scoped to the Phase-1 test commands (the plan's "relevant test command"). All runs use
real exit codes; all mutations reverted with `git checkout -- index.html`.

**Baseline (no mutation):**
```
command: npx vitest run tests/acceptance/0023-phase-1-error-report-tab.test.js \
                        tests/acceptance/0023-phase-1-finding-model-property.test.js
exit_code: 0   →  Test Files 2 passed (2) | Tests 13 passed (13)
```

**NC-1 — behavioral mutation on the core rule (UNRECOGNIZED_SIZE_EPIC detection):**
```
mutation:  index.html:2110  `if (T_SHIRT_PARAMS[size]) {`  →  `if (T_SHIRT_PARAMS[size] || true) {`
           (the else-branch detector never fires → no unrecognised-epic finding)
command:   (both Phase-1 files)
exit_code: 1   →  Tests 5 failed | 8 passed (13)  (AT-3 + Property 1 + contract example + render + ...)
revert:    git checkout -- index.html  →  mutation gone
post-revert: baseline GREEN reconfirmed (exit 0)
```
→ The suite **kills** a broken detector. PASS.

**NC-2 — contracted-invariant violation (I-3): is the contract live?**
```
mutation:  index.html:2119  `severity: 'ERROR',`  →  `severity: 'BOGUS',`
           (a produced finding now carries an invalid Severity)
command:   npx vitest run tests/acceptance/0023-phase-1-finding-model-property.test.js
exit_code: 1
HOW CAUGHT: ONLY by a downstream test expectation —
   "AssertionError: expected [ 'ERROR', 'WARNING', 'INFO' ] to include 'BOGUS'"
   at the test-only I-3 check (finding-model-property.test.js:149).
   prepareSimulationData constructed and RETURNED the bogus finding with NO runtime
   abort. No assertion error / throw fired in production code.
revert:    git checkout -- index.html  →  mutation gone
```
→ **Dead contract.** Per Step 6: "A `[contract]` invariant whose deliberate violation
triggers no runtime assertion is a dead contract — a FAIL routed to `/stage-implement`."
The catch was "only a downstream test expectation, not the contract itself firing."
Worse, it is caught *only because a test happens to exercise that finding*: the
constant-work `WARNING` finding and every future-phase detector would carry a bad
severity silently. This is exactly the defense-in-depth the `[contract]` tag exists to
provide, and it is absent.

**Negative control result: PASS for the behavioral rule (NC-1); FAIL for the contracted
invariant (NC-2 — dead contract).**

## Step 7 — Mutation testing

**N/A.** `mutation.enabled: false`; `toolchain.layers.mutation.status: "n/a"` (ADR-0036:
StrykerJS cannot scope mutation to one inline `<script>` in the single-file multi-script
HTML app). The plan's Phase-1 Definition of done records mutation N/A and relies on the
per-rule PBT (Step 4) + the manual negative control (Step 6) for adequacy. The loop does
not block on a mutation score. No companion mutation report produced.

## Step 8 — Additional verification tests

**None written.** The failure is a **production-code gap** (a missing runtime
assertion), not a missing-test gap — the behavior is already well-covered (Step 4) and
the existing test-only I-3/I-4 example confirms the *produced* findings are valid. The
fix is a production assertion the implementer adds; no additive reviewer test is needed
(and the reviewer never writes the kill-test for a production-bug FAIL).

## Step 10 — Verdict

```
Phase 1 review verdict: FAIL (production bug — dead [contract] invariants I-3, I-4)

Test gaming patterns found: none
Invariant gaps: I-3 and I-4 are tagged [contract] but have NO runtime assertion in
  production (prepareSimulationData builds findings as bare literals; no finding
  constructor). Dead contract proven by NC-2.
Missing test coverage: none (behavioral + both PBT properties + counterexamples covered)
Additional verification tests written: none (production gap, not a test gap)
Negative control result: PASS (NC-1, behavioral) / FAIL (NC-2, contracted invariant — dead contract)
Mutation score (scoped): N/A (mutation.enabled = false; ADR-0036)

Overall: The Phase-1 implementation faithfully realises the behavioral rule with a
clean, single-source-of-truth detector (no test gaming, no fixture-keying, test
immutability intact, both required PBT properties present, the advisory I-1 invariant
satisfied, and the behavioral negative control killed). It FAILS one integrity check:
the plan deliberately tags I-3 and I-4 as [contract] and prescribes asserting them "in
the finding constructor", but the production code ships no runtime assertion — Step 6's
contracted-invariant negative control confirms an invalid severity is caught only by a
downstream test expectation, never by the contract firing. Per Step 5/Step 6 a dead
[contract] invariant is a production-code gap, FAIL routed to /stage-implement.
```

### Required production-only corrections (no test edits)

1. **Add a finding factory with the I-3/I-4 runtime assertions** in `index.html` (page
   `<script>` scope reachable by `prepareSimulationData`), e.g.:
   ```js
   function makeFinding({ code, severity, category, locators, impact = '', message }) {
     if (severity !== 'ERROR' && severity !== 'WARNING' && severity !== 'INFO') {
       throw new Error(`[finding] invalid severity "${severity}" for code "${code}"`); // I-3
     }
     if (!Array.isArray(locators) || locators.length < 1) {
       throw new Error(`[finding] code "${code}" must carry >= 1 locator`);            // I-4
     }
     return { code, severity, category, locators, impact, message };
   }
   ```
2. **Route both Phase-1 detectors through it** — replace the two
   `findings.push({ ... })` object literals (`UNRECOGNIZED_SIZE_EPIC` at ~`index.html:2114`
   and `UNRECOGNIZED_SIZE_CONSTANT_WORK` at ~`index.html:2168`) with
   `findings.push(makeFinding({ ... }))`. (Phases 2-6 and `collectRunLevelFindings`
   reuse the same factory — the contract then guards all 22 detectors.)
3. Do **not** edit any test file. The existing Phase-1 tests remain valid and green; the
   change is purely additive defensive enforcement. After the fix, re-confirm
   `npm run verify` is green under the hermetic checkout.

**Verification that the corrected contract is LIVE:** re-running the NC-2 mutation
(`severity: 'BOGUS'`) must then fail with the `makeFinding` `throw` firing inside
`prepareSimulationData` (a runtime abort), not only the vitest `expect(...).toContain`.

Routing: this is a **production fix** → re-run `/stage-implement` (Step 2),
`retry_count` 0 → 1.
