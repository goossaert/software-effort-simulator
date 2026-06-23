# Integrity review — 0023 Error Report tab — Phase 2 — run 01

- **Plan:** `docs/plans/0023-error-report-tab.md` (Phase 2 — all remaining diagnostics, codes 3-22 + full presentation contract)
- **Phase:** 2 (feature-phase)
- **Review run:** 01
- **Date:** 2026-06-23
- **Test commit (atdd p2):** `57b38dc23c39a46a0666a0736cf3466ed3cbf47e`
- **Impl commit (implement p2):** `cbbabc6b64d749e4eff7fde0d173b32ee1b6d304`
- **Diff range reviewed:** `57b38dc..cbbabc6` (production change is `index.html` only, originating in commit `0ea82c9`)
- **Reviewer mandate:** integrity only (test gaming, tamper/immutability, contract assertions, PBT/oracle coverage, mutation adequacy). Correctness-from-spec is the next stage.

---

## Step 1 — Plan (Phase 2 extracts)

Phase 2 is the consolidated slice covering **codes 3-22** plus the DC-3 presentation
contract (former Phases 2-6 preserved verbatim as sub-sections). Key items:

- **Behavioral rules:** each silent-drop / coercion the engine performs is surfaced as a
  `Data-quality finding` at its mandated severity; `MQ_FORWARD_DOUBLE_COUNT` is reported
  at `ERROR` (DC-5) **without** changing engine math; the report groups findings into
  per-category sections sorted `ERROR→WARNING→INFO` with a by-severity badge.
- **`[contract]` invariants:** I-3 (severity ∈ `ERROR|WARNING|INFO`), I-4 (≥1 locator;
  run-level findings carry a single `run` locator); plus per-sub-section `[contract]`
  tags (QUARTER_NO_EPICS count non-negative; coercion finding iff `entered !== used`;
  DUP row count ≥2; CONSTANT_WORK_EXCLUDED iff `getConstantWorkExcluded.rows>0` with
  matching PM; badge totals = severity-partitioned `findings.length`;
  `MQ_FORWARD_DOUBLE_COUNT.severity === 'ERROR'`).
- **`[test-only]` invariants:** I-1 (engine output unchanged with/without report), I-2
  (partition/uniqueness per code-family), I-5 (normalise exactly as the engine: `.trim()`
  / detected init-key column), and the run-parameter pair
  **`LAMBDA_ZERO ⇔ lambda === 0`** / `TOTAL_K_ZERO ⇔ sum(kPerGroup) === 0`.
- **Counterexamples / forbidden shortcuts:** no fixture-identity special-casing; no
  re-deriving `#capacity`/`#iterations` inside the collector; no altering `kPerGroup`/
  `targetInits` to "fix" the double-count; explicit sort (no Map/Set iteration order);
  reuse `getConstantWorkExcluded` (single source); read-only collection.
- **Oracle strategy:** class **(a) cheap oracle** for every detector (constructed inputs
  have directly-assertable expected findings); I-1 is a metamorphic equality layered on
  top. No oracle-free machinery required (`oracle_free.enabled: false`).

## Step 2 — Implementation diff (read before the tests)

`git diff 57b38dc..cbbabc6` touches production code only in `index.html` (+335/-2). The
docs/log files in the range are non-production (handover, verify log, index). Initial
assessment from the diff alone:

1. **General rule vs keyed-on-values:** the detectors are rule-based — they iterate
   `parsedEpics` / `editedInitiatives`, build `Map`/`Set` aggregates, and emit findings
   from domain conditions (blank link, set membership, multiplicity ≥2, distinct-quarter
   count ≥2, `entered !== used`, etc.). No branch keys on a fixture id/value.
2. **Every changed file maps to the rule:** only `index.html` changed; the new
   `collectRunLevelFindings` seam (codes 8-9) and the additive `prepareSimulationData`
   diagnostics block (codes 3-7, 10-22) map directly to the plan's collection seams.
   The run-handler wires `collectRunLevelFindings({entered..., used...})` and renders
   `findings.concat(runLevel)` inside the completed-Run path.
3. **Suspicious constructs:** one item flagged for scrutiny — `LAMBDA_ZERO` is guarded by
   `lambda === 0 && epicSizingDist.length === 0`, where the plan's `[test-only]`
   invariant states `LAMBDA_ZERO ⇔ lambda === 0`. Investigated in Steps 4-5 (it is a
   general, non-gamed refinement that the committed AT-5 presentation test actually
   *requires*; recorded as a spec deviation handed to the correctness review). No other
   suspicious constructs.

## Step 3 — Test-gaming scan

| Pattern | Result |
|---|---|
| Hard-coded fixture values in production logic | **None** — scan of added lines for `EPIC-*`/`I-DUP`/`GHOST`/`DUP-1`/`Team A`/`XXL`/`Q# 202#` found nothing. |
| Conditionals on test-only identifiers | **None.** |
| Skipped/deleted tests | **None** — `git diff 57b38dc..cbbabc6 -- tests features e2e acceptance` is **empty**. |
| Weakened assertions | **N/A** — no test files changed. |
| Production imports from `tests/`/`__mocks__/`/`fixtures/`/`fakes/` | **None.** |
| Environment checks (`NODE_ENV==='test'`, `process.env.TEST`) | **None.** |
| Excessive/incorrect mocking; tautological mock assertions | **None** — tests drive the real page-realm functions via the harness. |
| Patched runners / correctness-gate configs / thresholds | **None** — no `vitest.config`/eslint/ast-grep/threshold files in the range. |
| Blanket suppressions (`eslint-disable`/`@ts-nocheck`/`# noqa`/`# nolint`/`ts-ignore`) | **None** in added production lines (grep clean). |
| Stale/pre-generated artifacts | The committed `…-phase-2-verify.log` is the implement phase's own verify output (non-production); not used as a gate input by this review. |
| Changed fixtures | **None.** |

> Context note: the prior implement attempt's handover commit `75f5ead` was gate-rejected
> for **`suppression-token`** because its *handover prose* contained the literal
> `eslint-disable`/`@ts-nocheck` tokens. The shipped production diff (`0ea82c9`) contains
> **no** such tokens; the current handover-12 was reworded. Confirmed independently here.

**Test immutability: PASS.** No file under `test_paths` changed between test and impl commits.

## Step 4 — Tests (read after forming the Step 2 view)

11 committed files (6 acceptance + 5 property), all `0023-phase-2-*`. Coverage maps
1:1 to the plan's acceptance scenarios for codes 3-22 and the DC-3 presentation contract
(scope, run-parameters, duplicates/overlaps, integrity, multi-quarter, presentation).

**PBT coverage (the host gate sub-check (f) backstops this).** `pbt.enabled: true`,
`min_per_rule: 1`, `import_symbol: fc.property|test.prop|it.prop`. Every non-N/A plan
property row has a genuine `@fast-check/vitest` `test.prop` with an explicit generator
over the stated domain (incl. adversarial edges) and shrinking on, asserting on what the
production computes:

| Plan property row | Test |
|---|---|
| ORPHAN ∪ EPIC_OUT_OF_SCOPE partition | `prop-scope` P1 |
| QUARTER_NO_EPICS iff + count | `prop-scope` P2 |
| CAPACITY_COERCED iff `used!==entered` | `prop-coercion` P1 |
| ITERATIONS_CLAMPED iff `used!==entered` | `prop-coercion` P2 |
| DUP_INITIATIVE_KEY = trimmed multiplicity ≥2 | `prop-duplicates` P1 |
| HIST_TARGET_OVERLAP = trimmed hist∩target | `prop-duplicates` P2 |
| DANGLING vs ORPHAN partition | `prop-integrity` P1 |
| CONSTANT_WORK_EXCLUDED single-source PM/rows | `prop-integrity` P2 |
| render order + badge (DC-3) | `prop-presentation` P1 |
| MQ_FORWARD_DOUBLE_COUNT keys + kPerGroup unchanged (I-1) | `prop-presentation` P2 |

10 Phase-2 properties + 2 Phase-1 = **12 cumulative ≥ whole-plan `pbt-floor` 12**. No
PBT coverage gap. (The `prop-duplicates` DUP and `prop-presentation` MQ properties install
raw, untrimmed rows by assigning `editedInitiatives` directly — the documented way to
exercise whitespace variants past the harness Papa stub's per-cell trim.)

**Oracle-free:** plan Oracle class is **(a)** for every detector; `oracle_free.enabled:
false`. No metamorphic/differential coverage required.

**Could the impl pass all visible tests yet violate a plan counterexample?** Checked the
named counterexamples — fixture special-casing (none), de-dup that changes `kPerGroup`
(MQ math untouched; `prop-presentation` P2 asserts `kPerGroup` byte-equal to an
independent recompute), Map/Set-order rendering (renderErrorReport sorts explicitly;
`prop-presentation` P1 green), re-summing CW PM with a different formula (impl reads
`cwExcluded.pm`/`.rows` directly). All ruled out.

**One spec deviation surfaced (handed to correctness review, not an integrity failure):**
the committed presentation test `0023-phase-2-acc-presentation.test.js` (AT-5) seeds an
orphan epic with a **recognised** size `M` alongside the unrecognised-size epic, then
asserts the badge shows exactly **`1 WARNING`**. In that fixture `lambda === 0` (the
orphan contributes 0 to `epicCounts`) while `epicSizingDist === ['M']` (the orphan is
in-scope by quarter, so it is pushed to the sizing distribution). A strict
`LAMBDA_ZERO ⇔ lambda === 0` would emit a *second* WARNING and break the badge
assertion — so the committed test **implicitly requires** the `epicSizingDist.length === 0`
guard the implementation added. This is a genuine **plan↔test inconsistency** that the
atdd phase baked in; the production code is faithful to the frozen tests. Whether
λ=0-with-orphan-sizing *should* warn is a spec/correctness question → flagged for
`/stage-review-correctness`.

## Step 5 — Invariants vs implementation

```
Invariant: I-3 — every finding's severity ∈ {ERROR,WARNING,INFO}
Enforcement: [contract]
Status: SATISFIED
Contract: PRESENT — index.html:2119-2121 (makeFinding throws on a bad severity)
Evidence: every Phase-2 detector and collectRunLevelFindings builds via makeFinding().

Invariant: I-4 — every finding has ≥1 locator; run-level findings carry a single run locator
Enforcement: [contract]
Status: SATISFIED
Contract: PRESENT — index.html:2122-2124 (makeFinding throws on missing/empty locators)
Evidence: run-level codes 6-9/18 use [{kind:'run',...}] (length 1); item-level codes use ≥1 epic/initiative/quarter/row locator.

Invariant: QUARTER_NO_EPICS impact is a non-negative integer count
Enforcement: [contract] (secondary; contract.enabled=false)
Status: SATISFIED (true-by-construction)
Contract: emit-guard `count > 0` + makeFinding as the assertion point
Evidence: count = initCountPerHistQ.get(q) (≥1 when emitted); impact embeds it.

Invariant: coercion finding emitted iff entered !== used
Enforcement: [contract]
Status: SATISFIED
Contract: PRESENT — the `if (enteredCapacity !== usedCapacity)` / `if (enteredIterations !== usedIterations)` guards in collectRunLevelFindings.
Evidence: prop-coercion P1/P2 assert the iff over generated raw strings (incl. NaN edges).

Invariant: DUP_INITIATIVE_KEY impact row count integer ≥2
Enforcement: [contract] (secondary)
Status: SATISFIED (true-by-construction)
Evidence: emitted only when `count >= 2`; impact embeds count.

Invariant: CONSTANT_WORK_EXCLUDED iff getConstantWorkExcluded.rows>0, impact PM = its pm
Enforcement: [contract]
Status: SATISFIED
Contract: emit-guard `if (cwExcluded.rows > 0)`; impact uses cwExcluded.pm/.rows verbatim (single source — ADR-0037).
Evidence: prop-integrity P2 asserts the iff + PM/row equality against the helper.

Invariant: every row-level finding carries a concrete row locator
Enforcement: [contract] (I-4)
Status: SATISFIED
Evidence: INIT_MISSING_KEY / INIT_BAD_QUARTER / INIT_MISSING_TEAM_OR_CATEGORY use [{kind:'row', id:String(i)}].

Invariant: rendered badge totals = severity-partitioned findings.length
Enforcement: [contract]
Status: SATISFIED (renderErrorReport unchanged from Phase 1; exercised here across all categories)
Evidence: prop-presentation P1 (green) asserts per-severity badge counts for random finding multisets.

Invariant: MQ_FORWARD_DOUBLE_COUNT.severity === 'ERROR'  (DC-5)
Enforcement: [contract]
Status: SATISFIED
Evidence: hard `severity:'ERROR'` in the MQ block; acceptance AT-1 asserts ERROR; engine math untouched.

Invariant: I-1 — engine output identical with/without the report
Enforcement: [test-only]
Status: SATISFIED
Contract: N/A
Evidence: the diagnostics block only reads engine arrays/Sets and pushes to a local `findings`; it assigns no engine variable; the return adds `findings` to the unchanged {lambda, epicSizingDist, kPerGroup, fixedEffortPerGroup, preview}. prop-presentation P2 asserts kPerGroup byte-equal.

Invariant: I-2 — partition/uniqueness per code family
Enforcement: [test-only]
Status: SATISFIED
Evidence: ORPHAN/OOS via if/else on `!link`; DANGLING only in the non-blank branch (disjoint from ORPHAN); prop-scope P1 + prop-integrity P1 assert the partitions.

Invariant: I-5 — normalise exactly as the engine (`.trim()` / detected init-key column)
Enforcement: [test-only]
Status: SATISFIED
Evidence: every detector trims; DUP/QUARTER_NORM_VARIANT/HIST_TARGET_OVERLAP/MQ group by trimmed forms; properties feed whitespace variants and confirm the engine-faithful collapse.

Invariant: LAMBDA_ZERO ⇔ lambda === 0
Enforcement: [test-only]
Status: AT RISK / DEVIATES (impl = `lambda === 0 && epicSizingDist.length === 0`)
Contract: N/A
Evidence: the extra guard suppresses LAMBDA_ZERO when in-scope sizing data exists but no
initiative-attributed count produces λ>0 (e.g. an in-window orphan epic). Reachable and
**required** by the committed AT-5 presentation test (see Step 4). Not gaming (general
domain condition, not fixture-keyed) and not contradicted by any committed test → not an
integrity failure; routed to the correctness review as a spec question.

Invariant: TOTAL_K_ZERO ⇔ sum(kPerGroup) === 0
Enforcement: [test-only]
Status: SATISFIED
Evidence: `(kPerGroup||[]).reduce((a,b)=>a+b,0) === 0`; acceptance AT-2 confirms (with λ>0 isolating it).
```

No `[contract]` invariant is a **dead contract**: the canonical runtime assertions live in
`makeFinding` (I-3/I-4) and every detector routes through it; the emit-guards enforce the
secondary `[contract]` conditions. `contract.enabled` is `false`, so the host's contract
floor (sub-check g) does not run, but the qualitative judgement above confirms live
enforcement.

## Step 6 — Negative controls (smoke check; mandatory)

GREEN baseline first: `npx vitest run tests/acceptance/0023-phase-2-*.test.js` → **11 files,
33 tests passed**.

**(A) Behavioral negative control — the marquee rule (MQ_FORWARD_DOUBLE_COUNT).**
1. Mutated `index.html`: `if (qSet.size >= 2)` → `>= 3` (a multi-quarter key must now span 3+ quarters).
2. `npx vitest run …acc-multi-quarter.test.js …prop-presentation.test.js` → **2 failed | 4 passed** (exit non-zero): MQ acceptance AT-1 and MQ property P2 both caught it.
3. Reverted the one-line mutation.
4. Re-ran → **GREEN**. `git diff --stat -- index.html` empty (clean revert).

**(B) Contract negative control — violates a `[contract]` invariant (I-3).**
1. Mutated `index.html`: `ORPHAN_EPIC` `severity: 'WARNING'` → `'CRITICAL'` (a value the I-3 contract forbids).
2. Ran the scope acceptance suite → the AT-2 test failed. The thrown value, captured directly from the page realm, is the **contract firing**:
   `[finding] invalid severity "CRITICAL" for code "ORPHAN_EPIC"` — the `makeFinding` I-3 assertion aborting **at construction**, not merely a downstream test expectation.
3. Reverted; re-ran the full Phase-2 suite → **33/33 GREEN**; `index.html` diff vs HEAD empty.

Both negative controls executed with real, non-zero failing runs and clean reverts.
**Negative control: PASS.**

## Step 7 — Mutation testing (scored adequacy gate)

`mutation.enabled: false` and `toolchain.layers.mutation.status: "n/a"` with a recorded
rationale (ADR-0036: StrykerJS cannot scope mutation to one inline `<script>` in a
multi-`<script>` single-file HTML app). This is a **recorded N/A**, not a missing
selection, so Step 7 is **skipped** and the loop does not block on a mutation score. The
Step 6 negative control stands as the hand-picked smoke check; per-rule adequacy is
covered by the 12 committed PBT properties.

**Mutation score (scoped): N/A (mutation.enabled=false).**

## Step 8 — Additional verification tests

None written. The integrity surface is clean and the one notable observation
(LAMBDA_ZERO guard) is a spec/correctness question already traced precisely and handed
to `/stage-review-correctness`; an additive integrity probe would only re-confirm the
documented, test-required behavior. No production code was modified by this review (the
two Step-6 mutations were reverted; `index.html` is byte-identical to commit `cbbabc6`).

---

## Verdict

```
Phase 2 review verdict: PASS

Test gaming patterns found: none
Invariant gaps: none (no dead [contract]); one [test-only] deviation noted —
  LAMBDA_ZERO ⇔ lambda===0 is implemented as `lambda===0 && epicSizingDist.length===0`,
  required by the committed AT-5 presentation test → routed to the correctness review as
  a spec question (not an integrity failure: general condition, no test contradicted).
Missing test coverage: none (all 10 Phase-2 PBT rows + 2 Phase-1 = 12 ≥ floor 12; oracle class (a))
Additional verification tests written: none
Negative control result: PASS (behavioral mutation killed; contract I-3 mutation fired makeFinding's runtime assertion)
Mutation score (scoped): N/A (mutation.enabled=false; toolchain mutation status n/a — ADR-0036)
Surviving mutants: none (mutation gate not run)

Overall: Integrity is clean. Test immutability holds (empty test-path diff across
57b38dc..cbbabc6); no test gaming, environment branches, suppression tokens, or
fixture-identity special-casing in the production change; all detectors route through
the makeFinding factory so the I-3/I-4 [contract] assertions are live (proven by a
contract negative control that fired makeFinding's own throw); every non-N/A plan
property has a genuine generator-based test (12 ≥ the whole-plan pbt-floor of 12); and a
behavioral negative control on the marquee MQ rule was killed and cleanly reverted. The
sole substantive finding — the LAMBDA_ZERO guard deviating from the plan's [test-only]
`LAMBDA_ZERO ⇔ lambda===0` invariant — is a documented, non-gamed, general refinement
that the committed presentation test actually requires; it is a spec/correctness matter,
explicitly the next stage's domain, and is handed off to /stage-review-correctness rather
than failed here. Integrity review PASSES; the feature-phase advances to
review-correctness.
```
